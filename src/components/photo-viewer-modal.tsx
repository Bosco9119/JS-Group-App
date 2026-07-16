import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';

type Props = {
  uri: string | null;
  onClose: () => void;
};

export function PhotoViewerModal({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          onPress={onClose}
          style={[styles.close, { top: insets.top + Spacing.two }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <ThemedText type="smallBold" style={styles.closeLabel}>
            {t('common.close')}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.imageWrap} onPress={onClose}>
          {uri ? <Image source={{ uri }} style={styles.image} contentFit="contain" /> : null}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  imageWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    right: Spacing.four,
    zIndex: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  closeLabel: {
    color: '#fff',
  },
});
