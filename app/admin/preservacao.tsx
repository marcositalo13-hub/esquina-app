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
import { ValidacaoGuiada } from '../../src/components/ValidacaoGuiada';
import { type Ambiente, listarAmbientes } from '../../src/data/ambientes';
import {
  adicionarDiasChave,
  atualizarAtividadeExtraordinaria,
  criarAtividadeExtraordinaria,
  formatarDataBR,
  formatarDuracao,
  gerarDatasOcorrencia,
  getCorPrioridade,
  getQualidadeInfo,
  hojeLocal,
  JANELA_DIAS,
  localNomeOrdem,
  type OrdemServico,
  PERIODICIDADES,
  type Periodicidade,
  type PlanoManutencao,
  PRIORIDADES,
  type Prioridade,
  pesoPrioridade,
  prioridadeOrdem,
  type Qualidade,
  type Rota,
  type TipoAtividade,
  tipoNomeOrdem,
  tituloOrdem,
} from '../../src/data/manutencao';
import { resolverCondominioId } from '../../src/lib/resolverCondominioId';
import { supabase } from '../../src/lib/supabase';
import { preencherOcorrenciasFaltantes } from '../../src/lib/topUpOcorrencias';
import { reprovarOrdem, validarOrdem } from '../../src/lib/validacaoOrdens';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

const hoje = hojeLocal;

// Busca client-side insensível a caixa e acento — mesmo helper duplicado em
// app/admin/ambientes.tsx, app/admin/contratos.tsx e
// app/admin/normativos-gerenciar.tsx.
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Nome do local a exibir: prioriza o ambiente vinculado (locais.nome);
// cai para o texto livre antigo (plano.local) só quando não há local_id —
// nunca "Local: —" para um plano que já tinha local de texto preenchido.
function nomeLocal(plano: {
  local: string | null;
  locais?: { nome: string } | null;
}): string | null {
  return plano.locais?.nome ?? plano.local ?? null;
}

type DateFilter = 'hoje' | 'todas';

