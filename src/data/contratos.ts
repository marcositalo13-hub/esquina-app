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

// Limiares (em dias) do gradiente de cor da barra de vencimento — única
// fonte de verdade, ajustar só aqui muda o comportamento em toda a tela de
// Contratos. Acima de DIAS_LIMIAR_VENCIMENTO a cor é ok fixa; abaixo de 0
// (vencido) é overdue fixa; entre os dois, gradiente contínuo passando por
// pending em DIAS_LIMIAR_CRITICO.
export const DIAS_LIMIAR_VENCIMENTO = 60;
export const DIAS_LIMIAR_CRITICO = 30;

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

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace('#', '');
  return [
    Number.parseInt(limpo.slice(0, 2), 16),
    Number.parseInt(limpo.slice(2, 4), 16),
    Number.parseInt(limpo.slice(4, 6), 16),
  ];
}

function rgbParaHex(r: number, g: number, b: number): string {
  const canal = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

// Interpolação linear RGB entre duas cores hex ('#RRGGBB'): fator 0 devolve
// corA, fator 1 devolve corB, valores entre os dois misturam os canais
// proporcionalmente. Função pura e reutilizável — nenhuma lógica de cor
// deve ficar inline em componentes.
export function interpolarCorHex(
  corA: string,
  corB: string,
  fator: number,
): string {
  const t = Math.min(1, Math.max(0, fator));
  const [rA, gA, bA] = hexParaRgb(corA);
  const [rB, gB, bB] = hexParaRgb(corB);

  return rgbParaHex(
    Math.round(rA + (rB - rA) * t),
    Math.round(gA + (gB - gA) * t),
    Math.round(bA + (bB - bA) * t),
  );
}

// Cor da barra de vencimento, em gradiente contínuo (nunca faixa fixa,
// exceto nos dois extremos):
// - vencido (restantes < 0): overdue fixa.
// - restantes >= DIAS_LIMIAR_VENCIMENTO (60): ok fixa.
// - DIAS_LIMIAR_CRITICO (30) <= restantes < 60: interpola ok -> pending.
// - 0 <= restantes < 30: interpola pending -> overdue.
export function corVencimento(dataFim: string, hoje: string): string {
  const restantes = diasRestantes(dataFim, hoje);

  if (restantes < 0) {
    return semantic.overdue;
  }
  if (restantes >= DIAS_LIMIAR_VENCIMENTO) {
    return semantic.ok;
  }
  if (restantes >= DIAS_LIMIAR_CRITICO) {
    const fator =
      (DIAS_LIMIAR_VENCIMENTO - restantes) /
      (DIAS_LIMIAR_VENCIMENTO - DIAS_LIMIAR_CRITICO);
    return interpolarCorHex(semantic.ok, semantic.pending, fator);
  }

  const fator = (DIAS_LIMIAR_CRITICO - restantes) / DIAS_LIMIAR_CRITICO;
  return interpolarCorHex(semantic.pending, semantic.overdue, fator);
}

// Formata um total de centavos (inteiro, >= 0) como moeda brasileira:
// "R$ 1.250,00". Usada pela máscara do campo "valor" — nunca formatar o
// numeric puro salvo no Supabase, só a exibição.
export function formatarValorBRL(centavos: number): string {
  const inteiros = Math.floor(centavos / 100);
  const partCentavos = String(centavos % 100).padStart(2, '0');
  const inteirosComMilhar = String(inteiros).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.',
  );
  return `R$ ${inteirosComMilhar},${partCentavos}`;
}

// Extrai só os dígitos de um texto digitado no campo mascarado (cada
// dígito entra como centavo, da direita para a esquerda — padrão de
// máscara de moeda).
export function extrairDigitosValor(textoDigitado: string): string {
  return textoDigitado.replace(/\D/g, '');
}

// Converte os dígitos do campo mascarado (centavos) para o numeric puro
// salvo na coluna "valor" do Supabase — sem símbolo, sem separador.
export function digitosParaValorNumerico(digitos: string): number | null {
  if (!digitos) {
    return null;
  }
  return Number(digitos) / 100;
}

// Converte o numeric salvo no Supabase para os dígitos (centavos) que
// alimentam o campo mascarado ao abrir o formulário em modo edição.
export function valorNumericoParaDigitos(valor: number | null): string {
  if (valor == null) {
    return '';
  }
  return String(Math.round(valor * 100));
}
