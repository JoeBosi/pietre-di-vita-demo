import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n, type TKey } from '../i18n';
import { api, ApiError, apiUrl } from '../lib/api';
import { deriveStato, pickText, proofForStep, type Passo, type Payload } from '../lib/verifica';
import { Alert, Check, Info, phaseIcons } from '../components/Icons';
import { BottleSkeleton } from '../components/Skeleton';

const btnP = 'inline-flex items-center justify-center rounded-xl bg-olive-700 hover:bg-olive-800 text-white font-semibold px-5 min-h-12 text-lg';
const btnS = 'inline-flex items-center justify-center rounded-xl border border-olive-700 text-olive-800 font-semibold px-5 min-h-12 text-lg';
import { Tip } from '../components/Tip';

const WHO: Record<string, TKey> = { agricoltore: 'who.agricoltore', frantoio: 'who.frantoio', laboratorio: 'who.laboratorio', imbottigliatore: 'who.imbottigliatore' };

export default function Bottle() {
  const { codice = '', n = '' } = useParams();
  const { t, lang } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<'404' | 'net' | null>(null);
  const [tries, setTry] = useState(0);

  useEffect(() => {
    setData(null); setErr(null);
    api<Payload>(`/api/pubblico/bottiglia/${encodeURIComponent(codice)}/${encodeURIComponent(n)}`)
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof ApiError && e.status === 404 ? '404' : 'net'));
  }, [codice, n, tries]);

  if (err === '404') return (
    <div className="text-center space-y-4 py-10 max-w-md mx-auto">
      <div className="mx-auto w-14 h-14 rounded-full bg-olive-100 text-olive-700 flex items-center justify-center"><Info /></div>
      <h1 className="text-2xl font-bold">{t('bt.404')}</h1>
      <p className="text-gray-700">{t('bt.404d')}</p>
      <p className="font-mono text-sm text-gray-600">{codice} / {n}</p>
      <div className="flex flex-col gap-2">
        <Link to="/b/25B001/1" className={btnP}>{t('bt.try')}</Link>
        <Link to="/" className={btnS}>{t('nav.home')}</Link>
      </div>
    </div>
  );
  if (err === 'net') return (
    <div className="text-center space-y-4 py-10 max-w-md mx-auto" role="alert">
      <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center"><Alert /></div>
      <h1 className="text-2xl font-bold">{t('bt.neth')}</h1>
      <p className="text-gray-700">{t('bt.neterr')}</p>
      <button type="button" className={btnP + ' w-full'} onClick={() => setTry((x) => x + 1)}>{t('bt.retry')}</button>
    </div>
  );
  if (!data) return <div><span className="sr-only">{t('bt.loading')}</span><BottleSkeleton /></div>;

  const stato = deriveStato(data);
  const mismatch = stato === 'unverifiable' && data.verifica.onchain && !data.offline && data.verifica.hashMatch.some((h) => !h.match);
  const fmt = (s: number) => new Date(s * 1000).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const l = data.lotto;
  const num = data.bottiglia?.numero ?? Number(n);
  const tot = data.bottiglia?.di ?? l.n_bottiglie ?? '?';

  return (
    <div className="space-y-6">
      {stato === 'recalled' && (
        <div role="alert" className="-mx-4 sm:mx-0 bg-red-700 text-white p-5 sm:rounded-xl space-y-2">
          <p className="flex items-center gap-2 text-2xl font-extrabold"><Alert />{t('st.rec')}</p>
          <p className="text-lg"><strong>{t('st.recd')}:</strong> {pickText(lang, l.motivo_richiamo, l.motivo_richiamo_en) || '—'}</p>
          <p>{t('st.recn')}</p>
        </div>
      )}
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-olive-900">{t('bt.title', { n: num, N: tot })}</h1>
        <p className="flex flex-wrap gap-2 text-base">
          <span className="rounded-full bg-olive-100 text-olive-900 px-3 py-1 font-medium">{t('bt.lot')} {l.codice}</span>
          <span className="rounded-full bg-white border border-olive-200 px-3 py-1">{t('bt.lotdata')}: {l.cultivar}</span>
          <span className="rounded-full bg-white border border-olive-200 px-3 py-1">{t('bt.zone')}: {l.zona}</span>
        </p>
      </header>
      {stato === 'verified' && (
        <div className="rounded-xl bg-green-100 border-2 border-green-700 text-green-950 p-4 sm:p-5 flex gap-3 items-center">
          <span className="shrink-0 rounded-full bg-green-700 text-white p-2"><Check /></span><p className="text-lg sm:text-xl font-semibold leading-snug">{t('st.ok')}</p>
        </div>
      )}
      {stato === 'unverifiable' && (
        <div className="rounded-xl bg-amber-100 border-2 border-amber-500 text-amber-900 p-4 space-y-1">
          <p className="text-lg font-semibold flex items-center gap-2"><Alert />{t(mismatch ? 'st.diff' : 'st.warn')}</p>
          <p>{t(mismatch ? 'st.diffd' : 'st.warnd')}</p>
        </div>
      )}

      <section>
        <h2 className="text-2xl font-semibold mb-1">{t('tl.title')}</h2>
        <p className="text-gray-600 mb-4">{t('bt.steps', { n: data.passi.length })}</p>
        <ol className="relative border-l-4 border-olive-200 ml-4 space-y-5">
          {data.passi.map((p) => <Step key={p.fase} p={p} data={data} fmt={fmt} />)}
        </ol>
      </section>

      <section className="rounded-xl bg-white border border-olive-100 p-4 space-y-2">
        <h2 className="text-xl font-semibold">{t('how.v.title')}<Tip text={t('tip.blockchain')} /></h2>
        <ol className="list-decimal pl-5 space-y-1 text-base text-gray-800">
          <li>{t('how.v1')}</li>
          <li>{t('how.v2')}<Tip text={t('tip.hash')} /></li>
          <li>{t('how.v3')}</li>
        </ol>
      </section>
    </div>
  );
}

