// Pure helpers for the public trial mode ("Prova la filiera"). No React here, so they are unit-testable.
export const TOTAL_STEPS = 5;
export const ROLES = ['agricoltore', 'frantoio', 'laboratorio', 'imbottigliatore'] as const;
export type DemoRole = (typeof ROLES)[number];

export interface DemoStatus {
  enabled: boolean; available: boolean; reason: null | 'disabled' | 'lowFunds' | 'dailyCap' | 'ipLimit';
  limits: { runsPerIpDay: number; runsLeft: number; txPerDay: number; txLeft: number };
}
export interface DemoLot { codice: string; cultivar: string; zona: string; n_bottiglie: number; fasi_completate: number[] }
export interface DemoMe {
  active: boolean; role: DemoRole | null; step: number; totalSteps: number;
  lotto: DemoLot | null; bottle_url: string | null; status: DemoStatus;
}

/** Step (1..5) a role works on: farmer 1, mill 2, laboratory 3, bottler 4. */
export const roleStep = (r: DemoRole): number => ROLES.indexOf(r) + 1;
/** Role whose turn it is at a given step; null at step 5 (look at your bottle). */
export const roleForStep = (step: number): DemoRole | null => (step >= 1 && step <= ROLES.length ? ROLES[step - 1] : null);
export type RoleState = 'done' | 'now' | 'later';
export const roleState = (r: DemoRole, step: number): RoleState => (roleStep(r) < step ? 'done' : roleStep(r) === step ? 'now' : 'later');
export const clampStep = (n: number): number => Math.min(TOTAL_STEPS, Math.max(1, Math.trunc(n) || 1));

/** Is the trial offered to this visitor? Paused states hide the roles unless a run is already in progress. */
export function pauseReason(me: Pick<DemoMe, 'active' | 'status'>): DemoStatus['reason'] {
  const r = me.status.reason;
  if (r === null) return null;
  if (r === 'lowFunds' || r === 'disabled') return r;
  return me.active ? null : r;
}
