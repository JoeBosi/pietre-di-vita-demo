import { useI18n } from '../i18n';

const NODES = ['1', '2', '3', '4', '5'] as const;

/** Inline SVG flow: grove -> mill -> lab -> bottle with QR -> you verify. Vertical, readable at 390 px. */
export function FlowDiagram() {
  const { t } = useI18n();
  const h = 52, gap = 24;
  const total = NODES.length * h + (NODES.length - 1) * gap;
  return (
    <svg viewBox={`0 0 340 ${total}`} role="img" aria-label={t('home.flowaria')} className="mx-auto h-auto w-full max-w-sm">
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#4c6422" /></marker>
      </defs>
      {NODES.map((k, i) => {
        const y = i * (h + gap);
        const last = i === NODES.length - 1;
        return (
          <g key={k}>
            <rect x="2" y={y} width="336" height={h} rx="14" fill={last ? '#d3dfb0' : '#f4f7ec'} stroke="#5f7a2a" strokeWidth="2" />
            <text x="170" y={y + 22} textAnchor="middle" fontSize="17" fontWeight="700" fill="#2a3913">{t(`flow.${k}`)}</text>
            <text x="170" y={y + 41} textAnchor="middle" fontSize="13" fill="#3b4f1b">{t(`flow.${k}s`)}</text>
            {!last && <line x1="170" y1={y + h + 2} x2="170" y2={y + h + gap - 3} stroke="#4c6422" strokeWidth="2.5" markerEnd="url(#flow-arrow)" />}
          </g>
        );
      })}
    </svg>
  );
}
