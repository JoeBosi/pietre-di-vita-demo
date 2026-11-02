import { useI18n } from '../i18n';

/** Simple inline illustration: olive grove with warm sky and an extra virgin olive oil bottle. */
export function OliveScene() {
  const { t } = useI18n();
  const tree = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-3 0 C-2 -14 -4 -22 -1 -30 L3 -30 C1 -22 3 -14 3 0z" fill="#6b4f2a" />
      <ellipse cx="0" cy="-38" rx="17" ry="13" fill="#7a9a3a" />
      <ellipse cx="-9" cy="-33" rx="10" ry="8" fill="#5f7a2a" />
      <ellipse cx="9" cy="-34" rx="10" ry="8" fill="#8aa845" />
      <circle cx="-6" cy="-40" r="1.8" fill="#2a3913" /><circle cx="7" cy="-36" r="1.8" fill="#2a3913" /><circle cx="1" cy="-31" r="1.8" fill="#2a3913" />
    </g>
  );
  return (
    <svg viewBox="0 0 360 150" role="img" aria-label={t('home.scene')} className="w-full h-auto rounded-xl">
      <rect width="360" height="150" fill="#fdf1d0" />
      <circle cx="298" cy="30" r="16" fill="#f6c453" />
      <path d="M0 98 C60 78 120 90 190 84 C250 78 310 88 360 80 L360 150 L0 150z" fill="#b9c77a" />
      <path d="M0 118 C70 100 130 112 200 106 C260 100 320 110 360 102 L360 150 L0 150z" fill="#8aa845" />
      <path d="M0 136 C80 124 160 134 240 128 C300 124 340 130 360 126 L360 150 L0 150z" fill="#5f7a2a" />
      {tree(40, 122, 0.95)}{tree(92, 112, 0.8)}{tree(145, 124, 1)}
      <g transform="translate(250 14)">
        <rect x="31" y="0" width="18" height="12" rx="3" fill="#2a3913" />
        <path d="M34 12h12v14c0 5 18 8 18 26v66a7 7 0 0 1-7 7H23a7 7 0 0 1-7-7V52c0-18 18-21 18-26z" fill="#c9a82e" stroke="#4c6422" strokeWidth="3" />
        <rect x="21" y="66" width="38" height="40" rx="4" fill="#f4f7ec" />
        <path d="M27 96c8-16 20-18 27-11-6 13-18 16-27 11z" fill="#5f7a2a" />
        <circle cx="49" cy="93" r="5" fill="#2a3913" />
      </g>
    </svg>
  );
}
