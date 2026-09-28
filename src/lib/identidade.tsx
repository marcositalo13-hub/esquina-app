import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Único ponto de leitura de identidade do app — telas nunca sabem se o
// usuário veio de uma sessão real (Supabase Auth) ou do seletor de teste,
// só leem { usuarioId, nome, papel, origem, carregando } por useIdentidade().
//
// Origem 'sessao' (login real): os dados já são buscados por
// app/_layout.tsx (sessao.user.id + a mesma consulta a `usuarios` que
// decide o redirecionamento pós-login) — reaproveitados aqui via props,
// nunca duplicados numa segunda consulta.
//
// Origem 'teste' (EXPO_PUBLIC_MODO_TESTE === 'true'): o colaborador
// escolhido no seletor (app/seletor-teste.tsx), persistido em
// AsyncStorage pra sobreviver a um recarregamento de página.

const modoTeste = process.env.EXPO_PUBLIC_MODO_TESTE === 'true';

const CHAVE_STORAGE_IDENTIDADE_TESTE = 'identidadeTeste';

export type UsuarioTeste = {
  id: string;
  nome: string;
  papel: string;
};

export type Identidade = {
  usuarioId: string | null;
  nome: string | null;
  papel: string | null;
  origem: 'sessao' | 'teste';
  carregando: boolean;
};

// Formato mínimo que app/_layout.tsx já resolve pro redirecionamento
// pós-login — reaproveitado como está, sem nenhuma consulta nova.
export type EstadoPapelReal =
  | { status: 'carregando' }
  | { status: 'deslogado' }
  | { status: 'pronto'; papel: string | null; nome: string | null };

type IdentidadeContextValue = Identidade & {
  definirIdentidadeTeste: (usuario: UsuarioTeste) => Promise<void>;
  limparIdentidadeTeste: () => Promise<void>;
};

const IdentidadeContext = createContext<IdentidadeContextValue | null>(null);

type IdentidadeProviderProps = {
  children: ReactNode;
  // Só relevantes na origem 'sessao' — em modo teste, `sessao`/`estadoPapel`
  // nem existem em app/_layout.tsx (seus efeitos retornam cedo).
  sessao?: Session | null;
  estadoPapel?: EstadoPapelReal;
};

export function IdentidadeProvider({
  children,
  sessao,
  estadoPapel,
}: IdentidadeProviderProps) {
  const [usuarioTeste, setUsuarioTeste] = useState<UsuarioTeste | null>(null);
  const [carregandoTeste, setCarregandoTeste] = useState(modoTeste);

  // Restaura do AsyncStorage no mount — só em modo teste. Sobrevive a
  // recarregar a página (web) ou reabrir o app (nativo). try/catch em cada
  // etapa: falha ao ler storage não pode travar a tela num "carregando"
  // eterno, só segue sem identidade nenhuma.
  useEffect(() => {
    if (!modoTeste) {
      return;
    }

    let montado = true;

    (async () => {
      try {
        const bruto = await AsyncStorage.getItem(
          CHAVE_STORAGE_IDENTIDADE_TESTE,
        );
        if (!montado || !bruto) {
          return;
        }
        try {
          setUsuarioTeste(JSON.parse(bruto) as UsuarioTeste);
        } catch {
          // Valor corrompido — segue sem identidade de teste.
        }
      } catch {
        // AsyncStorage indisponível — segue sem identidade persistida.
      } finally {
        if (montado) {
          setCarregandoTeste(false);
        }
      }
    })();

    return () => {
      montado = false;
    };
  }, []);

  const definirIdentidadeTeste = useCallback(async (usuario: UsuarioTeste) => {
    setUsuarioTeste(usuario);
    try {
      await AsyncStorage.setItem(
        CHAVE_STORAGE_IDENTIDADE_TESTE,
        JSON.stringify(usuario),
      );
    } catch {
      // Falha ao persistir não impede o uso durante a sessão atual, em
      // memória — só não sobrevive a um recarregamento de página.
    }
  }, []);

  const limparIdentidadeTeste = useCallback(async () => {
    setUsuarioTeste(null);
    try {
      await AsyncStorage.removeItem(CHAVE_STORAGE_IDENTIDADE_TESTE);
    } catch {
      // Estado em memória já foi limpo; nada mais a fazer.
    }
  }, []);

  const valor = useMemo<IdentidadeContextValue>(() => {
    if (modoTeste) {
      return {
        usuarioId: usuarioTeste?.id ?? null,
        nome: usuarioTeste?.nome ?? null,
        papel: usuarioTeste?.papel ?? null,
        origem: 'teste',
        carregando: carregandoTeste,
        definirIdentidadeTeste,
        limparIdentidadeTeste,
      };
    }

    return {
      usuarioId: sessao?.user.id ?? null,
      nome: estadoPapel?.status === 'pronto' ? estadoPapel.nome : null,
      papel: estadoPapel?.status === 'pronto' ? estadoPapel.papel : null,
      origem: 'sessao',
      carregando: !estadoPapel || estadoPapel.status === 'carregando',
      definirIdentidadeTeste,
      limparIdentidadeTeste,
    };
  }, [
    usuarioTeste,
    carregandoTeste,
    sessao,
    estadoPapel,
    definirIdentidadeTeste,
    limparIdentidadeTeste,
  ]);

  return (
    <IdentidadeContext.Provider value={valor}>
      {children}
    </IdentidadeContext.Provider>
  );
}

export function useIdentidade(): IdentidadeContextValue {
  const contexto = useContext(IdentidadeContext);
  if (!contexto) {
    throw new Error(
      'useIdentidade precisa ser usado dentro de um IdentidadeProvider.',
    );
  }
  return contexto;
}

export default IdentidadeProvider;
