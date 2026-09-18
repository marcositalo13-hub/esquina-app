import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { type AnchorPosition, CardMenu } from '../../src/components/CardMenu';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  atualizarMorador,
  CODIGO_ERRO_DUPLICADO,
  criarMorador,
  criarUnidade,
  criarUnidadesEmMassa,
  desativarMorador,
  ErroUnidade,
  excluirMorador,
  excluirUnidade,
  listarUnidadesComMoradores,
  type Morador,
  type ResultadoGeracaoEmMassa,
  type UnidadeComMoradores,
} from '../../src/data/unidades';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

// Busca client-side insensível a caixa e acento — mesmo helper duplicado em
// app/admin/ambientes.tsx, app/admin/contratos.tsx e
// app/admin/normativos-gerenciar.tsx.
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroUnidade && erro.code === CODIGO_ERRO_DUPLICADO) {
    return 'Já existe essa unidade cadastrada.';
  }
  if (erro instanceof Error) {
    return erro.message;
  }
  return 'Não foi possível concluir a operação.';
}

function formatarUnidade(unidade: UnidadeComMoradores): string {
  return unidade.bloco
    ? `Bloco ${unidade.bloco}, nº ${unidade.numero}`
    : `Nº ${unidade.numero}`;
}

// Só aceita inteiro não negativo em texto puro — usado para número
// inicial/final do gerador em massa (keyboardType numeric já restringe o
// teclado, isto valida o valor final antes de habilitar "Gerar").
function paraInteiro(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+$/.test(limpo)) {
    return null;
  }
  return Number(limpo);
}

