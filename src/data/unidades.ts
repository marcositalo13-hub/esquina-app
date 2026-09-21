import { supabase } from '../lib/supabase';

// Camada de dados do módulo Unidades e Moradores — mesmo padrão de
// src/data/ambientes.ts (cliente Supabase direto, tipos exportados, funções
// async retornando dados tipados). REGRA: nenhuma função aqui retorna cor,
// token de tema ou qualquer valor de apresentação — isso é decidido no
// componente.

export type Unidade = {
  id: string;
  bloco: string | null;
  numero: string;
  observacoes: string | null;
  created_at: string;
};

export type Morador = {
  id: string;
  unidade_id: string;
  nome: string;
  telefone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  ativo: boolean;
  created_at: string;
};

export type Pet = {
  id: string;
  unidade_id: string;
  nome: string;
  especie: string;
  created_at: string;
};

export type Dependente = {
  id: string;
  unidade_id: string;
  nome: string;
  data_nascimento: string | null;
  created_at: string;
};

export type UnidadeComMoradores = Unidade & {
  moradores: Morador[];
  pets: Pet[];
  dependentes: Dependente[];
};

export type NovaUnidade = {
  bloco: string | null;
  numero: string;
};

export type AtualizacaoUnidade = {
  bloco: string | null;
  numero: string;
  observacoes: string | null;
};

// Cadastro rápido ("Adicionar morador") só pede nome+telefone — cpf e
// data de nascimento só entram depois, via "Editar" (atualizarMorador).
export type NovoMorador = {
  unidade_id: string;
  nome: string;
  telefone: string | null;
};

export type AtualizacaoMorador = {
  nome: string;
  telefone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
};

export type NovoPet = {
  unidade_id: string;
  nome: string;
  especie: string;
};

export type NovoDependente = {
  unidade_id: string;
  nome: string;
  data_nascimento: string | null;
};

export type ResultadoGeracaoEmMassa = {
  criadas: number;
  jaExistiam: number;
};

// Erro do Postgres para violação de índice único (bloco + número
// duplicado, constraint unidades_bloco_numero_unico) — tratado
// explicitamente na tela, mensagem legível em vez do erro cru do banco.
export const CODIGO_ERRO_DUPLICADO = '23505';

// Preserva o `code` do erro do Postgres (perdido se só repassássemos
// `error.message` num Error comum) — é o que a tela usa para reconhecer
// violação de índice único e trocar por mensagem legível.
export class ErroUnidade extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ErroUnidade';
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

// Calcula a idade a partir de hoje, sem armazenar — nunca usa
// toISOString() (retorna UTC) nem passa a string direto pro construtor
// Date (também interpreta 'AAAA-MM-DD' como UTC meia-noite, o que pode
// descolar um dia dependendo do fuso); separa os componentes manualmente,
// mesmo padrão de paraData em src/data/manutencao.ts.
export function calcularIdade(dataNascimento: string | null): number | null {
  if (!dataNascimento) {
    return null;
  }

  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const nascimento = new Date(ano, mes - 1, dia);
  const hoje = new Date();

  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() &&
      hoje.getDate() < nascimento.getDate());

  if (aindaNaoFezAniversario) {
    idade -= 1;
  }

  return idade;
}

export async function listarUnidadesComMoradores(): Promise<
  UnidadeComMoradores[]
> {
  const { data, error } = await supabase
    .from('unidades')
    .select('*, moradores(*), pets(*), dependentes(*)')
    .order('bloco', { ascending: true })
    .order('numero', { ascending: true })
    .limit(1000);

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }

  return (data ?? []) as UnidadeComMoradores[];
}

export async function criarUnidade(payload: NovaUnidade): Promise<Unidade> {
  const { data, error } = await supabase
    .from('unidades')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  if (!data) {
    throw new Error(
      'Não foi possível criar a unidade — nenhuma linha retornada.',
    );
  }

  return data as Unidade;
}

export async function atualizarUnidade(
  id: string,
  payload: AtualizacaoUnidade,
): Promise<void> {
  const { data, error } = await supabase
    .from('unidades')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível atualizar a unidade — nenhuma linha afetada.',
  );
}

