import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { supabase } from '../src/lib/supabase';
import { fonts, light, radius, spacing } from '../src/theme';

// Destino de qualquer papel de usuarios que ainda não tem área própria no
// app (hoje: qualquer coisa além de 'administrador'/'zeladoria' — ver
// app/_layout.tsx). Não confundir com app/home.tsx, que é o rascunho do
// módulo Morador já em construção.
export default function ModuloIndisponivel() {
  const insets = useSafeAreaInsets();

  async function handleSair() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />

      <View style={[styles.body, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Módulo ainda não disponível</Text>
          <Text style={styles.subtitulo}>
            Seu perfil ainda não tem uma área própria neste aplicativo.
          </Text>

          <Pressable style={styles.botaoSair} onPress={handleSair}>
            <Text style={styles.botaoSairTexto}>Sair</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  titulo: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: light.textPrimary,
    textAlign: 'center',
  },
  subtitulo: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    textAlign: 'center',
  },
  botaoSair: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.inkAction,
  },
  botaoSairTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
