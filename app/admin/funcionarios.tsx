import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useRef, useState } from 'react';
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
import { Chip } from '../../src/components/Chip';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import type {
  Funcionario,
  PapelFuncionario,
} from '../../src/data/funcionarios';
import { supabase } from '../../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

const PAPEIS: { valor: PapelFuncionario; label: string }[] = [
  { valor: 'administrador', label: 'Administrador' },
  { valor: 'zeladoria', label: 'Zeladoria' },
];

const SENHA_MIN_LENGTH = 6;

type PendenciaRota = {
  id: string;
  nome: string;
};

type PendenciaOrdem = {
  id: string;
  titulo: string | null;
  tipo: string | null;
};

type Resolucao =
  | { acao: 'transferir'; novoFuncionarioId: string }
  | { acao: 'standby' };

function chavePendencia(tipo: 'rota' | 'ordem', id: string): string {
  return `${tipo}:${id}`;
}

function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

function papelLabel(papel: PapelFuncionario): string {
  return PAPEIS.find((item) => item.valor === papel)?.label ?? papel;
}

function mensagemDeErro(erro: unknown): string {
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

  const [inativandoId, setInativandoId] = useState<string | null>(null);
  const [inativosExpandidos, setInativosExpandidos] = useState(false);

  const [modalEditarVisivel, setModalEditarVisivel] = useState(false);
  const [funcionarioEditandoId, setFuncionarioEditandoId] = useState<
    string | null
  >(null);
  const [nomeEditar, setNomeEditar] = useState('');
  const [funcaoEditar, setFuncaoEditar] = useState('');
  const [papelEditar, setPapelEditar] = useState<PapelFuncionario | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroModalEditar, setErroModalEditar] = useState<string | null>(null);

  // Menu de 3 pontos por funcionário — mesmo componente (CardMenu, um Modal
  // transparente ancorado) e mesmo padrão de estado/handlers já usados nos
  // cards de atividade em app/admin/preservacao.tsx.
  const [menuFuncionarioAbertoId, setMenuFuncionarioAbertoId] = useState<
    string | null
  >(null);
  const [menuFuncionarioAncora, setMenuFuncionarioAncora] =
    useState<AnchorPosition>({ x: 0, y: 0 });
  const menuFuncionarioIconRefs = useRef<Map<string, View>>(new Map());

  const [pendenciasVisivel, setPendenciasVisivel] = useState(false);
  const [funcionarioInativandoId, setFuncionarioInativandoId] = useState<
    string | null
  >(null);
  const [pendenciasRotas, setPendenciasRotas] = useState<PendenciaRota[]>([]);
  const [pendenciasOrdens, setPendenciasOrdens] = useState<PendenciaOrdem[]>(
    [],
  );
  const [resolucoes, setResolucoes] = useState<
    Record<string, Resolucao | undefined>
  >({});
  const [expandidoTransferir, setExpandidoTransferir] = useState<string | null>(
    null,
  );
  const [confirmandoResolucoes, setConfirmandoResolucoes] = useState(false);
  const [erroPendencias, setErroPendencias] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const resposta = await fetch('/api/listar-funcionarios');
      const dados = (await resposta.json().catch(() => null)) as {
        funcionarios?: Funcionario[];
        erro?: string;
      } | null;

      if (!resposta.ok) {
        throw new Error(dados?.erro ?? 'Não foi possível carregar a lista.');
      }

      setFuncionarios(dados?.funcionarios ?? []);
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

  function handleAbrirMenuFuncionario(id: string) {
    if (menuFuncionarioAbertoId === id) {
      fecharMenuFuncionario();
      return;
    }

    const ref = menuFuncionarioIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _width, height) => {
      setMenuFuncionarioAncora({ x, y: y + height });
      setMenuFuncionarioAbertoId(id);
    });
  }

  function fecharMenuFuncionario() {
    setMenuFuncionarioAbertoId(null);
  }

  function abrirModalEditar(funcionario: Funcionario) {
    fecharMenuFuncionario();
    setFuncionarioEditandoId(funcionario.id);
    setNomeEditar(funcionario.nome);
    setFuncaoEditar(funcionario.funcao ?? '');
    setPapelEditar(funcionario.papel);
    setErroModalEditar(null);
    setModalEditarVisivel(true);
  }

  function fecharModalEditar() {
    setModalEditarVisivel(false);
    setFuncionarioEditandoId(null);
  }

  const formularioEdicaoValido =
    nomeEditar.trim().length > 0 && papelEditar !== null;

  async function handleSalvarEdicao() {
    if (!funcionarioEditandoId || !formularioEdicaoValido || salvandoEdicao) {
      return;
    }

    setSalvandoEdicao(true);
    setErroModalEditar(null);
    try {
      const resposta = await fetch('/api/atualizar-funcionario', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: funcionarioEditandoId,
          nome: nomeEditar.trim(),
          funcao: funcaoEditar.trim() || undefined,
          papel: papelEditar,
        }),
      });

      const dados = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        erro?: string;
      } | null;

      if (!resposta.ok || !dados?.ok) {
        throw new Error(
          dados?.erro ?? 'Não foi possível salvar o funcionário.',
        );
      }

      setModalEditarVisivel(false);
      setFuncionarioEditandoId(null);
      await carregar();
    } catch (erro) {
      setErroModalEditar(mensagemDeErro(erro));
    } finally {
      setSalvandoEdicao(false);
    }
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
      // Backend usa o token pra descobrir de qual condomínio é quem está
      // criando (ver api/criar-funcionario.ts) — sem ele, a criação nem
      // chega a rodar (401).
      const { data: sessaoAtual } = await supabase.auth.getSession();
      const tokenSessao = sessaoAtual.session?.access_token;

      const resposta = await fetch('/api/criar-funcionario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenSessao ? { Authorization: `Bearer ${tokenSessao}` } : {}),
        },
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

  async function handleInativar(funcionario: Funcionario) {
    if (inativandoId) {
      return;
    }

    fecharMenuFuncionario();
    setInativandoId(funcionario.id);
    setErroLista(null);
    try {
      const resposta = await fetch('/api/atualizar-funcionario', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: funcionario.id, ativo: false }),
      });

      if (resposta.status === 409) {
        const dados = (await resposta.json()) as {
          pendencias?: { rotas: PendenciaRota[]; ordens: PendenciaOrdem[] };
        };
        setFuncionarioInativandoId(funcionario.id);
        setPendenciasRotas(dados.pendencias?.rotas ?? []);
        setPendenciasOrdens(dados.pendencias?.ordens ?? []);
        setResolucoes({});
        setExpandidoTransferir(null);
        setErroPendencias(null);
        setPendenciasVisivel(true);
        return;
      }

      const dados = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        erro?: string;
      } | null;

      if (!resposta.ok || !dados?.ok) {
        throw new Error(
          dados?.erro ?? 'Não foi possível inativar o funcionário.',
        );
      }

      await carregar();
    } catch (erro) {
      setErroLista(mensagemDeErro(erro));
    } finally {
      setInativandoId(null);
    }
  }

  function fecharPendencias() {
    setPendenciasVisivel(false);
    setFuncionarioInativandoId(null);
    setExpandidoTransferir(null);
  }

  function escolherAcao(chave: string, resolucao: Resolucao) {
    setResolucoes((atual) => ({ ...atual, [chave]: resolucao }));
    setExpandidoTransferir(null);
  }

  const todasPendenciasResolvidas =
    pendenciasRotas.every(
      (rota) => resolucoes[chavePendencia('rota', rota.id)] !== undefined,
    ) &&
    pendenciasOrdens.every(
      (ordem) => resolucoes[chavePendencia('ordem', ordem.id)] !== undefined,
    );

  async function handleConfirmarResolucoes() {
    if (
      !funcionarioInativandoId ||
      !todasPendenciasResolvidas ||
      confirmandoResolucoes
    ) {
      return;
    }

    setConfirmandoResolucoes(true);
    setErroPendencias(null);
    try {
      const resolucoesPayload = [
        ...pendenciasRotas.map((rota) => {
          const resolucao = resolucoes[chavePendencia('rota', rota.id)];
          return {
            tipo: 'rota' as const,
            id: rota.id,
            acao: resolucao?.acao ?? 'standby',
            novo_funcionario_id:
              resolucao?.acao === 'transferir'
                ? resolucao.novoFuncionarioId
                : undefined,
          };
        }),
        ...pendenciasOrdens.map((ordem) => {
          const resolucao = resolucoes[chavePendencia('ordem', ordem.id)];
          return {
            tipo: 'ordem' as const,
            id: ordem.id,
            acao: resolucao?.acao ?? 'standby',
            novo_funcionario_id:
              resolucao?.acao === 'transferir'
                ? resolucao.novoFuncionarioId
                : undefined,
          };
        }),
      ];

      const resposta = await fetch('/api/resolver-pendencias-funcionario', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioInativandoId,
          resolucoes: resolucoesPayload,
        }),
      });

      const dados = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        erro?: string;
      } | null;

      if (!resposta.ok || !dados?.ok) {
        throw new Error(
          dados?.erro ?? 'Não foi possível resolver as pendências.',
        );
      }

      setPendenciasVisivel(false);
      setFuncionarioInativandoId(null);
      await carregar();
    } catch (erro) {
      setErroPendencias(mensagemDeErro(erro));
    } finally {
      setConfirmandoResolucoes(false);
    }
  }

  function renderPendenciaItem(
    tipo: 'rota' | 'ordem',
    id: string,
    label: string,
  ) {
    const chave = chavePendencia(tipo, id);
    const resolucao = resolucoes[chave];
    const expandido = expandidoTransferir === chave;
    const candidatos = funcionarios.filter(
      (item) => item.ativo && item.id !== funcionarioInativandoId,
    );

    return (
      <View key={chave} style={styles.itemLinha}>
        <View style={styles.itemTextos}>
          <Text style={styles.itemNome}>{label}</Text>
          {resolucao ? (
            <Text style={styles.itemDetalhe}>
              {resolucao.acao === 'transferir'
                ? `Transferir para ${
                    funcionarios.find(
                      (item) => item.id === resolucao.novoFuncionarioId,
                    )?.nome ?? '—'
                  }`
                : 'Sem responsável'}
            </Text>
          ) : null}
        </View>

        {!expandido ? (
          <View style={styles.acoesItem}>
            <Pressable onPress={() => setExpandidoTransferir(chave)}>
              <Text style={styles.acaoItemTexto}>Transferir</Text>
            </Pressable>
            <Pressable onPress={() => escolherAcao(chave, { acao: 'standby' })}>
              <Text style={styles.acaoItemTexto}>Deixar sem responsável</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.chipWrap}>
            {candidatos.length === 0 ? (
              <Text style={styles.itemDetalhe}>
                Nenhum outro funcionário ativo.
              </Text>
            ) : (
              candidatos.map((candidato) => (
                <Chip
                  key={candidato.id}
                  label={candidato.nome}
                  selected={
                    resolucao?.acao === 'transferir' &&
                    resolucao.novoFuncionarioId === candidato.id
                  }
                  onPress={() =>
                    escolherAcao(chave, {
                      acao: 'transferir',
                      novoFuncionarioId: candidato.id,
                    })
                  }
                />
              ))
            )}
            <Chip
              label="Cancelar"
              onPress={() => setExpandidoTransferir(null)}
            />
          </View>
        )}
      </View>
    );
  }

  const funcionariosAtivos = funcionarios.filter(
    (funcionario) => funcionario.ativo,
  );
  const funcionariosInativos = funcionarios.filter(
    (funcionario) => !funcionario.ativo,
  );

  function renderFuncionarioCard(funcionario: Funcionario) {
    return (
      <Fragment key={funcionario.id}>
        <View style={styles.funcionarioCard}>
          <View style={styles.funcionarioCardTextos}>
            <View style={styles.funcionarioNomeRow}>
              <Text
                style={[
                  styles.funcionarioNome,
                  !funcionario.ativo && styles.funcionarioNomeInativo,
                ]}
              >
                {funcionario.nome}
              </Text>
              {!funcionario.ativo ? (
                <View style={styles.seloInativo}>
                  <Text style={styles.seloInativoTexto}>Inativo</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.funcionarioFuncao}>
              {funcionario.funcao || 'Sem função definida'}
            </Text>
          </View>
          <View style={styles.funcionarioCardDireita}>
            <Chip label={papelLabel(funcionario.papel)} selected />
            <Pressable
              ref={(el) => {
                if (el) {
                  menuFuncionarioIconRefs.current.set(funcionario.id, el);
                }
              }}
              onPress={() => handleAbrirMenuFuncionario(funcionario.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={inativandoId === funcionario.id}
              style={({ pressed }) => [
                styles.funcionarioMenuButton,
                pressed && styles.funcionarioMenuButtonPressionado,
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

        <CardMenu
          visible={menuFuncionarioAbertoId === funcionario.id}
          onClose={fecharMenuFuncionario}
          anchorPosition={menuFuncionarioAncora}
        >
          <Pressable
            style={styles.menuItem}
            onPress={() => abrirModalEditar(funcionario)}
          >
            <Text style={styles.menuItemTexto}>Editar</Text>
          </Pressable>
          {funcionario.ativo ? (
            <Pressable
              style={styles.menuItem}
              onPress={() => handleInativar(funcionario)}
            >
              <Text style={[styles.menuItemTexto, styles.menuItemExcluirTexto]}>
                {inativandoId === funcionario.id ? 'Verificando…' : 'Inativar'}
              </Text>
            </Pressable>
          ) : null}
        </CardMenu>
      </Fragment>
    );
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

        {!carregando ? funcionariosAtivos.map(renderFuncionarioCard) : null}

        {!carregando && funcionariosInativos.length > 0 ? (
          <View style={styles.secaoInativos}>
            <Pressable
              style={styles.secaoInativosCabecalho}
              onPress={() => setInativosExpandidos((atual) => !atual)}
            >
              <Text style={styles.secaoInativosCabecalhoTexto}>
                Inativos ({funcionariosInativos.length})
              </Text>
              <Ionicons
                name={inativosExpandidos ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={light.inkAction}
              />
            </Pressable>

            {inativosExpandidos ? (
              <View style={styles.listaInativos}>
                {funcionariosInativos.map(renderFuncionarioCard)}
              </View>
            ) : null}
          </View>
        ) : null}
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
              {senha.length > 0 && senha.length < SENHA_MIN_LENGTH ? (
                <Text style={styles.erro}>
                  Senha deve ter no mínimo {SENHA_MIN_LENGTH} caracteres.
                </Text>
              ) : null}
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

      <Modal
        visible={modalEditarVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalEditar}
      >
        <View style={styles.telaModal}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>Editar funcionário</Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharModalEditar}
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
                value={nomeEditar}
                onChangeText={setNomeEditar}
                placeholder="Nome completo"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Função/Cargo</Text>
              <TextInput
                value={funcaoEditar}
                onChangeText={setFuncaoEditar}
                placeholder="Ex: Zelador, Porteiro (opcional)"
                placeholderTextColor={light.textSecondary}
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
                    selected={papelEditar === item.valor}
                    onPress={() => setPapelEditar(item.valor)}
                  />
                ))}
              </View>
            </View>

            {erroModalEditar ? (
              <Text style={styles.erro}>{erroModalEditar}</Text>
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
                (!formularioEdicaoValido || salvandoEdicao) &&
                  styles.botaoSalvarDesabilitado,
              ]}
              onPress={handleSalvarEdicao}
              disabled={!formularioEdicaoValido || salvandoEdicao}
            >
              <Text style={styles.botaoSalvarTexto}>
                {salvandoEdicao ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendenciasVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharPendencias}
      >
        <View style={styles.telaModal}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal}>Pendências</Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharPendencias}
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
            <Text style={styles.pendenciasIntro}>
              Este funcionário tem rotas e/ou chamados em aberto. Escolha o que
              fazer com cada um antes de inativar.
            </Text>

            {erroPendencias ? (
              <Text style={styles.erro}>{erroPendencias}</Text>
            ) : null}

            {pendenciasRotas.length > 0 ? (
              <View style={styles.secaoDetalhe}>
                <Text style={styles.secaoDetalheTitulo}>Rotas</Text>
                <View style={styles.listaDetalheItens}>
                  {pendenciasRotas.map((rota) =>
                    renderPendenciaItem('rota', rota.id, rota.nome),
                  )}
                </View>
              </View>
            ) : null}

            {pendenciasOrdens.length > 0 ? (
              <View style={styles.secaoDetalhe}>
                <Text style={styles.secaoDetalheTitulo}>Chamados</Text>
                <View style={styles.listaDetalheItens}>
                  {pendenciasOrdens.map((ordem) =>
                    renderPendenciaItem(
                      'ordem',
                      ordem.id,
                      ordem.titulo || ordem.tipo || 'Chamado',
                    ),
                  )}
                </View>
              </View>
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
                (!todasPendenciasResolvidas || confirmandoResolucoes) &&
                  styles.botaoSalvarDesabilitado,
              ]}
              onPress={handleConfirmarResolucoes}
              disabled={!todasPendenciasResolvidas || confirmandoResolucoes}
            >
              <Text style={styles.botaoSalvarTexto}>
                {confirmandoResolucoes
                  ? 'Confirmando…'
                  : 'Confirmar e inativar'}
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
  // Seção recolhível dos inativos — mesmo padrão de cabeçalho
  // expande/recolhe de grupoRotaExpandirRow em app/admin/preservacao.tsx.
  secaoInativos: {
    gap: spacing.sm,
  },
  secaoInativosCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  secaoInativosCabecalhoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.inkAction,
  },
  listaInativos: {
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
  funcionarioCardDireita: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  funcionarioNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  funcionarioNomeInativo: {
    color: light.textMuted,
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
  acaoItemTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.inkAction,
  },
  acaoItemExcluirTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: semantic.overdue,
  },
  funcionarioMenuButton: {
    padding: 6,
    borderRadius: radius.sm,
  },
  funcionarioMenuButtonPressionado: {
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
  pendenciasIntro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  secaoDetalhe: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  secaoDetalheTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: light.textPrimary,
  },
  listaDetalheItens: {
    gap: spacing.xs,
  },
  itemLinha: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  itemTextos: {
    gap: 2,
  },
  itemNome: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  itemDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  acoesItem: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
});
