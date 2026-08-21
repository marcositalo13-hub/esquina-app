import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatarDuracao,
  getQualidadeInfo,
  hojeLocal,
  type OrdemServico,
  type Qualidade,
} from '../data/manutencao';
import { supabase } from '../lib/supabase';
import { fonts, light, motion, radius, semantic, spacing } from '../theme';

type Etapa = 'pergunta' | 'qualidade' | 'reprovar';

type ValidacaoGuiadaProps = {
  // Ordem que deve aparecer primeiro na fila, mesmo que a ordenação
  // natural (rota/ordem_na_rota) a colocasse depois.
  ordemInicialId: string;
  onFinish: () => void;
};

const OPCOES_QUALIDADE: Qualidade[] = ['bom', 'medio', 'ruim'];

// Fluxo guiado em tela cheia, sem volta entre etapas — espelha o padrão
// de ExecucaoGuiada.tsx. Busca todas as ordens de hoje concluídas e ainda
// não validadas, reordena para começar por ordemInicialId, e para cada
// uma pergunta "concluída conforme esperado?": Sim -> escolher qualidade
// e validar; Não -> reprovar com motivo. Ao esvaziar a fila, mostra uma
// tela final com botão "Concluir" (onFinish).
export function ValidacaoGuiada({
  ordemInicialId,
  onFinish,
}: ValidacaoGuiadaProps) {
  const insets = useSafeAreaInsets();
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [fila, setFila] = useState<OrdemServico[]>([]);
  const [filaIndex, setFilaIndex] = useState(0);
  const [etapa, setEtapa] = useState<Etapa>('pergunta');
  const [qualidadeSelecionada, setQualidadeSelecionada] =
    useState<Qualidade | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacidade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let montado = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (montado) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      montado = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    supabase
      .from('ordens_servico')
      .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
      .eq('data_prevista', hojeLocal())
      .eq('status', 'concluida')
      .eq('validada', false)
      .then(({ data, error }) => {
        if (cancelado) {
          return;
        }
        setCarregando(false);

        if (error) {
          setErroCarregar(error.message);
          return;
        }

        const lista = (data ?? []) as OrdemServico[];
        const ordenada = [...lista].sort((a, b) => {
          const rotaA = a.planos_manutencao?.rota_id ?? null;
          const rotaB = b.planos_manutencao?.rota_id ?? null;

          if (rotaA !== rotaB) {
            if (rotaA === null) {
              return 1;
            }
            if (rotaB === null) {
              return -1;
            }
            return rotaA.localeCompare(rotaB);
          }

          const ordemA = a.planos_manutencao?.ordem_na_rota ?? 0;
          const ordemB = b.planos_manutencao?.ordem_na_rota ?? 0;
          return ordemA - ordemB;
        });

        // Garante que ordemInicialId apareça primeiro, mesmo que a
        // ordenação por rota/ordem_na_rota a colocasse depois.
        const indiceInicial = ordenada.findIndex(
          (o) => o.id === ordemInicialId,
        );
        const filaOrdenada =
          indiceInicial > 0
            ? [
                ordenada[indiceInicial],
                ...ordenada.slice(0, indiceInicial),
                ...ordenada.slice(indiceInicial + 1),
              ]
            : ordenada;

        setFila(filaOrdenada);
      });

    return () => {
      cancelado = true;
    };
  }, [ordemInicialId]);

  // Fade simples entre atividades (troca de filaIndex) — mesmo padrão do
  // ExecucaoGuiada. filaIndex não é lido no corpo, mas precisa estar nas
  // deps para o efeito rodar de novo a cada troca.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho intencional
  useEffect(() => {
    if (reduceMotion) {
      opacidade.setValue(1);
      return;
    }

    opacidade.setValue(0);
    Animated.timing(opacidade, {
      toValue: 1,
      duration: motion.duration.base,
      easing: motion.easing,
      useNativeDriver: true,
    }).start();
  }, [filaIndex, reduceMotion, opacidade]);

  const ordemAtual = fila[filaIndex] ?? null;
  const semItens = !carregando && !erroCarregar && fila.length === 0;
  const filaFinalizada =
    !carregando && !erroCarregar && fila.length > 0 && filaIndex >= fila.length;
  const mostrarFluxo =
    !carregando && !erroCarregar && !semItens && !filaFinalizada;

  function avancar() {
    setEtapa('pergunta');
    setQualidadeSelecionada(null);
    setMotivoReprovacao('');
    setErroAcao(null);
    setFilaIndex((atual) => atual + 1);
  }

  async function handleConfirmarReprovacao() {
    if (!ordemAtual || processando) {
      return;
    }

    setProcessando(true);
    setErroAcao(null);

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
      .eq('id', ordemAtual.id);

    setProcessando(false);

    if (error) {
      setErroAcao(error.message);
      return;
    }

    avancar();
  }

  async function handleValidar() {
    if (!ordemAtual || !qualidadeSelecionada || processando) {
      return;
    }

    setProcessando(true);
    setErroAcao(null);

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        validada: true,
        qualidade: qualidadeSelecionada,
        validada_em: new Date().toISOString(),
        validada_por: 'Teste Administrador',
      })
      .eq('id', ordemAtual.id);

    setProcessando(false);

    if (error) {
      setErroAcao(error.message);
      return;
    }

    avancar();
  }

  const tempoTexto =
    ordemAtual?.concluida_em && ordemAtual?.iniciado_em
      ? formatarDuracao(
          Math.max(
            0,
            (new Date(ordemAtual.concluida_em).getTime() -
              new Date(ordemAtual.iniciado_em).getTime()) /
              1000 -
              ordemAtual.tempo_pausado_segundos,
          ),
        )
      : null;

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      onRequestClose={() => {}}
    >
      <View style={styles.tela}>
        <View
          style={[styles.cabecalho, { paddingTop: insets.top + spacing.md }]}
        >
          <Pressable style={styles.sairBotao} onPress={onFinish} hitSlop={8}>
            <Ionicons
              name="close-outline"
              size={26}
              color={light.textPrimary}
            />
          </Pressable>
        </View>

        <Animated.View style={[styles.corpoAnimado, { opacity: opacidade }]}>
          <ScrollView
            contentContainerStyle={styles.conteudo}
            keyboardShouldPersistTaps="handled"
          >
            {carregando ? (
              <Text style={styles.paragrafo}>Carregando…</Text>
            ) : erroCarregar ? (
              <Text style={styles.erro}>{erroCarregar}</Text>
            ) : semItens || filaFinalizada ? (
              <View style={styles.telaFinal}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={64}
                  color={semantic.ok}
                />
                <Text style={styles.titulo}>Tudo validado por aqui</Text>
              </View>
            ) : ordemAtual ? (
              <>
                <View style={styles.infoAtividade}>
                  <Text style={styles.tituloAtividade}>
                    {ordemAtual.planos_manutencao?.titulo ?? 'Atividade'}
                  </Text>
                  <Text style={styles.tipoAtividade}>
                    {ordemAtual.planos_manutencao?.tipos_atividade?.nome ??
                      'Sem tipo'}
                  </Text>
                  {ordemAtual.planos_manutencao?.local ? (
                    <Text style={styles.detalhe}>
                      {ordemAtual.planos_manutencao.local}
                    </Text>
                  ) : null}
                  {ordemAtual.planos_manutencao?.rotas ? (
                    <Text style={styles.detalhe}>
                      Rota: {ordemAtual.planos_manutencao.rotas.nome}
                    </Text>
                  ) : null}
                  <Text style={styles.detalhe}>
                    Concluído por: {ordemAtual.concluida_por ?? '—'}
                  </Text>
                  {tempoTexto ? (
                    <Text style={styles.detalhe}>Tempo: {tempoTexto}</Text>
                  ) : null}
                </View>

                {etapa === 'pergunta' ? (
                  <Text style={styles.pergunta}>
                    A atividade foi concluída conforme esperado?
                  </Text>
                ) : etapa === 'qualidade' ? (
                  <>
                    <Text style={styles.pergunta}>
                      Como você avalia a qualidade?
                    </Text>
                    {OPCOES_QUALIDADE.map((opcao) => {
                      const info = getQualidadeInfo(opcao);
                      const selecionada = qualidadeSelecionada === opcao;

                      return (
                        <Pressable
                          key={opcao}
                          style={[
                            styles.opcaoQualidade,
                            selecionada && {
                              borderColor: info.color,
                              backgroundColor: `${info.color}0D`,
                            },
                          ]}
                          onPress={() => setQualidadeSelecionada(opcao)}
                        >
                          <View style={styles.opcaoQualidadeCabecalho}>
                            <View
                              style={[
                                styles.opcaoQualidadeBolinha,
                                { backgroundColor: info.color },
                              ]}
                            />
                            <Text
                              style={[
                                styles.opcaoQualidadeLabel,
                                { color: info.color },
                              ]}
                            >
                              {info.label}
                            </Text>
                          </View>
                          <Text style={styles.opcaoQualidadeDescricao}>
                            {info.descricao}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <Text style={styles.pergunta}>Motivo da reprovação</Text>
                    <TextInput
                      value={motivoReprovacao}
                      onChangeText={setMotivoReprovacao}
                      placeholder="Descreva o motivo"
                      placeholderTextColor={light.textSecondary}
                      multiline
                      numberOfLines={4}
                      style={[styles.input, styles.inputMultiline]}
                    />
                  </>
                )}

                {erroAcao ? <Text style={styles.erro}>{erroAcao}</Text> : null}
              </>
            ) : null}
          </ScrollView>
        </Animated.View>

        {mostrarFluxo || semItens || filaFinalizada ? (
          <View
            style={[
              styles.rodape,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            {semItens || filaFinalizada ? (
              <Pressable style={styles.botaoPrimario} onPress={onFinish}>
                <Text style={styles.botaoPrimarioTexto}>Concluir</Text>
              </Pressable>
            ) : etapa === 'pergunta' ? (
              <>
                <Pressable
                  style={styles.botaoSecundario}
                  onPress={() => setEtapa('reprovar')}
                >
                  <Text style={styles.botaoSecundarioTexto}>Não</Text>
                </Pressable>
                <Pressable
                  style={styles.botaoPrimario}
                  onPress={() => setEtapa('qualidade')}
                >
                  <Text style={styles.botaoPrimarioTexto}>Sim</Text>
                </Pressable>
              </>
            ) : etapa === 'qualidade' ? (
              <Pressable
                style={[
                  styles.botaoPrimario,
                  (!qualidadeSelecionada || processando) &&
                    styles.botaoDesabilitado,
                ]}
                onPress={handleValidar}
                disabled={!qualidadeSelecionada || processando}
              >
                <Text style={styles.botaoPrimarioTexto}>
                  {processando ? 'Salvando…' : 'Validar atividade'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.botaoPerigo,
                  processando && styles.botaoDesabilitado,
                ]}
                onPress={handleConfirmarReprovacao}
                disabled={processando}
              >
                <Text style={styles.botaoPrimarioTexto}>
                  {processando ? 'Reprovando…' : 'Confirmar reprovação'}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: light.bg,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sairBotao: {
    padding: 2,
  },
  corpoAnimado: {
    flex: 1,
  },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  telaFinal: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  infoAtividade: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  titulo: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  paragrafo: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textSecondary,
    lineHeight: 22,
  },
  tituloAtividade: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  tipoAtividade: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textSecondary,
  },
  detalhe: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textMuted,
  },
  pergunta: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    marginTop: spacing.sm,
  },
  opcaoQualidade: {
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  opcaoQualidadeCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  opcaoQualidadeBolinha: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  opcaoQualidadeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  opcaoQualidadeDescricao: {
    fontFamily: fonts.regular,
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
    minHeight: 96,
    textAlignVertical: 'top',
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  rodape: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoPrimario: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.brand,
  },
  botaoSecundario: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoSecundarioTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  botaoPerigo: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: semantic.overdue,
  },
  botaoDesabilitado: {
    opacity: 0.4,
  },
  botaoPrimarioTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});

export default ValidacaoGuiada;
