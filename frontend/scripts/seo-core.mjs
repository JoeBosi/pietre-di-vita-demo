// Shared SEO logic. Plain ES module: used at build time (prerender.mjs, gen-sitemap.mjs, check-seo.mjs),
// at run time by the SPA (src/components/Seo.tsx) and by the tests. All data comes from seo-data.json.

export const LANGS = ['it', 'en'];
export const OG_LOCALE = { it: 'it_IT', en: 'en_US' };

/** "/foo/" -> "/foo", "" -> "/" ; query and hash are dropped. */
export function normPath(p) {
  let s = String(p || '/').split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/** Split a browser pathname into language and router path: "/en/filiera" -> { lang: "en", path: "/filiera" }. */
export function splitLangPath(pathname) {
  const p = String(pathname || '/');
  if (p === '/en' || p.startsWith('/en/')) return { lang: 'en', path: normPath(p.slice(3) || '/') };
  return { lang: 'it', path: normPath(p) };
}

/** Browser basename for a language. */
export const basenameFor = (lang) => (lang === 'en' ? '/en' : '');

/** Equivalent URL (path + search + hash) in the other language. */
export function switchLangUrl(pathname, search, hash, target) {
  const { path } = splitLangPath(pathname);
  const prefix = basenameFor(target);
  const full = path === '/' ? (target === 'en' ? '/en/' : '/') : prefix + path;
  return full + (search || '') + (hash || '');
}

/** Absolute public URL of a router path in a language. */
export function pageUrl(data, lang, path) {
  const p = normPath(path);
  if (p === '/') return data.host + (lang === 'en' ? '/en/' : '/');
  return data.host + basenameFor(lang) + p;
}

export function matchBottle(path) {
  const m = /^\/b\/([^/]+)\/([^/]+)$/.exec(normPath(path));
  if (!m) return null;
  let codice = m[1];
  let n = m[2];
  try { codice = decodeURIComponent(codice); n = decodeURIComponent(n); } catch { /* keep raw */ }
  return { codice, n };
}

export const isTrialLot = (codice) => String(codice).toUpperCase().startsWith('PROVA-');

export function findPage(data, path) {
  const p = normPath(path);
  return data.pages.find((x) => x.path === p) || null;
}

const fill = (s, v) => Object.entries(v).reduce((a, [k, x]) => a.replaceAll(`{${k}}`, String(x)), s);

/** Everything the head needs for a page in a language. */
export function metaFor(data, lang, path) {
  const p = normPath(path);
  const known = findPage(data, p);
  const bottle = matchBottle(p);
  let title; let description; let robots = null; let kind; let h1 = null; let summary = null; let pageId = null; let name;
  if (known) {
    const t = known[lang];
    ({ title, description } = t); h1 = t.h1; summary = t.summary; name = t.name; kind = 'page'; pageId = known.id;
  } else if (bottle) {
    const d = data.dynamicBottle[lang];
    const v = { n: bottle.n, codice: bottle.codice };
    title = fill(d.title, v); description = fill(d.description, v); kind = 'bottle';
    name = lang === 'en' ? `Bottle ${bottle.n} of lot ${bottle.codice}` : `Bottiglia ${bottle.n} del lotto ${bottle.codice}`;
    if (isTrialLot(bottle.codice)) robots = 'noindex,follow';
  } else {
    // Unknown path: the SPA shows the home page there; keep it out of the index.
    const home = data.pages[0][lang];
    title = home.title; description = home.description; name = home.name; kind = 'unknown'; robots = 'noindex,follow';
    return finish();
  }
  return finish();

  function finish() {
    const effectivePath = kind === 'unknown' ? '/' : p;
    return {
      lang, path: p, kind, pageId, name, h1, summary, title, description, robots,
      canonical: pageUrl(data, lang, effectivePath),
      alternates: [
        { hreflang: 'it', href: pageUrl(data, 'it', effectivePath) },
        { hreflang: 'en', href: pageUrl(data, 'en', effectivePath) },
        { hreflang: 'x-default', href: pageUrl(data, 'it', effectivePath) },
      ],
      ogLocale: OG_LOCALE[lang],
      ogLocaleAlt: OG_LOCALE[lang === 'en' ? 'it' : 'en'],
      siteName: data.siteName[lang],
      image: data.host + data.ogImage,
      imageAlt: data.ogImageAlt[lang],
    };
  }
}

const personOf = (data) => ({
  '@type': 'Person', '@id': `${data.author.url}/#person`, name: data.author.name, url: data.author.url, sameAs: data.author.sameAs,
});

/** JSON-LD objects for a page (array of top-level script payloads). */
export function jsonLdFor(data, lang, meta) {
  const homeUrl = pageUrl(data, lang, '/');
  const site = { '@type': 'WebSite', '@id': `${homeUrl}#website`, name: data.siteName[lang], url: homeUrl, inLanguage: lang };
  const person = personOf(data);
  if (meta.pageId === 'home') {
    return [{
      '@context': 'https://schema.org',
      '@graph': [
        { ...site, description: data.siteDescription[lang], publisher: { '@id': person['@id'] }, author: { '@id': person['@id'] } },
        {
          '@type': 'SoftwareSourceCode', '@id': `${homeUrl}#code`, name: `${data.siteName[lang]} (${lang === 'en' ? 'source code' : 'codice sorgente'})`,
          description: data.siteDescription[lang], codeRepository: data.repo, programmingLanguage: ['Solidity', 'TypeScript', 'JavaScript'],
          runtimePlatform: 'Polygon Amoy (testnet)', license: 'https://opensource.org/licenses/MIT', author: { '@id': person['@id'] }, inLanguage: lang,
        },
        person,
      ],
    }];
  }
  const homeName = data.pages[0][lang].name;
  return [{
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${meta.canonical}#webpage`, url: meta.canonical, name: meta.title, description: meta.description, inLanguage: lang,
        isPartOf: { '@type': 'WebSite', '@id': site['@id'], name: site.name, url: homeUrl }, author: { '@id': person['@id'] },
        breadcrumb: { '@id': `${meta.canonical}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList', '@id': `${meta.canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: homeName, item: homeUrl },
          { '@type': 'ListItem', position: 2, name: meta.name, item: meta.canonical },
        ],
      },
      person,
    ],
  }];
}

