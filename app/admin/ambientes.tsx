import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type AnchorPosition, CardMenu } from '../../src/components/CardMenu';
import { Chip } from '../../src/components/Chip';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  type Ambiente,
  aprovarSugestao,
  atualizarAmbiente,
  CATEGORIAS_AMBIENTE,
  type CategoriaAmbiente,
  CODIGO_ERRO_DUPLICADO,
  criarAmbiente,
  desativarAmbiente,
  descartarSugestao,
  ErroAmbiente,
  excluirAmbiente,
  listarAmbientes,
  listarSugestoesPendentes,
  type NovoAmbiente,
  type SugestaoLocal,
  vincularSugestao,
} from '../../src/data/ambientes';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

type Secao = 'cadastrados' | 'sugestoes';

// Busca client-side insensível a caixa e acento — mesmo helper duplicado em
// app/admin/contratos.tsx e app/admin/normativos-gerenciar.tsx.
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function formatarDataCurta(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroAmbiente && erro.code === CODIGO_ERRO_DUPLICADO) {
    return 'Já existe um ambiente com esse nome neste bloco.';
  }
  if (erro instanceof Error) {
    return erro.message;
  }
  return 'Não foi possível concluir a operação.';
}

const AMBIENTE_VAZIO: NovoAmbiente = {
  nome: '',
  categoria: CATEGORIAS_AMBIENTE[0],
  bloco: null,
  andar: null,
  observacoes: null,
  ativo: true,
};

