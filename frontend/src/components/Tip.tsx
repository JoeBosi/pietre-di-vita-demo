import { Info } from './Icons';
/** Plain-language explanation of a technical word, shown on hover/tap (native title) and read by screen readers. */
export function Tip({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} role="img" tabIndex={0} className="inline-flex align-middle ml-1 text-gray-400 cursor-help [&>svg]:w-4 [&>svg]:h-4">
      <Info />
    </span>
  );
}
