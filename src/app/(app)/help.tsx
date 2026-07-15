import { ComingSoonScreen } from '@/components/coming-soon';
import { useAppTranslation } from '@/context/locale';

export default function HelpScreen() {
  const { t } = useAppTranslation();
  return <ComingSoonScreen title={t('nav.help')} message={t('comingSoon.helpBody')} />;
}
