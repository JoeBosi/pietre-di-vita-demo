import { StrictMode, useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { I18nContext, translate, type Lang, type TKey } from './i18n';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Bottle from './pages/Bottle';
import HowItWorks from './pages/HowItWorks';
import Filiera from './pages/Filiera';

function initialLang(): Lang {
  try {
    const s = localStorage.getItem('lang');
    if (s === 'it' || s === 'en') return s;
  } catch { /* storage unavailable */ }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'it';
}

function App() {
  const [lang, setL] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setL(l);
    document.documentElement.lang = l;
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (k: TKey, v?: Record<string, string | number>) => translate(lang, k, v) }), [lang, setLang]);
  return (
    <I18nContext.Provider value={value}>
      <BrowserRouter>
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
