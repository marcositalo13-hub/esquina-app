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
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  getCorPrioridade,
  PERIODICIDADES,
  type Periodicidade,
  type PlanoManutencao,
  PRIORIDADES,
  type Prioridade,
  type TipoAtividade,
} from '../../src/data/manutencao';
import { supabase } from '../../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../../src/theme';

export default function AdminPreservacao() {
  const insets = useSafeAreaInsets();

  const [planos, setPlanos] = useState<PlanoManutencao[]>([]);
  const [tiposAtivos, setTiposAtivos] = useState<TipoAtividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('Mensal');
  const [prioridade, setPrioridade] = useState<Prioridade>('Média');
  const [dataInicio, setDataInicio] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
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

  useEffect(() => {
    setCarregando(true);
    Promise.all([carregarPlanos(), carregarTipos()]).finally(() =>
      setCarregando(false),
    );
  }, [carregarPlanos, carregarTipos]);

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

  function abrirModal() {
    setErroModal(null);
    setModalVisivel(true);
  }

  function fecharModal() {
    setModalVisivel(false);
  }

  function limparFormulario() {
    setTitulo('');
    setDescricao('');
    setLocal('');
    setPeriodicidade('Mensal');
    setPrioridade('Média');
    setDataInicio(new Date().toISOString().slice(0, 10));
    setAtivo(true);
    setObservacoes('');
  }

  async function handleSalvar() {
    if (!titulo.trim() || !tipoId || !dataInicio.trim()) {
      setErroModal('Preencha título, tipo e data de início.');
      return;
    }

    setSalvando(true);
    setErroModal(null);

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
      setSalvando(false);
      setErroModal(erroPlano?.message ?? 'Não foi possível salvar o plano.');
      return;
    }

    const { error: erroOrdem } = await supabase.from('ordens_servico').insert({
      plano_id: plano.id,
      data_prevista: dataInicio,
      status: 'pendente',
    });

    setSalvando(false);

    if (erroOrdem) {
      setErroModal(erroOrdem.message);
      return;
    }

    limparFormulario();
    setModalVisivel(false);
    carregarPlanos();
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

        <Pressable onPress={abrirModal} style={styles.headerButton}>
          <Ionicons name="add-circle-outline" size={24} color={light.brand} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {erroLista ? <Text style={styles.erro}>{erroLista}</Text> : null}

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
          {!carregando && planos.length === 0 ? (
            <Text style={styles.vazio}>Nenhuma atividade cadastrada.</Text>
          ) : null}

          {planos.map((plano) => (
            <View key={plano.id} style={styles.planoCard}>
              <Text style={styles.planoTitulo}>{plano.titulo}</Text>
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
              <Text style={styles.modalTitulo}>Nova atividade</Text>

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
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {tiposAtivos.map((tipo) => (
                    <Chip
                      key={tipo.id}
                      label={tipo.nome}
                      selected={tipoId === tipo.id}
                      onPress={() => setTipoId(tipo.id)}
                    />
                  ))}
                </ScrollView>
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
                  trackColor={{ false: light.border, true: light.brandActive }}
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
                  style={[styles.modalBotao, styles.modalBotaoSalvar]}
                  onPress={handleSalvar}
                  disabled={salvando}
                >
                  <Text style={styles.modalBotaoSalvarTexto}>
                    {salvando ? 'Salvando…' : 'Salvar'}
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
  planoTitulo: {
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
    gap: spacing.xs,
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
    backgroundColor: light.textPrimary,
  },
  modalBotaoSalvarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: light.bg,
  },
});
