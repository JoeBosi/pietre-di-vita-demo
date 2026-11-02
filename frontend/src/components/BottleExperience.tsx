import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { apiUrl } from '../lib/api';

const TXT = {
  it: { mill1: 'Frantoio', mill2: 'Pietre di Vita', evoo: 'Olio extravergine di oliva', lot: 'Lotto 25B001', bottle: 'Bottiglia 1 di 240', harvest: 'Raccolta 2025 · Toscana' },
  en: { mill1: 'Pietre di Vita', mill2: 'Olive Mill', evoo: 'Extra virgin olive oil', lot: 'Lot 25B001', bottle: 'Bottle 1 of 240', harvest: 'Harvest 2025 · Tuscany' },
} as const;

/** The real experience: an olive oil bottle whose label carries the real QR of the sample bottle. Tap it, or scan it. */
export function BottleExperience() {
  const { t, lang } = useI18n();
  const x = TXT[lang];
  return (
    <div className="rounded-2xl border border-olive-200 bg-white p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
      <Link to="/b/25B001/1" aria-label={t('home.bottleAria')} className="shrink-0 block w-64 sm:w-72 focus:outline-none focus-visible:ring-4 focus-visible:ring-olive-600 rounded-2xl">
        <svg viewBox="0 0 240 420" role="img" aria-label={t('home.bottleAria')} className="w-full h-auto">
          <rect x="94" y="4" width="52" height="30" rx="6" fill="#2a3913" />
          <rect x="88" y="26" width="64" height="10" rx="3" fill="#3b4f1b" />
          <path d="M98 36h44v52c0 22 58 34 58 92v198a24 24 0 0 1-24 24H64a24 24 0 0 1-24-24V180c0-58 58-70 58-92z" fill="#c9a82e" stroke="#4c6422" strokeWidth="4" />
          <path d="M104 44v46c0 14-30 24-44 54" fill="none" stroke="#f3e29a" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
          <rect x="52" y="150" width="136" height="236" rx="10" fill="#fbf6e4" stroke="#4c6422" strokeWidth="2.5" />
          <text x="120" y="170" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="14" fontWeight="700" fill="#2a3913">{x.mill1}</text>
          <text x="120" y="187" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="14" fontWeight="700" fill="#2a3913">{x.mill2}</text>
          <path d="M96 196c8-6 16-6 24 0 8-6 16-6 24 0" fill="none" stroke="#5f7a2a" strokeWidth="2" />
          <text x="120" y="211" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9.5" fontStyle="italic" fill="#3b4f1b">{x.evoo}</text>
          <rect x="68" y="219" width="104" height="104" rx="4" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
          <image href={apiUrl('/api/qr/25B001/1.png')} x="72" y="223" width="96" height="96" preserveAspectRatio="xMidYMid meet" style={{ imageRendering: 'pixelated' }} />
          <text x="120" y="341" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700" fill="#111111">{x.lot}</text>
          <text x="120" y="357" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="11" fill="#2a3913">{x.bottle}</text>
          <text x="120" y="375" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#4c6422">{x.harvest}</text>
        </svg>
      </Link>
      <div className="space-y-3 text-center sm:text-left">
        <h2 className="text-2xl font-semibold text-olive-900 leading-snug">{t('home.scan')}</h2>
        <p className="text-lg text-gray-800">{t('home.scanTap')}</p>
        <Link to="/b/25B003/1" className="inline-flex items-center min-h-11 text-red-800 font-medium underline underline-offset-2">{t('home.recd')}</Link>
      </div>
    </div>
  );
}
