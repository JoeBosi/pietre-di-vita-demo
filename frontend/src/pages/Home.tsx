import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { apiUrl } from '../lib/api';
import { Disclaimer } from '../components/Disclaimer';
import { Leaf, Check, Info, Alert } from '../components/Icons';

const cta = 'inline-flex items-center justify-center gap-2 rounded-xl bg-olive-700 hover:bg-olive-800 text-white text-lg sm:text-xl font-semibold px-5 min-h-14 py-3 w-full sm:w-auto text-center';

export default function Home() {
  const { t } = useI18n();
  const cards = [['home.c1.t', 'home.c1.d', <Leaf key="a" />], ['home.c2.t', 'home.c2.d', <Info key="b" />], ['home.c3.t', 'home.c3.d', <Check key="c" />]] as const;
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-olive-50 border border-olive-100 p-5 sm:p-8 space-y-5">
        <p className="inline-block rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-sm font-medium px-3 py-1">{t('home.badge')}</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-olive-900 leading-tight">{t('home.title')}</h1>
        <p className="text-xl sm:text-2xl text-gray-800">{t('home.claim')}</p>
        <div className="space-y-2 pt-1">
          <Link to="/b/25B001/1" className={cta}>{t('home.cta')} <span aria-hidden="true">&rarr;</span></Link>
          <p className="text-gray-700">{t('home.ctad')}</p>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold mb-4">{t('home.how')}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {cards.map(([ti, d, ic]) => (
            <li key={ti} className="rounded-xl border border-olive-100 bg-white p-4 space-y-2">
              <div className="text-olive-700">{ic}</div>
              <h3 className="font-semibold text-lg leading-snug">{t(ti)}</h3>
              <p className="text-base text-gray-700">{t(d)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4"><Link className="inline-flex items-center min-h-11 text-olive-800 font-medium underline" to="/come-funziona">{t('home.more')}</Link></p>
      </section>

      <section className="rounded-2xl border border-olive-200 bg-white p-5 flex flex-col sm:flex-row items-center gap-5">
        <Link to="/b/25B001/1" aria-label={t('home.try')} className="shrink-0">
          <img src={apiUrl('/api/qr/25B001/1.png')} alt="QR 25B001 / 1" width={160} height={160} className="bg-white rounded-lg border border-olive-100" />
        </Link>
        <div className="space-y-2 text-center sm:text-left">
          <h2 className="text-xl font-semibold">{t('home.qrt')}</h2>
          <p className="text-gray-700">{t('home.tryd')}</p>
          <Link to="/b/25B003/1" className="inline-flex items-center gap-2 min-h-11 rounded-lg border border-red-300 bg-red-50 text-red-800 font-medium px-4"><span className="[&>svg]:w-5 [&>svg]:h-5"><Alert /></span>{t('home.recd')}</Link>
        </div>
      </section>
      <Disclaimer />
    </div>
  );
}
