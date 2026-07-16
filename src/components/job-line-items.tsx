import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { formatItemQtyLabel, jobLineItems } from '@/lib/job-items';
import type { JobSummary } from '@/lib/types';

type Props = {
  job?: JobSummary | null;
  /** Cap rows on compact cards; omit for full list. */
  maxItems?: number;
  showHeading?: boolean;
  compact?: boolean;
};

export function JobLineItems({ job, maxItems, showHeading = false, compact = false }: Props) {
  const { t } = useAppTranslation();
  const items = jobLineItems(job);
  if (!items.length) {
    if (!job?.items_description?.trim()) return null;
    return (
      <View style={styles.wrap}>
        {showHeading ? (
          <ThemedText themeColor="textSecondary" type="small">
            {t('jobDetail.items')}
          </ThemedText>
        ) : null}
        <ThemedText type="small" numberOfLines={compact ? 2 : undefined}>
          {job.items_description}
        </ThemedText>
      </View>
    );
  }

  const visible = maxItems ? items.slice(0, maxItems) : items;
  const hidden = maxItems ? Math.max(0, items.length - maxItems) : 0;

  return (
    <View style={styles.wrap}>
      {showHeading ? (
        <ThemedText themeColor="textSecondary" type="small">
          {t('jobDetail.items')}
        </ThemedText>
      ) : null}
      {visible.map((item, index) => (
        <View key={`${item.sku ?? item.name}-${index}`} style={styles.row}>
          <View style={styles.nameCol}>
            {item.sku ? (
              <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                {item.sku}
              </ThemedText>
            ) : null}
            <ThemedText type="small" numberOfLines={compact ? 2 : undefined}>
              {item.name}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" style={styles.qty}>
            {formatItemQtyLabel(item)}
          </ThemedText>
        </View>
      ))}
      {hidden > 0 ? (
        <ThemedText themeColor="textSecondary" type="small">
          {t('jobDetail.moreItems', { count: hidden })}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  nameCol: { flex: 1, gap: 1 },
  qty: { flexShrink: 0, minWidth: 56, textAlign: 'right' },
});
