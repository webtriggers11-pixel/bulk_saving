/**
 * FEAT-011 / ADR-0021 — semantic utilities over the token layer in
 * `src/styles/theme.css`. Colour channels are space-separated RGB so one variable
 * serves `bg-brand` and `bg-brand/20` alike; a palette swap is `data-theme` on
 * <html>, never a class change.
 *
 * Rule this config exists to enforce: no component writes a hex, an rgba() or a
 * `teal-*`/`slate-*` class. If a value is missing here, add it here.
 */

/** @param {string} v */
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: rgb('--brand'),
          deep: rgb('--brand-deep'),
          light: rgb('--brand-light'),
          ink: rgb('--brand-ink'),
        },
        ink: {
          DEFAULT: rgb('--ink'),
          muted: rgb('--ink-muted'),
          soft: rgb('--ink-soft'),
        },
        ground: {
          DEFAULT: rgb('--ground'),
          top: rgb('--ground-top'),
        },
        // States are meanings, so they do not move with the palette.
        amber: { ink: rgb('--state-amber') },
        danger: { ink: rgb('--state-red') },
        success: { ink: rgb('--state-green') },
        info: { ink: rgb('--state-blue') },
        star: rgb('--star'),
        // The tint every SHADOW is mixed from (stays dark at night).
        shade: rgb('--shadow-rgb'),
        // FEAT-016 (ADR-0028): hairlines and neutral washes — the shadow tint by day,
        // light at night; what a light surface is made of; text on a brand fill.
        line: rgb('--line'),
        paper: rgb('--paper'),
        'on-fill': rgb('--on-fill'),
        // The three ambient washes behind the glass — per palette, so the ground
        // shifts with the theme instead of staying teal under an indigo app.
        mesh: {
          1: rgb('--mesh-1'),
          2: rgb('--mesh-2'),
          3: rgb('--mesh-3'),
        },
      },
      fontFamily: {
        // FEAT-017 (ADR-0029): the family is a token, so a palette can carry its own type.
        sans: ['var(--font-sans)'],
      },
      fontSize: {
        eyebrow: ['10.5px', { lineHeight: '1.2', letterSpacing: '0.14em', fontWeight: '800' }],
        label: ['11.5px', { lineHeight: '1.2', letterSpacing: '0.09em', fontWeight: '800' }],
        micro: ['11.5px', { lineHeight: '1.4' }],
        meta: ['12.5px', { lineHeight: '1.45' }],
        caption: ['13px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.5' }],
        lead: ['15px', { lineHeight: '1.5' }],
        title: ['19px', { lineHeight: '1.22', letterSpacing: '-0.028em' }],
        headline: ['21px', { lineHeight: '1.12', letterSpacing: '-0.04em' }],
        display: ['26px', { lineHeight: '1.08', letterSpacing: '-0.035em' }],
        amount: ['34px', { lineHeight: '1', letterSpacing: '-0.05em' }],
        hero: ['48px', { lineHeight: '0.94', letterSpacing: '-0.058em' }],
      },
      borderRadius: {
        // FEAT-017 (ADR-0029): tokens, so Mono can tighten them (values in theme.css).
        chip: 'var(--radius-chip)',
        control: 'var(--radius-control)',
        inset: 'var(--radius-inset)',
        tile: 'var(--radius-tile)',
        card: 'var(--radius-card)',
        sheet: 'var(--radius-sheet)',
      },
      boxShadow: {
        hairline: '0 1px 0 rgb(255 255 255 / 0.9) inset',
        lift: '0 18px 42px -26px rgb(var(--shadow-rgb) / 0.4)',
        float: '0 24px 52px -26px rgb(var(--shadow-rgb) / 0.45)',
        deep: '0 36px 66px -30px rgb(var(--shadow-rgb) / 0.6)',
        accent:
          '0 1px 0 rgb(255 255 255 / 0.34) inset, 0 12px 26px -12px rgb(var(--shadow-rgb) / 0.9)',
        control:
          '0 1px 0 var(--edge-strong) inset, 0 10px 22px -16px rgb(var(--shadow-rgb) / 0.55)',
        field: '0 1px 2px rgb(var(--shadow-rgb) / 0.06) inset, 0 1px 0 var(--edge)',
        ring: '0 0 0 5px rgb(var(--brand) / 0.17)',
        focus: '0 0 0 4px rgb(var(--brand) / 0.28)',
        sheet: '0 -1px 0 var(--edge-strong) inset, 0 -30px 64px -30px rgb(var(--shadow-rgb) / 0.6)',
        nav: '0 1px 0 var(--edge-strong) inset, 0 -16px 38px -24px rgb(var(--shadow-rgb) / 0.55)',
        glow: '0 4px 14px -3px rgb(var(--brand) / 0.9)',
      },
      blur: {
        soft: '18px',
        glass: '26px',
        chrome: '28px',
      },
      spacing: {
        touch: '44px', // the floor every interactive element clears (AC6)
        control: '50px', // buttons
        icon: '48px', // icon buttons
        tab: '58px', // tab-bar items
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 0.8, 0.28, 1)',
        entrance: 'cubic-bezier(0.22, 0.9, 0.26, 1)',
        press: 'cubic-bezier(0.3, 0.9, 0.4, 1)',
      },
      transitionDuration: {
        press: '120ms',
        focus: '280ms',
        hover: '340ms',
        entrance: '780ms',
      },
    },
  },
  plugins: [],
};
