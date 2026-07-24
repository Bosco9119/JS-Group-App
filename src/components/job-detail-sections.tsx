import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import { JobLineItems } from '@/components/job-line-items';
import { StatusChip, jobTypeTone, isStopFinished } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import {
  canNavigate,
  openMapsNavigate,
  openPhoneCall,
  openSms,
} from '@/lib/directions';
import { formatDateTime } from '@/lib/format';
import { jobLineItems, secondaryDeliveryOrderNos } from '@/lib/job-items';
import type { JobSummary, TripStopSummary } from '@/lib/types';

type Props = {
  job: JobSummary;
  stop?: TripStopSummary | null;
  /** Call / SMS / Navigate — hide on finished stops. */
  showActions?: boolean;
};

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export function JobDetailSections({ job, stop, showActions = true }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();

  const phone = job.contact_no?.trim() || null;
  const navigateTarget = {
    address: job.address_text,
    latitude: job.latitude,
    longitude: job.longitude,
  };
  const finished = isStopFinished(stop?.status) || job.status === 'completed';
  const actionsEnabled = showActions && !finished;
  const hasNavigate = canNavigate(navigateTarget);
  const hasLineItems = jobLineItems(job).length > 0;
  const secondaryDos = secondaryDeliveryOrderNos(job);
  const hasPdf = job.has_source_document_pdf === true;
  const documentLabel = job.document_no?.trim() || null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <View style={styles.chipRow}>
        <StatusChip label={job.job_type_label} tone={jobTypeTone(job.job_type)} />
        {documentLabel ? <StatusChip label={documentLabel} tone="neutral" /> : null}
      </View>

      <DetailBlock label={t('jobDetail.jobNo')}>
        <ThemedText type="smallBold">{job.job_no}</ThemedText>
      </DetailBlock>

      {documentLabel ? (
        <DetailBlock label={t('jobDetail.document')}>
          <ThemedText type="smallBold">{documentLabel}</ThemedText>
          {job.document_status ? (
            <ThemedText themeColor="textSecondary" type="small">
              {t('jobDetail.documentStatus')}: {job.document_status}
            </ThemedText>
          ) : null}
        </DetailBlock>
      ) : null}

      {secondaryDos.length ? (
        <DetailBlock label={t('jobDetail.linkedDeliveryOrders')}>
          <ThemedText type="small">{secondaryDos.join(', ')}</ThemedText>
        </DetailBlock>
      ) : null}

      {job.customer_name ? (
        <DetailBlock label={t('jobDetail.customer')}>
          <ThemedText type="smallBold">{job.customer_name}</ThemedText>
        </DetailBlock>
      ) : null}

      {job.address_text ? (
        <DetailBlock label={t('jobDetail.address')}>
          <ThemedText type="small">{job.address_text}</ThemedText>
        </DetailBlock>
      ) : null}

      {job.contact_person || phone ? (
        <DetailBlock label={t('jobDetail.contact')}>
          <ThemedText type="small">
            {[job.contact_person, phone].filter(Boolean).join(' · ')}
          </ThemedText>
        </DetailBlock>
      ) : null}

      {hasLineItems || job.items_description ? (
        <DetailBlock label={t('jobDetail.items')}>
          <JobLineItems job={job} />
          <ThemedText themeColor="textSecondary" type="small">
            {t('jobDetail.cargoReadOnlyHint')}
          </ThemedText>
        </DetailBlock>
      ) : null}

      {job.special_instructions ? (
        <DetailBlock label={t('jobDetail.instructions')}>
          <ThemedText type="small">{job.special_instructions}</ThemedText>
        </DetailBlock>
      ) : null}

      {stop?.planned_arrival ? (
        <DetailBlock label={t('jobDetail.plannedArrival')}>
          <ThemedText type="small">{formatDateTime(stop.planned_arrival)}</ThemedText>
        </DetailBlock>
      ) : null}

      {job.started_at || stop?.actual_arrival ? (
        <DetailBlock label={t('jobDetail.jobStarted')}>
          <ThemedText type="small">
            {formatDateTime(job.started_at ?? stop?.actual_arrival ?? null)}
          </ThemedText>
        </DetailBlock>
      ) : null}

      {job.completed_at ? (
        <DetailBlock label={t('jobDetail.jobCompleted')}>
          <ThemedText type="small">{formatDateTime(job.completed_at)}</ThemedText>
        </DetailBlock>
      ) : null}

      {hasPdf ? (
        <Button
          title={t('document.view')}
          variant="secondary"
          onPress={() => {
            const qs = documentLabel
              ? `?documentNo=${encodeURIComponent(documentLabel)}`
              : '';
            router.push(`/(app)/jobs/${job.id}/document${qs}` as Href);
          }}
        />
      ) : null}

      {actionsEnabled && (phone || hasNavigate) ? (
        <View style={styles.actions}>
          {phone ? (
            <>
              <Button
                title={t('jobDetail.call')}
                variant="secondary"
                style={styles.actionBtn}
                onPress={() => void openPhoneCall(phone)}
              />
              <Button
                title={t('jobDetail.message')}
                variant="secondary"
                style={styles.actionBtn}
                onPress={() => void openSms(phone)}
              />
            </>
          ) : null}
          {hasNavigate ? (
            <Button
              title={t('map.navigate')}
              variant="secondary"
              style={styles.actionBtn}
              onPress={() => void openMapsNavigate(navigateTarget)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  block: { gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  actionBtn: { flexGrow: 1, minWidth: '30%' },
});
