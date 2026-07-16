import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
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
  const [hasDrawn, setHasDrawn] = useState(false);
  const [session, setSession] = useState(0);
  const [padReady, setPadReady] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmptyError(false);
      setHasDrawn(false);
      setSaving(false);
      setPadReady(false);
      setSession((value) => value + 1);
      const timer = setTimeout(() => setPadReady(true), 80);
      return () => clearTimeout(timer);
    }
    setPadReady(false);
  }, [visible]);

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; margin: 0; width: 100%; height: 100%; }
    .m-signature-pad--body { border: none; width: 100%; height: 100%; }
    .m-signature-pad--body canvas { width: 100% !important; height: 100% !important; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body,html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: #ffffff;
    }
  `;

  async function handleOK(signature: string) {
    if (!signature || signature.length < 40) {
      setEmptyError(true);
      return;
    }
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
    setSaving(false);
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
            { backgroundColor: '#ffffff', borderColor: theme.border },
          ]}
        >
          {visible && padReady ? (
            <SignatureCanvas
              key={`sig-${session}`}
              ref={ref}
              onOK={(sig) => void handleOK(sig)}
              onEmpty={handleEmpty}
              onBegin={() => {
                setEmptyError(false);
                setHasDrawn(true);
              }}
              autoClear={false}
              imageType="image/png"
              trimWhitespace={false}
              penColor="#111111"
              backgroundColor="#ffffff"
              webStyle={webStyle}
              style={styles.canvas}
              androidLayerType="software"
              webviewProps={{
                androidLayerType: 'software',
                androidHardwareAccelerationDisabled: true,
                nestedScrollEnabled: true,
                scrollEnabled: false,
                showsHorizontalScrollIndicator: false,
                showsVerticalScrollIndicator: false,
                overScrollMode: 'never',
              }}
            />
          ) : null}
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
              setHasDrawn(false);
              ref.current?.clearSignature();
            }}
          />
          <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
          <Button
            title={t('stops.useSignature')}
            loading={saving}
            disabled={!hasDrawn || saving}
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
    minHeight: 280,
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
