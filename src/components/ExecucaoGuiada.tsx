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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StatusOrdemServico } from '../data/manutencao';
import { supabase } from '../lib/supabase';
import { fonts, light, motion, radius, semantic, spacing } from '../theme';

export type ExecucaoOrdemItem = {
  id: string;
  titulo: string;
  tipo: string;
  local: string | null;
  descricao: string | null;
  observacoes: string | null;
  status: StatusOrdemServico;
  iniciadoEm: string | null;
  pausadoEm: string | null;
  tempoPausadoSegundos: number;
};

type ExecucaoGuiadaProps = {
  // Já buscadas e ordenadas pelo chamador (ex.: por ordem_na_rota). Pode
  // incluir ordens já 'em_andamento' (continuação) — ver
  // calcularEtapaInicial, que decide se o fluxo pula transição+checklist.
  ordens: ExecucaoOrdemItem[];
  // Nome da rota, ou null para uma atividade avulsa.
  tituloContexto: string | null;
  onFinish: () => void;
};

// Decide em que etapa o fluxo começa: -1 (transição + checklist normais)
// se nenhuma ordem foi iniciada ainda, ou direto na primeira ordem ainda
// não concluída (pulando transição e checklist) se for uma continuação.
function calcularEtapaInicial(ordens: ExecucaoOrdemItem[]): number {
  const jaIniciada = ordens.some(
    (o) => o.status === 'em_andamento' || o.iniciadoEm !== null,
  );

  if (!jaIniciada) {
    return -1;
  }

  const indice = ordens.findIndex((o) => o.status !== 'concluida');
  return indice === -1 ? ordens.length + 1 : indice + 1;
}

