import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import type { Normativo } from '../../src/data/normativos';
import { supabase } from '../../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

// Formata um timestamp ISO ('atualizado_em') para 'Atualizado em DD/MM/AAAA'.
function formatarAtualizadoEm(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `Atualizado em ${dia}/${mes}/${ano}`;
}

// Busca client-side insensível a caixa e acento.
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export default function AdminNormativosGerenciar() {
  const insets = useSafeAreaInsets();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const [normativos, setNormativos] = useState<Normativo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Busca client-side sobre `normativos` já carregado, sem ida ao banco.
  // `categoria` é texto livre (coluna `text` sem catálogo), então não há
  // chips de filtro nem agrupamento — só a busca.
  const [busca, setBusca] = useState('');

  const carregarNormativos = useCallback(async () => {
    const { data, error } = await supabase
      .from('normativos')
      .select('*')
      .order('titulo', { ascending: true });

    if (error) {
      setErroLista(error.message);
      return;
    }

    setErroLista(null);
    setNormativos((data ?? []) as Normativo[]);
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregarNormativos().finally(() => setCarregando(false));
  }, [carregarNormativos]);

  const normativosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    if (!termo) {
      return normativos;
    }

    return normativos.filter((normativo) =>
      normalizarTexto(
        `${normativo.titulo} ${normativo.categoria ?? ''}`,
      ).includes(termo),
    );
  }, [normativos, busca]);

  // O modal só tem o id; o "Atualizado em" precisa do registro inteiro.
  const normativoEmEdicao = editingId
    ? (normativos.find((n) => n.id === editingId) ?? null)
    : null;

  function limparFormulario() {
    setTitulo('');
    setCategoria('');
    setConteudo('');
  }

  function abrirModalNovo() {
    limparFormulario();
    setEditingId(null);
    setErroModal(null);
    setConfirmandoExclusao(false);
    setModalVisivel(true);
  }

  function abrirModalEditar(normativo: Normativo) {
    setTitulo(normativo.titulo);
    setCategoria(normativo.categoria ?? '');
    setConteudo(normativo.conteudo_markdown);
    setEditingId(normativo.id);
    setErroModal(null);
    setConfirmandoExclusao(false);
    setModalVisivel(true);
  }

  // Aciona a exclusão via swipe: abre o mesmo modal de edição já direto na
  // confirmação inline (sem recriar a UI de confirmação em outro lugar).
  function abrirConfirmacaoExclusaoViaSwipe(normativo: Normativo) {
    swipeableRefs.current.get(normativo.id)?.close();
    abrirModalEditar(normativo);
    setConfirmandoExclusao(true);
  }

  function fecharModal() {
    setModalVisivel(false);
    setEditingId(null);
    setConfirmandoExclusao(false);
  }

  async function handleSalvar() {
    if (isSubmitting) {
      return;
    }

    if (!titulo.trim() || !conteudo.trim()) {
      setErroModal('Preencha título e conteúdo.');
      return;
    }

    setIsSubmitting(true);
    setErroModal(null);

    const payload: {
      id?: string;
      titulo: string;
      categoria: string | null;
      conteudo_markdown: string;
      atualizado_em?: string;
    } = {
      titulo: titulo.trim(),
      categoria: categoria.trim() || null,
      conteudo_markdown: conteudo,
    };

    if (editingId) {
      payload.id = editingId;
      payload.atualizado_em = new Date().toISOString();
    }

    const { error } = await supabase.from('normativos').upsert(payload);

    setIsSubmitting(false);

    if (error) {
      setErroModal(error.message);
      return;
    }

    fecharModal();
    carregarNormativos();
  }

  async function handleExcluir() {
    if (!editingId || excluindo) {
      return;
    }

    setExcluindo(true);
    setErroModal(null);

    const { error } = await supabase
      .from('normativos')
      .delete()
      .eq('id', editingId);

    setExcluindo(false);

    if (error) {
      setErroModal(error.message);
      return;
    }

    fecharModal();
    carregarNormativos();
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => router.push('/admin/normativos')}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </Pressable>

        <Text style={styles.title}>Normativos</Text>

        <Pressable
          onPress={abrirModalNovo}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.buscaWrap}>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por título ou categoria"
            placeholderTextColor={light.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {erroLista ? (
          <Text style={[styles.erro, styles.mensagemListagem]}>
            {erroLista}
          </Text>
        ) : null}

        {!carregando && normativos.length === 0 ? (
          <Text style={[styles.vazio, styles.mensagemListagem]}>
            Nenhum normativo cadastrado.
          </Text>
        ) : normativosFiltrados.length === 0 ? (
          <Text style={[styles.vazio, styles.mensagemListagem]}>
            Nenhum normativo encontrado para essa busca.
          </Text>
        ) : (
          <View>
            {normativosFiltrados.map((normativo, indice) => (
              <Swipeable
                key={normativo.id}
                ref={(ref) => {
                  if (ref) {
                    swipeableRefs.current.set(normativo.id, ref);
                  } else {
                    swipeableRefs.current.delete(normativo.id);
                  }
                }}
                overshootRight={false}
                renderRightActions={() => (
                  <Pressable
                    style={styles.acaoExcluirSwipe}
                    onPress={() => abrirConfirmacaoExclusaoViaSwipe(normativo)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                  </Pressable>
                )}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.linha,
                    indice === 0 && styles.linhaPrimeira,
                    pressed && styles.linhaPressionada,
                  ]}
                  onPress={() => abrirModalEditar(normativo)}
                >
                  <Text style={styles.linhaTitulo}>{normativo.titulo}</Text>
                  {normativo.categoria ? (
                    <Text style={styles.linhaCategoria}>
                      {normativo.categoria}
                    </Text>
                  ) : null}
                </Pressable>
              </Swipeable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModal}
      >
        <View style={styles.tela}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>
              {editingId ? 'Editar normativo' : 'Novo normativo'}
            </Text>
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
            contentContainerStyle={styles.corpo}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.label}>Título</Text>
              <TextInput
                value={titulo}
                onChangeText={setTitulo}
                placeholder="Título"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Categoria</Text>
              <TextInput
                value={categoria}
                onChangeText={setCategoria}
                placeholder="Categoria (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Conteúdo (markdown)</Text>
              <TextInput
                value={conteudo}
                onChangeText={setConteudo}
                placeholder="Conteúdo em markdown"
                placeholderTextColor={light.textSecondary}
                multiline
                numberOfLines={16}
                style={[styles.input, styles.inputConteudo]}
              />
            </View>

            {normativoEmEdicao ? (
              <Text style={styles.cardAtualizado}>
                {formatarAtualizadoEm(normativoEmEdicao.atualizado_em)}
              </Text>
            ) : null}

            {erroModal ? <Text style={styles.erro}>{erroModal}</Text> : null}

            {editingId && !confirmandoExclusao ? (
              <Pressable
                style={styles.botaoExcluir}
                onPress={() => setConfirmandoExclusao(true)}
              >
                <Text style={styles.botaoExcluirTexto}>Excluir</Text>
              </Pressable>
            ) : null}

            {confirmandoExclusao ? (
              <View style={styles.confirmacaoExclusao}>
                <Text style={styles.confirmacaoExclusaoTexto}>
                  Confirmar exclusão? Essa ação não pode ser desfeita.
                </Text>
                <View style={styles.confirmacaoExclusaoBotoes}>
                  <Pressable
                    style={styles.botaoCancelarPequeno}
                    onPress={() => setConfirmandoExclusao(false)}
                  >
                    <Text style={styles.botaoCancelarPequenoTexto}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.botaoExcluirConfirmar,
                      excluindo && styles.botaoDesabilitado,
                    ]}
                    onPress={handleExcluir}
                    disabled={excluindo}
                  >
                    <Text style={styles.botaoExcluirConfirmarTexto}>
                      {excluindo ? 'Excluindo…' : 'Excluir'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.rodape,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={[
                styles.botaoSalvar,
                isSubmitting && styles.botaoDesabilitado,
              ]}
              onPress={handleSalvar}
              disabled={isSubmitting}
            >
              <Text style={styles.botaoSalvarTexto}>
                {isSubmitting ? 'Salvando…' : 'Salvar'}
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
  headerButton: {
    width: 32,
    alignItems: 'center',
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
  title: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  // Sem padding horizontal: o recuo vive dentro de cada linha, para o
  // estado de toque e a ação de swipe sangrarem até a borda da tela.
  body: {
    paddingBottom: spacing.xl,
  },
  buscaWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  mensagemListagem: {
    paddingHorizontal: spacing.lg,
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
  linha: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
    backgroundColor: light.bg,
  },
  // `categoria` é texto livre, então não há agrupamento: a lista é um
  // grupo só e apenas o primeiro registro leva a régua de cabeça.
  linhaPrimeira: {
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  linhaPressionada: {
    backgroundColor: light.sunken,
  },
  linhaTitulo: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 17,
    color: light.textPrimary,
  },
  linhaCategoria: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  cardAtualizado: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  // Ação de swipe rente à linha: sem raio e sem margem, ocupando toda a
  // altura do registro, já que a linha não tem card próprio.
  acaoExcluirSwipe: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantic.overdue,
  },
  tela: {
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
  corpo: {
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
  inputConteudo: {
    minHeight: 280,
    textAlignVertical: 'top',
  },
  botaoExcluir: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.overdue,
  },
  botaoExcluirTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: semantic.overdue,
  },
  confirmacaoExclusao: {
    backgroundColor: `${semantic.overdue}0D`,
    borderWidth: 1,
    borderColor: semantic.overdue,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirmacaoExclusaoTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  confirmacaoExclusaoBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botaoCancelarPequeno: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoCancelarPequenoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  botaoExcluirConfirmar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: semantic.overdue,
  },
  botaoExcluirConfirmarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  rodape: {
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
  botaoDesabilitado: {
    opacity: 0.4,
  },
  botaoSalvarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
