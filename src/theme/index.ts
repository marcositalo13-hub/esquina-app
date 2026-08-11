// Regra: a cor de marca (brand) é usada para identidade e estados
// interativos; as cores de estado (semantic) comunicam exclusivamente
// status. A marca é dona da faixa azul/violeta e não colide com nenhum
// status.
import { Easing } from 'react-native';

export const light = {
  bg: '#FAF9F6',
  card: '#FFFFFF',
  sunken: '#F1EFE9',
  border: '#E3E0D8',
  borderStrong: '#CFCBC1',
  textPrimary: '#22221F',
  textSecondary: '#6B6862',
  textMuted: '#9A968D',
  brand: '#2F3577',
  brandActive: '#6067C8',
  brandWash: '#ECEDF7',
} as const;

export const dark = {
  bg: '#121211',
  surface: '#1A1A19',
  elevated: '#232322',
  border: '#2E2E2C',
  textPrimary: '#EDEBE7',
  textSecondary: '#A3A099',
} as const;

export const semantic = {
  ok: '#2F7D53',
  pending: '#A9740B',
  overdue: '#B23A2E',
  info: '#6B6862',
} as const;

export const motion = {
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  easing: Easing.out(Easing.cubic),
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

const spacingBase = 8;

export const spacing = {
  base: spacingBase,
  xs: spacingBase * 0.5,
  sm: spacingBase,
  md: spacingBase * 2,
  lg: spacingBase * 3,
  xl: spacingBase * 4,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
} as const;

export const theme = {
  light,
  dark,
  semantic,
  motion,
  radius,
  spacing,
  fonts,
} as const;

export type Theme = typeof theme;

export default theme;
