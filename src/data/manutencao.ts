import { resolverCondominioId } from '../lib/resolverCondominioId';
import { supabase } from '../lib/supabase';
import { light, semantic } from '../theme';
import type { Ambiente } from './ambientes';

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

export type Qualidade = 'bom' | 'medio' | 'ruim';

export type QualidadeInfo = {
  label: string;
  color: string;
  descricao: string;
};

// Rótulo, cor e descrição curta de cada nível de qualidade — usado tanto
// no fluxo de validação (ValidacaoGuiada) quanto no indicador exibido nos
// cards de atividade já validada (app/admin/preservacao.tsx).
export function getQualidadeInfo(qualidade: Qualidade): QualidadeInfo {
  switch (qualidade) {
    case 'bom':
      return {
        label: 'Bom',
        color: semantic.ok,
        descricao: 'Dentro do padrão esperado, sem pontos de atenção.',
      };
    case 'medio':
      return {
        label: 'Médio',
        color: semantic.pending,
        descricao: 'Concluída, mas com detalhes que podem melhorar.',
      };
    case 'ruim':
      return {
        label: 'Ruim',
        color: semantic.overdue,
        descricao: 'Abaixo do esperado, requer acompanhamento.',
      };
  }
}

export type TipoAtividade = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

export type Rota = {
  id: string;
  nome: string;
  ativo: boolean;
  funcionario_id: string | null;
};

export type PlanoManutencao = {
  id: string;
  titulo: string;
  tipo_id: string;
  descricao: string | null;
  local: string | null;
  local_id: string | null;
  periodicidade: Periodicidade;
  prioridade: Prioridade;
  data_inicio: string;
  observacoes: string | null;
  rota_id: string | null;
  ordem_na_rota: number | null;
  created_at: string;
  // Sempre presente no banco (not null), mas nem toda consulta a busca
  // explicitamente — nullable aqui só pra não quebrar chamadas antigas que
  // não incluíam a coluna no select.
  condominio_id?: string;
  tipos_atividade?: TipoAtividade | null;
  rotas?: Rota | null;
  locais?: Ambiente | null;
};

export type StatusOrdemServico = 'pendente' | 'em_andamento' | 'concluida';

// 'rotina' = gerada a partir de um plano_manutencao (motor de recorrência).
// 'extraordinaria' = avulsa, criada pelo Administrador, sem plano.
// 'chamado' = reservado para o módulo de chamados (ainda não construído).
export type OrigemOrdemServico = 'rotina' | 'chamado' | 'extraordinaria';

export type OrdemServico = {
  id: string;
  // Nulo quando origem <> 'rotina': uma extraordinária existe por si só,
  // sem plano por trás — título/tipo/local/prioridade ficam na própria
  // ordem, nas colunas abaixo, em vez de virem por join.
  plano_id: string | null;
  origem: OrigemOrdemServico;
  titulo: string | null;
  tipo_id: string | null;
  local_id: string | null;
  prioridade: Prioridade | null;
  // Para rotina é a data da ocorrência; para extraordinária é o prazo
  // definido manualmente pelo Administrador no ato de criar.
  data_prevista: string;
  status: StatusOrdemServico;
  iniciado_em: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
  observacao: string | null;
  motivo_reprovacao: string | null;
  reprovacao_pendente: boolean;
  reprovada_em: string | null;
  pausado_em: string | null;
  tempo_pausado_segundos: number;
  validada: boolean;
  qualidade: Qualidade | null;
  validada_em: string | null;
  validada_por: string | null;
  created_at: string;
  planos_manutencao?: PlanoManutencao | null;
  // Joins diretos da própria ordem — só preenchidos em extraordinárias
  // (em rotina, tipo e local vêm por planos_manutencao).
  tipos_atividade?: TipoAtividade | null;
  locais?: Ambiente | null;
};

export function ehExtraordinaria(ordem: OrdemServico): boolean {
  return ordem.origem === 'extraordinaria';
}

// Título/tipo/local de uma ordem, venha ela de um plano (rotina) ou das
// colunas da própria linha (extraordinária). Única fonte de verdade para
// exibição — evita cada tela decidir de onde ler.
export function tituloOrdem(ordem: OrdemServico): string {
  return ordem.planos_manutencao?.titulo ?? ordem.titulo ?? 'Atividade';
}

export function tipoNomeOrdem(ordem: OrdemServico): string {
  return (
    ordem.planos_manutencao?.tipos_atividade?.nome ??
    ordem.tipos_atividade?.nome ??
    'Sem tipo'
  );
}

export function localNomeOrdem(ordem: OrdemServico): string | null {
  const plano = ordem.planos_manutencao;
  if (plano) {
    return plano.locais?.nome ?? plano.local ?? null;
  }
  return ordem.locais?.nome ?? null;
}

