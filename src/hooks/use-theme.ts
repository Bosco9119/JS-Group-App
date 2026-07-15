import { Colors } from '@/constants/theme';
import { useThemePreferences } from '@/context/theme';

export function useTheme() {
  const { colors, scheme, ready } = useThemePreferences();
  if (!ready) {
    return Colors.light;
  }
  return colors;
}

export function useResolvedScheme() {
  return useThemePreferences().scheme;
}
