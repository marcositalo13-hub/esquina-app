import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { dark, fonts, radius, spacing } from '../src/theme';

type Perfil = 'Administrador' | 'Preservação' | 'Morador';

const perfis: Perfil[] = ['Administrador', 'Preservação', 'Morador'];

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Perfil | null>(null);

  function handleEntrar() {
    const perfil = selectedProfile ?? 'Morador';

    if (perfil === 'Administrador') {
      router.replace('/admin');
      return;
    }

    if (perfil === 'Preservação') {
      router.replace('/preservacao');
      return;
    }

    router.replace('/home');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Aegis Condomínios</Text>

        <View style={styles.card}>
          <Text style={styles.testarComo}>Testar como:</Text>
          <View style={styles.chipRow}>
            {perfis.map((perfil) => {
              const selecionado = selectedProfile === perfil;
              return (
                <Pressable
                  key={perfil}
                  style={[styles.chip, selecionado && styles.chipSelecionado]}
                  onPress={() => setSelectedProfile(perfil)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selecionado && styles.chipTextSelecionado,
                    ]}
                  >
                    {perfil}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={dark.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder="••••••••"
                placeholderTextColor={dark.textSecondary}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Pressable style={styles.button} onPress={handleEntrar}>
              <Text style={styles.buttonText}>Entrar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.links}>
          <Text style={styles.link}>Esqueci minha senha</Text>
          <Text style={styles.link}>Criar conta</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: dark.bg,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: dark.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: dark.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.lg,
  },
  testarComo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: dark.textSecondary,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  chipSelecionado: {
    backgroundColor: dark.elevated,
    borderColor: dark.textPrimary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: dark.textSecondary,
    textAlign: 'center',
  },
  chipTextSelecionado: {
    color: dark.textPrimary,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: dark.textSecondary,
  },
  input: {
    backgroundColor: dark.elevated,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: dark.textPrimary,
  },
  button: {
    backgroundColor: dark.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: dark.bg,
  },
  links: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  link: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: dark.textSecondary,
  },
});
