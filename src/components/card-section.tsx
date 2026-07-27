import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardSectionProps = {
  children: ReactNode;
  /** Omit on the first section inside a card. */
  first?: boolean;
};

export function CardSection({ children, first = false }: CardSectionProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.section,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          paddingTop: Spacing.three,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
