import { supabase } from './supabase';

// Mesmo padrão de dupla resolução usado em api/criar-funcionario.ts e
// api/resolver-condominio.ts: em modo teste (sem sessão real), resolve pelo
// único condomínio existente; com login real, resolve pela sessão
// autenticada. O cliente não consegue ler `usuarios`/`condominios` direto
// (RLS sem política pra esse papel) — por isso passa pelo backend.
//
// Usada por qualquer ponto de insert que precise de `condominio_id` e NÃO
// tenha um `plano_manutencao` já carregado pra herdar o valor dele
// diretamente (rota, plano novo, atividade extraordinária). Quando já existe
// um plano em mãos, prefira `plano.condominio_id` em vez de chamar isto de
// novo — evita uma chamada de rede redundante e garante que a atividade
// nasce no mesmo condomínio do plano que a gerou.
export async function resolverCondominioId(): Promise<string> {
  const { data: sessaoAtual } = await supabase.auth.getSession();
  const tokenSessao = sessaoAtual.session?.access_token;

  const resposta = await fetch('/api/resolver-condominio', {
    headers: tokenSessao ? { Authorization: `Bearer ${tokenSessao}` } : {},
  });
  const dados = (await resposta.json().catch(() => null)) as {
    condominioId?: string;
    erro?: string;
  } | null;

  if (!resposta.ok || !dados?.condominioId) {
    throw new Error(
      dados?.erro ?? 'Não foi possível identificar o condomínio.',
    );
  }

  return dados.condominioId;
}

export default resolverCondominioId;
