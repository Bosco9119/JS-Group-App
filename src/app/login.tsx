import { Redirect, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { usePermissions } from '@/context/permissions';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/types';
import { firstFieldError, formatApiMessage } from '@/lib/utils';

const APP_HOME = '/(app)/(tabs)/' as Href;

export default function LoginScreen() {
  const theme = useTheme();
  const { t } = useAppTranslation();
  const { ready, isAuthenticated, login } = useAuth();
  const { ready: permissionsReady, snapshot } = usePermissions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!ready || !permissionsReady) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (!snapshot.allGranted) {
    return <Redirect href="/permissions" />;
  }

  if (isAuthenticated) {
    return <Redirect href={APP_HOME} />;
  }

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(firstFieldError(err.errors, 'email') ?? formatApiMessage(err));
      } else {
        setError(formatApiMessage(err, t('login.unable')));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ImageBackground
        source={require('@/assets/images/android-icon-background.png')}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={[styles.heroOverlay, { backgroundColor: 'rgba(59,130,246,0.78)' }]} />
        <SafeAreaView edges={['top']}>
          <ThemedText style={styles.heroBrand}>{t('login.brand')}</ThemedText>
        </SafeAreaView>
      </ImageBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <ScrollView
          contentContainerStyle={[
            styles.sheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText type="subtitle">{t('login.welcome')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('login.subtitle')}</ThemedText>

          {error ? <ErrorBanner message={error} /> : null}

          <ThemedText type="smallBold">{t('login.email')}</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <ThemedText type="smallBold">{t('login.password')}</ThemedText>
          <View style={styles.passwordWrap}>
            <TextInput
              secureTextEntry={!showPassword}
              autoComplete="password"
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eye}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>

          <Button title={t('login.signIn')} loading={loading} onPress={() => void onSubmit()} />
          <ThemedText themeColor="textSecondary" type="small" style={styles.hint}>
            {t('login.noRegisterHint')}
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    height: 220,
    justifyContent: 'flex-end',
    padding: Spacing.four,
  },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
  },
  heroBrand: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  sheetWrap: {
    flex: 1,
    marginTop: -24,
  },
  sheet: {
    flexGrow: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eye: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  hint: { marginTop: Spacing.two, textAlign: 'center' },
});