export default function AdminUnidades() {
  const insets = useSafeAreaInsets();

  const [unidades, setUnidades] = useState<UnidadeComMoradores[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [busca, setBusca] = useState('');

  // Menu do "+" do cabeçalho — duas opções de criação, mesmo padrão do "+"
  // em app/admin/preservacao.tsx (CardMenu ancorado no próprio botão).
  const [menuCriarVisivel, setMenuCriarVisivel] = useState(false);
  const [menuCriarAncora, setMenuCriarAncora] = useState<AnchorPosition>({
    x: 0,
    y: 0,
  });
  const botaoCriarRef = useRef<View | null>(null);

  // Modal "Nova unidade".
  const [modalUnidadeVisivel, setModalUnidadeVisivel] = useState(false);
  const [unidadeBloco, setUnidadeBloco] = useState('');
  const [unidadeNumero, setUnidadeNumero] = useState('');
  const [salvandoUnidade, setSalvandoUnidade] = useState(false);
  const [erroModalUnidade, setErroModalUnidade] = useState<string | null>(null);

  // Modal "Gerar em massa".
  const [modalMassaVisivel, setModalMassaVisivel] = useState(false);
  const [massaBlocos, setMassaBlocos] = useState('');
  const [massaNumeroInicial, setMassaNumeroInicial] = useState('');
  const [massaNumeroFinal, setMassaNumeroFinal] = useState('');
  const [gerandoMassa, setGerandoMassa] = useState(false);
  const [erroModalMassa, setErroModalMassa] = useState<string | null>(null);
  const [resultadoMassa, setResultadoMassa] =
    useState<ResultadoGeracaoEmMassa | null>(null);

  // Menu de 3 pontos por unidade.
  const [menuUnidadeAbertoId, setMenuUnidadeAbertoId] = useState<string | null>(
    null,
  );
  const [menuUnidadeEtapa, setMenuUnidadeEtapa] = useState<
    'opcoes' | 'confirmarExclusao'
  >('opcoes');
  const [menuUnidadeAncora, setMenuUnidadeAncora] = useState<AnchorPosition>({
    x: 0,
    y: 0,
  });
  const menuUnidadeIconRefs = useRef<Map<string, View>>(new Map());
  const [excluindoUnidadeId, setExcluindoUnidadeId] = useState<string | null>(
    null,
  );

  // Menu de 3 pontos por morador (dentro do card da unidade).
  const [menuMoradorAbertoId, setMenuMoradorAbertoId] = useState<string | null>(
    null,
  );
  const [menuMoradorEtapa, setMenuMoradorEtapa] = useState<
    'opcoes' | 'confirmarExclusao'
  >('opcoes');
  const [menuMoradorAncora, setMenuMoradorAncora] = useState<AnchorPosition>({
    x: 0,
    y: 0,
  });
  const menuMoradorIconRefs = useRef<Map<string, View>>(new Map());
  const [alterandoStatusMoradorId, setAlterandoStatusMoradorId] = useState<
    string | null
  >(null);
  const [excluindoMoradorId, setExcluindoMoradorId] = useState<string | null>(
    null,
  );

  // Modal "Novo/Editar morador" — vinculado à unidade a partir de onde foi
  // aberto, sem seletor de unidade no formulário.
  const [modalMoradorVisivel, setModalMoradorVisivel] = useState(false);
  const [moradorEditingId, setMoradorEditingId] = useState<string | null>(null);
  const [moradorUnidadeId, setMoradorUnidadeId] = useState<string | null>(null);
  const [moradorUnidadeLabel, setMoradorUnidadeLabel] = useState('');
  const [moradorNome, setMoradorNome] = useState('');
  const [moradorTelefone, setMoradorTelefone] = useState('');
  const [salvandoMorador, setSalvandoMorador] = useState(false);
  const [erroModalMorador, setErroModalMorador] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const lista = await listarUnidadesComMoradores();
      setUnidades(lista);
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

  // Busca por bloco OU número, local, combinada com o agrupamento por
  // bloco (a ordenação já vem do banco: bloco depois número).
  const gruposPorBloco = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    const filtradas = unidades.filter((item) => {
      if (!termo) {
        return true;
      }
      const blocoTexto = normalizarTexto(item.bloco ?? '');
      const numeroTexto = normalizarTexto(item.numero);
      return blocoTexto.includes(termo) || numeroTexto.includes(termo);
    });

    const mapa = new Map<string, UnidadeComMoradores[]>();
    for (const item of filtradas) {
      const chave = item.bloco ?? '';
      const lista = mapa.get(chave);
      if (lista) {
        lista.push(item);
      } else {
        mapa.set(chave, [item]);
      }
    }

    return Array.from(mapa.entries()).map(([bloco, itens]) => ({
      bloco,
      itens,
    }));
  }, [unidades, busca]);

  function abrirMenuCriar() {
    botaoCriarRef.current?.measureInWindow((x, y, _largura, altura) => {
      setMenuCriarAncora({ x, y: y + altura });
      setMenuCriarVisivel(true);
    });
  }

  function abrirModalUnidade() {
    setMenuCriarVisivel(false);
    setUnidadeBloco('');
    setUnidadeNumero('');
    setErroModalUnidade(null);
    setModalUnidadeVisivel(true);
  }

  function fecharModalUnidade() {
    setModalUnidadeVisivel(false);
  }

  async function handleSalvarUnidade() {
    if (!unidadeNumero.trim()) {
      return;
    }

    setSalvandoUnidade(true);
    setErroModalUnidade(null);
    try {
      await criarUnidade({
        bloco: unidadeBloco.trim() || null,
        numero: unidadeNumero.trim(),
      });
      setModalUnidadeVisivel(false);
      await carregar();
    } catch (erro) {
      setErroModalUnidade(mensagemDeErro(erro));
    } finally {
      setSalvandoUnidade(false);
    }
  }

  function abrirModalMassa() {
    setMenuCriarVisivel(false);
    setMassaBlocos('');
    setMassaNumeroInicial('');
    setMassaNumeroFinal('');
    setResultadoMassa(null);
    setErroModalMassa(null);
    setModalMassaVisivel(true);
  }

  function fecharModalMassa() {
    setModalMassaVisivel(false);
  }

  const massaBlocosArray = useMemo(() => {
    return massaBlocos
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }, [massaBlocos]);

  const massaNumeroInicialNum = paraInteiro(massaNumeroInicial);
  const massaNumeroFinalNum = paraInteiro(massaNumeroFinal);

  const massaValida =
    massaNumeroInicialNum !== null &&
    massaNumeroFinalNum !== null &&
    massaNumeroFinalNum >= massaNumeroInicialNum;

  const massaQuantidadePrevista =
    massaValida &&
    massaNumeroInicialNum !== null &&
    massaNumeroFinalNum !== null
      ? (massaBlocosArray.length || 1) *
        (massaNumeroFinalNum - massaNumeroInicialNum + 1)
      : null;

  async function handleGerarMassa() {
    if (
      gerandoMassa ||
      !massaValida ||
      massaNumeroInicialNum === null ||
      massaNumeroFinalNum === null
    ) {
      return;
    }

    setGerandoMassa(true);
    setErroModalMassa(null);
    setResultadoMassa(null);
    try {
      const resultado = await criarUnidadesEmMassa(
        massaBlocosArray,
        massaNumeroInicialNum,
        massaNumeroFinalNum,
      );
      setResultadoMassa(resultado);
      await carregar();
    } catch (erro) {
      setErroModalMassa(mensagemDeErro(erro));
    } finally {
      setGerandoMassa(false);
    }
  }

  function handleAbrirMenuUnidade(id: string) {
    if (menuUnidadeAbertoId === id) {
      fecharMenuUnidade();
      return;
    }
    const ref = menuUnidadeIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _largura, altura) => {
      setMenuUnidadeAncora({ x, y: y + altura });
      setMenuUnidadeAbertoId(id);
      setMenuUnidadeEtapa('opcoes');
      setErroAcao(null);
    });
  }

  function fecharMenuUnidade() {
    setMenuUnidadeAbertoId(null);
    setMenuUnidadeEtapa('opcoes');
  }

  function handlePedirConfirmacaoExclusaoUnidade() {
    setMenuUnidadeEtapa('confirmarExclusao');
  }

  async function handleExcluirUnidadeConfirmar(unidade: UnidadeComMoradores) {
    setExcluindoUnidadeId(unidade.id);
    setErroAcao(null);
    try {
      await excluirUnidade(unidade.id);
      fecharMenuUnidade();
      await carregar();
    } catch (erro) {
      fecharMenuUnidade();
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setExcluindoUnidadeId(null);
    }
  }

  function abrirModalNovoMorador(unidade: UnidadeComMoradores) {
    fecharMenuUnidade();
    setMoradorEditingId(null);
    setMoradorUnidadeId(unidade.id);
    setMoradorUnidadeLabel(formatarUnidade(unidade));
    setMoradorNome('');
    setMoradorTelefone('');
    setErroModalMorador(null);
    setModalMoradorVisivel(true);
  }

  function abrirModalEditarMorador(morador: Morador, unidadeLabel: string) {
    fecharMenuMorador();
    setMoradorEditingId(morador.id);
    setMoradorUnidadeId(morador.unidade_id);
    setMoradorUnidadeLabel(unidadeLabel);
    setMoradorNome(morador.nome);
    setMoradorTelefone(morador.telefone ?? '');
    setErroModalMorador(null);
    setModalMoradorVisivel(true);
  }

  function fecharModalMorador() {
    setModalMoradorVisivel(false);
  }

  async function handleSalvarMorador() {
    if (!moradorNome.trim() || !moradorUnidadeId) {
      return;
    }

    setSalvandoMorador(true);
    setErroModalMorador(null);
    try {
      if (moradorEditingId) {
        await atualizarMorador(moradorEditingId, {
          nome: moradorNome.trim(),
          telefone: moradorTelefone.trim() || null,
        });
      } else {
        await criarMorador({
          unidade_id: moradorUnidadeId,
          nome: moradorNome.trim(),
          telefone: moradorTelefone.trim() || null,
        });
      }
      setModalMoradorVisivel(false);
      await carregar();
    } catch (erro) {
      setErroModalMorador(mensagemDeErro(erro));
    } finally {
      setSalvandoMorador(false);
    }
  }

  const moradorAberto = useMemo(() => {
    if (!menuMoradorAbertoId) {
      return null;
    }
    for (const unidade of unidades) {
      const encontrado = unidade.moradores.find(
        (item) => item.id === menuMoradorAbertoId,
      );
      if (encontrado) {
        return { morador: encontrado, unidadeLabel: formatarUnidade(unidade) };
      }
    }
    return null;
  }, [unidades, menuMoradorAbertoId]);

  function handleAbrirMenuMorador(id: string) {
    if (menuMoradorAbertoId === id) {
      fecharMenuMorador();
      return;
    }
    const ref = menuMoradorIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _largura, altura) => {
      setMenuMoradorAncora({ x, y: y + altura });
      setMenuMoradorAbertoId(id);
      setMenuMoradorEtapa('opcoes');
      setErroAcao(null);
    });
  }

  function fecharMenuMorador() {
    setMenuMoradorAbertoId(null);
    setMenuMoradorEtapa('opcoes');
  }

  async function handleAlternarStatusMorador(morador: Morador) {
    fecharMenuMorador();
    setAlterandoStatusMoradorId(morador.id);
    setErroAcao(null);
    try {
      await desativarMorador(morador.id, !morador.ativo);
      await carregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setAlterandoStatusMoradorId(null);
    }
  }

  function handlePedirConfirmacaoExclusaoMorador() {
    setMenuMoradorEtapa('confirmarExclusao');
  }

  async function handleExcluirMoradorConfirmar(morador: Morador) {
    setExcluindoMoradorId(morador.id);
    setErroAcao(null);
    try {
      await excluirMorador(morador.id);
      fecharMenuMorador();
      await carregar();
    } catch (erro) {
      fecharMenuMorador();
      setErroAcao(mensagemDeErro(erro));
    } finally {
      setExcluindoMoradorId(null);
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

        <Text style={styles.title}>Unidades e Moradores</Text>

        <Pressable
          ref={botaoCriarRef}
          onPress={abrirMenuCriar}
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

      <CardMenu
        visible={menuCriarVisivel}
        onClose={() => setMenuCriarVisivel(false)}
        anchorPosition={menuCriarAncora}
      >
        <Pressable style={styles.menuItem} onPress={abrirModalUnidade}>
          <Text style={styles.menuItemTexto}>Nova unidade</Text>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={abrirModalMassa}>
          <Text style={styles.menuItemTexto}>Gerar em massa</Text>
        </Pressable>
      </CardMenu>

      <View style={styles.buscaWrap}>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por bloco ou número"
          placeholderTextColor={light.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}
        {erroAcao ? <Text style={styles.erro}>{erroAcao}</Text> : null}

        {!carregando && gruposPorBloco.length === 0 ? (
          <Text style={styles.vazio}>
            {busca.trim()
              ? 'Nenhuma unidade encontrada.'
              : 'Nenhuma unidade cadastrada ainda.'}
          </Text>
        ) : null}

        {!carregando
          ? gruposPorBloco.map((grupo) => (
              <View key={grupo.bloco || '—sem-bloco—'} style={styles.grupo}>
                <Text style={styles.grupoTitulo}>
                  {grupo.bloco ? `Bloco ${grupo.bloco}` : 'Sem bloco'}
                </Text>
                <View style={styles.listaUnidades}>
                  {grupo.itens.map((unidade) => (
                    <View key={unidade.id} style={styles.unidadeCard}>
                      <View style={styles.unidadeCabecalho}>
                        <Text style={styles.unidadeTitulo}>
                          {formatarUnidade(unidade)}
                        </Text>
                        <Pressable
                          ref={(el) => {
                            if (el) {
                              menuUnidadeIconRefs.current.set(unidade.id, el);
                            }
                          }}
                          onPress={() => handleAbrirMenuUnidade(unidade.id)}
                          hitSlop={{
                            top: 10,
                            bottom: 10,
                            left: 10,
                            right: 10,
                          }}
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

                      {unidade.moradores.length === 0 ? (
                        <Text style={styles.unidadeVazio}>
                          Nenhum morador vinculado.
                        </Text>
                      ) : (
                        <View style={styles.moradoresLista}>
                          {unidade.moradores.map((morador) => (
                            <View key={morador.id} style={styles.moradorLinha}>
                              <View style={styles.moradorTextos}>
                                <Text
                                  style={[
                                    styles.moradorNome,
                                    !morador.ativo && styles.moradorNomeInativo,
                                  ]}
                                >
                                  {morador.nome}
                                </Text>
                                {!morador.ativo ? (
                                  <View style={styles.seloInativo}>
                                    <Text style={styles.seloInativoTexto}>
                                      Inativo
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Pressable
                                ref={(el) => {
                                  if (el) {
                                    menuMoradorIconRefs.current.set(
                                      morador.id,
                                      el,
                                    );
                                  }
                                }}
                                onPress={() =>
                                  handleAbrirMenuMorador(morador.id)
                                }
                                hitSlop={{
                                  top: 10,
                                  bottom: 10,
                                  left: 10,
                                  right: 10,
                                }}
                                style={({ pressed }) => [
                                  styles.moradorMenuButton,
                                  pressed && styles.menuButtonPressionado,
                                ]}
                              >
                                <Ionicons
                                  name="ellipsis-horizontal"
                                  size={16}
                                  color={light.textSecondary}
                                />
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ))
          : null}
      </ScrollView>

      {/* Menu de 3 pontos por unidade. */}
      <CardMenu
        visible={menuUnidadeAbertoId !== null}
        onClose={fecharMenuUnidade}
        anchorPosition={menuUnidadeAncora}
      >
        {(() => {
          const unidade = unidades.find((u) => u.id === menuUnidadeAbertoId);
          if (!unidade) {
            return null;
          }

          if (menuUnidadeEtapa === 'confirmarExclusao') {
            return (
              <View style={styles.menuConfirmacao}>
                <Text style={styles.menuConfirmacaoTexto}>
                  Excluir esta unidade? Os moradores vinculados também serão
                  removidos.
                </Text>
                <View style={styles.menuConfirmacaoBotoes}>
                  <Pressable
                    style={styles.menuConfirmacaoBotaoCancelar}
                    onPress={() => setMenuUnidadeEtapa('opcoes')}
                  >
                    <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.menuConfirmacaoBotaoExcluir}
                    onPress={() => handleExcluirUnidadeConfirmar(unidade)}
                    disabled={excluindoUnidadeId === unidade.id}
                  >
                    <Text style={styles.menuConfirmacaoBotaoExcluirTexto}>
                      {excluindoUnidadeId === unidade.id
                        ? 'Excluindo…'
                        : 'Excluir'}
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
                onPress={() => abrirModalNovoMorador(unidade)}
              >
                <Text style={styles.menuItemTexto}>Adicionar morador</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={handlePedirConfirmacaoExclusaoUnidade}
              >
                <Text
                  style={[styles.menuItemTexto, styles.menuItemExcluirTexto]}
                >
                  Excluir unidade
                </Text>
              </Pressable>
            </>
          );
        })()}
      </CardMenu>

      {/* Menu de 3 pontos por morador. */}
      <CardMenu
        visible={menuMoradorAbertoId !== null}
        onClose={fecharMenuMorador}
        anchorPosition={menuMoradorAncora}
      >
        {(() => {
          if (!moradorAberto) {
            return null;
          }
          const { morador, unidadeLabel } = moradorAberto;

          if (menuMoradorEtapa === 'confirmarExclusao') {
            return (
              <View style={styles.menuConfirmacao}>
                <Text style={styles.menuConfirmacaoTexto}>
                  Excluir este morador?
                </Text>
                <View style={styles.menuConfirmacaoBotoes}>
                  <Pressable
                    style={styles.menuConfirmacaoBotaoCancelar}
                    onPress={() => setMenuMoradorEtapa('opcoes')}
                  >
                    <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.menuConfirmacaoBotaoExcluir}
                    onPress={() => handleExcluirMoradorConfirmar(morador)}
                    disabled={excluindoMoradorId === morador.id}
                  >
                    <Text style={styles.menuConfirmacaoBotaoExcluirTexto}>
                      {excluindoMoradorId === morador.id
                        ? 'Excluindo…'
                        : 'Excluir'}
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
                onPress={() => abrirModalEditarMorador(morador, unidadeLabel)}
              >
                <Text style={styles.menuItemTexto}>Editar</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => handleAlternarStatusMorador(morador)}
                disabled={alterandoStatusMoradorId === morador.id}
              >
                <Text style={styles.menuItemTexto}>
                  {alterandoStatusMoradorId === morador.id
                    ? 'Aguarde…'
                    : morador.ativo
                      ? 'Desativar'
                      : 'Reativar'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={handlePedirConfirmacaoExclusaoMorador}
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

      {/* Modal "Nova unidade" em tela cheia. */}
      <Modal
        visible={modalUnidadeVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalUnidade}
      >
        <View style={styles.telaModal}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>Nova unidade</Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharModalUnidade}
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
              <Text style={styles.label}>Bloco</Text>
              <TextInput
                value={unidadeBloco}
                onChangeText={setUnidadeBloco}
                placeholder="Bloco (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Número</Text>
              <TextInput
                value={unidadeNumero}
                onChangeText={setUnidadeNumero}
                placeholder="Número"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            {erroModalUnidade ? (
              <Text style={styles.erro}>{erroModalUnidade}</Text>
            ) : null}
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
                (salvandoUnidade || !unidadeNumero.trim()) &&
                  styles.botaoSalvarDesabilitado,
              ]}
              onPress={handleSalvarUnidade}
              disabled={salvandoUnidade || !unidadeNumero.trim()}
            >
              <Text style={styles.botaoSalvarTexto}>
                {salvandoUnidade ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal "Gerar em massa" em tela cheia. */}
      <Modal
        visible={modalMassaVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalMassa}
      >
        <View style={styles.telaModal}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>Gerar em massa</Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharModalMassa}
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
              <Text style={styles.label}>Blocos</Text>
              <TextInput
                value={massaBlocos}
                onChangeText={setMassaBlocos}
                placeholder="Ex: 1,2,3 (vazio = sem bloco)"
                placeholderTextColor={light.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.linhaDoisCampos}>
              <View style={[styles.field, styles.campoMetade]}>
                <Text style={styles.label}>Número inicial</Text>
                <TextInput
                  value={massaNumeroInicial}
                  onChangeText={setMassaNumeroInicial}
                  placeholder="101"
                  placeholderTextColor={light.textSecondary}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, styles.campoMetade]}>
                <Text style={styles.label}>Número final</Text>
                <TextInput
                  value={massaNumeroFinal}
                  onChangeText={setMassaNumeroFinal}
                  placeholder="104"
                  placeholderTextColor={light.textSecondary}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            {massaValida && massaQuantidadePrevista !== null ? (
              <Text style={styles.resumoMassa}>
                Isso vai criar até {massaQuantidadePrevista} unidade
                {massaQuantidadePrevista === 1 ? '' : 's'}.
              </Text>
            ) : null}

            {resultadoMassa ? (
              <Text style={styles.resultadoMassaTexto}>
                {resultadoMassa.criadas} unidade
                {resultadoMassa.criadas === 1 ? '' : 's'} criada
                {resultadoMassa.criadas === 1 ? '' : 's'},{' '}
                {resultadoMassa.jaExistiam} já existia
                {resultadoMassa.jaExistiam === 1 ? '' : 'm'}.
              </Text>
            ) : null}

            {erroModalMassa ? (
              <Text style={styles.erro}>{erroModalMassa}</Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.rodapeModal,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            {resultadoMassa ? (
              <Pressable style={styles.botaoSalvar} onPress={fecharModalMassa}>
                <Text style={styles.botaoSalvarTexto}>Concluir</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.botaoSalvar,
                  (gerandoMassa || !massaValida) &&
                    styles.botaoSalvarDesabilitado,
                ]}
                onPress={handleGerarMassa}
                disabled={gerandoMassa || !massaValida}
              >
                <Text style={styles.botaoSalvarTexto}>
                  {gerandoMassa ? 'Gerando…' : 'Gerar'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal "Novo/Editar morador" em tela cheia. */}
      <Modal
        visible={modalMoradorVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalMorador}
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
              {moradorEditingId ? 'Editar morador' : 'Novo morador'}
            </Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharModalMorador}
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
            <Text style={styles.unidadeContexto}>{moradorUnidadeLabel}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                value={moradorNome}
                onChangeText={setMoradorNome}
                placeholder="Nome do morador"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                value={moradorTelefone}
                onChangeText={setMoradorTelefone}
                placeholder="Telefone (opcional)"
                placeholderTextColor={light.textSecondary}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            {erroModalMorador ? (
              <Text style={styles.erro}>{erroModalMorador}</Text>
            ) : null}
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
                (salvandoMorador || !moradorNome.trim()) &&
                  styles.botaoSalvarDesabilitado,
              ]}
              onPress={handleSalvarMorador}
              disabled={salvandoMorador || !moradorNome.trim()}
            >
              <Text style={styles.botaoSalvarTexto}>
                {salvandoMorador ? 'Salvando…' : 'Salvar'}
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
  grupo: {
    gap: spacing.sm,
  },
  grupoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listaUnidades: {
    gap: spacing.sm,
  },
  // Card por unidade — bordered card (radius.md, nunca radius.lg, que hoje
  // vale 999px e deformaria este retângulo), mesmo padrão de cardSugestao
  // em app/admin/ambientes.tsx.
  unidadeCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  unidadeCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  unidadeTitulo: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  unidadeVazio: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textMuted,
  },
  moradoresLista: {
    gap: spacing.xs / 2,
  },
  moradorLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  moradorTextos: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moradorNome: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
  moradorNomeInativo: {
    color: light.textMuted,
  },
  moradorMenuButton: {
    padding: 4,
    borderRadius: radius.sm,
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
    minWidth: 220,
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
  // Modal em tela cheia — mesmo padrão de app/admin/ambientes.tsx.
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
  linhaDoisCampos: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  campoMetade: {
    flex: 1,
  },
  resumoMassa: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  resultadoMassaTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: semantic.ok,
  },
  unidadeContexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
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
