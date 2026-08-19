import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatarDuracao,
  hojeLocal,
  type OrdemServico,
} from '../data/manutencao';
import { supabase } from '../lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../theme';

type Escopo = 'mes' | 'todo';

// 'AAAA-MM-01' do mês corrente — início do escopo "Este mês".
function primeiroDiaDoMes(): string {
  return `${hojeLocal().slice(0, 7)}-01`;
}

function dentroDoEscopo(
  dataChave: string | null,
  limite: string | null,
): boolean {
  if (!dataChave) {
    return false;
  }
  if (!limite) {
    return true;
  }
  return dataChave.slice(0, 10) >= limite;
}

// Card expansível "Zeladoria e Manutenção" na aba Relatório Geral do Admin.
// Busca todas as ordens uma única vez (no primeiro expandir) e recalcula os
// quatro indicadores em memória conforme o escopo (mês/período) escolhido.
export function RelatorioZeladoria() {
  const [expandido, setExpandido] = useState(false);
  const [escopo, setEscopo] = useState<Escopo>('mes');
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!expandido || carregado) {
      return;
    }

    let cancelado = false;
    setCarregando(true);
    setErro(null);

    supabase
      .from('ordens_servico')
      .select('*, planos_manutencao(*, tipos_atividade(*), rotas(*))')
      .then(({ data, error }) => {
        if (cancelado) {
          return;
        }
        setCarregando(false);
        if (error) {
          setErro(error.message);
          return;
        }
        setOrdens((data ?? []) as OrdemServico[]);
        setCarregado(true);
      });

    return () => {
      cancelado = true;
    };
  }, [expandido, carregado]);

  const limiteEscopo = escopo === 'mes' ? primeiroDiaDoMes() : null;

  // a) Tempo médio por tipo, entre as ordens concluídas no escopo.
  const tempoMedioPorTipo = useMemo(() => {
    const somaPorTipo = new Map<
      string,
      { nome: string; totalSegundos: number; contagem: number }
    >();

    for (const ordem of ordens) {
      if (
        ordem.status !== 'concluida' ||
        !ordem.concluida_em ||
        !ordem.iniciado_em ||
        !dentroDoEscopo(ordem.concluida_em, limiteEscopo)
      ) {
        continue;
      }

      const tipo = ordem.planos_manutencao?.tipos_atividade;
      if (!tipo) {
        continue;
      }

      const duracaoSegundos = Math.max(
        0,
        (new Date(ordem.concluida_em).getTime() -
          new Date(ordem.iniciado_em).getTime()) /
          1000 -
          ordem.tempo_pausado_segundos,
      );

      const atual = somaPorTipo.get(tipo.id) ?? {
        nome: tipo.nome,
        totalSegundos: 0,
        contagem: 0,
      };
      atual.totalSegundos += duracaoSegundos;
      atual.contagem += 1;
      somaPorTipo.set(tipo.id, atual);
    }

    return Array.from(somaPorTipo.values())
      .map((item) => ({
        nome: item.nome,
        mediaSegundos: item.totalSegundos / item.contagem,
      }))
      .sort((a, b) => b.mediaSegundos - a.mediaSegundos);
  }, [ordens, limiteEscopo]);

  // b) Taxa de conclusão no prazo, entre as ordens concluídas no escopo.
  const taxaNoPrazo = useMemo(() => {
    let noPrazo = 0;
    let atrasadas = 0;

    for (const ordem of ordens) {
      if (
        ordem.status !== 'concluida' ||
        !ordem.concluida_em ||
        !dentroDoEscopo(ordem.concluida_em, limiteEscopo)
      ) {
        continue;
      }

      if (ordem.concluida_em.slice(0, 10) <= ordem.data_prevista) {
        noPrazo += 1;
      } else {
        atrasadas += 1;
      }
    }

    const total = noPrazo + atrasadas;
    return {
      noPrazo,
      atrasadas,
      total,
      percentual: total > 0 ? Math.round((noPrazo / total) * 100) : 0,
    };
  }, [ordens, limiteEscopo]);

  // c) Rotas com mais atraso: ordens concluídas após o prazo (escopo por
  // concluida_em) somadas às ainda pendentes e já atrasadas hoje (escopo
  // por data_prevista, já que não têm concluida_em para comparar).
  const rotasComMaisAtraso = useMemo(() => {
    const hojeStr = hojeLocal();
    const contagemPorRota = new Map<
      string,
      { nome: string; contagem: number }
    >();

    for (const ordem of ordens) {
      const rota = ordem.planos_manutencao?.rotas;
      if (!rota) {
        continue;
      }

      const concluidaAtrasada =
        ordem.status === 'concluida' &&
        ordem.concluida_em !== null &&
        dentroDoEscopo(ordem.concluida_em, limiteEscopo) &&
        ordem.concluida_em.slice(0, 10) > ordem.data_prevista;

      const pendenteAtrasada =
        ordem.status === 'pendente' &&
        ordem.data_prevista < hojeStr &&
        dentroDoEscopo(ordem.data_prevista, limiteEscopo);

      if (!concluidaAtrasada && !pendenteAtrasada) {
        continue;
      }

      const atual = contagemPorRota.get(rota.id) ?? {
        nome: rota.nome,
        contagem: 0,
      };
      atual.contagem += 1;
      contagemPorRota.set(rota.id, atual);
    }

    return Array.from(contagemPorRota.values())
      .sort((a, b) => b.contagem - a.contagem)
      .slice(0, 5);
  }, [ordens, limiteEscopo]);

  // d) Reprovações no período, com os motivos mais recentes.
  const reprovacoesNoPeriodo = useMemo(() => {
    const itens = ordens.filter((o) =>
      dentroDoEscopo(o.reprovada_em, limiteEscopo),
    );

    const recentes = [...itens]
      .sort((a, b) =>
        (b.reprovada_em ?? '').localeCompare(a.reprovada_em ?? ''),
      )
      .slice(0, 3)
      .map((o) =>
        o.motivo_reprovacao?.trim()
          ? o.motivo_reprovacao
          : 'Sem motivo informado',
      );

    return { total: itens.length, recentes };
  }, [ordens, limiteEscopo]);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cabecalho}
        onPress={() => setExpandido((v) => !v)}
      >
        <Text style={styles.titulo}>Zeladoria e Manutenção</Text>
        <Ionicons
          name={expandido ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={light.textSecondary}
        />
      </Pressable>

      {expandido ? (
        <View style={styles.conteudo}>
          {carregando ? (
            <Text style={styles.vazio}>Carregando…</Text>
          ) : erro ? (
            <Text style={styles.erro}>{erro}</Text>
          ) : (
            <>
              <View style={styles.segmentedControl}>
                <Pressable
                  style={[
                    styles.segmentButton,
                    escopo === 'mes' && styles.segmentButtonAtivo,
                  ]}
                  onPress={() => setEscopo('mes')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      escopo === 'mes' && styles.segmentTextAtivo,
                    ]}
                  >
                    Este mês
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentButton,
                    escopo === 'todo' && styles.segmentButtonAtivo,
                  ]}
                  onPress={() => setEscopo('todo')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      escopo === 'todo' && styles.segmentTextAtivo,
                    ]}
                  >
                    Todo o período
                  </Text>
                </Pressable>
              </View>

              <View style={styles.indicador}>
                <Text style={styles.indicadorTitulo}>Tempo médio por tipo</Text>
                {tempoMedioPorTipo.length === 0 ? (
                  <Text style={styles.vazio}>Nenhum registro no período.</Text>
                ) : (
                  <View style={styles.listaIndicador}>
                    {tempoMedioPorTipo.map((item) => (
                      <View key={item.nome} style={styles.linhaIndicador}>
                        <Text style={styles.linhaIndicadorTexto}>
                          {item.nome}
                        </Text>
                        <Text style={styles.linhaIndicadorValor}>
                          {formatarDuracao(item.mediaSegundos)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.indicador}>
                <Text style={styles.indicadorTitulo}>
                  Taxa de conclusão no prazo
                </Text>
                {taxaNoPrazo.total === 0 ? (
                  <Text style={styles.vazio}>Nenhum registro no período.</Text>
                ) : (
                  <>
                    <Text style={styles.percentualGrande}>
                      {taxaNoPrazo.percentual}%
                    </Text>
                    <View style={styles.progressoTrilho}>
                      <View
                        style={[
                          styles.segmentoOk,
                          { flex: taxaNoPrazo.noPrazo },
                        ]}
                      />
                      <View
                        style={[
                          styles.segmentoAtraso,
                          { flex: taxaNoPrazo.atrasadas },
                        ]}
                      />
                    </View>
                    <Text style={styles.legenda}>
                      {taxaNoPrazo.noPrazo} no prazo · {taxaNoPrazo.atrasadas}{' '}
                      atrasadas
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.indicador}>
                <Text style={styles.indicadorTitulo}>
                  Rotas com mais atraso
                </Text>
                {rotasComMaisAtraso.length === 0 ? (
                  <Text style={styles.vazio}>Nenhum registro no período.</Text>
                ) : (
                  <View style={styles.listaIndicador}>
                    {rotasComMaisAtraso.map((item) => (
                      <View key={item.nome} style={styles.linhaIndicador}>
                        <Text style={styles.linhaIndicadorTexto}>
                          {item.nome}
                        </Text>
                        <Text style={styles.linhaIndicadorValor}>
                          {item.contagem}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.indicador}>
                <Text style={styles.indicadorTitulo}>
                  Reprovações no período
                </Text>
                {reprovacoesNoPeriodo.total === 0 ? (
                  <Text style={styles.vazio}>Nenhum registro no período.</Text>
                ) : (
                  <>
                    <Text style={styles.percentualGrande}>
                      {reprovacoesNoPeriodo.total}
                    </Text>
                    <View style={styles.listaIndicador}>
                      {reprovacoesNoPeriodo.recentes.map((motivo, indice) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: lista curta e estável, sem reordenação
                        <Text key={indice} style={styles.linhaIndicadorTexto}>
                          {motivo}
                        </Text>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  conteudo: {
    gap: spacing.lg,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
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
  indicador: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  indicadorTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.textPrimary,
  },
  listaIndicador: {
    gap: spacing.xs,
  },
  linhaIndicador: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linhaIndicadorTexto: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textPrimary,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  linhaIndicadorValor: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  percentualGrande: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: light.textPrimary,
  },
  progressoTrilho: {
    flexDirection: 'row',
    height: 10,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segmentoOk: {
    height: '100%',
    backgroundColor: semantic.ok,
  },
  segmentoAtraso: {
    height: '100%',
    backgroundColor: semantic.overdue,
  },
  legenda: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
});

export default RelatorioZeladoria;
