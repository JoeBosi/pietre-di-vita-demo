import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, type TKey } from '../i18n';
import { api, apiUrl, postJson } from '../lib/api';
import { errorInfo } from '../lib/errors';
import { ROLES, TOTAL_STEPS, pauseReason, roleForStep, roleState, roleStep, type DemoMe, type DemoRole } from '../lib/demo';

const input = 'w-full rounded-lg border border-gray-400 px-3 py-2.5 min-h-12 text-base bg-white';
const bigBtn = 'inline-flex items-center justify-center rounded-xl bg-olive-700 hover:bg-olive-800 text-white px-5 min-h-14 py-3 text-lg font-semibold w-full disabled:opacity-60';

/** Inline SVG of the five stages (harvest, milling, analysis, bottling, check). Done = green, current = gold. */
export function DemoPath({ step }: { step: number }) {
  const { t } = useI18n();
  const xs = [34, 102, 170, 238, 306];
  return (
    <svg viewBox="0 0 340 86" role="img" aria-label={t('demo.svg')} className="mx-auto h-auto w-full max-w-md">
      {xs.slice(0, -1).map((x, i) => <line key={x} x1={x + 17} y1="26" x2={xs[i + 1] - 17} y2="26" stroke={i + 1 < step ? '#4c6422' : '#b9c77a'} strokeWidth="3" strokeDasharray={i + 1 < step ? undefined : '5 4'} />)}
      {xs.map((x, i) => {
        const n = i + 1, done = n < step, now = n === step;
        return (
          <g key={x}>
            <circle cx={x} cy="26" r="16" fill={done ? '#4c6422' : now ? '#f6c453' : '#f4f7ec'} stroke={now ? '#2a3913' : '#5f7a2a'} strokeWidth={now ? 3.5 : 2} />
            <text x={x} y="32" textAnchor="middle" fontSize="16" fontWeight="700" fill={done ? '#ffffff' : '#2a3913'}>{done ? '✓' : n}</text>
            <text x={x} y="64" textAnchor="middle" fontSize="12.5" fontWeight={now ? 700 : 500} fill="#2a3913">{t(`demo.sv.${n}` as TKey)}</text>
            {now && <rect x={x - 22} y="71" width="44" height="4" rx="2" fill="#c9a82e" />}
          </g>
        );
      })}
    </svg>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="font-medium">{label}</span>{children}</label>;
}

export default function DemoTry() {
  const { t } = useI18n();
  const [me, setMe] = useState<DemoMe | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [v, setV] = useState<Record<string, string>>({ cultivar: 'Frantoio', zona: 'Chianti', kg_olive: '500', temperatura: '24', resa: '14', acidita: '0.2', perossidi: '6', n_bottiglie: '12' });
  const set = (k: string) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const load = useCallback(() => { api<DemoMe>('/api/demo/me').then(setMe).catch((x) => setErr(x)); }, []);
  useEffect(load, [load]);

  const call = async (path: string, body: unknown, ok = false) => {
    setBusy(true); setErr(null); setFlash(false);
    try { await postJson(path, body); setFlash(ok); const m = await api<DemoMe>('/api/demo/me'); setMe(m); }
    catch (x) { setErr(x); load(); }
    finally { setBusy(false); }
  };
  const chooseRole = async (role: DemoRole) => {
    setBusy(true); setErr(null); setFlash(false);
    try { setMe(await postJson<DemoMe>('/api/demo/ruolo', { role })); } catch (x) { setErr(x); load(); } finally { setBusy(false); }
  };

  const step = me?.step ?? 1;
  const cur = roleForStep(step);
  const sel = me?.role ?? null;
  const paused = me ? pauseReason(me) : null;
  const lot = me?.lotto ?? null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!sel) return;
    const f = { agricoltore: ['/api/demo/lotto', ['cultivar', 'zona', 'kg_olive']], frantoio: ['/api/demo/molitura', ['temperatura', 'resa']], laboratorio: ['/api/demo/analisi', ['acidita', 'perossidi']], imbottigliatore: ['/api/demo/imbottiglia', ['n_bottiglie']] } as const;
    const [path, keys] = f[sel];
    void call(path, Object.fromEntries(keys.map((k) => [k, v[k]])), true);
  };

  const err1 = err != null ? errorInfo(err) : null;

  return (
    <section id="prova" aria-labelledby="prova-title" className="scroll-mt-4 rounded-2xl bg-olive-50 border border-olive-100 p-4 sm:p-6 space-y-5">
      <h2 id="prova-title" className="text-2xl sm:text-3xl font-bold text-olive-900">{t('demo.title')}</h2>
      <p className="text-lg text-gray-800">{t('demo.intro')}</p>

      <div className="rounded-xl bg-white border border-olive-100 p-4 space-y-3">
        <h3 className="font-semibold text-olive-900">{t('demo.guide')}</h3>
        <ol className="space-y-2" data-testid="guide">
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} aria-current={n === step ? 'step' : undefined} className={`flex gap-3 items-start rounded-lg px-2 py-1.5 ${n === step ? 'bg-amber-100 font-semibold' : ''}`}>
              <span aria-hidden="true" className={`shrink-0 grid place-items-center w-7 h-7 rounded-full text-sm font-bold ${n < step ? 'bg-olive-700 text-white' : n === step ? 'bg-amber-400 text-olive-900' : 'bg-olive-100 text-olive-900'}`}>{n < step ? '✓' : n}</span>
              <span>{t(`demo.g${n}` as TKey)}</span>
            </li>
          ))}
        </ol>
        <DemoPath step={step} />
      </div>

      <p role="status" data-testid="step-counter" className="rounded-xl bg-olive-800 text-white text-xl font-bold px-4 py-3 text-center">{t('demo.step', { n: step })}</p>

      {err1 && <p role="alert" className="rounded-lg bg-amber-50 border border-amber-400 text-amber-950 p-3 text-base">{t(err1.key, err1.vars)}</p>}
      {me === null && err == null && <div role="status" className="skeleton h-40 w-full" />}

      {me && paused && (
        <div className="rounded-xl bg-white border-2 border-amber-400 p-4 space-y-3">
          <p className="text-lg">{t(`demo.pause.${paused}` as TKey)}</p>
          <Link to="/b/25B001/1" className={bigBtn}>{t('fi.guestcta')}</Link>
        </div>
      )}

      {me && !paused && (
        <>
          <div role="group" aria-label={t('demo.pick')} className="space-y-2">
            <p className="font-semibold">{t('demo.pick')}</p>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => {
                const st = roleState(r, step);
                const on = sel === r;
                return (
                  <button key={r} type="button" aria-pressed={on} disabled={busy} onClick={() => void chooseRole(r)}
                    className={`rounded-xl border-2 min-h-20 px-3 py-3 text-left text-base sm:text-lg font-semibold space-y-1 break-words min-w-0 ${on ? 'bg-olive-700 text-white border-olive-900' : 'bg-white text-olive-900 border-olive-600 hover:bg-olive-100'}`}>
                    <span className="block">{roleStep(r)}. {t(`demo.r.${r}` as TKey)}</span>
                    {st !== 'later' && <span className={`inline-block rounded-full px-2 py-0.5 text-sm font-semibold ${st === 'now' ? 'bg-amber-300 text-olive-900' : on ? 'bg-white/20 text-white' : 'bg-olive-100 text-olive-900'}`}>{st === 'now' ? t('demo.badge.now') : t('demo.badge.done')}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {flash && !busy && <p role="status" className="rounded-lg bg-green-50 border border-green-400 text-green-900 font-semibold p-3">{t('demo.ok')}</p>}

          {/* Next step: always one obvious button when the selected role is not the one whose turn it is. */}
          {cur && sel !== cur && <button type="button" disabled={busy} className={bigBtn} onClick={() => void chooseRole(cur)}>{t(`demo.go.${cur}` as TKey)} <span aria-hidden="true">&nbsp;&rarr;</span></button>}

          {sel && cur === sel && (
            <form onSubmit={submit} className="rounded-xl bg-white border border-olive-100 p-4 space-y-4">
              <h3 className="text-xl font-semibold">{t(`demo.act.${roleStep(sel)}` as TKey)}</h3>
              {sel === 'agricoltore' && (<>
                <Field label={t('f.cultivar')}><select className={input} value={v.cultivar} onChange={set('cultivar')}>{['Frantoio', 'Leccino', 'Moraiolo', 'Pendolino'].map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label={t('f.zone')}><select className={input} value={v.zona} onChange={set('zona')}>{['Chianti', "Val d'Orcia", 'Casentino', 'Valdarno', 'Maremma'].map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label={t('f.kg')}><input className={input} type="number" inputMode="numeric" min={1} max={5000} value={v.kg_olive} onChange={set('kg_olive')} required /></Field>
              </>)}
              {sel === 'frantoio' && (<>
                <Field label={t('demo.temp')}><input className={input} type="number" inputMode="decimal" min={10} max={35} step="0.5" value={v.temperatura} onChange={set('temperatura')} required /></Field>
                <Field label={t('demo.resa')}><input className={input} type="number" inputMode="decimal" min={5} max={30} step="0.5" value={v.resa} onChange={set('resa')} required /></Field>
              </>)}
              {sel === 'laboratorio' && (<>
                <Field label={t('f.acid')}><input className={input} type="number" inputMode="decimal" min={0} max={5} step="0.01" value={v.acidita} onChange={set('acidita')} required /></Field>
                <Field label={t('f.perox')}><input className={input} type="number" inputMode="decimal" min={0} max={50} step="0.5" value={v.perossidi} onChange={set('perossidi')} required /></Field>
              </>)}
              {sel === 'imbottigliatore' && <Field label={t('f.nbot')}><input className={input} type="number" inputMode="numeric" min={1} max={24} value={v.n_bottiglie} onChange={set('n_bottiglie')} required /></Field>}
              {busy && <p role="status" className="text-olive-800">{t('demo.working')}</p>}
              <button className={bigBtn} disabled={busy}>{t(`demo.act.${roleStep(sel)}` as TKey)}</button>
            </form>
          )}

          {sel && cur !== sel && roleState(sel, step) === 'done' && <p className="rounded-lg bg-white border border-olive-100 p-3">{t('demo.donerole')}</p>}
          {sel && roleState(sel, step) === 'later' && <p className="rounded-lg bg-white border border-olive-100 p-3">{t('demo.later', { n: step })}</p>}
        </>
      )}

      {me && step === TOTAL_STEPS && lot && (
        <div className="rounded-xl bg-white border-2 border-olive-600 p-4 space-y-3 text-center" data-testid="final">
          <h3 className="text-2xl font-bold text-olive-900">{t('demo.final.t')}</h3>
          <p className="text-gray-800">{t('demo.final.d')}</p>
          <img src={apiUrl(`/api/qr/${encodeURIComponent(lot.codice)}/1.png`)} alt={t('demo.qr')} width={200} height={200} className="mx-auto rounded-lg border border-olive-100" />
          <Link to={`/b/${lot.codice}/1`} className={bigBtn}>{t('demo.final.cta')} <span aria-hidden="true">&nbsp;&rarr;</span></Link>
        </div>
      )}

      {lot && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{t('demo.note', { c: lot.codice })}</p>
          <button type="button" disabled={busy} className="rounded-xl border-2 border-olive-600 text-olive-900 font-semibold px-4 min-h-12 w-full sm:w-auto" onClick={() => void call('/api/demo/ricomincia', {})}>{t('demo.restart')}</button>
        </div>
      )}
      {me && !paused && <p className="text-sm text-gray-700">{t('demo.left', { n: me.status.limits.runsLeft })}</p>}
    </section>
  );
}
