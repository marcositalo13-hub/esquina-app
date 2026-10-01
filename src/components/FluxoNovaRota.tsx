import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { criarRota, type Rota } from '../data/manutencao';
import { useFuncionariosAtivos } from '../lib/useFuncionariosAtivos';
import { fonts, light, radius, semantic, spacing } from '../theme';
import { ExplicacaoRota } from './ExplicacaoRota';
import { SeletorResponsavel } from './SeletorResponsavel';

type Passo = 1 | 2 | 3;

type FluxoNovaRotaProps = {
  onFechar: () => void;
  // Chamado assim que a rota é gravada (passo 2), para a tela recarregar.
  onRotaCriada: (rota: Rota) => void | Promise<void>;
  onAdicionarAtividade: (rota: Rota) => void;
};

// Criação guiada de rota (Nome → Responsável → Rota criada). O único ponto
// de gravação é "Criar rota", no passo 2 — a rota já nasce com nome e
// responsável.
export function FluxoNovaRota({
  onFechar,
  onRotaCriada,
  onAdicionarAtividade,
}: FluxoNovaRotaProps) {
  const insets = useSafeAreaInsets();
  // Dispara a carga (ou reaproveita o cache) já na abertura, para o passo 2
  // encontrar a lista pronta.
  const { porId } = useFuncionariosAtivos();

  const [reduzirMovimento, setReduzirMovimento] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(
      (ativo) => setReduzirMovimento(ativo),
      () => setReduzirMovimento(false),
    );
  }, []);

  const [passo, setPasso] = useState<Passo>(1);
  const corpoRef = useRef<ScrollView>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: roda a cada troca de passo
  useEffect(() => {
    corpoRef.current?.scrollTo({ y: 0, animated: false });
  }, [passo]);

  const [nome, setNome] = useState('');
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroResponsavel, setErroResponsavel] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [rotaCriada, setRotaCriada] = useState<Rota | null>(null);
  const [confirmarDescarteVisivel, setConfirmarDescarteVisivel] =
    useState(false);

  const temDadosPreenchidos = nome.trim().length > 0 || responsavelId !== null;

  function pedirFechar() {
    if (salvando) {
      return;
    }
    if (!rotaCriada && temDadosPreenchidos) {
      setConfirmarDescarteVisivel(true);
      return;
    }
    onFechar();
  }

  function podeVoltar() {
    return passo === 2 && !salvando;
  }

  function voltar() {
    if (!podeVoltar()) {
      return;
    }
    setErroResponsavel(null);
    setErroSalvar(null);
    setPasso(1);
  }

  function handleRequestClose() {
    if (podeVoltar()) {
      voltar();
      return;
    }
    pedirFechar();
  }

  function continuar() {
    if (!nome.trim()) {
      setErroNome('Informe o nome da rota.');
      return;
    }
    setPasso(2);
  }

  async function criar() {
    if (salvando) {
      return;
    }
    if (!responsavelId || !porId.get(responsavelId)?.ativo) {
      setErroResponsavel('Escolha quem cuida desta rota.');
      return;
    }

    setSalvando(true);
    setErroSalvar(null);
    try {
      const rota = await criarRota({
        nome: nome.trim(),
        funcionario_id: responsavelId,
      });
      setRotaCriada(rota);
      setPasso(3);
      await onRotaCriada(rota);
    } catch (erro) {
      console.error('FluxoNovaRota: falha ao criar rota', erro);
      setErroSalvar(
        'Não foi possível criar a rota. Verifique a conexão e toque em “Criar rota” para tentar de novo.',
      );
    } finally {
      setSalvando(false);
    }
  }

  function acaoPrincipal() {
    if (passo === 1) {
      continuar();
    } else if (passo === 2) {
      criar();
    } else if (rotaCriada) {
      onAdicionarAtividade(rotaCriada);
    }
  }

  const rotuloBotao =
    passo === 1
      ? 'Continuar'
      : passo === 2
        ? salvando
          ? 'Criando…'
          : 'Criar rota'
        : 'Adicionar primeira atividade';

  const nomeResponsavel = responsavelId
    ? (porId.get(responsavelId)?.nome ?? '')
    : '';

  return (
    <Modal
      visible={reduzirMovimento !== null}
      transparent={false}
      animationType={reduzirMovimento ? 'none' : 'slide'}
      onRequestClose={handleRequestClose}
    >
      <View style={styles.tela}>
        <View
          style={[styles.cabecalho, { paddingTop: insets.top + spacing.md }]}
        >
          {podeVoltar() ? (
            <Pressable
              style={styles.cabecalhoBotao}
              onPress={voltar}
              hitSlop={8}
              accessibilityLabel="Voltar"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={light.textPrimary}
              />
            </Pressable>
          ) : (
            <View style={styles.cabecalhoBotao} />
          )}
          <Text style={styles.cabecalhoTitulo}>Nova rota</Text>
          <Pressable
            style={styles.cabecalhoBotao}
            onPress={pedirFechar}
            hitSlop={8}
            accessibilityLabel="Fechar"
          >
            <Ionicons
              name="close-outline"
              size={26}
              color={light.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.progresso}>
          {([1, 2, 3] as Passo[]).map((item) => (
            <View
              key={item}
              style={[
                styles.progressoSegmento,
                item <= passo && styles.progressoSegmentoAtivo,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressoTexto}>Passo {passo} de 3</Text>

        <ScrollView
          ref={corpoRef}
          contentContainerStyle={styles.corpo}
          keyboardShouldPersistTaps="handled"
        >
          {passo === 1 ? (
            <>
              <Text style={styles.pergunta}>Como se chama a rota?</Text>
              <ExplicacaoRota />
              <View style={styles.pauta}>
                <View style={styles.linha}>
                  <Text style={styles.rotulo}>Nome</Text>
                  <TextInput
                    value={nome}
                    onChangeText={(valor) => {
                      setNome(valor);
                      setErroNome(null);
                    }}
                    placeholder="Ex.: Áreas comuns — manhã"
                    placeholderTextColor={light.textMuted}
                    style={styles.inputPautado}
                  />
                  {erroNome ? (
                    <Text style={styles.erroCampo}>{erroNome}</Text>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}

          {passo === 2 ? (
            <>
              <Text style={styles.pergunta}>Quem cuida desta rota?</Text>
              <Text style={styles.subtitulo}>
                Responsável pela rota “{nome.trim()}”.
              </Text>
              <SeletorResponsavel
                selecionadoId={responsavelId}
                onSelecionar={(id) => {
                  setResponsavelId(id);
                  setErroResponsavel(null);
                }}
                erro={erroResponsavel ?? undefined}
                desabilitado={salvando}
              />
              {erroSalvar ? (
                <Text style={styles.erro}>{erroSalvar}</Text>
              ) : null}
            </>
          ) : null}

          {passo === 3 && rotaCriada ? (
            <>
              <Text style={styles.pergunta}>Rota criada</Text>
              <View style={styles.pauta}>
                <View style={styles.linha}>
                  <Text style={styles.rotulo}>Rota</Text>
                  <Text style={styles.resumoValor}>{rotaCriada.nome}</Text>
                </View>
                <View style={styles.linha}>
                  <Text style={styles.rotulo}>Responsável</Text>
                  <Text style={styles.resumoValor}>{nomeResponsavel}</Text>
                </View>
              </View>
              <Text style={styles.aviso}>Ela ainda não tem atividades.</Text>
            </>
          ) : null}
        </ScrollView>

        <View
          style={[styles.rodape, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <Pressable
            onPress={acaoPrincipal}
            style={({ pressed }) => [
              styles.botaoPrincipal,
              pressed && styles.botaoPrincipalPressionado,
            ]}
          >
            <Text style={styles.botaoPrincipalTexto}>{rotuloBotao}</Text>
          </Pressable>
          {passo === 3 ? (
            <Pressable
              onPress={onFechar}
              hitSlop={8}
              style={styles.acaoSecundaria}
            >
              <Text style={styles.link}>Fazer isso depois</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Modal
        visible={confirmarDescarteVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmarDescarteVisivel(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitulo}>Descartar rota?</Text>
            <Text style={styles.textoConfirmacao}>
              O que você preencheu será perdido.
            </Text>
            <View style={styles.confirmacaoBotoes}>
              <Pressable
                onPress={() => setConfirmarDescarteVisivel(false)}
                style={styles.confirmacaoCancelar}
              >
                <Text style={styles.link}>Continuar editando</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmarDescarteVisivel(false);
                  onFechar();
                }}
                style={({ pressed }) => [
                  styles.botaoDescartar,
                  pressed && styles.botaoDescartarPressionado,
                ]}
              >
                <Text style={styles.botaoDescartarTexto}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cabecalhoBotao: {
    width: 32,
    alignItems: 'center',
  },
  cabecalhoTitulo: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  progresso: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  progressoSegmento: {
    flex: 1,
    height: 3,
    backgroundColor: light.border,
  },
  progressoSegmentoAtivo: {
    backgroundColor: light.inkAction,
  },
  progressoTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  corpo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pergunta: {
    fontFamily: fonts.headline,
    fontSize: 17,
    lineHeight: 22,
    color: light.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitulo: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    marginBottom: spacing.sm,
  },
  pauta: {
    marginTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  linha: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
    gap: spacing.sm,
  },
  rotulo: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  inputPautado: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: light.textPrimary,
    paddingVertical: spacing.xs,
  },
  resumoValor: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  aviso: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    marginTop: spacing.md,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: semantic.overdue,
    marginTop: spacing.md,
  },
  erroCampo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  link: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.inkAction,
    textDecorationLine: 'underline',
  },
  rodape: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
    gap: spacing.md,
  },
  botaoPrincipal: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.inkAction,
  },
  botaoPrincipalPressionado: {
    backgroundColor: light.inkActionPressed,
  },
  botaoPrincipalTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: light.bg,
  },
  acaoSecundaria: {
    alignSelf: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  overlayCard: {
    backgroundColor: light.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  overlayTitulo: {
    fontFamily: fonts.headline,
    fontSize: 17,
    color: light.textPrimary,
  },
  textoConfirmacao: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
  },
  confirmacaoBotoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  confirmacaoCancelar: {
    paddingVertical: spacing.sm,
  },
  botaoDescartar: {
    borderWidth: 1,
    borderColor: semantic.overdue,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  botaoDescartarPressionado: {
    backgroundColor: `${semantic.overdue}1A`,
  },
  botaoDescartarTexto: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: semantic.overdue,
  },
});

export default FluxoNovaRota;
