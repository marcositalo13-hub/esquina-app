import { semantic } from '../theme';

export type TipoContrato = {
  id: string;
  nome: string;
};

export type PeriodicidadePagamento = 'Mensal' | 'Anual' | 'Único' | 'Outro';

export const PERIODICIDADES_PAGAMENTO: PeriodicidadePagamento[] = [
  'Mensal',
  'Anual',
  'Único',
  'Outro',
];

export type Contrato = {
  id: string;
  titulo: string;
  contraparte_nome: string;
  contraparte_documento: string | null;
  tipo_contrato_id: string | null;
  resumo_objeto: string;
  conteudo_markdown: string;
  valor: number | null;
  periodicidade_pagamento: PeriodicidadePagamento | null;
  indice_reajuste: string | null;
  data_base_reajuste: string | null;
  data_inicio: string;
  data_fim: string;
  renovacao_automatica: boolean;
  prazo_aviso_previo_dias: number | null;
  responsavel_interno: string | null;
  anexo_url: string | null;
  created_at: string;
  updated_at: string;
};

// Limiar (em dias) a partir do qual um contrato é considerado "próximo do
// vencimento" na barra de progresso — única fonte de verdade, ajustar só
// aqui muda o comportamento em toda a tela de Contratos.
export const DIAS_LIMIAR_VENCIMENTO = 60;

function paraData(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Dias restantes até data_fim, a partir de uma referência de "hoje" (sempre
// hojeLocal() do chamador — nunca new Date().toISOString()). Negativo
// quando o contrato já venceu.
export function diasRestantes(dataFim: string, hoje: string): number {
  const MS_POR_DIA = 1000 * 60 * 60 * 24;
  return Math.round(
    (paraData(dataFim).getTime() - paraData(hoje).getTime()) / MS_POR_DIA,
  );
}

// Percentual decorrido (0 a 1) entre data_inicio e data_fim, na referência
// de "hoje" — usado para preencher a barra de progresso de vencimento.
export function percentualDecorrido(
  dataInicio: string,
  dataFim: string,
  hoje: string,
): number {
  const inicio = paraData(dataInicio).getTime();
  const fim = paraData(dataFim).getTime();
  const atual = paraData(hoje).getTime();

  if (fim <= inicio) {
    return 1;
  }

  return Math.min(1, Math.max(0, (atual - inicio) / (fim - inicio)));
}

// Cor semântica da barra de vencimento: overdue (já venceu), pending (a
// DIAS_LIMIAR_VENCIMENTO dias ou menos do vencimento) ou ok (confortável).
export function corVencimento(dataFim: string, hoje: string): string {
  const restantes = diasRestantes(dataFim, hoje);

  if (restantes < 0) {
    return semantic.overdue;
  }
  if (restantes <= DIAS_LIMIAR_VENCIMENTO) {
    return semantic.pending;
  }
  return semantic.ok;
}