/** Escape for HTML attribute / text. */
export const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Head tags as plain descriptors. Every tag carries data-seo so the SPA can replace them on navigation. */
export function headTags(data, lang, meta) {
  const m = (attrs) => ({ tag: 'meta', attrs: { ...attrs, 'data-seo': '1' } });
  const tags = [
    m({ name: 'description', content: meta.description }),
  ];
  if (meta.robots) tags.push(m({ name: 'robots', content: meta.robots }));
  tags.push({ tag: 'link', attrs: { rel: 'canonical', href: meta.canonical, 'data-seo': '1' } });
  for (const a of meta.alternates) tags.push({ tag: 'link', attrs: { rel: 'alternate', hreflang: a.hreflang, href: a.href, 'data-seo': '1' } });
  tags.push(
    m({ property: 'og:type', content: 'website' }),
    m({ property: 'og:site_name', content: meta.siteName }),
    m({ property: 'og:title', content: meta.title }),
    m({ property: 'og:description', content: meta.description }),
    m({ property: 'og:url', content: meta.canonical }),
    m({ property: 'og:image', content: meta.image }),
    m({ property: 'og:image:type', content: 'image/jpeg' }),
    m({ property: 'og:image:width', content: '1200' }),
    m({ property: 'og:image:height', content: '630' }),
    m({ property: 'og:image:alt', content: meta.imageAlt }),
    m({ property: 'og:locale', content: meta.ogLocale }),
    m({ property: 'og:locale:alternate', content: meta.ogLocaleAlt }),
    m({ name: 'twitter:card', content: 'summary_large_image' }),
    m({ name: 'twitter:title', content: meta.title }),
    m({ name: 'twitter:description', content: meta.description }),
    m({ name: 'twitter:image', content: meta.image }),
    m({ name: 'twitter:image:alt', content: meta.imageAlt }),
  );
  for (const ld of jsonLdFor(data, lang, meta)) tags.push({ tag: 'script', attrs: { type: 'application/ld+json', 'data-seo': '1' }, text: JSON.stringify(ld) });
  return tags;
}

/** Tag descriptors -> HTML string (prerender). */
export function tagsToHtml(tags) {
  return tags.map((t) => {
    const attrs = Object.entries(t.attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
    if (t.tag === 'script') return `<script ${attrs}>${t.text.replaceAll('<', '\\u003c')}</script>`;
    return `<${t.tag} ${attrs}>`;
  }).join('\n    ');
}

/** Tutorial entries with absolute URLs. */
export function tutorialEntries(data) {
  const all = [data.tutorial.index, ...data.tutorial.chapters];
  return all.map((c) => ({
    ...c,
    url: {
      it: `${data.host}/tutorial/it/${c.dirUrl ? '' : c.it}`,
      en: `${data.host}/tutorial/en/${c.dirUrl ? '' : c.en}`,
    },
    kind: c.id === 'index' ? 'course' : 'article',
  }));
}

/** sitemap.xml text. */
export function buildSitemap(data) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  const add = (urls, alt) => {
    for (const lang of LANGS) {
      out.push('  <url>', `    <loc>${esc(urls[lang])}</loc>`, `    <lastmod>${data.lastmod}</lastmod>`);
      out.push(`    <xhtml:link rel="alternate" hreflang="it" href="${esc(urls.it)}"/>`, `    <xhtml:link rel="alternate" hreflang="en" href="${esc(urls.en)}"/>`, `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(urls.it)}"/>`);
      void alt;
      out.push('  </url>');
    }
  };
  for (const pg of data.pages) add({ it: pageUrl(data, 'it', pg.path), en: pageUrl(data, 'en', pg.path) });
  for (const t of tutorialEntries(data)) add(t.url);
  out.push('</urlset>', '');
  return out.join('\n');
}
