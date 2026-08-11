import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import condos from '../src/data/condos';
import { fonts, light, motion, radius, spacing } from '../src/theme';

const condo = condos[0];

const DOT_SIZE = 4;

const menuItems = [
  {
    key: 'inicio',
    iconOutline: 'home-outline' as const,
    iconFilled: 'home' as const,
    label: 'Início',
  },
  {
    key: 'financeiro',
    iconOutline: 'wallet-outline' as const,
    iconFilled: 'wallet' as const,
    label: 'Financeiro',
  },
  {
    key: 'comercial',
    iconOutline: 'business-outline' as const,
    iconFilled: 'business' as const,
    label: 'Comercial',
  },
];

export default function Home() {
  const insets = useSafeAreaInsets();

  const [activeKey, setActiveKey] = useState<string>('inicio');
  const [reduceMotion, setReduceMotion] = useState(false);

  const iconScales = useRef(menuItems.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  function handlePressItem(key: string, index: number) {
    setActiveKey(key);

    if (reduceMotion) {
      return;
    }

    const scale = iconScales[index];
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.15,
        duration: motion.duration.fast,
        easing: motion.easing,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: motion.duration.fast,
        easing: motion.easing,
        useNativeDriver: true,
      }),
    ]).start();
  }

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
        <Text style={styles.condoName} numberOfLines={1}>
          {condo.nome}
        </Text>
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

      <BlurView intensity={40} tint="light" style={styles.taskbar}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0)']}
          style={styles.taskbarSheen}
        />

        <View style={styles.taskbarItems}>
          {menuItems.map((item, index) => {
            const isActive = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                style={styles.taskbarItem}
                onPress={() => handlePressItem(item.key, index)}
              >
                <Animated.View
                  style={{ transform: [{ scale: iconScales[index] }] }}
                >
                  <Ionicons
                    name={isActive ? item.iconFilled : item.iconOutline}
                    size={24}
                    color={isActive ? light.brandActive : light.textPrimary}
                  />
                </Animated.View>
                <Text style={styles.taskbarLabel}>{item.label}</Text>
                <View style={styles.indicatorSlot}>
                  {isActive ? <View style={styles.indicatorDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: insets.bottom }} />
      </BlurView>
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
  testeLink: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
  },
  taskbar: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  taskbarSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  taskbarItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: spacing.md,
  },
  taskbarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  taskbarLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: light.textSecondary,
  },
  indicatorSlot: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: light.brandActive,
  },
});
