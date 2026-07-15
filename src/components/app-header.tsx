import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  showBell?: boolean;
  onBellPress?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
};

type DrawerNav = {
  openDrawer?: () => void;
  getParent?: () => DrawerNav | undefined;
};

export function AppHeader({ title, showBell, onBellPress, right, showBack, onBack }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();

  function openDrawer() {
    const nav = navigation as DrawerNav;
    if (typeof nav.openDrawer === 'function') {
      nav.openDrawer();
      return;
    }
    const parent = nav.getParent?.();
    if (parent && typeof parent.openDrawer === 'function') {
      parent.openDrawer();
    }
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + Spacing.two,
          backgroundColor: theme.backgroundElement,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => {
          if (showBack) {
            if (onBack) onBack();
            else if (router.canGoBack()) router.back();
            return;
          }
          openDrawer();
        }}
        style={styles.iconBtn}
      >
        <Ionicons name={showBack ? 'arrow-back' : 'menu'} size={24} color={theme.text} />
      </Pressable>

      <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>

      <View style={styles.right}>
        {right}
        {showBell ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBellPress}
            style={styles.iconBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
  },
});
