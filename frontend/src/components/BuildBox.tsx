import { useI18n } from '../i18n';

const GITHUB = 'https://github.com/JoeBosi/pietre-di-vita-demo';

export function BuildBox() {
  const { t, lang } = useI18n();
  const coding = lang === 'it' ? '/tutorial/it/costruisci.html' : '/tutorial/en/build.html';
  const tutorial = lang === 'it' ? '/tutorial/it/' : '/tutorial/en/';
  const btn = 'inline-flex items-center justify-center rounded-xl border-2 border-olive-700 bg-white text-olive-900 text-base font-semibold px-5 min-h-12 hover:bg-olive-100';
  return (
    <section aria-labelledby="build-title" className="rounded-2xl border border-olive-200 bg-olive-50 p-5 sm:p-6 space-y-3">
      <h2 id="build-title" className="text-2xl font-semibold text-olive-900">{t('build.title')}</h2>
      <p className="text-lg text-gray-800">{t('build.body')}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a href={coding} className="inline-flex items-center justify-center rounded-xl bg-olive-700 hover:bg-olive-800 text-white text-base font-semibold px-5 min-h-12">{t('build.coding')}</a>
        <a href={tutorial} className={btn}>{t('build.tutorial')}</a>
        <a href={GITHUB} target="_blank" rel="noreferrer" className={btn}>{t('build.github')}</a>
      </div>
    </section>
  );
}