export function prioridadeOrdem(ordem: OrdemServico): Prioridade | null {
  return ordem.planos_manutencao?.prioridade ?? ordem.prioridade ?? null;
}

// Alta primeiro, depois Média, depois Baixa — usado para ordenar a fila de
// extraordinárias na tela da Zeladoria. Prioridade nula vai para o fim.
const PESO_PRIORIDADE: Record<Prioridade, number> = {
  Alta: 0,
  Média: 1,
  Baixa: 2,
};

export function pesoPrioridade(prioridade: Prioridade | null): number {
  return prioridade ? PESO_PRIORIDADE[prioridade] : 3;
}

export type NovaAtividadeExtraordinaria = {
  titulo: string;
  tipo_id: string;
  local_id: string;
  prioridade: Prioridade;
  // Prazo definido manualmente pelo Administrador (não há prazo-padrão por
  // tipo nesta etapa — isso pertence ao módulo de chamados).
  data_prevista: string;
  observacao?: string | null;
};

// Mesmo padrão de verificação de escrita usado em src/data/ambientes.ts: o
// Supabase devolve sucesso com 0 linhas quando falta política de insert na
// RLS, então nunca basta checar só `error`.
function garantirLinhaAfetada<T extends { id: string }[] | null>(
  data: T,
  mensagem: string,
): void {
  if (!data || data.length === 0) {
    throw new Error(mensagem);
  }
}

// Atividade extraordinária: entra direto em ordens_servico, sem plano por
// trás (plano_id null) e sem passar pelo motor de recorrência — é uma
// ocorrência única, criada apenas pelo Administrador.
export async function criarAtividadeExtraordinaria(
  dados: NovaAtividadeExtraordinaria,
): Promise<OrdemServico> {
  // Sem plano por trás pra herdar condominio_id — resolve pelo mesmo padrão
  // de dupla resolução usado em rotas/planos/tipos_atividade.
  const condominioId = await resolverCondominioId();

  const { data, error } = await supabase
    .from('ordens_servico')
    .insert({
      plano_id: null,
      origem: 'extraordinaria',
      status: 'pendente',
      titulo: dados.titulo.trim(),
      tipo_id: dados.tipo_id,
      local_id: dados.local_id,
      prioridade: dados.prioridade,
      data_prevista: dados.data_prevista,
      observacao: dados.observacao?.trim() || null,
      condominio_id: condominioId,
    })
    .select('*, tipos_atividade(*), locais(*)');

  if (error) {
    throw new Error(error.message);
  }

  garantirLinhaAfetada(
    data,
    'Não foi possível criar a atividade extraordinária — nenhuma linha afetada. Verifique as permissões de escrita no Supabase.',
  );

  return (data as OrdemServico[])[0];
}

// Edição de atividade extraordinária: update direto em ordens_servico por
// id — caminho paralelo ao de plano (handleSalvar/editingId), nunca se
// mistura com planos_manutencao. Mesmos 6 campos do cadastro, sem tocar
// status/plano_id/origem.
export async function atualizarAtividadeExtraordinaria(
  id: string,
  dados: NovaAtividadeExtraordinaria,
): Promise<OrdemServico> {
  const { data, error } = await supabase
    .from('ordens_servico')
    .update({
      titulo: dados.titulo.trim(),
      tipo_id: dados.tipo_id,
      local_id: dados.local_id,
      prioridade: dados.prioridade,
      data_prevista: dados.data_prevista,
      observacao: dados.observacao?.trim() || null,
    })
    .eq('id', id)
    .select('*, tipos_atividade(*), locais(*)');

  if (error) {
    throw new Error(error.message);
  }

  garantirLinhaAfetada(
    data,
    'Não foi possível atualizar a atividade extraordinária — nenhuma linha afetada. Verifique as permissões de escrita no Supabase.',
  );

  return (data as OrdemServico[])[0];
}

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

// Formata uma duração em segundos como "12min" (abaixo de 60min) ou
// "1h 20min" (60min ou mais) — usado para exibir o tempo gasto numa
// atividade concluída (concluida_em - iniciado_em).
export function formatarDuracao(segundos: number): string {
  const minutosTotais = Math.max(0, Math.round(segundos / 60));

  if (minutosTotais < 60) {
    return `${minutosTotais}min`;
  }

  const horas = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  return `${horas}h ${minutos}min`;
}

// Cor do indicador de progresso de um grupo (rota): verde se 100%
// concluído, marca se algo já foi iniciado/concluído, neutro se nada
// começou ainda. Usado tanto em "Atividades do dia" (admin) quanto no
// "Resumo do dia" (execução).
export function corIndicadorGrupo(
  total: number,
  concluidas: number,
  iniciadas: number,
): string {
  if (total > 0 && concluidas === total) {
    return semantic.ok;
  }
  if (iniciadas > 0) {
    return light.inkAction;
  }
  return light.textMuted;
}
