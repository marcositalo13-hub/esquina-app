import { semantic } from '../theme';

export type Periodicidade =
  | 'Única'
  | 'Diária'
  | 'Semanal'
  | 'Mensal'
  | 'Trimestral'
  | 'Semestral'
  | 'Anual';

export const PERIODICIDADES: Periodicidade[] = [
  'Única',
  'Diária',
  'Semanal',
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
];

export type Prioridade = 'Baixa' | 'Média' | 'Alta';

export const PRIORIDADES: Prioridade[] = ['Baixa', 'Média', 'Alta'];

// Formata 'AAAA-MM-DD' para 'DD/MM/AAAA'. Apenas para exibição — NÃO usar
// no campo de input de data, que continua aceitando/mostrando AAAA-MM-DD.
export function formatarDataBR(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function getCorPrioridade(prioridade: Prioridade): string {
  switch (prioridade) {
    case 'Baixa':
      return semantic.ok;
    case 'Média':
      return semantic.pending;
    case 'Alta':
      return semantic.overdue;
    default:
      return semantic.info;
  }
}

export type TipoAtividade = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

export type PlanoManutencao = {
  id: string;
  titulo: string;
  tipo_id: string;
  descricao: string | null;
  local: string | null;
  periodicidade: Periodicidade;
  prioridade: Prioridade;
  data_inicio: string;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  tipos_atividade?: TipoAtividade | null;
};

export type StatusOrdemServico = 'pendente' | 'em_andamento' | 'concluida';

export type OrdemServico = {
  id: string;
  plano_id: string;
  data_prevista: string;
  status: StatusOrdemServico;
  concluida_em: string | null;
  concluida_por: string | null;
  observacao: string | null;
  created_at: string;
  planos_manutencao?: PlanoManutencao | null;
};

// Janela padrão (em dias) de geração de ordens_servico futuras a partir de
// hoje ou de data_inicio, o que for maior.
export const JANELA_DIAS = 90;

const LIMITE_OCORRENCIAS = 200;

function paraChave(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function paraData(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Data de hoje em 'AAAA-MM-DD' usando o fuso horário LOCAL do dispositivo
// (getFullYear/getMonth/getDate) — nunca new Date().toISOString(), que é
// UTC e diverge do dia local no Brasil (UTC-3) entre ~21h e meia-noite.
// Única fonte de verdade para "hoje" no app; todo comparativo com
// data_prevista/data_inicio deve chamar esta função.
export function hojeLocal(): string {
  return paraChave(new Date());
}

// Soma dias corridos a uma chave 'AAAA-MM-DD', retornando outra chave.
export function adicionarDiasChave(chave: string, dias: number): string {
  const data = paraData(chave);
  data.setDate(data.getDate() + dias);
  return paraChave(data);
}

// Avança exatamente um período da periodicidade a partir de uma chave —
// usado tanto pelo motor de recorrência quanto pelo top-up incremental,
// para manter a mesma cadência (ex.: sempre nas segundas-feiras).
export function proximaDataPeriodicidade(
  chave: string,
  periodicidade: Periodicidade,
): string {
  const data = paraData(chave);

  switch (periodicidade) {
    case 'Diária':
      data.setDate(data.getDate() + 1);
      break;
    case 'Semanal':
      data.setDate(data.getDate() + 7);
      break;
    case 'Mensal':
      data.setMonth(data.getMonth() + 1);
      break;
    case 'Trimestral':
      data.setMonth(data.getMonth() + 3);
      break;
    case 'Semestral':
      data.setMonth(data.getMonth() + 6);
      break;
    case 'Anual':
      data.setFullYear(data.getFullYear() + 1);
      break;
    case 'Única':
      break;
  }

  return paraChave(data);
}

// Gera as datas de ocorrência de dataInicio até ateData (inclusive),
// incrementando conforme a periodicidade. 'Única' sempre retorna só
// [dataInicio]. Limitado a LIMITE_OCORRENCIAS para evitar loop excessivo.
export function gerarDatasOcorrencia(
  dataInicio: string,
  periodicidade: Periodicidade,
  ateData: string,
): string[] {
  if (periodicidade === 'Única') {
    return [dataInicio];
  }

  const datas: string[] = [];
  let atual = dataInicio;

  while (atual <= ateData && datas.length < LIMITE_OCORRENCIAS) {
    datas.push(atual);
    atual = proximaDataPeriodicidade(atual, periodicidade);
  }

  return datas;
}
