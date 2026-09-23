import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { emailSinteticoDoCpf } from '../src/lib/cpfAuth';
import {
  adicionarPerfilTeste,
  listarPerfisTeste,
  type PerfilTeste,
  removerPerfilTeste,
} from '../src/lib/perfisTeste';
import { supabase } from '../src/lib/supabase';
import { dark, fonts, radius, semantic, spacing } from '../src/theme';

const modoTeste = process.env.EXPO_PUBLIC_MODO_TESTE === 'true';

// Mesmos helpers de app/login.tsx — convenção do projeto é duplicar
// helpers pequenos por arquivo em vez de um componente compartilhado.
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

export default function PerfisTeste() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [perfis, setPerfis] = useState<PerfilTeste[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [entrandoId, setEntrandoId] = useState<string | null>(null);
  const [erroEntrada, setErroEntrada] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<
    string | null
  >(null);

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [apelido, setApelido] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  const cpfDigitos = somenteDigitos(cpf);
  const formularioValido =
    apelido.trim().length > 0 && cpfDigitos.length === 11 && senha.length > 0;

  const carregar = useCallback(async () => {
    setCarregando(true);
    const lista = await listarPerfisTeste();
    setPerfis(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // Guarda redundante: a tela só é linkada a partir do login quando a
    // flag está ativa, mas navegação direta por URL não deve funcionar sem
    // ela — mesmo espírito de "ausente se a variável não for 'true'".
    if (!modoTeste) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [carregar, router]);

  async function handleEntrarComPerfil(perfil: PerfilTeste) {
    if (entrandoId) {
      return;
    }
    setEntrandoId(perfil.id);
    setErroEntrada(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailSinteticoDoCpf(somenteDigitos(perfil.cpf)),
      password: perfil.senha,
    });

    setEntrandoId(null);

    if (error) {
      setErroEntrada(`Falha ao entrar com "${perfil.apelido}".`);
      return;
    }

    // Roteamento pós-login é decidido em app/_layout.tsx reagindo à
    // sessão — mesmíssimo caminho de um login manual.
  }

  async function handleConfirmarRemocao(id: string) {
    setRemovendoId(id);
    await removerPerfilTeste(id);
    setRemovendoId(null);
    setConfirmandoRemocaoId(null);
    await carregar();
  }

  async function handleSalvarPerfil() {
    if (!formularioValido || salvandoPerfil) {
      return;
    }
    setSalvandoPerfil(true);
    await adicionarPerfilTeste({ apelido: apelido.trim(), cpf, senha });
    setSalvandoPerfil(false);
    setApelido('');
    setCpf('');
    setSenha('');
    setFormularioAberto(false);
    await carregar();
  }

  if (!modoTeste) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            style={styles.botaoFechar}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color={dark.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Perfis de Teste</Text>
        </View>

        {erroEntrada ? <Text style={styles.erro}>{erroEntrada}</Text> : null}

        {carregando ? (
          <Text style={styles.vazio}>Carregando…</Text>
        ) : perfis.length === 0 ? (
          <Text style={styles.vazio}>Nenhum perfil salvo ainda.</Text>
        ) : (
          <View style={styles.lista}>
            {perfis.map((perfil) => (
              <View key={perfil.id} style={styles.item}>
                {confirmandoRemocaoId === perfil.id ? (
                  <View style={styles.confirmacao}>
                    <Text style={styles.confirmacaoTexto}>
                      Remover "{perfil.apelido}"?
                    </Text>
                    <View style={styles.confirmacaoBotoes}>
                      <Pressable
                        style={styles.botaoCancelarPequeno}
                        onPress={() => setConfirmandoRemocaoId(null)}
                      >
                        <Text style={styles.botaoCancelarPequenoTexto}>
                          Cancelar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.botaoRemoverPequeno}
                        onPress={() => handleConfirmarRemocao(perfil.id)}
                        disabled={removendoId === perfil.id}
                      >
                        <Text style={styles.botaoRemoverPequenoTexto}>
                          {removendoId === perfil.id ? 'Removendo…' : 'Remover'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={styles.itemConteudo}
                      onPress={() => handleEntrarComPerfil(perfil)}
                      disabled={entrandoId !== null}
                    >
                      <Text style={styles.itemApelido}>{perfil.apelido}</Text>
                      <Text style={styles.itemCpf}>
                        {aplicarMascaraCpf(somenteDigitos(perfil.cpf))}
                      </Text>
                      {entrandoId === perfil.id ? (
                        <Text style={styles.itemStatus}>Entrando…</Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      style={styles.botaoRemover}
                      onPress={() => setConfirmandoRemocaoId(perfil.id)}
                      hitSlop={12}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={dark.textSecondary}
                      />
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {formularioAberto ? (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Apelido</Text>
              <TextInput
                value={apelido}
                onChangeText={setApelido}
                placeholder="Ex.: Zelador João"
                placeholderTextColor={dark.textSecondary}
                style={styles.input}
              />
            </View>

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

            <View style={styles.formBotoes}>
              <Pressable
                style={styles.botaoCancelarPequeno}
                onPress={() => {
                  setFormularioAberto(false);
                  setApelido('');
                  setCpf('');
                  setSenha('');
                }}
              >
                <Text style={styles.botaoCancelarPequenoTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.botaoSalvar,
                  (!formularioValido || salvandoPerfil) &&
                    styles.botaoDesabilitado,
                ]}
                onPress={handleSalvarPerfil}
                disabled={!formularioValido || salvandoPerfil}
              >
                <Text style={styles.botaoSalvarTexto}>
                  {salvandoPerfil ? 'Salvando…' : 'Salvar'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.botaoAdicionar}
            onPress={() => setFormularioAberto(true)}
          >
            <Text style={styles.botaoAdicionarTexto}>+ Adicionar perfil</Text>
          </Pressable>
        )}
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  botaoFechar: {
    padding: spacing.xs,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: dark.textPrimary,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: dark.textSecondary,
    marginBottom: spacing.lg,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
    marginBottom: spacing.md,
  },
  lista: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.elevated,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
  },
  itemConteudo: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.xs / 2,
  },
  itemApelido: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: dark.textPrimary,
  },
  itemCpf: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: dark.textSecondary,
  },
  itemStatus: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: dark.textSecondary,
    marginTop: spacing.xs / 2,
  },
  botaoRemover: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  confirmacao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
  },
  confirmacaoTexto: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: dark.textPrimary,
  },
  confirmacaoBotoes: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  botaoCancelarPequeno: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
  },
  botaoCancelarPequenoTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: dark.textSecondary,
  },
  botaoRemoverPequeno: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: semantic.overdue,
  },
  botaoRemoverPequenoTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  botaoAdicionar: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  botaoAdicionarTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: dark.textPrimary,
  },
  form: {
    backgroundColor: dark.elevated,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    padding: spacing.md,
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
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: dark.textPrimary,
  },
  formBotoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  botaoSalvar: {
    backgroundColor: dark.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  botaoSalvarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: dark.bg,
  },
});
