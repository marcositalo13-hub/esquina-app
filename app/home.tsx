import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomTabBar,
  type BottomTabItem,
} from '../src/components/BottomTabBar';
import condos from '../src/data/condos';
import { fonts, light, radius, spacing } from '../src/theme';

const condo = condos[0];

const menuItems: BottomTabItem[] = [
  { key: 'inicio', icon: 'home-outline', iconActive: 'home', label: 'Início' },
  {
    key: 'financeiro',
    icon: 'wallet-outline',
    iconActive: 'wallet',
    label: 'Financeiro',
  },
  {
    key: 'comercial',
    icon: 'business-outline',
    iconActive: 'business',
    label: 'Comercial',
  },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const [activeKey, setActiveKey] = useState('inicio');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          'rgba(216, 220, 240, 0.12)',
          'rgba(216, 220, 240, 0.35)',
          'rgba(216, 220, 240, 0.7)',
        ]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backgroundGradient}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.condoName} numberOfLines={1}>
            {condo.nome}
          </Text>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.trocarPerfil}>Trocar perfil</Text>
          </Pressable>
        </View>
        <Text style={styles.welcome}>Bem-vindo</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>Conteúdo em construção</Text>
          <Pressable onPress={() => router.push('/cadastro')}>
            <Text style={styles.testeLink}>Teste: Cadastro genérico</Text>
          </Pressable>
        </View>
      </View>

      <BottomTabBar
        items={menuItems}
        activeKey={activeKey}
        onSelect={setActiveKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  condoName: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  trocarPerfil: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
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
  testeLink: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
  },
});
