import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { aplicarAtivoFuncionario } from './atualizar-funcionario';

type Resolucao = {
  tipo?: 'rota' | 'ordem';
  id?: string;
  acao?: 'transferir' | 'standby';
  novo_funcionario_id?: string;
};

type CorpoRequisicao = {
  funcionario_id?: string;
  resolucoes?: Resolucao[];
};

function resolucaoValida(resolucao: Resolucao): boolean {
  if (!resolucao.tipo || !resolucao.id || !resolucao.acao) {
    return false;
  }
  if (resolucao.tipo !== 'rota' && resolucao.tipo !== 'ordem') {
    return false;
  }
  if (resolucao.acao !== 'transferir' && resolucao.acao !== 'standby') {
    return false;
  }
  if (resolucao.acao === 'transferir' && !resolucao.novo_funcionario_id) {
    return false;
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const corpo = (req.body ?? {}) as CorpoRequisicao;
  const funcionarioId = corpo.funcionario_id;
  const resolucoes = Array.isArray(corpo.resolucoes) ? corpo.resolucoes : [];

  if (!funcionarioId || resolucoes.length === 0) {
    res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    return;
  }

  if (!resolucoes.every(resolucaoValida)) {
    res.status(400).json({ erro: 'Resolução inválida.' });
    return;
  }

  const supabaseAdmin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    for (const resolucao of resolucoes) {
      const tabela = resolucao.tipo === 'rota' ? 'rotas' : 'ordens_servico';
      const novoFuncionarioId =
        resolucao.acao === 'transferir' ? resolucao.novo_funcionario_id : null;

      const { error } = await supabaseAdmin
        .from(tabela)
        .update({ funcionario_id: novoFuncionarioId })
        .eq('id', resolucao.id as string);

      if (error) {
        throw error;
      }
    }

    await aplicarAtivoFuncionario(supabaseAdmin, funcionarioId, false);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('resolver-pendencias-funcionario: erro ao resolver', error);
    res.status(500).json({ erro: 'Não foi possível resolver as pendências.' });
  }
}
