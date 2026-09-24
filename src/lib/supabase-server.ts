import { createClient } from '@supabase/supabase-js';

// Client "puro" pra funções serverless (/api) — sem
// @react-native-async-storage/async-storage, sem persistSession, sem
// autoRefreshToken. Nenhum desses faz sentido num ambiente que não mantém
// sessão de usuário entre chamadas, e o adapter web do AsyncStorage toca
// `window` só de ser importado, o que derruba o processo Node (ver
// src/lib/supabase.ts). Mesma estrutura do client já usado em
// api/criar-funcionario.ts. Nunca importar isto em código que roda no app
// cliente (Expo) — lá é sempre src/lib/supabase.ts.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export default supabase;
