import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../../src/components/Chip';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  ErroFuncionario,
  type Funcionario,
  listarFuncionarios,
  type PapelFuncionario,
} from '../../src/data/funcionarios';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

const PAPEIS: { valor: PapelFuncionario; label: string }[] = [
  { valor: 'administrador', label: 'Administrador' },
  { valor: 'zeladoria', label: 'Zeladoria' },
];

const SENHA_MIN_LENGTH = 4;

function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

function papelLabel(papel: PapelFuncionario): string {
  return PAPEIS.find((item) => item.valor === papel)?.label ?? papel;
}

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroFuncionario) {
    return erro.message;
  }
  if (erro instanceof Error) {
    return erro.message;
  }
  return 'Não foi possível concluir a operação.';
}

export default function AdminFuncionarios() {
  const insets = useSafeAreaInsets();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [cpf, setCpf] = useState('');
  const [papel, setPapel] = useState<PapelFuncionario | null>(null);
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const lista = await listarFuncionarios();
      setFuncionarios(lista);
    } catch (erro) {
      setErroLista(mensagemDeErro(erro));
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  function abrirModal() {
    setNome('');
    setFuncao('');
    setCpf('');
    setPapel(null);
    setSenha('');
    setErroModal(null);
    setModalVisivel(true);
  }

  function fecharModal() {
    setModalVisivel(false);
  }

  const cpfDigitos = somenteDigitos(cpf);
  const formularioValido =
    nome.trim().length > 0 &&
    cpfDigitos.length > 0 &&
    papel !== null &&
    senha.length >= SENHA_MIN_LENGTH;

  async function handleSalvar() {
    if (!formularioValido || salvando) {
      return;
    }

    setSalvando(true);
    setErroModal(null);
    try {
      const resposta = await fetch('/api/criar-funcionario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          cpf: cpfDigitos,
          funcao: funcao.trim() || undefined,
          papel,
          senha,
        }),
      });

      const dados = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        erro?: string;
      } | null;

      if (!resposta.ok || !dados?.ok) {
        throw new Error(dados?.erro ?? 'Não foi possível criar o funcionário.');
      }

      setModalVisivel(false);
      await carregar();
    } catch (erro) {
      setErroModal(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => router.push('/admin')}
          style={styles.headerLado}
        >
          <Text style={styles.voltarTexto}>Voltar</Text>
        </Pressable>

        <Text style={styles.title}>Funcionários</Text>

        <Pressable
          onPress={abrirModal}
          style={[styles.headerLado, styles.headerLadoDireita]}
        >
          {({ pressed }) => (
            <View
              style={[styles.addButton, pressed && styles.addButtonPressed]}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}

        {!carregando && funcionarios.length === 0 ? (
          <Text style={styles.vazio}>Nenhum funcionário cadastrado ainda.</Text>
        ) : null}

        {!carregando
          ? funcionarios.map((funcionario) => (
              <View key={funcionario.id} style={styles.funcionarioCard}>
                <View style={styles.funcionarioCardTextos}>
                  <Text style={styles.funcionarioNome}>{funcionario.nome}</Text>
                  <Text style={styles.funcionarioFuncao}>
                    {funcionario.funcao || 'Sem função definida'}
                  </Text>
                </View>
                <Chip label={papelLabel(funcionario.papel)} selected />
              </View>
            ))
          : null}
      </ScrollView>

      <Modal
        visible={modalVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModal}
      >
        <View style={styles.telaModal}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>Novo funcionário</Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharModal}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.corpoModal}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Função/Cargo</Text>
              <TextInput
                value={funcao}
                onChangeText={setFuncao}
                placeholder="Ex: Zelador, Porteiro (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                value={cpf}
                onChangeText={setCpf}
                placeholder="Só números"
                placeholderTextColor={light.textSecondary}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Papel</Text>
              <View style={styles.chipWrap}>
                {PAPEIS.map((item) => (
                  <Chip
                    key={item.valor}
                    label={item.label}
                    selected={papel === item.valor}
                    onPress={() => setPapel(item.valor)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder={`Mínimo ${SENHA_MIN_LENGTH} caracteres`}
                placeholderTextColor={light.textSecondary}
                secureTextEntry
                style={styles.input}
              />
            </View>

            {erroModal ? <Text style={styles.erro}>{erroModal}</Text> : null}
          </ScrollView>

          <View
            style={[
              styles.rodapeModal,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={[
                styles.botaoSalvar,
                (!formularioValido || salvando) &&
                  styles.botaoSalvarDesabilitado,
              ]}
              onPress={handleSalvar}
              disabled={!formularioValido || salvando}
            >
              <Text style={styles.botaoSalvarTexto}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLado: {
    minWidth: 64,
    justifyContent: 'center',
  },
  headerLadoDireita: {
    alignItems: 'flex-end',
  },
  voltarTexto: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textSecondary,
  },
  title: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: light.inkAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    backgroundColor: light.inkActionPressed,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  funcionarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  funcionarioCardTextos: {
    flex: 1,
    gap: 2,
  },
  funcionarioNome: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  funcionarioFuncao: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  telaModal: {
    flex: 1,
    backgroundColor: light.bg,
  },
  cabecalhoModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cabecalhoModalBotao: {
    width: 32,
    alignItems: 'center',
  },
  tituloModal: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  corpoModal: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  input: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rodapeModal: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoSalvar: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.inkAction,
  },
  botaoSalvarDesabilitado: {
    opacity: 0.4,
  },
  botaoSalvarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
