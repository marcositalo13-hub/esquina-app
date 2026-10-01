import { supabase } from '../lib/supabase';

// Escopo de "regra viva" da Zeladoria: o que um colaborador específico pode
// ver AGORA, resolvido a partir da atribuição atual (rota → responsável),
// nunca de uma cópia gravada na ordem. Única fonte desta regra — nenhuma
// consulta em app/preservacao.tsx deve reescrevê-la por conta própria.
//
// Rotina: ordens_servico.plano_id → planos_manutencao.rota_id →
// rotas.funcionario_id. Extraordinária: ordens_servico.funcionario_id
// direto (sem rota por trás).
export type EscopoZeladoria = {
  usuarioId: string;
  // Ids dos planos_manutencao cuja rota tem este usuário como responsável
  // atual. Array vazio = nenhum plano sob a responsabilidade dele agora.
  planoIds: string[];
  // Rotas cujo responsável atual é este usuário (inclusive rotas ainda sem
  // planos) — só para dizer se ele é responsável por alguma rota.
  rotaIds: string[];
};

export async function resolverEscopoZeladoria(
  usuarioId: string,
): Promise<EscopoZeladoria> {
  const { data: rotasDoUsuario, error: erroRotas } = await supabase
    .from('rotas')
    .select('id')
    .eq('funcionario_id', usuarioId);

  if (erroRotas) {
    throw new Error(erroRotas.message);
  }

  const rotaIds = (rotasDoUsuario ?? []).map((rota) => rota.id as string);
  if (rotaIds.length === 0) {
    return { usuarioId, planoIds: [], rotaIds: [] };
  }

  const { data: planosDasRotas, error: erroPlanos } = await supabase
    .from('planos_manutencao')
    .select('id')
    .in('rota_id', rotaIds);

  if (erroPlanos) {
    throw new Error(erroPlanos.message);
  }

  return {
    usuarioId,
    planoIds: (planosDasRotas ?? []).map((plano) => plano.id as string),
    rotaIds,
  };
}

type QueryComIn = { in: (coluna: string, valores: string[]) => QueryComIn };
type QueryComEq = { eq: (coluna: string, valor: string) => QueryComEq };

// Aplica o escopo de rotina (via plano) a uma query de ordens_servico já
// montada. `planoIds` vazio → devolve `null` em vez de mandar
// `.in('plano_id', [])` pro PostgREST (lista vazia em `in.()` é inválida) —
// quem chama trata `null` como "sem resultado de rotina", sem consultar o
// banco (ver app/preservacao.tsx).
export function aplicarEscopoRotina<T extends QueryComIn>(
  query: T,
  escopo: EscopoZeladoria,
): T | null {
  if (escopo.planoIds.length === 0) {
    return null;
  }
  // PostgrestFilterBuilder encadeia retornando `this` em tempo de execução
  // (é o mesmo objeto), mas o supabase-js tipa cada `.in()`/`.eq()` com um
  // novo parâmetro de tipo — daqui, sem saber o shape exato da linha, não
  // dá pra provar `T` de volta sem esse cast.
  return query.in('plano_id', escopo.planoIds) as T;
}

// Extraordinária não depende de rota — o filtro é direto pelo responsável
// gravado na própria ordem (ordens_servico.funcionario_id). Nunca vazio:
// sempre seguro de aplicar.
export function aplicarEscopoExtraordinaria<T extends QueryComEq>(
  query: T,
  escopo: EscopoZeladoria,
): T {
  return query.eq('funcionario_id', escopo.usuarioId) as T;
}

export default resolverEscopoZeladoria;
