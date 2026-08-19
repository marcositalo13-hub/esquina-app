import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hojeLocal, type OrdemServico } from '../data/manutencao';
import { supabase } from '../lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../theme';

// Painel do Síndico: sempre visível (sem recolher), busca no mount e
// resume o dia de hoje em 4 blocos — farol geral, progresso, rotas em
// andamento e alertas. Sem alternador de escopo: é sempre "hoje".
export function PainelSindico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

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
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const hojeStr = hojeLocal();

  // Ordens previstas para hoje — base de "progresso do dia" e "rotas em
  // andamento". Atrasadas usa um recorte à parte (pendente + antes de
  // hoje), já que por definição nunca aparece dentro de "hoje".
  const ordensHoje = useMemo(
    () => ordens.filter((o) => o.data_prevista === hojeStr),
    [ordens, hojeStr],
  );

  const atrasadasHoje = useMemo(
    () =>
      ordens.filter(
        (o) => o.status === 'pendente' && o.data_prevista < hojeStr,
      ),
    [ordens, hojeStr],
  );

  // Reprovação pendente é uma flag permanente (até "Entendido" na tela de
  // execução), não amarrada a data_prevista — não filtra por hoje.
  const reprovacoesPendentes = useMemo(
    () => ordens.filter((o) => o.reprovacao_pendente),
    [ordens],
  );

  const farol = useMemo(() => {
    if (atrasadasHoje.length > 0 || reprovacoesPendentes.length > 0) {
      return { cor: semantic.overdue, texto: 'Atenção necessária' };
    }
    if (ordensHoje.some((o) => o.status !== 'concluida')) {
      return { cor: semantic.pending, texto: 'Em andamento' };
    }
    return { cor: semantic.ok, texto: 'Tudo em dia' };
  }, [atrasadasHoje, reprovacoesPendentes, ordensHoje]);

  const progresso = useMemo(() => {
    const total = ordensHoje.length;
    const concluidas = ordensHoje.filter(
      (o) => o.status === 'concluida',
    ).length;
    return {
      total,
      concluidas,
      percentual: total > 0 ? Math.round((concluidas / total) * 100) : 0,
    };
  }, [ordensHoje]);

  const rotasEmAndamento = useMemo(() => {
    const rotas = new Map<string, boolean>();

    for (const ordem of ordensHoje) {
      const rotaId = ordem.planos_manutencao?.rota_id;
      if (!rotaId) {
        continue;
      }
      const tocada =
        ordem.status === 'em_andamento' || ordem.status === 'concluida';
      rotas.set(rotaId, (rotas.get(rotaId) ?? false) || tocada);
    }

    const total = rotas.size;
    const iniciadas = Array.from(rotas.values()).filter(Boolean).length;
    return { total, iniciadas };
  }, [ordensHoje]);

  const totalAlertas = atrasadasHoje.length + reprovacoesPendentes.length;

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Painel do Síndico</Text>
      <Text style={styles.subtitulo}>Zeladoria e Manutenção — hoje</Text>

      {carregando ? (
        <Text style={styles.vazio}>Carregando…</Text>
      ) : erro ? (
        <Text style={styles.erro}>{erro}</Text>
      ) : (
        <View style={styles.grid}>
          <View style={styles.bloco}>
            <Text style={styles.blocoLabel}>Farol geral</Text>
            <View style={styles.farolRow}>
              <View
                style={[styles.farolCirculo, { backgroundColor: farol.cor }]}
              />
              <Text style={[styles.farolTexto, { color: farol.cor }]}>
                {farol.texto}
              </Text>
            </View>
          </View>

          <View style={styles.bloco}>
            <Text style={styles.blocoLabel}>Progresso do dia</Text>
            <Text style={styles.percentualGrande}>{progresso.percentual}%</Text>
            <View style={styles.progressoTrilho}>
              <View
                style={[
                  styles.progressoPreenchimento,
                  { flex: progresso.concluidas },
                ]}
              />
              <View
                style={[
                  styles.progressoRestante,
                  { flex: progresso.total - progresso.concluidas },
                ]}
              />
            </View>
            <Text style={styles.legenda}>
              {progresso.concluidas} de {progresso.total} hoje
            </Text>
          </View>

          <View style={styles.bloco}>
            <Text style={styles.blocoLabel}>Rotas em andamento</Text>
            {rotasEmAndamento.total === 0 ? (
              <Text style={styles.blocoTexto}>
                Nenhuma rota prevista para hoje
              </Text>
            ) : (
              <Text style={styles.blocoTexto}>
                {rotasEmAndamento.iniciadas} de {rotasEmAndamento.total} rotas
                iniciadas hoje
              </Text>
            )}
          </View>

          <View style={styles.bloco}>
            <Text style={styles.blocoLabel}>Alertas</Text>
            {totalAlertas === 0 ? (
              <Text style={styles.alertaVazio}>Nenhum alerta</Text>
            ) : (
              <>
                <Text style={styles.alertaNumero}>{totalAlertas}</Text>
                <Text style={styles.legenda}>
                  atrasos e reprovações pendentes
                </Text>
              </>
            )}
          </View>
        </View>
      )}
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
    gap: spacing.xs,
  },
  titulo: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: light.textPrimary,
  },
  subtitulo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
    marginBottom: spacing.sm,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bloco: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: light.sunken,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    gap: 4,
  },
  blocoLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  blocoTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  farolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  farolCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  farolTexto: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  percentualGrande: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: light.textPrimary,
  },
  progressoTrilho: {
    flexDirection: 'row',
    height: 10,
    backgroundColor: light.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressoPreenchimento: {
    height: '100%',
    backgroundColor: semantic.ok,
  },
  progressoRestante: {
    height: '100%',
    backgroundColor: `${light.textMuted}66`,
  },
  legenda: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  alertaNumero: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    color: semantic.overdue,
  },
  alertaVazio: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: semantic.ok,
  },
});

export default PainelSindico;
