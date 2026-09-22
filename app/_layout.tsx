import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import type { Session } from '@supabase/supabase-js';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../src/lib/supabase';
import { light } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Rotas que exigem sessão ativa — Admin (tudo sob /admin) e a execução da
// Zeladoria (/preservacao, tela raiz). Sem sessão nelas, sempre volta pro
// login (ver o useEffect de proteção abaixo).
function ehRotaProtegida(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname === '/preservacao';
}

// undefined = ainda não checou a sessão inicial; null = checou, não tem.
type SessaoEstado = Session | null | undefined;

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
  });

  const [sessao, setSessao] = useState<SessaoEstado>(undefined);
  const [papel, setPapel] = useState<string | null>(null);
  const [papelChecado, setPapelChecado] = useState(false);

  // Sessão inicial (persistida via AsyncStorage) + qualquer mudança depois
  // (login, logout, refresh de token).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session ?? null);
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        setSessao(novaSessao);
      },
    );

    return () => {
      assinatura.subscription.unsubscribe();
    };
  }, []);

  // Papel do usuário autenticado — decide pra onde a Parte 3 manda depois
  // do login. Sem sessão, não há o que buscar.
  useEffect(() => {
    if (sessao === undefined) {
      return;
    }
    if (!sessao) {
      setPapel(null);
      setPapelChecado(true);
      return;
    }

    setPapelChecado(false);
    supabase
      .from('usuarios')
      .select('papel')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => {
        setPapel(data?.papel ?? null);
        setPapelChecado(true);
      });
  }, [sessao]);

  // Proteção de rota + destino pós-login, reativos a sessão/papel/rota
  // atual — cobre tanto "acabei de logar" quanto "abri o app com sessão já
  // persistida" (Parte 1) parado em /login ou /.
  useEffect(() => {
    if (sessao === undefined || !papelChecado) {
      return;
    }

    if (!sessao && ehRotaProtegida(pathname)) {
      router.replace('/login');
      return;
    }

    if (sessao && pathname === '/login') {
      if (papel === 'administrador') {
        router.replace('/admin');
      } else if (papel === 'zeladoria') {
        router.replace('/preservacao');
      } else {
        router.replace('/modulo-indisponivel');
      }
    }
  }, [sessao, papel, papelChecado, pathname, router]);

  const pronto = fontsLoaded && sessao !== undefined && papelChecado;

  useEffect(() => {
    if (pronto) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [pronto]);

  if (!pronto) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: light.bg },
        }}
      />
    </GestureHandlerRootView>
  );
}
