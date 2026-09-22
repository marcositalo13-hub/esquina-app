import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { dark, fonts, radius, semantic, spacing } from '../src/theme';

// Máscara de CPF (000.000.000-00) — mesmo padrão de "helper duplicado por
// arquivo" já usado no projeto (normalizarTexto etc.), sem componente
// compartilhado porque só este formulário precisa disso hoje.
function aplicarMascaraCpf(valor: string): string {
  return valor
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

export default function Login() {
  const insets = useSafeAreaInsets();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cpfDigitos = somenteDigitos(cpf);
  const formularioValido = cpfDigitos.length === 11 && senha.length > 0;

  async function handleEntrar() {
    if (!formularioValido || entrando) {
      return;
    }

    setEntrando(true);
    setErro(null);
    try {
      const email = `${cpfDigitos}@login.aegis.app`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        setErro('CPF ou senha inválidos.');
        return;
      }

      // Pra onde ir depois de autenticar (papel do usuário) é decidido em
      // app/_layout.tsx, que reage à sessão mudando — não navega daqui.
    } catch {
      setErro('CPF ou senha inválidos.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.fundoWrapper}>
        <Image
          source={require('../src/assets/login-background.png')}
          resizeMode="cover"
          style={styles.fundo}
        />
      </View>
      <LinearGradient
        colors={[
          'rgba(0, 0, 0, 0.15)',
          'rgba(0, 0, 0, 0.35)',
          'rgba(0, 0, 0, 0.85)',
        ]}
        locations={[0, 0.5, 1]}
        style={styles.veu}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Aegis Condomínios</Text>

          <BlurView intensity={30} tint="dark" style={styles.card}>
            <View style={styles.cardOverlay} pointerEvents="none" />

            <View style={styles.cardContent}>
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>CPF</Text>
                  <TextInput
                    value={cpf}
                    onChangeText={(texto) => setCpf(aplicarMascaraCpf(texto))}
                    placeholder="000.000.000-00"
                    placeholderTextColor={dark.textSecondary}
                    keyboardType="numeric"
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

                {erro ? <Text style={styles.erro}>{erro}</Text> : null}

                <Pressable
                  style={[
                    styles.button,
                    (!formularioValido || entrando) &&
                      styles.buttonDesabilitado,
                  ]}
                  onPress={handleEntrar}
                  disabled={!formularioValido || entrando}
                >
                  <Text style={styles.buttonText}>
                    {entrando ? 'Entrando…' : 'Entrar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>

          <View style={styles.links}>
            <Text style={styles.link}>Esqueci minha senha</Text>
            <Text style={styles.link}>Criar conta</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  fundoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '130%',
  },
  veu: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: dark.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(46, 46, 44, 0.3)',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  cardContent: {
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
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  button: {
    backgroundColor: dark.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDesabilitado: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: dark.bg,
  },
  links: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  link: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: dark.textSecondary,
  },
});
