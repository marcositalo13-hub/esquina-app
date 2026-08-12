import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Chip } from '../../src/components/Chip';
import {
  type DiaMarcado,
  MiniCalendar,
} from '../../src/components/MiniCalendar';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  formatarDataBR,
  getCorPrioridade,
  type OrdemServico,
  PERIODICIDADES,
  type Periodicidade,
  type PlanoManutencao,
  PRIORIDADES,
  type Prioridade,
  type TipoAtividade,
} from '../../src/data/manutencao';
import { supabase } from '../../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

const hoje = () => new Date().toISOString().slice(0, 10);

type DateFilter = 'hoje' | 'todas';

export default function AdminPreservacao() {
  const insets = useSafeAreaInsets();

  const [planos, setPlanos] = useState<PlanoManutencao[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [tiposAtivos, setTiposAtivos] = useState<TipoAtividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [atrasadasFiltro, setAtrasadasFiltro] = useState(false);
  const [tipoFiltros, setTipoFiltros] = useState<string[]>([]);
  const [prioridadeFiltros, setPrioridadeFiltros] = useState<Prioridade[]>([]);
  const [periodicidadeFiltros, setPeriodicidadeFiltros] = useState<
    Periodicidade[]
  >([]);

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [menuEtapa, setMenuEtapa] = useState<'opcoes' | 'confirmarExclusao'>(
    'opcoes',
  );

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const carregarPlanos = useCallback(async () => {
    const { data, error } = await supabase
      .from('planos_manutencao')
      .select('*, tipos_atividade(*)')
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
      .select('*, planos_manutencao(*, tipos_atividade(*))');

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

  const carregarTudo = useCallback(async () => {
    await Promise.all([carregarPlanos(), carregarOrdens()]);
  }, [carregarPlanos, carregarOrdens]);

  useEffect(() => {
    setCarregando(true);
    Promise.all([carregarPlanos(), carregarTipos(), carregarOrdens()]).finally(
      () => setCarregando(false),
    );
  }, [carregarPlanos, carregarTipos, carregarOrdens]);

  const resumoPorTipo = useMemo(() => {
    const contagem = new Map<string, { nome: string; total: number }>();

    for (const plano of planos) {
      const nome = plano.tipos_atividade?.nome ?? 'Sem tipo';
      const atual = contagem.get(plano.tipo_id);
      if (atual) {
        atual.total += 1;
      } else {
        contagem.set(plano.tipo_id, { nome, total: 1 });
      }
    }

    return Array.from(contagem.values());
  }, [planos]);

  // Calendário: marca TODAS as ordens, sem aplicar nenhum filtro ativo.
  const markedDates = useMemo(() => {
    const hojeStr = hoje();
    const mapa: Record<string, DiaMarcado> = {};

    for (const ordem of ordens) {
      const atrasada =
        ordem.status === 'pendente' && ordem.data_prevista < hojeStr;

      if (atrasada) {
        mapa[ordem.data_prevista] = 'atrasado';
      } else if (!mapa[ordem.data_prevista]) {
        mapa[ordem.data_prevista] = 'normal';
      }
    }

    return mapa;
  }, [ordens]);

  // Planos com ao menos uma ordem pendente e atrasada (para o chip
  // "Atrasadas" e para o badge nos chips de Tipo).
  const planoIdsAtrasados = useMemo(() => {
    const hojeStr = hoje();
    const ids = new Set<string>();

    for (const ordem of ordens) {
      if (ordem.status === 'pendente' && ordem.data_prevista < hojeStr) {
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
        !(ordem.status === 'pendente' && ordem.data_prevista < hojeStr)
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
      (o) => o.status === 'pendente' && o.data_prevista < hojeStr,
    ).length;
    const pendentes = filtradas.filter(
      (o) => o.status === 'pendente' && o.data_prevista >= hojeStr,
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
      if (ordem.status === 'pendente' && ordem.data_prevista < hojeStr) {
        const idTipo = ordem.planos_manutencao?.tipo_id;
        if (idTipo) {
          ids.add(idTipo);
        }
      }
    }

    return ids;
  }, [ordens]);

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

  function limparFormulario() {
    setTitulo('');
    setDescricao('');
    setLocal('');
    setPeriodicidade('Mensal');
    setPrioridade('Média');
    setDataInicio(hoje());
    setAtivo(true);
    setObservacoes('');
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
    setMenuAbertoId((atual) => (atual === id ? null : id));
    setMenuEtapa('opcoes');
  }

  function fecharMenu() {
    setMenuAbertoId(null);
    setMenuEtapa('opcoes');
  }

  function handleMenuEditar(plano: PlanoManutencao) {
    fecharMenu();
    handleEditar(plano);
  }

  function handleMenuDuplicar(plano: PlanoManutencao) {
    fecharMenu();
    handleDuplicar(plano);
  }

  function handleMenuPedirConfirmacaoExclusao() {
    setMenuEtapa('confirmarExclusao');
  }

  async function handleMenuExcluirConfirmar(plano: PlanoManutencao) {
    const { error } = await supabase
      .from('planos_manutencao')
      .delete()
      .eq('id', plano.id);

    fecharMenu();

    if (error) {
      setErroLista(error.message);
      return;
    }

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

    try {
      if (editingId) {
        const { error } = await supabase
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
          })
          .eq('id', editingId);

        if (error) {
          setErroModal(error.message);
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
          })
          .select()
          .single();

        if (erroPlano || !plano) {
          setErroModal(
            erroPlano?.message ?? 'Não foi possível salvar o plano.',
          );
          return;
        }

        const { error: erroOrdem } = await supabase
          .from('ordens_servico')
          .insert({
            plano_id: plano.id,
            data_prevista: dataInicio,
            status: 'pendente',
          });

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
            onPress={() => setCalendarioAberto((v) => !v)}
          >
            <Text style={styles.calendarioTitulo}>Calendário</Text>
            <Ionicons
              name={calendarioAberto ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={light.textSecondary}
            />
          </Pressable>

          {calendarioAberto ? (
            <MiniCalendar
              markedDates={markedDates}
              selectedDate={selectedDate}
              onSelectDay={handleSelecionarDia}
            />
          ) : null}
        </View>

        <View style={styles.painelCard}>
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
              <Text style={[styles.contadorBolinha, { color: semantic.ok }]}>
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
                style={[styles.contadorBolinha, { color: semantic.overdue }]}
              >
                ●
              </Text>
              <Text style={styles.contadorTexto}>
                {progresso.atrasadas} atrasadas
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.painelCard}>
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

        {resumoPorTipo.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.resumoRow}
          >
            {resumoPorTipo.map((item) => (
              <View key={item.nome} style={styles.resumoCard}>
                <Text style={styles.resumoTotal}>{item.total}</Text>
                <Text style={styles.resumoNome}>{item.nome}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.lista}>
          {!carregando && planosFiltrados.length === 0 ? (
            <Text style={styles.vazio}>Nenhuma atividade cadastrada.</Text>
          ) : null}

          {planosFiltrados.map((plano) => {
            const menuAberto = menuAbertoId === plano.id;

            return (
              <View
                key={plano.id}
                style={menuAberto ? styles.planoWrapperMenuAberto : null}
              >
                <View style={styles.planoCard}>
                  <View style={styles.planoCabecalho}>
                    <Text style={styles.planoTitulo}>{plano.titulo}</Text>
                    <Pressable
                      onPress={() => handleAbrirMenu(plano.id)}
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
                </View>

                {menuAberto ? (
                  <>
                    <Pressable
                      style={styles.menuOverlay}
                      onPress={fecharMenu}
                    />
                    <View style={styles.menuPainel}>
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
                    </View>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

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
  calendarioTitulo: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
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
  resumoRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resumoCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 92,
  },
  resumoTotal: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: light.textPrimary,
  },
  resumoNome: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
    textAlign: 'center',
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
  planoWrapperMenuAberto: {
    zIndex: 20,
    elevation: 20,
  },
  planoCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  menuOverlay: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    width: 5000,
    height: 5000,
    backgroundColor: 'transparent',
  },
  menuPainel: {
    position: 'absolute',
    top: 44,
    right: spacing.md,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    minWidth: 160,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
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
});
