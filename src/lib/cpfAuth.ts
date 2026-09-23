// Conversão de CPF pra e-mail sintético usada pelo Supabase Auth — extraída
// de app/login.tsx pra ser a mesma fonte usada também pelos Perfis de Teste
// (app/perfis-teste.tsx), evitando duas implementações que podem divergir.
export function emailSinteticoDoCpf(cpfDigitos: string): string {
  return `${cpfDigitos}@login.aegis.app`;
}
