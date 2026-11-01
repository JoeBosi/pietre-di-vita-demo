import type { ReactNode } from 'react';

const base = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const wrap = (children: ReactNode) => <svg {...base}>{children}</svg>;

export const Leaf = () => wrap(<><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19c3-5 6-8 10-10" /></>);
export const Mill = () => wrap(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /></>);
export const Flask = () => wrap(<><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M8 15h8" /></>);
export const Bottle = () => wrap(<><path d="M10 3h4v4l2 3v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10l2-3z" /><path d="M8 14h8" /></>);
export const Truck = () => wrap(<><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>);
export const Check = () => wrap(<path d="M5 12.5l4.5 4.5L19 7" />);
export const Alert = () => wrap(<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></>);
export const Info = () => wrap(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></>);
export const phaseIcons = [Leaf, Mill, Flask, Bottle, Truck];