export default function AdminPreservacao() {
  const insets = useSafeAreaInsets();

  const [planos, setPlanos] = useState<PlanoManutencao[]>([]);
  // Consulta ampla (calendário, chips de filtro, atrasadas de qualquer
  // data, "todas as datas" da barra de progresso) — ver carregarOrdens.
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  // Consulta enxuta, filtrada por data_prevista=hoje direto no banco —
  // única fonte de "Atividades do dia" (ver carregarOrdensHoje).
  const [ordensHoje, setOrdensHoje] = useState<OrdemServico[]>([]);
  const [tiposAtivos, setTiposAtivos] = useState<TipoAtividade[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [calendarioFiltrosAberto, setCalendarioFiltrosAberto] = useState(false);
  const [planosAbertos, setPlanosAbertos] = useState(false);
  // Seção "Rotas" (antigo título "Atividades do dia") — aberta por padrão,
  // já que é o conteúdo principal da tela; ganhou recolher/expandir na
  // Fase 1 do redesenho (porta de entrada única), mas continua visível
  // sem rolar nem tocar em nada na primeira renderização.
  const [rotasSecaoAberta, setRotasSecaoAberta] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [atrasadasFiltro, setAtrasadasFiltro] = useState(false);
  const [tipoFiltros, setTipoFiltros] = useState<string[]>([]);
  const [prioridadeFiltros, setPrioridadeFiltros] = useState<Prioridade[]>([]);
  const [periodicidadeFiltros, setPeriodicidadeFiltros] = useState<
    Periodicidade[]
  >([]);
  // Busca por nome em "Todos os planos cadastrados" — soma-se aos filtros
  // acima (não substitui), client-side, sem nova consulta ao banco.
  const [buscaPlano, setBuscaPlano] = useState('');

  // Atividades extraordinárias (ordens_servico avulsas, sem plano). Vivem
  // na mesma seção de "Todos os planos cadastrados", sujeitas aos mesmos
  // filtros, mas com card próprio — não são planos e não têm recorrência,
  // edição em massa nem atribuição de rota.
  const [extraordinarias, setExtraordinarias] = useState<OrdemServico[]>([]);
  const [menuCriarVisivel, setMenuCriarVisivel] = useState(false);
  const [menuCriarAncora, setMenuCriarAncora] = useState<AnchorPosition>({
    x: 0,
    y: 0,
  });
  const botaoCriarRef = useRef<View | null>(null);

  const [modalExtraVisivel, setModalExtraVisivel] = useState(false);
  // Preenchido só em edição (abrirModalEditarExtraordinaria) — caminho
  // paralelo ao editingId de plano, nunca se mistura com handleSalvar/
  // planos_manutencao.
  const [extraEditingId, setExtraEditingId] = useState<string | null>(null);
  const [extraTitulo, setExtraTitulo] = useState('');
  const [extraTipoId, setExtraTipoId] = useState<string | null>(null);
  const [extraLocalId, setExtraLocalId] = useState<string | null>(null);
  const [extraPrioridade, setExtraPrioridade] = useState<Prioridade | null>(
    null,
  );
  const [extraPrazo, setExtraPrazo] = useState('');
  const [extraObservacoes, setExtraObservacoes] = useState('');
  const [extraSalvando, setExtraSalvando] = useState(false);
  const [erroModalExtra, setErroModalExtra] = useState<string | null>(null);
  const [extraSeletorLocalVisivel, setExtraSeletorLocalVisivel] =
    useState(false);
  const [extraBuscaLocal, setExtraBuscaLocal] = useState('');
  const [extraCalendarioVisivel, setExtraCalendarioVisivel] = useState(false);

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

  // Menu de 3 pontos dos cards de extraordinária em "Todos os planos
  // cadastrados" — estado próprio, separado de menuAbertoId (planos) e de
  // menuAtividadeAbertaId ("Atividades do dia"): a mesma ordem pode
  // aparecer nas duas listas ao mesmo tempo (prazo = hoje), então usar o
  // mesmo estado nas duas arriscaria abrir dois CardMenu (Modal) ao mesmo
  // tempo para o mesmo id — o projeto já evita empilhar dois Modal.
  const [menuExtraAbertoId, setMenuExtraAbertoId] = useState<string | null>(
    null,
  );
  const [menuExtraAncora, setMenuExtraAncora] = useState<AnchorPosition>({
    x: 0,
    y: 0,
  });
  const menuExtraIconRefs = useRef<Map<string, View>>(new Map());

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [localId, setLocalId] = useState<string | null>(null);
  const [ambientesAtivos, setAmbientesAtivos] = useState<Ambiente[]>([]);
  const [seletorLocalVisivel, setSeletorLocalVisivel] = useState(false);
  const [buscaLocal, setBuscaLocal] = useState('');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('Mensal');
  const [prioridade, setPrioridade] = useState<Prioridade>('Média');
  const [dataInicio, setDataInicio] = useState(() => hoje());
  const [observacoes, setObservacoes] = useState('');
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [ordemNaRota, setOrdemNaRota] = useState('');
  const [ordemNaRotaEditadoManualmente, setOrdemNaRotaEditadoManualmente] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [calendarioDataInicioVisivel, setCalendarioDataInicioVisivel] =
    useState(false);

  const [modalRotaVisivel, setModalRotaVisivel] = useState(false);
  const [nomeNovaRota, setNomeNovaRota] = useState('');
  const [criandoRota, setCriandoRota] = useState(false);
  const [erroModalRota, setErroModalRota] = useState<string | null>(null);

  // Menu de 3 pontos do card de rota em "Atividades do dia" — estado
  // próprio, mesmo motivo de menuExtraAbertoId (listas diferentes não
  // compartilham estado de menu, pra nunca arriscar dois CardMenu abertos
  // ao mesmo tempo para ids que colidem entre listas).
  const [menuRotaAbertaId, setMenuRotaAbertaId] = useState<string | null>(null);
  const [menuRotaAncora, setMenuRotaAncora] = useState<AnchorPosition>({
    x: 0,
    y: 0,
  });
  const menuRotaIconRefs = useRef<Map<string, View>>(new Map());

  const [modalEditarRotaVisivel, setModalEditarRotaVisivel] = useState(false);
  const [rotaEditandoId, setRotaEditandoId] = useState<string | null>(null);
  const [nomeEditarRota, setNomeEditarRota] = useState('');
  const [responsavelEditarRotaId, setResponsavelEditarRotaId] = useState<
    string | null
  >(null);
  const [funcionariosZeladoria, setFuncionariosZeladoria] = useState<
    { id: string; nome: string }[]
  >([]);
  const [carregandoFuncionariosZeladoria, setCarregandoFuncionariosZeladoria] =
    useState(false);
  const [salvandoEditarRota, setSalvandoEditarRota] = useState(false);
  const [erroModalEditarRota, setErroModalEditarRota] = useState<string | null>(
    null,
  );

  // Nome do responsável por rota, pra exibir no card de "Atividades do
  // dia" — carregado uma vez no mount (mesmo padrão de carregarRotas/
  // carregarAmbientes), separado de funcionariosZeladoria (esse é sob
  // demanda, só ao abrir "Editar rota", e já filtrado por papel/ativo).
  const [funcionariosPorId, setFuncionariosPorId] = useState<
    Record<string, string>
  >({});
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

  const [modalValidacaoVisivel, setModalValidacaoVisivel] = useState(false);
  const [ordemValidacaoInicialId, setOrdemValidacaoInicialId] = useState<
    string | null
  >(null);

  // Lista inline de "Pendentes de validação" — Bom/Médio/Ruim/Reprovar
  // direto na linha, sem abrir o fluxo guiado de tela cheia (ValidacaoGuiada
  // continua existindo, intocado, para quem preferir esse fluxo).
  const [processandoValidacaoId, setProcessandoValidacaoId] = useState<
    string | null
  >(null);
  const [reprovandoLinhaId, setReprovandoLinhaId] = useState<string | null>(
    null,
  );
  const [motivoReprovacaoLinha, setMotivoReprovacaoLinha] = useState('');
  const [erroValidacaoLinhaId, setErroValidacaoLinhaId] = useState<
    string | null
  >(null);
  const [erroValidacaoLinhaTexto, setErroValidacaoLinhaTexto] = useState<
    string | null
  >(null);
  // Depois de validar/reprovar uma linha, ela continua na lista (sem
  // recarregar a tela) mostrando um selo em vez dos botões — só some de
  // verdade no próximo refetch real de ordensHoje.
  const [validacaoOverrides, setValidacaoOverrides] = useState<
    Record<
      string,
      { tipo: 'qualidade'; valor: Qualidade } | { tipo: 'reprovada' }
    >
  >({});
  // Grupos (por rota) recolhidos por padrão — estado próprio, separado de
  // rotasExpandidas ("Atividades do dia"), pra não acoplar expandir/
  // recolher de uma seção com a outra.
  const [validacaoGruposExpandidos, setValidacaoGruposExpandidos] = useState<
    Set<string>
  >(() => new Set());

  const carregarPlanos = useCallback(async () => {
    const { data, error } = await supabase
      .from('planos_manutencao')
      .select('*, tipos_atividade(*), rotas(*), locais(*)')
      .order('created_at', { ascending: false });

    if (error) {
      setErroLista(error.message);
      return;
    }

    setErroLista(null);
    setPlanos((data ?? []) as PlanoManutencao[]);
  }, []);

  // Consulta ampla: cobre tudo que legitimamente precisa de intervalo maior
  // que "hoje" — marcações do calendário, chips de filtro (tipo/prioridade/
  // periodicidade/atrasadas), planoIdsAtrasados/planoIdsNaDataSelecionada,
  // "todas as datas" da barra de progresso e encontrarProximaOrdemPendente.
  // .limit(5000) explícito: sem isso, o corte de segurança padrão do
  // Supabase (1000 linhas) trunca silenciosamente conforme a tabela
  // cresce. 5000 está bem acima do uso real atual; se o volume real
  // ultrapassar isso, é preciso paginação de verdade — dívida técnica
  // documentada aqui, não bug.
  const carregarOrdens = useCallback(async () => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select(
        '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*))',
      )
      .order('data_prevista', { ascending: false })
      .limit(5000);

    if (!error) {
      setOrdens((data ?? []) as OrdemServico[]);
    }
  }, []);

  // Consulta enxuta: filtra data_prevista=hoje direto no banco (não busca
  // tudo para depois filtrar em JS) — alimenta exclusivamente "Atividades
  // do dia". Nunca chega perto de 1000 linhas, então não precisa de limit.
  const carregarOrdensHoje = useCallback(async () => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select(
        // Join via planos_manutencao cobre origem='rotina'; join direto de
        // tipo_id/local_id cobre origem='extraordinaria' (e futuramente
        // 'chamado'), que não tem plano_id — ver tipoNomeOrdem/localNomeOrdem
        // em src/data/manutencao.ts para a lógica de fallback na exibição.
        '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*)), tipos_atividade(*), locais(*)',
      )
      .eq('data_prevista', hoje());

    if (!error) {
      setOrdensHoje((data ?? []) as OrdemServico[]);
    }
  }, []);

  // Refetch conjunto das duas consultas — usado por toda mutação que pode
  // afetar tanto o conjunto amplo quanto o de hoje.
  const recarregarOrdens = useCallback(async () => {
    await Promise.all([carregarOrdens(), carregarOrdensHoje()]);
  }, [carregarOrdens, carregarOrdensHoje]);

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

  // Nome do responsável por rota — via api/listar-funcionarios.ts porque
  // `usuarios` tem RLS habilitada sem política ainda (a anon key usada por
  // `supabase` aqui não consegue ler nada lá).
  const carregarFuncionariosNomes = useCallback(async () => {
    try {
      const resposta = await fetch('/api/listar-funcionarios');
      const dados = (await resposta.json().catch(() => null)) as {
        funcionarios?: { id: string; nome: string }[];
      } | null;

      if (!resposta.ok) {
        return;
      }

      const mapa: Record<string, string> = {};
      for (const item of dados?.funcionarios ?? []) {
        mapa[item.id] = item.nome;
      }
      setFuncionariosPorId(mapa);
    } catch {
      // Falha aqui não trava a tela — o card só mostra "Sem responsável"
      // mesmo quando funcionario_id está preenchido, em vez do nome.
    }
  }, []);

  // Catálogo de Ambientes usado pelo seletor de "Local" do formulário de
  // plano — só os ativos, mesmo padrão de app/admin/ambientes.tsx.
  const carregarAmbientes = useCallback(async () => {
    try {
      const lista = await listarAmbientes();
      setAmbientesAtivos(lista.filter((item) => item.ativo));
    } catch {
      // Falha aqui não trava o resto da tela — o seletor de local só fica
      // vazio; o restante do formulário de plano continua funcional.
    }
  }, []);

  // Extraordinárias: ordens_servico sem plano, com título/tipo/local na
  // própria linha (por isso os joins diretos, não via planos_manutencao).
  // 'chamado' fica de fora de propósito — módulo ainda não construído.
  const carregarExtraordinarias = useCallback(async () => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('*, tipos_atividade(*), locais(*)')
      .eq('origem', 'extraordinaria')
      .order('data_prevista', { ascending: true })
      .limit(1000);

    if (!error) {
      setExtraordinarias((data ?? []) as OrdemServico[]);
    }
  }, []);

  const carregarTudo = useCallback(async () => {
    await Promise.all([
      carregarPlanos(),
      recarregarOrdens(),
      carregarExtraordinarias(),
    ]);
  }, [carregarPlanos, recarregarOrdens, carregarExtraordinarias]);

  useEffect(() => {
    setCarregando(true);
    Promise.all([
      carregarPlanos(),
      carregarTipos(),
      recarregarOrdens(),
      carregarRotas(),
      carregarAmbientes(),
      carregarExtraordinarias(),
      carregarFuncionariosNomes(),
    ]).finally(() => {
      setCarregando(false);
      // Top-up silencioso: roda depois do primeiro carregamento, sem
      // bloquear a tela; só recarrega as ordens ao terminar.
      preencherOcorrenciasFaltantes().then(() => {
        recarregarOrdens();
      });
    });
  }, [
    carregarPlanos,
    carregarTipos,
    recarregarOrdens,
    carregarRotas,
    carregarAmbientes,
    carregarExtraordinarias,
    carregarFuncionariosNomes,
  ]);

  // Guarda a versão mais atual de recarregarOrdens sem entrar nas
  // dependências do efeito de Realtime abaixo — o efeito de baixo roda só
  // uma vez por montagem, e o callback sempre chama a versão corrente via
  // ref, nunca uma versão presa (stale) da primeira montagem.
  const recarregarOrdensRef = useRef(recarregarOrdens);
  useEffect(() => {
    recarregarOrdensRef.current = recarregarOrdens;
  }, [recarregarOrdens]);

  // Realtime: qualquer INSERT/UPDATE/DELETE em ordens_servico (feito por
  // este admin, pela execução, ou por outra sessão) refaz o mesmo refetch
  // já usado para atualizar "Atividades do dia"/agrupamentos por rota —
  // sem duplicar a lógica de busca.
  //
  // Nome do canal com sufixo aleatório gerado a cada montagem: o
  // unsubscribe de RealtimeClient é assíncrono (só some da lista interna
  // quando o servidor confirma o close), então remontar rápido podia
  // reaproveitar um canal com remoção ainda pendente — já inscrito — e
  // `.on()` estourava "cannot add `postgres_changes` callbacks ... after
  // `subscribe()`", derrubando a tela inteira por falta de ErrorBoundary
  // (agora existe em app/_layout.tsx, mas a causa continua sendo esta).
  // Deps vazias: sem isso o efeito nunca precisa rodar de novo na mesma
  // montagem.
  useEffect(() => {
    const sufixo = Math.random().toString(36).slice(2, 8);
    const canal = supabase
      .channel(`admin-preservacao-ordens-servico-${sufixo}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordens_servico' },
        () => {
          recarregarOrdensRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

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

  // Ordens de hoje, para a seção "Atividades do dia" — já vêm filtradas
  // por data_prevista=hoje direto no banco (carregarOrdensHoje), sem
  // aplicar os filtros de tipo/prioridade/periodicidade/atrasadas.
  const atividadesDoDia = ordensHoje;

  // Pendentes de validação — mesma fonte de dados de "Atividades do dia"
  // (ordensHoje já cobre rotina e extraordinária de hoje, sem filtro de
  // origem), só filtrada por concluída+não validada. É a mesma condição
  // que o ValidacaoGuiada busca sozinho ao abrir (data_prevista=hoje,
  // status=concluida, validada=false) — aqui só reaproveitada como lista
  // já visível na tela, sem precisar abrir nada.
  // Ordens com override local (validada/reprovada por aqui) continuam na
  // lista mesmo depois que a assinatura Realtime desta tela refizer o
  // fetch e trouxer validada=true (ou status='pendente', no caso de
  // reprovação) do banco — sem isso, o item some da lista no instante em
  // que o UPDATE chega, em vez de virar o selo "sem recarregar a tela".
  const pendentesValidacao = useMemo(() => {
    return ordensHoje.filter((o) => {
      if (o.id in validacaoOverrides) {
        return true;
      }
      return o.status === 'concluida' && !o.validada;
    });
  }, [ordensHoje, validacaoOverrides]);

  // Pendentes de validação agrupadas por rota — extraordinária (sem plano,
  // logo sem rota) cai num grupo "Avulsas" próprio, mesma convenção de
  // atividadesAgrupadas logo abaixo. Um grupo só aparece enquanto tiver
  // pelo menos uma atividade sem override (genuinamente pendente); quando
  // a última é validada/reprovada, o grupo inteiro (cabeçalho incluído)
  // some da lista, mesmo que outras já mostrem selo.
  const gruposValidacao = useMemo(() => {
    const mapa = new Map<
      string,
      { chave: string; nome: string; itens: OrdemServico[] }
    >();

    for (const ordem of pendentesValidacao) {
      const rota = ordem.planos_manutencao?.rotas;
      const chave = rota?.id ?? 'sem-rota';
      const nome = rota?.nome ?? 'Avulsas';
      const grupo = mapa.get(chave);
      if (grupo) {
        grupo.itens.push(ordem);
      } else {
        mapa.set(chave, { chave, nome, itens: [ordem] });
      }
    }

    return Array.from(mapa.values()).filter((grupo) =>
      grupo.itens.some((ordem) => !(ordem.id in validacaoOverrides)),
    );
  }, [pendentesValidacao, validacaoOverrides]);

  function toggleValidacaoGrupoExpandido(chave: string) {
    setValidacaoGruposExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
  }

  // Agrupa as atividades de hoje por rota (ordenadas por ordem_na_rota).
  // Extraordinárias (sem plano, logo sem rota) vão para um grupo próprio,
  // à parte, ordenado por prioridade (Alta > Média > Baixa) — aparece
  // ANTES de tudo que é rotina na renderização, mesmo dos grupos por rota.
  // Rotina sem rota atribuída continua em semRota, como já era.
  const atividadesAgrupadas = useMemo(() => {
    const grupos = new Map<string, { rota: Rota; itens: OrdemServico[] }>();
    const extraordinarias: OrdemServico[] = [];
    const semRota: OrdemServico[] = [];

    for (const ordem of atividadesDoDia) {
      if (ordem.origem === 'extraordinaria') {
        extraordinarias.push(ordem);
        continue;
      }

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

    extraordinarias.sort(
      (a, b) =>
        pesoPrioridade(prioridadeOrdem(a)) - pesoPrioridade(prioridadeOrdem(b)),
    );

    return { extraordinarias, grupos: Array.from(grupos.values()), semRota };
  }, [atividadesDoDia]);

  // Planos com ao menos uma ordem pendente/em andamento e atrasada (para o
  // chip "Atrasadas" e para o badge nos chips de Tipo).
  const planoIdsAtrasados = useMemo(() => {
    const hojeStr = hoje();
    const ids = new Set<string>();

    for (const ordem of ordens) {
      if (
        ordem.plano_id &&
        ordem.status !== 'concluida' &&
        ordem.data_prevista < hojeStr
      ) {
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
      if (ordem.plano_id && ordem.data_prevista === selectedDate) {
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
    const termoBusca = normalizarTexto(buscaPlano.trim());

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
      if (termoBusca && !normalizarTexto(plano.titulo).includes(termoBusca)) {
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
    buscaPlano,
  ]);

  // Extraordinárias sujeitas aos MESMOS filtros da lista de planos, na
  // medida em que fazem sentido: tipo, prioridade, busca por texto e dia
  // selecionado (comparado com o prazo). O chip de Periodicidade zera a
  // lista de propósito — atividade avulsa não tem recorrência, então não
  // pertence a nenhuma das periodicidades filtradas.
  const extraordinariasFiltradas = useMemo(() => {
    const termoBusca = normalizarTexto(buscaPlano.trim());
    const hojeStr = hoje();

    return extraordinarias.filter((ordem) => {
      if (periodicidadeFiltros.length > 0) {
        return false;
      }
      if (
        tipoFiltros.length > 0 &&
        (!ordem.tipo_id || !tipoFiltros.includes(ordem.tipo_id))
      ) {
        return false;
      }
      if (
        prioridadeFiltros.length > 0 &&
        (!ordem.prioridade || !prioridadeFiltros.includes(ordem.prioridade))
      ) {
        return false;
      }
      if (
        atrasadasFiltro &&
        !(ordem.status !== 'concluida' && ordem.data_prevista < hojeStr)
      ) {
        return false;
      }
      if (selectedDate && ordem.data_prevista !== selectedDate) {
        return false;
      }
      if (
        termoBusca &&
        !normalizarTexto(tituloOrdem(ordem)).includes(termoBusca)
      ) {
        return false;
      }
      return true;
    });
  }, [
    extraordinarias,
    tipoFiltros,
    prioridadeFiltros,
    periodicidadeFiltros,
    atrasadasFiltro,
    selectedDate,
    buscaPlano,
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

  const localAmbienteSelecionado = useMemo(
    () => ambientesAtivos.find((item) => item.id === localId) ?? null,
    [ambientesAtivos, localId],
  );

  const extraLocalSelecionado = useMemo(
    () => ambientesAtivos.find((item) => item.id === extraLocalId) ?? null,
    [ambientesAtivos, extraLocalId],
  );

  const filtrarAmbientesPorNome = useCallback(
    (termoBruto: string) => {
      const termo = normalizarTexto(termoBruto.trim());
      return termo
        ? ambientesAtivos.filter((item) =>
            normalizarTexto(item.nome).includes(termo),
          )
        : ambientesAtivos;
    },
    [ambientesAtivos],
  );

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

  // Menu de 3 pontos dos cards de extraordinária em "Todos os planos
  // cadastrados" — mesmo padrão de handleAbrirMenu/handleAbrirMenuAtividade,
  // com estado (menuExtraAbertoId) dedicado a esta lista.
  function handleAbrirMenuExtra(id: string) {
    if (menuExtraAbertoId === id) {
      fecharMenuExtra();
      return;
    }

    const ref = menuExtraIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _width, height) => {
      setMenuExtraAncora({ x, y: y + height });
      setMenuExtraAbertoId(id);
    });
  }

  function fecharMenuExtra() {
    setMenuExtraAbertoId(null);
  }

  // Menu de 3 pontos do card de rota em "Atividades do dia" — mesmo padrão
  // de handleAbrirMenuExtra/handleAbrirMenuAtividade.
  function handleAbrirMenuRota(id: string) {
    if (menuRotaAbertaId === id) {
      fecharMenuRota();
      return;
    }

    const ref = menuRotaIconRefs.current.get(id);
    ref?.measureInWindow((x, y, _width, height) => {
      setMenuRotaAncora({ x, y: y + height });
      setMenuRotaAbertaId(id);
    });
  }

  function fecharMenuRota() {
    setMenuRotaAbertaId(null);
  }

  // Não existia tela/modal de edição de rota antes disto — só criação
  // ("Nova rota") e atribuição de plano a uma rota. Carrega os funcionários
  // de zeladoria ativos sob demanda (só quando o modal abre), mesma fonte
  // de api/listar-funcionarios.ts usada em app/admin/funcionarios.tsx.
  async function abrirModalEditarRota(rota: Rota) {
    fecharMenuRota();
    setRotaEditandoId(rota.id);
    setNomeEditarRota(rota.nome);
    setResponsavelEditarRotaId(rota.funcionario_id);
    setErroModalEditarRota(null);
    setModalEditarRotaVisivel(true);

    setCarregandoFuncionariosZeladoria(true);
    try {
      const resposta = await fetch('/api/listar-funcionarios');
      const dados = (await resposta.json().catch(() => null)) as {
        funcionarios?: {
          id: string;
          nome: string;
          papel: string;
          ativo: boolean;
        }[];
        erro?: string;
      } | null;

      if (!resposta.ok) {
        throw new Error(
          dados?.erro ?? 'Não foi possível carregar os funcionários.',
        );
      }

      const zeladoriaAtiva = (dados?.funcionarios ?? []).filter(
        (item) => item.papel === 'zeladoria' && item.ativo,
      );
      setFuncionariosZeladoria(zeladoriaAtiva);
    } catch (erro) {
      setErroModalEditarRota(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível carregar os funcionários.',
      );
    } finally {
      setCarregandoFuncionariosZeladoria(false);
    }
  }

  function fecharModalEditarRota() {
    setModalEditarRotaVisivel(false);
    setRotaEditandoId(null);
  }

  async function handleSalvarEditarRota() {
    if (!rotaEditandoId || salvandoEditarRota) {
      return;
    }
    if (!nomeEditarRota.trim()) {
      setErroModalEditarRota('Informe o nome da rota.');
      return;
    }

    setSalvandoEditarRota(true);
    setErroModalEditarRota(null);

    const { data, error } = await supabase
      .from('rotas')
      .update({
        nome: nomeEditarRota.trim(),
        funcionario_id: responsavelEditarRotaId,
      })
      .eq('id', rotaEditandoId)
      .select()
      .single();

    setSalvandoEditarRota(false);

    if (error || !data) {
      setErroModalEditarRota(
        error?.message ?? 'Não foi possível salvar a rota.',
      );
      return;
    }

    const rotaAtualizada = data as Rota;
    setRotas((atual) =>
      atual.map((item) => (item.id === rotaEditandoId ? rotaAtualizada : item)),
    );
    setModalEditarRotaVisivel(false);
    setRotaEditandoId(null);
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

    recarregarOrdens();
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

    recarregarOrdens();
  }

  function limparFormulario() {
    setTitulo('');
    setDescricao('');
    setLocalId(null);
    setPeriodicidade('Mensal');
    setPrioridade('Média');
    setDataInicio(hoje());
    setObservacoes('');
    setRotaId(null);
    setOrdemNaRota('');
    setOrdemNaRotaEditadoManualmente(false);
  }

  // Se o plano só tem "local" de texto (dado antigo, local_id nulo),
  // pré-seleciona no seletor o ambiente cujo nome bate exatamente — sem
  // correspondência, deixa o seletor vazio em vez de quebrar a tela.
  function encontrarLocalIdPorTexto(localTexto: string): string | null {
    const texto = localTexto.trim();
    if (!texto) {
      return null;
    }
    const encontrado = ambientesAtivos.find((item) => item.nome === texto);
    return encontrado?.id ?? null;
  }

  function preencherFormulario(plano: PlanoManutencao) {
    setTitulo(plano.titulo);
    setTipoId(plano.tipo_id);
    setDescricao(plano.descricao ?? '');
    setLocalId(
      plano.local_id ??
        (plano.local ? encontrarLocalIdPorTexto(plano.local) : null),
    );
    setPeriodicidade(plano.periodicidade);
    setPrioridade(plano.prioridade);
    setDataInicio(plano.data_inicio);
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
    setCalendarioDataInicioVisivel(false);
    setSeletorLocalVisivel(false);
    setModalVisivel(true);
  }

  // O "+" do cabeçalho abre um menu com os dois tipos de criação (plano de
  // rotina e atividade extraordinária), ancorado no próprio botão — mesmo
  // CardMenu usado pelos menus de 3 pontos dos cards.
  function abrirMenuCriar() {
    botaoCriarRef.current?.measureInWindow((x, y, _largura, altura) => {
      setMenuCriarAncora({ x, y: y + altura });
      setMenuCriarVisivel(true);
    });
  }

  function abrirModalExtraordinaria() {
    setMenuCriarVisivel(false);
    setExtraEditingId(null);
    setExtraTitulo('');
    setExtraTipoId(null);
    setExtraLocalId(null);
    setExtraPrioridade(null);
    setExtraPrazo('');
    setExtraObservacoes('');
    setErroModalExtra(null);
    setExtraSeletorLocalVisivel(false);
    setExtraCalendarioVisivel(false);
    setModalExtraVisivel(true);
  }

  // Reaproveita o MESMO modal da criação, só pré-preenchido e com
  // extraEditingId setado — chamado tanto pelo menu de "Todos os planos
  // cadastrados" quanto pelo de "Atividades do dia" (ver menuExtraAbertoId
  // e menuAtividadeAbertaId), sem duplicar esta lógica entre as duas listas.
  function abrirModalEditarExtraordinaria(ordem: OrdemServico) {
    fecharMenuExtra();
    fecharMenuAtividade();
    setExtraEditingId(ordem.id);
    setExtraTitulo(tituloOrdem(ordem));
    setExtraTipoId(ordem.tipo_id);
    setExtraLocalId(ordem.local_id);
    setExtraPrioridade(ordem.prioridade);
    setExtraPrazo(ordem.data_prevista);
    setExtraObservacoes(ordem.observacao ?? '');
    setErroModalExtra(null);
    setExtraSeletorLocalVisivel(false);
    setExtraCalendarioVisivel(false);
    setModalExtraVisivel(true);
  }

  function fecharModalExtraordinaria() {
    setModalExtraVisivel(false);
    setExtraEditingId(null);
    setExtraSeletorLocalVisivel(false);
    setExtraCalendarioVisivel(false);
  }

  const extraFormularioCompleto =
    extraTitulo.trim().length > 0 &&
    extraTipoId !== null &&
    extraLocalId !== null &&
    extraPrioridade !== null &&
    extraPrazo.trim().length > 0;

  async function handleSalvarExtraordinaria() {
    if (
      extraSalvando ||
      !extraFormularioCompleto ||
      !extraTipoId ||
      !extraLocalId ||
      !extraPrioridade
    ) {
      return;
    }

    setExtraSalvando(true);
    setErroModalExtra(null);

    const dadosExtra = {
      titulo: extraTitulo,
      tipo_id: extraTipoId,
      local_id: extraLocalId,
      prioridade: extraPrioridade,
      data_prevista: extraPrazo,
      observacao: extraObservacoes,
    };

    try {
      if (extraEditingId) {
        await atualizarAtividadeExtraordinaria(extraEditingId, dadosExtra);
      } else {
        await criarAtividadeExtraordinaria(dadosExtra);
      }

      setModalExtraVisivel(false);
      setExtraEditingId(null);
      // Recarrega extraordinarias (alimenta "Todos os planos cadastrados")
      // E ordensHoje/ordens (alimenta "Atividades do dia") — mudar o prazo
      // pode tirar/colocar a ordem na janela de hoje, então as duas listas
      // precisam refletir o novo data_prevista, não só a primeira.
      await Promise.all([carregarExtraordinarias(), recarregarOrdens()]);
    } catch (erro) {
      setErroModalExtra(
        erro instanceof Error
          ? erro.message
          : extraEditingId
            ? 'Não foi possível atualizar a atividade extraordinária.'
            : 'Não foi possível criar a atividade extraordinária.',
      );
    } finally {
      setExtraSalvando(false);
    }
  }

  function fecharModal() {
    setModalVisivel(false);
    setEditingId(null);
    setCalendarioDataInicioVisivel(false);
    setSeletorLocalVisivel(false);
  }

  function handleEditar(plano: PlanoManutencao) {
    preencherFormulario(plano);
    setEditingId(plano.id);
    setErroModal(null);
    setCalendarioDataInicioVisivel(false);
    setSeletorLocalVisivel(false);
    setModalVisivel(true);
  }

  function handleDuplicar(plano: PlanoManutencao) {
    preencherFormulario(plano);
    setTitulo(`${plano.titulo} (cópia)`);
    setEditingId(null);
    setErroModal(null);
    setCalendarioDataInicioVisivel(false);
    setSeletorLocalVisivel(false);
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

    let condominioId: string;
    try {
      condominioId = await resolverCondominioId();
    } catch (erro) {
      setCriandoRota(false);
      setErroModalRota(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível identificar o condomínio.',
      );
      return;
    }

    const { data, error } = await supabase
      .from('rotas')
      .insert({
        nome: nomeNovaRota.trim(),
        ativo: true,
        condominio_id: condominioId,
      })
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
    if (atribuindoRota || !planoAtribuirRotaId || !rotaSelecionadaAtribuir) {
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

  function abrirModalValidacao(ordemId: string) {
    fecharMenuAtividade();
    setOrdemValidacaoInicialId(ordemId);
    setModalValidacaoVisivel(true);
  }

  function handleFinalizarValidacao() {
    setModalValidacaoVisivel(false);
    setOrdemValidacaoInicialId(null);
    carregarTudo();
  }

  async function handleValidarLinha(ordemId: string, qualidade: Qualidade) {
    if (processandoValidacaoId) {
      return;
    }
    setProcessandoValidacaoId(ordemId);
    setErroValidacaoLinhaId(null);

    const { error } = await validarOrdem(ordemId, qualidade);

    setProcessandoValidacaoId(null);

    if (error) {
      setErroValidacaoLinhaId(ordemId);
      setErroValidacaoLinhaTexto(error);
      return;
    }

    setValidacaoOverrides((atual) => ({
      ...atual,
      [ordemId]: { tipo: 'qualidade', valor: qualidade },
    }));
  }

  function handleAbrirReprovarLinha(ordemId: string) {
    setReprovandoLinhaId(ordemId);
    setMotivoReprovacaoLinha('');
    setErroValidacaoLinhaId(null);
  }

  function handleCancelarReprovarLinha() {
    setReprovandoLinhaId(null);
    setMotivoReprovacaoLinha('');
  }

  async function handleConfirmarReprovarLinha(ordemId: string) {
    if (processandoValidacaoId) {
      return;
    }
    setProcessandoValidacaoId(ordemId);
    setErroValidacaoLinhaId(null);

    const { error } = await reprovarOrdem(ordemId, motivoReprovacaoLinha);

    setProcessandoValidacaoId(null);

    if (error) {
      setErroValidacaoLinhaId(ordemId);
      setErroValidacaoLinhaTexto(error);
      return;
    }

    setReprovandoLinhaId(null);
    setMotivoReprovacaoLinha('');
    setValidacaoOverrides((atual) => ({
      ...atual,
      [ordemId]: { tipo: 'reprovada' },
    }));
  }

  async function handleSalvar() {
    if (isSubmitting) {
      return;
    }

    if (!titulo.trim() || !tipoId || !dataInicio.trim() || !rotaId) {
      setErroModal('Preencha título, tipo, data de início e rota.');
      return;
    }

    setIsSubmitting(true);
    setErroModal(null);

    const ordemNaRotaNumero =
      rotaId && ordemNaRota.trim() ? Number(ordemNaRota) : null;

    try {
      if (editingId) {
        // Se data_inicio e/ou periodicidade mudaram, backfilla as ordens
        // que a configuração NOVA exige e ainda não existem — sem isso
        // nada gera ordens novas: o update em si não toca ordens_servico,
        // e o top-up (topUpOcorrencias.ts) só estende a janela para FRENTE
        // a partir da ÚLTIMA ordem já existente, nunca preenche buracos
        // atrás dela nem reage a mudança de periodicidade.
        const { data: planoAtual, error: erroPlanoAtual } = await supabase
          .from('planos_manutencao')
          .select('data_inicio, periodicidade, condominio_id')
          .eq('id', editingId)
          .single();

        if (erroPlanoAtual) {
          setErroModal(erroPlanoAtual.message);
          return;
        }

        if (
          planoAtual.data_inicio !== dataInicio ||
          planoAtual.periodicidade !== periodicidade
        ) {
          const { data: ordensExistentes, error: erroOrdensExistentes } =
            await supabase
              .from('ordens_servico')
              .select('data_prevista')
              .eq('plano_id', editingId);

          if (erroOrdensExistentes) {
            setErroModal(erroOrdensExistentes.message);
            return;
          }

          // Nenhum status é considerado aqui de propósito: uma ordem já
          // concluída/em andamento conta como "já existe" tanto quanto uma
          // pendente — nunca é apagada, tocada ou duplicada por esta
          // rotina. O que "sobra" de uma periodicidade antiga mais densa
          // fica no banco sem alteração; removê-las é ação manual do
          // usuário via "Excluir" no card, fora do escopo daqui.
          const datasExistentes = new Set(
            (ordensExistentes ?? []).map((ordem) => ordem.data_prevista),
          );

          const ateDataPorHoje = adicionarDiasChave(hoje(), JANELA_DIAS);
          const ateDataPorInicio = adicionarDiasChave(dataInicio, JANELA_DIAS);
          const ateData =
            ateDataPorHoje > ateDataPorInicio
              ? ateDataPorHoje
              : ateDataPorInicio;

          const datasEsperadas = gerarDatasOcorrencia(
            dataInicio,
            periodicidade,
            ateData,
          );
          const datasFaltantes = datasEsperadas.filter(
            (data) => !datasExistentes.has(data),
          );

          if (datasFaltantes.length > 0) {
            const { error: erroBackfill } = await supabase
              .from('ordens_servico')
              .insert(
                datasFaltantes.map((data) => ({
                  plano_id: editingId,
                  data_prevista: data,
                  status: 'pendente',
                  // Herda do próprio plano (já buscado acima) — nunca
                  // resolve de novo pela sessão.
                  condominio_id: planoAtual.condominio_id,
                })),
              );

            if (erroBackfill) {
              setErroModal(erroBackfill.message);
              return;
            }
          }
        }

        const { data, error } = await supabase
          .from('planos_manutencao')
          .update({
            titulo,
            tipo_id: tipoId,
            descricao: descricao || null,
            local_id: localId,
            periodicidade,
            prioridade,
            data_inicio: dataInicio,
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
        let condominioId: string;
        try {
          condominioId = await resolverCondominioId();
        } catch (erro) {
          setErroModal(
            erro instanceof Error
              ? erro.message
              : 'Não foi possível identificar o condomínio.',
          );
          return;
        }

        const { data: plano, error: erroPlano } = await supabase
          .from('planos_manutencao')
          .insert({
            titulo,
            tipo_id: tipoId,
            descricao: descricao || null,
            local_id: localId,
            periodicidade,
            prioridade,
            data_inicio: dataInicio,
            observacoes: observacoes || null,
            rota_id: rotaId,
            ordem_na_rota: ordemNaRotaNumero,
            condominio_id: condominioId,
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
              // Herda do plano recém-criado (não resolve de novo) — a
              // ordem nasce sempre no mesmo condomínio do plano que a
              // gerou.
              condominio_id: plano.condominio_id,
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

  // Extraída do antigo .map() plano de "Pendentes de validação" — mesma
  // lógica de exibição (selo vs. botões), agora reaproveitada dentro de
  // cada grupo por rota. Nenhuma mudança na lógica de validação em si.
  function renderLinhaValidacao(ordem: OrdemServico) {
    const override = validacaoOverrides[ordem.id];
    const local = localNomeOrdem(ordem);
    const processandoLinha = processandoValidacaoId === ordem.id;
    const reprovandoEstaLinha = reprovandoLinhaId === ordem.id;

    return (
      <View key={ordem.id} style={styles.linhaValidacao}>
        <View style={styles.linhaValidacaoTextos}>
          <Text style={styles.linhaValidacaoTitulo}>{tituloOrdem(ordem)}</Text>
          <Text style={styles.linhaValidacaoDetalhe}>
            {local ? `${local} · ` : ''}Concluído por:{' '}
            {ordem.concluida_por ?? '—'}
          </Text>
          {erroValidacaoLinhaId === ordem.id && erroValidacaoLinhaTexto ? (
            <Text style={styles.erro}>{erroValidacaoLinhaTexto}</Text>
          ) : null}

          {reprovandoEstaLinha ? (
            <View style={styles.reprovarLinhaForm}>
              <TextInput
                value={motivoReprovacaoLinha}
                onChangeText={setMotivoReprovacaoLinha}
                placeholder="Descreva o motivo"
                placeholderTextColor={light.textSecondary}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.inputMultiline]}
              />
              <View style={styles.reprovarLinhaBotoes}>
                <Pressable
                  style={styles.botaoLinhaSecundario}
                  onPress={handleCancelarReprovarLinha}
                  disabled={processandoLinha}
                >
                  <Text style={styles.botaoLinhaSecundarioTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.botaoLinhaPerigo}
                  onPress={() => handleConfirmarReprovarLinha(ordem.id)}
                  disabled={processandoLinha}
                >
                  <Text style={styles.botaoLinhaPerigoTexto}>
                    {processandoLinha ? 'Reprovando…' : 'Confirmar reprovação'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {!reprovandoEstaLinha ? (
          <View style={styles.linhaValidacaoAcoes}>
            {override ? (
              override.tipo === 'qualidade' ? (
                <View
                  style={[
                    styles.seloValidacao,
                    {
                      borderColor: getQualidadeInfo(override.valor).color,
                      backgroundColor: `${getQualidadeInfo(override.valor).color}0D`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.seloValidacaoTexto,
                      { color: getQualidadeInfo(override.valor).color },
                    ]}
                  >
                    ✓ {getQualidadeInfo(override.valor).label}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.seloValidacao,
                    {
                      borderColor: semantic.overdue,
                      backgroundColor: `${semantic.overdue}0D`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.seloValidacaoTexto,
                      { color: semantic.overdue },
                    ]}
                  >
                    ✕ Reprovada
                  </Text>
                </View>
              )
            ) : (
              <>
                {(['bom', 'medio', 'ruim'] as Qualidade[]).map((opcao) => {
                  const info = getQualidadeInfo(opcao);
                  return (
                    <Pressable
                      key={opcao}
                      style={[
                        styles.botaoQualidadeLinha,
                        {
                          borderColor: info.color,
                          backgroundColor: `${info.color}0D`,
                        },
                      ]}
                      onPress={() => handleValidarLinha(ordem.id, opcao)}
                      disabled={processandoLinha}
                    >
                      <Text
                        style={[
                          styles.botaoQualidadeLinhaTexto,
                          { color: info.color },
                        ]}
                      >
                        {info.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={styles.botaoLinhaSecundario}
                  onPress={() => handleAbrirReprovarLinha(ordem.id)}
                  disabled={processandoLinha}
                >
                  <Text style={styles.botaoLinhaSecundarioTexto}>Reprovar</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  function renderAtividadeCard(ordem: OrdemServico, compacto = false) {
    const plano = ordem.planos_manutencao;
    // União de fonte: rotina lê do plano; extraordinária (e futuramente
    // chamado), sem plano_id, lê das colunas/joins diretos da própria
    // ordem — ver helpers em src/data/manutencao.ts.
    const localAtividade = localNomeOrdem(ordem);
    const prioridadeAtividade = prioridadeOrdem(ordem);
    // Mesmo destaque visual (borda/fundo em tinta + selo) usado nos cards
    // de extraordinária em app/preservacao.tsx — estilos extraCardAdmin/
    // seloExtra/seloExtraTexto já existem no StyleSheet deste arquivo,
    // reaproveitados aqui em vez de duplicados (eram usados só pela lista
    // "Todos os planos cadastrados").
    const extraordinaria = ordem.origem === 'extraordinaria';
    const menuAberto = menuAtividadeAbertaId === ordem.id;
    const tempoExecucaoTexto =
      ordem.status === 'concluida' && ordem.iniciado_em && ordem.concluida_em
        ? formatarDuracao(
            Math.max(
              0,
              (new Date(ordem.concluida_em).getTime() -
                new Date(ordem.iniciado_em).getTime()) /
                1000 -
                ordem.tempo_pausado_segundos,
            ),
          )
        : null;

    return (
      <Fragment key={ordem.id}>
        <View
          style={[
            styles.planoCard,
            compacto && styles.planoCardCompacto,
            extraordinaria && styles.extraCardAdmin,
          ]}
        >
          <View style={styles.planoCabecalho}>
            <View style={styles.planoCabecalhoTitulos}>
              <Text style={styles.planoTitulo}>{tituloOrdem(ordem)}</Text>
              {extraordinaria ? (
                <View style={styles.seloExtra}>
                  <Text style={styles.seloExtraTexto}>Extraordinária</Text>
                </View>
              ) : null}
            </View>
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

          <Text style={styles.planoTipo}>{tipoNomeOrdem(ordem)}</Text>
          {localAtividade ? (
            <Text style={styles.planoDetalhe}>{localAtividade}</Text>
          ) : null}

          <View style={styles.planoRodape}>
            <View style={styles.planoRodapeEsquerda}>
              <StatusBadge ordem={ordem} />
              {tempoExecucaoTexto ? (
                <View style={styles.tempoQualidadeRow}>
                  <Text style={styles.tempoExecucao}>
                    Tempo: {tempoExecucaoTexto}
                  </Text>
                  {ordem.validada && ordem.qualidade ? (
                    <View style={styles.qualidadeIndicador}>
                      <View
                        style={[
                          styles.qualidadeBolinha,
                          {
                            backgroundColor: getQualidadeInfo(ordem.qualidade)
                              .color,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.qualidadeTexto,
                          { color: getQualidadeInfo(ordem.qualidade).color },
                        ]}
                      >
                        {getQualidadeInfo(ordem.qualidade).label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            {prioridadeAtividade ? (
              <Chip
                label={prioridadeAtividade}
                color={getCorPrioridade(prioridadeAtividade)}
              />
            ) : null}
          </View>

          {ordem.status === 'concluida' && !ordem.validada ? (
            <Pressable
              style={styles.botaoValidar}
              onPress={() => abrirModalValidacao(ordem.id)}
            >
              <Text style={styles.botaoValidarTexto}>Validar</Text>
            </Pressable>
          ) : null}
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
                onPress={() =>
                  extraordinaria
                    ? abrirModalEditarExtraordinaria(ordem)
                    : plano && handleMenuEditar(plano)
                }
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
                ordemId={ordem.id}
                planoId={ordem.plano_id}
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

  // Overlay de "Data de início" — mesmo motivo do de cima: INLINE dentro
  // do modal de plano, nunca um <Modal> próprio empilhado. Datas passadas
  // só ficam bloqueadas para planos NOVOS; editar um plano existente com
  // data original passada continua permitido (não trava dado histórico).
  const calendarioDataInicioOverlay = calendarioDataInicioVisivel ? (
    <View style={styles.novaRotaOverlay}>
      <View style={styles.modalRotaCard}>
        <Text style={styles.modalTitulo}>Data de início</Text>

        <MiniCalendar
          markedDates={{}}
          selectedDate={dataInicio}
          onSelectDay={(data) => {
            setDataInicio(data);
            setCalendarioDataInicioVisivel(false);
          }}
          desabilitarAntesDe={editingId ? undefined : hoje()}
        />

        <View style={styles.modalBotoes}>
          <Pressable
            style={[styles.modalBotao, styles.modalBotaoCancelar]}
            onPress={() => setCalendarioDataInicioVisivel(false)}
          >
            <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : null;

  // Overlay de "Selecionar local" — mesmo motivo dos dois de cima: INLINE
  // dentro do modal que o acionar, nunca um <Modal> próprio empilhado. Busca
  // client-side (catálogo de Ambientes tende a ser pequeno/médio, sem
  // paginação no servidor). Parametrizado porque é usado por dois
  // formulários (plano de rotina e atividade extraordinária) — o estado de
  // cada um é próprio, o visual e a busca são os mesmos.
  function renderSeletorLocalOverlay(opcoes: {
    busca: string;
    onBuscaChange: (valor: string) => void;
    selecionadoId: string | null;
    onSelecionar: (id: string) => void;
    onLimpar: () => void;
    onFechar: () => void;
  }) {
    const lista = filtrarAmbientesPorNome(opcoes.busca);

    return (
      <View style={styles.novaRotaOverlay}>
        <View style={[styles.modalRotaCard, styles.modalLocalCard]}>
          <Text style={styles.modalTitulo}>Selecionar local</Text>

          <TextInput
            value={opcoes.busca}
            onChangeText={opcoes.onBuscaChange}
            placeholder="Buscar por nome"
            placeholderTextColor={light.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <ScrollView
            style={styles.modalLocalLista}
            keyboardShouldPersistTaps="handled"
          >
            {lista.length === 0 ? (
              <Text style={styles.vazio}>Nenhum ambiente encontrado.</Text>
            ) : (
              lista.map((ambiente) => (
                <Pressable
                  key={ambiente.id}
                  style={styles.linhaRota}
                  onPress={() => opcoes.onSelecionar(ambiente.id)}
                >
                  <Text style={styles.linhaRotaTexto}>{ambiente.nome}</Text>
                  <View
                    style={[
                      styles.linhaRotaIndicador,
                      opcoes.selecionadoId === ambiente.id &&
                        styles.linhaRotaIndicadorSelecionado,
                    ]}
                  >
                    {opcoes.selecionadoId === ambiente.id ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={styles.modalBotoes}>
            <Pressable
              style={[styles.modalBotao, styles.modalBotaoCancelar]}
              onPress={opcoes.onLimpar}
            >
              <Text style={styles.modalBotaoCancelarTexto}>Limpar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBotao, styles.modalBotaoSalvar]}
              onPress={opcoes.onFechar}
            >
              <Text style={styles.modalBotaoSalvarTexto}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const seletorLocalOverlay = seletorLocalVisivel
    ? renderSeletorLocalOverlay({
        busca: buscaLocal,
        onBuscaChange: setBuscaLocal,
        selecionadoId: localId,
        onSelecionar: (id) => {
          setLocalId(id);
          setSeletorLocalVisivel(false);
        },
        onLimpar: () => {
          setLocalId(null);
          setSeletorLocalVisivel(false);
        },
        onFechar: () => setSeletorLocalVisivel(false),
      })
    : null;

  const extraSeletorLocalOverlay = extraSeletorLocalVisivel
    ? renderSeletorLocalOverlay({
        busca: extraBuscaLocal,
        onBuscaChange: setExtraBuscaLocal,
        selecionadoId: extraLocalId,
        onSelecionar: (id) => {
          setExtraLocalId(id);
          setExtraSeletorLocalVisivel(false);
        },
        onLimpar: () => {
          setExtraLocalId(null);
          setExtraSeletorLocalVisivel(false);
        },
        onFechar: () => setExtraSeletorLocalVisivel(false),
      })
    : null;

  // Prazo da extraordinária: overlay inline (mesma razão dos demais) e,
  // diferente da data de início do plano, NUNCA permite data passada —
  // prazo é sempre para frente.
  const extraCalendarioOverlay = extraCalendarioVisivel ? (
    <View style={styles.novaRotaOverlay}>
      <View style={styles.modalRotaCard}>
        <Text style={styles.modalTitulo}>Prazo</Text>

        <MiniCalendar
          markedDates={{}}
          selectedDate={extraPrazo || null}
          onSelectDay={(data) => {
            setExtraPrazo(data);
            setExtraCalendarioVisivel(false);
          }}
          desabilitarAntesDe={hoje()}
        />

        <View style={styles.modalBotoes}>
          <Pressable
            style={[styles.modalBotao, styles.modalBotaoCancelar]}
            onPress={() => setExtraCalendarioVisivel(false)}
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
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </Pressable>

        <Text style={styles.title}>Zeladoria e Manutenção</Text>

        <Pressable
          ref={botaoCriarRef}
          onPress={abrirMenuCriar}
          style={({ pressed }) => [
            styles.novoBotaoPrincipal,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.novoBotaoPrincipalTexto}>Novo</Text>
        </Pressable>
      </View>

      {/* Porta de entrada única de criação — Fase 1 do redesenho: as três
          formas de criar algo nesta aba (rota, atividade/plano, extraordinária)
          partem só daqui. Cada opção abre o formulário existente
          correspondente, sem alterá-lo. */}
      <CardMenu
        visible={menuCriarVisivel}
        onClose={() => setMenuCriarVisivel(false)}
        anchorPosition={menuCriarAncora}
      >
        <Pressable
          style={styles.menuItem}
          onPress={() => {
            setMenuCriarVisivel(false);
            abrirModalRota();
          }}
        >
          <Text style={styles.menuItemTexto}>Nova rota</Text>
          <Text style={styles.menuItemDescricao}>
            Conjunto de atividades com um responsável.
          </Text>
        </Pressable>
        <Pressable
          style={styles.menuItem}
          onPress={() => {
            setMenuCriarVisivel(false);
            abrirModalNovo();
          }}
        >
          <Text style={styles.menuItemTexto}>Nova atividade</Text>
          <Text style={styles.menuItemDescricao}>
            Tarefa planejada, dentro de uma rota.
          </Text>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={abrirModalExtraordinaria}>
          <Text style={styles.menuItemTexto}>Atividade extraordinária</Text>
          <Text style={styles.menuItemDescricao}>
            Tarefa imprevista, fora das rotas.
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.menuConfirmacaoBotaoCancelar,
            styles.menuCriarBotaoCancelar,
          ]}
          onPress={() => setMenuCriarVisivel(false)}
        >
          <Text style={styles.menuConfirmacaoBotaoCancelarTexto}>Cancelar</Text>
        </Pressable>
      </CardMenu>

      {/* Mesmo overlay usado dentro dos modais de plano/atribuir rota (ver
          novaRotaOverlay) — aqui, fora de qualquer <Modal>, pra funcionar
          quando acionado direto pelo menu "+ Novo" acima, sem nenhum outro
          modal aberto por trás. Não é um <Modal> próprio (nunca foi), então
          não há risco de empilhar dois Modals simultâneos. */}
      {novaRotaOverlay}

      <ScrollView contentContainerStyle={styles.body}>
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}

        <TextInput
          value={buscaPlano}
          onChangeText={setBuscaPlano}
          placeholder="Buscar por nome"
          placeholderTextColor={light.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

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

        {gruposValidacao.length > 0 ? (
          <>
            <Text style={styles.secaoTitulo}>Pendentes de validação</Text>
            <View style={styles.listaValidacao}>
              {gruposValidacao.map((grupo) => {
                const pendentesCount = grupo.itens.filter(
                  (ordem) => !(ordem.id in validacaoOverrides),
                ).length;
                const expandido = validacaoGruposExpandidos.has(grupo.chave);

                return (
                  <View key={grupo.chave} style={styles.grupoValidacao}>
                    <Pressable
                      style={styles.grupoValidacaoCabecalho}
                      onPress={() => toggleValidacaoGrupoExpandido(grupo.chave)}
                    >
                      <Text style={styles.grupoValidacaoCabecalhoTexto}>
                        {grupo.nome} ({pendentesCount} pendente
                        {pendentesCount === 1 ? '' : 's'})
                      </Text>
                      <Ionicons
                        name={expandido ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={light.inkAction}
                      />
                    </Pressable>

                    {expandido ? (
                      <View style={styles.grupoValidacaoItens}>
                        {grupo.itens.map((ordem) =>
                          renderLinhaValidacao(ordem),
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Pressable
          style={styles.secaoTituloRow}
          onPress={() => setRotasSecaoAberta((v) => !v)}
        >
          <Text style={styles.secaoTitulo}>Rotas</Text>
          <Ionicons
            name={rotasSecaoAberta ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={light.textSecondary}
          />
        </Pressable>

        {rotasSecaoAberta ? (
          atividadesDoDia.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhuma atividade prevista para hoje.
            </Text>
          ) : (
            <View style={styles.listaGrupos}>
              {atividadesAgrupadas.extraordinarias.length > 0 ? (
                <View style={styles.lista}>
                  {atividadesAgrupadas.extraordinarias.map((ordem) =>
                    renderAtividadeCard(ordem),
                  )}
                </View>
              ) : null}

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
                  <Fragment key={rota.id}>
                    <View style={styles.grupoRota}>
                      <View style={styles.grupoRotaResumoCard}>
                        <View style={styles.grupoRotaResumoCabecalho}>
                          <Text style={styles.grupoRotaResumoTitulo}>
                            {rota.nome}
                          </Text>
                          <Pressable
                            ref={(el) => {
                              if (el) {
                                menuRotaIconRefs.current.set(rota.id, el);
                              }
                            }}
                            onPress={() => handleAbrirMenuRota(rota.id)}
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
                        </View>
                        <Text style={styles.grupoRotaResumoSubtitulo}>
                          {itens.length} atividades programadas para o dia
                        </Text>

                        {rota.funcionario_id ? (
                          <Text style={styles.grupoRotaResponsavelTexto}>
                            Responsável:{' '}
                            {funcionariosPorId[rota.funcionario_id] ??
                              'Funcionário'}
                          </Text>
                        ) : (
                          <View style={styles.seloSemResponsavel}>
                            <Text style={styles.seloSemResponsavelTexto}>
                              Sem responsável
                            </Text>
                          </View>
                        )}

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
                            color={light.inkAction}
                          />
                        </Pressable>
                      </View>

                      {expandida ? (
                        <View style={styles.atividadesRotaContainer}>
                          {itens.map((ordem) =>
                            renderAtividadeCard(ordem, true),
                          )}
                        </View>
                      ) : null}
                    </View>

                    <CardMenu
                      visible={menuRotaAbertaId === rota.id}
                      onClose={fecharMenuRota}
                      anchorPosition={menuRotaAncora}
                    >
                      <Pressable
                        style={styles.menuItem}
                        onPress={() => abrirModalEditarRota(rota)}
                      >
                        <Text style={styles.menuItemTexto}>Editar rota</Text>
                      </Pressable>
                    </CardMenu>
                  </Fragment>
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
          )
        ) : null}

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
              {!carregando &&
              planosFiltrados.length === 0 &&
              extraordinariasFiltradas.length === 0 ? (
                <Text style={styles.vazio}>
                  {buscaPlano.trim()
                    ? 'Nenhuma atividade encontrada.'
                    : 'Nenhuma atividade cadastrada.'}
                </Text>
              ) : null}

              {/* Extraordinárias primeiro: são avulsas e têm prazo próprio,
                  então não entram no .map de planos (que espera
                  PlanoManutencao e oferece editar/duplicar/rota/massa). */}
              {extraordinariasFiltradas.map((ordem) => (
                <Fragment key={ordem.id}>
                  <View style={styles.extraCardAdmin}>
                    <View style={styles.extraCabecalhoAdmin}>
                      <View style={styles.planoCabecalhoTitulos}>
                        <Text style={styles.planoTitulo}>
                          {tituloOrdem(ordem)}
                        </Text>
                        <View style={styles.seloExtra}>
                          <Text style={styles.seloExtraTexto}>
                            Extraordinária
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        ref={(el) => {
                          if (el) {
                            menuExtraIconRefs.current.set(ordem.id, el);
                          }
                        }}
                        onPress={() => handleAbrirMenuExtra(ordem.id)}
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
                    </View>

                    <Text style={styles.planoTipo}>
                      {ordem.tipos_atividade?.nome ?? 'Sem tipo'}
                    </Text>
                    {ordem.locais?.nome ? (
                      <Text style={styles.planoDetalhe}>
                        {ordem.locais.nome}
                      </Text>
                    ) : null}

                    <View style={styles.planoRodape}>
                      <Text style={styles.planoDetalhe}>
                        Prazo · {formatarDataBR(ordem.data_prevista)}
                      </Text>
                      {ordem.prioridade ? (
                        <Chip
                          label={ordem.prioridade}
                          color={getCorPrioridade(ordem.prioridade)}
                        />
                      ) : null}
                    </View>
                  </View>

                  <CardMenu
                    visible={menuExtraAbertoId === ordem.id}
                    onClose={fecharMenuExtra}
                    anchorPosition={menuExtraAncora}
                  >
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => abrirModalEditarExtraordinaria(ordem)}
                    >
                      <Text style={styles.menuItemTexto}>Editar</Text>
                    </Pressable>
                  </CardMenu>
                </Fragment>
              ))}

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

                      {nomeLocal(plano) ? (
                        <Text style={styles.planoDetalhe}>
                          {nomeLocal(plano)}
                        </Text>
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
                              ordemId={proximaOrdem.id}
                              planoId={proximaOrdem.plano_id}
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
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModal}
      >
        <View style={styles.telaAtribuir}>
          <View
            style={[
              styles.cabecalhoAtribuir,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoAtribuirBotao} />
            <Text style={styles.tituloAtribuir}>
              {editingId ? 'Editar atividade' : 'Nova atividade'}
            </Text>
            <Pressable
              style={styles.cabecalhoAtribuirBotao}
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
            contentContainerStyle={styles.corpoPlano}
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
              <Pressable
                style={styles.campoData}
                onPress={() => {
                  setBuscaLocal('');
                  setSeletorLocalVisivel(true);
                }}
              >
                <Text
                  style={
                    localAmbienteSelecionado
                      ? styles.campoDataTexto
                      : styles.campoDataTextoPlaceholder
                  }
                >
                  {localAmbienteSelecionado?.nome ?? 'Selecionar local'}
                </Text>
              </Pressable>
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
              <Text style={styles.label}>Data de início</Text>
              <Pressable
                style={styles.campoData}
                onPress={() => setCalendarioDataInicioVisivel(true)}
              >
                <Text style={styles.campoDataTexto}>
                  {formatarDataBR(dataInicio)}
                </Text>
              </Pressable>
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
          </ScrollView>

          <View
            style={[
              styles.rodapeAtribuir,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={[
                styles.botaoConfirmarAtribuir,
                (isSubmitting || !rotaId) &&
                  styles.botaoConfirmarAtribuirDesabilitado,
              ]}
              onPress={handleSalvar}
              disabled={isSubmitting || !rotaId}
            >
              <Text style={styles.botaoConfirmarAtribuirTexto}>
                {isSubmitting ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>

          {novaRotaOverlay}
          {calendarioDataInicioOverlay}
          {seletorLocalOverlay}
        </View>
      </Modal>

      <Modal
        visible={modalEditarRotaVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalEditarRota}
      >
        <View style={styles.telaAtribuir}>
          <View
            style={[
              styles.cabecalhoAtribuir,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoAtribuirBotao} />
            <Text style={styles.tituloAtribuir}>Editar rota</Text>
            <Pressable
              style={styles.cabecalhoAtribuirBotao}
              onPress={fecharModalEditarRota}
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
            contentContainerStyle={styles.corpoPlano}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.label}>Nome da rota</Text>
              <TextInput
                value={nomeEditarRota}
                onChangeText={setNomeEditarRota}
                placeholder="Nome da rota"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Responsável</Text>
              {carregandoFuncionariosZeladoria ? (
                <Text style={styles.vazio}>Carregando…</Text>
              ) : (
                <View style={styles.chipWrap}>
                  <Chip
                    label="Nenhum"
                    selected={responsavelEditarRotaId === null}
                    onPress={() => setResponsavelEditarRotaId(null)}
                  />
                  {funcionariosZeladoria.map((funcionario) => (
                    <Chip
                      key={funcionario.id}
                      label={funcionario.nome}
                      selected={responsavelEditarRotaId === funcionario.id}
                      onPress={() => setResponsavelEditarRotaId(funcionario.id)}
                    />
                  ))}
                </View>
              )}
            </View>

            {erroModalEditarRota ? (
              <Text style={styles.erro}>{erroModalEditarRota}</Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.rodapeAtribuir,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={[
                styles.botaoConfirmarAtribuir,
                (salvandoEditarRota || !nomeEditarRota.trim()) &&
                  styles.botaoConfirmarAtribuirDesabilitado,
              ]}
              onPress={handleSalvarEditarRota}
              disabled={salvandoEditarRota || !nomeEditarRota.trim()}
            >
              <Text style={styles.botaoConfirmarAtribuirTexto}>
                {salvandoEditarRota ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalExtraVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharModalExtraordinaria}
      >
        <View style={styles.telaAtribuir}>
          <View
            style={[
              styles.cabecalhoAtribuir,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoAtribuirBotao} />
            <Text style={styles.tituloAtribuir}>
              {extraEditingId
                ? 'Editar atividade extraordinária'
                : 'Atividade extraordinária'}
            </Text>
            <Pressable
              style={styles.cabecalhoAtribuirBotao}
              onPress={fecharModalExtraordinaria}
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
            contentContainerStyle={styles.corpoPlano}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.label}>Título</Text>
              <TextInput
                value={extraTitulo}
                onChangeText={setExtraTitulo}
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
                    selected={extraTipoId === tipo.id}
                    onPress={() => setExtraTipoId(tipo.id)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Local</Text>
              <Pressable
                style={styles.campoData}
                onPress={() => {
                  setExtraBuscaLocal('');
                  setExtraSeletorLocalVisivel(true);
                }}
              >
                <Text
                  style={
                    extraLocalSelecionado
                      ? styles.campoDataTexto
                      : styles.campoDataTextoPlaceholder
                  }
                >
                  {extraLocalSelecionado?.nome ?? 'Selecionar local'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Prioridade</Text>
              <View style={styles.chipWrap}>
                {PRIORIDADES.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={extraPrioridade === item}
                    color={getCorPrioridade(item)}
                    onPress={() => setExtraPrioridade(item)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Prazo</Text>
              <Pressable
                style={styles.campoData}
                onPress={() => setExtraCalendarioVisivel(true)}
              >
                <Text
                  style={
                    extraPrazo
                      ? styles.campoDataTexto
                      : styles.campoDataTextoPlaceholder
                  }
                >
                  {extraPrazo ? formatarDataBR(extraPrazo) : 'Definir prazo'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Observações</Text>
              <TextInput
                value={extraObservacoes}
                onChangeText={setExtraObservacoes}
                placeholder="Observações"
                placeholderTextColor={light.textSecondary}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.inputMultiline]}
              />
            </View>

            {erroModalExtra ? (
              <Text style={styles.erro}>{erroModalExtra}</Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.rodapeAtribuir,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable
              style={[
                styles.botaoConfirmarAtribuir,
                (extraSalvando || !extraFormularioCompleto) &&
                  styles.botaoConfirmarAtribuirDesabilitado,
              ]}
              onPress={handleSalvarExtraordinaria}
              disabled={extraSalvando || !extraFormularioCompleto}
            >
              <Text style={styles.botaoConfirmarAtribuirTexto}>
                {extraSalvando ? 'Salvando…' : 'Salvar'}
              </Text>
            </Pressable>
          </View>

          {extraSeletorLocalOverlay}
          {extraCalendarioOverlay}
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
                (atribuindoRota || !rotaSelecionadaAtribuir) &&
                  styles.botaoConfirmarAtribuirDesabilitado,
              ]}
              onPress={handleConfirmarAtribuirRota}
              disabled={atribuindoRota || !rotaSelecionadaAtribuir}
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

      {modalValidacaoVisivel && ordemValidacaoInicialId ? (
        <ValidacaoGuiada
          ordemInicialId={ordemValidacaoInicialId}
          onFinish={handleFinalizarValidacao}
        />
      ) : null}
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
  novoBotaoPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: light.inkAction,
  },
  novoBotaoPrincipalTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
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
  listaValidacao: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  grupoValidacao: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  grupoValidacaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grupoValidacaoCabecalhoTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  grupoValidacaoItens: {
    gap: spacing.xs,
  },
  linhaValidacao: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  linhaValidacaoTextos: {
    gap: 2,
  },
  linhaValidacaoTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaValidacaoDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  linhaValidacaoAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  botaoQualidadeLinha: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  botaoQualidadeLinhaTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  seloValidacao: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  seloValidacaoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  botaoLinhaSecundario: {
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  botaoLinhaSecundarioTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  botaoLinhaPerigo: {
    backgroundColor: semantic.overdue,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  botaoLinhaPerigoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  reprovarLinhaForm: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reprovarLinhaBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    color: light.inkAction,
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
    color: light.inkAction,
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
  grupoRotaResumoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  grupoRotaResponsavelTexto: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  seloSemResponsavel: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: semantic.overdue,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 2,
    backgroundColor: `${semantic.overdue}1A`,
  },
  seloSemResponsavelTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: semantic.overdue,
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
    color: light.inkAction,
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
  // Extraordinária no Admin: mesmo card, tingido com o accent de TINTA
  // (inkAction) para se distinguir dos planos de rotina. Nunca usa cor
  // semântica no destaque — verde/âmbar/vermelho seguem exclusivos de
  // status, e a prioridade continua colorida dentro do card.
  extraCardAdmin: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.inkAction,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  extraCabecalhoAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  seloExtra: {
    backgroundColor: light.inkAction,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  seloExtraTexto: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#FFFFFF',
  },
  atividadesRotaContainer: {
    marginLeft: 16,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
    backgroundColor: light.sunken,
    borderLeftWidth: 3,
    borderLeftColor: light.inkAction,
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
  menuItemDescricao: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
    marginTop: 2,
  },
  menuCriarBotaoCancelar: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
    backgroundColor: light.inkAction,
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
  // Envolve título + selo "Extraordinária" (quando houver), ocupando o
  // mesmo espaço que planoTitulo sozinho ocupava dentro de planoCabecalho.
  planoCabecalhoTitulos: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
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
    backgroundColor: `${light.inkAction}1A`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  rotaChipTexto: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: light.inkAction,
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
  tempoQualidadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qualidadeIndicador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qualidadeBolinha: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  qualidadeTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  botaoValidar: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: light.inkAction,
  },
  botaoValidarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalRotaCard: {
    backgroundColor: light.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // Variante de modalRotaCard para o seletor de "Local": precisa de altura
  // máxima (a lista de ambientes rola dentro, o card não cresce sem limite).
  modalLocalCard: {
    maxHeight: '80%',
  },
  modalLocalLista: {
    flexGrow: 0,
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
  modalBotaoPressionado: {
    backgroundColor: light.inkActionPressed,
  },
  modalBotaoSalvarTexto: {
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
  corpoPlano: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
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
    backgroundColor: light.inkAction,
    borderColor: light.inkAction,
  },
  novaRotaLinkAtribuir: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  novaRotaLinkAtribuirTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.inkAction,
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
    backgroundColor: light.inkAction,
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
