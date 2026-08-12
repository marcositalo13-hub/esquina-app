import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../src/components/Chip';
import { ScreenBackground } from '../src/components/ScreenBackground';
import {
  formatarDataBR,
  getCorPrioridade,
  type OrdemServico,
} from '../src/data/manutencao';
import { supabase } from '../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../src/theme';

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Preservacao() {
  const insets = useSafeAreaInsets();

  const [pendentes, setPendentes] = useState<OrdemServico[]>([]);
  const [concluidas, setConcluidas] = useState<OrdemServico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [respostaPendentes, respostaConcluidas] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('*, planos_manutencao(*, tipos_atividade(*))')
        .eq('status', 'pendente')
        .order('data_prevista', { ascending: true }),
      supabase
        .from('ordens_servico')
        .select('*, planos_manutencao(*, tipos_atividade(*))')
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
    carregar();
  }, [carregar]);

  async function handleConcluir(ordem: OrdemServico) {
    setConcluindoId(ordem.id);

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        concluida_por: 'Teste Preservação',
      })
      .eq('id', ordem.id);

    setConcluindoId(null);

    if (error) {
      setErro(error.message);
      return;
    }

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

        <Text style={styles.secaoTitulo}>Pendentes</Text>
        {pendentes.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma ordem pendente.</Text>
        ) : (
          <View style={styles.lista}>
            {pendentes.map((ordem) => {
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
                    <Text
                      style={[
                        styles.cardDetalhe,
                        atrasada && styles.textoAtrasado,
                      ]}
                    >
                      {formatarDataBR(ordem.data_prevista)}
                      {atrasada ? ' · Atrasada' : ''}
                    </Text>
                    {plano ? (
                      <Chip
                        label={plano.prioridade}
                        color={getCorPrioridade(plano.prioridade)}
                      />
                    ) : null}
                  </View>

                  <Pressable
                    style={styles.botaoConcluir}
                    onPress={() => handleConcluir(ordem)}
                    disabled={concluindoId === ordem.id}
                  >
                    <Text style={styles.botaoConcluirTexto}>
                      {concluindoId === ordem.id
                        ? 'Concluindo…'
                        : 'Marcar como concluída'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.secaoTitulo}>Concluídas</Text>
        {concluidas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma ordem concluída.</Text>
        ) : (
          <View style={styles.lista}>
            {concluidas.map((ordem) => {
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
  textoAtrasado: {
    color: semantic.overdue,
    fontFamily: fonts.medium,
  },
  cardRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
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
