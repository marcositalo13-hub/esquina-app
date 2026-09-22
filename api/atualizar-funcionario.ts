import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export type PendenciaRota = {
  id: string;
  nome: string;
};

export type PendenciaOrdem = {
  id: string;
  titulo: string | null;
  tipo: string | null;
};

export type Pendencias = {
  rotas: PendenciaRota[];
  ordens: PendenciaOrdem[];
};

const PAPEIS_PERMITIDOS = ['administrador', 'zeladoria'] as const;
type PapelPermitido = (typeof PAPEIS_PERMITIDOS)[number];

function ehPapelPermitido(valor: unknown): valor is PapelPermitido {
  return (
    typeof valor === 'string' &&
    (PAPEIS_PERMITIDOS as readonly string[]).includes(valor)
  );
}

type CorpoRequisicao = {
  id?: string;
  ativo?: boolean;
  nome?: string;
  funcao?: string;
  papel?: string;
};

function criarClienteAdmin(): SupabaseClient {
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Rotas e chamados hoje travados nesse funcionário — bloqueia a inativação
// até que a tela decida o que fazer com cada um (transferir ou deixar sem
// responsável). "Chamado em aberto" é status_chamado fora de
// concluido/cancelado; NULL (ordem de rotina/extraordinária sem chamado por
// trás) não conta como pendência.
export async function buscarPendenciasFuncionario(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
): Promise<Pendencias> {
  const { data: rotas, error: erroRotas } = await supabaseAdmin
    .from('rotas')
    .select('id, nome')
    .eq('funcionario_id', funcionarioId);

  if (erroRotas) {
    throw erroRotas;
  }

  const { data: ordens, error: erroOrdens } = await supabaseAdmin
    .from('ordens_servico')
    .select('id, titulo, tipos_atividade(nome)')
    .eq('funcionario_id', funcionarioId)
    .not('status_chamado', 'in', '(concluido,cancelado)');

  if (erroOrdens) {
    throw erroOrdens;
  }

  type OrdemPendenciaRow = {
    id: string;
    titulo: string | null;
    tipos_atividade: { nome: string } | { nome: string }[] | null;
  };

  return {
    rotas: (rotas ?? []).map((rota) => ({ id: rota.id, nome: rota.nome })),
    ordens: ((ordens ?? []) as OrdemPendenciaRow[]).map((ordem) => {
      const tipoAtividade = Array.isArray(ordem.tipos_atividade)
        ? ordem.tipos_atividade[0]
        : ordem.tipos_atividade;
      return {
        id: ordem.id,
        titulo: ordem.titulo,
        tipo: tipoAtividade?.nome ?? null,
      };
    }),
  };
}

// Reaproveitada por api/resolver-pendencias-funcionario.ts depois de
// transferir/desvincular as pendências — não duplica o update de `ativo`.
export async function aplicarAtivoFuncionario(
  supabaseAdmin: SupabaseClient,
  id: string,
  ativo: boolean,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ ativo })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

async function aplicarEdicaoFuncionario(
  supabaseAdmin: SupabaseClient,
  id: string,
  dados: { nome: string; funcao: string | null; papel: PapelPermitido },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update(dados)
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const corpo = (req.body ?? {}) as CorpoRequisicao;
  const { id } = corpo;

  if (!id) {
    res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    return;
  }

  const supabaseAdmin = criarClienteAdmin();

  try {
    // Duas formas de chamar este endpoint: alternar `ativo` (com checagem
    // de pendências) ou editar nome/função/papel — a tela nunca manda os
    // dois de uma vez, então o payload decide qual caminho seguir.
    if (typeof corpo.ativo === 'boolean') {
      if (corpo.ativo === false) {
        const pendencias = await buscarPendenciasFuncionario(supabaseAdmin, id);
        if (pendencias.rotas.length > 0 || pendencias.ordens.length > 0) {
          res.status(409).json({ pendencias });
          return;
        }
      }

      await aplicarAtivoFuncionario(supabaseAdmin, id, corpo.ativo);
      res.status(200).json({ ok: true });
      return;
    }

    if (typeof corpo.nome === 'string') {
      const nome = corpo.nome.trim();
      const funcao = corpo.funcao?.trim();

      if (!nome) {
        res.status(400).json({ erro: 'Informe o nome.' });
        return;
      }
      if (!ehPapelPermitido(corpo.papel)) {
        res.status(400).json({ erro: 'Papel inválido.' });
        return;
      }

      await aplicarEdicaoFuncionario(supabaseAdmin, id, {
        nome,
        funcao: funcao || null,
        papel: corpo.papel,
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  } catch (error) {
    console.error('atualizar-funcionario: erro ao atualizar', error);
    res.status(500).json({ erro: 'Não foi possível atualizar o funcionário.' });
  }
}
