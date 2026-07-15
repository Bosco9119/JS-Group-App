import { ComingSoonScreen } from '@/components/coming-soon';
import { useAppTranslation } from '@/context/locale';

export default function ReportsScreen() {
  const { t } = useAppTranslation();
  return <ComingSoonScreen title={t('nav.reports')} message={t('comingSoon.body')} />;
}
