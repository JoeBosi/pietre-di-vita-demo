import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, type TKey } from '../i18n';
import { api, ApiError, postForm, postJson, type User } from '../lib/api';
import { errorInfo } from '../lib/errors';
import type { Lotto, Payload } from '../lib/verifica';

type Kind = 'new' | 'ship' | 'recall' | 'mill' | 'lab' | 'bottle';
interface Outcome { offline?: boolean; tx_hash?: string | null }

const input = 'w-full rounded-lg border border-gray-400 px-3 py-2.5 min-h-12 text-base bg-white';
const btn = 'rounded-xl bg-olive-700 hover:bg-olive-800 text-white px-5 min-h-12 py-2 text-lg font-semibold disabled:opacity-50 w-full sm:w-auto';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="font-medium">{label}</span>{children}{hint && <span className="block text-sm text-gray-500">{hint}</span>}</label>;
}

function ErrorBox({ e }: { e: unknown }) {
  const { t } = useI18n();
  const i = errorInfo(e);
  return <p role="alert" className="rounded-lg bg-red-50 border border-red-300 text-red-800 p-3">{t(i.key, i.vars)}{i.detail && <span className="block text-xs text-red-600 mt-1">{i.detail}</span>}</p>;
}

export default function Filiera() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  const loadMe = useCallback(() => {
    api<{ user: User; offline: boolean }>('/api/me').then((r) => { setUser(r.user); setOffline(r.offline); }).catch(() => setUser(null));
  }, []);
  useEffect(loadMe, [loadMe]);

  if (user === undefined) return <div role="status" className="space-y-4"><span className="sr-only">{t('loading')}</span><div className="skeleton h-10 w-2/3" /><div className="skeleton h-64 w-full max-w-md" /></div>;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-olive-800">{t('fi.title')}</h1>
      {!user && (
        <>
          <p className="rounded-xl bg-olive-50 border border-olive-100 p-4 text-gray-800 space-y-2"><span className="block">{t('fi.guest')}</span><Link to="/b/25B001/1" className="inline-flex items-center min-h-11 text-olive-800 font-semibold underline">{t('fi.guestcta')}</Link></p>
          <Login onDone={loadMe} />
        </>
      )}
      {user && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-olive-50 border border-olive-100 p-3">
            <p className="mr-auto"><strong>{user.username}</strong> · {t('fi.role')}: {t(`role.${user.ruolo}` as TKey)}</p>
            <button className="underline text-olive-800" onClick={() => { void api('/api/logout', { method: 'POST' }).finally(() => setUser(null)); }}>{t('fi.logout')}</button>
          </div>
          {offline && <p className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm">{t('offline.note')}</p>}
          {user.must_change_password ? <ChangePassword onDone={loadMe} /> : <Lots user={user} />}
        </>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await postJson('/api/login', { username: u, password: p }); onDone(); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-white border border-olive-100 shadow-sm p-5 max-w-md">
      <h2 className="text-xl font-semibold">{t('fi.sign')}</h2>
      <p className="text-gray-700">{t('fi.intro')}</p>
      <Field label={t('fi.user')}><input className={input} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></Field>
      <Field label={t('fi.pass')}><input className={input} type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></Field>
      {err != null && <ErrorBox e={err} />}
      <button className={btn} disabled={busy}>{t('fi.login')}</button>
    </form>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [o, setO] = useState(''); const [n, setN] = useState('');
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await postJson('/api/cambia-password', { vecchia: o, nuova: n }); onDone(); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-white border-2 border-amber-400 p-4 max-w-md">
      <p className="font-semibold">{t('fi.mustchange')}</p>
      <Field label={t('fi.old')}><input className={input} type="password" value={o} onChange={(e) => setO(e.target.value)} autoComplete="current-password" required /></Field>
      <Field label={t('fi.new')}><input className={input} type="password" value={n} onChange={(e) => setN(e.target.value)} minLength={10} autoComplete="new-password" required /></Field>
      {err != null && <ErrorBox e={err} />}
      <button className={btn} disabled={busy}>{t('fi.change')}</button>
    </form>
  );
}

function allowed(user: User, l: Lotto): Kind[] {
  if (l.richiamato) return [];
  const max = Math.max(...l.fasi_completate);
  switch (user.ruolo) {
    case 'PRODUTTORE': return [...(max === 3 ? ['ship' as const] : []), 'recall'];
    case 'FRANTOIO': return max === 0 ? ['mill'] : [];
    case 'LABORATORIO': return max === 1 ? ['lab'] : [];
    case 'IMBOTTIGLIATORE': return max === 2 ? ['bottle'] : [];
  }
}

