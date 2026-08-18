import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../src/components/Chip';
import {
  ExecucaoGuiada,
  type ExecucaoOrdemItem,
} from '../src/components/ExecucaoGuiada';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { StatusBadge } from '../src/components/StatusBadge';
import {
  corIndicadorGrupo,
  formatarDataBR,
  getCorPrioridade,
  hojeLocal,
  type OrdemServico,
  type Rota,
} from '../src/data/manutencao';
import { supabase } from '../src/lib/supabase';
import { preencherOcorrenciasFaltantes } from '../src/lib/topUpOcorrencias';
import { fonts, light, radius, semantic, spacing } from '../src/theme';

const hoje = hojeLocal;

type GrupoRota = { rota: Rota; itens: OrdemServico[] };

type ExecucaoAtiva = {
  ordens: ExecucaoOrdemItem[];
  tituloContexto: string | null;
};

// Aviso inline exibido no próprio card de rota quando "Iniciar Rota"/
// "Continuar" não encontra nada acionável, ou quando a consulta falha.
type AvisoCard = {
  id: string;
  texto: string;
  erro: boolean;
};

const AVISO_DURACAO_MS = 4000;

// Converte uma ordem (com plano/tipo já embutidos pela consulta) para o
// formato enxuto que o ExecucaoGuiada espera.
function paraItemExecucao(ordem: OrdemServico): ExecucaoOrdemItem {
  const plano = ordem.planos_manutencao;
  return {
    id: ordem.id,
    titulo: plano?.titulo ?? 'Atividade',
    tipo: plano?.tipos_atividade?.nome ?? 'Sem tipo',
    local: plano?.local ?? null,
    descricao: plano?.descricao ?? null,
    observacoes: plano?.observacoes ?? null,
    status: ordem.status,
    iniciadoEm: ordem.iniciado_em,
    pausadoEm: ordem.pausado_em,
    tempoPausadoSegundos: ordem.tempo_pausado_segundos,
  };
}

// Uma rota é "continuação" (em vez de início novo) quando ao menos uma
// ordem dela já está em_andamento ou já tem iniciado_em preenchido.
function ehContinuacao(itens: OrdemServico[]): boolean {
  return itens.some(
    (o) => o.status === 'em_andamento' || o.iniciado_em !== null,
  );
}

// Frase convidativa do card de rota — varia só no singular/plural.
function fraseResumoRota(total: number): string {
  if (total === 1) {
    return '1 atividade programada para hoje. Vamos começar?';
  }
  return `${total} atividades programadas para hoje. Vamos começar?`;
}

