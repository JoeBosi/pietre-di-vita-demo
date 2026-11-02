// QA over dist/ (prerendered SPA) and ../tutorial: prints duplicates and problems, exits 1 on errors.
// Run after the build: node scripts/check-seo.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, metaFor, pageUrl, tutorialEntries } from './seo-core.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const data = JSON.parse(readFileSync(here('./seo-data.json'), 'utf8'));
const errors = [];
const seen = { title: new Map(), description: new Map() };
const err = (m) => errors.push(m);

const unesc = (v) => (v == null ? v : v.replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
const get = (html, re) => unesc((re.exec(html) || [])[1]);
function inspect(file, html, expect) {
  const title = get(html, /<title>([^<]*)<\/title>/);
  const desc = get(html, /<meta name="description" content="([^"]*)"/);
  const canon = get(html, /<link rel="canonical" href="([^"]*)"/);
  const lang = get(html, /<html lang="([^"]*)"/);
  const h1 = (html.match(/<h1[ >]/g) || []).length;
  const hl = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
  if (!title) err(`${file}: no title`); else if (title.length > 60) err(`${file}: title ${title.length} chars`);
  if (!desc) err(`${file}: no description`); else if (desc.length < 120 || desc.length > 158) err(`${file}: description ${desc.length} chars`);
  if (canon !== expect.canonical) err(`${file}: canonical ${canon} != ${expect.canonical}`);
  if (lang !== expect.lang) err(`${file}: html lang ${lang} != ${expect.lang}`);
  if (h1 !== 1) err(`${file}: ${h1} h1 (noscript counted)`);
  if (hl.length !== 3 || !hl.some((x) => x.startsWith('x-default='))) err(`${file}: hreflang ${hl.join(',')}`);
  if (!/name="viewport"/.test(html)) err(`${file}: no viewport`);
  if (!/property="og:image:alt"/.test(html) || !/name="twitter:image:alt"/.test(html) || !/property="og:locale:alternate"/.test(html)) err(`${file}: og/twitter incomplete`);
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { err(`${file}: invalid JSON-LD`); } }
  if (!/application\/ld\+json/.test(html)) err(`${file}: no JSON-LD`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]+"/.test(m[0])) err(`${file}: img without alt`);
  for (const k of ['title', 'description']) {
    const v = k === 'title' ? title : desc;
    if (seen[k].has(v)) err(`${file}: duplicate ${k} (also ${seen[k].get(v)})`); else seen[k].set(v, file);
  }
  console.log(`${file}\n  title: ${title}\n  desc: ${desc}\n  canonical: ${canon}\n  h1: ${h1}  hreflang: ${hl.length}`);
}

const dist = here('../dist');
for (const p of data.pages.filter((x) => x.prerender)) {
  for (const lang of LANGS) {
    const rel = (lang === 'en' ? 'en' : '') + (p.path === '/' ? '' : p.path);
    const f = join(dist, rel, 'index.html');
    if (!existsSync(f)) { err(`missing ${f}`); continue; }
    inspect(`dist/${rel || '.'}/index.html`, readFileSync(f, 'utf8'), { canonical: metaFor(data, lang, p.path).canonical, lang });
  }
}
const tdir = here('../../tutorial');
for (const t of tutorialEntries(data)) {
  for (const lang of LANGS) {
    const f = join(tdir, lang, t[lang]);
    if (!existsSync(f)) { err(`missing ${f}`); continue; }
    const html = readFileSync(f, 'utf8');
    inspect(`tutorial/${lang}/${t[lang]}`, html, { canonical: t.url[lang], lang });
    if (!html.includes('giuseppebosi.com/in/') && !html.includes('linkedin.com/in/giuseppebosi')) err(`tutorial/${lang}/${t[lang]}: no LinkedIn link`);
    if (!html.includes(data.repo)) err(`tutorial/${lang}/${t[lang]}: no GitHub link`);
  }
}
void pageUrl; void readdirSync;
if (errors.length) { console.error('\nERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nSEO check OK');
