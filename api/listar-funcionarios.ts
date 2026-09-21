import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  // Service role, nunca a anon key — `usuarios` tem RLS habilitada sem
  // política ainda, a anon key não consegue ler nada lá.
  const supabaseAdmin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, funcao, papel, ativo')
      .order('nome', { ascending: true });

    if (error) {
      throw error;
    }

    res.status(200).json({ funcionarios: data ?? [] });
  } catch (error) {
    console.error('listar-funcionarios: erro ao consultar usuarios', error);
    res.status(500).json({ erro: 'Não foi possível carregar a lista.' });
  }
}