export default function Preservacao() {
  const insets = useSafeAreaInsets();

  const [pendentes, setPendentes] = useState<OrdemServico[]>([]);
  const [concluidas, setConcluidas] = useState<OrdemServico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [execucao, setExecucao] = useState<ExecucaoAtiva | null>(null);
  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const [avisoRota, setAvisoRota] = useState<AvisoCard | null>(null);
  const avisoRotaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fila de reprovações pendentes — alimenta o badge do sino. A tela cheia
  // só abre quando o sino é tocado (handleAbrirNotificacoes), uma
  // reprovação por vez, até esvaziar (ver renderização mais abaixo).
  const [reprovacoes, setReprovacoes] = useState<OrdemServico[]>([]);
  const [processandoReprovacao, setProcessandoReprovacao] = useState(false);
  const [modalReprovacaoVisivel, setModalReprovacaoVisivel] = useState(false);

  useEffect(() => {
    return () => {
      if (avisoRotaTimeout.current) {
        clearTimeout(avisoRotaTimeout.current);
      }
    };
  }, []);

  const carregar = useCallback(async () => {
    const [respostaPendentes, respostaConcluidas] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
        .neq('status', 'concluida')
        // A equipe de execução nunca vê atrasadas: só "pendentes" de hoje
        // (nunca data_prevista < hoje). Atrasadas seguem visíveis só para
        // o Administrador em app/admin/preservacao.tsx.
        .eq('data_prevista', hoje())
        .order('data_prevista', { ascending: true }),
      supabase
        .from('ordens_servico')
        .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false }),
    ]);

    if (respostaPendentes.error) {
      setErro(respostaPendentes.error.message);
      return;
    }
    if (respostaConcluidas.error) {
      setErro(respostaConcluidas.error.message);
      return;
    }

    setErro(null);
    setPendentes((respostaPendentes.data ?? []) as OrdemServico[]);
    setConcluidas((respostaConcluidas.data ?? []) as OrdemServico[]);
  }, []);

  useEffect(() => {
    carregar().then(() => {
      preencherOcorrenciasFaltantes().then(() => {
        carregar();
      });
    });
  }, [carregar]);

  // Verifica se há atividades reprovadas pendentes de "leitura" pela
  // equipe de execução. Roda no mount e sempre que a tela ganha foco de
  // novo (ex.: volta de outra aba) via useFocusEffect. Só alimenta a
  // contagem/badge do sino — não abre mais a tela cheia sozinha (ver
  // handleAbrirNotificacoes).
  const verificarReprovacoes = useCallback(async () => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
      .eq('reprovacao_pendente', true)
      .order('reprovada_em', { ascending: true });

    if (error) {
      setErro(error.message);
      return;
    }

    setReprovacoes((data ?? []) as OrdemServico[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      verificarReprovacoes();
    }, [verificarReprovacoes]),
  );

  // Realtime: qualquer mudança em ordens_servico (concluída em outro
  // dispositivo, reprovada pelo admin, nova ocorrência gerada, etc.)
  // refaz os mesmos refetches já usados para atualizar a tela — sem
  // duplicar a lógica de busca.
  useEffect(() => {
    const canal = supabase
      .channel('preservacao-execucao-ordens-servico')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordens_servico' },
        () => {
          carregar();
          verificarReprovacoes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, verificarReprovacoes]);

  const reprovacaoAtual = reprovacoes[0] ?? null;

  async function handleEntenderReprovacao() {
    if (!reprovacaoAtual || processandoReprovacao) {
      return;
    }

    setProcessandoReprovacao(true);

    const { error } = await supabase
      .from('ordens_servico')
      .update({ reprovacao_pendente: false })
      .eq('id', reprovacaoAtual.id);

    setProcessandoReprovacao(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setReprovacoes((atual) => {
      const restante = atual.slice(1);
      if (restante.length === 0) {
        // Fila esvaziou — fecha o modal em vez de deixá-lo "armado" para
        // reabrir sozinho quando uma reprovação nova chegar via Realtime.
        setModalReprovacaoVisivel(false);
      }
      return restante;
    });
  }

  // Sino: só abre a tela cheia se houver alguma reprovação pendente. Com
  // contador zerado, o toque não faz nada.
  function handleAbrirNotificacoes() {
    if (reprovacoes.length === 0) {
      return;
    }
    setModalReprovacaoVisivel(true);
  }

  // Resumo do dia: agrupa por rota apenas as ordens de HOJE que têm rota.
  const resumoRotas = useMemo(() => {
    const hojeStr = hoje();
    const grupos = new Map<string, GrupoRota>();

    for (const ordem of [...pendentes, ...concluidas]) {
      if (ordem.data_prevista !== hojeStr) {
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
      }
    }

    for (const grupo of grupos.values()) {
      grupo.itens.sort((a, b) => {
        const ordemA = a.planos_manutencao?.ordem_na_rota ?? 0;
        const ordemB = b.planos_manutencao?.ordem_na_rota ?? 0;
        return ordemA - ordemB;
      });
    }

    return Array.from(grupos.values());
  }, [pendentes, concluidas]);

  // Atividades de hoje COM rota já aparecem no Resumo do dia — somem da
  // seção Concluídas para não duplicar. Sem rota (hoje ou não) e qualquer
  // outra data continuam aparecendo normalmente.
  const concluidasExibidas = useMemo(() => {
    const hojeStr = hoje();
    return concluidas.filter(
      (o) => !(o.data_prevista === hojeStr && o.planos_manutencao?.rota_id),
    );
  }, [concluidas]);

  function mostrarAvisoRota(rotaId: string, texto: string, erro: boolean) {
    if (avisoRotaTimeout.current) {
      clearTimeout(avisoRotaTimeout.current);
    }
    setAvisoRota({ id: rotaId, texto, erro });
    avisoRotaTimeout.current = setTimeout(
      () => setAvisoRota(null),
      AVISO_DURACAO_MS,
    );
  }

  // Rede de segurança: busca as ordens acionáveis da rota DIRETO no banco
  // (em vez de confiar no estado local, que pode estar desatualizado) antes
  // de abrir o fluxo — inclui 'pendente' E 'em_andamento' (continuação),
  // não só 'pendente'. Array vazio → aviso inline no card, sem abrir o
  // fluxo. Falha na consulta → mesmo lugar, mensagem em semantic.overdue.
  async function handleIniciarRota(grupo: GrupoRota) {
    setAvisoRota(null);
    setVerificandoId(grupo.rota.id);

    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
        .in('status', ['pendente', 'em_andamento'])
        .eq('data_prevista', hoje());

      if (error) {
        throw error;
      }

      const itensAcionaveis = ((data ?? []) as OrdemServico[])
        .filter((o) => o.planos_manutencao?.rota_id === grupo.rota.id)
        .sort((a, b) => {
          const ordemA = a.planos_manutencao?.ordem_na_rota ?? 0;
          const ordemB = b.planos_manutencao?.ordem_na_rota ?? 0;
          return ordemA - ordemB;
        })
        .map(paraItemExecucao);

      if (itensAcionaveis.length === 0) {
        mostrarAvisoRota(
          grupo.rota.id,
          'Todas as atividades desta rota já foram concluídas hoje.',
          false,
        );
        return;
      }

      setExecucao({
        ordens: itensAcionaveis,
        tituloContexto: grupo.rota.nome,
      });
    } catch (err) {
      mostrarAvisoRota(
        grupo.rota.id,
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as atividades desta rota.',
        true,
      );
    } finally {
      setVerificandoId(null);
    }
  }

  function handleFinalizarExecucao() {
    setExecucao(null);
    carregar();
  }

  return (
    <View style={styles.container}>
      {modalReprovacaoVisivel && reprovacaoAtual ? (
        <Modal
          visible
          transparent={false}
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View
            style={[
              styles.telaReprovacao,
              {
                paddingTop: insets.top + spacing.xl,
                paddingBottom: insets.bottom + spacing.xl,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={72} color="#FFFFFF" />
            <Text style={styles.reprovacaoTitulo}>Atividade reprovada</Text>

            <View style={styles.reprovacaoInfo}>
              <Text style={styles.reprovacaoNome}>
                {reprovacaoAtual.planos_manutencao?.titulo ?? 'Atividade'}
              </Text>
              <Text style={styles.reprovacaoDetalhe}>
                {reprovacaoAtual.planos_manutencao?.tipos_atividade?.nome ??
                  'Sem tipo'}
              </Text>
              {reprovacaoAtual.planos_manutencao?.local ? (
                <Text style={styles.reprovacaoDetalhe}>
                  {reprovacaoAtual.planos_manutencao.local}
                </Text>
              ) : null}

              <Text style={styles.reprovacaoMotivoLabel}>Motivo</Text>
              <Text style={styles.reprovacaoMotivoTexto}>
                {reprovacaoAtual.motivo_reprovacao?.trim()
                  ? reprovacaoAtual.motivo_reprovacao
                  : 'Nenhum motivo informado'}
              </Text>
            </View>

            <Pressable
              style={[
                styles.reprovacaoBotao,
                processandoReprovacao && styles.reprovacaoBotaoDesabilitado,
              ]}
              onPress={handleEntenderReprovacao}
              disabled={processandoReprovacao}
            >
              <Text style={styles.reprovacaoBotaoTexto}>
                {processandoReprovacao ? 'Salvando…' : 'Entendido'}
              </Text>
            </Pressable>
          </View>
        </Modal>
      ) : null}

      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Zeladoria</Text>
        <View style={styles.headerAcoes}>
          <Pressable
            style={styles.sinoBotao}
            onPress={handleAbrirNotificacoes}
            hitSlop={8}
          >
            <Ionicons
              name={
                reprovacoes.length > 0
                  ? 'notifications'
                  : 'notifications-outline'
              }
              size={22}
              color={light.textPrimary}
            />
            {reprovacoes.length > 0 ? (
              <View style={styles.sinoBadge}>
                <Text style={styles.sinoBadgeTexto}>
                  {reprovacoes.length > 9 ? '9+' : reprovacoes.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.trocarPerfil}>Trocar perfil</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {resumoRotas.length > 0 ? (
          <>
            <Text style={styles.secaoTitulo}>Resumo do dia</Text>
            <View style={styles.lista}>
              {resumoRotas.map((grupo) => {
                const concluidasCount = grupo.itens.filter(
                  (o) => o.status === 'concluida',
                ).length;
                const iniciadasCount = grupo.itens.filter(
                  (o) => o.status !== 'pendente',
                ).length;
                // Mostra o botão quando existe ao menos uma ordem de hoje,
                // nesta rota, ainda 'pendente' OU 'em_andamento' (uma
                // 'em_andamento' sem tudo mais concluído é uma rota pausada
                // no meio — precisa continuar aparecendo acionável).
                const temPendente = grupo.itens.some(
                  (o) => o.status === 'pendente',
                );
                const temAcao =
                  temPendente ||
                  grupo.itens.some((o) => o.status === 'em_andamento');
                // Continuação: ao menos uma ordem já foi iniciada — o botão
                // vira "Continuar" e o fluxo pula transição/checklist.
                const continuacao = ehContinuacao(grupo.itens);
                // 100% concluída: todas as ordens de hoje da rota estão
                // 'concluida' (logo, nenhuma pendente nem em_andamento).
                const todasConcluidas =
                  grupo.itens.length > 0 &&
                  concluidasCount === grupo.itens.length;
                const cor = corIndicadorGrupo(
                  grupo.itens.length,
                  concluidasCount,
                  iniciadasCount,
                );

                return (
                  <View key={grupo.rota.id} style={styles.resumoRotaCard}>
                    <View style={styles.resumoRotaCabecalho}>
                      <View
                        style={[
                          styles.resumoRotaIndicador,
                          { backgroundColor: cor },
                        ]}
                      />
                      <View style={styles.resumoRotaInfo}>
                        <Text style={styles.resumoRotaTitulo}>
                          {grupo.rota.nome}
                        </Text>
                        <Text style={styles.resumoRotaContagem}>
                          {fraseResumoRota(grupo.itens.length)}
                        </Text>
                      </View>
                    </View>

                    {temAcao ? (
                      <Pressable
                        style={styles.botaoIniciarRota}
                        onPress={() => handleIniciarRota(grupo)}
                        disabled={verificandoId === grupo.rota.id}
                      >
                        <Text style={styles.botaoIniciarRotaTexto}>
                          {verificandoId === grupo.rota.id
                            ? 'Verificando…'
                            : continuacao
                              ? 'Continuar'
                              : 'Iniciar Rota'}
                        </Text>
                      </Pressable>
                    ) : todasConcluidas ? (
                      <View style={styles.rotaConcluidaIndicador}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={semantic.ok}
                        />
                        <Text style={styles.rotaConcluidaTexto}>
                          Todas as atividades concluídas
                        </Text>
                      </View>
                    ) : null}

                    {avisoRota?.id === grupo.rota.id ? (
                      <Text style={avisoRota.erro ? styles.erro : styles.aviso}>
                        {avisoRota.texto}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.secaoTitulo}>Concluídas</Text>
        {concluidasExibidas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma ordem concluída.</Text>
        ) : (
          <View style={styles.lista}>
            {concluidasExibidas.map((ordem) => {
              const plano = ordem.planos_manutencao;

              return (
                <View
                  key={ordem.id}
                  style={[styles.card, styles.cardConcluida]}
                >
                  <Text style={styles.cardTitulo}>
                    {plano?.titulo ?? 'Atividade'}
                  </Text>
                  <Text style={styles.cardTipo}>
                    {plano?.tipos_atividade?.nome ?? 'Sem tipo'}
                  </Text>
                  {plano?.local ? (
                    <Text style={styles.cardDetalhe}>{plano.local}</Text>
                  ) : null}

                  <View style={styles.cardRodape}>
                    <View style={styles.cardRodapeEsquerda}>
                      <Text style={styles.cardDetalhe}>
                        Concluída em{' '}
                        {ordem.concluida_em
                          ? `${formatarDataBR(ordem.concluida_em.slice(0, 10))} às ${new Date(
                              ordem.concluida_em,
                            ).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : '—'}
                      </Text>
                      <StatusBadge ordem={ordem} />
                    </View>
                    {plano ? (
                      <Chip
                        label={plano.prioridade}
                        color={getCorPrioridade(plano.prioridade)}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {execucao ? (
        <ExecucaoGuiada
          ordens={execucao.ordens}
          tituloContexto={execucao.tituloContexto}
          onFinish={handleFinalizarExecucao}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  trocarPerfil: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  headerAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sinoBotao: {
    position: 'relative',
    padding: 2,
  },
  sinoBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: semantic.overdue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sinoBadgeTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  aviso: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  secaoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: light.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  lista: {
    gap: spacing.sm,
  },
  resumoRotaCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  resumoRotaCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resumoRotaIndicador: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resumoRotaInfo: {
    flex: 1,
  },
  resumoRotaTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  resumoRotaContagem: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  botaoIniciarRota: {
    backgroundColor: light.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  botaoIniciarRotaTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  rotaConcluidaIndicador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
  rotaConcluidaTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: semantic.ok,
  },
  resumoRotaLista: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  cardConcluida: {
    opacity: 0.6,
  },
  cardTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  cardTipo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  cardDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textMuted,
  },
  cardRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cardRodapeEsquerda: {
    gap: spacing.xs / 2,
  },
  telaReprovacao: {
    flex: 1,
    backgroundColor: semantic.overdue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  reprovacaoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  reprovacaoInfo: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  reprovacaoNome: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  reprovacaoDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  reprovacaoMotivoLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: spacing.sm,
  },
  reprovacaoMotivoTexto: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 21,
  },
  reprovacaoBotao: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reprovacaoBotaoDesabilitado: {
    opacity: 0.7,
  },
  reprovacaoBotaoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: semantic.overdue,
  },
});
