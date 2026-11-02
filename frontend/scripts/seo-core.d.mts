export type Lang = 'it' | 'en';
export interface SeoMeta {
  lang: Lang; path: string; kind: 'page' | 'bottle' | 'unknown'; pageId: string | null; name: string; h1: string | null; summary: string | null;
  title: string; description: string; robots: string | null; canonical: string; alternates: { hreflang: string; href: string }[];
  ogLocale: string; ogLocaleAlt: string; siteName: string; image: string; imageAlt: string;
}
export interface TagDescriptor { tag: 'meta' | 'link' | 'script'; attrs: Record<string, string>; text?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeoData = any;
export const LANGS: Lang[];
export function normPath(p: string): string;
export function splitLangPath(pathname: string): { lang: Lang; path: string };
export function basenameFor(lang: Lang): string;
export function switchLangUrl(pathname: string, search: string, hash: string, target: Lang): string;
export function pageUrl(data: SeoData, lang: Lang, path: string): string;
export function matchBottle(path: string): { codice: string; n: string } | null;
export function isTrialLot(codice: string): boolean;
export function findPage(data: SeoData, path: string): SeoData | null;
export function metaFor(data: SeoData, lang: Lang, path: string): SeoMeta;
export function jsonLdFor(data: SeoData, lang: Lang, meta: SeoMeta): unknown[];
export function headTags(data: SeoData, lang: Lang, meta: SeoMeta): TagDescriptor[];
export function tagsToHtml(tags: TagDescriptor[]): string;
export function tutorialEntries(data: SeoData): SeoData[];
export function buildSitemap(data: SeoData): string;
export function esc(s: string): string;
