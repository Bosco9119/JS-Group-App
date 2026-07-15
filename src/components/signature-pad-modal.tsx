import * as FileSystem from 'expo-file-system/legacy';
import { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import type { LocalImage } from '@/lib/types';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSave: (image: LocalImage) => void;
};

async function dataUrlToLocalImage(dataUrl: string): Promise<LocalImage> {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  const mimeType = match?.[1] ?? 'image/png';
  const base64 = match?.[2] ?? dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const fileName = `signature-${Date.now()}.${extension}`;

  if (Platform.OS === 'web') {
    return {
      uri: dataUrl.startsWith('data:') ? dataUrl : `data:${mimeType};base64,${base64}`,
      name: fileName,
      mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
    };
  }

  const directory = FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error('Cache directory is unavailable.');
  }

  const uri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: 'base64',
  });

  return {
    uri,
    name: fileName,
    mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
  };
}

export function SignaturePadModal({ visible, onCancel, onSave }: Props) {
  const theme = useTheme();
  const { t } = useAppTranslation();
  const ref = useRef<SignatureViewRef>(null);
  const [saving, setSaving] = useState(false);
  const [emptyError, setEmptyError] = useState(false);

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; margin: 0; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body,html { height: 100%; background: ${theme.backgroundElement}; }
  `;

  async function handleOK(signature: string) {
    setSaving(true);
    setEmptyError(false);
    try {
      const image = await dataUrlToLocalImage(signature);
      onSave(image);
    } catch {
      setEmptyError(true);
    } finally {
      setSaving(false);
    }
  }

  function handleEmpty() {
    setEmptyError(true);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ThemedText type="smallBold" style={styles.title}>
          {t('stops.signatureTitle')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {t('stops.signatureHint')}
        </ThemedText>

        <View
          style={[
            styles.pad,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <SignatureCanvas
            ref={ref}
            onOK={(sig) => void handleOK(sig)}
            onEmpty={handleEmpty}
            autoClear={false}
            imageType="image/png"
            trimWhitespace
            penColor={theme.text}
            backgroundColor={theme.backgroundElement}
            webStyle={webStyle}
            style={styles.canvas}
            androidLayerType="hardware"
          />
        </View>

        {emptyError ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {t('stops.signatureEmpty')}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={t('stops.clearSignature')}
            variant="secondary"
            onPress={() => {
              setEmptyError(false);
              ref.current?.clearSignature();
            }}
          />
          <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
          <Button
            title={t('stops.useSignature')}
            loading={saving}
            onPress={() => {
              setEmptyError(false);
              ref.current?.readSignature();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    paddingTop: Spacing.six,
  },
  title: {
    fontSize: 18,
  },
  pad: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius,
    overflow: 'hidden',
    minHeight: 240,
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  actions: {
    gap: Spacing.two,
  },
});