export default function AdminAmbientes() {
  const insets = useSafeAreaInsets();

  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestaoLocal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('cadastrados');
  const [busca, setBusca] = useState('');
  // Filtros da seção "Cadastrados" — só estado local, não persiste.
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] =
    useState<CategoriaAmbiente | null>(null);

  // Modal de cadastro/edição — também usado para "Criar ambiente" a partir
  // de uma sugestão (sugestaoOrigemId preenchido nesse caso).
  const [modalVisivel, setModalVisivel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sugestaoOrigemId, setSugestaoOrigemId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaAmbiente>(
    AMBIENTE_VAZIO.categoria,
  );
  const [bloco, setBloco] = useState('');
  const [andar, setAndar] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Menu de 3 pontos por ambiente — Modal próprio (CardMenu), nunca View
  // posicionada: fica obscurecida por cards vizinhos neste projeto.
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [menuEtapa, setMenuEtapa] = useState<'opcoes' | 'confirmarExclusao'>(
    'opcoes',
  );
  const [menuAncora, setMenuAncora] = useState<AnchorPosition>({ x: 0, y: 0 });
  const menuIconRefs = useRef<Map<string, View>>(new Map());
  const [alterandoStatusId, setAlterandoStatusId] = useState<string | null>(
    null,
  );
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Seletor buscável "Vincular a existente".
  const [modalVincularVisivel, setModalVincularVisivel] = useState(false);
  const [sugestaoParaVincular, setSugestaoParaVincular] =
    useState<SugestaoLocal | null>(null);
  const [buscaVincular, setBuscaVincular] = useState('');
  const [vinculando, setVinculando] = useState(false);

  // Descarte pede confirmação inline (ação de exceção, não é reversível) —
  // nunca Alert.alert, nunca modal empilhado.
  const [confirmandoDescarteId, setConfirmandoDescarteId] = useState<
    string | null
  >(null);
  const [descartando, setDescartando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const [listaAmbientes, listaSugestoes] = await Promise.all([
        listarAmbientes(),
        listarSugestoesPendentes(),
      ]);
      setAmbientes(listaAmbientes);
      setSugestoes(listaSugestoes);
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

  // Busca por nome E filtro de categoria E "mostrar inativos" combinam com
  // AND — cada filtro vazio/desligado simplesmente não restringe nada.
  const gruposCadastrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    const filtrados = ambientes.filter((item) => {
      if (!mostrarInativos && !item.ativo) {
        return false;
      }
      if (categoriaFiltro && item.categoria !== categoriaFiltro) {
        return false;
      }
      if (termo && !normalizarTexto(item.nome).includes(termo)) {
        return false;
      }
      return true;
    });

    return CATEGORIAS_AMBIENTE.map((cat) => ({
      categoria: cat,
      itens: filtrados.filter((item) => item.categoria === cat),
    })).filter((grupo) => grupo.itens.length > 0);
  }, [ambientes, busca, mostrarInativos, categoriaFiltro]);

  const sugestoesFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    if (!termo) {
      return sugestoes;
    }
    return sugestoes.filter((item) =>
      normalizarTexto(item.texto_digitado).includes(termo),
    );
  }, [sugestoes, busca]);

  const ambientesParaVincular = useMemo(() => {
    const termo = normalizarTexto(buscaVincular.trim());
    return ambientes.filter((item) =>
      termo ? normalizarTexto(item.nome).includes(termo) : true,
    );
  }, [ambientes, buscaVincular]);

  function abrirModalNovo() {
    setEditingId(null);
    setSugestaoOrigemId(null);
    setNome('');
    setCategoria(AMBIENTE_VAZIO.categoria);
    setBloco('');
    setAndar('');
    setObservacoes('');
    setAtivo(true);
    setErroModal(null);
    setModalVisivel(true);
  }

  function abrirModalEditar(item: Ambiente) {
    setEditingId(item.id);
    setSugestaoOrigemId(null);
    setNome(item.nome);
    setCategoria(item.categoria);
    setBloco(item.bloco ?? '');
    setAndar(item.andar ?? '');
    setObservacoes(item.observacoes ?? '');
    setAtivo(item.ativo);
    setErroModal(null);
    setModalVisivel(true);
    fecharMenu();
  }

  // "Criar ambiente" a partir de uma sugestão: abre o mesmo modal de
  // cadastro pré-preenchido com o texto digitado, deixando categoria/bloco/
  // andar para o Administrador escolher antes de salvar.
  function abrirModalNovoDeSugestao(sugestao: SugestaoLocal) {
    setEditingId(null);
    setSugestaoOrigemId(sugestao.id);
    setNome(sugestao.texto_digitado);
    setCategoria(AMBIENTE_VAZIO.categoria);
    setBloco('');
    setAndar('');
    setObservacoes('');
    setAtivo(true);
    setErroModal(null);
    setModalVisivel(true);
  }

  function fecharModal() {
    setModalVisivel(false);
    setErroModal(null);
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErroModal(null);

    const payload: NovoAmbiente = {
      nome: nome.trim(),
      categoria,
      bloco: bloco.trim() || null,
      andar: andar.trim() || null,
      observacoes: observacoes.trim() || null,
      ativo,
    };

    try {
      if (sugestaoOrigemId) {
        await aprovarSugestao(sugestaoOrigemId, payload);
      } else if (editingId) {
        await atualizarAmbiente(editingId, payload);
      } else {
        await criarAmbiente(payload);
      }
      setModalVisivel(false);
      await carregar();
    } catch (erro) {
      setErroModal(mensagemDeErro(erro));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAbrirMenu(id: string) {
    if (menuAbertoId === id) {
      fecharMenu();
      return;
    }

    const ref = menuIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _width, height) => {
      setMenuAncora({ x, y: y + height });
      setMenuAbertoId(id);
      setMenuEtapa('opcoes');
      setErroAcao(null);
    });
  }

  function fecharMenu() {
    setMenuAbertoId(null);
    setMenuEtapa('opcoes');
  }

  async function handleAlternarStatus(item: Ambiente) {
    fecharMenu();
    setAlterandoStatusId(item.id);
    setErroAcao(null);
    try {
      await desativarAmbiente(item.id, !item.ativo);
      await carregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setAlterandoStatusId(null);
    }
  }

  function handlePedirConfirmacaoExclusao() {
    setMenuEtapa('confirmarExclusao');
  }

  // Se excluirAmbiente lançar ErroAmbiente de vínculo (23503), a mensagem
  // aparece no topo da lista (erroAcao) — o menu só fecha, nunca trava a
  // tela.
  async function handleExcluirConfirmar(item: Ambiente) {
    setExcluindoId(item.id);
    setErroAcao(null);
    try {
      await excluirAmbiente(item.id);
      fecharMenu();
      await carregar();
    } catch (erro) {
      fecharMenu();
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setExcluindoId(null);
    }
  }

  function abrirModalVincular(sugestao: SugestaoLocal) {
    setSugestaoParaVincular(sugestao);
    setBuscaVincular('');
    setModalVincularVisivel(true);
  }

  function fecharModalVincular() {
    setModalVincularVisivel(false);
    setSugestaoParaVincular(null);
  }

  async function handleVincular(item: Ambiente) {
    if (!sugestaoParaVincular) {
      return;
    }
    setVinculando(true);
    setErroAcao(null);
    try {
      await vincularSugestao(sugestaoParaVincular.id, item.id);
      fecharModalVincular();
      await carregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setVinculando(false);
    }
  }

  async function handleDescartar(sugestaoId: string) {
    setDescartando(true);
    setErroAcao(null);
    try {
      await descartarSugestao(sugestaoId);
      setConfirmandoDescarteId(null);
      await carregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setDescartando(false);
    }
  }

  const temSugestaoPendente = sugestoes.length > 0;

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

        <Text style={styles.title}>Ambientes</Text>

        <Pressable
          onPress={abrirModalNovo}
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

      <View style={styles.buscaWrap}>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome"
          placeholderTextColor={light.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {secaoAtiva === 'cadastrados' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsCategoriaRow}
        >
          <Chip
            label="Todas"
            selected={categoriaFiltro === null}
            onPress={() => setCategoriaFiltro(null)}
          />
          {CATEGORIAS_AMBIENTE.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={categoriaFiltro === item}
              onPress={() => setCategoriaFiltro(item)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.chipsSecaoRow}>
        <Chip
          label="Cadastrados"
          selected={secaoAtiva === 'cadastrados'}
          onPress={() => setSecaoAtiva('cadastrados')}
        />
        <View style={styles.chipComPonto}>
          <Chip
            label="Sugestões"
            selected={secaoAtiva === 'sugestoes'}
            onPress={() => setSecaoAtiva('sugestoes')}
          />
          {temSugestaoPendente ? <View style={styles.pontoChip} /> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}
        {erroAcao ? <Text style={styles.erro}>{erroAcao}</Text> : null}

        {!carregando && secaoAtiva === 'cadastrados' ? (
          <View style={styles.linhaMostrarInativos}>
            <Text style={styles.label}>Mostrar inativos</Text>
            <Switch
              value={mostrarInativos}
              onValueChange={setMostrarInativos}
              trackColor={{
                false: light.border,
                true: `${light.inkAction}1A`,
              }}
              thumbColor={mostrarInativos ? light.inkAction : '#FFFFFF'}
            />
          </View>
        ) : null}

        {!carregando && secaoAtiva === 'cadastrados' ? (
          gruposCadastrados.length === 0 ? (
            <Text style={styles.vazio}>
              {busca.trim()
                ? 'Nenhum ambiente encontrado.'
                : 'Nenhum ambiente cadastrado ainda.'}
            </Text>
          ) : (
            gruposCadastrados.map((grupo) => (
              <View key={grupo.categoria} style={styles.grupo}>
                <Text style={styles.grupoTitulo}>{grupo.categoria}</Text>
                <View style={styles.lista}>
                  {grupo.itens.map((item) => (
                    <View key={item.id} style={styles.linha}>
                      <View
                        style={[
                          styles.linhaConteudo,
                          !item.ativo && styles.linhaConteudoInativa,
                        ]}
                      >
                        <View style={styles.linhaTextos}>
                          <View style={styles.linhaNomeRow}>
                            <Text style={styles.linhaNome}>{item.nome}</Text>
                            {!item.ativo ? (
                              <View style={styles.seloInativo}>
                                <Text style={styles.seloInativoTexto}>
                                  Inativo
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {item.bloco || item.andar ? (
                            <Text style={styles.linhaDetalhe}>
                              {[item.bloco, item.andar]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          ) : null}
                        </View>

                        <Pressable
                          ref={(el) => {
                            if (el) {
                              menuIconRefs.current.set(item.id, el);
                            }
                          }}
                          onPress={() => handleAbrirMenu(item.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={({ pressed }) => [
                            styles.menuButton,
                            pressed && styles.menuButtonPressionado,
                          ]}
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={18}
                            color={light.textSecondary}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )
        ) : null}

        {!carregando && secaoAtiva === 'sugestoes' ? (
          sugestoesFiltradas.length === 0 ? (
            <Text style={styles.vazio}>
              {busca.trim()
                ? 'Nenhuma sugestão encontrada.'
                : 'Nenhuma sugestão pendente.'}
            </Text>
          ) : (
            <View style={styles.listaSugestoes}>
              {sugestoesFiltradas.map((item) => (
                <View key={item.id} style={styles.cardSugestao}>
                  <Text style={styles.sugestaoTexto}>
                    {item.texto_digitado}
                  </Text>
                  <Text style={styles.sugestaoDetalhe}>
                    {item.origem} · {formatarDataCurta(item.created_at)}
                  </Text>

                  {confirmandoDescarteId === item.id ? (
                    <View style={styles.confirmacaoDescarte}>
                      <Text style={styles.confirmacaoDescarteTexto}>
                        Descartar esta sugestão?
                      </Text>
                      <View style={styles.confirmacaoDescarteBotoes}>
                        <Pressable
                          style={styles.botaoCancelarPequeno}
                          onPress={() => setConfirmandoDescarteId(null)}
                        >
                          <Text style={styles.botaoCancelarPequenoTexto}>
                            Cancelar
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.botaoDescartarPequeno}
                          onPress={() => handleDescartar(item.id)}
                          disabled={descartando}
                        >
                          <Text style={styles.botaoDescartarPequenoTexto}>
                            {descartando ? 'Descartando…' : 'Descartar'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.sugestaoAcoes}>
                      <Pressable
                        style={styles.sugestaoAcaoPrimaria}
                        onPress={() => abrirModalNovoDeSugestao(item)}
                      >
                        <Text style={styles.sugestaoAcaoPrimariaTexto}>
                          Criar ambiente
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.sugestaoAcaoSecundaria}
                        onPress={() => abrirModalVincular(item)}
                      >
                        <Text style={styles.sugestaoAcaoSecundariaTexto}>
                          Vincular a existente
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.sugestaoAcaoDescartar}
                        onPress={() => setConfirmandoDescarteId(item.id)}
                      >
                        <Text style={styles.sugestaoAcaoDescartarTexto}>
                          Descartar
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {/* Menu de 3 pontos por ambiente. */}
      <CardMenu
        visible={menuAbertoId !== null}
        onClose={fecharMenu}
        anchorPosition={menuAncora}
      >
        {(() => {
          const item = ambientes.find((a) => a.id === menuAbertoId);
          if (!item) {
            return null;
          }

          if (menuEtapa === 'confirmarExclusao') {
            return (
              <View style={styles.menuConfirmacao}>
                <Text style={styles.menuConfirmacaoTexto}>
                  Excluir este ambiente?
                </Text>
                <View style={styles.menuConfirmacaoBotoes}>
                  <Pressable
                    style={styles.menuConfirmacaoBotaoCancelar}
                    onPress={() => setMenuEtapa('opcoes')}
                  >
                    <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.menuConfirmacaoBotaoExcluir}
                    onPress={() => handleExcluirConfirmar(item)}
                    disabled={excluindoId === item.id}
                  >
                    <Text style={styles.menuConfirmacaoBotaoExcluirTexto}>
                      {excluindoId === item.id ? 'Excluindo…' : 'Excluir'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <>
              <Pressable
                style={styles.menuItem}
                onPress={() => abrirModalEditar(item)}
              >
                <Text style={styles.menuItemTexto}>Editar</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => handleAlternarStatus(item)}
                disabled={alterandoStatusId === item.id}
              >
                <Text style={styles.menuItemTexto}>
                  {alterandoStatusId === item.id
                    ? 'Aguarde…'
                    : item.ativo
                      ? 'Desativar'
                      : 'Reativar'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={handlePedirConfirmacaoExclusao}
              >
                <Text
                  style={[styles.menuItemTexto, styles.menuItemExcluirTexto]}
                >
                  Excluir
                </Text>
              </Pressable>
            </>
          );
        })()}
      </CardMenu>

      {/* Modal de cadastro/edição em tela cheia. */}
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
            <Text style={styles.tituloModal}>
              {sugestaoOrigemId
                ? 'Novo ambiente'
                : editingId
                  ? 'Editar ambiente'
                  : 'Novo ambiente'}
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
            contentContainerStyle={styles.corpoModal}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Nome do ambiente"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Categoria</Text>
              <View style={styles.chipWrap}>
                {CATEGORIAS_AMBIENTE.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={categoria === item}
                    onPress={() => setCategoria(item)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bloco</Text>
              <TextInput
                value={bloco}
                onChangeText={setBloco}
                placeholder="Bloco (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Andar</Text>
              <TextInput
                value={andar}
                onChangeText={setAndar}
                placeholder="Andar (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Observações</Text>
              <TextInput
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Observações (opcional)"
                placeholderTextColor={light.textSecondary}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.inputMultiline]}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.linhaSwitch}>
                <Text style={styles.label}>Ativo</Text>
                <Switch
                  value={ativo}
                  onValueChange={setAtivo}
                  trackColor={{
                    false: light.border,
                    true: `${light.inkAction}1A`,
                  }}
                  thumbColor={ativo ? light.inkAction : '#FFFFFF'}
                />
              </View>
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
                (isSubmitting || !nome.trim()) &&
                  styles.botaoSalvarDesabilitado,
              ]}
              onPress={handleSalvar}
              disabled={isSubmitting || !nome.trim()}
            >
              <Text style={styles.botaoSalvarTexto}>
                {isSubmitting ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Seletor buscável "Vincular a existente". */}
      <Modal
        visible={modalVincularVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalVincular}
      >
        <View style={styles.telaModal}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>Vincular a existente</Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharModalVincular}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
          </View>

          <View style={styles.buscaWrap}>
            <TextInput
              value={buscaVincular}
              onChangeText={setBuscaVincular}
              placeholder="Buscar por nome"
              placeholderTextColor={light.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <ScrollView contentContainerStyle={styles.corpoAtribuir}>
            {ambientesParaVincular.length === 0 ? (
              <Text style={styles.vazio}>Nenhum ambiente encontrado.</Text>
            ) : (
              ambientesParaVincular.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.linhaVincular}
                  onPress={() => handleVincular(item)}
                  disabled={vinculando}
                >
                  <View>
                    <Text style={styles.linhaVincularTexto}>{item.nome}</Text>
                    <Text style={styles.linhaVincularDetalhe}>
                      {item.categoria}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
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
  // Largura mínima simétrica dos dois lados do cabeçalho — garante que o
  // título centralize mesmo com "Voltar" (texto) de um lado e o "+"
  // (ícone) do outro, larguras diferentes.
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
  buscaWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  // Linha de chips de categoria, rolável horizontalmente, logo abaixo da
  // busca — só visível na seção "Cadastrados".
  chipsCategoriaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chipsSecaoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  chipComPonto: {
    position: 'relative',
  },
  pontoChip: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: semantic.overdue,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.lg,
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
  linhaMostrarInativos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Ruled Rows (DESIGN.md → Components): cada ambiente é uma linha, sem
  // fundo/borda/raio próprio — só a régua de 1px Hairline Border entre
  // registros. Agrupado por categoria com cabeçalho de texto por grupo.
  grupo: {
    gap: spacing.xs,
  },
  grupoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lista: {},
  linha: {
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  linhaConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  linhaConteudoInativa: {
    opacity: 0.45,
  },
  linhaTextos: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  linhaNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linhaNome: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  seloInativo: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  seloInativoTexto: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: light.textSecondary,
  },
  menuButton: {
    padding: 6,
    borderRadius: radius.sm,
  },
  menuButtonPressionado: {
    backgroundColor: light.sunken,
  },
  menuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuItemTexto: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
  menuItemExcluirTexto: {
    color: semantic.overdue,
  },
  menuConfirmacao: {
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 180,
  },
  menuConfirmacaoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textPrimary,
  },
  menuConfirmacaoBotoes: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  menuConfirmacaoBotaoCancelar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  menuConfirmacaoBotaoCancelarTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  menuConfirmacaoBotaoExcluir: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: semantic.overdue,
  },
  menuConfirmacaoBotaoExcluirTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  // Sugestões carregam 3 ações diretas cada — bordered card (radius.md, NÃO
  // radius.lg, que hoje vale 999px e deformaria este retângulo), diferente
  // das linhas de "Cadastrados" (só navegação/menu).
  listaSugestoes: {
    gap: spacing.md,
  },
  cardSugestao: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sugestaoTexto: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  sugestaoDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  sugestaoAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sugestaoAcaoPrimaria: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    backgroundColor: light.inkAction,
  },
  sugestaoAcaoPrimariaTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  sugestaoAcaoSecundaria: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: light.border,
  },
  sugestaoAcaoSecundariaTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textPrimary,
  },
  sugestaoAcaoDescartar: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
  },
  sugestaoAcaoDescartarTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: semantic.overdue,
  },
  confirmacaoDescarte: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmacaoDescarteTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textPrimary,
  },
  confirmacaoDescarteBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botaoCancelarPequeno: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoCancelarPequenoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  botaoDescartarPequeno: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: semantic.overdue,
  },
  botaoDescartarPequenoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  // Modal de cadastro/edição em tela cheia — mesmo padrão de
  // app/admin/preservacao.tsx.
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  corpoAtribuir: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  linhaVincular: {
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  linhaVincularTexto: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaVincularDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
});
