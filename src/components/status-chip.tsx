import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-theme';

type Tone = 'accent' | 'info' | 'warning' | 'success' | 'danger' | 'neutral';

type Props = {
  label: string;
  tone?: Tone;
};

function colorsForTone(tone: Tone, scheme: 'light' | 'dark') {
  const palette = StatusColors[scheme];
  switch (tone) {
    case 'success':
      return palette.completed;
    case 'warning':
      return palette.planned;
    case 'info':
      return palette.inProgress;
    case 'danger':
      return palette.cancelled;
    case 'accent':
      return palette.accent;
    default:
      return palette.neutral;
  }
}

export function StatusChip({ label, tone = 'neutral' }: Props) {
  const scheme = useResolvedScheme();
  const { bg, fg } = colorsForTone(tone, scheme);

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <ThemedText type="small" style={{ color: fg, fontWeight: '600', fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Job type chips stay muted — color via label text, not rainbow pills. */
export function jobTypeTone(_jobType?: string | null): Tone {
  return 'neutral';
}

/** Only terminal success — not arrived (that is still in progress). */
export function isStopCompleted(status?: string | null): boolean {
  return status === 'completed';
}

export function isStopFinished(status?: string | null): boolean {
  return status === 'completed' || status === 'skipped' || status === 'failed';
}

export function isStopInProgress(status?: string | null): boolean {
  return status === 'in_progress' || status === 'arrived' || status === 'en_route';
}

/** Prefer grey chips; keep a quiet mark for current work and danger for failures. */
export function statusTone(status?: string | null): Tone {
  switch (status) {
    case 'in_progress':
    case 'arrived':
    case 'en_route':
      return 'info';
    case 'failed':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
