import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import type { Session } from '@supabase/supabase-js';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../src/lib/supabase';
import { light } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Modo teste: sem login real, sem Supabase Auth. Toda a lógica de
// sessão/papel/redirecionamento abaixo é ignorada — o app abre no seletor
// de perfis restaurado do git (ver app/seletor-teste.tsx e app/index.tsx) e
// navega livremente entre /admin e /preservacao sem proteção de rota.
const modoTeste = process.env.EXPO_PUBLIC_MODO_TESTE === 'true';

// Rotas que exigem sessão ativa — Admin (tudo sob /admin) e a execução da
// Zeladoria (/preservacao, tela raiz). Sem sessão nelas, sempre volta pro
// login (ver o useEffect de proteção abaixo).
function ehRotaProtegida(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname === '/preservacao';
}

// undefined = ainda não checou a sessão inicial; null = checou, não tem.
type SessaoEstado = Session | null | undefined;

// Estado único pro papel do usuário, em vez de dois booleanos separados
// (papel/papelChecado) que podiam ficar fora de sincronia entre si — a
// causa raiz do bug diagnosticado: logout não resetava o papel antigo, e
// duas consultas a `usuarios` em voo ao mesmo tempo (de sessões diferentes)
// podiam sobrescrever uma à outra fora de ordem.
type EstadoPapel =
  | { status: 'carregando' }
  | { status: 'deslogado' }
  | { status: 'pronto'; papel: string | null };

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
  });

  const [sessao, setSessao] = useState<SessaoEstado>(undefined);
  const [estadoPapel, setEstadoPapel] = useState<EstadoPapel>({
    status: 'carregando',
  });

  // Sessão inicial (persistida via AsyncStorage) + qualquer mudança depois
  // (login, logout, refresh de token).
  useEffect(() => {
    if (modoTeste) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session ?? null);
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        setSessao(novaSessao);
      },
    );

    return () => {
      assinatura.subscription.unsubscribe();
    };
  }, []);

  // Papel do usuário autenticado — decide pra onde a Parte 3 manda depois
  // do login. `cancelado` evita que uma consulta antiga (de uma sessão que
  // já não é mais a atual) sobrescreva o resultado de uma mais nova.
  useEffect(() => {
    let cancelado = false;

    if (modoTeste) {
      return;
    }

    if (sessao === undefined) {
      setEstadoPapel({ status: 'carregando' });
      return () => {
        cancelado = true;
      };
    }

    if (!sessao) {
      setEstadoPapel({ status: 'deslogado' });
      return () => {
        cancelado = true;
      };
    }

    setEstadoPapel({ status: 'carregando' });
    supabase
      .from('usuarios')
      .select('papel')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => {
        if (cancelado) {
          return;
        }
        setEstadoPapel({ status: 'pronto', papel: data?.papel ?? null });
      });

    return () => {
      cancelado = true;
    };
  }, [sessao]);

  // Proteção de rota + destino pós-login, decidido só a partir de
  // estadoPapel — cobre tanto "acabei de logar" quanto "abri o app com
  // sessão já persistida" (Parte 1) parado em /login ou /.
  useEffect(() => {
    if (modoTeste) {
      return;
    }

    if (estadoPapel.status === 'carregando') {
      return;
    }

    if (estadoPapel.status === 'deslogado') {
      if (ehRotaProtegida(pathname)) {
        router.replace('/login');
      }
      return;
    }

    if (pathname === '/login') {
      if (estadoPapel.papel === 'administrador') {
        router.replace('/admin');
      } else if (estadoPapel.papel === 'zeladoria') {
        router.replace('/preservacao');
      } else {
        router.replace('/modulo-indisponivel');
      }
    }
  }, [estadoPapel, pathname, router]);

  const pronto = modoTeste
    ? fontsLoaded
    : fontsLoaded && estadoPapel.status !== 'carregando';

  useEffect(() => {
    if (pronto) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [pronto]);

  if (!pronto) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: light.bg },
        }}
      />
    </GestureHandlerRootView>
  );
}
