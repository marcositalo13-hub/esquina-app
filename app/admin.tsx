import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomTabBar,
  type BottomTabItem,
} from '../src/components/BottomTabBar';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { supabase } from '../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../src/theme';

type CardConfig = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  ativo: boolean;
  href?: string;
};

const cards: CardConfig[] = [
  {
    key: 'preservacao',
    label: 'Preservação e Manutenção',
    icon: 'construct-outline',
    ativo: true,
    href: '/admin/preservacao',
  },
  {
    key: 'morador',
    label: 'Morador',
    icon: 'people-outline',
    ativo: false,
  },
  {
    key: 'prestadores',
    label: 'Prestadores',
    icon: 'briefcase-outline',
    ativo: false,
  },
];

export default function Admin() {
  const insets = useSafeAreaInsets();
  const [activeKey, setActiveKey] = useState<'gestao' | 'relatorio'>('gestao');
  const [temPendenciaAtrasada, setTemPendenciaAtrasada] = useState(false);

  useEffect(() => {
    async function carregarPendencia() {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('ordens_servico')
        .select('id')
        .eq('status', 'pendente')
        .lt('data_prevista', hoje)
        .limit(1);

      setTemPendenciaAtrasada((data?.length ?? 0) > 0);
    }

    carregarPendencia();
  }, []);

  const tabs: BottomTabItem[] = [
    {
      key: 'gestao',
      label: 'Gestão',
      icon: 'grid-outline',
      iconActive: 'grid',
      badge: temPendenciaAtrasada,
    },
    {
      key: 'relatorio',
      label: 'Relatório Geral',
      icon: 'stats-chart-outline',
      iconActive: 'stats-chart',
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Administrador</Text>
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={styles.trocarPerfil}>Trocar perfil</Text>
        </Pressable>
      </View>

      {activeKey === 'gestao' ? (
        <View style={styles.grid}>
          {cards.map((card) => (
            <Pressable
              key={card.key}
              disabled={!card.ativo}
              onPress={() => card.href && router.push(card.href as never)}
              style={[styles.card, !card.ativo && styles.cardInativo]}
            >
              {card.key === 'preservacao' && temPendenciaAtrasada ? (
                <View style={styles.badge} />
              ) : null}
              <Ionicons name={card.icon} size={28} color={light.textPrimary} />
              <Text style={styles.cardLabel}>{card.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>Conteúdo em construção</Text>
          </View>
        </View>
      )}

      <BottomTabBar
        items={tabs}
        activeKey={activeKey}
        onSelect={(key) => setActiveKey(key as 'gestao' | 'relatorio')}
      />
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardInativo: {
    opacity: 0.45,
  },
  cardLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textPrimary,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: semantic.overdue,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  placeholderCard: {
    flex: 1,
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
});
