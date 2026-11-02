// Post-build step: writes one HTML copy of dist/index.html per indexable route and language,
// with the page-specific <head> (title, description, canonical, hreflang, og, twitter, JSON-LD)
// and a <noscript> summary, so crawlers that do not run JavaScript still read the page.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, metaFor, headTags, tagsToHtml, esc, pageUrl, basenameFor } from './seo-core.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const data = JSON.parse(readFileSync(here('./seo-data.json'), 'utf8'));
const dist = here('../dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');

const NS_LABELS = { it: { tutorial: 'Tutorial e Coding', site: 'Sito di Giuseppe Bosi', github: 'Codice su GitHub', linkedin: 'LinkedIn' }, en: { tutorial: 'Tutorial and Coding', site: "Giuseppe Bosi's website", github: 'Code on GitHub', linkedin: 'LinkedIn' } };

function linkFor(lang, id) {
  if (id === 'tutorial') return { href: `/tutorial/${lang}/`, label: NS_LABELS[lang].tutorial };
  const pg = data.pages.find((p) => p.id === id);
  return { href: pageUrl(data, lang, pg.path).replace(data.host, ''), label: pg[lang].name };
}

function noscript(lang, meta, page) {
  const links = (page.links || []).map((id) => linkFor(lang, id));
  const items = links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('');
  const ext = [[data.author.url, NS_LABELS[lang].site], [data.repo, NS_LABELS[lang].github], [data.author.sameAs[1], NS_LABELS[lang].linkedin]]
    .map(([h, l]) => `<li><a href="${esc(h)}" rel="noopener">${esc(l)}</a></li>`).join('');
  return `<noscript><h1>${esc(meta.h1)}</h1><p>${esc(meta.summary)}</p><nav><ul>${items}${ext}</ul></nav></noscript>`;
}

let count = 0;
for (const page of data.pages.filter((p) => p.prerender)) {
  for (const lang of LANGS) {
    const meta = metaFor(data, lang, page.path);
    let html = template
      .replace(/<html[^>]*>/, `<html lang="${lang}">`)
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace('</head>', `    <title>${esc(meta.title)}</title>\n    ${tagsToHtml(headTags(data, lang, meta))}\n  </head>`)
      .replace('<div id="root"></div>', `${noscript(lang, meta, page)}\n    <div id="root"></div>`);
    const rel = (basenameFor(lang) + (page.path === '/' ? '' : page.path)).replace(/^\//, '');
    const out = join(dist, rel, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    count++;
  }
}
console.log(`prerender: ${count} pages`);
