import { useI18n, type TKey } from '../i18n';
import { phaseIcons } from '../components/Icons';
import { Link } from 'react-router-dom';
import { Tip } from '../components/Tip';

export default function HowItWorks() {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-olive-800">{t('cf.title')}</h1>
        <p className="text-lg text-gray-700">{t('cf.intro')}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => {
          const Icon = phaseIcons[i - 1];
          const k = (s: string) => t(`cf.p${i}${s}` as TKey);
          return (
            <div key={i} className="rounded-xl bg-white border border-olive-100 shadow-sm p-4 space-y-3">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-olive-800"><span className="text-olive-600"><Icon /></span>{i}. {k('')}</h2>
              <dl className="text-base space-y-2">
                <div className="!mt-2"><dt className="block text-sm font-semibold text-olive-800 uppercase tracking-wide">{t('cf.who')}: </dt><dd className="block">{k('.who')}</dd></div>
                <div className="!mt-2"><dt className="block text-sm font-semibold text-olive-800 uppercase tracking-wide">{t('cf.tool')}: </dt><dd className="block">{k('.tool')}</dd></div>
                <div className="!mt-2"><dt className="block text-sm font-semibold text-olive-800 uppercase tracking-wide">{t('cf.rec')}: </dt><dd className="block">{k('.rec')}</dd></div>
                <div className="!mt-2"><dt className="block text-sm font-semibold text-olive-800 uppercase tracking-wide">{t('cf.proof')}: </dt><dd className="block">{k('.proof')}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
      <section className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-2">
        <h2 className="text-2xl font-semibold">{t('cf.recall.t')}</h2>
        <p>{t('cf.recall.d')}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold">{t('cf.any.t')}</h2>
        <ul className="list-disc pl-5 space-y-1">
          {(['cf.any1', 'cf.any2', 'cf.any3', 'cf.any4'] as const).map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </section>
      <p><Link to="/b/25B001/1" className="inline-flex items-center justify-center rounded-xl bg-olive-700 text-white font-semibold px-5 min-h-12 text-lg w-full sm:w-auto">{t('home.cta')}</Link></p>
      <details className="rounded-xl border border-gray-300 bg-white p-4">
        <summary className="cursor-pointer font-semibold min-h-11 flex items-center">{t('cf.tech.t')}</summary>
        <ul className="list-disc pl-5 mt-3 space-y-1 text-base">
          <li>{t('cf.tech1')}<Tip text={t('tip.blockchain')} /></li>
          <li>{t('cf.tech2')}<Tip text={t('tip.tx')} /></li>
          <li>{t('cf.tech3')}<Tip text={t('tip.hash')} /></li>
          <li>{t('cf.tech4')}</li>
        </ul>
        <p className="mt-4"><a href={`/tutorial/${lang}/`} className="inline-flex items-center min-h-11 text-olive-800 font-medium underline">{t('cf.tutorial')}</a></p>
      </details>
    </div>
  );
}
