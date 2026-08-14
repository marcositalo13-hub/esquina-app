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
import { supabase } from '../lib/supabase';
import { fonts, light, motion, radius, spacing } from '../theme';

export type ExecucaoOrdemItem = {
  id: string;
  titulo: string;
  tipo: string;
  local: string | null;
  descricao: string | null;
  observacoes: string | null;
};

type ExecucaoGuiadaProps = {
  // Já buscadas e ordenadas pelo chamador (ex.: por ordem_na_rota).
  ordens: ExecucaoOrdemItem[];
  // Nome da rota, ou null para uma atividade avulsa.
  tituloContexto: string | null;
  onFinish: () => void;
};

// Fluxo guiado em tela cheia, sem volta entre etapas: etapa 0 é o checklist
// de "antes de começar", etapas 1..N mostram uma ordem de cada vez. Ao
// entrar numa etapa de ordem, marca 'em_andamento' + iniciado_em; ao tocar
// "Atividade concluída", marca 'concluida' e avança. A última etapa mostra
// uma tela final com botão "Voltar" (onFinish).
export function ExecucaoGuiada({
  ordens,
  tituloContexto,
  onFinish,
}: ExecucaoGuiadaProps) {
  const insets = useSafeAreaInsets();
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [checkEpi, setCheckEpi] = useState(false);
  const [checkFerramentas, setCheckFerramentas] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacidade = useRef(new Animated.Value(1)).current;
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

  useEffect(() => {
    if (!ordemAtual || iniciadasRef.current.has(ordemAtual.id)) {
      return;
    }
    iniciadasRef.current.add(ordemAtual.id);

    supabase
      .from('ordens_servico')
      .update({ status: 'em_andamento', iniciado_em: new Date().toISOString() })
      .eq('id', ordemAtual.id)
      .then();
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

  const podeComecar = tituloContexto ? checkEpi && checkFerramentas : true;

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      onRequestClose={() => {}}
    >
      <View style={styles.tela}>
        <Animated.View style={[styles.corpoAnimado, { opacity: opacidade }]}>
          <ScrollView
            contentContainerStyle={[
              styles.conteudo,
              { paddingTop: insets.top + spacing.xl },
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
                  {tituloContexto ? 'Rota concluída!' : 'Atividade concluída!'}
                </Text>
              </View>
            ) : ordemAtual ? (
              <>
                <Text style={styles.etapaContador}>
                  Atividade {etapaAtual} de {totalEtapas}
                </Text>
                <Text style={styles.tituloAtividade}>{ordemAtual.titulo}</Text>
                <Text style={styles.tipoAtividade}>{ordemAtual.tipo}</Text>
                {ordemAtual.local ? (
                  <Text style={styles.detalhe}>{ordemAtual.local}</Text>
                ) : null}
                {ordemAtual.descricao ? (
                  <Text style={styles.paragrafo}>{ordemAtual.descricao}</Text>
                ) : null}
                {ordemAtual.observacoes ? (
                  <Text style={styles.paragrafo}>{ordemAtual.observacoes}</Text>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </Animated.View>

        <View
          style={[styles.rodape, { paddingBottom: insets.bottom + spacing.md }]}
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
          ) : (
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
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: light.bg,
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
  rodape: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoPrimario: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.brand,
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
