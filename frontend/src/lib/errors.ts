import { ApiError } from './api';
import type { TKey } from '../i18n';

/** Map backend errors to a plain-language translation key plus optional raw detail. */
export function errorInfo(e: unknown): { key: TKey; detail?: string; vars?: Record<string, number> } {
  if (!(e instanceof ApiError)) return { key: 'err.generic' };
  const m = e.message;
  if (e.status === 0) return { key: 'err.net' };
  const demo: Record<string, TKey> = {
    DEMO_RATE: 'err.demo.rate', DEMO_WRONG_ROLE: 'err.demo.role', DEMO_NO_LOT: 'err.demo.nolot', DEMO_BAD_INPUT: 'err.demo.input',
    DEMO_IP_LIMIT: 'demo.pause.ipLimit', DEMO_DAILY_CAP: 'demo.pause.dailyCap', DEMO_PAUSED: 'demo.pause.lowFunds', DEMO_DISABLED: 'demo.pause.disabled',
  };
  if (e.code && demo[e.code]) return { key: demo[e.code] };
  if (e.code === 'MUST_CHANGE_PASSWORD') return { key: 'err.must' };
  if (e.code === 'TOO_MANY_ATTEMPTS') return { key: 'err.toomany', vars: { minutes: Math.max(1, Math.ceil((e.retrySeconds ?? 900) / 60)) } };
  if (e.status === 429) return { key: 'err.many' };
  if (/Wrong phase order/i.test(m)) return { key: 'err.order', detail: m };
  if (/recalled/i.test(m)) return { key: 'err.recalled' };
  if (/can only be registered|Only the producer|Only the/i.test(m)) return { key: 'err.role', detail: m };
  if (/already exists/i.test(m)) return { key: 'err.dup' };
  if (/Current password is wrong/i.test(m)) return { key: 'err.wrongpw' };
  if (e.status === 401 && /credentials/i.test(m)) return { key: 'err.login' };
  if (e.status === 401) return { key: 'err.session' };
  return { key: 'err.generic', detail: m };
}
