import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, light, radius, spacing } from '../theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
};

// Chip reutilizável: seletor (tipo/periodicidade/prioridade em formulários,
// com onPress) ou selo somente leitura (prioridade colorida nas listas,
// sem onPress).
export function Chip({ label, selected = false, onPress, color }: ChipProps) {
  const accent = color ?? light.brand;

  const backgroundColor = selected ? accent : color ? `${color}1A` : light.card;
  const borderColor = selected ? accent : (color ?? light.border);
  const textColor = selected ? '#FFFFFF' : (color ?? light.textPrimary);

  const content = (
    <View style={[styles.chip, { backgroundColor, borderColor }]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
});

export default Chip;