function Step({ p, data, fmt }: { p: Passo; data: Payload; fmt: (s: number) => string }) {
  const { t, lang } = useI18n();
  const Icon = phaseIcons[p.fase] ?? phaseIcons[0];
  const proof = proofForStep(data, p);
  const d = p.documento;
  const isImg = d?.mime.startsWith('image/');
  const who = WHO[p.attore];
  return (
    <li className="ml-8 relative">
      <span className="absolute -left-[3.2rem] top-3 bg-olive-700 text-white rounded-full p-1.5 ring-4 ring-[#faf9f3] [&>svg]:w-6 [&>svg]:h-6"><Icon /></span>
      <div className="rounded-xl bg-white border border-olive-100 shadow-sm p-4 space-y-2">
        <h3 className="text-xl font-semibold">{t(`ph.${p.fase}` as TKey)}</h3>
        <p className="text-sm text-gray-700">{who ? t(who) : p.attore} · {fmt(p.fase === 0 && data.lotto.data_raccolta ? data.lotto.data_raccolta : p.timestamp)}</p>
        <p className="text-base">{pickText(lang, p.descrizione, p.descrizione_en)}</p>
        {d && (isImg ? (
          <a href={apiUrl(d.url)} target="_blank" rel="noreferrer"><img src={apiUrl(d.url)} alt={t('tl.photo')} className="h-32 sm:h-40 w-auto rounded-lg border border-gray-200" loading="lazy" /></a>
        ) : (
          <a href={apiUrl(d.url)} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-11 text-olive-800 font-medium underline">{t('tl.doc')} ({d.filename})</a>
        ))}
        <p className="text-sm border-t border-gray-100 pt-2 text-gray-800 leading-relaxed">
          <span className="text-gray-500">{t('pr.label')}: </span>
          {proof === 'ok' && <span className="text-green-800 font-semibold">✓ {t('pr.ok')}</span>}
          {proof === 'bad' && <span className="text-red-700 font-medium">✗ {t('pr.bad')}</span>}
          {proof === 'none' && <span>{t('pr.none')}</span>}
          {p.tx_url && <> · <a href={p.tx_url} target="_blank" rel="noreferrer" className="text-olive-700 underline">{t('pr.tx')}</a><Tip text={t('pr.txhelp')} /></>}
        </p>
      </div>
    </li>
  );
}
