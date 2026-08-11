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
          'rgba(245, 217, 196, 0.5)',
          'rgba(245, 217, 196, 0.2)',
          'rgba(250, 249, 246, 0)',
        ]}
        locations={[0, 0.4, 1]}
        style={styles.headerGradient}
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

      <BlurView
        intensity={40}
        tint="light"
        style={[
          styles.taskbar,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
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
                    color={isActive ? light.accent : light.textPrimary}
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
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
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
  indicatorSlot: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: light.accent,
  },
});
