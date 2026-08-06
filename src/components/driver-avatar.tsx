import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { resolveMediaUrl } from '@/lib/config';
import { initialsFromName } from '@/lib/format';

type Props = {
  photoUrl?: string | null;
  name?: string | null;
  size?: number;
};

/**
 * Driver profile photo with a graceful fallback to the initials circle
 * (the original design) when there's no photo. Wrap in your own View for
 * positioning/margins — this component only renders the circle itself.
 */
export function DriverAvatar({ photoUrl, name, size = 84 }: Props) {
  const theme = useTheme();
  const uri = resolveMediaUrl(photoUrl);
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, dimensionStyle]} contentFit="cover" transition={150} />;
  }

  return (
    <View style={[styles.fallback, dimensionStyle, { backgroundColor: theme.accent }]}>
      <ThemedText style={[styles.initials, { fontSize: size * 0.33 }]}>
        {initialsFromName(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: '#ccc' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '700' },
});
