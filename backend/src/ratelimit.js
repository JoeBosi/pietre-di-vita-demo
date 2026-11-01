// In-memory limiter for failed logins. Keys: (ip + username) and a coarser per-IP cap.
// Clock is injectable so tests can move time.
export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_PER_KEY = 5;
export const MAX_PER_IP = 30;
const MAX_ENTRIES = 10000;

export function createLimiter({ now = Date.now, maxKey = MAX_PER_KEY, maxIp = MAX_PER_IP, windowMs = WINDOW_MS, maxEntries = MAX_ENTRIES } = {}) {
  const keys = new Map(); // key -> { count, last }
  const ips = new Map(); // ip -> number[] (failure timestamps, newest last)

  const alive = (t) => now() - t < windowMs;
  function cleanup() {
    for (const [k, v] of keys) if (!alive(v.last)) keys.delete(k);
    for (const [k, v] of ips) {
      const f = v.filter(alive);
      if (f.length) ips.set(k, f); else ips.delete(k);
    }
  }
  function trim(map) {
    if (map.size < maxEntries) return;
    cleanup();
    while (map.size >= maxEntries) map.delete(map.keys().next().value); // drop oldest inserted
  }
  const timer = setInterval(cleanup, 60 * 1000);
  timer.unref?.();

  const keyOf = (ip, user) => `${ip}|${typeof user === 'string' ? user.toLowerCase().slice(0, 100) : ''}`;

  /** Returns 0 when allowed, else seconds to wait. */
  function check(ip, user) {
    const t = now();
    const v = keys.get(keyOf(ip, user));
    let wait = 0;
    if (v && alive(v.last) && v.count >= maxKey) wait = v.last + windowMs - t;
    const f = (ips.get(ip) ?? []).filter(alive);
    if (f.length >= maxIp) wait = Math.max(wait, f[f.length - maxIp] + windowMs - t);
    return wait > 0 ? Math.ceil(wait / 1000) : 0;
  }
  function fail(ip, user) {
    const t = now();
    const k = keyOf(ip, user);
    const v = keys.get(k);
    if (v && alive(v.last)) { v.count += 1; v.last = t; }
    else { keys.delete(k); trim(keys); keys.set(k, { count: 1, last: t }); }
    const f = (ips.get(ip) ?? []).filter(alive);
    if (!ips.has(ip)) trim(ips);
    f.push(t);
    ips.set(ip, f.slice(-maxIp));
  }
  function clear(ip, user) { keys.delete(keyOf(ip, user)); }

  return { check, fail, clear, cleanup, size: () => ({ keys: keys.size, ips: ips.size }), stop: () => clearInterval(timer) };
}
