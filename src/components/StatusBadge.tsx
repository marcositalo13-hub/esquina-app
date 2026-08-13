import { StyleSheet, Text, View } from 'react-native';
import type { OrdemServico } from '../data/manutencao';
import { fonts, light, radius, semantic, spacing } from '../theme';

const hoje = () => new Date().toISOString().slice(0, 10);

type StatusBadgeInfo = {
  label: string;
  color: string;
  neutro?: boolean;
};

// Prioridade: concluída > atrasada > em andamento > pendente.
export function getStatusBadgeInfo(ordem: OrdemServico): StatusBadgeInfo {
  if (ordem.status === 'concluida') {
    return { label: 'Concluída', color: semantic.ok };
  }
  if (ordem.data_prevista < hoje()) {
    return { label: 'Atrasada', color: semantic.overdue };
  }
  if (ordem.status === 'em_andamento') {
    return { label: 'Em andamento', color: light.brand };
  }
  return { label: 'Pendente', color: light.textMuted, neutro: true };
}

type StatusBadgeProps = {
  ordem: OrdemServico;
};

export function StatusBadge({ ordem }: StatusBadgeProps) {
  const info = getStatusBadgeInfo(ordem);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: info.neutro ? light.sunken : `${info.color}1A`,
          borderColor: info.neutro ? light.border : info.color,
        },
      ]}
    >
      <Text style={[styles.texto, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  texto: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
});

export default StatusBadge;
