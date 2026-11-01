import { ApiError } from './api';
import type { TKey } from '../i18n';

/** Map backend errors to a plain-language translation key plus optional raw detail. */
export function errorInfo(e: unknown): { key: TKey; detail?: string } {
  if (!(e instanceof ApiError)) return { key: 'err.generic' };
  const m = e.message;
  if (e.status === 0) return { key: 'err.net' };
  if (e.code === 'MUST_CHANGE_PASSWORD') return { key: 'err.must' };
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
