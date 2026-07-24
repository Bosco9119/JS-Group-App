import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchSourceDocumentToCache,
  type CachedSourceDocument,
} from '@/lib/source-document';
import { formatApiMessage } from '@/lib/utils';

async function androidPdfHtml(fileUri: string): Promise<string> {
  const base64 = await LegacyFS.readAsStringAsync(fileUri, {
    encoding: LegacyFS.EncodingType.Base64,
  });
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0" />
  <style>
    html, body { margin: 0; height: 100%; background: #525659; }
    embed { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <embed src="data:application/pdf;base64,${base64}" type="application/pdf" />
</body>
</html>`;
}

export default function JobSourceDocumentScreen() {
  const { jobId, documentNo } = useLocalSearchParams<{
    jobId: string;
    documentNo?: string;
  }>();
  const numericJobId = Number(jobId);
  const theme = useTheme();
  const { t } = useAppTranslation();
  const [doc, setDoc] = useState<CachedSourceDocument | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(numericJobId) || numericJobId <= 0) {
      setError(t('document.invalidJob'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setDoc(null);
    setHtml(null);
    try {
      const cached = await fetchSourceDocumentToCache(
        numericJobId,
        typeof documentNo === 'string' ? documentNo : null,
      );
      setDoc(cached);
      if (Platform.OS === 'android') {
        setHtml(await androidPdfHtml(cached.fileUri));
      }
    } catch (err) {
      setError(formatApiMessage(err, t('document.unableLoad')));
    } finally {
      setLoading(false);
    }
  }, [documentNo, numericJobId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDownload() {
    if (!doc) return;
    setSharing(true);
    setError(null);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setError(t('document.shareUnavailable'));
        return;
      }
      await Sharing.shareAsync(doc.fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: t('document.download'),
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      setError(formatApiMessage(err, t('document.unableShare')));
    } finally {
      setSharing(false);
    }
  }

  const title =
    (typeof documentNo === 'string' && documentNo.trim()) || t('document.title');

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={title}
        showBack
        right={
          doc ? (
            <Pressable onPress={() => void onDownload()} hitSlop={8} disabled={sharing}>
              <ThemedText type="small" style={{ color: theme.accent }}>
                {sharing ? t('common.loading') : t('document.download')}
              </ThemedText>
            </Pressable>
          ) : null
        }
      />

      {loading ? (
        <LoadingState label={t('document.loading')} />
      ) : error && !doc ? (
        <View style={styles.padded}>
          <ErrorBanner message={error} />
          <Button title={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : doc ? (
        <View style={{ flex: 1 }}>
          {error ? (
            <View style={styles.bannerPad}>
              <ErrorBanner message={error} />
            </View>
          ) : null}
          <WebView
            source={
              Platform.OS === 'android' && html
                ? { html }
                : { uri: doc.viewUri }
            }
            style={{ flex: 1, backgroundColor: theme.background }}
            originWhitelist={['*']}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            startInLoadingState
            renderLoading={() => <LoadingState label={t('document.loading')} />}
          />
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Button
              title={t('document.download')}
              variant="secondary"
              loading={sharing}
              onPress={() => void onDownload()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  bannerPad: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
