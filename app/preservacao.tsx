import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdiarAcao } from '../src/components/AdiarAcao';
import { Chip } from '../src/components/Chip';
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

export default function Preservacao() {
  const insets = useSafeAreaInsets();

  const [pendentes, setPendentes] = useState<OrdemServico[]>([]);
  const [concluidas, setConcluidas] = useState<OrdemServico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);
  const [iniciandoRotaId, setIniciandoRotaId] = useState<string | null>(null);
  const [rotaExpandidaId, setRotaExpandidaId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [respostaPendentes, respostaConcluidas] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
        .neq('status', 'concluida')
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

  // Atividades de hoje COM rota já aparecem no Resumo do dia — somem das
  // seções Pendentes/Concluídas para não duplicar. Sem rota (hoje ou não) e
  // qualquer outra data continuam aparecendo normalmente.
  const pendentesExibidas = useMemo(() => {
    const hojeStr = hoje();
    return pendentes.filter(
      (o) => !(o.data_prevista === hojeStr && o.planos_manutencao?.rota_id),
    );
  }, [pendentes]);

  const concluidasExibidas = useMemo(() => {
    const hojeStr = hoje();
    return concluidas.filter(
      (o) => !(o.data_prevista === hojeStr && o.planos_manutencao?.rota_id),
    );
  }, [concluidas]);

  async function handleIniciar(ordem: OrdemServico) {
    setAtualizandoId(ordem.id);

    const { error } = await supabase
      .from('ordens_servico')
      .update({ status: 'em_andamento' })
      .eq('id', ordem.id);

    setAtualizandoId(null);

    if (error) {
      setErro(error.message);
      return;
    }

    carregar();
  }

  async function handleConcluir(ordem: OrdemServico) {
    setAtualizandoId(ordem.id);

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        concluida_por: 'Teste Preservação',
      })
      .eq('id', ordem.id);

    setAtualizandoId(null);

    if (error) {
      setErro(error.message);
      return;
    }

    carregar();
  }

  async function handleAdiar(ordemId: string, novaData: string) {
    const { error } = await supabase
      .from('ordens_servico')
      .update({ data_prevista: novaData })
      .eq('id', ordemId);

    if (error) {
      setErro(error.message);
      return;
    }

    carregar();
  }

  async function handleIniciarRota(grupo: GrupoRota) {
    setIniciandoRotaId(grupo.rota.id);

    const idsPendentes = grupo.itens
      .filter((o) => o.status === 'pendente')
      .map((o) => o.id);

    if (idsPendentes.length > 0) {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ status: 'em_andamento' })
        .in('id', idsPendentes);

      if (error) {
        setErro(error.message);
        setIniciandoRotaId(null);
        return;
      }
    }

    setIniciandoRotaId(null);
    setRotaExpandidaId(grupo.rota.id);
    carregar();
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Preservação</Text>
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={styles.trocarPerfil}>Trocar perfil</Text>
        </Pressable>
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
                const temPendente = grupo.itens.some(
                  (o) => o.status === 'pendente',
                );
                const cor = corIndicadorGrupo(
                  grupo.itens.length,
                  concluidasCount,
                  iniciadasCount,
                );
                const expandida =
                  rotaExpandidaId === grupo.rota.id || !temPendente;

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
                          {concluidasCount}/{grupo.itens.length} hoje
                        </Text>
                      </View>
                    </View>

                    {temPendente ? (
                      <Pressable
                        style={styles.botaoIniciarRota}
                        onPress={() => handleIniciarRota(grupo)}
                        disabled={iniciandoRotaId === grupo.rota.id}
                      >
                        <Text style={styles.botaoIniciarRotaTexto}>
                          {iniciandoRotaId === grupo.rota.id
                            ? 'Iniciando…'
                            : 'Iniciar Rota'}
                        </Text>
                      </Pressable>
                    ) : null}

                    {expandida ? (
                      <View style={styles.resumoRotaLista}>
                        {grupo.itens.map((ordem) => {
                          const plano = ordem.planos_manutencao;

                          return (
                            <View key={ordem.id} style={styles.card}>
                              <Text style={styles.cardTitulo}>
                                {plano?.titulo ?? 'Atividade'}
                              </Text>
                              <Text style={styles.cardTipo}>
                                {plano?.tipos_atividade?.nome ?? 'Sem tipo'}
                              </Text>
                              {plano?.local ? (
                                <Text style={styles.cardDetalhe}>
                                  {plano.local}
                                </Text>
                              ) : null}

                              <View style={styles.cardRodape}>
                                <StatusBadge ordem={ordem} />
                                {plano ? (
                                  <Chip
                                    label={plano.prioridade}
                                    color={getCorPrioridade(plano.prioridade)}
                                  />
                                ) : null}
                              </View>

                              {ordem.status !== 'concluida' ? (
                                <>
                                  <Pressable
                                    style={styles.botaoConcluir}
                                    onPress={() => handleConcluir(ordem)}
                                    disabled={atualizandoId === ordem.id}
                                  >
                                    <Text style={styles.botaoConcluirTexto}>
                                      {atualizandoId === ordem.id
                                        ? 'Concluindo…'
                                        : 'Concluir'}
                                    </Text>
                                  </Pressable>
                                  <AdiarAcao
                                    onConfirmar={(novaData) =>
                                      handleAdiar(ordem.id, novaData)
                                    }
                                  />
                                </>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.secaoTitulo}>Pendentes</Text>
        {pendentesExibidas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma ordem pendente.</Text>
        ) : (
          <View style={styles.lista}>
            {pendentesExibidas.map((ordem) => {
              const atrasada = ordem.data_prevista < hoje();
              const plano = ordem.planos_manutencao;

              return (
                <View
                  key={ordem.id}
                  style={[styles.card, atrasada && styles.cardAtrasada]}
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
                        {formatarDataBR(ordem.data_prevista)}
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

                  {ordem.status === 'em_andamento' ? (
                    <Pressable
                      style={styles.botaoConcluir}
                      onPress={() => handleConcluir(ordem)}
                      disabled={atualizandoId === ordem.id}
                    >
                      <Text style={styles.botaoConcluirTexto}>
                        {atualizandoId === ordem.id
                          ? 'Concluindo…'
                          : 'Concluir'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.botaoIniciar}
                      onPress={() => handleIniciar(ordem)}
                      disabled={atualizandoId === ordem.id}
                    >
                      <Text style={styles.botaoIniciarTexto}>
                        {atualizandoId === ordem.id ? 'Iniciando…' : 'Iniciar'}
                      </Text>
                    </Pressable>
                  )}

                  <AdiarAcao
                    onConfirmar={(novaData) => handleAdiar(ordem.id, novaData)}
                  />
                </View>
              );
            })}
          </View>
        )}

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
  cardAtrasada: {
    borderColor: semantic.overdue,
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
  botaoIniciar: {
    borderWidth: 1,
    borderColor: light.brand,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  botaoIniciarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.brand,
  },
  botaoConcluir: {
    backgroundColor: light.textPrimary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  botaoConcluirTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.bg,
  },
});
