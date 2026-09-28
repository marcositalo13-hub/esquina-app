import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useIdentidade } from '../src/lib/identidade';
import { dark, fonts, radius, spacing } from '../src/theme';

// Seletor manual de perfil restaurado do git (era app/login.tsx antes do
// login real com Supabase Auth — commit fbc0f3a substituiu este conteúdo,
// conteúdo original em fbc0f3a^:app/login.tsx). Só existe em modo teste
// (EXPO_PUBLIC_MODO_TESTE === 'true', ver app/_layout.tsx e app/index.tsx) —
// não passa por nenhuma chamada ao Supabase Auth, é navegação pura.

type Perfil = 'Administrador' | 'Zeladoria' | 'Morador';

const perfis: Perfil[] = ['Administrador', 'Zeladoria', 'Morador'];

type Colaborador = {
  id: string;
  nome: string;
  funcao: string | null;
  papel: string;
  ativo: boolean;
};

export default function SeletorTeste() {
  const insets = useSafeAreaInsets();
  const { usuarioId, carregando, definirIdentidadeTeste } = useIdentidade();
  const params = useLocalSearchParams<{ perfil?: string }>();
  // "Trocar" (app/preservacao.tsx) navega pra cá com ?perfil=zeladoria —
  // abre direto na lista de colaboradores em vez do começo do seletor. Sem
  // o parâmetro, comportamento idêntico a antes (nenhum perfil selecionado).
  const abrirDiretoEmZeladoria = params.perfil?.toLowerCase() === 'zeladoria';
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Perfil | null>(
    abrirDiretoEmZeladoria ? 'Zeladoria' : null,
  );
  const [entrando, setEntrando] = useState(false);

  // Lista de colaboradores da Zeladoria — só buscada quando esse perfil é
  // escolhido (não no mount), e só uma vez (não recarrega ao trocar de
  // perfil e voltar).
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(false);
  const [erroColaboradores, setErroColaboradores] = useState<string | null>(
    null,
  );
  const [colaboradorSelecionadoId, setColaboradorSelecionadoId] = useState<
    string | null
  >(null);
  const [colaboradoresCarregados, setColaboradoresCarregados] = useState(false);

  // Destaca o colaborador atual quando "Trocar" abre o seletor já em
  // Zeladoria — usuarioId só fica disponível depois que a identidade
  // termina de carregar (restaurada do AsyncStorage), daí o efeito em vez
  // de um useState inicial.
  useEffect(() => {
    if (!abrirDiretoEmZeladoria || carregando || !usuarioId) {
      return;
    }
    setColaboradorSelecionadoId((atual) => atual ?? usuarioId);
  }, [abrirDiretoEmZeladoria, carregando, usuarioId]);

  useEffect(() => {
    if (selectedProfile !== 'Zeladoria' || colaboradoresCarregados) {
      return;
    }

    let montado = true;
    setCarregandoColaboradores(true);
    setErroColaboradores(null);

    fetch('/api/listar-funcionarios')
      .then((resposta) => resposta.json())
      .then((dados) => {
        if (!montado) {
          return;
        }
        const lista = ((dados?.funcionarios ?? []) as Colaborador[]).filter(
          (item) => item.papel === 'zeladoria' && item.ativo,
        );
        setColaboradores(lista);
        setColaboradoresCarregados(true);
      })
      .catch(() => {
        if (montado) {
          setErroColaboradores('Não foi possível carregar os colaboradores.');
        }
      })
      .finally(() => {
        if (montado) {
          setCarregandoColaboradores(false);
        }
      });

    return () => {
      montado = false;
    };
  }, [selectedProfile, colaboradoresCarregados]);

  function handleSelecionarPerfil(perfil: Perfil) {
    setSelectedProfile(perfil);
    setColaboradorSelecionadoId(null);
  }

  const entrarHabilitado =
    selectedProfile !== 'Zeladoria' ||
    (colaboradorSelecionadoId !== null && !entrando);

  async function handleEntrar() {
    if (entrando) {
      return;
    }

    const perfil = selectedProfile ?? 'Morador';

    if (perfil === 'Administrador') {
      router.replace('/admin');
      return;
    }

    if (perfil === 'Zeladoria') {
      const colaborador = colaboradores.find(
        (item) => item.id === colaboradorSelecionadoId,
      );
      if (!colaborador) {
        return;
      }

      setEntrando(true);
      await definirIdentidadeTeste({
        id: colaborador.id,
        nome: colaborador.nome,
        papel: colaborador.papel,
      });
      setEntrando(false);
      router.replace('/preservacao');
      return;
    }

    router.replace('/home');
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
              <Text style={styles.testarComo}>Testar como:</Text>
              <View style={styles.chipRow}>
                {perfis.map((perfil) => {
                  const selecionado = selectedProfile === perfil;
                  return (
                    <Pressable
                      key={perfil}
                      style={[
                        styles.chip,
                        selecionado && styles.chipSelecionado,
                      ]}
                      onPress={() => handleSelecionarPerfil(perfil)}
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

              {selectedProfile === 'Zeladoria' ? (
                <View style={styles.colaboradores}>
                  <Text style={styles.label}>Entrar como</Text>
                  {carregandoColaboradores ? (
                    <ActivityIndicator color={dark.textPrimary} />
                  ) : erroColaboradores ? (
                    <Text style={styles.erroColaboradores}>
                      {erroColaboradores}
                    </Text>
                  ) : colaboradores.length === 0 ? (
                    <Text style={styles.erroColaboradores}>
                      Nenhum colaborador de Zeladoria ativo encontrado.
                    </Text>
                  ) : (
                    colaboradores.map((colaborador) => {
                      const selecionado =
                        colaboradorSelecionadoId === colaborador.id;
                      return (
                        <Pressable
                          key={colaborador.id}
                          style={[
                            styles.colaboradorItem,
                            selecionado && styles.colaboradorItemSelecionado,
                          ]}
                          onPress={() =>
                            setColaboradorSelecionadoId(colaborador.id)
                          }
                        >
                          <Text style={styles.colaboradorNome}>
                            {colaborador.nome}
                          </Text>
                          {colaborador.funcao ? (
                            <Text style={styles.colaboradorFuncao}>
                              {colaborador.funcao}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}

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

                <Pressable
                  style={[
                    styles.button,
                    !entrarHabilitado && styles.buttonDesabilitado,
                  ]}
                  onPress={handleEntrar}
                  disabled={!entrarHabilitado}
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
  colaboradores: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  colaboradorItem: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  colaboradorItemSelecionado: {
    backgroundColor: dark.elevated,
    borderColor: dark.textPrimary,
  },
  colaboradorNome: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: dark.textPrimary,
  },
  colaboradorFuncao: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: dark.textSecondary,
    marginTop: 2,
  },
  erroColaboradores: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: dark.textSecondary,
    marginTop: spacing.xs,
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
