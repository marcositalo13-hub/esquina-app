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

export type StatusOrdemServico = 'pendente' | 'concluida';

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
