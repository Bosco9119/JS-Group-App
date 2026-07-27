import * as IntentLauncher from 'expo-intent-launcher';
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

/**
 * Android WebView cannot render PDFs with <embed>/file URIs (blank screen).
 * PDF.js draws pages onto canvas — works in Expo Go on Android + iOS.
 */
function buildPdfJsHtml(base64: string): string {
  // Keep payload out of template literal escaping issues
  const safeBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0" />
  <style>
    html, body { margin: 0; padding: 0; background: #525659; }
    #status {
      color: #fff; font-family: sans-serif; font-size: 14px;
      padding: 16px; text-align: center;
    }
    #viewer { padding: 8px 0 24px; }
    .page {
      display: block; margin: 8px auto; background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.35); max-width: 100%;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>
  <div id="status">Loading preview…</div>
  <div id="viewer"></div>
  <script>
    (function () {
      var statusEl = document.getElementById('status');
      var viewer = document.getElementById('viewer');
      var b64 = "${safeBase64}";

      function fail(msg) {
        statusEl.textContent = msg || 'Unable to preview PDF';
      }

      if (!window.pdfjsLib) {
        fail('PDF engine failed to load. Use Download or Open externally.');
        return;
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      try {
        var raw = atob(b64);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          statusEl.textContent = '';
          var scale = Math.min(2, (window.devicePixelRatio || 1) * 1.25);

          function renderPage(num) {
            return pdf.getPage(num).then(function (page) {
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement('canvas');
              canvas.className = 'page';
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              canvas.style.width = '100%';
              canvas.style.height = 'auto';
              viewer.appendChild(canvas);
              return page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
              }).promise;
            });
          }

          var chain = Promise.resolve();
          for (var p = 1; p <= pdf.numPages; p++) {
            (function (pageNum) {
              chain = chain.then(function () { return renderPage(pageNum); });
            })(p);
          }
          return chain;
        }).catch(function (err) {
          fail((err && err.message) ? err.message : 'Unable to preview PDF');
        });
      } catch (err) {
        fail((err && err.message) ? err.message : 'Unable to preview PDF');
      }
    })();
  </script>
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
  const [opening, setOpening] = useState(false);
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
      const base64 = await LegacyFS.readAsStringAsync(cached.fileUri, {
        encoding: LegacyFS.EncodingType.Base64,
      });
      setHtml(buildPdfJsHtml(base64));
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

  async function onOpenExternal() {
    if (!doc) return;
    setOpening(true);
    setError(null);
    try {
      if (Platform.OS === 'android') {
        const contentUri =
          doc.viewUri.startsWith('content://')
            ? doc.viewUri
            : await LegacyFS.getContentUriAsync(doc.fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        await onDownload();
      }
    } catch (err) {
      setError(formatApiMessage(err, t('document.unableOpenExternal')));
    } finally {
      setOpening(false);
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
          {html ? (
            <WebView
              source={{ html, baseUrl: 'https://cdnjs.cloudflare.com/' }}
              style={{ flex: 1, backgroundColor: '#525659' }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              startInLoadingState
              renderLoading={() => <LoadingState label={t('document.loading')} />}
            />
          ) : (
            <LoadingState label={t('document.loading')} />
          )}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Button
              title={t('document.openExternal')}
              variant="secondary"
              loading={opening}
              onPress={() => void onOpenExternal()}
              style={{ marginBottom: Spacing.two }}
            />
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
