import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomTabBar,
  type BottomTabItem,
} from '../../src/components/BottomTabBar';
import { Chip } from '../../src/components/Chip';
import { MiniCalendar } from '../../src/components/MiniCalendar';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  type Contrato,
  corVencimento,
  DIAS_LIMIAR_VENCIMENTO,
  diasRestantes,
  digitosParaValorNumerico,
  extrairDigitosValor,
  formatarValorBRL,
  PERIODICIDADES_PAGAMENTO,
  type PeriodicidadePagamento,
  percentualDecorrido,
  type TipoContrato,
  valorNumericoParaDigitos,
} from '../../src/data/contratos';
import { formatarDataBR, hojeLocal } from '../../src/data/manutencao';
import { supabase } from '../../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

type CampoData = 'data_inicio' | 'data_fim' | 'data_base_reajuste';

type MensagemAssistente = {
  role: 'user' | 'assistant';
  content: string;
};

const MENSAGEM_ERRO_ASSISTENTE =
  'Não consegui processar sua pergunta agora, tente novamente.';

// Formata um timestamp ISO ('updated_at') para 'Atualizado em DD/MM/AAAA'.
function formatarAtualizadoEm(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `Atualizado em ${dia}/${mes}/${ano}`;
}

type StatusContrato = 'vigente' | 'renovacao' | 'vencido';

const FILTROS_STATUS: { chave: StatusContrato; label: string; cor: string }[] =
  [
    { chave: 'vigente', label: 'Vigente', cor: semantic.ok },
    { chave: 'renovacao', label: 'Renovação próxima', cor: semantic.pending },
    { chave: 'vencido', label: 'Vencido', cor: semantic.overdue },
  ];

// Status derivado exatamente dos mesmos limiares que alimentam a barra de
// vencimento e o selo — nenhuma categorização paralela. 'vencido' é a mesma
// condição do ramo overdue de corVencimento(); 'renovacao' cobre tanto o
// aviso prévio próprio do contrato quanto a faixa em que a barra já começou
// a colorir (DIAS_LIMIAR_VENCIMENTO).
function statusContrato(contrato: Contrato, hoje: string): StatusContrato {
  if (contrato.vigencia_indeterminada || !contrato.data_fim) {
    return 'vigente';
  }

  const restantes = diasRestantes(contrato.data_fim, hoje);

  if (restantes < 0) {
    return 'vencido';
  }
  if (
    restantes <= DIAS_LIMIAR_VENCIMENTO ||
    (contrato.prazo_aviso_previo_dias != null &&
      restantes <= contrato.prazo_aviso_previo_dias)
  ) {
    return 'renovacao';
  }
  return 'vigente';
}

// O selo "Renovação em breve" só aparece quando o aviso prévio configurado
// dispara ANTES da barra começar a colorir (restantes > 60). A partir de 60
// dias a própria transição de cor da barra já comunica a proximidade, e o
// selo seria redundante — ver DESIGN.md → Vencimento Gradient Bar.
function estaEmJanelaDeAviso(contrato: Contrato, hoje: string): boolean {
  if (
    contrato.vigencia_indeterminada ||
    !contrato.data_fim ||
    contrato.prazo_aviso_previo_dias == null
  ) {
    return false;
  }

  const restantes = diasRestantes(contrato.data_fim, hoje);
  return (
    restantes > DIAS_LIMIAR_VENCIMENTO &&
    restantes <= contrato.prazo_aviso_previo_dias
  );
}

