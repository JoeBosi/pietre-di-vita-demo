import { describe, expect, it } from 'vitest';
import { ROLES, TOTAL_STEPS, clampStep, pauseReason, roleForStep, roleState, roleStep, type DemoMe } from './demo';
import { translate } from '../i18n';
import { errorInfo } from './errors';
import { ApiError } from './api';

const st = (reason: DemoMe['status']['reason']): DemoMe['status'] => ({ enabled: true, available: reason === null, reason, limits: { runsPerIpDay: 3, runsLeft: 3, txPerDay: 150, txLeft: 150 } });

describe('trial steps', () => {
  it('has 5 steps and 4 roles, one step each, in order', () => {
    expect(TOTAL_STEPS).toBe(5);
    expect(ROLES.map(roleStep)).toEqual([1, 2, 3, 4]);
    expect([1, 2, 3, 4, 5].map(roleForStep)).toEqual([...ROLES, null]);
  });
  it('role state follows the current step', () => {
    expect(ROLES.map((r) => roleState(r, 3))).toEqual(['done', 'done', 'now', 'later']);
    expect(ROLES.map((r) => roleState(r, 5))).toEqual(['done', 'done', 'done', 'done']);
  });
  it('step is clamped to 1..5', () => {
    expect([clampStep(0), clampStep(3), clampStep(9), clampStep(NaN)]).toEqual([1, 3, 5, 1]);
  });
  it('counter text in both languages for every step', () => {
    for (let n = 1; n <= TOTAL_STEPS; n++) {
      expect(translate('it', 'demo.step', { n })).toBe(`Sei al passo ${n} di 5`);
      expect(translate('en', 'demo.step', { n })).toBe(`You are at step ${n} of 5`);
    }
  });
});

describe('trial texts', () => {
  it('guide has 5 items, labels and next-step buttons in IT and EN', () => {
    for (const lang of ['it', 'en'] as const) {
      for (let n = 1; n <= 5; n++) { expect(translate(lang, `demo.g${n}` as 'demo.g1')).not.toMatch(/^demo\./); expect(translate(lang, `demo.sv.${n}` as 'demo.sv.1')).not.toMatch(/^demo\./); }
      for (const r of ROLES) expect(translate(lang, `demo.go.${r}` as 'demo.go.frantoio')).not.toMatch(/^demo\./);
    }
    expect(translate('it', 'demo.go.frantoio')).toBe('Vai al Frantoio');
    expect(translate('en', 'demo.go.frantoio')).toBe('Go to the Mill');
    expect(translate('it', 'home.demo')).toBe('Prova tu la filiera');
    expect(translate('en', 'home.demo')).toBe('Try the supply chain yourself');
  });
  it('positive wording: no negative phrasing in trial messages', () => {
    const keys = ['demo.pause.lowFunds', 'demo.pause.dailyCap', 'demo.pause.ipLimit', 'demo.pause.disabled', 'err.demo.rate', 'err.demo.role', 'err.demo.nolot', 'err.demo.input', 'demo.later'] as const;
    for (const k of keys) {
      expect(translate('it', k, { n: 2 })).not.toMatch(/\b(non|impossibile|vietato|errore)\b/i);
      expect(translate('en', k, { n: 2 })).not.toMatch(/\b(cannot|can't|not allowed|forbidden|error|no more)\b/i);
    }
  });
});

describe('trial errors and pauses', () => {
  it('maps backend codes to friendly keys', () => {
    expect(errorInfo(new ApiError(429, 'x', 'DEMO_IP_LIMIT')).key).toBe('demo.pause.ipLimit');
    expect(errorInfo(new ApiError(503, 'x', 'DEMO_DAILY_CAP')).key).toBe('demo.pause.dailyCap');
    expect(errorInfo(new ApiError(503, 'x', 'DEMO_PAUSED')).key).toBe('demo.pause.lowFunds');
    expect(errorInfo(new ApiError(429, 'x', 'DEMO_RATE', 5)).key).toBe('err.demo.rate');
  });
  it('low funds pause everyone, daily and ip limits only visitors without a run in progress', () => {
    expect(pauseReason({ active: true, status: st('lowFunds') })).toBe('lowFunds');
    expect(pauseReason({ active: true, status: st('dailyCap') })).toBeNull();
    expect(pauseReason({ active: false, status: st('ipLimit') })).toBe('ipLimit');
    expect(pauseReason({ active: false, status: st(null) })).toBeNull();
  });
});
