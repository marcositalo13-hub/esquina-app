import { supabase } from '../lib/supabase';

// Camada de dados do módulo Ambientes — mesmo padrão de src/data/manutencao.ts
// (cliente Supabase direto, tipos exportados, funções async retornando dados
// tipados). REGRA: nenhuma função aqui retorna cor, token de tema ou
// qualquer valor de apresentação — isso é decidido no componente.

export type CategoriaAmbiente =
  | 'Área comum'
  | 'Lazer'
  | 'Circulação'
  | 'Técnica'
  | 'Externa'
  | 'Administrativa';

export const CATEGORIAS_AMBIENTE: CategoriaAmbiente[] = [
  'Área comum',
  'Lazer',
  'Circulação',
  'Técnica',
  'Externa',
  'Administrativa',
];

// qr_token existe na tabela mas não é lido/gravado por esta camada ainda —
// QR Code é etapa futura, fora deste escopo.
export type Ambiente = {
  id: string;
  nome: string;
  categoria: CategoriaAmbiente;
  bloco: string | null;
  andar: string | null;
  qr_token: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
};

export type NovoAmbiente = {
  nome: string;
  categoria: CategoriaAmbiente;
  bloco: string | null;
  andar: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export type StatusSugestao =
  | 'pendente'
  | 'aprovado'
  | 'vinculado'
  | 'descartado';

// `origem` e `sugerido_por` vêm de outros módulos (ex.: campo "Local" do
// cadastro de planos) — texto livre, sem catálogo controlado neste lado.
export type SugestaoLocal = {
  id: string;
  texto_digitado: string;
  origem: string;
  sugerido_por: string | null;
  status: StatusSugestao;
  local_id: string | null;
  created_at: string;
  resolvido_em: string | null;
};

// Erro do Postgres para violação de índice único (nome + bloco duplicado) —
// tratado explicitamente na tela, mensagem legível em vez do erro cru do
// banco.
export const CODIGO_ERRO_DUPLICADO = '23505';

// Erro do Postgres para violação de chave estrangeira — ocorre ao tentar
// excluir um ambiente que ainda é referenciado por outro registro (ex.:
// atividade vinculada). Tratado explicitamente em excluirAmbiente.
export const CODIGO_ERRO_VINCULO = '23503';

// Preserva o `code` do erro do Postgres (perdido se só repassássemos
// `error.message` num Error comum) — é o que a tela usa para reconhecer
// violação de índice único e trocar por mensagem legível.
export class ErroAmbiente extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ErroAmbiente';
    this.code = code;
  }
}

// O Supabase retorna sucesso com 0 linhas quando falta política de
// update/delete no Supabase (RLS aberta, mas sem a policy certa) — toda
// função de escrita abaixo verifica linha afetada e lança erro se não houve.
function garantirLinhaAfetada<T extends { id: string }[] | null>(
  data: T,
  mensagem: string,
): void {
  if (!data || data.length === 0) {
    throw new Error(mensagem);
  }
}

export async function listarAmbientes(): Promise<Ambiente[]> {
  const { data, error } = await supabase
    .from('locais')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true })
    .limit(1000);

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }

  return (data ?? []) as Ambiente[];
}

export async function criarAmbiente(payload: NovoAmbiente): Promise<Ambiente> {
  const { data, error } = await supabase
    .from('locais')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }
  if (!data) {
    throw new Error(
      'Não foi possível criar o ambiente — nenhuma linha retornada.',
    );
  }

  return data as Ambiente;
}

export async function atualizarAmbiente(
  id: string,
  payload: NovoAmbiente,
): Promise<void> {
  const { data, error } = await supabase
    .from('locais')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível atualizar o ambiente — nenhuma linha afetada.',
  );
}

// Alterna ativo/inativo (usada tanto por "Desativar" quanto por "Reativar" —
// o componente decide o valor de `ativo` a enviar).
export async function desativarAmbiente(
  id: string,
  ativo: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('locais')
    .update({ ativo })
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível atualizar o status do ambiente — nenhuma linha afetada.',
  );
}

// Relança violação de chave estrangeira (23503 — atividade ainda vinculada
// a este ambiente) com mensagem própria; o `code` original é preservado no
// ErroAmbiente para a tela decidir como reagir a outros erros.
export async function excluirAmbiente(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('locais')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    if (error.code === CODIGO_ERRO_VINCULO) {
      throw new ErroAmbiente(
        'Este ambiente tem atividades vinculadas e não pode ser excluído. Desative-o em vez disso.',
        error.code,
      );
    }
    throw new ErroAmbiente(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível excluir o ambiente — nenhuma linha afetada.',
  );
}

export async function listarSugestoesPendentes(): Promise<SugestaoLocal[]> {
  const { data, error } = await supabase
    .from('locais_sugeridos')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }

  return (data ?? []) as SugestaoLocal[];
}

// Cria o ambiente com os dados definidos pelo Administrador (nome já vem
// pré-preenchido com texto_digitado, mas categoria/bloco/andar são escolhidos
// no formulário) e marca a sugestão como 'aprovado', vinculada ao novo
// registro.
export async function aprovarSugestao(
  sugestaoId: string,
  novoAmbiente: NovoAmbiente,
): Promise<Ambiente> {
  const ambiente = await criarAmbiente(novoAmbiente);

  const { data, error } = await supabase
    .from('locais_sugeridos')
    .update({
      status: 'aprovado',
      local_id: ambiente.id,
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', sugestaoId)
    .select('id');

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Ambiente criado, mas não foi possível atualizar a sugestão — nenhuma linha afetada.',
  );

  return ambiente;
}

// Vincula a sugestão a um ambiente já cadastrado, sem criar registro novo.
export async function vincularSugestao(
  sugestaoId: string,
  localId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('locais_sugeridos')
    .update({
      status: 'vinculado',
      local_id: localId,
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', sugestaoId)
    .select('id');

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível vincular a sugestão — nenhuma linha afetada.',
  );
}

export async function descartarSugestao(sugestaoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('locais_sugeridos')
    .update({
      status: 'descartado',
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', sugestaoId)
    .select('id');

  if (error) {
    throw new ErroAmbiente(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível descartar a sugestão — nenhuma linha afetada.',
  );
}
