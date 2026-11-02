import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { BuildBox } from '../components/BuildBox';
import { VerifySection } from '../components/VerifySection';
import { BottleExperience } from '../components/BottleExperience';
import { OliveScene } from '../components/OliveScene';
import { FlowDiagram } from '../components/FlowDiagram';
import { Leaf, Check, Info } from '../components/Icons';


export default function Home() {
  const { t } = useI18n();
  const cards = [['home.c1.t', 'home.c1.d', <Leaf key="a" />], ['home.c2.t', 'home.c2.d', <Info key="b" />], ['home.c3.t', 'home.c3.d', <Check key="c" />]] as const;
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-olive-50 border border-olive-100 p-5 sm:p-8 space-y-5">
        <OliveScene />
        <h1 className="text-2xl sm:text-4xl font-bold text-olive-900 leading-tight">{t('home.title')}</h1>
        <p className="text-xl sm:text-2xl text-gray-800">{t('home.claim')}</p>
        <p className="text-lg text-gray-800">{t('home.mission')}</p>
        <BottleExperience />
        <Link to="/filiera#prova" className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-olive-700 bg-white text-olive-900 text-lg font-semibold px-5 min-h-14 py-3 w-full sm:w-auto text-center hover:bg-olive-100">{t('home.demo')}</Link>
        <div className="rounded-xl border border-olive-100 bg-white p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-olive-800 mb-3">{t('home.flowt')}</p>
          <FlowDiagram />
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

      <VerifySection />

      <BuildBox />
    </div>
  );
}
