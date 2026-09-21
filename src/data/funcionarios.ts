// Tipos do Cadastro de Funcionário. A leitura de `usuarios` não passa por
// aqui: RLS habilitada sem política ainda bloqueia a anon key, então a tela
// consulta via api/listar-funcionarios.ts (service role), não um cliente
// Supabase direto. O cadastro em si passa por api/criar-funcionario.ts.

export type PapelFuncionario = 'administrador' | 'zeladoria';

export type Funcionario = {
  id: string;
  nome: string;
  funcao: string | null;
  papel: PapelFuncionario;
  ativo: boolean;
};
