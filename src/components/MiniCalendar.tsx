import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, light, semantic, spacing } from '../theme';

export type DiaMarcado = 'normal' | 'atrasado';

type MiniCalendarProps = {
  markedDates: Record<string, DiaMarcado>;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  // Quando definido, dias com chave < desabilitarAntesDe ficam com opacity
  // reduzida e não respondem a toque (ex.: impedir adiar para o passado).
  desabilitarAntesDe?: string;
};

const DIAS_SEMANA = [
  { chave: 'dom', label: 'D' },
  { chave: 'seg', label: 'S' },
  { chave: 'ter', label: 'T' },
  { chave: 'qua', label: 'Q' },
  { chave: 'qui', label: 'Q' },
  { chave: 'sex', label: 'S' },
  { chave: 'sab', label: 'S' },
];

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const CELL_SIZE = 34;

function formatarChave(date: Date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

type Celula = {
  date: Date;
  chave: string;
  noMes: boolean;
};

function construirGrade(mesVisivel: Date): Celula[] {
  const ano = mesVisivel.getFullYear();
  const mes = mesVisivel.getMonth();

  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const offsetInicial = primeiroDia.getDay();
  const diasNoMes = ultimoDia.getDate();

  const celulas: Celula[] = [];

  for (let i = offsetInicial; i > 0; i--) {
    const date = new Date(ano, mes, 1 - i);
    celulas.push({ date, chave: formatarChave(date), noMes: false });
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const date = new Date(ano, mes, dia);
    celulas.push({ date, chave: formatarChave(date), noMes: true });
  }

  const restante = celulas.length % 7;
  if (restante > 0) {
    const extra = 7 - restante;
    for (let i = 1; i <= extra; i++) {
      const date = new Date(ano, mes + 1, i);
      celulas.push({ date, chave: formatarChave(date), noMes: false });
    }
  }

  return celulas;
}

// Calendário mensal sem dependência externa: navegação de mês é estado
// próprio, independente do dia selecionado.
export function MiniCalendar({
  markedDates,
  selectedDate,
  onSelectDay,
  desabilitarAntesDe,
}: MiniCalendarProps) {
  const [mesVisivel, setMesVisivel] = useState(() => {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), 1);
  });

  const hojeChave = formatarChave(new Date());
  const celulas = construirGrade(mesVisivel);

  function irParaMesAnterior() {
    setMesVisivel(
      (atual) => new Date(atual.getFullYear(), atual.getMonth() - 1, 1),
    );
  }

  function irParaProximoMes() {
    setMesVisivel(
      (atual) => new Date(atual.getFullYear(), atual.getMonth() + 1, 1),
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <Pressable onPress={irParaMesAnterior} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={light.textPrimary} />
        </Pressable>
        <Text style={styles.mesAno}>
          {MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}
        </Text>
        <Pressable onPress={irParaProximoMes} hitSlop={8}>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={light.textPrimary}
          />
        </Pressable>
      </View>

      <View style={styles.semanaRow}>
        {DIAS_SEMANA.map((dia) => (
          <Text key={dia.chave} style={styles.semanaTexto}>
            {dia.label}
          </Text>
        ))}
      </View>

      <View style={styles.grade}>
        {celulas.map((celula) => {
          const marcado = markedDates[celula.chave];
          const isHoje = celula.chave === hojeChave;
          const isSelecionado = celula.chave === selectedDate;
          const isDesabilitado = desabilitarAntesDe
            ? celula.chave < desabilitarAntesDe
            : false;

          return (
            <Pressable
              key={celula.chave}
              style={[
                styles.celula,
                isDesabilitado && styles.celulaDesabilitada,
              ]}
              onPress={() => {
                if (!isDesabilitado) {
                  onSelectDay(celula.chave);
                }
              }}
              disabled={isDesabilitado}
            >
              <View
                style={[
                  styles.diaCirculo,
                  isHoje && styles.diaHoje,
                  isSelecionado && styles.diaSelecionado,
                ]}
              >
                <Text
                  style={[
                    styles.diaTexto,
                    !celula.noMes && styles.diaForaDoMes,
                    isSelecionado && styles.diaTextoSelecionado,
                  ]}
                >
                  {celula.date.getDate()}
                </Text>
              </View>
              {marcado ? (
                <View
                  style={[
                    styles.ponto,
                    marcado === 'atrasado'
                      ? styles.pontoAtrasado
                      : styles.pontoNormal,
                  ]}
                />
              ) : (
                <View style={styles.pontoVazio} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mesAno: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  semanaRow: {
    flexDirection: 'row',
  },
  semanaTexto: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 11,
    color: light.textMuted,
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  celula: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: spacing.xs / 2,
    gap: 2,
  },
  celulaDesabilitada: {
    opacity: 0.35,
  },
  diaCirculo: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  diaHoje: {
    borderColor: light.brand,
  },
  diaSelecionado: {
    backgroundColor: light.brand,
    borderColor: light.brand,
  },
  diaTexto: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textPrimary,
  },
  diaForaDoMes: {
    color: light.textMuted,
  },
  diaTextoSelecionado: {
    color: '#FFFFFF',
  },
  ponto: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  pontoVazio: {
    width: 4,
    height: 4,
  },
  pontoNormal: {
    backgroundColor: light.brand,
  },
  pontoAtrasado: {
    backgroundColor: semantic.overdue,
  },
});

export default MiniCalendar;