// Busca client-side insensível a caixa e acento.
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Três pontos que saltam em sequência, indicando resposta pendente — mesma
// estrutura visual do chat de Normativos (app/admin/normativos.tsx).
function IndicadorDigitandoAssistente() {
  const valores = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const animacoes = valores.map((valor, indice) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(indice * 150),
          Animated.timing(valor, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(valor, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay((valores.length - 1 - indice) * 150),
        ]),
      ),
    );

    for (const animacao of animacoes) {
      animacao.start();
    }
    return () => {
      for (const animacao of animacoes) {
        animacao.stop();
      }
    };
  }, [valores]);

  return (
    <View style={styles.chatPontosDigitando}>
      {valores.map((valor, indice) => (
        <Animated.View
          // biome-ignore lint/suspicious/noArrayIndexKey: três pontos fixos, sem reordenação
          key={indice}
          style={[
            styles.chatPontoDigitando,
            {
              transform: [
                {
                  translateY: valor.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
              opacity: valor.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

// Bolha de mensagem do assistente já finalizada, com ícone de copiar —
// mesma estrutura visual do chat de Normativos.
function BolhaAssistenteConsulta({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    await Clipboard.setStringAsync(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <View style={[styles.chatBolha, styles.chatBolhaAssistente]}>
      <Text style={styles.chatTextoBolhaAssistente}>{texto}</Text>
      <Pressable
        onPress={handleCopiar}
        hitSlop={8}
        style={styles.chatBotaoCopiar}
      >
        <Ionicons
          name={copiado ? 'checkmark' : 'copy-outline'}
          size={14}
          color={light.textSecondary}
        />
        <Text style={styles.chatBotaoCopiarTexto}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function AdminContratos() {
  const insets = useSafeAreaInsets();
  const hoje = hojeLocal();

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [contraparteNome, setContraparteNome] = useState('');
  const [contraparteDocumento, setContraparteDocumento] = useState('');
  const [tipoContratoId, setTipoContratoId] = useState<string | null>(null);
  const [resumoObjeto, setResumoObjeto] = useState('');
  const [conteudoMarkdown, setConteudoMarkdown] = useState('');
  // Guarda só os dígitos digitados (centavos) — a máscara "R$ 1.250,00" é
  // derivada disso na hora de exibir, nunca armazenada como texto solto.
  const [valorDigitos, setValorDigitos] = useState('');
  const [periodicidadePagamento, setPeriodicidadePagamento] =
    useState<PeriodicidadePagamento | null>(null);
  const [indiceReajuste, setIndiceReajuste] = useState('');
  const [dataBaseReajuste, setDataBaseReajuste] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vigenciaIndeterminada, setVigenciaIndeterminada] = useState(false);
  const [renovacaoAutomatica, setRenovacaoAutomatica] = useState(false);
  const [prazoAvisoPrevioTexto, setPrazoAvisoPrevioTexto] = useState('');
  const [responsavelInterno, setResponsavelInterno] = useState('');
  const [anexoUrl, setAnexoUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [calendarioAberto, setCalendarioAberto] = useState<CampoData | null>(
    null,
  );

  // Mesmo padrão de alternância já usado no Admin (Gestão ↔ Relatório Geral,
  // via BottomTabBar) — reaproveitado aqui para Listagem ↔ Relatórios.
  const [abaAtiva, setAbaAtiva] = useState<'listagem' | 'relatorios'>(
    'listagem',
  );

  // Busca e filtros da listagem: tudo client-side sobre `contratos` já
  // carregado, sem ida ao banco. Nenhum filtro marcado = mostra tudo.
  const [busca, setBusca] = useState('');
  const [tiposFiltro, setTiposFiltro] = useState<string[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<StatusContrato[]>([]);

  // Chat do assistente: sempre reinicia vazio a cada abertura (contrato de
  // origem + histórico só existem em estado local, nada é persistido).
  const [assistenteVisivel, setAssistenteVisivel] = useState(false);
  const [assistenteContrato, setAssistenteContrato] = useState<Contrato | null>(
    null,
  );
  const [assistenteMensagens, setAssistenteMensagens] = useState<
    MensagemAssistente[]
  >([]);
  const [assistentePergunta, setAssistentePergunta] = useState('');
  const [assistenteEnviando, setAssistenteEnviando] = useState(false);
  const assistenteScrollRef = useRef<ScrollView>(null);

  const carregarContratos = useCallback(async () => {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .order('data_fim', { ascending: true });

    if (error) {
      setErroLista(error.message);
      return;
    }

    setErroLista(null);
    setContratos((data ?? []) as Contrato[]);
  }, []);

  const carregarTiposContrato = useCallback(async () => {
    const { data, error } = await supabase
      .from('tipos_contrato')
      .select('*')
      .order('nome', { ascending: true });

    if (!error) {
      setTiposContrato((data ?? []) as TipoContrato[]);
    }
  }, []);

  useEffect(() => {
    setCarregando(true);
    Promise.all([carregarContratos(), carregarTiposContrato()]).finally(() =>
      setCarregando(false),
    );
  }, [carregarContratos, carregarTiposContrato]);

  function limparFormulario() {
    setTitulo('');
    setContraparteNome('');
    setContraparteDocumento('');
    setTipoContratoId(null);
    setResumoObjeto('');
    setConteudoMarkdown('');
    setValorDigitos('');
    setPeriodicidadePagamento(null);
    setIndiceReajuste('');
    setDataBaseReajuste('');
    setDataInicio('');
    setDataFim('');
    setVigenciaIndeterminada(false);
    setRenovacaoAutomatica(false);
    setPrazoAvisoPrevioTexto('');
    setResponsavelInterno('');
    setAnexoUrl('');
  }

  function abrirModalNovo() {
    limparFormulario();
    setEditingId(null);
    setErroModal(null);
    setConfirmandoExclusao(false);
    setModalVisivel(true);
  }

  function abrirModalEditar(contrato: Contrato) {
    setTitulo(contrato.titulo);
    setContraparteNome(contrato.contraparte_nome);
    setContraparteDocumento(contrato.contraparte_documento ?? '');
    setTipoContratoId(contrato.tipo_contrato_id);
    setResumoObjeto(contrato.resumo_objeto);
    setConteudoMarkdown(contrato.conteudo_markdown);
    setValorDigitos(valorNumericoParaDigitos(contrato.valor));
    setPeriodicidadePagamento(contrato.periodicidade_pagamento);
    setIndiceReajuste(contrato.indice_reajuste ?? '');
    setDataBaseReajuste(contrato.data_base_reajuste ?? '');
    setDataInicio(contrato.data_inicio);
    setDataFim(contrato.data_fim ?? '');
    setVigenciaIndeterminada(contrato.vigencia_indeterminada);
    setRenovacaoAutomatica(contrato.renovacao_automatica);
    setPrazoAvisoPrevioTexto(
      contrato.prazo_aviso_previo_dias != null
        ? String(contrato.prazo_aviso_previo_dias)
        : '',
    );
    setResponsavelInterno(contrato.responsavel_interno ?? '');
    setAnexoUrl(contrato.anexo_url ?? '');
    setEditingId(contrato.id);
    setErroModal(null);
    setConfirmandoExclusao(false);
    setModalVisivel(true);
  }

  function fecharModal() {
    setModalVisivel(false);
    setEditingId(null);
    setConfirmandoExclusao(false);
    setCalendarioAberto(null);
  }

  // Ao marcar, limpa data_fim e renovacao_automatica na hora — nunca deixa
  // um valor antigo escondido esperando o usuário desmarcar de novo.
  function alternarVigenciaIndeterminada(valor: boolean) {
    setVigenciaIndeterminada(valor);
    if (valor) {
      setDataFim('');
      setRenovacaoAutomatica(false);
      setCalendarioAberto(null);
    }
  }

  async function handleSalvar() {
    if (isSubmitting) {
      return;
    }

    if (
      !titulo.trim() ||
      !contraparteNome.trim() ||
      !resumoObjeto.trim() ||
      !conteudoMarkdown.trim()
    ) {
      setErroModal(
        'Preencha título, contraparte, resumo do objeto e conteúdo.',
      );
      return;
    }

    if (!dataInicio) {
      setErroModal('Selecione a data de início.');
      return;
    }

    if (!vigenciaIndeterminada) {
      if (!dataFim) {
        setErroModal('Selecione a data de fim.');
        return;
      }

      if (dataFim <= dataInicio) {
        setErroModal('A data de fim deve ser posterior à data de início.');
        return;
      }
    }

    const valor = digitosParaValorNumerico(valorDigitos);

    let prazoAvisoPrevioDias: number | null = null;
    if (prazoAvisoPrevioTexto.trim()) {
      prazoAvisoPrevioDias = Number(prazoAvisoPrevioTexto.replace(',', '.'));
      if (!Number.isInteger(prazoAvisoPrevioDias)) {
        setErroModal(
          'Prazo de aviso prévio deve ser um número inteiro de dias.',
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErroModal(null);

    const payload: {
      id?: string;
      titulo: string;
      contraparte_nome: string;
      contraparte_documento: string | null;
      tipo_contrato_id: string | null;
      resumo_objeto: string;
      conteudo_markdown: string;
      valor: number | null;
      periodicidade_pagamento: PeriodicidadePagamento | null;
      indice_reajuste: string | null;
      data_base_reajuste: string | null;
      data_inicio: string;
      data_fim: string | null;
      vigencia_indeterminada: boolean;
      renovacao_automatica: boolean;
      prazo_aviso_previo_dias: number | null;
      responsavel_interno: string | null;
      anexo_url: string | null;
      updated_at?: string;
    } = {
      titulo: titulo.trim(),
      contraparte_nome: contraparteNome.trim(),
      contraparte_documento: contraparteDocumento.trim() || null,
      tipo_contrato_id: tipoContratoId,
      resumo_objeto: resumoObjeto.trim(),
      conteudo_markdown: conteudoMarkdown,
      valor,
      periodicidade_pagamento: periodicidadePagamento,
      indice_reajuste: indiceReajuste.trim() || null,
      data_base_reajuste: dataBaseReajuste || null,
      data_inicio: dataInicio,
      data_fim: vigenciaIndeterminada ? null : dataFim,
      vigencia_indeterminada: vigenciaIndeterminada,
      renovacao_automatica: vigenciaIndeterminada ? false : renovacaoAutomatica,
      prazo_aviso_previo_dias: prazoAvisoPrevioDias,
      responsavel_interno: responsavelInterno.trim() || null,
      anexo_url: anexoUrl.trim() || null,
    };

    if (editingId) {
      payload.id = editingId;
      payload.updated_at = new Date().toISOString();
    }

    const { error } = await supabase.from('contratos').upsert(payload);

    setIsSubmitting(false);

    if (error) {
      setErroModal(error.message);
      return;
    }

    fecharModal();
    carregarContratos();
  }

  async function handleExcluir() {
    if (!editingId || excluindo) {
      return;
    }

    setExcluindo(true);
    setErroModal(null);

    const { error } = await supabase
      .from('contratos')
      .delete()
      .eq('id', editingId);

    setExcluindo(false);

    if (error) {
      setErroModal(error.message);
      return;
    }

    fecharModal();
    carregarContratos();
  }

  function abrirAssistente(contrato: Contrato) {
    setAssistenteContrato(contrato);
    setAssistenteMensagens([]);
    setAssistentePergunta('');
    setAssistenteVisivel(true);
  }

  function fecharAssistente() {
    setAssistenteVisivel(false);
    setAssistenteContrato(null);
    setAssistenteMensagens([]);
    setAssistentePergunta('');
  }

  async function handleEnviarAssistente() {
    const texto = assistentePergunta.trim();
    if (!texto || assistenteEnviando || !assistenteContrato) {
      return;
    }

    const novoHistorico: MensagemAssistente[] = [
      ...assistenteMensagens,
      { role: 'user', content: texto },
    ];
    setAssistenteMensagens(novoHistorico);
    setAssistentePergunta('');
    setAssistenteEnviando(true);

    try {
      const resposta = await fetch('/api/contratos-assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: assistenteContrato.titulo,
          conteudoMarkdown: assistenteContrato.conteudo_markdown,
          mensagens: novoHistorico,
        }),
      });

      if (!resposta.ok) {
        throw new Error(`contratos-assistente respondeu ${resposta.status}`);
      }

      const dados = (await resposta.json()) as { resposta: string };
      setAssistenteMensagens((atual) => [
        ...atual,
        { role: 'assistant', content: dados.resposta },
      ]);
    } catch (error) {
      console.error('contratos-assistente: falha ao enviar pergunta', error);
      setAssistenteMensagens((atual) => [
        ...atual,
        { role: 'assistant', content: MENSAGEM_ERRO_ASSISTENTE },
      ]);
    } finally {
      setAssistenteEnviando(false);
    }
  }

  const valorCalendario =
    calendarioAberto === 'data_inicio'
      ? dataInicio
      : calendarioAberto === 'data_fim'
        ? dataFim
        : dataBaseReajuste;

  function handleSelecionarDiaCalendario(data: string) {
    if (calendarioAberto === 'data_inicio') {
      setDataInicio(data);
    } else if (calendarioAberto === 'data_fim') {
      setDataFim(data);
    } else if (calendarioAberto === 'data_base_reajuste') {
      setDataBaseReajuste(data);
    }
    setCalendarioAberto(null);
  }

  const tituloCalendario =
    calendarioAberto === 'data_inicio'
      ? 'Data de início'
      : calendarioAberto === 'data_fim'
        ? 'Data de fim'
        : 'Data base do reajuste';

  const calendarioOverlay = calendarioAberto ? (
    <View style={styles.overlayCalendario}>
      <View style={styles.overlayCard}>
        <Text style={styles.overlayTitulo}>{tituloCalendario}</Text>

        <MiniCalendar
          markedDates={{}}
          selectedDate={valorCalendario || null}
          onSelectDay={handleSelecionarDiaCalendario}
        />

        <View style={styles.overlayBotoes}>
          <Pressable
            style={[styles.overlayBotao, styles.overlayBotaoCancelar]}
            onPress={() => setCalendarioAberto(null)}
          >
            <Text style={styles.overlayBotaoCancelarTexto}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : null;

  // Todos os números abaixo são "hoje" (situação atual) — sem filtro de
  // período, diferente do escopo mês/todo-o-período do card de insights de
  // Zeladoria (outro caso de uso).
  const relatorio = useMemo(() => {
    const nomePorTipoId = new Map(
      tiposContrato.map((tipo) => [tipo.id, tipo.nome]),
    );

    let valorMensalTotal = 0;
    const contagemPorTipo = new Map<string, number>();
    let vencendo30 = 0;
    let vencendo60 = 0;
    let vencendo90 = 0;
    let vencidos = 0;
    const contagemPorIndice = new Map<string, number>();
    let vigenciaIndeterminadaTotal = 0;
    const contratosEmJanelaAviso: Array<{
      contrato: Contrato;
      diasRestantes: number;
    }> = [];

    for (const contrato of contratos) {
      if (contrato.periodicidade_pagamento === 'Mensal') {
        valorMensalTotal += contrato.valor ?? 0;
      }

      const nomeTipo = contrato.tipo_contrato_id
        ? (nomePorTipoId.get(contrato.tipo_contrato_id) ?? 'Sem tipo')
        : 'Sem tipo';
      contagemPorTipo.set(nomeTipo, (contagemPorTipo.get(nomeTipo) ?? 0) + 1);

      const chaveIndice = contrato.indice_reajuste?.trim()
        ? contrato.indice_reajuste.trim()
        : 'Sem índice definido';
      contagemPorIndice.set(
        chaveIndice,
        (contagemPorIndice.get(chaveIndice) ?? 0) + 1,
      );

      if (contrato.vigencia_indeterminada) {
        vigenciaIndeterminadaTotal += 1;
        continue;
      }

      if (!contrato.data_fim) {
        continue;
      }

      const restantes = diasRestantes(contrato.data_fim, hoje);

      if (
        contrato.prazo_aviso_previo_dias != null &&
        restantes >= 0 &&
        restantes <= contrato.prazo_aviso_previo_dias
      ) {
        contratosEmJanelaAviso.push({ contrato, diasRestantes: restantes });
      }

      if (restantes < 0) {
        vencidos += 1;
        continue;
      }

      if (restantes <= 30) {
        vencendo30 += 1;
      }
      if (restantes <= 60) {
        vencendo60 += 1;
      }
      if (restantes <= 90) {
        vencendo90 += 1;
      }
    }

    return {
      valorMensalTotal,
      distribuicaoPorTipo: Array.from(contagemPorTipo.entries())
        .map(([nome, contagem]) => ({ nome, contagem }))
        .sort((a, b) => b.contagem - a.contagem),
      vencendo30,
      vencendo60,
      vencendo90,
      vencidos,
      distribuicaoPorIndice: Array.from(contagemPorIndice.entries())
        .map(([nome, contagem]) => ({ nome, contagem }))
        .sort((a, b) => b.contagem - a.contagem),
      vigenciaIndeterminadaTotal,
      contratosEmJanelaAviso: contratosEmJanelaAviso.sort(
        (a, b) => a.diasRestantes - b.diasRestantes,
      ),
    };
  }, [contratos, tiposContrato, hoje]);

  // Busca (título + contraparte) E tipo E status — os três combinam com AND;
  // cada grupo vazio não filtra nada.
  const contratosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());

    return contratos.filter((contrato) => {
      if (termo) {
        const alvo = normalizarTexto(
          `${contrato.titulo} ${contrato.contraparte_nome}`,
        );
        if (!alvo.includes(termo)) {
          return false;
        }
      }

      if (
        tiposFiltro.length > 0 &&
        (contrato.tipo_contrato_id == null ||
          !tiposFiltro.includes(contrato.tipo_contrato_id))
      ) {
        return false;
      }

      if (
        statusFiltro.length > 0 &&
        !statusFiltro.includes(statusContrato(contrato, hoje))
      ) {
        return false;
      }

      return true;
    });
  }, [contratos, busca, tiposFiltro, statusFiltro, hoje]);

  const temFiltroAtivo =
    busca.trim().length > 0 ||
    tiposFiltro.length > 0 ||
    statusFiltro.length > 0;

  function alternarTipoFiltro(tipoId: string) {
    setTiposFiltro((atual) =>
      atual.includes(tipoId)
        ? atual.filter((id) => id !== tipoId)
        : [...atual, tipoId],
    );
  }

  function alternarStatusFiltro(status: StatusContrato) {
    setStatusFiltro((atual) =>
      atual.includes(status)
        ? atual.filter((s) => s !== status)
        : [...atual, status],
    );
  }

  // O assistente precisa do contrato inteiro; dentro do modal só temos o id.
  const contratoEmEdicao = editingId
    ? (contratos.find((c) => c.id === editingId) ?? null)
    : null;

  const tabs: BottomTabItem[] = [
    {
      key: 'listagem',
      label: 'Listagem',
      icon: 'list-outline',
      iconActive: 'list',
    },
    {
      key: 'relatorios',
      label: 'Relatórios',
      icon: 'stats-chart-outline',
      iconActive: 'stats-chart',
    },
  ];

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

        <Text style={styles.title}>Contratos</Text>

        {abaAtiva === 'listagem' ? (
          <Pressable
            onPress={abrirModalNovo}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {abaAtiva === 'listagem' ? (
        <ScrollView
          contentContainerStyle={styles.bodyListagem}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.buscaWrap}>
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por título ou fornecedor"
              placeholderTextColor={light.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtrosLinha}
            keyboardShouldPersistTaps="handled"
          >
            {FILTROS_STATUS.map((filtro) => (
              <Chip
                key={filtro.chave}
                label={filtro.label}
                color={filtro.cor}
                selected={statusFiltro.includes(filtro.chave)}
                onPress={() => alternarStatusFiltro(filtro.chave)}
              />
            ))}
            {tiposContrato.map((tipo) => (
              <Chip
                key={tipo.id}
                label={tipo.nome}
                selected={tiposFiltro.includes(tipo.id)}
                onPress={() => alternarTipoFiltro(tipo.id)}
              />
            ))}
          </ScrollView>

          {erroLista ? (
            <Text style={[styles.erro, styles.mensagemListagem]}>
              {erroLista}
            </Text>
          ) : null}

          {!carregando && contratos.length === 0 ? (
            <Text style={[styles.vazio, styles.mensagemListagem]}>
              Nenhum contrato cadastrado.
            </Text>
          ) : contratosFiltrados.length === 0 && temFiltroAtivo ? (
            <Text style={[styles.vazio, styles.mensagemListagem]}>
              Nenhum contrato encontrado com esses filtros.
            </Text>
          ) : (
            <View>
              {contratosFiltrados.map((contrato, indice) => {
                const renovacaoEmBreve = estaEmJanelaDeAviso(contrato, hoje);

                return (
                  <Pressable
                    key={contrato.id}
                    style={({ pressed }) => [
                      styles.linha,
                      indice === 0 && styles.linhaPrimeira,
                      pressed && styles.linhaPressionada,
                    ]}
                    onPress={() => abrirModalEditar(contrato)}
                  >
                    <View style={styles.linhaTituloRow}>
                      <Text style={styles.linhaTitulo} numberOfLines={2}>
                        {contrato.titulo}
                      </Text>
                      {contrato.valor != null ? (
                        <Text style={styles.linhaValor}>
                          {formatarValorBRL(Math.round(contrato.valor * 100))}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.linhaMeta}>
                      {contrato.contraparte_nome}
                    </Text>
                    <Text style={styles.linhaMeta} numberOfLines={2}>
                      {contrato.resumo_objeto}
                    </Text>

                    {renovacaoEmBreve ? (
                      <View style={styles.seloRenovacaoEmBreve}>
                        <Text style={styles.seloRenovacaoEmBreveTexto}>
                          Renovação em breve
                        </Text>
                      </View>
                    ) : null}

                    {contrato.vigencia_indeterminada || !contrato.data_fim ? (
                      <View style={styles.seloVigenciaIndeterminada}>
                        <Text style={styles.seloVigenciaIndeterminadaTexto}>
                          Vigência indeterminada
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.barraFundo}>
                          <View
                            style={[
                              styles.barraPreenchida,
                              {
                                width: `${percentualDecorrido(contrato.data_inicio, contrato.data_fim, hoje) * 100}%`,
                                backgroundColor: corVencimento(
                                  contrato.data_fim,
                                  hoje,
                                ),
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.cardVencimento}>
                          Vence em {formatarDataBR(contrato.data_fim)}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>
              Valor mensal total comprometido
            </Text>
            <Text style={styles.relatorioNumeroGrande}>
              {formatarValorBRL(Math.round(relatorio.valorMensalTotal * 100))}
            </Text>
          </View>

          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>Vencimentos próximos</Text>
            <View style={styles.relatorioLinhaTiles}>
              <View style={styles.relatorioTile}>
                <Text style={styles.relatorioTileNumero}>
                  {relatorio.vencendo30}
                </Text>
                <Text style={styles.relatorioTileLabel}>Em 30 dias</Text>
              </View>
              <View style={styles.relatorioTile}>
                <Text style={styles.relatorioTileNumero}>
                  {relatorio.vencendo60}
                </Text>
                <Text style={styles.relatorioTileLabel}>Em 60 dias</Text>
              </View>
              <View style={styles.relatorioTile}>
                <Text style={styles.relatorioTileNumero}>
                  {relatorio.vencendo90}
                </Text>
                <Text style={styles.relatorioTileLabel}>Em 90 dias</Text>
              </View>
            </View>
          </View>

          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>Contratos vencidos</Text>
            <Text style={styles.relatorioNumeroGrande}>
              {relatorio.vencidos}
            </Text>
          </View>

          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>Vigência indeterminada</Text>
            <Text style={styles.relatorioNumeroGrande}>
              {relatorio.vigenciaIndeterminadaTotal}
            </Text>
          </View>

          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>Janela de renovação</Text>
            {relatorio.contratosEmJanelaAviso.length === 0 ? (
              <Text style={styles.vazio}>
                Nenhum contrato em janela de renovação
              </Text>
            ) : (
              <View style={styles.relatorioLista}>
                {relatorio.contratosEmJanelaAviso.map((item) => (
                  <Pressable
                    key={item.contrato.id}
                    style={styles.relatorioLinha}
                    onPress={() => abrirModalEditar(item.contrato)}
                  >
                    <Text style={styles.relatorioLinhaTexto}>
                      {item.contrato.titulo}
                    </Text>
                    <Text style={styles.relatorioLinhaValor}>
                      {item.diasRestantes} dia
                      {item.diasRestantes === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>Contratos por tipo</Text>
            {relatorio.distribuicaoPorTipo.length === 0 ? (
              <Text style={styles.vazio}>Nenhum contrato cadastrado.</Text>
            ) : (
              <View style={styles.relatorioLista}>
                {relatorio.distribuicaoPorTipo.map((item) => (
                  <View key={item.nome} style={styles.relatorioLinha}>
                    <Text style={styles.relatorioLinhaTexto}>{item.nome}</Text>
                    <Text style={styles.relatorioLinhaValor}>
                      {item.contagem}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.relatorioSecao}>
            <Text style={styles.relatorioTitulo}>
              Distribuição por índice de reajuste
            </Text>
            {relatorio.distribuicaoPorIndice.length === 0 ? (
              <Text style={styles.vazio}>Nenhum contrato cadastrado.</Text>
            ) : (
              <View style={styles.relatorioLista}>
                {relatorio.distribuicaoPorIndice.map((item) => (
                  <View key={item.nome} style={styles.relatorioLinha}>
                    <Text style={styles.relatorioLinhaTexto}>{item.nome}</Text>
                    <Text style={styles.relatorioLinhaValor}>
                      {item.contagem}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <BottomTabBar
        items={tabs}
        activeKey={abaAtiva}
        onSelect={(key) => setAbaAtiva(key as 'listagem' | 'relatorios')}
      />

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
              {editingId ? 'Editar contrato' : 'Novo contrato'}
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
            {contratoEmEdicao ? (
              <Pressable
                style={({ pressed }) => [
                  styles.linkAssistente,
                  pressed && styles.linkAssistentePressionado,
                ]}
                onPress={() => abrirAssistente(contratoEmEdicao)}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={light.inkAction}
                />
                <Text style={styles.linkAssistenteTexto}>
                  Consultar assistente sobre este contrato
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={light.textSecondary}
                />
              </Pressable>
            ) : null}

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
              <Text style={styles.label}>Contraparte</Text>
              <TextInput
                value={contraparteNome}
                onChangeText={setContraparteNome}
                placeholder="Nome da contraparte"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Documento da contraparte</Text>
              <TextInput
                value={contraparteDocumento}
                onChangeText={setContraparteDocumento}
                placeholder="CPF/CNPJ (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tipo de contrato</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Nenhum"
                  selected={tipoContratoId === null}
                  onPress={() => setTipoContratoId(null)}
                />
                {tiposContrato.map((tipo) => (
                  <Chip
                    key={tipo.id}
                    label={tipo.nome}
                    selected={tipoContratoId === tipo.id}
                    onPress={() => setTipoContratoId(tipo.id)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Resumo do objeto</Text>
              <TextInput
                value={resumoObjeto}
                onChangeText={setResumoObjeto}
                placeholder="Resumo curto — aparece no card"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Conteúdo (markdown)</Text>
              <TextInput
                value={conteudoMarkdown}
                onChangeText={setConteudoMarkdown}
                placeholder="Conteúdo completo do contrato em markdown"
                placeholderTextColor={light.textSecondary}
                multiline
                numberOfLines={16}
                style={[styles.input, styles.inputConteudo]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Valor</Text>
              <TextInput
                value={
                  valorDigitos ? formatarValorBRL(Number(valorDigitos)) : ''
                }
                onChangeText={(texto) =>
                  setValorDigitos(extrairDigitosValor(texto))
                }
                placeholder="R$ 0,00 (opcional)"
                placeholderTextColor={light.textSecondary}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Periodicidade de pagamento</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Nenhuma"
                  selected={periodicidadePagamento === null}
                  onPress={() => setPeriodicidadePagamento(null)}
                />
                {PERIODICIDADES_PAGAMENTO.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={periodicidadePagamento === item}
                    onPress={() => setPeriodicidadePagamento(item)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Índice de reajuste</Text>
              <TextInput
                value={indiceReajuste}
                onChangeText={setIndiceReajuste}
                placeholder="Ex.: IGP-M (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Data base do reajuste</Text>
              <Pressable
                style={styles.campoData}
                onPress={() => setCalendarioAberto('data_base_reajuste')}
              >
                <Text style={styles.campoDataTexto}>
                  {dataBaseReajuste
                    ? formatarDataBR(dataBaseReajuste)
                    : 'Selecionar (opcional)'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Data de início</Text>
              <Pressable
                style={styles.campoData}
                onPress={() => setCalendarioAberto('data_inicio')}
              >
                <Text style={styles.campoDataTexto}>
                  {dataInicio ? formatarDataBR(dataInicio) : 'Selecionar'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Pressable
                style={styles.linhaCheckbox}
                onPress={() =>
                  alternarVigenciaIndeterminada(!vigenciaIndeterminada)
                }
              >
                <Ionicons
                  name={vigenciaIndeterminada ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={
                    vigenciaIndeterminada
                      ? light.inkAction
                      : light.textSecondary
                  }
                />
                <Text style={styles.label}>Vigência indeterminada</Text>
              </Pressable>
            </View>

            {!vigenciaIndeterminada ? (
              <View style={styles.field}>
                <Text style={styles.label}>Data de fim</Text>
                <Pressable
                  style={styles.campoData}
                  onPress={() => setCalendarioAberto('data_fim')}
                >
                  <Text style={styles.campoDataTexto}>
                    {dataFim ? formatarDataBR(dataFim) : 'Selecionar'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!vigenciaIndeterminada ? (
              <View style={styles.field}>
                <View style={styles.linhaSwitch}>
                  <Text style={styles.label}>Renovação automática</Text>
                  <Switch
                    value={renovacaoAutomatica}
                    onValueChange={setRenovacaoAutomatica}
                    trackColor={{
                      false: light.border,
                      true: `${light.inkAction}1A`,
                    }}
                    thumbColor={
                      renovacaoAutomatica ? light.inkAction : '#FFFFFF'
                    }
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Prazo de aviso prévio (dias)</Text>
              <TextInput
                value={prazoAvisoPrevioTexto}
                onChangeText={setPrazoAvisoPrevioTexto}
                placeholder="Ex.: 30 (opcional)"
                placeholderTextColor={light.textSecondary}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Responsável interno</Text>
              <TextInput
                value={responsavelInterno}
                onChangeText={setResponsavelInterno}
                placeholder="Responsável interno (opcional)"
                placeholderTextColor={light.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Link do anexo</Text>
              <TextInput
                value={anexoUrl}
                onChangeText={setAnexoUrl}
                placeholder="URL do PDF do contrato (opcional)"
                placeholderTextColor={light.textSecondary}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {contratoEmEdicao ? (
              <Text style={styles.cardAtualizado}>
                {formatarAtualizadoEm(contratoEmEdicao.updated_at)}
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

          {calendarioOverlay}
        </View>
      </Modal>

      <Modal
        visible={assistenteVisivel}
        transparent={false}
        animationType="slide"
        onRequestClose={fecharAssistente}
      >
        <View style={styles.tela}>
          <View
            style={[
              styles.cabecalhoModal,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.cabecalhoModalBotao} />
            <Text style={styles.tituloModal} numberOfLines={1}>
              {assistenteContrato?.titulo ?? 'Assistente'}
            </Text>
            <Pressable
              style={styles.cabecalhoModalBotao}
              onPress={fecharAssistente}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
          </View>

          <View style={styles.chatAviso}>
            <Text style={styles.chatAvisoTexto}>
              Respostas geradas por IA com base no contrato selecionado. Confira
              sempre a cláusula indicada antes de agir com base na informação.
            </Text>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={insets.top}
          >
            <ScrollView
              ref={assistenteScrollRef}
              contentContainerStyle={styles.chatCorpo}
              onContentSizeChange={() =>
                assistenteScrollRef.current?.scrollToEnd({ animated: true })
              }
            >
              {assistenteMensagens.map((mensagem, indice) =>
                mensagem.role === 'user' ? (
                  <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: lista imutável só cresce no fim, sem reordenação
                    key={indice}
                    style={[styles.chatBolha, styles.chatBolhaUsuario]}
                  >
                    <Text style={styles.chatTextoBolhaUsuario}>
                      {mensagem.content}
                    </Text>
                  </View>
                ) : (
                  <BolhaAssistenteConsulta
                    // biome-ignore lint/suspicious/noArrayIndexKey: lista imutável só cresce no fim, sem reordenação
                    key={indice}
                    texto={mensagem.content}
                  />
                ),
              )}

              {assistenteEnviando ? (
                <View style={[styles.chatBolha, styles.chatBolhaAssistente]}>
                  <IndicadorDigitandoAssistente />
                </View>
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.chatRodape,
                { paddingBottom: insets.bottom + spacing.md },
              ]}
            >
              <TextInput
                value={assistentePergunta}
                onChangeText={setAssistentePergunta}
                placeholder="Pergunte sobre este contrato…"
                placeholderTextColor={light.textSecondary}
                style={styles.chatInput}
                multiline
              />
              <Pressable
                onPress={handleEnviarAssistente}
                disabled={assistenteEnviando || !assistentePergunta.trim()}
                style={({ pressed }) => [
                  styles.chatBotaoEnviar,
                  (assistenteEnviando || !assistentePergunta.trim()) &&
                    styles.chatBotaoEnviarDesabilitado,
                  pressed && styles.chatBotaoEnviarPressionado,
                ]}
              >
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
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
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 90,
    gap: spacing.md,
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
  // Listagem em Ruled Rows: o ScrollView não tem padding horizontal para o
  // estado de toque da linha sangrar até a borda da tela; o recuo vive
  // dentro de cada linha.
  bodyListagem: {
    paddingBottom: 90,
  },
  buscaWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filtrosLinha: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  mensagemListagem: {
    paddingHorizontal: spacing.lg,
  },
  linha: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  // Régua de cabeça de seção: a lista é flat (ordenada por data_fim), então
  // só o primeiro registro a recebe.
  linhaPrimeira: {
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  linhaPressionada: {
    backgroundColor: light.sunken,
  },
  linhaTituloRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  linhaTitulo: {
    flex: 1,
    fontFamily: fonts.serifSemiBold,
    fontSize: 17,
    color: light.textPrimary,
  },
  linhaValor: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  linhaMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  barraFundo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: light.sunken,
    overflow: 'hidden',
    marginTop: spacing.xs / 2,
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: 3,
  },
  cardVencimento: {
    marginTop: spacing.xs / 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  seloVigenciaIndeterminada: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: `${light.textMuted}1A`,
  },
  seloVigenciaIndeterminadaTexto: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: light.textMuted,
  },
  seloRenovacaoEmBreve: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: `${semantic.pending}1A`,
  },
  seloRenovacaoEmBreveTexto: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: semantic.pending,
  },
  cardAtualizado: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
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
    minHeight: 200,
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linhaCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  overlayCalendario: {
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
  overlayCard: {
    backgroundColor: light.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  overlayTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: light.textPrimary,
    marginBottom: spacing.xs,
  },
  overlayBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  overlayBotao: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  overlayBotaoCancelar: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  overlayBotaoCancelarTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  flex: {
    flex: 1,
  },
  // Ponto de entrada do assistente dentro do modal de edição: item em régua,
  // não botão primário de largura total (esse papel é do "Salvar").
  linkAssistente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  linkAssistentePressionado: {
    backgroundColor: light.sunken,
  },
  linkAssistenteTexto: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.inkAction,
  },
  chatAviso: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: light.sunken,
  },
  chatAvisoTexto: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: light.textSecondary,
  },
  chatCorpo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  chatBolha: {
    maxWidth: '80%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chatBolhaAssistente: {
    alignSelf: 'flex-start',
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
  },
  chatBolhaUsuario: {
    alignSelf: 'flex-end',
    backgroundColor: light.inkAction,
  },
  chatTextoBolhaAssistente: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
  chatTextoBolhaUsuario: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#FFFFFF',
  },
  chatPontosDigitando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  chatPontoDigitando: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: light.textSecondary,
  },
  chatBotaoCopiar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.xs,
  },
  chatBotaoCopiarTexto: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: light.textSecondary,
  },
  chatRodape: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  chatInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  chatBotaoEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: light.inkAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBotaoEnviarPressionado: {
    backgroundColor: light.inkActionPressed,
  },
  chatBotaoEnviarDesabilitado: {
    opacity: 0.4,
  },
  relatorioSecao: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  relatorioTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: light.textPrimary,
  },
  relatorioNumeroGrande: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: light.textPrimary,
  },
  relatorioLinhaTiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  relatorioTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: light.sunken,
  },
  relatorioTileNumero: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  relatorioTileLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  relatorioLista: {
    gap: spacing.xs,
  },
  relatorioLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relatorioLinhaTexto: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textPrimary,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  relatorioLinhaValor: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
});
