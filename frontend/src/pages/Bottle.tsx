import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n, type TKey } from '../i18n';
import { api, ApiError, apiUrl } from '../lib/api';
import { deriveStato, proofForStep, type Passo, type Payload } from '../lib/verifica';
import { Alert, Check, phaseIcons } from '../components/Icons';
import { Tip } from '../components/Tip';

const WHO: Record<string, TKey> = { agricoltore: 'who.agricoltore', frantoio: 'who.frantoio', laboratorio: 'who.laboratorio', imbottigliatore: 'who.imbottigliatore' };

export default function Bottle() {
  const { codice = '', n = '' } = useParams();
  const { t, lang } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<'404' | 'net' | null>(null);

  useEffect(() => {
    setData(null); setErr(null);
    api<Payload>(`/api/pubblico/bottiglia/${encodeURIComponent(codice)}/${encodeURIComponent(n)}`)
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof ApiError && e.status === 404 ? '404' : 'net'));
  }, [codice, n]);

  if (err === '404') return (
    <div className="text-center space-y-3 py-10">
      <h1 className="text-2xl font-bold">{t('bt.404')}</h1>
      <p className="text-gray-700">{t('bt.404d')}</p>
      <Link to="/" className="text-olive-700 underline">{t('nav.home')}</Link>
    </div>
  );
  if (err === 'net') return <p className="py-10 text-center text-gray-700">{t('bt.neterr')}</p>;
  if (!data) return <p className="py-10 text-center text-gray-600">{t('bt.loading')}</p>;

  const stato = deriveStato(data);
  const fmt = (s: number) => new Date(s * 1000).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const l = data.lotto;
  const num = data.bottiglia?.numero ?? Number(n);
  const tot = data.bottiglia?.di ?? l.n_bottiglie ?? '?';

  return (
    <div className="space-y-6">
      {stato === 'recalled' && (
        <div role="alert" className="-mx-4 sm:mx-0 bg-red-700 text-white p-5 sm:rounded-xl space-y-2">
          <p className="flex items-center gap-2 text-2xl font-extrabold"><Alert />{t('st.rec')}</p>
          <p className="text-lg"><strong>{t('st.recd')}:</strong> {l.motivo_richiamo ?? '—'}</p>
          <p>{t('st.recn')}</p>
        </div>
      )}
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-olive-800">{t('bt.title', { n: num, N: tot })}</h1>
        <p className="text-lg text-gray-700">{t('bt.lot')} {l.codice} · {l.cultivar} · {l.zona}</p>
      </header>
      {stato === 'verified' && (
        <div className="rounded-xl bg-green-100 border-2 border-green-600 text-green-900 p-4 flex gap-3 items-start">
          <span className="shrink-0 text-green-700"><Check /></span><p className="text-lg font-semibold">{t('st.ok')}</p>
        </div>
      )}
      {stato === 'unverifiable' && (
        <div className="rounded-xl bg-amber-100 border-2 border-amber-500 text-amber-900 p-4 space-y-1">
          <p className="text-lg font-semibold flex items-center gap-2"><Alert />{t('st.warn')}</p>
          <p>{t('st.warnd')}</p>
        </div>
      )}

      <section>
        <h2 className="text-2xl font-semibold mb-3">{t('tl.title')}</h2>
        <ol className="relative border-l-4 border-olive-100 ml-3 space-y-5">
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
  const { t } = useI18n();
  const Icon = phaseIcons[p.fase] ?? phaseIcons[0];
  const proof = proofForStep(data, p);
  const d = p.documento;
  const isImg = d?.mime.startsWith('image/');
  const who = WHO[p.attore];
  return (
    <li className="ml-6 relative">
      <span className="absolute -left-[2.9rem] top-0 bg-olive-600 text-white rounded-full p-1.5 [&>svg]:w-6 [&>svg]:h-6"><Icon /></span>
      <div className="rounded-xl bg-white border border-olive-100 p-4 space-y-2">
        <h3 className="text-xl font-semibold">{t(`ph.${p.fase}` as TKey)}</h3>
        <p className="text-sm text-gray-600">{who ? t(who) : p.attore} · {fmt(p.timestamp)}</p>
        <p className="text-base">{p.descrizione}</p>
        {d && (isImg ? (
          <a href={apiUrl(d.url)} target="_blank" rel="noreferrer"><img src={apiUrl(d.url)} alt={t('tl.photo')} className="h-28 w-auto rounded-lg border border-gray-200" loading="lazy" /></a>
        ) : (
          <a href={apiUrl(d.url)} target="_blank" rel="noreferrer" className="inline-block text-olive-700 underline">{t('tl.doc')} ({d.filename})</a>
        ))}
        <p className="text-sm border-t border-gray-100 pt-2 text-gray-700">
          <span className="text-gray-500">{t('pr.label')}: </span>
          {proof === 'ok' && <span className="text-green-700 font-medium">✓ {t('pr.ok')}</span>}
          {proof === 'bad' && <span className="text-red-700 font-medium">✗ {t('pr.bad')}</span>}
          {proof === 'none' && <span>{t('pr.none')}</span>}
          {p.tx_url && <> · <a href={p.tx_url} target="_blank" rel="noreferrer" className="text-olive-700 underline">{t('pr.tx')}</a><Tip text={t('pr.txhelp')} /></>}
        </p>
      </div>
    </li>
  );
}
