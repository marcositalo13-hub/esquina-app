import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { AdiarAcao } from '../../src/components/AdiarAcao';
import { type AnchorPosition, CardMenu } from '../../src/components/CardMenu';
import { Chip } from '../../src/components/Chip';
import {
  type DiaMarcado,
  MiniCalendar,
} from '../../src/components/MiniCalendar';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { StatusBadge } from '../../src/components/StatusBadge';
import {
  adicionarDiasChave,
  formatarDataBR,
  formatarDuracao,
  gerarDatasOcorrencia,
  getCorPrioridade,
  hojeLocal,
  JANELA_DIAS,
  type OrdemServico,
  PERIODICIDADES,
  type Periodicidade,
  type PlanoManutencao,
  PRIORIDADES,
  type Prioridade,
  type Rota,
  type TipoAtividade,
} from '../../src/data/manutencao';
import { supabase } from '../../src/lib/supabase';
import { preencherOcorrenciasFaltantes } from '../../src/lib/topUpOcorrencias';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

const hoje = hojeLocal;

type DateFilter = 'hoje' | 'todas';

export default function AdminPreservacao() {
  const insets = useSafeAreaInsets();

  const [planos, setPlanos] = useState<PlanoManutencao[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [tiposAtivos, setTiposAtivos] = useState<TipoAtividade[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [calendarioFiltrosAberto, setCalendarioFiltrosAberto] = useState(false);
  const [planosAbertos, setPlanosAbertos] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [atrasadasFiltro, setAtrasadasFiltro] = useState(false);
  const [tipoFiltros, setTipoFiltros] = useState<string[]>([]);
  const [prioridadeFiltros, setPrioridadeFiltros] = useState<Prioridade[]>([]);
  const [periodicidadeFiltros, setPeriodicidadeFiltros] = useState<
    Periodicidade[]
  >([]);

  const [atualizandoOrdemId, setAtualizandoOrdemId] = useState<string | null>(
    null,
  );
  const [rotasExpandidas, setRotasExpandidas] = useState<Set<string>>(
    () => new Set(),
  );
  const [menuAtividadeAbertaId, setMenuAtividadeAbertaId] = useState<
    string | null
  >(null);
  const [menuAtividadeEtapa, setMenuAtividadeEtapa] = useState<
    'opcoes' | 'confirmarExclusao'
  >('opcoes');
  const [menuAtividadeAncora, setMenuAtividadeAncora] =
    useState<AnchorPosition>({ x: 0, y: 0 });
  const menuAtividadeIconRefs = useRef<Map<string, View>>(new Map());

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [menuEtapa, setMenuEtapa] = useState<'opcoes' | 'confirmarExclusao'>(
    'opcoes',
  );
  const [menuAncora, setMenuAncora] = useState<AnchorPosition>({ x: 0, y: 0 });
  const menuIconRefs = useRef<Map<string, View>>(new Map());

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('Mensal');
  const [prioridade, setPrioridade] = useState<Prioridade>('Média');
  const [dataInicio, setDataInicio] = useState(() => hoje());
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [ordemNaRota, setOrdemNaRota] = useState('');
  const [ordemNaRotaEditadoManualmente, setOrdemNaRotaEditadoManualmente] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const [modalRotaVisivel, setModalRotaVisivel] = useState(false);
  const [nomeNovaRota, setNomeNovaRota] = useState('');
  const [criandoRota, setCriandoRota] = useState(false);
  const [erroModalRota, setErroModalRota] = useState<string | null>(null);
  // Qual fluxo abriu "Nova rota" — decide onde a rota recém-criada deve ser
  // selecionada automaticamente ao ser criada (ver handleCriarRota).
  const [origemNovaRota, setOrigemNovaRota] = useState<'plano' | 'atribuir'>(
    'plano',
  );

  const [modalAtribuirRotaVisivel, setModalAtribuirRotaVisivel] =
    useState(false);
  const [planoAtribuirRotaId, setPlanoAtribuirRotaId] = useState<string | null>(
    null,
  );
  const [rotaOriginalAtribuir, setRotaOriginalAtribuir] = useState<
    string | null
  >(null);
  const [rotaSelecionadaAtribuir, setRotaSelecionadaAtribuir] = useState<
    string | null
  >(null);
  const [atribuindoRota, setAtribuindoRota] = useState(false);
  const [erroAtribuirRota, setErroAtribuirRota] = useState<string | null>(null);

  const [modoSelecaoPlanos, setModoSelecaoPlanos] = useState(false);
  const [planosSelecionados, setPlanosSelecionados] = useState<Set<string>>(
    () => new Set(),
  );

  const [modalEdicaoEmMassaVisivel, setModalEdicaoEmMassaVisivel] =
    useState(false);
  // 'manter' = "Não alterar" — o campo não é tocado no UPDATE.
  const [tipoEdicaoMassa, setTipoEdicaoMassa] = useState<'manter' | string>(
    'manter',
  );
  const [rotaEdicaoMassa, setRotaEdicaoMassa] = useState<
    'manter' | string | null
  >('manter');
  const [prioridadeEdicaoMassa, setPrioridadeEdicaoMassa] = useState<
    'manter' | Prioridade
  >('manter');
  const [aplicandoEdicaoMassa, setAplicandoEdicaoMassa] = useState(false);
  const [erroEdicaoMassa, setErroEdicaoMassa] = useState<string | null>(null);

  const [modalReprovarVisivel, setModalReprovarVisivel] = useState(false);
  const [ordemReprovarId, setOrdemReprovarId] = useState<string | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [reprovando, setReprovando] = useState(false);
  const [erroReprovar, setErroReprovar] = useState<string | null>(null);

  const carregarPlanos = useCallback(async () => {
    const { data, error } = await supabase
      .from('planos_manutencao')
      .select('*, tipos_atividade(*), rotas(*)')
      .order('created_at', { ascending: false });

    if (error) {
      setErroLista(error.message);
      return;
    }

    setErroLista(null);
    setPlanos((data ?? []) as PlanoManutencao[]);
  }, []);

  const carregarOrdens = useCallback(async () => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))');

    if (!error) {
      setOrdens((data ?? []) as OrdemServico[]);
    }
  }, []);

  const carregarTipos = useCallback(async () => {
    const { data, error } = await supabase
      .from('tipos_atividade')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (!error) {
      setTiposAtivos((data ?? []) as TipoAtividade[]);
      if (data && data.length > 0) {
        setTipoId((atual) => atual ?? data[0].id);
      }
    }
  }, []);

  const carregarRotas = useCallback(async () => {
    const { data, error } = await supabase
      .from('rotas')
      .select('*')
      .order('nome', { ascending: true });

    if (!error) {
      setRotas((data ?? []) as Rota[]);
    }
  }, []);

  const carregarTudo = useCallback(async () => {
    await Promise.all([carregarPlanos(), carregarOrdens()]);
  }, [carregarPlanos, carregarOrdens]);

  useEffect(() => {
    setCarregando(true);
    Promise.all([
      carregarPlanos(),
      carregarTipos(),
      carregarOrdens(),
      carregarRotas(),
    ]).finally(() => {
      setCarregando(false);
      // Top-up silencioso: roda depois do primeiro carregamento, sem
      // bloquear a tela; só recarrega as ordens ao terminar.
      preencherOcorrenciasFaltantes().then(() => {
        carregarOrdens();
      });
    });
  }, [carregarPlanos, carregarTipos, carregarOrdens, carregarRotas]);

  // Calendário: marca TODAS as ordens, sem aplicar nenhum filtro ativo.
  const markedDates = useMemo(() => {
    const hojeStr = hoje();
    const mapa: Record<string, DiaMarcado> = {};

    for (const ordem of ordens) {
      const atrasada =
        ordem.status !== 'concluida' && ordem.data_prevista < hojeStr;

      if (atrasada) {
        mapa[ordem.data_prevista] = 'atrasado';
      } else if (!mapa[ordem.data_prevista]) {
        mapa[ordem.data_prevista] = 'normal';
      }
    }

    return mapa;
  }, [ordens]);

  // Ordens de hoje, para a seção "Atividades do dia" — sem aplicar os
  // filtros de tipo/prioridade/periodicidade/atrasadas.
  const atividadesDoDia = useMemo(() => {
    const hojeStr = hoje();
    return ordens.filter((o) => o.data_prevista === hojeStr);
  }, [ordens]);

  // Agrupa as atividades de hoje por rota (ordenadas por ordem_na_rota).
  // Atividades sem rota ficam soltas em semRota.
  const atividadesAgrupadas = useMemo(() => {
    const grupos = new Map<string, { rota: Rota; itens: OrdemServico[] }>();
    const semRota: OrdemServico[] = [];

    for (const ordem of atividadesDoDia) {
      const plano = ordem.planos_manutencao;
      const rota = plano?.rotas;

      if (plano?.rota_id && rota) {
        const grupo = grupos.get(plano.rota_id);
        if (grupo) {
          grupo.itens.push(ordem);
        } else {
          grupos.set(plano.rota_id, { rota, itens: [ordem] });
        }
      } else {
        semRota.push(ordem);
      }
    }

    for (const grupo of grupos.values()) {
      grupo.itens.sort((a, b) => {
        const ordemA = a.planos_manutencao?.ordem_na_rota ?? 0;
        const ordemB = b.planos_manutencao?.ordem_na_rota ?? 0;
        return ordemA - ordemB;
      });
    }

    return { grupos: Array.from(grupos.values()), semRota };
  }, [atividadesDoDia]);

  // Planos com ao menos uma ordem pendente/em andamento e atrasada (para o
  // chip "Atrasadas" e para o badge nos chips de Tipo).
  const planoIdsAtrasados = useMemo(() => {
    const hojeStr = hoje();
    const ids = new Set<string>();

    for (const ordem of ordens) {
      if (ordem.status !== 'concluida' && ordem.data_prevista < hojeStr) {
        ids.add(ordem.plano_id);
      }
    }

    return ids;
  }, [ordens]);

  // Planos com ao menos uma ordem prevista para o dia selecionado no
  // calendário. null quando nenhum dia está selecionado.
  const planoIdsNaDataSelecionada = useMemo(() => {
    if (!selectedDate) {
      return null;
    }

    const ids = new Set<string>();
    for (const ordem of ordens) {
      if (ordem.data_prevista === selectedDate) {
        ids.add(ordem.plano_id);
      }
    }

    return ids;
  }, [ordens, selectedDate]);

  // Chips de tipo/prioridade/periodicidade/atrasadas + dia selecionado
  // filtram a lista de planos. O alternador Hoje/Todas NUNCA entra aqui —
  // só afeta a barra de progresso (exceto quando um dia está selecionado,
  // caso em que ele fica desabilitado e a data escolhida vale para os dois).
  const planosFiltrados = useMemo(() => {
    return planos.filter((plano) => {
      if (tipoFiltros.length > 0 && !tipoFiltros.includes(plano.tipo_id)) {
        return false;
      }
      if (
        prioridadeFiltros.length > 0 &&
        !prioridadeFiltros.includes(plano.prioridade)
      ) {
        return false;
      }
      if (
        periodicidadeFiltros.length > 0 &&
        !periodicidadeFiltros.includes(plano.periodicidade)
      ) {
        return false;
      }
      if (atrasadasFiltro && !planoIdsAtrasados.has(plano.id)) {
        return false;
      }
      if (
        planoIdsNaDataSelecionada &&
        !planoIdsNaDataSelecionada.has(plano.id)
      ) {
        return false;
      }
      return true;
    });
  }, [
    planos,
    tipoFiltros,
    prioridadeFiltros,
    periodicidadeFiltros,
    atrasadasFiltro,
    planoIdsAtrasados,
    planoIdsNaDataSelecionada,
  ]);

  // Barra de progresso: mesmos filtros da lista, mais o escopo de data —
  // dia selecionado no calendário tem precedência sobre o alternador
  // Hoje/Todas (que só entra em jogo quando nenhum dia está selecionado).
  const progresso = useMemo(() => {
    const hojeStr = hoje();

    const filtradas = ordens.filter((ordem) => {
      if (selectedDate) {
        if (ordem.data_prevista !== selectedDate) {
          return false;
        }
      } else if (dateFilter === 'hoje' && ordem.data_prevista !== hojeStr) {
        return false;
      }

      if (
        atrasadasFiltro &&
        !(ordem.status !== 'concluida' && ordem.data_prevista < hojeStr)
      ) {
        return false;
      }

      const plano = ordem.planos_manutencao;

      if (
        tipoFiltros.length > 0 &&
        (!plano || !tipoFiltros.includes(plano.tipo_id))
      ) {
        return false;
      }

      if (
        prioridadeFiltros.length > 0 &&
        (!plano || !prioridadeFiltros.includes(plano.prioridade))
      ) {
        return false;
      }

      if (
        periodicidadeFiltros.length > 0 &&
        (!plano || !periodicidadeFiltros.includes(plano.periodicidade))
      ) {
        return false;
      }

      return true;
    });

    const concluidas = filtradas.filter((o) => o.status === 'concluida').length;
    const atrasadas = filtradas.filter(
      (o) => o.status !== 'concluida' && o.data_prevista < hojeStr,
    ).length;
    const pendentes = filtradas.filter(
      (o) => o.status !== 'concluida' && o.data_prevista >= hojeStr,
    ).length;

    return { total: filtradas.length, concluidas, pendentes, atrasadas };
  }, [
    ordens,
    dateFilter,
    selectedDate,
    atrasadasFiltro,
    tipoFiltros,
    prioridadeFiltros,
    periodicidadeFiltros,
  ]);

  // Badge do chip de Tipo: deriva da mesma lista de ordens já carregada,
  // sem nova consulta — atraso independe dos filtros ativos no momento.
  const tiposComAtraso = useMemo(() => {
    const hojeStr = hoje();
    const ids = new Set<string>();

    for (const ordem of ordens) {
      if (ordem.status !== 'concluida' && ordem.data_prevista < hojeStr) {
        const idTipo = ordem.planos_manutencao?.tipo_id;
        if (idTipo) {
          ids.add(idTipo);
        }
      }
    }

    return ids;
  }, [ordens]);

  // Ocorrência pendente mais próxima de um plano — usada por Concluir/Adiar
  // no menu de "Todos os planos cadastrados" (que representa o plano, não
  // uma ordem específica).
  function encontrarProximaOrdemPendente(planoId: string): OrdemServico | null {
    let proxima: OrdemServico | null = null;

    for (const ordem of ordens) {
      if (ordem.plano_id !== planoId || ordem.status !== 'pendente') {
        continue;
      }
      if (!proxima || ordem.data_prevista < proxima.data_prevista) {
        proxima = ordem;
      }
    }

    return proxima;
  }

  function handleSelecionarDia(data: string) {
    setSelectedDate((atual) => (atual === data ? null : data));
  }

  function toggleTipoFiltro(id: string) {
    setTipoFiltros((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  function togglePrioridadeFiltro(item: Prioridade) {
    setPrioridadeFiltros((atual) =>
      atual.includes(item) ? atual.filter((x) => x !== item) : [...atual, item],
    );
  }

  function togglePeriodicidadeFiltro(item: Periodicidade) {
    setPeriodicidadeFiltros((atual) =>
      atual.includes(item) ? atual.filter((x) => x !== item) : [...atual, item],
    );
  }

  function toggleRotaExpandida(rotaId: string) {
    setRotasExpandidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(rotaId)) {
        novo.delete(rotaId);
      } else {
        novo.add(rotaId);
      }
      return novo;
    });
  }

  function handleAbrirMenuAtividade(id: string) {
    if (menuAtividadeAbertaId === id) {
      fecharMenuAtividade();
      return;
    }

    const ref = menuAtividadeIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _width, height) => {
      setMenuAtividadeAncora({ x, y: y + height });
      setMenuAtividadeAbertaId(id);
      setMenuAtividadeEtapa('opcoes');
    });
  }

  function fecharMenuAtividade() {
    setMenuAtividadeAbertaId(null);
    setMenuAtividadeEtapa('opcoes');
  }

  function handleMenuAtividadePedirConfirmacaoExclusao() {
    setMenuAtividadeEtapa('confirmarExclusao');
  }

  async function handleConcluirOrdem(ordemId: string) {
    setAtualizandoOrdemId(ordemId);

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        concluida_por: 'Teste Preservação',
      })
      .eq('id', ordemId);

    setAtualizandoOrdemId(null);

    if (error) {
      setErroLista(error.message);
      return;
    }

    carregarOrdens();
  }

  async function handleAdiarOrdem(ordemId: string, novaData: string) {
    const { error } = await supabase
      .from('ordens_servico')
      .update({ data_prevista: novaData })
      .eq('id', ordemId);

    if (error) {
      setErroLista(error.message);
      return;
    }

    carregarOrdens();
  }

  function limparFormulario() {
    setTitulo('');
    setDescricao('');
    setLocal('');
    setPeriodicidade('Mensal');
    setPrioridade('Média');
    setDataInicio(hoje());
    setAtivo(true);
    setObservacoes('');
    setRotaId(null);
    setOrdemNaRota('');
    setOrdemNaRotaEditadoManualmente(false);
  }

  function preencherFormulario(plano: PlanoManutencao) {
    setTitulo(plano.titulo);
    setTipoId(plano.tipo_id);
    setDescricao(plano.descricao ?? '');
    setLocal(plano.local ?? '');
    setPeriodicidade(plano.periodicidade);
    setPrioridade(plano.prioridade);
    setDataInicio(plano.data_inicio);
    setAtivo(plano.ativo);
    setObservacoes(plano.observacoes ?? '');
    setRotaId(plano.rota_id);
    setOrdemNaRota(
      plano.ordem_na_rota !== null ? String(plano.ordem_na_rota) : '',
    );
    setOrdemNaRotaEditadoManualmente(plano.ordem_na_rota !== null);
  }

  function handleSelecionarRota(novaRotaId: string | null) {
    setRotaId(novaRotaId);

    if (!novaRotaId) {
      setOrdemNaRota('');
      setOrdemNaRotaEditadoManualmente(false);
      return;
    }

    if (!ordemNaRotaEditadoManualmente) {
      const quantidadeNaRota = planos.filter(
        (p) => p.rota_id === novaRotaId,
      ).length;
      setOrdemNaRota(String(quantidadeNaRota + 1));
    }
  }

  function handleAlterarOrdemNaRotaManual(valor: string) {
    setOrdemNaRota(valor);
    setOrdemNaRotaEditadoManualmente(true);
  }

  function abrirModalNovo() {
    limparFormulario();
    setEditingId(null);
    setErroModal(null);
    setModalVisivel(true);
  }

  function fecharModal() {
    setModalVisivel(false);
    setEditingId(null);
  }

  function handleEditar(plano: PlanoManutencao) {
    preencherFormulario(plano);
    setEditingId(plano.id);
    setErroModal(null);
    setModalVisivel(true);
  }

  function handleDuplicar(plano: PlanoManutencao) {
    preencherFormulario(plano);
    setTitulo(`${plano.titulo} (cópia)`);
    setEditingId(null);
    setErroModal(null);
    setModalVisivel(true);
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
    });
  }

  function fecharMenu() {
    setMenuAbertoId(null);
    setMenuEtapa('opcoes');
  }

  // Compartilhados entre o menu de "Atividades do dia" e o de "Todos os
  // planos cadastrados" — fecham os dois menus, já que operam sobre o
  // plano independente de onde foram acionados.
  function handleMenuEditar(plano: PlanoManutencao) {
    fecharMenu();
    fecharMenuAtividade();
    handleEditar(plano);
  }

  function handleMenuDuplicar(plano: PlanoManutencao) {
    fecharMenu();
    fecharMenuAtividade();
    handleDuplicar(plano);
  }

  function handleMenuPedirConfirmacaoExclusao() {
    setMenuEtapa('confirmarExclusao');
  }

  async function handleMenuExcluirConfirmar(plano: PlanoManutencao) {
    const { data, error } = await supabase
      .from('planos_manutencao')
      .delete()
      .eq('id', plano.id)
      .select();

    fecharMenu();
    fecharMenuAtividade();

    if (error) {
      setErroLista(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setErroLista(
        'Não foi possível excluir: nenhum registro foi removido. Verifique as permissões de escrita no Supabase.',
      );
      return;
    }

    carregarTudo();
  }

  function abrirModalRota(origem: 'plano' | 'atribuir' = 'plano') {
    setOrigemNovaRota(origem);
    setNomeNovaRota('');
    setErroModalRota(null);
    setModalRotaVisivel(true);
  }

  function fecharModalRota() {
    setModalRotaVisivel(false);
  }

  async function handleCriarRota() {
    if (criandoRota) {
      return;
    }

    if (!nomeNovaRota.trim()) {
      setErroModalRota('Informe o nome da rota.');
      return;
    }

    setCriandoRota(true);
    setErroModalRota(null);

    const { data, error } = await supabase
      .from('rotas')
      .insert({ nome: nomeNovaRota.trim(), ativo: true })
      .select()
      .single();

    setCriandoRota(false);

    if (error || !data) {
      setErroModalRota(error?.message ?? 'Não foi possível criar a rota.');
      return;
    }

    // Única fonte de estado para rotas: qualquer tela/modal que liste rotas
    // lê deste mesmo `rotas`, então esta atualização otimista já reflete em
    // todos os lugares (seletor do modal de plano e lista do modal de
    // atribuição) sem precisar recarregar a página.
    const novaRota = data as Rota;
    setRotas((atual) => [...atual, novaRota]);
    if (origemNovaRota === 'atribuir') {
      setRotaSelecionadaAtribuir(novaRota.id);
    } else {
      handleSelecionarRota(novaRota.id);
    }
    setNomeNovaRota('');
    setModalRotaVisivel(false);
  }

  function abrirModalAtribuirRota(plano: PlanoManutencao) {
    fecharMenu();
    fecharMenuAtividade();
    setPlanoAtribuirRotaId(plano.id);
    setRotaOriginalAtribuir(plano.rota_id);
    setRotaSelecionadaAtribuir(plano.rota_id);
    setErroAtribuirRota(null);
    setModalAtribuirRotaVisivel(true);
  }

  function fecharModalAtribuirRota() {
    setModalAtribuirRotaVisivel(false);
    setPlanoAtribuirRotaId(null);
  }

  async function handleConfirmarAtribuirRota() {
    if (atribuindoRota || !planoAtribuirRotaId) {
      return;
    }

    setAtribuindoRota(true);
    setErroAtribuirRota(null);

    // Só recalcula ordem_na_rota quando a rota selecionada é diferente da
    // rota original do plano — se o usuário manteve a mesma rota, preserva
    // a ordem já existente em vez de empurrar o plano para o fim da lista.
    let ordemNaRotaNovo: number | null = null;
    if (rotaSelecionadaAtribuir) {
      if (rotaSelecionadaAtribuir === rotaOriginalAtribuir) {
        const planoAtual = planos.find((p) => p.id === planoAtribuirRotaId);
        ordemNaRotaNovo = planoAtual?.ordem_na_rota ?? null;
      } else {
        const quantidadeNaRota = planos.filter(
          (p) => p.rota_id === rotaSelecionadaAtribuir,
        ).length;
        ordemNaRotaNovo = quantidadeNaRota + 1;
      }
    }

    const { data, error } = await supabase
      .from('planos_manutencao')
      .update({
        rota_id: rotaSelecionadaAtribuir,
        ordem_na_rota: ordemNaRotaNovo,
      })
      .eq('id', planoAtribuirRotaId)
      .select();

    setAtribuindoRota(false);

    if (error) {
      setErroAtribuirRota(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setErroAtribuirRota(
        'Não foi possível atribuir a rota: nenhum registro foi atualizado. Verifique as permissões de escrita no Supabase.',
      );
      return;
    }

    setModalAtribuirRotaVisivel(false);
    setPlanoAtribuirRotaId(null);
    carregarTudo();
  }

  function alternarModoSelecaoPlanos() {
    setModoSelecaoPlanos((atual) => {
      const novo = !atual;
      if (!novo) {
        setPlanosSelecionados(new Set());
      }
      return novo;
    });
  }

  function alternarSelecaoPlano(id: string) {
    setPlanosSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }

  function cancelarSelecaoPlanos() {
    setModoSelecaoPlanos(false);
    setPlanosSelecionados(new Set());
  }

  function abrirModalEdicaoEmMassa() {
    setTipoEdicaoMassa('manter');
    setRotaEdicaoMassa('manter');
    setPrioridadeEdicaoMassa('manter');
    setErroEdicaoMassa(null);
    setModalEdicaoEmMassaVisivel(true);
  }

  function fecharModalEdicaoEmMassa() {
    setModalEdicaoEmMassaVisivel(false);
  }

  // Cada campo que não está em "manter" (Não alterar) é atualizado numa
  // única operação .in('id', ids) para todos os selecionados — exceto
  // rota_id, que precisa de ordem_na_rota individual e por isso é
  // aplicado plano a plano, sequencialmente.
  async function handleAplicarEdicaoEmMassa() {
    if (aplicandoEdicaoMassa) {
      return;
    }

    const ids = Array.from(planosSelecionados);
    if (ids.length === 0) {
      return;
    }

    setAplicandoEdicaoMassa(true);
    setErroEdicaoMassa(null);

    try {
      if (tipoEdicaoMassa !== 'manter') {
        const { error } = await supabase
          .from('planos_manutencao')
          .update({ tipo_id: tipoEdicaoMassa })
          .in('id', ids);

        if (error) {
          throw error;
        }
      }

      if (prioridadeEdicaoMassa !== 'manter') {
        const { error } = await supabase
          .from('planos_manutencao')
          .update({ prioridade: prioridadeEdicaoMassa })
          .in('id', ids);

        if (error) {
          throw error;
        }
      }

      if (rotaEdicaoMassa !== 'manter') {
        if (rotaEdicaoMassa === null) {
          const { error } = await supabase
            .from('planos_manutencao')
            .update({ rota_id: null, ordem_na_rota: null })
            .in('id', ids);

          if (error) {
            throw error;
          }
        } else {
          const rotaAlvo = rotaEdicaoMassa;
          let quantidadeNaRota = planos.filter(
            (p) => p.rota_id === rotaAlvo,
          ).length;

          for (const id of ids) {
            quantidadeNaRota += 1;
            const { error } = await supabase
              .from('planos_manutencao')
              .update({ rota_id: rotaAlvo, ordem_na_rota: quantidadeNaRota })
              .eq('id', id);

            if (error) {
              throw error;
            }
          }
        }
      }

      setModalEdicaoEmMassaVisivel(false);
      setModoSelecaoPlanos(false);
      setPlanosSelecionados(new Set());
      carregarTudo();
    } catch (err) {
      setErroEdicaoMassa(
        err instanceof Error
          ? err.message
          : 'Não foi possível aplicar as alterações.',
      );
    } finally {
      setAplicandoEdicaoMassa(false);
    }
  }

  function abrirModalReprovar(ordemId: string) {
    fecharMenuAtividade();
    setOrdemReprovarId(ordemId);
    setMotivoReprovacao('');
    setErroReprovar(null);
    setModalReprovarVisivel(true);
  }

  function fecharModalReprovar() {
    setModalReprovarVisivel(false);
    setOrdemReprovarId(null);
  }

  // Reprovar devolve a ordem para 'pendente' (limpando os campos de
  // conclusão) e marca reprovacao_pendente=true, para que a tela de
  // execução intercepte em tela cheia na próxima vez que for aberta.
  async function handleConfirmarReprovar() {
    if (reprovando || !ordemReprovarId) {
      return;
    }

    setReprovando(true);
    setErroReprovar(null);

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        status: 'pendente',
        concluida_em: null,
        concluida_por: null,
        iniciado_em: null,
        motivo_reprovacao: motivoReprovacao.trim() || null,
        reprovacao_pendente: true,
        reprovada_em: new Date().toISOString(),
      })
      .eq('id', ordemReprovarId);

    setReprovando(false);

    if (error) {
      setErroReprovar(error.message);
      return;
    }

    setModalReprovarVisivel(false);
    setOrdemReprovarId(null);
    carregarTudo();
  }

  async function handleSalvar() {
    if (isSubmitting) {
      return;
    }

    if (!titulo.trim() || !tipoId || !dataInicio.trim()) {
      setErroModal('Preencha título, tipo e data de início.');
      return;
    }

    setIsSubmitting(true);
    setErroModal(null);

    const ordemNaRotaNumero =
      rotaId && ordemNaRota.trim() ? Number(ordemNaRota) : null;

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('planos_manutencao')
          .update({
            titulo,
            tipo_id: tipoId,
            descricao: descricao || null,
            local: local || null,
            periodicidade,
            prioridade,
            data_inicio: dataInicio,
            ativo,
            observacoes: observacoes || null,
            rota_id: rotaId,
            ordem_na_rota: ordemNaRotaNumero,
          })
          .eq('id', editingId)
          .select();

        if (error) {
          setErroModal(error.message);
          return;
        }

        if (!data || data.length === 0) {
          setErroModal(
            'Não foi possível salvar: nenhum registro foi atualizado. Verifique as permissões de escrita no Supabase.',
          );
          return;
        }
      } else {
        const { data: plano, error: erroPlano } = await supabase
          .from('planos_manutencao')
          .insert({
            titulo,
            tipo_id: tipoId,
            descricao: descricao || null,
            local: local || null,
            periodicidade,
            prioridade,
            data_inicio: dataInicio,
            ativo,
            observacoes: observacoes || null,
            rota_id: rotaId,
            ordem_na_rota: ordemNaRotaNumero,
          })
          .select()
          .single();

        if (erroPlano || !plano) {
          setErroModal(
            erroPlano?.message ?? 'Não foi possível salvar o plano.',
          );
          return;
        }

        // Gera as ocorrências até hoje + JANELA_DIAS (ou data_inicio +
        // JANELA_DIAS, o que for maior), não só uma única ordem.
        const ateDataPorHoje = adicionarDiasChave(hoje(), JANELA_DIAS);
        const ateDataPorInicio = adicionarDiasChave(dataInicio, JANELA_DIAS);
        const ateData =
          ateDataPorHoje > ateDataPorInicio ? ateDataPorHoje : ateDataPorInicio;

        const datas = gerarDatasOcorrencia(dataInicio, periodicidade, ateData);

        const { error: erroOrdem } = await supabase
          .from('ordens_servico')
          .insert(
            datas.map((data) => ({
              plano_id: plano.id,
              data_prevista: data,
              status: 'pendente',
            })),
          );

        if (erroOrdem) {
          setErroModal(erroOrdem.message);
          return;
        }
      }

      limparFormulario();
      setEditingId(null);
      setModalVisivel(false);
      carregarTudo();
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderAtividadeCard(ordem: OrdemServico, compacto = false) {
    const plano = ordem.planos_manutencao;
    const menuAberto = menuAtividadeAbertaId === ordem.id;
    const tempoExecucaoTexto =
      ordem.status === 'concluida' && ordem.iniciado_em && ordem.concluida_em
        ? formatarDuracao(
            (new Date(ordem.concluida_em).getTime() -
              new Date(ordem.iniciado_em).getTime()) /
              1000,
          )
        : null;

    return (
      <Fragment key={ordem.id}>
        <View style={[styles.planoCard, compacto && styles.planoCardCompacto]}>
          <View style={styles.planoCabecalho}>
            <Text style={styles.planoTitulo}>
              {plano?.titulo ?? 'Atividade'}
            </Text>
            <Pressable
              ref={(el) => {
                if (el) {
                  menuAtividadeIconRefs.current.set(ordem.id, el);
                }
              }}
              onPress={() => handleAbrirMenuAtividade(ordem.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [
                styles.planoMenuButton,
                pressed && styles.planoMenuButtonPressionado,
              ]}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={light.textSecondary}
              />
            </Pressable>
          </View>

          <Text style={styles.planoTipo}>
            {plano?.tipos_atividade?.nome ?? 'Sem tipo'}
          </Text>
          {plano?.local ? (
            <Text style={styles.planoDetalhe}>{plano.local}</Text>
          ) : null}

          <View style={styles.planoRodape}>
            <View style={styles.planoRodapeEsquerda}>
              <StatusBadge ordem={ordem} />
              {tempoExecucaoTexto ? (
                <Text style={styles.tempoExecucao}>
                  Tempo: {tempoExecucaoTexto}
                </Text>
              ) : null}
            </View>
            {plano ? (
              <Chip
                label={plano.prioridade}
                color={getCorPrioridade(plano.prioridade)}
              />
            ) : null}
          </View>
        </View>

        <CardMenu
          visible={menuAberto}
          onClose={fecharMenuAtividade}
          anchorPosition={menuAtividadeAncora}
        >
          {menuAtividadeEtapa === 'opcoes' ? (
            <>
              <Pressable
                style={styles.menuItem}
                onPress={() => plano && handleMenuEditar(plano)}
              >
                <Text style={styles.menuItemTexto}>Editar</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => plano && handleMenuDuplicar(plano)}
              >
                <Text style={styles.menuItemTexto}>Duplicar</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => plano && abrirModalAtribuirRota(plano)}
              >
                <Text style={styles.menuItemTexto}>Adicionar à rota</Text>
              </Pressable>
              <AdiarAcao
                variant="menuItem"
                onConfirmar={(novaData) => {
                  handleAdiarOrdem(ordem.id, novaData);
                  fecharMenuAtividade();
                }}
              />
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  fecharMenuAtividade();
                  handleConcluirOrdem(ordem.id);
                }}
              >
                <Text style={styles.menuItemTexto}>
                  {atualizandoOrdemId === ordem.id ? 'Concluindo…' : 'Concluir'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={handleMenuAtividadePedirConfirmacaoExclusao}
              >
                <Text
                  style={[styles.menuItemTexto, styles.menuItemExcluirTexto]}
                >
                  Excluir
                </Text>
              </Pressable>
              {ordem.status === 'concluida' ? (
                <Pressable
                  style={styles.menuItem}
                  onPress={() => abrirModalReprovar(ordem.id)}
                >
                  <Text
                    style={[styles.menuItemTexto, styles.menuItemExcluirTexto]}
                  >
                    Reprovar
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={styles.menuConfirmacao}>
              <Text style={styles.menuConfirmacaoTexto}>
                Confirmar exclusão?
              </Text>
              <View style={styles.menuConfirmacaoBotoes}>
                <Pressable
                  style={styles.menuConfirmacaoBotaoCancelar}
                  onPress={fecharMenuAtividade}
                >
                  <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.menuConfirmacaoBotaoExcluir}
                  onPress={() => plano && handleMenuExcluirConfirmar(plano)}
                >
                  <Text style={styles.menuConfirmacaoBotaoExcluirTexto}>
                    Excluir
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </CardMenu>
      </Fragment>
    );
  }

  // Overlay de "Nova rota" — renderizado INLINE dentro de qualquer modal que
  // o acionar (edição de plano ou "Atribuir a uma rota"), em vez de como um
  // <Modal> próprio empilhado por cima de outro. React Native não lida bem
  // com dois <Modal> simultaneamente visíveis (o segundo pode não aparecer
  // ou perder o toque em algumas plataformas) — essa era a causa raiz de
  // "+ Nova rota" parecer não refletir em lugar nenhum quando acionado pelo
  // chip dentro do modal de plano.
  const novaRotaOverlay = modalRotaVisivel ? (
    <View style={styles.novaRotaOverlay}>
      <View style={styles.modalRotaCard}>
        <Text style={styles.modalTitulo}>Nova rota</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nome da rota</Text>
          <TextInput
            value={nomeNovaRota}
            onChangeText={setNomeNovaRota}
            placeholder="Nome da rota"
            placeholderTextColor={light.textSecondary}
            style={styles.input}
          />
        </View>

        {erroModalRota ? (
          <Text style={styles.erro}>{erroModalRota}</Text>
        ) : null}

        <View style={styles.modalBotoes}>
          <Pressable
            style={[styles.modalBotao, styles.modalBotaoCancelar]}
            onPress={fecharModalRota}
          >
            <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.modalBotao,
              styles.modalBotaoSalvar,
              (pressed || criandoRota) && styles.modalBotaoPressionado,
            ]}
            onPress={handleCriarRota}
            disabled={criandoRota}
          >
            <Text style={styles.modalBotaoSalvarTexto}>
              {criandoRota ? 'Criando…' : 'Criar'}
            </Text>
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
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </Pressable>

        <Text style={styles.title}>Preservação e Manutenção</Text>

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

      <ScrollView contentContainerStyle={styles.body}>
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}

        <View style={styles.painelCard}>
          <Pressable
            style={styles.calendarioCabecalho}
            onPress={() => setCalendarioFiltrosAberto((v) => !v)}
          >
            <Text style={styles.calendarioTitulo}>Calendário e Filtros</Text>
            <Ionicons
              name={calendarioFiltrosAberto ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={light.textSecondary}
            />
          </Pressable>

          {calendarioFiltrosAberto ? (
            <View style={styles.calendarioFiltrosConteudo}>
              <MiniCalendar
                markedDates={markedDates}
                selectedDate={selectedDate}
                onSelectDay={handleSelecionarDia}
              />

              <View style={styles.progressoTrilho}>
                <View
                  style={[
                    styles.segmento,
                    styles.segmentoConcluidas,
                    { flex: progresso.concluidas },
                  ]}
                />
                <View
                  style={[
                    styles.segmento,
                    styles.segmentoPendentes,
                    { flex: progresso.pendentes },
                  ]}
                />
                <View
                  style={[
                    styles.segmento,
                    styles.segmentoAtrasadas,
                    { flex: progresso.atrasadas },
                  ]}
                />
              </View>

              <View style={styles.contadoresRow}>
                <View style={styles.contadorItem}>
                  <Text
                    style={[styles.contadorBolinha, { color: semantic.ok }]}
                  >
                    ●
                  </Text>
                  <Text style={styles.contadorTexto}>
                    {progresso.concluidas} concluídas
                  </Text>
                </View>
                <View style={styles.contadorItem}>
                  <Text
                    style={[styles.contadorBolinha, { color: light.textMuted }]}
                  >
                    ●
                  </Text>
                  <Text style={styles.contadorTexto}>
                    {progresso.pendentes} pendentes
                  </Text>
                </View>
                <View style={styles.contadorItem}>
                  <Text
                    style={[
                      styles.contadorBolinha,
                      { color: semantic.overdue },
                    ]}
                  >
                    ●
                  </Text>
                  <Text style={styles.contadorTexto}>
                    {progresso.atrasadas} atrasadas
                  </Text>
                </View>
              </View>

              {selectedDate ? (
                <Pressable
                  style={styles.filtroDataBanner}
                  onPress={() => setSelectedDate(null)}
                >
                  <Text style={styles.filtroDataTexto}>
                    Filtrando por: {formatarDataBR(selectedDate)} ✕
                  </Text>
                </Pressable>
              ) : null}

              <View
                style={[
                  styles.segmentedControl,
                  selectedDate ? styles.segmentedControlDesabilitado : null,
                ]}
                pointerEvents={selectedDate ? 'none' : 'auto'}
              >
                <Pressable
                  style={[
                    styles.segmentButton,
                    dateFilter === 'hoje' && styles.segmentButtonAtivo,
                  ]}
                  onPress={() => setDateFilter('hoje')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      dateFilter === 'hoje' && styles.segmentTextAtivo,
                    ]}
                  >
                    Hoje
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentButton,
                    dateFilter === 'todas' && styles.segmentButtonAtivo,
                  ]}
                  onPress={() => setDateFilter('todas')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      dateFilter === 'todas' && styles.segmentTextAtivo,
                    ]}
                  >
                    Todas as datas
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.chipAtrasadas,
                  atrasadasFiltro && styles.chipAtrasadasAtivo,
                ]}
                onPress={() => setAtrasadasFiltro((v) => !v)}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={14}
                  color={atrasadasFiltro ? '#FFFFFF' : semantic.overdue}
                />
                <Text
                  style={[
                    styles.chipAtrasadasTexto,
                    atrasadasFiltro && styles.chipAtrasadasTextoAtivo,
                  ]}
                >
                  Atrasadas
                </Text>
              </Pressable>

              <View style={styles.filtroGrupo}>
                <Text style={styles.label}>Tipo</Text>
                <View style={styles.chipWrap}>
                  {tiposAtivos.map((tipo) => (
                    <View key={tipo.id}>
                      <Chip
                        label={tipo.nome}
                        selected={tipoFiltros.includes(tipo.id)}
                        onPress={() => toggleTipoFiltro(tipo.id)}
                      />
                      {tiposComAtraso.has(tipo.id) ? (
                        <View style={styles.chipBadgeDot} />
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.filtroGrupo}>
                <Text style={styles.label}>Prioridade</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {PRIORIDADES.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={prioridadeFiltros.includes(item)}
                      color={getCorPrioridade(item)}
                      onPress={() => togglePrioridadeFiltro(item)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filtroGrupo}>
                <Text style={styles.label}>Periodicidade</Text>
                <View style={styles.chipWrap}>
                  {PERIODICIDADES.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={periodicidadeFiltros.includes(item)}
                      onPress={() => togglePeriodicidadeFiltro(item)}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.secaoTituloRow}>
          <Text style={styles.secaoTitulo}>Atividades do dia</Text>
          <Pressable onPress={() => abrirModalRota()}>
            <Text style={styles.novaRotaLink}>+ Nova rota</Text>
          </Pressable>
        </View>

        {atividadesDoDia.length === 0 ? (
          <Text style={styles.vazio}>
            Nenhuma atividade prevista para hoje.
          </Text>
        ) : (
          <View style={styles.listaGrupos}>
            {atividadesAgrupadas.grupos.map(({ rota, itens }) => {
              const concluidas = itens.filter(
                (o) => o.status === 'concluida',
              ).length;
              const percentual =
                itens.length > 0
                  ? Math.round((concluidas / itens.length) * 100)
                  : 0;
              const expandida = rotasExpandidas.has(rota.id);

              return (
                <View key={rota.id} style={styles.grupoRota}>
                  <View style={styles.grupoRotaResumoCard}>
                    <Text style={styles.grupoRotaResumoTitulo}>
                      {rota.nome}
                    </Text>
                    <Text style={styles.grupoRotaResumoSubtitulo}>
                      {itens.length} atividades programadas para o dia
                    </Text>

                    <View style={styles.grupoRotaProgressoRow}>
                      <View style={styles.grupoRotaProgressoTrilho}>
                        <View
                          style={[
                            styles.grupoRotaProgressoPreenchimento,
                            { width: `${percentual}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.grupoRotaProgressoTexto}>
                        {percentual}%
                      </Text>
                    </View>

                    <Pressable
                      style={styles.grupoRotaExpandirRow}
                      onPress={() => toggleRotaExpandida(rota.id)}
                    >
                      <Text style={styles.grupoRotaExpandirTexto}>
                        {expandida
                          ? 'Recolher atividades'
                          : 'Expandir atividades'}
                      </Text>
                      <Ionicons
                        name={expandida ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={light.brand}
                      />
                    </Pressable>
                  </View>

                  {expandida ? (
                    <View style={styles.atividadesRotaContainer}>
                      {itens.map((ordem) => renderAtividadeCard(ordem, true))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {atividadesAgrupadas.semRota.length > 0 ? (
              <View style={styles.lista}>
                {atividadesAgrupadas.semRota.map((ordem) =>
                  renderAtividadeCard(ordem),
                )}
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.painelCard}>
          <View style={styles.calendarioCabecalho}>
            <Pressable
              style={styles.calendarioCabecalhoToggle}
              onPress={() => setPlanosAbertos((v) => !v)}
            >
              <Text style={styles.calendarioTitulo}>
                Todos os planos cadastrados
              </Text>
              <Ionicons
                name={planosAbertos ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={light.textSecondary}
              />
            </Pressable>
            <Pressable onPress={alternarModoSelecaoPlanos}>
              <Text style={styles.selecionarLink}>
                {modoSelecaoPlanos ? 'Concluir' : 'Selecionar'}
              </Text>
            </Pressable>
          </View>

          {planosAbertos ? (
            <View style={styles.lista}>
              {!carregando && planosFiltrados.length === 0 ? (
                <Text style={styles.vazio}>Nenhuma atividade cadastrada.</Text>
              ) : null}

              {planosFiltrados.map((plano) => {
                const menuAberto = menuAbertoId === plano.id;
                const proximaOrdem = encontrarProximaOrdemPendente(plano.id);
                const selecionado = planosSelecionados.has(plano.id);

                return (
                  <Fragment key={plano.id}>
                    <Pressable
                      style={styles.planoCard}
                      onPress={
                        modoSelecaoPlanos
                          ? () => alternarSelecaoPlano(plano.id)
                          : undefined
                      }
                    >
                      <View style={styles.planoCabecalho}>
                        {modoSelecaoPlanos ? (
                          <View
                            style={[
                              styles.linhaRotaIndicador,
                              selecionado &&
                                styles.linhaRotaIndicadorSelecionado,
                            ]}
                          >
                            {selecionado ? (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#FFFFFF"
                              />
                            ) : null}
                          </View>
                        ) : null}
                        <Text style={styles.planoTitulo}>{plano.titulo}</Text>
                        {modoSelecaoPlanos ? null : (
                          <Pressable
                            ref={(el) => {
                              if (el) {
                                menuIconRefs.current.set(plano.id, el);
                              }
                            }}
                            onPress={() => handleAbrirMenu(plano.id)}
                            hitSlop={{
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10,
                            }}
                            style={({ pressed }) => [
                              styles.planoMenuButton,
                              pressed && styles.planoMenuButtonPressionado,
                            ]}
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={18}
                              color={light.textSecondary}
                            />
                          </Pressable>
                        )}
                      </View>

                      {plano.rota_id && plano.rotas ? (
                        <View style={styles.rotaChip}>
                          <Text style={styles.rotaChipTexto}>
                            {plano.rotas.nome}
                          </Text>
                        </View>
                      ) : null}

                      <Text style={styles.planoTipo}>
                        {plano.tipos_atividade?.nome ?? 'Sem tipo'}
                      </Text>

                      {plano.local ? (
                        <Text style={styles.planoDetalhe}>{plano.local}</Text>
                      ) : null}

                      <View style={styles.planoRodape}>
                        <Text style={styles.planoDetalhe}>
                          {plano.periodicidade} ·{' '}
                          {formatarDataBR(plano.data_inicio)}
                        </Text>
                        <Chip
                          label={plano.prioridade}
                          color={getCorPrioridade(plano.prioridade)}
                        />
                      </View>
                    </Pressable>

                    <CardMenu
                      visible={menuAberto}
                      onClose={fecharMenu}
                      anchorPosition={menuAncora}
                    >
                      {menuEtapa === 'opcoes' ? (
                        <>
                          <Pressable
                            style={styles.menuItem}
                            onPress={() => handleMenuEditar(plano)}
                          >
                            <Text style={styles.menuItemTexto}>Editar</Text>
                          </Pressable>
                          <Pressable
                            style={styles.menuItem}
                            onPress={() => handleMenuDuplicar(plano)}
                          >
                            <Text style={styles.menuItemTexto}>Duplicar</Text>
                          </Pressable>
                          <Pressable
                            style={styles.menuItem}
                            onPress={() => abrirModalAtribuirRota(plano)}
                          >
                            <Text style={styles.menuItemTexto}>
                              Adicionar à rota
                            </Text>
                          </Pressable>
                          {proximaOrdem ? (
                            <AdiarAcao
                              variant="menuItem"
                              onConfirmar={(novaData) => {
                                handleAdiarOrdem(proximaOrdem.id, novaData);
                                fecharMenu();
                              }}
                            />
                          ) : (
                            <View
                              style={[
                                styles.menuItem,
                                styles.menuItemDesabilitado,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.menuItemTexto,
                                  styles.menuItemTextoDesabilitado,
                                ]}
                              >
                                Adiar
                              </Text>
                            </View>
                          )}
                          {proximaOrdem ? (
                            <Pressable
                              style={styles.menuItem}
                              onPress={() => {
                                fecharMenu();
                                handleConcluirOrdem(proximaOrdem.id);
                              }}
                            >
                              <Text style={styles.menuItemTexto}>
                                {atualizandoOrdemId === proximaOrdem.id
                                  ? 'Concluindo…'
                                  : 'Concluir'}
                              </Text>
                            </Pressable>
                          ) : (
                            <View
                              style={[
                                styles.menuItem,
                                styles.menuItemDesabilitado,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.menuItemTexto,
                                  styles.menuItemTextoDesabilitado,
                                ]}
                              >
                                Concluir
                              </Text>
                            </View>
                          )}
                          <Pressable
                            style={styles.menuItem}
                            onPress={handleMenuPedirConfirmacaoExclusao}
                          >
                            <Text
                              style={[
                                styles.menuItemTexto,
                                styles.menuItemExcluirTexto,
                              ]}
                            >
                              Excluir
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <View style={styles.menuConfirmacao}>
                          <Text style={styles.menuConfirmacaoTexto}>
                            Confirmar exclusão?
                          </Text>
                          <View style={styles.menuConfirmacaoBotoes}>
                            <Pressable
                              style={styles.menuConfirmacaoBotaoCancelar}
                              onPress={fecharMenu}
                            >
                              <Text
                                style={styles.menuConfirmacaoBotaoCancelarTexto}
                              >
                                Cancelar
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.menuConfirmacaoBotaoExcluir}
                              onPress={() => handleMenuExcluirConfirmar(plano)}
                            >
                              <Text
                                style={styles.menuConfirmacaoBotaoExcluirTexto}
                              >
                                Excluir
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </CardMenu>
                  </Fragment>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {planosSelecionados.size > 0 ? (
        <View
          style={[
            styles.barraSelecao,
            { paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <Text style={styles.barraSelecaoTexto}>
            {planosSelecionados.size} selecionados
          </Text>
          <View style={styles.barraSelecaoBotoes}>
            <Pressable
              style={styles.barraSelecaoBotaoCancelar}
              onPress={cancelarSelecaoPlanos}
            >
              <Text style={styles.barraSelecaoBotaoCancelarTexto}>
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              style={styles.barraSelecaoBotaoEditar}
              onPress={abrirModalEdicaoEmMassa}
            >
              <Text style={styles.barraSelecaoBotaoEditarTexto}>
                Editar selecionados
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal
        visible={modalVisivel}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitulo}>
                {editingId ? 'Editar plano' : 'Nova atividade'}
              </Text>

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
                <Text style={styles.label}>Tipo</Text>
                <View style={styles.chipWrap}>
                  {tiposAtivos.map((tipo) => (
                    <Chip
                      key={tipo.id}
                      label={tipo.nome}
                      selected={tipoId === tipo.id}
                      onPress={() => setTipoId(tipo.id)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Descrição</Text>
                <TextInput
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Descrição"
                  placeholderTextColor={light.textSecondary}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, styles.inputMultiline]}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Local</Text>
                <TextInput
                  value={local}
                  onChangeText={setLocal}
                  placeholder="Local"
                  placeholderTextColor={light.textSecondary}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Periodicidade</Text>
                <View style={styles.chipWrap}>
                  {PERIODICIDADES.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={periodicidade === item}
                      onPress={() => setPeriodicidade(item)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Prioridade</Text>
                <View style={styles.chipWrap}>
                  {PRIORIDADES.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={prioridade === item}
                      color={getCorPrioridade(item)}
                      onPress={() => setPrioridade(item)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Rota</Text>
                <View style={styles.chipWrap}>
                  <Chip
                    label="Nenhuma"
                    selected={rotaId === null}
                    onPress={() => handleSelecionarRota(null)}
                  />
                  {rotas
                    .filter((rota) => rota.ativo)
                    .map((rota) => (
                      <Chip
                        key={rota.id}
                        label={rota.nome}
                        selected={rotaId === rota.id}
                        onPress={() => handleSelecionarRota(rota.id)}
                      />
                    ))}
                  <Chip label="+ Nova rota" onPress={abrirModalRota} />
                </View>
              </View>

              {rotaId ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Ordem na rota</Text>
                  <TextInput
                    value={ordemNaRota}
                    onChangeText={handleAlterarOrdemNaRotaManual}
                    placeholder="1"
                    placeholderTextColor={light.textSecondary}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Data de início (AAAA-MM-DD)</Text>
                <TextInput
                  value={dataInicio}
                  onChangeText={setDataInicio}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={light.textSecondary}
                  style={styles.input}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Ativo</Text>
                <Switch
                  value={ativo}
                  onValueChange={setAtivo}
                  trackColor={{ false: light.border, true: light.brand }}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Observações</Text>
                <TextInput
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Observações"
                  placeholderTextColor={light.textSecondary}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, styles.inputMultiline]}
                />
              </View>

              {erroModal ? <Text style={styles.erro}>{erroModal}</Text> : null}

              <View style={styles.modalBotoes}>
                <Pressable
                  style={[styles.modalBotao, styles.modalBotaoCancelar]}
                  onPress={fecharModal}
                >
                  <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBotao,
                    styles.modalBotaoSalvar,
                    (pressed || isSubmitting) && styles.modalBotaoPressionado,
                  ]}
                  onPress={handleSalvar}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalBotaoSalvarTexto}>
                    {isSubmitting ? 'Salvando…' : 'Salvar'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
          {novaRotaOverlay}
        </View>
      </Modal>

      <Modal
        visible={modalAtribuirRotaVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalAtribuirRota}
      >
        <View style={styles.telaAtribuir}>
          <View
            style={[
              styles.cabecalhoAtribuir,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <Pressable
              style={styles.cabecalhoAtribuirBotao}
              onPress={fecharModalAtribuirRota}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
            <Text style={styles.tituloAtribuir}>Atribuir a uma rota</Text>
            <View style={styles.cabecalhoAtribuirBotao} />
          </View>

          <ScrollView contentContainerStyle={styles.corpoAtribuir}>
            <Pressable
              style={styles.linhaRota}
              onPress={() => setRotaSelecionadaAtribuir(null)}
            >
              <Text style={styles.linhaRotaTexto}>Nenhuma</Text>
              <View
                style={[
                  styles.linhaRotaIndicador,
                  rotaSelecionadaAtribuir === null &&
                    styles.linhaRotaIndicadorSelecionado,
                ]}
              >
                {rotaSelecionadaAtribuir === null ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </Pressable>

            {rotas
              .filter((rota) => rota.ativo)
              .map((rota) => (
                <Pressable
                  key={rota.id}
                  style={styles.linhaRota}
                  onPress={() => setRotaSelecionadaAtribuir(rota.id)}
                >
                  <Text style={styles.linhaRotaTexto}>{rota.nome}</Text>
                  <View
                    style={[
                      styles.linhaRotaIndicador,
                      rotaSelecionadaAtribuir === rota.id &&
                        styles.linhaRotaIndicadorSelecionado,
                    ]}
                  >
                    {rotaSelecionadaAtribuir === rota.id ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                </Pressable>
              ))}

            <Pressable
              style={styles.novaRotaLinkAtribuir}
              onPress={() => abrirModalRota('atribuir')}
            >
              <Text style={styles.novaRotaLinkAtribuirTexto}>+ Nova rota</Text>
            </Pressable>

            {erroAtribuirRota ? (
              <Text style={styles.erro}>{erroAtribuirRota}</Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.rodapeAtribuir,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={styles.botaoCancelarAtribuir}
              onPress={fecharModalAtribuirRota}
            >
              <Text style={styles.botaoCancelarAtribuirTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.botaoConfirmarAtribuir,
                atribuindoRota && styles.botaoConfirmarAtribuirDesabilitado,
              ]}
              onPress={handleConfirmarAtribuirRota}
              disabled={atribuindoRota}
            >
              <Text style={styles.botaoConfirmarAtribuirTexto}>
                {atribuindoRota ? 'Salvando…' : 'Confirmar'}
              </Text>
            </Pressable>
          </View>

          {novaRotaOverlay}
        </View>
      </Modal>

      <Modal
        visible={modalEdicaoEmMassaVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalEdicaoEmMassa}
      >
        <View style={styles.telaAtribuir}>
          <View
            style={[
              styles.cabecalhoAtribuir,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <Pressable
              style={styles.cabecalhoAtribuirBotao}
              onPress={fecharModalEdicaoEmMassa}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
            <Text style={styles.tituloAtribuir}>
              Editar {planosSelecionados.size} planos
            </Text>
            <View style={styles.cabecalhoAtribuirBotao} />
          </View>

          <ScrollView contentContainerStyle={styles.corpoAtribuir}>
            <View style={styles.field}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Não alterar"
                  selected={tipoEdicaoMassa === 'manter'}
                  onPress={() => setTipoEdicaoMassa('manter')}
                />
                {tiposAtivos.map((tipo) => (
                  <Chip
                    key={tipo.id}
                    label={tipo.nome}
                    selected={tipoEdicaoMassa === tipo.id}
                    onPress={() => setTipoEdicaoMassa(tipo.id)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Prioridade</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Não alterar"
                  selected={prioridadeEdicaoMassa === 'manter'}
                  onPress={() => setPrioridadeEdicaoMassa('manter')}
                />
                {PRIORIDADES.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={prioridadeEdicaoMassa === item}
                    color={getCorPrioridade(item)}
                    onPress={() => setPrioridadeEdicaoMassa(item)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Rota</Text>

              <Pressable
                style={styles.linhaRota}
                onPress={() => setRotaEdicaoMassa('manter')}
              >
                <Text style={styles.linhaRotaTexto}>Não alterar</Text>
                <View
                  style={[
                    styles.linhaRotaIndicador,
                    rotaEdicaoMassa === 'manter' &&
                      styles.linhaRotaIndicadorSelecionado,
                  ]}
                >
                  {rotaEdicaoMassa === 'manter' ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                style={styles.linhaRota}
                onPress={() => setRotaEdicaoMassa(null)}
              >
                <Text style={styles.linhaRotaTexto}>Nenhuma</Text>
                <View
                  style={[
                    styles.linhaRotaIndicador,
                    rotaEdicaoMassa === null &&
                      styles.linhaRotaIndicadorSelecionado,
                  ]}
                >
                  {rotaEdicaoMassa === null ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>

              {rotas
                .filter((rota) => rota.ativo)
                .map((rota) => (
                  <Pressable
                    key={rota.id}
                    style={styles.linhaRota}
                    onPress={() => setRotaEdicaoMassa(rota.id)}
                  >
                    <Text style={styles.linhaRotaTexto}>{rota.nome}</Text>
                    <View
                      style={[
                        styles.linhaRotaIndicador,
                        rotaEdicaoMassa === rota.id &&
                          styles.linhaRotaIndicadorSelecionado,
                      ]}
                    >
                      {rotaEdicaoMassa === rota.id ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                ))}
            </View>

            {erroEdicaoMassa ? (
              <Text style={styles.erro}>{erroEdicaoMassa}</Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.rodapeAtribuir,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={styles.botaoCancelarAtribuir}
              onPress={fecharModalEdicaoEmMassa}
            >
              <Text style={styles.botaoCancelarAtribuirTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.botaoConfirmarAtribuir,
                aplicandoEdicaoMassa &&
                  styles.botaoConfirmarAtribuirDesabilitado,
              ]}
              onPress={handleAplicarEdicaoEmMassa}
              disabled={aplicandoEdicaoMassa}
            >
              <Text style={styles.botaoConfirmarAtribuirTexto}>
                {aplicandoEdicaoMassa
                  ? 'Aplicando…'
                  : `Aplicar a ${planosSelecionados.size} planos`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalReprovarVisivel}
        transparent
        animationType="fade"
        onRequestClose={fecharModalReprovar}
      >
        <View style={styles.overlay}>
          <View style={styles.modalRotaCard}>
            <Text style={styles.modalTitulo}>Reprovar atividade</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Motivo da reprovação (opcional)</Text>
              <TextInput
                value={motivoReprovacao}
                onChangeText={setMotivoReprovacao}
                placeholder="Descreva o motivo, se houver"
                placeholderTextColor={light.textSecondary}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.inputMultiline]}
              />
            </View>

            {erroReprovar ? (
              <Text style={styles.erro}>{erroReprovar}</Text>
            ) : null}

            <View style={styles.modalBotoes}>
              <Pressable
                style={[styles.modalBotao, styles.modalBotaoCancelar]}
                onPress={fecharModalReprovar}
              >
                <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBotao,
                  styles.modalBotaoPerigo,
                  (pressed || reprovando) && styles.modalBotaoPerigoPressionado,
                ]}
                onPress={handleConfirmarReprovar}
                disabled={reprovando}
              >
                <Text style={styles.modalBotaoPerigoTexto}>
                  {reprovando ? 'Reprovando…' : 'Confirmar reprovação'}
                </Text>
              </Pressable>
            </View>
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
    backgroundColor: light.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    backgroundColor: light.brandPressed,
  },
  title: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  secaoTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secaoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: light.textPrimary,
  },
  novaRotaLink: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.brand,
  },
  painelCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calendarioCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarioCabecalhoToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selecionarLink: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.brand,
    marginLeft: spacing.md,
  },
  calendarioTitulo: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  calendarioFiltrosConteudo: {
    gap: spacing.md,
  },
  progressoTrilho: {
    flexDirection: 'row',
    height: 16,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmento: {
    height: '100%',
  },
  segmentoConcluidas: {
    backgroundColor: semantic.ok,
  },
  segmentoPendentes: {
    backgroundColor: `${light.textMuted}66`,
  },
  segmentoAtrasadas: {
    backgroundColor: semantic.overdue,
  },
  contadoresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  contadorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contadorBolinha: {
    fontSize: 10,
  },
  contadorTexto: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  filtroDataBanner: {
    alignSelf: 'flex-start',
  },
  filtroDataTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.brand,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: 2,
  },
  segmentedControlDesabilitado: {
    opacity: 0.4,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentButtonAtivo: {
    backgroundColor: light.card,
  },
  segmentText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  segmentTextAtivo: {
    color: light.textPrimary,
  },
  chipAtrasadas: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: semantic.overdue,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    backgroundColor: `${semantic.overdue}1A`,
  },
  chipAtrasadasAtivo: {
    backgroundColor: semantic.overdue,
  },
  chipAtrasadasTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: semantic.overdue,
  },
  chipAtrasadasTextoAtivo: {
    color: '#FFFFFF',
  },
  filtroGrupo: {
    gap: spacing.xs,
  },
  chipBadgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: semantic.overdue,
  },
  listaGrupos: {
    gap: spacing.md,
  },
  grupoRota: {
    gap: spacing.sm,
  },
  grupoRotaResumoCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  grupoRotaResumoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: light.textPrimary,
  },
  grupoRotaResumoSubtitulo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  grupoRotaProgressoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  grupoRotaProgressoTrilho: {
    flex: 1,
    height: 8,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  grupoRotaProgressoPreenchimento: {
    height: '100%',
    backgroundColor: semantic.ok,
    borderRadius: 4,
  },
  grupoRotaProgressoTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },
  grupoRotaExpandirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  grupoRotaExpandirTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.brand,
  },
  lista: {
    gap: spacing.sm,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  planoCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  planoCardCompacto: {
    borderRadius: 8,
  },
  atividadesRotaContainer: {
    marginLeft: 16,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
    backgroundColor: light.sunken,
    borderLeftWidth: 3,
    borderLeftColor: light.brand,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  menuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuItemDesabilitado: {
    opacity: 0.4,
  },
  menuItemTexto: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
  menuItemTextoDesabilitado: {
    color: light.textMuted,
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
  barraSelecao: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: light.card,
    borderTopWidth: 1,
    borderTopColor: light.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
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
  barraSelecaoBotaoCancelar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  barraSelecaoBotaoCancelarTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  barraSelecaoBotaoEditar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.brand,
  },
  barraSelecaoBotaoEditarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  planoCabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planoMenuButton: {
    padding: 6,
    borderRadius: radius.sm,
    zIndex: 10,
    elevation: 10,
  },
  planoMenuButtonPressionado: {
    backgroundColor: light.sunken,
  },
  planoTitulo: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  rotaChip: {
    alignSelf: 'flex-start',
    backgroundColor: light.brandWash,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  rotaChipTexto: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: light.brand,
  },
  planoTipo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  planoDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textMuted,
  },
  planoRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  planoRodapeEsquerda: {
    gap: spacing.xs / 2,
  },
  tempoExecucao: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: light.card,
    borderRadius: radius.lg,
    maxHeight: '85%',
  },
  modalRotaCard: {
    backgroundColor: light.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalScroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: light.textPrimary,
    marginBottom: spacing.xs,
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
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: light.brand,
  },
  modalBotaoPressionado: {
    backgroundColor: light.brandPressed,
  },
  modalBotaoSalvarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalBotaoPerigo: {
    backgroundColor: semantic.overdue,
  },
  modalBotaoPerigoPressionado: {
    opacity: 0.7,
  },
  modalBotaoPerigoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
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
  telaAtribuir: {
    flex: 1,
    backgroundColor: light.bg,
  },
  cabecalhoAtribuir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cabecalhoAtribuirBotao: {
    width: 32,
    alignItems: 'center',
  },
  tituloAtribuir: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  corpoAtribuir: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  linhaRota: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  linhaRotaTexto: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaRotaIndicador: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaRotaIndicadorSelecionado: {
    backgroundColor: light.brand,
    borderColor: light.brand,
  },
  novaRotaLinkAtribuir: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  novaRotaLinkAtribuirTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.brand,
  },
  rodapeAtribuir: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoCancelarAtribuir: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoCancelarAtribuirTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  botaoConfirmarAtribuir: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.brand,
  },
  botaoConfirmarAtribuirDesabilitado: {
    opacity: 0.4,
  },
  botaoConfirmarAtribuirTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
