import { useI18n } from '../i18n';
import { Info } from './Icons';
export function Disclaimer() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base flex gap-3 items-start text-amber-950">
      <span className="shrink-0 text-amber-700 mt-0.5"><Info /></span>
      <div><p className="font-semibold">{t('disc.text')}</p><p className="mt-1">{t('disc.more')}</p></div>
    </div>
  );
}
