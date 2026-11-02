import { StrictMode, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { I18nContext, translate, type Lang, type TKey } from './i18n';
import { splitLangPath, switchLangUrl, basenameFor } from '../scripts/seo-core.mjs';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Bottle from './pages/Bottle';
import HowItWorks from './pages/HowItWorks';
import Filiera from './pages/Filiera';

// The URL decides the language: /en/... is English, everything else Italian.
const initial = splitLangPath(window.location.pathname);

function App() {
  const lang: Lang = initial.lang;
  const setLang = useCallback((l: Lang) => {
    if (l === lang) return;
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
    const { pathname, search, hash } = window.location;
    window.location.assign(switchLangUrl(pathname, search, hash, l));
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: (k: TKey, v?: Record<string, string | number>) => translate(lang, k, v) }), [lang, setLang]);
  return (
    <I18nContext.Provider value={value}>
      <BrowserRouter basename={basenameFor(lang)}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/b/:codice/:n" element={<Bottle />} />
            <Route path="/come-funziona" element={<HowItWorks />} />
            <Route path="/filiera" element={<Filiera />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
