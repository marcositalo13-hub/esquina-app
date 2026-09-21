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
import { MiniCalendar } from '../../src/components/MiniCalendar';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  atualizarMorador,
  atualizarUnidade,
  CODIGO_ERRO_DUPLICADO,
  calcularIdade,
  criarDependente,
  criarMorador,
  criarPet,
  criarUnidade,
  criarUnidadesEmMassa,
  type Dependente,
  desativarMorador,
  ErroUnidade,
  excluirDependente,
  excluirMorador,
  excluirPet,
  excluirUnidade,
  excluirUnidadesEmMassa,
  listarUnidadesComMoradores,
  type Morador,
  type Pet,
  type ResultadoGeracaoEmMassa,
  type UnidadeComMoradores,
} from '../../src/data/unidades';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

// Busca client-side insensível a caixa e acento — mesmo helper duplicado em
// app/admin/ambientes.tsx, app/admin/contratos.tsx e
// app/admin/normativos-gerenciar.tsx / app/admin/preservacao.tsx.
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
    ? `Bloco ${unidade.bloco}, Apartamento ${unidade.numero}`
    : `Apartamento ${unidade.numero}`;
}

// Formata 'AAAA-MM-DD' para 'DD/MM/AAAA' — mesmo padrão de formatarDataBR em
// src/data/manutencao.ts, duplicado aqui para não acoplar este módulo ao de
// Zeladoria por causa de um formatador de exibição.
function formatarDataBR(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
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

function formatarIdade(idade: number): string {
  return `${idade} ano${idade === 1 ? '' : 's'}`;
}

type AlvoCalendario = 'morador' | 'dependente' | null;

export default function AdminUnidades() {
  const insets = useSafeAreaInsets();

  const [unidades, setUnidades] = useState<UnidadeComMoradores[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [busca, setBusca] = useState('');

  // Modo de seleção múltipla da lista principal.
  const [modoSelecao, setModoSelecao] = useState(false);
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmandoExclusaoEmMassa, setConfirmandoExclusaoEmMassa] =
    useState(false);
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false);
  const [erroExclusaoEmMassa, setErroExclusaoEmMassa] = useState<string | null>(
    null,
  );

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

  // Modal de detalhe da unidade — abre ao tocar no card na lista. Reúne
  // edição da unidade, moradores, pets e dependentes num só lugar; nenhum
  // desses sub-formulários é um <Modal> próprio empilhado (o projeto evita
  // dois Modal simultâneos) — tudo aqui é inline, dentro deste modal.
  const [detalheVisivel, setDetalheVisivel] = useState(false);
  const [detalheUnidadeId, setDetalheUnidadeId] = useState<string | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  const detalheUnidade = useMemo(
    () => unidades.find((u) => u.id === detalheUnidadeId) ?? null,
    [unidades, detalheUnidadeId],
  );

  // Seção Unidade (bloco/número/observações), editável inline.
  const [detalheBloco, setDetalheBloco] = useState('');
  const [detalheNumero, setDetalheNumero] = useState('');
  const [detalheObservacoes, setDetalheObservacoes] = useState('');
  const [salvandoDetalheUnidade, setSalvandoDetalheUnidade] = useState(false);

  // Excluir unidade, a partir do rodapé do detalhe.
  const [confirmandoExclusaoUnidade, setConfirmandoExclusaoUnidade] =
    useState(false);
  const [excluindoUnidadeDetalhe, setExcluindoUnidadeDetalhe] = useState(false);

  // Seção Moradores.
  const [adicionandoMorador, setAdicionandoMorador] = useState(false);
  const [novoMoradorNome, setNovoMoradorNome] = useState('');
  const [novoMoradorTelefone, setNovoMoradorTelefone] = useState('');
  const [salvandoNovoMorador, setSalvandoNovoMorador] = useState(false);

  const [editandoMoradorId, setEditandoMoradorId] = useState<string | null>(
    null,
  );
  const [editMoradorNome, setEditMoradorNome] = useState('');
  const [editMoradorTelefone, setEditMoradorTelefone] = useState('');
  const [editMoradorCpf, setEditMoradorCpf] = useState('');
  const [editMoradorDataNascimento, setEditMoradorDataNascimento] =
    useState('');
  const [salvandoEdicaoMorador, setSalvandoEdicaoMorador] = useState(false);

  const [alterandoStatusMoradorId, setAlterandoStatusMoradorId] = useState<
    string | null
  >(null);
  const [confirmandoExclusaoMoradorId, setConfirmandoExclusaoMoradorId] =
    useState<string | null>(null);
  const [excluindoMoradorId, setExcluindoMoradorId] = useState<string | null>(
    null,
  );

  // Seção Pets.
  const [adicionandoPet, setAdicionandoPet] = useState(false);
  const [novoPetNome, setNovoPetNome] = useState('');
  const [novoPetEspecie, setNovoPetEspecie] = useState('');
  const [salvandoNovoPet, setSalvandoNovoPet] = useState(false);
  const [confirmandoExclusaoPetId, setConfirmandoExclusaoPetId] = useState<
    string | null
  >(null);
  const [excluindoPetId, setExcluindoPetId] = useState<string | null>(null);

  // Seção Dependentes.
  const [adicionandoDependente, setAdicionandoDependente] = useState(false);
  const [novoDependenteNome, setNovoDependenteNome] = useState('');
  const [novoDependenteDataNascimento, setNovoDependenteDataNascimento] =
    useState('');
  const [salvandoNovoDependente, setSalvandoNovoDependente] = useState(false);
  const [confirmandoExclusaoDependenteId, setConfirmandoExclusaoDependenteId] =
    useState<string | null>(null);
  const [excluindoDependenteId, setExcluindoDependenteId] = useState<
    string | null
  >(null);

  // Overlay de calendário compartilhado (nascimento de morador em edição
  // OU de dependente em cadastro — só um por vez, então um estado só).
  // INLINE dentro do modal de detalhe, nunca um <Modal> próprio — mesmo
  // motivo dos overlays de app/admin/preservacao.tsx.
  const [calendarioAlvo, setCalendarioAlvo] = useState<AlvoCalendario>(null);

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

  // Busca por bloco, número, nome/telefone/cpf de morador, nome de pet ou
  // nome de dependente — qualquer correspondência inclui a unidade.
  const gruposPorBloco = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    const filtradas = unidades.filter((item) => {
      if (!termo) {
        return true;
      }
      if (normalizarTexto(item.bloco ?? '').includes(termo)) {
        return true;
      }
      if (normalizarTexto(item.numero).includes(termo)) {
        return true;
      }
      if (
        item.moradores.some(
          (m) =>
            normalizarTexto(m.nome).includes(termo) ||
            normalizarTexto(m.telefone ?? '').includes(termo) ||
            normalizarTexto(m.cpf ?? '').includes(termo),
        )
      ) {
        return true;
      }
      if (item.pets.some((p) => normalizarTexto(p.nome).includes(termo))) {
        return true;
      }
      if (
        item.dependentes.some((d) => normalizarTexto(d.nome).includes(termo))
      ) {
        return true;
      }
      return false;
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

  const idsVisiveis = useMemo(
    () => gruposPorBloco.flatMap((grupo) => grupo.itens.map((u) => u.id)),
    [gruposPorBloco],
  );
  const todosSelecionados =
    idsVisiveis.length > 0 &&
    idsVisiveis.every((id) => unidadesSelecionadas.has(id));

  function alternarModoSelecao() {
    setModoSelecao((atual) => !atual);
    setUnidadesSelecionadas(new Set());
    setConfirmandoExclusaoEmMassa(false);
    setErroExclusaoEmMassa(null);
  }

  function alternarSelecaoUnidade(id: string) {
    setUnidadesSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setUnidadesSelecionadas(
      todosSelecionados ? new Set() : new Set(idsVisiveis),
    );
  }

  async function handleExcluirSelecionadas() {
    if (unidadesSelecionadas.size === 0) {
      return;
    }
    setExcluindoEmMassa(true);
    setErroExclusaoEmMassa(null);
    try {
      await excluirUnidadesEmMassa(Array.from(unidadesSelecionadas));
      setModoSelecao(false);
      setUnidadesSelecionadas(new Set());
      setConfirmandoExclusaoEmMassa(false);
      await carregar();
    } catch (erro) {
      setErroExclusaoEmMassa(mensagemDeErro(erro));
    } finally {
      setExcluindoEmMassa(false);
    }
  }

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

  // Abre o detalhe já com os campos de edição da unidade pré-preenchidos e
  // todos os formulários inline (morador/pet/dependente) fechados.
  function abrirDetalhe(unidade: UnidadeComMoradores) {
    setDetalheUnidadeId(unidade.id);
    setDetalheBloco(unidade.bloco ?? '');
    setDetalheNumero(unidade.numero);
    setDetalheObservacoes(unidade.observacoes ?? '');
    setErroDetalhe(null);
    setConfirmandoExclusaoUnidade(false);
    setAdicionandoMorador(false);
    setNovoMoradorNome('');
    setNovoMoradorTelefone('');
    setEditandoMoradorId(null);
    setConfirmandoExclusaoMoradorId(null);
    setAdicionandoPet(false);
    setNovoPetNome('');
    setNovoPetEspecie('');
    setConfirmandoExclusaoPetId(null);
    setAdicionandoDependente(false);
    setNovoDependenteNome('');
    setNovoDependenteDataNascimento('');
    setConfirmandoExclusaoDependenteId(null);
    setCalendarioAlvo(null);
    setDetalheVisivel(true);
  }

  function fecharDetalhe() {
    setDetalheVisivel(false);
    setDetalheUnidadeId(null);
    setCalendarioAlvo(null);
  }

  async function handleSalvarDetalheUnidade() {
    if (!detalheUnidadeId || !detalheNumero.trim()) {
      return;
    }
    setSalvandoDetalheUnidade(true);
    setErroDetalhe(null);
    try {
      await atualizarUnidade(detalheUnidadeId, {
        bloco: detalheBloco.trim() || null,
        numero: detalheNumero.trim(),
        observacoes: detalheObservacoes.trim() || null,
      });
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setSalvandoDetalheUnidade(false);
    }
  }

  async function handleExcluirDetalheUnidade() {
    if (!detalheUnidadeId) {
      return;
    }
    setExcluindoUnidadeDetalhe(true);
    setErroDetalhe(null);
    try {
      await excluirUnidade(detalheUnidadeId);
      fecharDetalhe();
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setExcluindoUnidadeDetalhe(false);
    }
  }

  function abrirAdicionarMorador() {
    setAdicionandoMorador(true);
    setNovoMoradorNome('');
    setNovoMoradorTelefone('');
    setErroDetalhe(null);
  }

  async function handleSalvarNovoMorador() {
    if (!detalheUnidadeId || !novoMoradorNome.trim()) {
      return;
    }
    setSalvandoNovoMorador(true);
    setErroDetalhe(null);
    try {
      await criarMorador({
        unidade_id: detalheUnidadeId,
        nome: novoMoradorNome.trim(),
        telefone: novoMoradorTelefone.trim() || null,
      });
      setAdicionandoMorador(false);
      setNovoMoradorNome('');
      setNovoMoradorTelefone('');
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setSalvandoNovoMorador(false);
    }
  }

  function abrirEditarMorador(morador: Morador) {
    setEditandoMoradorId(morador.id);
    setEditMoradorNome(morador.nome);
    setEditMoradorTelefone(morador.telefone ?? '');
    setEditMoradorCpf(morador.cpf ?? '');
    setEditMoradorDataNascimento(morador.data_nascimento ?? '');
    setErroDetalhe(null);
    setCalendarioAlvo(null);
  }

  function fecharEditarMorador() {
    setEditandoMoradorId(null);
    setCalendarioAlvo(null);
  }

  async function handleSalvarEdicaoMorador() {
    if (!editandoMoradorId || !editMoradorNome.trim()) {
      return;
    }
    setSalvandoEdicaoMorador(true);
    setErroDetalhe(null);
    try {
      await atualizarMorador(editandoMoradorId, {
        nome: editMoradorNome.trim(),
        telefone: editMoradorTelefone.trim() || null,
        cpf: editMoradorCpf.trim() || null,
        data_nascimento: editMoradorDataNascimento || null,
      });
      setEditandoMoradorId(null);
      setCalendarioAlvo(null);
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setSalvandoEdicaoMorador(false);
    }
  }

  async function handleAlternarStatusMorador(morador: Morador) {
    setAlterandoStatusMoradorId(morador.id);
    setErroDetalhe(null);
    try {
      await desativarMorador(morador.id, !morador.ativo);
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setAlterandoStatusMoradorId(null);
    }
  }

  async function handleExcluirMorador(morador: Morador) {
    setExcluindoMoradorId(morador.id);
    setErroDetalhe(null);
    try {
      await excluirMorador(morador.id);
      setConfirmandoExclusaoMoradorId(null);
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setExcluindoMoradorId(null);
    }
  }

  function abrirAdicionarPet() {
    setAdicionandoPet(true);
    setNovoPetNome('');
    setNovoPetEspecie('');
    setErroDetalhe(null);
  }

  async function handleSalvarNovoPet() {
    if (!detalheUnidadeId || !novoPetNome.trim() || !novoPetEspecie.trim()) {
      return;
    }
    setSalvandoNovoPet(true);
    setErroDetalhe(null);
    try {
      await criarPet({
        unidade_id: detalheUnidadeId,
        nome: novoPetNome.trim(),
        especie: novoPetEspecie.trim(),
      });
      setAdicionandoPet(false);
      setNovoPetNome('');
      setNovoPetEspecie('');
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setSalvandoNovoPet(false);
    }
  }

  async function handleExcluirPet(pet: Pet) {
    setExcluindoPetId(pet.id);
    setErroDetalhe(null);
    try {
      await excluirPet(pet.id);
      setConfirmandoExclusaoPetId(null);
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setExcluindoPetId(null);
    }
  }

  function abrirAdicionarDependente() {
    setAdicionandoDependente(true);
    setNovoDependenteNome('');
    setNovoDependenteDataNascimento('');
    setErroDetalhe(null);
    setCalendarioAlvo(null);
  }

  async function handleSalvarNovoDependente() {
    if (!detalheUnidadeId || !novoDependenteNome.trim()) {
      return;
    }
    setSalvandoNovoDependente(true);
    setErroDetalhe(null);
    try {
      await criarDependente({
        unidade_id: detalheUnidadeId,
        nome: novoDependenteNome.trim(),
        data_nascimento: novoDependenteDataNascimento || null,
      });
      setAdicionandoDependente(false);
      setNovoDependenteNome('');
      setNovoDependenteDataNascimento('');
      setCalendarioAlvo(null);
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setSalvandoNovoDependente(false);
    }
  }

  async function handleExcluirDependente(dependente: Dependente) {
    setExcluindoDependenteId(dependente.id);
    setErroDetalhe(null);
    try {
      await excluirDependente(dependente.id);
      setConfirmandoExclusaoDependenteId(null);
      await carregar();
    } catch (erro) {
      setErroDetalhe(mensagemDeErro(erro));
    } finally {
      setExcluindoDependenteId(null);
    }
  }

  function selecionarDataCalendario(data: string) {
    if (calendarioAlvo === 'morador') {
      setEditMoradorDataNascimento(data);
    } else if (calendarioAlvo === 'dependente') {
      setNovoDependenteDataNascimento(data);
    }
    setCalendarioAlvo(null);
  }

  const calendarioNascimentoOverlay = calendarioAlvo ? (
    <View style={styles.novaRotaOverlay}>
      <View style={styles.modalRotaCard}>
        <Text style={styles.modalTitulo}>Data de nascimento</Text>

        <MiniCalendar
          markedDates={{}}
          selectedDate={
            calendarioAlvo === 'morador'
              ? editMoradorDataNascimento || null
              : novoDependenteDataNascimento || null
          }
          onSelectDay={selecionarDataCalendario}
        />

        <View style={styles.modalBotoes}>
          <Pressable
            style={[styles.modalBotao, styles.modalBotaoCancelar]}
            onPress={() => setCalendarioAlvo(null)}
          >
            <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : null;

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
          placeholder="Buscar por bloco, unidade, morador, pet..."
          placeholderTextColor={light.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <View style={styles.selecaoRow}>
        {modoSelecao ? (
          <Pressable
            style={styles.selecionarTodosRow}
            onPress={alternarSelecionarTodos}
          >
            <View
              style={[
                styles.checkbox,
                todosSelecionados && styles.checkboxSelecionado,
              ]}
            >
              {todosSelecionados ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : null}
            </View>
            <Text style={styles.selecionarTodosTexto}>Selecionar todos</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={alternarModoSelecao}>
          <Text style={styles.selecionarLink}>
            {modoSelecao ? 'Cancelar' : 'Selecionar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          modoSelecao &&
            unidadesSelecionadas.size > 0 &&
            styles.bodyComBarraSelecao,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}

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
                  {grupo.itens.map((unidade) => {
                    const selecionada = unidadesSelecionadas.has(unidade.id);
                    const nomesMoradores = unidade.moradores
                      .map((m) => m.nome)
                      .join(', ');

                    return (
                      <Pressable
                        key={unidade.id}
                        style={({ pressed }) => [
                          styles.unidadeCard,
                          pressed && styles.unidadeCardPressionado,
                        ]}
                        onPress={() =>
                          modoSelecao
                            ? alternarSelecaoUnidade(unidade.id)
                            : abrirDetalhe(unidade)
                        }
                      >
                        <View style={styles.unidadeCardRow}>
                          {modoSelecao ? (
                            <View
                              style={[
                                styles.checkbox,
                                selecionada && styles.checkboxSelecionado,
                              ]}
                            >
                              {selecionada ? (
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color="#FFFFFF"
                                />
                              ) : null}
                            </View>
                          ) : null}

                          <View style={styles.unidadeCardTextos}>
                            {unidade.bloco ? (
                              <Text style={styles.unidadeCardLinha}>
                                Bloco: {unidade.bloco}
                              </Text>
                            ) : null}
                            <Text style={styles.unidadeCardLinha}>
                              Apartamento: {unidade.numero}
                            </Text>
                            <Text style={styles.unidadeCardMoradores}>
                              {nomesMoradores || 'Nenhum morador vinculado.'}
                            </Text>
                          </View>

                          {!modoSelecao ? (
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={light.textMuted}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          : null}
      </ScrollView>

      {/* Barra fixa inferior do modo de seleção — edge-to-edge, sem raio,
          mesmo espírito da barra de navegação inferior do app. */}
      {modoSelecao && unidadesSelecionadas.size > 0 ? (
        <View
          style={[
            styles.barraSelecao,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          {confirmandoExclusaoEmMassa ? (
            <View style={styles.confirmacaoMassa}>
              <Text style={styles.confirmacaoMassaTexto}>
                Excluir {unidadesSelecionadas.size} unidade
                {unidadesSelecionadas.size === 1 ? '' : 's'}? Moradores, pets e
                dependentes vinculados também serão removidos.
              </Text>
              {erroExclusaoEmMassa ? (
                <Text style={styles.erro}>{erroExclusaoEmMassa}</Text>
              ) : null}
              <View style={styles.confirmacaoMassaBotoes}>
                <Pressable
                  style={styles.menuConfirmacaoBotaoCancelar}
                  onPress={() => setConfirmandoExclusaoEmMassa(false)}
                >
                  <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.menuConfirmacaoBotaoExcluir}
                  onPress={handleExcluirSelecionadas}
                  disabled={excluindoEmMassa}
                >
                  <Text style={styles.menuConfirmacaoBotaoExcluirTexto}>
                    {excluindoEmMassa ? 'Excluindo…' : 'Excluir selecionadas'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.barraSelecaoRow}>
              <Text style={styles.barraSelecaoTexto}>
                {unidadesSelecionadas.size} selecionada
                {unidadesSelecionadas.size === 1 ? '' : 's'}
              </Text>
              <View style={styles.barraSelecaoBotoes}>
                <Pressable
                  style={styles.botaoCancelarSelecao}
                  onPress={alternarModoSelecao}
                >
                  <Text style={styles.botaoCancelarSelecaoTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.botaoExcluirSelecao}
                  onPress={() => setConfirmandoExclusaoEmMassa(true)}
                >
                  <Text style={styles.botaoExcluirSelecaoTexto}>
                    Excluir selecionadas
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : null}

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

      {/* Modal de detalhe da unidade — Unidade / Moradores / Pets /
          Dependentes, tudo num só lugar, edição sempre inline. */}
      <Modal
        visible={detalheVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharDetalhe}
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
              {detalheUnidade ? formatarUnidade(detalheUnidade) : ''}
            </Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharDetalhe}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
          </View>

          {detalheUnidade ? (
            <>
              <ScrollView
                contentContainerStyle={styles.corpoModal}
                keyboardShouldPersistTaps="handled"
              >
                {erroDetalhe ? (
                  <Text style={styles.erro}>{erroDetalhe}</Text>
                ) : null}

                {/* Seção Unidade */}
                <View style={styles.secaoDetalhe}>
                  <Text style={styles.secaoDetalheTitulo}>Unidade</Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>Bloco</Text>
                    <TextInput
                      value={detalheBloco}
                      onChangeText={setDetalheBloco}
                      placeholder="Bloco (opcional)"
                      placeholderTextColor={light.textSecondary}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Número</Text>
                    <TextInput
                      value={detalheNumero}
                      onChangeText={setDetalheNumero}
                      placeholder="Número"
                      placeholderTextColor={light.textSecondary}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Observações</Text>
                    <TextInput
                      value={detalheObservacoes}
                      onChangeText={setDetalheObservacoes}
                      placeholder="Observações (opcional)"
                      placeholderTextColor={light.textSecondary}
                      multiline
                      numberOfLines={3}
                      style={[styles.input, styles.inputMultiline]}
                    />
                  </View>

                  <Pressable
                    style={[
                      styles.botaoSalvar,
                      (salvandoDetalheUnidade || !detalheNumero.trim()) &&
                        styles.botaoSalvarDesabilitado,
                    ]}
                    onPress={handleSalvarDetalheUnidade}
                    disabled={salvandoDetalheUnidade || !detalheNumero.trim()}
                  >
                    <Text style={styles.botaoSalvarTexto}>
                      {salvandoDetalheUnidade ? 'Salvando…' : 'Salvar'}
                    </Text>
                  </Pressable>
                </View>

                {/* Seção Moradores */}
                <View style={styles.secaoDetalhe}>
                  <Text style={styles.secaoDetalheTitulo}>Moradores</Text>

                  {detalheUnidade.moradores.length === 0 &&
                  !adicionandoMorador ? (
                    <Text style={styles.unidadeVazio}>
                      Nenhum morador vinculado.
                    </Text>
                  ) : null}

                  <View style={styles.listaDetalheItens}>
                    {detalheUnidade.moradores.map((morador) => {
                      if (editandoMoradorId === morador.id) {
                        return (
                          <View key={morador.id} style={styles.itemEditForm}>
                            <View style={styles.field}>
                              <Text style={styles.label}>Nome</Text>
                              <TextInput
                                value={editMoradorNome}
                                onChangeText={setEditMoradorNome}
                                placeholder="Nome"
                                placeholderTextColor={light.textSecondary}
                                style={styles.input}
                              />
                            </View>
                            <View style={styles.field}>
                              <Text style={styles.label}>Telefone</Text>
                              <TextInput
                                value={editMoradorTelefone}
                                onChangeText={setEditMoradorTelefone}
                                placeholder="Telefone (opcional)"
                                placeholderTextColor={light.textSecondary}
                                keyboardType="phone-pad"
                                style={styles.input}
                              />
                            </View>
                            <View style={styles.field}>
                              <Text style={styles.label}>CPF</Text>
                              <TextInput
                                value={editMoradorCpf}
                                onChangeText={setEditMoradorCpf}
                                placeholder="CPF (opcional)"
                                placeholderTextColor={light.textSecondary}
                                keyboardType="numeric"
                                style={styles.input}
                              />
                            </View>
                            <View style={styles.field}>
                              <Text style={styles.label}>
                                Data de nascimento
                              </Text>
                              <Pressable
                                style={styles.campoData}
                                onPress={() => setCalendarioAlvo('morador')}
                              >
                                <Text
                                  style={
                                    editMoradorDataNascimento
                                      ? styles.campoDataTexto
                                      : styles.campoDataTextoPlaceholder
                                  }
                                >
                                  {editMoradorDataNascimento
                                    ? formatarDataBR(editMoradorDataNascimento)
                                    : 'Selecionar data (opcional)'}
                                </Text>
                              </Pressable>
                            </View>
                            <View style={styles.modalBotoes}>
                              <Pressable
                                style={[
                                  styles.modalBotao,
                                  styles.modalBotaoCancelar,
                                ]}
                                onPress={fecharEditarMorador}
                              >
                                <Text style={styles.modalBotaoCancelarTexto}>
                                  Cancelar
                                </Text>
                              </Pressable>
                              <Pressable
                                style={[
                                  styles.modalBotao,
                                  styles.modalBotaoSalvar,
                                  (salvandoEdicaoMorador ||
                                    !editMoradorNome.trim()) &&
                                    styles.botaoSalvarDesabilitado,
                                ]}
                                onPress={handleSalvarEdicaoMorador}
                                disabled={
                                  salvandoEdicaoMorador ||
                                  !editMoradorNome.trim()
                                }
                              >
                                <Text style={styles.modalBotaoSalvarTexto}>
                                  {salvandoEdicaoMorador
                                    ? 'Salvando…'
                                    : 'Salvar'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      }

                      const idade = calcularIdade(morador.data_nascimento);

                      return (
                        <View key={morador.id} style={styles.itemLinha}>
                          <View style={styles.itemTextos}>
                            <View style={styles.moradorNomeRow}>
                              <Text
                                style={[
                                  styles.itemNome,
                                  !morador.ativo && styles.itemNomeInativo,
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
                            {morador.telefone ? (
                              <Text style={styles.itemDetalhe}>
                                {morador.telefone}
                              </Text>
                            ) : null}
                            {morador.cpf ? (
                              <Text style={styles.itemDetalhe}>
                                CPF: {morador.cpf}
                              </Text>
                            ) : null}
                            {morador.data_nascimento ? (
                              <Text style={styles.itemDetalhe}>
                                {formatarDataBR(morador.data_nascimento)}
                                {idade !== null
                                  ? ` · ${formatarIdade(idade)}`
                                  : ''}
                              </Text>
                            ) : null}
                          </View>

                          {confirmandoExclusaoMoradorId === morador.id ? (
                            <View style={styles.confirmacaoInlineItem}>
                              <Text style={styles.confirmacaoInlineTexto}>
                                Excluir?
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setConfirmandoExclusaoMoradorId(null)
                                }
                              >
                                <Text style={styles.acaoItemTexto}>
                                  Cancelar
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleExcluirMorador(morador)}
                                disabled={excluindoMoradorId === morador.id}
                              >
                                <Text style={styles.acaoItemExcluirTexto}>
                                  {excluindoMoradorId === morador.id
                                    ? 'Excluindo…'
                                    : 'Excluir'}
                                </Text>
                              </Pressable>
                            </View>
                          ) : (
                            <View style={styles.acoesItem}>
                              <Pressable
                                onPress={() => abrirEditarMorador(morador)}
                              >
                                <Text style={styles.acaoItemTexto}>Editar</Text>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  handleAlternarStatusMorador(morador)
                                }
                                disabled={
                                  alterandoStatusMoradorId === morador.id
                                }
                              >
                                <Text style={styles.acaoItemTexto}>
                                  {alterandoStatusMoradorId === morador.id
                                    ? 'Aguarde…'
                                    : morador.ativo
                                      ? 'Desativar'
                                      : 'Reativar'}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  setConfirmandoExclusaoMoradorId(morador.id)
                                }
                              >
                                <Text style={styles.acaoItemExcluirTexto}>
                                  Excluir
                                </Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {adicionandoMorador ? (
                    <View style={styles.itemEditForm}>
                      <View style={styles.field}>
                        <Text style={styles.label}>Nome</Text>
                        <TextInput
                          value={novoMoradorNome}
                          onChangeText={setNovoMoradorNome}
                          placeholder="Nome do morador"
                          placeholderTextColor={light.textSecondary}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.label}>Telefone</Text>
                        <TextInput
                          value={novoMoradorTelefone}
                          onChangeText={setNovoMoradorTelefone}
                          placeholder="Telefone (opcional)"
                          placeholderTextColor={light.textSecondary}
                          keyboardType="phone-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.modalBotoes}>
                        <Pressable
                          style={[styles.modalBotao, styles.modalBotaoCancelar]}
                          onPress={() => setAdicionandoMorador(false)}
                        >
                          <Text style={styles.modalBotaoCancelarTexto}>
                            Cancelar
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.modalBotao,
                            styles.modalBotaoSalvar,
                            (salvandoNovoMorador || !novoMoradorNome.trim()) &&
                              styles.botaoSalvarDesabilitado,
                          ]}
                          onPress={handleSalvarNovoMorador}
                          disabled={
                            salvandoNovoMorador || !novoMoradorNome.trim()
                          }
                        >
                          <Text style={styles.modalBotaoSalvarTexto}>
                            {salvandoNovoMorador ? 'Salvando…' : 'Adicionar'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.botaoAdicionarItem}
                      onPress={abrirAdicionarMorador}
                    >
                      <Text style={styles.botaoAdicionarItemTexto}>
                        + Adicionar morador
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Seção Pets */}
                <View style={styles.secaoDetalhe}>
                  <Text style={styles.secaoDetalheTitulo}>Pets</Text>

                  {detalheUnidade.pets.length === 0 && !adicionandoPet ? (
                    <Text style={styles.unidadeVazio}>
                      Nenhum pet vinculado.
                    </Text>
                  ) : null}

                  <View style={styles.listaDetalheItens}>
                    {detalheUnidade.pets.map((pet) => (
                      <View key={pet.id} style={styles.itemLinha}>
                        <View style={styles.itemTextos}>
                          <Text style={styles.itemNome}>{pet.nome}</Text>
                          <Text style={styles.itemDetalhe}>{pet.especie}</Text>
                        </View>

                        {confirmandoExclusaoPetId === pet.id ? (
                          <View style={styles.confirmacaoInlineItem}>
                            <Text style={styles.confirmacaoInlineTexto}>
                              Excluir?
                            </Text>
                            <Pressable
                              onPress={() => setConfirmandoExclusaoPetId(null)}
                            >
                              <Text style={styles.acaoItemTexto}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleExcluirPet(pet)}
                              disabled={excluindoPetId === pet.id}
                            >
                              <Text style={styles.acaoItemExcluirTexto}>
                                {excluindoPetId === pet.id
                                  ? 'Excluindo…'
                                  : 'Excluir'}
                              </Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => setConfirmandoExclusaoPetId(pet.id)}
                          >
                            <Text style={styles.acaoItemExcluirTexto}>
                              Excluir
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>

                  {adicionandoPet ? (
                    <View style={styles.itemEditForm}>
                      <View style={styles.field}>
                        <Text style={styles.label}>Nome</Text>
                        <TextInput
                          value={novoPetNome}
                          onChangeText={setNovoPetNome}
                          placeholder="Nome do pet"
                          placeholderTextColor={light.textSecondary}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.label}>Espécie</Text>
                        <TextInput
                          value={novoPetEspecie}
                          onChangeText={setNovoPetEspecie}
                          placeholder="Ex: Cachorro, Gato"
                          placeholderTextColor={light.textSecondary}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.modalBotoes}>
                        <Pressable
                          style={[styles.modalBotao, styles.modalBotaoCancelar]}
                          onPress={() => setAdicionandoPet(false)}
                        >
                          <Text style={styles.modalBotaoCancelarTexto}>
                            Cancelar
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.modalBotao,
                            styles.modalBotaoSalvar,
                            (salvandoNovoPet ||
                              !novoPetNome.trim() ||
                              !novoPetEspecie.trim()) &&
                              styles.botaoSalvarDesabilitado,
                          ]}
                          onPress={handleSalvarNovoPet}
                          disabled={
                            salvandoNovoPet ||
                            !novoPetNome.trim() ||
                            !novoPetEspecie.trim()
                          }
                        >
                          <Text style={styles.modalBotaoSalvarTexto}>
                            {salvandoNovoPet ? 'Salvando…' : 'Adicionar'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.botaoAdicionarItem}
                      onPress={abrirAdicionarPet}
                    >
                      <Text style={styles.botaoAdicionarItemTexto}>
                        + Adicionar pet
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Seção Dependentes */}
                <View style={styles.secaoDetalhe}>
                  <Text style={styles.secaoDetalheTitulo}>Dependentes</Text>

                  {detalheUnidade.dependentes.length === 0 &&
                  !adicionandoDependente ? (
                    <Text style={styles.unidadeVazio}>
                      Nenhum dependente vinculado.
                    </Text>
                  ) : null}

                  <View style={styles.listaDetalheItens}>
                    {detalheUnidade.dependentes.map((dependente) => {
                      const idade = calcularIdade(dependente.data_nascimento);
                      return (
                        <View key={dependente.id} style={styles.itemLinha}>
                          <View style={styles.itemTextos}>
                            <Text style={styles.itemNome}>
                              {dependente.nome}
                            </Text>
                            {idade !== null ? (
                              <Text style={styles.itemDetalhe}>
                                {formatarIdade(idade)}
                              </Text>
                            ) : null}
                          </View>

                          {confirmandoExclusaoDependenteId === dependente.id ? (
                            <View style={styles.confirmacaoInlineItem}>
                              <Text style={styles.confirmacaoInlineTexto}>
                                Excluir?
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setConfirmandoExclusaoDependenteId(null)
                                }
                              >
                                <Text style={styles.acaoItemTexto}>
                                  Cancelar
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  handleExcluirDependente(dependente)
                                }
                                disabled={
                                  excluindoDependenteId === dependente.id
                                }
                              >
                                <Text style={styles.acaoItemExcluirTexto}>
                                  {excluindoDependenteId === dependente.id
                                    ? 'Excluindo…'
                                    : 'Excluir'}
                                </Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() =>
                                setConfirmandoExclusaoDependenteId(
                                  dependente.id,
                                )
                              }
                            >
                              <Text style={styles.acaoItemExcluirTexto}>
                                Excluir
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {adicionandoDependente ? (
                    <View style={styles.itemEditForm}>
                      <View style={styles.field}>
                        <Text style={styles.label}>Nome</Text>
                        <TextInput
                          value={novoDependenteNome}
                          onChangeText={setNovoDependenteNome}
                          placeholder="Nome do dependente"
                          placeholderTextColor={light.textSecondary}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.label}>Data de nascimento</Text>
                        <Pressable
                          style={styles.campoData}
                          onPress={() => setCalendarioAlvo('dependente')}
                        >
                          <Text
                            style={
                              novoDependenteDataNascimento
                                ? styles.campoDataTexto
                                : styles.campoDataTextoPlaceholder
                            }
                          >
                            {novoDependenteDataNascimento
                              ? formatarDataBR(novoDependenteDataNascimento)
                              : 'Selecionar data (opcional)'}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.modalBotoes}>
                        <Pressable
                          style={[styles.modalBotao, styles.modalBotaoCancelar]}
                          onPress={() => setAdicionandoDependente(false)}
                        >
                          <Text style={styles.modalBotaoCancelarTexto}>
                            Cancelar
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.modalBotao,
                            styles.modalBotaoSalvar,
                            (salvandoNovoDependente ||
                              !novoDependenteNome.trim()) &&
                              styles.botaoSalvarDesabilitado,
                          ]}
                          onPress={handleSalvarNovoDependente}
                          disabled={
                            salvandoNovoDependente || !novoDependenteNome.trim()
                          }
                        >
                          <Text style={styles.modalBotaoSalvarTexto}>
                            {salvandoNovoDependente ? 'Salvando…' : 'Adicionar'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.botaoAdicionarItem}
                      onPress={abrirAdicionarDependente}
                    >
                      <Text style={styles.botaoAdicionarItemTexto}>
                        + Adicionar dependente
                      </Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>

              <View
                style={[
                  styles.rodapeModal,
                  { paddingBottom: insets.bottom + spacing.md },
                ]}
              >
                {confirmandoExclusaoUnidade ? (
                  <View style={styles.confirmacaoExclusaoUnidade}>
                    <Text style={styles.menuConfirmacaoTexto}>
                      Excluir esta unidade? Moradores, pets e dependentes
                      vinculados também serão removidos.
                    </Text>
                    <View style={styles.menuConfirmacaoBotoes}>
                      <Pressable
                        style={styles.menuConfirmacaoBotaoCancelar}
                        onPress={() => setConfirmandoExclusaoUnidade(false)}
                      >
                        <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>
                          Cancelar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.menuConfirmacaoBotaoExcluir}
                        onPress={handleExcluirDetalheUnidade}
                        disabled={excluindoUnidadeDetalhe}
                      >
                        <Text style={styles.menuConfirmacaoBotaoExcluirTexto}>
                          {excluindoUnidadeDetalhe ? 'Excluindo…' : 'Excluir'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={styles.botaoExcluirUnidade}
                    onPress={() => setConfirmandoExclusaoUnidade(true)}
                  >
                    <Text style={styles.botaoExcluirUnidadeTexto}>
                      Excluir unidade
                    </Text>
                  </Pressable>
                )}
              </View>

              {calendarioNascimentoOverlay}
            </>
          ) : null}
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
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  selecaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  selecionarTodosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selecionarTodosTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textPrimary,
  },
  selecionarLink: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.inkAction,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.card,
  },
  checkboxSelecionado: {
    backgroundColor: light.inkAction,
    borderColor: light.inkAction,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.lg,
  },
  bodyComBarraSelecao: {
    paddingBottom: 140,
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
  // em app/admin/ambientes.tsx. Card inteiro é Pressable: toca para abrir o
  // detalhe (ou marcar/desmarcar no modo de seleção).
  unidadeCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  unidadeCardPressionado: {
    backgroundColor: light.sunken,
  },
  unidadeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unidadeCardTextos: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  unidadeCardLinha: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  unidadeCardMoradores: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
    marginTop: spacing.xs / 2,
  },
  unidadeVazio: {
    fontFamily: fonts.regular,
    fontSize: 13,
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
  menuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuItemTexto: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
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
  // Barra fixa do modo de seleção — edge-to-edge, sem raio, mesmo espírito
  // da barra de navegação inferior (regra fixa do design system).
  barraSelecao: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: light.card,
    borderTopWidth: 1,
    borderTopColor: light.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  barraSelecaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barraSelecaoTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  barraSelecaoBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botaoCancelarSelecao: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoCancelarSelecaoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  botaoExcluirSelecao: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: semantic.overdue,
  },
  botaoExcluirSelecaoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  confirmacaoMassa: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  confirmacaoMassaTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textPrimary,
  },
  confirmacaoMassaBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  // Seções do detalhe (Unidade / Moradores / Pets / Dependentes).
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  itemTextos: {
    flex: 1,
    gap: 2,
  },
  itemNome: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  itemNomeInativo: {
    color: light.textMuted,
  },
  itemDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  moradorNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acoesItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  confirmacaoInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmacaoInlineTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textPrimary,
  },
  itemEditForm: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoAdicionarItem: {
    paddingVertical: spacing.xs,
  },
  botaoAdicionarItemTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.inkAction,
  },
  botaoExcluirUnidade: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.overdue,
  },
  botaoExcluirUnidadeTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: semantic.overdue,
  },
  confirmacaoExclusaoUnidade: {
    gap: spacing.sm,
  },
  campoData: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  campoDataTexto: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  campoDataTextoPlaceholder: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textSecondary,
  },
  // Overlay de calendário — INLINE dentro do modal de detalhe, nunca um
  // <Modal> próprio empilhado (mesmo motivo documentado em
  // app/admin/preservacao.tsx: RN não lida bem com dois Modal visíveis).
  novaRotaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
    zIndex: 20,
    elevation: 20,
  },
  modalRotaCard: {
    backgroundColor: light.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: light.textPrimary,
    marginBottom: spacing.xs,
  },
  modalBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalBotao: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  modalBotaoCancelar: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  modalBotaoCancelarTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  modalBotaoSalvar: {
    backgroundColor: light.inkAction,
  },
  modalBotaoSalvarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
