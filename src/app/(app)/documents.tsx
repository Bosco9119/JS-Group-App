import { ComingSoonScreen } from '@/components/coming-soon';
import { useAppTranslation } from '@/context/locale';

export default function DocumentsScreen() {
  const { t } = useAppTranslation();
  return <ComingSoonScreen title={t('nav.documents')} message={t('comingSoon.body')} />;
}
