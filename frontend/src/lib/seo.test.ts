import { describe, expect, it } from 'vitest';
import sitemapFile from '../../public/sitemap.xml?raw';
import data from '../../scripts/seo-data.json';
import { basenameFor, buildSitemap, headTags, jsonLdFor, metaFor, pageUrl, splitLangPath, switchLangUrl, tutorialEntries } from '../../scripts/seo-core.mjs';

describe('language from URL', () => {
  it('detects the /en prefix', () => {
    expect(splitLangPath('/en/')).toEqual({ lang: 'en', path: '/' });
    expect(splitLangPath('/en')).toEqual({ lang: 'en', path: '/' });
    expect(splitLangPath('/en/b/25B001/1')).toEqual({ lang: 'en', path: '/b/25B001/1' });
    expect(splitLangPath('/filiera')).toEqual({ lang: 'it', path: '/filiera' });
    expect(splitLangPath('/english')).toEqual({ lang: 'it', path: '/english' });
    expect(basenameFor('en')).toBe('/en');
    expect(basenameFor('it')).toBe('');
  });
  it('language switch keeps path, query and hash', () => {
    expect(switchLangUrl('/', '', '', 'en')).toBe('/en/');
    expect(switchLangUrl('/en/', '', '', 'it')).toBe('/');
    expect(switchLangUrl('/filiera', '?a=1', '#prova', 'en')).toBe('/en/filiera?a=1#prova');
    expect(switchLangUrl('/en/b/25B001/1', '', '', 'it')).toBe('/b/25B001/1');
  });
});

describe('SEO table', () => {
  const langs = ['it', 'en'] as const;
  it('titles and descriptions are unique and within length', () => {
    const seen = new Set<string>();
    const all: { title: string; description: string }[] = [];
    for (const p of data.pages) for (const l of langs) all.push(p[l]);
    for (const c of tutorialEntries(data)) { all.push(c.itT, c.enT); }
    for (const x of all) {
      expect(x.title.length).toBeLessThanOrEqual(60);
      expect(x.description.length).toBeGreaterThanOrEqual(120);
      expect(x.description.length).toBeLessThanOrEqual(158);
      expect(seen.has(x.title)).toBe(false);
      expect(seen.has(x.description)).toBe(false);
      seen.add(x.title); seen.add(x.description);
    }
  });
  it('hreflang alternates are reciprocal and canonical is absolute', () => {
    for (const p of data.pages) {
      const it = metaFor(data, 'it', p.path); const en = metaFor(data, 'en', p.path);
      expect(it.alternates).toEqual(en.alternates);
      expect(it.canonical).toBe(it.alternates.find((a: { hreflang: string }) => a.hreflang === 'it')!.href);
      expect(en.canonical).toBe(en.alternates.find((a: { hreflang: string }) => a.hreflang === 'en')!.href);
      expect(it.canonical.startsWith('https://')).toBe(true);
    }
    expect(pageUrl(data, 'en', '/')).toMatch(/\/en\/$/);
  });
  it('trial lots are noindex, other lots are not', () => {
    expect(metaFor(data, 'it', '/b/PROVA-AB12/1').robots).toBe('noindex,follow');
    expect(metaFor(data, 'en', '/b/25B002/3').robots).toBeNull();
    expect(metaFor(data, 'en', '/b/25B002/3').title).toBe('Bottle 3 of lot 25B002 | Pietre di Vita Olive Mill');
    expect(metaFor(data, 'it', '/nope').robots).toBe('noindex,follow');
  });
  it('JSON-LD is serialisable and the sitemap lists no trial lot', () => {
    for (const p of data.pages) for (const l of langs) {
      const meta = metaFor(data, l, p.path);
      JSON.parse(JSON.stringify(jsonLdFor(data, l, meta)));
      expect(headTags(data, l, meta).some((t: { attrs: Record<string, string> }) => t.attrs.property === 'og:image:alt')).toBe(true);
    }
    const sm = buildSitemap(data);
    expect(sm).not.toContain('PROVA-');
    expect(sm).toBe(sitemapFile);
  });
});
