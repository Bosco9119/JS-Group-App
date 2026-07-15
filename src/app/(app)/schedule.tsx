import { ComingSoonScreen } from '@/components/coming-soon';
import { useAppTranslation } from '@/context/locale';

export default function ScheduleScreen() {
  const { t } = useAppTranslation();
  return <ComingSoonScreen title={t('nav.schedule')} message={t('comingSoon.body')} />;
}
