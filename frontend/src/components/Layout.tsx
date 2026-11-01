import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n';

const flagUK = (
  <svg width="22" height="15" viewBox="0 0 60 40" aria-hidden="true" className="rounded-sm border border-gray-300">
    <rect width="60" height="40" fill="#012169" /><path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" /><path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
    <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" /><path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="8" />
  </svg>
);
const flagIT = (
  <svg width="22" height="15" viewBox="0 0 3 2" aria-hidden="true" className="rounded-sm border border-gray-300">
    <rect width="1" height="2" fill="#009246" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#ce2b37" />
  </svg>
);

export function Layout() {
  const { lang, setLang, t } = useI18n();
  const link = ({ isActive }: { isActive: boolean }) => `px-2 py-1 rounded whitespace-nowrap ${isActive ? 'font-semibold text-olive-800 bg-olive-100' : 'text-gray-700'}`;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-olive-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/" className="font-bold text-olive-700 text-xl mr-auto">Pietre di Vita</Link>
          <nav className="flex flex-wrap gap-1 text-base">
            <NavLink to="/" end className={link}>{t('nav.home')}</NavLink>
            <NavLink to="/come-funziona" className={link}>{t('nav.how')}</NavLink>
            <NavLink to="/filiera" className={link}>{t('nav.filiera')}</NavLink>
          </nav>
          <button type="button" onClick={() => setLang(lang === 'it' ? 'en' : 'it')} className="inline-flex items-center gap-2 border border-gray-300 rounded px-2 py-1 text-sm">
            {lang === 'it' ? flagUK : flagIT}<span>{t('lang.switch')}</span>
          </button>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6"><Outlet /></main>
      <footer className="border-t border-olive-100 bg-white text-sm text-gray-600">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-2">
          <p>{t('disc.text')}</p>
          <p>{t('foot.sig')}</p>
          <p><a className="text-olive-700 underline" href="https://www.giuseppebosi.com">{t('foot.site')}</a></p>
        </div>
      </footer>
    </div>
  );
}
