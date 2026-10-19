/**
 * The ground every screen sits on (CHORE-008, ADR-0022): three slowly drifting
 * washes and a grain layer, fixed and inert.
 *
 * Decoration only — `aria-hidden`, `pointer-events-none`, and every animation in it
 * stops under prefers-reduced-motion (theme.css). Fixed rather than per-screen so the
 * blur is composited once and scrolling moves the content across the light rather
 * than dragging the light with it.
 *
 * `ambient-ground` is the hook Mono uses to swap the washes for a grid (ADR-0029).
 *
 * `id` exists because two of these on one page would collide on the SVG filter id.
 */
export function AmbientGround({ id = 'app-grain' }: { id?: string }) {
  return (
    <div aria-hidden="true" className="ambient-ground pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="animate-drift-a absolute -left-24 -top-28 h-72 w-72 rounded-full bg-mesh-1/55 blur-[46px]" />
      <div className="animate-drift-b absolute -right-28 top-44 h-80 w-80 rounded-full bg-mesh-2/45 blur-[46px]" />
      <div className="animate-drift-c absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-mesh-3/40 blur-[46px]" />
      {/* Film grain: what stops large flat washes from banding on OLED phones. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.055] mix-blend-overlay">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} opacity="0.55" />
      </svg>
    </div>
  );
}
