import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mesmo padrão de dupla resolução de condominio_id já usado em
// api/criar-funcionario.ts — chamado pelos pontos de insert em
// rotas/planos_manutencao (app/admin/preservacao.tsx), que rodam no
// cliente com a anon key e não conseguem ler `usuarios` nem `condominios`
// direto (RLS sem política pra esse papel).
function extrairTokenSessao(req: VercelRequest): string | null {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) {
    return null;
  }
  return cabecalho.slice('Bearer '.length).trim() || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  // process.env aqui é o ambiente do servidor (Vercel), não o do bundle do
  // cliente. Sem token só é aceito com a flag ligada; nunca o contrário.
  const modoTesteServidor = process.env.EXPO_PUBLIC_MODO_TESTE === 'true';
  const tokenSessao = extrairTokenSessao(req);
  if (!tokenSessao && !modoTesteServidor) {
    res.status(401).json({ erro: 'Sessão ausente ou expirada.' });
    return;
  }

  const supabaseAdmin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    if (tokenSessao) {
      const { data: chamador, error: erroChamador } =
        await supabaseAdmin.auth.getUser(tokenSessao);

      if (erroChamador || !chamador?.user) {
        res.status(401).json({ erro: 'Sessão inválida.' });
        return;
      }

      const { data: usuarioChamador, error: erroUsuarioChamador } =
        await supabaseAdmin
          .from('usuarios')
          .select('condominio_id')
          .eq('id', chamador.user.id)
          .single();

      if (erroUsuarioChamador || !usuarioChamador) {
        res
          .status(403)
          .json({ erro: 'Usuário não vinculado a um condomínio.' });
        return;
      }

      res.status(200).json({ condominioId: usuarioChamador.condominio_id });
      return;
    }

    // Sem token, só chega aqui com modoTesteServidor === true (guarda lá
    // em cima). Sem sessão real pra resolver o chamador, volta ao mesmo
    // fallback de api/criar-funcionario.ts: único condomínio existente.
    const { data: condominio, error: erroCondominio } = await supabaseAdmin
      .from('condominios')
      .select('id')
      .limit(1)
      .single();

    if (erroCondominio || !condominio) {
      throw erroCondominio ?? new Error('Nenhum condomínio cadastrado.');
    }

    res.status(200).json({ condominioId: condominio.id });
  } catch (error) {
    console.error('resolver-condominio: erro ao resolver condomínio', error);
    res.status(500).json({ erro: 'Não foi possível resolver o condomínio.' });
  }
}