function Lots({ user }: { user: User }) {
  const { t } = useI18n();
  const [lots, setLots] = useState<Lotto[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [showNew, setShowNew] = useState(false);
  const load = useCallback(() => {
    api<{ lotti: Lotto[] }>('/api/lotti').then((r) => setLots(r.lotti)).catch(setErr);
  }, []);
  useEffect(load, [load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold mr-auto">{t('fi.lots')}</h2>
        {user.ruolo === 'PRODUTTORE' && <button className={btn} onClick={() => setShowNew((s) => !s)}>{t('act.new')}</button>}
      </div>
      {showNew && <ActionForm kind="new" onDone={() => load()} />}
      {err != null && <ErrorBox e={err} />}
      {lots?.length === 0 && <p className="text-gray-600">{t('fi.nolots')}</p>}
      {lots?.map((l) => <LotCard key={l.codice} l={l} acts={allowed(user, l)} onChange={load} />)}
    </section>
  );
}

function LotCard({ l, acts, onChange }: { l: Lotto; acts: Kind[]; onChange: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Kind | null>(null);
  const max = Math.max(...l.fasi_completate);
  const actLabel: Record<Kind, TKey> = { new: 'act.new', ship: 'act.ship', recall: 'act.recall', mill: 'act.mill', lab: 'act.lab', bottle: 'act.bottle' };
  return (
    <div className={`rounded-xl border p-4 space-y-3 bg-white ${l.richiamato ? 'border-red-400' : 'border-olive-100'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-semibold mr-auto">{l.codice} <span className="text-base font-normal text-gray-600">· {l.cultivar} · {l.zona}</span></h3>
        {l.richiamato && <span className="rounded bg-red-700 text-white px-2 py-0.5 text-sm font-bold">{t('fi.recalled')}</span>}
      </div>
      <p className="text-base text-gray-700">
        {t('fi.reached')}: {t(`ph.${max}` as TKey)} · {l.n_bottiglie ? `${t('fi.bottled')}: ${t('fi.bottles', { n: l.n_bottiglie })}` : t('fi.notbottled')}
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        {acts.map((a) => <button key={a} className={`${a === 'recall' ? 'bg-red-700' : 'bg-olive-700'} text-white rounded-lg px-3 py-2 font-medium`} onClick={() => setOpen(open === a ? null : a)}>{t(actLabel[a])}</button>)}
        {l.n_bottiglie ? <Link className="text-olive-700 underline" to={`/b/${l.codice}/1`}>{t('fi.view')}</Link> : null}
        {acts.length === 0 && <span className="text-sm text-gray-500">{t('fi.nothing')}</span>}
      </div>
      {open && <ActionForm kind={open} lot={l} onDone={onChange} onCancel={() => setOpen(null)} />}
    </div>
  );
}

function ActionForm({ kind, lot, onDone, onCancel }: { kind: Kind; lot?: Lotto; onDone: () => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [err, setErr] = useState<unknown>(null);
  const [out, setOut] = useState<{ o: Outcome; url: string | null } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [v, setV] = useState<Record<string, string>>({ cultivar: 'Frantoio' });
  const [file, setFile] = useState<File | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const run = async () => {
    setState('working'); setErr(null); setConfirm(false);
    try {
      const code = lot?.codice ?? '';
      let o: Outcome;
      const fd = new FormData();
      if (file) fd.append(kind === 'new' ? 'photo' : 'file', file);
      if (kind === 'new') {
        for (const k of ['codice', 'cultivar', 'zona', 'data_raccolta', 'kg_olive']) fd.append(k, v[k] ?? '');
        o = await postForm<Outcome>('/api/lotti', fd);
      } else if (kind === 'recall') {
        o = await postJson<Outcome>(`/api/lotti/${encodeURIComponent(code)}/richiamo`, { motivo: v.motivo ?? '' });
      } else if (kind === 'bottle') {
        fd.append('n_bottiglie', v.n_bottiglie ?? '');
        o = await postForm<Outcome>(`/api/lotti/${encodeURIComponent(code)}/imbottiglia`, fd);
      } else {
        const fase = { mill: 1, lab: 2, ship: 4 }[kind];
        let desc = v.descrizione ?? '';
        if (kind === 'lab') desc = `${t('f.acid')}: ${v.acid}; ${t('f.perox')}: ${v.perox}.${v.descrizione ? ' ' + v.descrizione : ''}`;
        fd.append('fase', String(fase)); fd.append('descrizione', desc);
        o = await postForm<Outcome>(`/api/lotti/${encodeURIComponent(code)}/passi`, fd);
      }
      let url: string | null = null;
      if (o.tx_hash) {
        const c = kind === 'new' ? v.codice : code;
        const base = await api<Payload>(`/api/pubblico/lotto/${encodeURIComponent(c)}`).then((p) => p.verifica.explorerBase).catch(() => undefined);
        url = `${base ?? 'https://amoy.polygonscan.com'}/tx/${o.tx_hash}`;
      }
      setOut({ o, url }); setState('done'); onDone();
    } catch (x) {
      setErr(x); setState('idle');
      if (x instanceof ApiError && x.status === 401) setErr(x);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); if (kind === 'recall') setConfirm(true); else void run(); };
  const fileLabel = kind === 'lab' ? t('f.pdf') : kind === 'new' ? t('f.photo') : kind === 'bottle' ? t('f.photo') : t('f.file');
  const accept = kind === 'lab' ? 'application/pdf' : kind === 'mill' ? 'image/jpeg,image/png,application/pdf' : 'image/jpeg,image/png';

  if (state === 'done' && out) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-400 p-3 space-y-1">
        <p className="font-semibold text-green-900">{t('res.ok')}</p>
        {out.o.offline ? <p className="text-sm text-gray-700">{t('res.offline')}</p> : out.url && <a className="text-olive-700 underline" href={out.url} target="_blank" rel="noreferrer">{t('res.tx')}</a>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-olive-50 border border-olive-100 p-4 space-y-3">
      <h4 className="font-semibold text-lg">{t(({ new: 'act.new', ship: 'act.ship', recall: 'act.recall', mill: 'act.mill', lab: 'act.lab', bottle: 'act.bottle' } as const)[kind])}{lot ? ` · ${lot.codice}` : ''}</h4>
      {kind === 'new' && (<>
        <Field label={t('f.code')} hint={t('f.codeh')}><input className={input} value={v.codice ?? ''} onChange={set('codice')} pattern="[A-Za-z0-9_\-]+" maxLength={32} required /></Field>
        <Field label={t('f.cultivar')}>
          <select className={input} value={v.cultivar} onChange={set('cultivar')}>{['Frantoio', 'Leccino', 'Moraiolo', 'Pendolino'].map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={t('f.zone')}><input className={input} value={v.zona ?? ''} onChange={set('zona')} required /></Field>
        <Field label={t('f.date')}><input className={input} type="date" value={v.data_raccolta ?? ''} onChange={set('data_raccolta')} required /></Field>
        <Field label={t('f.kg')}><input className={input} type="number" min={1} step={1} value={v.kg_olive ?? ''} onChange={set('kg_olive')} required /></Field>
      </>)}
      {kind === 'lab' && (<>
        <Field label={t('f.acid')}><input className={input} inputMode="decimal" value={v.acid ?? ''} onChange={set('acid')} required /></Field>
        <Field label={t('f.perox')}><input className={input} inputMode="decimal" value={v.perox ?? ''} onChange={set('perox')} required /></Field>
        <Field label={t('f.note')}><textarea className={input} rows={2} value={v.descrizione ?? ''} onChange={set('descrizione')} /></Field>
      </>)}
      {(kind === 'mill' || kind === 'ship') && <Field label={t('f.desc')}><textarea className={input} rows={3} value={v.descrizione ?? ''} onChange={set('descrizione')} required /></Field>}
      {kind === 'bottle' && <Field label={t('f.nbot')}><input className={input} type="number" min={1} step={1} value={v.n_bottiglie ?? ''} onChange={set('n_bottiglie')} required /></Field>}
      {kind === 'recall' && <Field label={t('f.reason')}><textarea className={input} rows={3} value={v.motivo ?? ''} onChange={set('motivo')} required /></Field>}
      {kind !== 'ship' && kind !== 'recall' && (
        <Field label={fileLabel}><input className={input} type="file" accept={accept} required={kind === 'lab'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} capture={undefined} /></Field>
      )}
      {state === 'working' && <p className="text-olive-800">{t('res.working')}</p>}
      {err != null && <ErrorBox e={err} />}
      <div className="flex gap-2">
        <button className={`${kind === 'recall' ? 'bg-red-700' : 'bg-olive-700'} text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50`} disabled={state === 'working'}>{t('f.submit')}</button>
        {onCancel && <button type="button" className="rounded-lg border border-gray-300 px-4 py-2" onClick={onCancel}>{t('f.cancel')}</button>}
      </div>
      {confirm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-md space-y-3 border-2 border-red-600">
            <h5 className="text-xl font-bold text-red-700">{t('ack.title')}</h5>
            <p>{t('ack.body', { c: lot?.codice ?? '' })}</p>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg bg-red-700 text-white px-4 py-2 font-semibold" onClick={() => void run()}>{t('ack.go')}</button>
              <button type="button" className="rounded-lg border border-gray-300 px-4 py-2" onClick={() => setConfirm(false)}>{t('f.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