// Gera o produto cartesiano blocos×números e cria só as combinações que
// ainda não existem. A constraint única do banco (bloco, numero) não é
// suficiente sozinha para detectar duplicata aqui: quando bloco é NULL,
// o Postgres nunca considera NULL igual a NULL, então duas unidades
// "sem bloco, número 101" passariam pela constraint sem erro. Por isso a
// checagem de "já existe" acontece na aplicação, antes do insert, e
// ignora silenciosamente o que já está cadastrado (não é erro).
export async function criarUnidadesEmMassa(
  blocos: string[],
  numeroInicial: number,
  numeroFinal: number,
): Promise<ResultadoGeracaoEmMassa> {
  const blocosEfetivos: (string | null)[] = blocos.length > 0 ? blocos : [null];

  const numeros: string[] = [];
  for (let n = numeroInicial; n <= numeroFinal; n++) {
    numeros.push(String(n));
  }

  const combinacoes: NovaUnidade[] = [];
  for (const bloco of blocosEfetivos) {
    for (const numero of numeros) {
      combinacoes.push({ bloco, numero });
    }
  }

  if (combinacoes.length === 0) {
    return { criadas: 0, jaExistiam: 0 };
  }

  // Busca toda unidade já cadastrada com um dos números pedidos — inclui
  // blocos fora da lista pedida também, mas isso não afeta o resultado:
  // só as chaves (bloco, numero) que baterem exatamente com uma combinação
  // pedida entram no filtro abaixo.
  const { data: existentes, error: erroConsulta } = await supabase
    .from('unidades')
    .select('bloco, numero')
    .in('numero', numeros)
    .limit(5000);

  if (erroConsulta) {
    throw new ErroUnidade(erroConsulta.message, erroConsulta.code);
  }

  const chave = (bloco: string | null, numero: string) =>
    `${bloco ?? ''}::${numero}`;

  const existentesSet = new Set(
    (existentes ?? []).map((u) => chave(u.bloco, u.numero)),
  );

  const faltantes = combinacoes.filter(
    (c) => !existentesSet.has(chave(c.bloco, c.numero)),
  );

  if (faltantes.length === 0) {
    return { criadas: 0, jaExistiam: combinacoes.length };
  }

  const { data, error } = await supabase
    .from('unidades')
    .insert(faltantes)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }

  const criadas = data?.length ?? 0;

  return {
    criadas,
    jaExistiam: combinacoes.length - criadas,
  };
}

// on delete cascade já existe no banco (unidades -> moradores/pets/
// dependentes): excluir a unidade remove tudo vinculado junto, sem
// violação de FK. A tela avisa disso na confirmação inline antes de
// chamar esta função.
export async function excluirUnidade(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('unidades')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível excluir a unidade — nenhuma linha afetada.',
  );
}

// Exclusão em massa (modo de seleção da lista) — mesmo cascade de
// excluirUnidade, só que em lote por ids.
export async function excluirUnidadesEmMassa(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from('unidades')
    .delete()
    .in('id', ids)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível excluir as unidades selecionadas — nenhuma linha afetada.',
  );
}

export async function criarMorador(payload: NovoMorador): Promise<Morador> {
  const { data, error } = await supabase
    .from('moradores')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  if (!data) {
    throw new Error(
      'Não foi possível criar o morador — nenhuma linha retornada.',
    );
  }

  return data as Morador;
}

export async function atualizarMorador(
  id: string,
  payload: AtualizacaoMorador,
): Promise<void> {
  const { data, error } = await supabase
    .from('moradores')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível atualizar o morador — nenhuma linha afetada.',
  );
}

// Alterna ativo/inativo (usada tanto por "Desativar" quanto por
// "Reativar" — o componente decide o valor de `ativo` a enviar).
export async function desativarMorador(
  id: string,
  ativo: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('moradores')
    .update({ ativo })
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível atualizar o status do morador — nenhuma linha afetada.',
  );
}

export async function excluirMorador(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('moradores')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível excluir o morador — nenhuma linha afetada.',
  );
}

export async function criarPet(payload: NovoPet): Promise<Pet> {
  const { data, error } = await supabase
    .from('pets')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  if (!data) {
    throw new Error('Não foi possível criar o pet — nenhuma linha retornada.');
  }

  return data as Pet;
}

export async function excluirPet(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('pets')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível excluir o pet — nenhuma linha afetada.',
  );
}

export async function criarDependente(
  payload: NovoDependente,
): Promise<Dependente> {
  const { data, error } = await supabase
    .from('dependentes')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  if (!data) {
    throw new Error(
      'Não foi possível criar o dependente — nenhuma linha retornada.',
    );
  }

  return data as Dependente;
}

export async function excluirDependente(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('dependentes')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroUnidade(error.message, error.code);
  }
  garantirLinhaAfetada(
    data,
    'Não foi possível excluir o dependente — nenhuma linha afetada.',
  );
}
