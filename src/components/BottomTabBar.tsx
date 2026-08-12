import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
import { fonts, light, motion, semantic, spacing } from '../theme';

const DOT_SIZE = 4;
const BADGE_SIZE = 8;

export type BottomTabItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  badge?: boolean;
};

type BottomTabBarProps = {
  items: BottomTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

// Barra inferior compartilhada: edge-to-edge, 60px + safe area, BlurView,
// borda de vidro, reflexo, indicador de item ativo animado, badge de
// pendência opcional por item, respeita reduce motion.
export function BottomTabBar({
  items,
  activeKey,
  onSelect,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  const iconScales = useRef(items.map(() => new Animated.Value(1))).current;

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
    onSelect(key);

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
    <BlurView intensity={40} tint="light" style={styles.taskbar}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0)']}
        style={styles.taskbarSheen}
      />

      <View style={styles.taskbarItems}>
        {items.map((item, index) => {
          const isActive = item.key === activeKey;
          return (
            <Pressable
              key={item.key}
              style={styles.taskbarItem}
              onPress={() => handlePressItem(item.key, index)}
            >
              <View style={styles.iconWrapper}>
                <Animated.View
                  style={{ transform: [{ scale: iconScales[index] }] }}
                >
                  <Ionicons
                    name={isActive ? item.iconActive : item.icon}
                    size={24}
                    color={isActive ? light.brandActive : light.textPrimary}
                  />
                </Animated.View>
                {item.badge ? <View style={styles.badge} /> : null}
              </View>
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
  );
}

const styles = StyleSheet.create({
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
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: semantic.overdue,
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

export default BottomTabBar;
