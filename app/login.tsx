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

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  function handleEntrar() {
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

          <Text style={styles.testarComo}>Testar como:</Text>
          <View style={styles.testarComoRow}>
            <Pressable
              style={styles.testarComoButton}
              onPress={() => router.replace('/admin')}
            >
              <Text style={styles.testarComoButtonText}>Administrador</Text>
            </Pressable>
            <Pressable
              style={styles.testarComoButton}
              onPress={() => router.replace('/preservacao')}
            >
              <Text style={styles.testarComoButtonText}>Preservação</Text>
            </Pressable>
            <Pressable
              style={styles.testarComoButton}
              onPress={() => router.replace('/home')}
            >
              <Text style={styles.testarComoButtonText}>Morador</Text>
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
  testarComo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: dark.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  testarComoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  testarComoButton: {
    flex: 1,
    backgroundColor: dark.elevated,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  testarComoButtonText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: dark.textSecondary,
    textAlign: 'center',
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
