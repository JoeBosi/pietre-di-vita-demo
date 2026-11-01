// Dev: same-origin via the Vite proxy (the backend sends no CORS headers). Prod: set VITE_API_URL, or serve /api from the same host.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.DEV ? '' : 'http://127.0.0.1:3802');
export const apiUrl = (p: string) => (p.startsWith('http') ? p : BASE + p);

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'ERROR', (data as { code?: string }).code);
  return data as T;
}

export const postJson = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const postForm = <T,>(path: string, fd: FormData) => api<T>(path, { method: 'POST', body: fd });

export interface User { username: string; ruolo: 'PRODUTTORE' | 'FRANTOIO' | 'LABORATORIO' | 'IMBOTTIGLIATORE'; must_change_password: boolean }
