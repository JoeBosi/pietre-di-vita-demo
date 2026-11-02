import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useI18n } from '../i18n';

const flagUK = (
  <svg width="24" height="16" viewBox="0 0 60 40" aria-hidden="true" className="rounded-sm border border-gray-300">
    <rect width="60" height="40" fill="#012169" /><path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" /><path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
    <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" /><path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="8" />
  </svg>
);
const flagIT = (
  <svg width="24" height="16" viewBox="0 0 3 2" aria-hidden="true" className="rounded-sm border border-gray-300">
    <rect width="1" height="2" fill="#009246" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#ce2b37" />
  </svg>
);
const logo = (
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="12.6" y="1.5" width="6.8" height="4" rx="1.2" fill="#2a3913"/><path d="M13.6 5.5h4.8v4.2c0 1.6 4.1 3.2 4.1 7.8V28a2.6 2.6 0 0 1-2.6 2.6h-7.8A2.6 2.6 0 0 1 9.5 28V17.5c0-4.6 4.1-6.2 4.1-7.8z" fill="#c9a82e" stroke="#4c6422" stroke-width="1.2"/><rect x="10.8" y="17.5" width="10.4" height="9" rx="1.2" fill="#f4f7ec"/><path d="M12.6 24.4c2.2-4.4 5.6-5 7.6-3.2-1.7 3.7-5 4.6-7.6 3.2z" fill="#5f7a2a"/><circle cx="19.3" cy="24" r="1.7" fill="#2a3913"/></svg>
);

export function Layout() {
  const { lang, setLang, t } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex-1 min-w-0 sm:flex-none text-center px-2 sm:px-3 py-2 min-h-11 flex items-center justify-center rounded-lg leading-tight text-[0.95rem] sm:text-base transition-colors ${isActive ? 'font-semibold text-white bg-olive-700' : 'text-olive-900 hover:bg-olive-100'}`;
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-40"><div className="bg-slate-900 px-3 py-1 text-center text-xs sm:text-sm sm:px-4 sm:py-2 font-semibold leading-snug text-white" role="note"><span className="mr-2 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-900">{t('concept.tag')}</span><span className="sm:hidden">{t('concept.short')}</span><span className="hidden sm:inline">{t('concept.banner')}</span></div>
      <header className="border-b border-olive-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-1.5 sm:py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-y-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-olive-800 text-lg sm:text-xl mr-auto min-h-11">{logo}<span>{t('brand')}</span></Link>
          <button type="button" aria-label={t('lang.aria')} onClick={() => setLang(lang === 'it' ? 'en' : 'it')} className="order-2 sm:order-3 inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 min-h-11 text-base font-medium bg-white">
            {lang === 'it' ? flagUK : flagIT}<span>{t('lang.switch')}</span>
          </button>
          <nav aria-label={t('nav.menu')} className="order-3 sm:order-2 w-full sm:w-auto flex gap-1">
            <NavLink to="/" end className={link}>{t('nav.home')}</NavLink>
            <NavLink to="/come-funziona" className={link}>{t('nav.how')}</NavLink>
            <NavLink to="/filiera" className={link}>{t('nav.filiera')}</NavLink>
          </nav>
        </div>
      </header></div>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-10"><Outlet /></main>
      <footer className="border-t border-olive-100 bg-white text-sm text-gray-700">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <p className="text-xs text-gray-600">{t('foot.sig')}</p>
          <p><a className="text-olive-700 underline" href="https://www.giuseppebosi.com">{t('foot.site')}</a></p>
        </div>
      </footer>
    </div>
  );
}
