import { useI18n } from '../i18n';
export function Disclaimer() {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-base">
      <p className="font-semibold">{t('disc.text')}</p>
      <p className="text-gray-700 mt-1">{t('disc.more')}</p>
    </div>
  );
}
