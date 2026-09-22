import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// No web, `web.output: "static"` deste projeto faz SSR em Node — a versão
// web do AsyncStorage toca `window` só de ser importada/usada, e isso
// derruba o processo Node inteiro (ReferenceError: window is not defined)
// antes de qualquer página renderizar. No native, sem AsyncStorage a
// sessão não sobrevive a um restart do app. Passar `undefined` no web deixa
// o supabase-js cair no adapter padrão dele (localStorage, com checagem
// própria de ambiente) em vez do nosso.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
