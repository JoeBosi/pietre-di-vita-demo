import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { apiUrl } from '../lib/api';
import { Disclaimer } from '../components/Disclaimer';
import { Leaf, Check, Info } from '../components/Icons';

export default function Home() {
  const { t } = useI18n();
  const cards = [['home.c1.t', 'home.c1.d', <Leaf key="a" />], ['home.c2.t', 'home.c2.d', <Info key="b" />], ['home.c3.t', 'home.c3.d', <Check key="c" />]] as const;
  return (
    <div className="space-y-8">
      <section className="text-center space-y-3 pt-2">
        <h1 className="text-4xl font-bold text-olive-800">{t('home.title')}</h1>
        <p className="text-xl text-gray-700">{t('home.claim')}</p>
      </section>
      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold mb-3">{t('home.how')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map(([ti, d, ic]) => (
            <div key={ti} className="rounded-xl border border-olive-100 bg-white p-4 space-y-2">
              <div className="text-olive-600">{ic}</div>
              <h3 className="font-semibold">{t(ti)}</h3>
              <p className="text-base text-gray-700">{t(d)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3"><Link className="text-olive-700 underline" to="/come-funziona">{t('home.more')}</Link></p>
      </section>
      <section className="rounded-xl border-2 border-olive-600 bg-olive-50 p-4 flex flex-col sm:flex-row items-center gap-4">
        <Link to="/b/25A001/1" aria-label={t('home.try')}>
          <img src={apiUrl('/api/qr/25A001/1.png')} alt="QR 25A001 / 1" width={200} height={200} className="bg-white rounded-lg border border-olive-100" />
        </Link>
        <div className="space-y-2 text-center sm:text-left">
          <Link to="/b/25A001/1" className="text-xl font-semibold text-olive-800 underline">{t('home.try')}</Link>
          <p className="text-gray-700">{t('home.tryd')}</p>
          <p><Link to="/b/25A003/1" className="text-red-700 underline">{t('home.recalled')}</Link></p>
        </div>
      </section>
      <Disclaimer />
    </div>
  );
}
