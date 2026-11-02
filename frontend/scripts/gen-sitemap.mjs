// Writes public/sitemap.xml from seo-data.json. Run: node scripts/gen-sitemap.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSitemap } from './seo-core.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const data = JSON.parse(readFileSync(here('./seo-data.json'), 'utf8'));
writeFileSync(here('../public/sitemap.xml'), buildSitemap(data));
console.log('sitemap.xml written');
