import { supabase } from '../lib/supabase';

// Camada de dados do Cadastro de Funcionário — só leitura de `usuarios`
// aqui (o cadastro em si passa por api/criar-funcionario.ts, que precisa de
// SUPABASE_SERVICE_ROLE_KEY para auth.admin.createUser e para escrever em
// `usuarios`, RLS habilitada sem política ainda — a anon key usada neste
// cliente não teria permissão de insert).

export type PapelFuncionario = 'administrador' | 'zeladoria';

export type Funcionario = {
  id: string;
  nome: string;
  funcao: string | null;
  papel: PapelFuncionario;
};

export class ErroFuncionario extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ErroFuncionario';
    this.code = code;
  }
}

// Só administrador/zeladoria — morador e prestador não são "funcionário"
// (ver CLAUDE.md: Zeladoria != Prestador) e não são criados por este fluxo.
export async function listarFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, funcao, papel')
    .in('papel', ['administrador', 'zeladoria'])
    .order('nome', { ascending: true })
    .limit(1000);

  if (error) {
    throw new ErroFuncionario(error.message, error.code);
  }

  return (data ?? []) as Funcionario[];
}
