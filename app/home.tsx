import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { light, radius, spacing, fonts } from '../src/theme';
import condos from '../src/data/condos';

const condo = condos[0];

const menuItems = [
  { key: 'inicio', icon: 'home-outline' as const, label: 'Início' },
  { key: 'financeiro', icon: 'wallet-outline' as const, label: 'Financeiro' },
  { key: 'comercial', icon: 'business-outline' as const, label: 'Comercial' },
];

export default function Home() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.condoName} numberOfLines={1}>
          {condo.nome}
        </Text>
        <Text style={styles.welcome}>Bem-vindo</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>Conteúdo em construção</Text>
        </View>
      </View>

      <View
        style={[
          styles.taskbar,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.taskbarItems}>
          {menuItems.map((item) => (
            <View key={item.key} style={styles.taskbarItem}>
              <Ionicons name={item.icon} size={24} color={light.textPrimary} />
              <Text style={styles.taskbarLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  condoName: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  welcome: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    marginTop: spacing.xs,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  placeholderCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
  },
  taskbar: {
    backgroundColor: light.card,
    borderTopWidth: 1,
    borderTopColor: light.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  taskbarItems: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  taskbarItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  taskbarLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: light.textSecondary,
  },
});
