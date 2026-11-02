import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import data from '../../scripts/seo-data.json';
import { headTags, metaFor } from '../../scripts/seo-core.mjs';

/** Keeps title, description, canonical, hreflang, og/twitter, robots, JSON-LD and <html lang> in sync with the current route. */
export function Seo() {
  const { lang } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaFor(data, lang, pathname);
    document.documentElement.lang = lang;
    document.title = meta.title;
    document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
    for (const d of headTags(data, lang, meta)) {
      const el = document.createElement(d.tag);
      for (const [k, v] of Object.entries(d.attrs)) el.setAttribute(k, v);
      if (d.text) el.textContent = d.text;
      document.head.appendChild(el);
    }
  }, [lang, pathname]);
  return null;
}
