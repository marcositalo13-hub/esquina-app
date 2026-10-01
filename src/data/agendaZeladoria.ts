import { supabase } from '../lib/supabase';
import { hojeLocal } from './manutencao';
import {
  aplicarEscopoExtraordinaria,
  aplicarEscopoRotina,
  resolverEscopoZeladoria,
} from './visibilidadeZeladoria';

// Única fonte de "hoje" e "próxima atividade" para o zelador (estado vazio
// da tela de execução) e para o Administrador (card de rota e confirmação de
// troca de responsável). Nenhuma tela calcula isso por conta própria.

const FUSO_BRASIL = 'America/Sao_Paulo';
const formatadorDiaBrasil = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO_BRASIL,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
})();

// Data de hoje em 'AAAA-MM-DD' no fuso de Brasília, independente do fuso
// do aparelho. Nunca toISOString() (UTC: já é "amanhã" a partir das 21h).
// Sem suporte a fuso no Intl do motor JS, cai no dia local do aparelho.
export function hojeBrasil(): string {
  if (formatadorDiaBrasil) {
    try {
      // en-CA formata como AAAA-MM-DD.
      return formatadorDiaBrasil.format(new Date());
    } catch {
      // segue para o fallback
    }
  }
  return hojeLocal();
}

const formatadorHoraBrasil = (() => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO_BRASIL,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
})();

// Timestamp (ISO, UTC) → 'hh:mm' no horário de Brasília.
export function formatarHoraBrasil(instante: string): string {
  const data = new Date(instante);
  if (formatadorHoraBrasil) {
    try {
      return formatadorHoraBrasil.format(data);
    } catch {
      // segue para o fallback
    }
  }
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// 'AAAA-MM-DD' → 'qui, 03/10'. A chave já é uma data de calendário, então o
// dia da semana sai dela mesma (sem conversão de fuso).
export function formatarDiaCurto(chave: string): string {
  const [ano, mes, dia] = chave.split('-').map(Number);
  const semana = DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
  return `${semana}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export type ProximaAtividade = {
  id: string;
  titulo: string;
  rotaNome: string | null;
  localNome: string | null;
  dataPrevista: string;
};

type LinhaProxima = {
  id: string;
  data_prevista: string;
  titulo: string | null;
  locais: { nome: string } | null;
  planos_manutencao: {
    titulo: string;
    local: string | null;
    locais: { nome: string } | null;
    rotas: { nome: string } | null;
  } | null;
};

function paraProxima(linha: LinhaProxima): ProximaAtividade {
  const plano = linha.planos_manutencao;
  return {
    id: linha.id,
    titulo: plano?.titulo ?? linha.titulo ?? 'Atividade',
    rotaNome: plano?.rotas?.nome ?? null,
    localNome: plano
      ? (plano.locais?.nome ?? plano.local ?? null)
      : (linha.locais?.nome ?? null),
    dataPrevista: linha.data_prevista,
  };
}

// Próximas ordens pendentes do usuário DEPOIS de hoje, dentro do escopo
// visível dele (mesma regra de src/data/visibilidadeZeladoria.ts), em ordem
// crescente de data. `responsavelPorRota` distingue "não tenho rota" de
// "tenho rota, mas nada programado".
export async function proximasAtividadesDoUsuario(
  usuarioId: string,
  limite = 3,
): Promise<{ responsavelPorRota: boolean; itens: ProximaAtividade[] }> {
  const escopo = await resolverEscopoZeladoria(usuarioId);
  const hoje = hojeBrasil();
  // Tipada como string (não literal): o parser de tipos do supabase-js
  // estoura a profundidade (TS2589) com este select aninhado.
  const colunas: string =
    'id, data_prevista, titulo, locais(nome), planos_manutencao(titulo, local, locais(nome), rotas(nome))';

  const queryRotina = aplicarEscopoRotina(
    supabase
      .from('ordens_servico')
      .select(colunas)
      .eq('status', 'pendente')
      .gt('data_prevista', hoje)
      .order('data_prevista', { ascending: true })
      .limit(limite),
    escopo,
  );
  const queryExtra = aplicarEscopoExtraordinaria(
    supabase
      .from('ordens_servico')
      .select(colunas)
      .eq('origem', 'extraordinaria')
      .eq('status', 'pendente')
      .gt('data_prevista', hoje)
      .order('data_prevista', { ascending: true })
      .limit(limite),
    escopo,
  );

  const [rotina, extra] = await Promise.all([
    queryRotina ?? Promise.resolve({ data: [], error: null }),
    queryExtra,
  ]);
  if (rotina.error) {
    throw new Error(rotina.error.message);
  }
  if (extra.error) {
    throw new Error(extra.error.message);
  }

  const itens = [
    ...((rotina.data ?? []) as unknown as LinhaProxima[]),
    ...((extra.data ?? []) as unknown as LinhaProxima[]),
  ]
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
    .slice(0, limite)
    .map(paraProxima);

  return { responsavelPorRota: escopo.rotaIds.length > 0, itens };
}

export type ResumoRota = {
  // Ordens da rota com data_prevista = hoje (qualquer status).
  hoje: number;
  // Data ('AAAA-MM-DD') da próxima ordem pendente depois de hoje, ou null.
  proxima: string | null;
  // Mesmo cálculo, por plano da rota (tela da rota): planoId → próxima.
  proximaPorPlano: Map<string, string | null>;
};

type LinhaResumo = {
  id: string;
  planos_manutencao: {
    id: string;
    hoje: { id: string }[];
    proxima: { data_prevista: string }[];
  }[];
};

// Hoje e próxima de TODAS as rotas pedidas (e de cada plano delas) em UMA
// consulta: parte de
// `rotas` e embute os planos e, de cada plano, as ordens de hoje e só a
// primeira ordem pendente futura (limit 1 por plano). Assim o volume
// devolvido não depende da janela de 90 dias de ordens — não esbarra no
// corte de 1000 linhas.
export async function resumoDasRotas(
  rotaIds: string[],
): Promise<Map<string, ResumoRota>> {
  const resumo = new Map<string, ResumoRota>();
  if (rotaIds.length === 0) {
    return resumo;
  }
  const hoje = hojeBrasil();

  const { data, error } = await supabase
    .from('rotas')
    .select(
      'id, planos_manutencao(id, hoje:ordens_servico(id), proxima:ordens_servico(data_prevista))',
    )
    .in('id', rotaIds)
    .eq('planos_manutencao.hoje.data_prevista', hoje)
    .gt('planos_manutencao.proxima.data_prevista', hoje)
    .eq('planos_manutencao.proxima.status', 'pendente')
    .order('data_prevista', {
      referencedTable: 'planos_manutencao.proxima',
      ascending: true,
    })
    .limit(1, { referencedTable: 'planos_manutencao.proxima' });

  if (error) {
    throw new Error(error.message);
  }

  for (const rota of (data ?? []) as unknown as LinhaResumo[]) {
    let totalHoje = 0;
    let proxima: string | null = null;
    const proximaPorPlano = new Map<string, string | null>();
    for (const plano of rota.planos_manutencao ?? []) {
      totalHoje += plano.hoje?.length ?? 0;
      const data = plano.proxima?.[0]?.data_prevista ?? null;
      proximaPorPlano.set(plano.id, data);
      if (data && (proxima === null || data < proxima)) {
        proxima = data;
      }
    }
    resumo.set(rota.id, { hoje: totalHoje, proxima, proximaPorPlano });
  }
  return resumo;
}
