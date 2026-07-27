import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import {
  formatItemQty,
  formatItemQtyLabel,
  isRentalReturnJob,
  jobLineItems,
  lineItemDisplay,
} from '@/lib/job-items';
import type { JobLineItem, JobSummary } from '@/lib/types';

type Props = {
  job?: JobSummary | null;
  /** Cap rows on compact cards; omit for full list. */
  maxItems?: number;
  showHeading?: boolean;
  compact?: boolean;
};

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <ThemedText themeColor="textSecondary" type="small">
      {label}: {value}
    </ThemedText>
  );
}

function ItemDivider({ first }: { first: boolean }) {
  const theme = useTheme();
  if (first) return null;
  return (
    <View style={[styles.itemDivider, { backgroundColor: theme.border }]} />
  );
}

function FullLineItem({
  item,
  isRri,
}: {
  item: JobLineItem;
  isRri: boolean;
}) {
  const { t } = useAppTranslation();
  const display = lineItemDisplay(item);

  return (
    <View style={styles.itemBlock}>
      <View style={styles.row}>
        <View style={styles.nameCol}>
          {display.sku ? (
            <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
              {display.sku}
            </ThemedText>
          ) : null}
          <ThemedText type="small">{display.name}</ThemedText>
        </View>
        <ThemedText type="smallBold" style={styles.qty}>
          {formatItemQtyLabel(item)}
        </ThemedText>
      </View>

      {!isRri && display.packaging ? (
        <MetaLine label={t('jobDetail.packaging')} value={display.packaging} />
      ) : null}
      {!isRri && display.condition ? (
        <MetaLine label={t('jobDetail.condition')} value={display.condition} />
      ) : null}
      {display.description ? (
        <MetaLine label={t('jobDetail.itemDescription')} value={display.description} />
      ) : null}

      {isRri ? (
        <View style={styles.rriRow}>
          <ThemedText themeColor="textSecondary" type="small">
            {t('jobDetail.qtyGood')}: {formatItemQty(item.quantity_good ?? 0)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {t('jobDetail.qtyRepair')}: {formatItemQty(item.quantity_repair ?? 0)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {t('jobDetail.qtyDamage')}: {formatItemQty(item.quantity_damage ?? 0)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {t('jobDetail.qtyScrap')}: {formatItemQty(item.quantity_scrap ?? 0)}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function JobLineItems({ job, maxItems, showHeading = false, compact = false }: Props) {
  const { t } = useAppTranslation();
  const items = jobLineItems(job);
  const isRri = isRentalReturnJob(job);

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
      {visible.map((item, index) => {
        const display = lineItemDisplay(item);
        return (
          <View key={`${item.sku ?? item.name}-${index}`}>
            <ItemDivider first={index === 0} />
            {compact ? (
              <View style={styles.row}>
                <View style={styles.nameCol}>
                  {display.sku ? (
                    <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                      {display.sku}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" numberOfLines={2}>
                    {display.name}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" style={styles.qty}>
                  {formatItemQtyLabel(item)}
                </ThemedText>
              </View>
            ) : (
              <FullLineItem item={item} isRri={isRri} />
            )}
          </View>
        );
      })}
      {hidden > 0 ? (
        <ThemedText themeColor="textSecondary" type="small">
          {t('jobDetail.moreItems', { count: hidden })}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.two,
  },
  itemBlock: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  nameCol: { flex: 1, gap: 1 },
  qty: { flexShrink: 0, minWidth: 56, textAlign: 'right' },
  rriRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
