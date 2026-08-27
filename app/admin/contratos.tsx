import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { MiniCalendar } from '../../src/components/MiniCalendar';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  type Contrato,
  corVencimento,
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

// Formata um timestamp ISO ('updated_at') para 'Atualizado em DD/MM/AAAA'.
function formatarAtualizadoEm(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `Atualizado em ${dia}/${mes}/${ano}`;
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
    setDataFim(contrato.data_fim);
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

    if (!dataInicio || !dataFim) {
      setErroModal('Selecione a data de início e a data de fim.');
      return;
    }

    if (dataFim <= dataInicio) {
      setErroModal('A data de fim deve ser posterior à data de início.');
      return;
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
      data_fim: string;
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
      data_fim: dataFim,
      renovacao_automatica: renovacaoAutomatica,
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

        {!carregando && contratos.length === 0 ? (
          <Text style={styles.vazio}>Nenhum contrato cadastrado.</Text>
        ) : (
          <View style={styles.lista}>
            {contratos.map((contrato) => {
              const percentual = percentualDecorrido(
                contrato.data_inicio,
                contrato.data_fim,
                hoje,
              );
              const cor = corVencimento(contrato.data_fim, hoje);

              return (
                <Pressable
                  key={contrato.id}
                  style={styles.card}
                  onPress={() => abrirModalEditar(contrato)}
                >
                  <Text style={styles.cardTitulo}>{contrato.titulo}</Text>
                  <Text style={styles.cardContraparte}>
                    {contrato.contraparte_nome}
                  </Text>
                  <Text style={styles.cardResumo} numberOfLines={2}>
                    {contrato.resumo_objeto}
                  </Text>

                  <View style={styles.barraFundo}>
                    <View
                      style={[
                        styles.barraPreenchida,
                        {
                          width: `${percentual * 100}%`,
                          backgroundColor: cor,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.cardAtualizado}>
                    {formatarAtualizadoEm(contrato.updated_at)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

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

            <View style={styles.field}>
              <View style={styles.linhaSwitch}>
                <Text style={styles.label}>Renovação automática</Text>
                <Switch
                  value={renovacaoAutomatica}
                  onValueChange={setRenovacaoAutomatica}
                  trackColor={{ false: light.border, true: light.brandWash }}
                  thumbColor={renovacaoAutomatica ? light.brand : '#FFFFFF'}
                />
              </View>
            </View>

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
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  lista: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  cardContraparte: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  cardResumo: {
    fontFamily: fonts.regular,
    fontSize: 13,
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
    backgroundColor: light.brand,
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
    borderRadius: radius.lg,
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
});
