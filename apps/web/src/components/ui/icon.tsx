import { cn } from '../../lib/utils';

/**
 * The one icon family (FEAT-011). Before this the app mixed an emoji (🛠️ as the
 * service glyph), four hand-written nav paths and a "×" character; three styles at
 * three optical weights. These are one 24-box, one 1.8 stroke, round caps and joins.
 *
 * Stroke-only and `currentColor`, so an icon inherits its context's token — including
 * white on the accent surface — with no per-icon colour anywhere.
 */
const PATHS = {
  home: 'M3.2 10.4 12 3.4l8.8 7M5.4 9.4V19a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6V9.4M9.6 20.6v-5.4h4.8v5.4',
  services:
    'M3.2 5.6a2.4 2.4 0 0 1 2.4-2.4h2.6a2.4 2.4 0 0 1 2.4 2.4v2.6a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4zM13.4 5.6a2.4 2.4 0 0 1 2.4-2.4h2.6a2.4 2.4 0 0 1 2.4 2.4v2.6a2.4 2.4 0 0 1-2.4 2.4h-2.6a2.4 2.4 0 0 1-2.4-2.4zM3.2 15.8a2.4 2.4 0 0 1 2.4-2.4h2.6a2.4 2.4 0 0 1 2.4 2.4v2.6a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4zM13.4 15.8a2.4 2.4 0 0 1 2.4-2.4h2.6a2.4 2.4 0 0 1 2.4 2.4v2.6a2.4 2.4 0 0 1-2.4 2.4h-2.6a2.4 2.4 0 0 1-2.4-2.4z',
  requests: 'M20.8 11.3V12a8.8 8.8 0 1 1-5.2-8M8.6 11.4l3 3 9.2-9.2',
  profile:
    'M12 4.3a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8ZM4.6 20.6c1.2-3.7 3.9-5.6 7.4-5.6s6.2 1.9 7.4 5.6',
  back: 'm14.2 5.2-6.8 6.8 6.8 6.8',
  forward: 'M4.6 12h14m-5.6-5.6 5.6 5.6-5.6 5.6',
  logout: 'M9.4 20.6H5.6a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2h3.8m6.8 12.8 4.2-4.2-4.2-4.2M20.4 12H9.6',
  ac: 'M12 2.6v18.8M4.4 7.2l15.2 9.6M19.6 7.2 4.4 16.8M12 6.8 9.6 4.4M12 6.8l2.4-2.4M12 17.2l-2.4 2.4M12 17.2l2.4 2.4',
  pest: 'M8.4 6.4a3.6 3.6 0 0 1 7.2 0M6.4 12a5.6 5.6 0 0 1 11.2 0v1.4a5.6 5.6 0 0 1-11.2 0zM3.4 11.2h3M17.6 11.2h3M4 16.6h2.4M17.6 16.6H20M4.6 6.4 7 7.8M19.4 6.4 17 7.8',
  clean:
    'M12 3.2 13.7 8.6l5.3 1.7-5.3 1.7L12 17.4l-1.7-5.4L5 10.3l5.3-1.7zM18.4 15.6l.7 2.2 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z',
  paint:
    'M3.2 6.2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.6a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2zM15.2 7h3.6a2 2 0 0 1 2 2v2.2a2 2 0 0 1-2 2h-6.4M9.6 15a1.8 1.8 0 0 1 1.8-1.8h1.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8h-1.2a1.8 1.8 0 0 1-1.8-1.8z',
  service: 'M4 8.4 8.4 4l3 3-1.4 1.4 6.4 6.4 1.4-1.4 3 3L16.4 21l-3-3 1.4-1.4-6.4-6.4L7 11.6z',
  clock: 'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2ZM12 7.2V12l3.2 2',
  users:
    'M9.2 5a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM2.8 20.2c.9-3.2 3.3-5 6.4-5s5.5 1.8 6.4 5M16 5.4a3.4 3.4 0 0 1 0 6.2M17.6 15.6c2 .8 3.2 2.3 3.7 4.6',
  spark: 'M12 3.4 13.6 9l5.6 1.6L13.6 12l-1.6 5.6L10.4 12 4.8 10.6 10.4 9z',
  trend: 'M3.4 7.6 10 14.2l3.4-3.4 7.2 7.2M15.4 18h5.2v-5.2',
  plus: 'M12 5.6v12.8M5.6 12h12.8',
  minus: 'M5.6 12h12.8',
  refresh: 'M20.4 12a8.4 8.4 0 1 1-2.5-6M20.4 4.6V10h-5.4',
  offline:
    'm3.4 3.4 17.2 17.2M8.6 15.4a4.8 4.8 0 0 1 6.8 0M5 11.9a10 10 0 0 1 3.4-2.3M19 11.9a10 10 0 0 0-8.4-2.8M12 18.1a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z',
  install: 'M12 3.4v11.4M7.6 10.6l4.4 4.4 4.4-4.4M4.6 20.4h14.8',
  phone: 'M7.4 3.4h9.2a1.8 1.8 0 0 1 1.8 1.8v13.6a1.8 1.8 0 0 1-1.8 1.8H7.4a1.8 1.8 0 0 1-1.8-1.8V5.2a1.8 1.8 0 0 1 1.8-1.8ZM10.6 17.8h2.8',
  building:
    'M4.2 20.6V5.4a1.8 1.8 0 0 1 1.8-1.8h7.2a1.8 1.8 0 0 1 1.8 1.8v15.2M15 9.6h3a1.8 1.8 0 0 1 1.8 1.8v9.2M7.4 7.6h1.6M11 7.6h1.6M7.4 11.4h1.6M11 11.4h1.6M7.4 15.2h1.6M11 15.2h1.6M2.8 20.6h18.4',
  close: 'm6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6',
  check: 'm5.4 12.6 4.4 4.4 8.8-9.4',
  alert: 'M12 3.6 21 19.4H3zM12 9.8v4.4M12 16a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  info: 'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2ZM12 11v5.4M12 6.9a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  bolt: 'M13.6 2.6 4.8 13.4h6L10.4 21.4l8.8-10.8h-6z',
  search: 'M10.8 4a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6ZM20.2 20.2l-4.6-4.6',
  filter: 'M3.8 6h16.4M7 12h10M10.2 18h3.6',
  // FEAT-014 catalog glyphs: Vehicle, Utilities (water), Bulk Staples.
  car: 'M4.4 15.6V12l1.8-4.6a1.6 1.6 0 0 1 1.5-1h8.6a1.6 1.6 0 0 1 1.5 1l1.8 4.6v3.6a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1ZM4.4 12h15.2M7.4 16.6v1.8M16.6 16.6v1.8',
  water: 'M12 3.4c3.4 4.2 5.8 7.6 5.8 10.6a5.8 5.8 0 0 1-11.6 0c0-3 2.4-6.4 5.8-10.6ZM9.4 14.4a2.6 2.6 0 0 0 2.6 2.6',
  basket: 'M3.6 9.6h16.8l-1.8 9.2a1.6 1.6 0 0 1-1.6 1.2H7a1.6 1.6 0 0 1-1.6-1.2zM8.4 9.6l2.4-5.4M15.6 9.6l-2.4-5.4M9.6 13.2v3.6M14.4 13.2v3.6',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Box size in px. 24 is the system default; 13 inside a badge, 21 in the tab bar. */
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 24, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('block shrink-0', className)}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The five-pointed star, filled or outlined — the one glyph that is not a stroke path. */
export function StarGlyph({
  filled,
  size = 24,
  className,
}: {
  filled: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={cn('block', className)}
    >
      <path d="m12 3.6 2.6 5.5 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
    </svg>
  );
}
