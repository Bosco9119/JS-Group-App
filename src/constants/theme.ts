/**
 * Brand palette aligned to the JS-Group website (blue primary).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#3F3F3F',
    background: '#F8F9FC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8F0FE',
    textSecondary: '#6B7280',
    accent: '#3B82F6',
    accentMuted: '#1E3A8A',
    danger: '#EF4444',
    success: '#166534',
    warning: '#854D0E',
    info: '#3B82F6',
    border: '#E5E7EB',
    primaryForeground: '#FFFFFF',
  },
  dark: {
    text: '#E8E8E8',
    background: '#1C1C1C',
    backgroundElement: '#2A2A2A',
    backgroundSelected: '#222222',
    textSecondary: '#A3A3A3',
    accent: '#3B82F6',
    accentMuted: '#1E3A8A',
    danger: '#EF4444',
    success: '#86EFAC',
    warning: '#FDE047',
    info: '#BFDBFE',
    border: '#454545',
    primaryForeground: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Radius = 6;

export const StatusColors = {
  light: {
    planned: { bg: '#FEF9C3', fg: '#854D0E' },
    inProgress: { bg: '#FEF9C3', fg: '#854D0E' },
    completed: { bg: '#DCFCE7', fg: '#166534' },
    cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
    accent: { bg: '#E8F0FE', fg: '#1E3A8A' },
    neutral: { bg: '#F1F2F5', fg: '#6B7280' },
  },
  dark: {
    planned: { bg: '#713F12', fg: '#FDE047' },
    inProgress: { bg: '#713F12', fg: '#FDE047' },
    completed: { bg: '#14532D', fg: '#86EFAC' },
    cancelled: { bg: '#7F1D1D', fg: '#FCA5A5' },
    accent: { bg: '#1E3A8A', fg: '#BFDBFE' },
    neutral: { bg: '#222222', fg: '#A3A3A3' },
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
