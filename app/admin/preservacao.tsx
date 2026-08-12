import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
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

  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [tipoFiltros, setTipoFiltros] = useState<string[]>([]);
  const [prioridadeFiltros, setPrioridadeFiltros] = useState<Prioridade[]>([]);
  const [periodicidadeFiltros, setPeriodicidadeFiltros] = useState<
    Periodicidade[]
  >([]);

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

  // Chips de tipo/prioridade/periodicidade filtram a lista de planos.
  // O alternador Hoje/Todas NUNCA entra aqui — só afeta a barra de progresso.
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
      return true;
    });
  }, [planos, tipoFiltros, prioridadeFiltros, periodicidadeFiltros]);

  // Barra de progresso: mesmos chips de tipo/prioridade/periodicidade, MAIS
  // o alternador Hoje/Todas (que só afeta este cálculo, nunca a lista).
  const progresso = useMemo(() => {
    const hojeStr = hoje();

    const filtradas = ordens.filter((ordem) => {
      if (dateFilter === 'hoje' && ordem.data_prevista !== hojeStr) {
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

  function handleExcluir(plano: PlanoManutencao) {
    Alert.alert('Excluir plano?', plano.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('planos_manutencao')
            .delete()
            .eq('id', plano.id);

          if (error) {
            setErroLista(error.message);
            return;
          }

          carregarTudo();
        },
      },
    ]);
  }

  function handleAbrirMenu(plano: PlanoManutencao) {
    Alert.alert(plano.titulo, undefined, [
      { text: 'Editar', onPress: () => handleEditar(plano) },
      { text: 'Duplicar', onPress: () => handleDuplicar(plano) },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => handleExcluir(plano),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
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
          <View style={styles.segmentedControl}>
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

          {planosFiltrados.map((plano) => (
            <View key={plano.id} style={styles.planoCard}>
              <View style={styles.planoCabecalho}>
                <Text style={styles.planoTitulo}>{plano.titulo}</Text>
                <Pressable
                  onPress={() => handleAbrirMenu(plano)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.planoMenuButton}
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
                  {plano.periodicidade} · {plano.data_inicio}
                </Text>
                <Chip
                  label={plano.prioridade}
                  color={getCorPrioridade(plano.prioridade)}
                />
              </View>
            </View>
          ))}
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: 2,
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
  planoCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  planoCabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planoMenuButton: {
    padding: 4,
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