// Fluxo guiado em tela cheia, sem volta entre etapas: etapa -1 é a
// transição azul inicial, etapa 0 é o checklist de "antes de começar",
// etapas 1..N mostram uma ordem de cada vez (podendo começar direto numa
// delas, numa continuação). Ao entrar numa etapa de ordem pela primeira
// vez, marca 'em_andamento' + iniciado_em; ao tocar "Atividade concluída",
// marca 'concluida' e avança. A última etapa mostra uma tela final com
// botão "Voltar" (onFinish). "Pausar"/"Retomar" e "Sair" ficam disponíveis
// durante as etapas de atividade — ver handlePausar/handleRetomar/handleSair.
export function ExecucaoGuiada({
  ordens,
  tituloContexto,
  onFinish,
}: ExecucaoGuiadaProps) {
  const insets = useSafeAreaInsets();
  const [etapaAtual, setEtapaAtual] = useState(() =>
    calcularEtapaInicial(ordens),
  );
  const [checkEpi, setCheckEpi] = useState(false);
  const [checkFerramentas, setCheckFerramentas] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Ordem cujo UPDATE de início (status/iniciado_em) falhou, e a mensagem
  // do erro — exibidos na etapa correspondente em vez de falhar em
  // silêncio (é o campo que alimenta "Tempo: Xmin" no admin depois).
  const [erroInicioId, setErroInicioId] = useState<string | null>(null);
  const [erroInicioTexto, setErroInicioTexto] = useState<string | null>(null);
  const [pausando, setPausando] = useState(false);
  const [retomando, setRetomando] = useState(false);
  const [erroPausa, setErroPausa] = useState<string | null>(null);
  // Overrides locais de pausa por ordem (id -> pausado_em efetivo, ou
  // null quando retomada nesta sessão) — permitem refletir pausar/retomar
  // na hora, sem esperar um refetch, e sem perder o pausado_em vindo do
  // banco ao entrar numa ordem já pausada (continuação).
  const [pausaOverrides, setPausaOverrides] = useState<
    Record<string, string | null>
  >({});
  // Acumulador local de tempo_pausado_segundos por ordem — necessário
  // porque o prop `ordens` não muda durante a sessão; sem isso, pausar e
  // retomar mais de uma vez na mesma etapa perderia o primeiro ciclo.
  const [tempoPausadoOverrides, setTempoPausadoOverrides] = useState<
    Record<string, number>
  >({});
  const opacidade = useRef(new Animated.Value(1)).current;
  const escalaTransicao = useRef(new Animated.Value(1)).current;
  // Guarda quais ordens já tiveram o UPDATE de início disparado nesta
  // sessão do fluxo — evita duplicar a chamada se o efeito re-executar.
  const iniciadasRef = useRef<Set<string>>(new Set());

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

  // Transição azul inicial: avança sozinha para o checklist depois de
  // ~900ms (ou ~300ms com reduce motion, sem animar o ícone). Numa
  // continuação, etapaAtual já começa != -1 e este efeito nunca dispara.
  useEffect(() => {
    if (etapaAtual !== -1) {
      return;
    }

    const duracao = reduceMotion ? 300 : 900;
    const timeout = setTimeout(() => setEtapaAtual(0), duracao);
    return () => clearTimeout(timeout);
  }, [etapaAtual, reduceMotion]);

  // Pulso do ícone na transição (0.7 → 1.1 → 1.0). Pulado com reduce
  // motion — o ícone fica parado na escala padrão.
  useEffect(() => {
    if (etapaAtual !== -1 || reduceMotion) {
      return;
    }

    escalaTransicao.setValue(0.7);
    Animated.sequence([
      Animated.timing(escalaTransicao, {
        toValue: 1.1,
        duration: 500,
        easing: motion.easing,
        useNativeDriver: true,
      }),
      Animated.timing(escalaTransicao, {
        toValue: 1,
        duration: 400,
        easing: motion.easing,
        useNativeDriver: true,
      }),
    ]).start();
  }, [etapaAtual, reduceMotion, escalaTransicao]);

  // Fade simples entre etapas — etapaAtual não é lido no corpo, mas precisa
  // estar nas deps para o efeito (e a animação) rodar de novo a cada troca.
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
  }, [etapaAtual, reduceMotion, opacidade]);

  const totalEtapas = ordens.length;
  const etapaFinal = etapaAtual > totalEtapas;
  const ordemAtual =
    etapaAtual >= 1 && !etapaFinal ? ordens[etapaAtual - 1] : null;

  // Estado efetivo de pausa desta ordem: override local (pausar/retomar
  // já feito nesta sessão) tem prioridade; sem override, usa o que veio
  // do banco — é isso que faz o estado "pausado" aparecer IMEDIATAMENTE
  // ao entrar numa etapa cuja ordem já estava pausada (continuação).
  const pausadoEmEfetivo = ordemAtual
    ? ordemAtual.id in pausaOverrides
      ? pausaOverrides[ordemAtual.id]
      : ordemAtual.pausadoEm
    : null;
  const pausadoAgora = pausadoEmEfetivo !== null;
  const tempoPausadoEfetivo = ordemAtual
    ? (tempoPausadoOverrides[ordemAtual.id] ?? ordemAtual.tempoPausadoSegundos)
    : 0;

  // Reseta feedback transitório (erro/loading de pausa) ao trocar de etapa
  // — não deve vazar de uma ordem para a próxima. ordemAtual não é lido no
  // corpo, mas precisa estar nas deps para disparar a cada troca de etapa.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho intencional
  useEffect(() => {
    setErroPausa(null);
    setPausando(false);
    setRetomando(false);
  }, [ordemAtual]);

  useEffect(() => {
    if (!ordemAtual || iniciadasRef.current.has(ordemAtual.id)) {
      return;
    }
    iniciadasRef.current.add(ordemAtual.id);

    // Numa continuação a ordem já tem iniciado_em — não sobrescreve (isso
    // perderia o horário real de início e distorceria "Tempo: Xmin").
    if (ordemAtual.status === 'em_andamento' && ordemAtual.iniciadoEm) {
      return;
    }

    const ordemId = ordemAtual.id;
    supabase
      .from('ordens_servico')
      .update({
        status: 'em_andamento',
        iniciado_em: new Date().toISOString(),
      })
      .eq('id', ordemId)
      .then(({ error }) => {
        if (error) {
          setErroInicioId(ordemId);
          setErroInicioTexto(error.message);
        }
      });
  }, [ordemAtual]);

  async function handleConcluir() {
    if (!ordemAtual || concluindo) {
      return;
    }

    setConcluindo(true);

    await supabase
      .from('ordens_servico')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        concluida_por: 'Teste Preservação',
      })
      .eq('id', ordemAtual.id);

    setConcluindo(false);
    setEtapaAtual((atual) => atual + 1);
  }

  async function handlePausar() {
    if (!ordemAtual || pausando) {
      return;
    }

    setPausando(true);
    setErroPausa(null);

    const agora = new Date().toISOString();
    const ordemId = ordemAtual.id;

    const { error } = await supabase
      .from('ordens_servico')
      .update({ pausado_em: agora })
      .eq('id', ordemId);

    setPausando(false);

    if (error) {
      setErroPausa(error.message);
      return;
    }

    setPausaOverrides((atual) => ({ ...atual, [ordemId]: agora }));
  }

  async function handleRetomar() {
    if (!ordemAtual || retomando || !pausadoEmEfetivo) {
      return;
    }

    setRetomando(true);
    setErroPausa(null);

    const segundosPausado = Math.max(
      0,
      Math.round((Date.now() - new Date(pausadoEmEfetivo).getTime()) / 1000),
    );
    const ordemId = ordemAtual.id;
    const tempoPausadoNovo = tempoPausadoEfetivo + segundosPausado;

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        tempo_pausado_segundos: tempoPausadoNovo,
        pausado_em: null,
      })
      .eq('id', ordemId);

    setRetomando(false);

    if (error) {
      setErroPausa(error.message);
      return;
    }

    setPausaOverrides((atual) => ({ ...atual, [ordemId]: null }));
    setTempoPausadoOverrides((atual) => ({
      ...atual,
      [ordemId]: tempoPausadoNovo,
    }));
  }

  // Sair (X/seta-voltar no cabeçalho): pausa automaticamente a ordem em
  // andamento (se ainda não pausada) e fecha o fluxo. Não aparece na
  // transição; no checklist não há ordem ativa, então não pausa nada.
  async function handleSair() {
    if (ordemAtual && ordemAtual.status !== 'concluida' && !pausadoAgora) {
      await supabase
        .from('ordens_servico')
        .update({ pausado_em: new Date().toISOString() })
        .eq('id', ordemAtual.id);
    }
    onFinish();
  }

  const podeComecar = tituloContexto ? checkEpi && checkFerramentas : true;
  const mostrarCabecalhoEtapa = etapaAtual !== -1 && !etapaFinal;

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      onRequestClose={() => {}}
    >
      {etapaAtual === -1 ? (
        <View style={styles.telaTransicao}>
          <Animated.View style={{ transform: [{ scale: escalaTransicao }] }}>
            <Ionicons
              name="checkmark-circle-outline"
              size={96}
              color="#FFFFFF"
            />
          </Animated.View>
        </View>
      ) : (
        <View style={styles.tela}>
          {mostrarCabecalhoEtapa ? (
            <View
              style={[
                styles.cabecalhoEtapa,
                { paddingTop: insets.top + spacing.md },
              ]}
            >
              {etapaAtual === 0 ? (
                <Pressable onPress={handleSair} hitSlop={8}>
                  <Text style={styles.sairTextoDiscreto}>Sair</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.sairBotao}
                  onPress={handleSair}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-outline"
                    size={26}
                    color={light.textPrimary}
                  />
                </Pressable>
              )}
            </View>
          ) : null}

          <Animated.View style={[styles.corpoAnimado, { opacity: opacidade }]}>
            <ScrollView
              contentContainerStyle={[
                styles.conteudo,
                mostrarCabecalhoEtapa
                  ? null
                  : { paddingTop: insets.top + spacing.xl },
              ]}
            >
              {etapaAtual === 0 ? (
                tituloContexto ? (
                  <>
                    <Text style={styles.titulo}>
                      Antes de começar: {tituloContexto}
                    </Text>
                    <Pressable
                      style={styles.checklistItem}
                      onPress={() => setCheckEpi((v) => !v)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checkEpi && styles.checkboxMarcado,
                        ]}
                      >
                        {checkEpi ? (
                          <Text style={styles.checkboxMarca}>✓</Text>
                        ) : null}
                      </View>
                      <Text style={styles.checklistTexto}>
                        Estou utilizando os equipamentos de proteção necessários
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.checklistItem}
                      onPress={() => setCheckFerramentas((v) => !v)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checkFerramentas && styles.checkboxMarcado,
                        ]}
                      >
                        {checkFerramentas ? (
                          <Text style={styles.checkboxMarca}>✓</Text>
                        ) : null}
                      </View>
                      <Text style={styles.checklistTexto}>
                        Tenho todas as ferramentas e equipamentos necessários
                        comigo
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.titulo}>Antes de começar</Text>
                    <Text style={styles.paragrafo}>
                      Lembre-se de utilizar os equipamentos de proteção e
                      verificar suas ferramentas antes de iniciar.
                    </Text>
                  </>
                )
              ) : etapaFinal ? (
                <View style={styles.telaFinal}>
                  <Text style={styles.titulo}>
                    {tituloContexto
                      ? 'Rota concluída!'
                      : 'Atividade concluída!'}
                  </Text>
                </View>
              ) : ordemAtual ? (
                pausadoAgora ? (
                  <View style={styles.pausadoContainer}>
                    <Ionicons
                      name="pause-circle-outline"
                      size={64}
                      color={light.textSecondary}
                    />
                    <Text style={styles.pausadoTitulo}>Atividade pausada</Text>
                    {erroPausa ? (
                      <Text style={styles.erro}>{erroPausa}</Text>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <Text style={styles.etapaContador}>
                      Atividade {etapaAtual} de {totalEtapas}
                    </Text>
                    <Text style={styles.tituloAtividade}>
                      {ordemAtual.titulo}
                    </Text>
                    <Text style={styles.tipoAtividade}>{ordemAtual.tipo}</Text>
                    {ordemAtual.local ? (
                      <Text style={styles.detalhe}>{ordemAtual.local}</Text>
                    ) : null}
                    {ordemAtual.descricao ? (
                      <Text style={styles.paragrafo}>
                        {ordemAtual.descricao}
                      </Text>
                    ) : null}
                    {ordemAtual.observacoes ? (
                      <Text style={styles.paragrafo}>
                        {ordemAtual.observacoes}
                      </Text>
                    ) : null}
                    {erroInicioId === ordemAtual.id && erroInicioTexto ? (
                      <Text style={styles.erro}>
                        Não foi possível registrar o início: {erroInicioTexto}
                      </Text>
                    ) : null}
                    {erroPausa ? (
                      <Text style={styles.erro}>{erroPausa}</Text>
                    ) : null}
                  </>
                )
              ) : null}
            </ScrollView>
          </Animated.View>

          <View
            style={[
              styles.rodape,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            {etapaAtual === 0 ? (
              <Pressable
                style={[
                  styles.botaoPrimario,
                  !podeComecar && styles.botaoDesabilitado,
                ]}
                onPress={() => setEtapaAtual(1)}
                disabled={!podeComecar}
              >
                <Text style={styles.botaoPrimarioTexto}>Começar</Text>
              </Pressable>
            ) : etapaFinal ? (
              <Pressable style={styles.botaoPrimario} onPress={onFinish}>
                <Text style={styles.botaoPrimarioTexto}>Voltar</Text>
              </Pressable>
            ) : pausadoAgora ? (
              <Pressable
                style={[
                  styles.botaoPrimario,
                  retomando && styles.botaoDesabilitado,
                ]}
                onPress={handleRetomar}
                disabled={retomando}
              >
                <Text style={styles.botaoPrimarioTexto}>
                  {retomando ? 'Retomando…' : 'Retomar atividade'}
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={[
                    styles.botaoPrimario,
                    concluindo && styles.botaoDesabilitado,
                  ]}
                  onPress={handleConcluir}
                  disabled={concluindo}
                >
                  <Text style={styles.botaoPrimarioTexto}>
                    {concluindo ? 'Salvando…' : 'Atividade concluída'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.botaoSecundario,
                    pausando && styles.botaoDesabilitado,
                  ]}
                  onPress={handlePausar}
                  disabled={pausando}
                >
                  <Text style={styles.botaoSecundarioTexto}>
                    {pausando ? 'Pausando…' : 'Pausar'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: light.bg,
  },
  telaTransicao: {
    flex: 1,
    backgroundColor: light.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoEtapa: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sairBotao: {
    padding: 2,
  },
  sairTextoDiscreto: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
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
  },
  pausadoContainer: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pausadoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
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
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMarcado: {
    backgroundColor: light.brand,
    borderColor: light.brand,
  },
  checkboxMarca: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  checklistTexto: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  etapaContador: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  tituloAtividade: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: light.textPrimary,
  },
  tipoAtividade: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textSecondary,
  },
  detalhe: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textMuted,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  rodape: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
    gap: spacing.sm,
  },
  botaoPrimario: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.brand,
  },
  botaoSecundario: {
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
  botaoDesabilitado: {
    opacity: 0.4,
  },
  botaoPrimarioTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});

export default ExecucaoGuiada;
