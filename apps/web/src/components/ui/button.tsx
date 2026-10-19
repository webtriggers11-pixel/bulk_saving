import { forwardRef, useState, type ButtonHTMLAttributes, type PointerEvent } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'md' | 'sm' | 'icon';
type ButtonTone = 'default' | 'onAccent';

/** The variants that define an `onAccent` treatment. Only these accept `tone`. */
type AccentVariant = 'secondary' | 'ghost';

/**
 * `tone` is available only on the variants that actually define one.
 *
 * `TONES.onAccent` covers `secondary` and `ghost`, and a lookup that falls back to the
 * plain variant meant `<Button variant="primary" tone="onAccent">` type-checked,
 * rendered the ordinary primary and gave no signal at all — so the next person putting
 * a primary button on the brand surface writes the prop, sees nothing, and reaches for
 * a className, reintroducing exactly what the prop removed (V2 round 2, P3-F). The
 * union makes that a compile error instead of a silent no-op.
 */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { size?: ButtonSize } & (
    | { variant?: Exclude<ButtonVariant, AccentVariant>; tone?: never }
    | { variant: AccentVariant; tone?: ButtonTone }
  );

/**
 * The one button (FEAT-011, ADR-0021). Every variant shares one geometry — 16px
 * radius, 700 weight, the same focus ring — so two buttons doing similar jobs can
 * never look unrelated. Colour comes from tokens; nothing here knows the palette.
 *
 * Motion: `sweep` runs a specular highlight across on hover, `press` settles it to
 * .975, `ripple` blooms from the centre on tap. All three are off under
 * prefers-reduced-motion (theme.css).
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'paint-brand text-on-fill border border-on-fill/20 shadow-accent sweep ripple',
  secondary:
    'paint-glass text-ink border border-paper/70 shadow-control sweep ripple',
  outline: 'paint-tint text-brand-ink border border-brand/30 ripple',
  ghost: 'border border-transparent text-ink-muted hover:bg-paper/60',
  danger: 'paint-danger text-danger-ink border border-danger-ink/20 ripple',
  link: 'h-auto border-none px-0 text-brand-ink underline decoration-[1.5px] underline-offset-4 hover:text-brand',
};

/**
 * A button on a dark brand surface needs a different edge and label than the same
 * button on the light ground, and two call sites were hand-rolling exactly that in a
 * className — `border-white/50 text-brand-ink` and `border-white/35 bg-white/15
 * text-white`. Both were fighting the variant's own `border-white/70`, so which
 * border actually rendered came down to Tailwind's emission order (V2 P2-6 surfaced
 * these once the scan learned about border-color).
 *
 * `onAccent` is that treatment, owned in one place. It REPLACES the variant's border
 * and label colour, so a caller still has nothing to fight.
 */
const TONES: Record<ButtonTone, Record<AccentVariant, string> | Record<string, never>> = {
  default: {},
  onAccent: {
    secondary: 'paint-glass text-brand-ink border border-on-fill/50 shadow-control sweep ripple',
    ghost: 'border border-on-fill/35 bg-on-fill/15 text-on-fill hover:bg-on-fill/25',
  },
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-control px-[22px] text-lead',
  sm: 'h-11 px-4 text-meta',
  icon: 'h-icon w-icon px-0',
};

/** Where each of the eight press sparks flies (px), fixed so a render is reproducible. */
const SPARK_PATHS = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  const distance = index % 2 === 0 ? 26 : 18;
  return { dx: Math.round(Math.cos(angle) * distance), dy: Math.round(Math.sin(angle) * distance) };
});

function motionAllowed(): boolean {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * FEAT-019 (ADR-0031): a primary button throws a few sparks from where it was pressed.
 * Rendered only while they fly (~0.5s), so the button's markup at rest is unchanged; never
 * under reduced motion.
 */
function usePressSparks(enabled: boolean) {
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  function onPress(event: PointerEvent<HTMLButtonElement>) {
    if (!enabled || !motionAllowed()) return;
    const box = event.currentTarget.getBoundingClientRect();
    const burst = { id: event.timeStamp, x: event.clientX - box.left, y: event.clientY - box.top };
    setBursts((current) => [...current, burst]);
    window.setTimeout(() => setBursts((current) => current.filter((b) => b.id !== burst.id)), 600);
  }
  const sparks = bursts.map((burst) => (
    <span
      key={burst.id}
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: burst.x, top: burst.y }}
    >
      {SPARK_PATHS.map((path, index) => (
        <span
          key={index}
          className={cn(
            'animate-press-spark absolute left-0 top-0 size-1 rounded-full',
            index % 2 === 0 ? 'bg-on-fill' : 'bg-brand-2',
          )}
          style={{ ['--dx' as string]: `${path.dx}px`, ['--dy' as string]: `${path.dy}px` }}
        />
      ))}
    </span>
  ));
  return { onPress, sparks };
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', tone = 'default', className, type = 'button', children, onPointerDown, ...props },
  ref,
) {
  const { onPress, sparks } = usePressSparks(variant === 'primary');
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        // `relative overflow-hidden` is what contains the sweep and the ripple.
        'relative inline-flex items-center justify-center gap-[9px] overflow-hidden rounded-control',
        'font-bold tracking-[-0.015em] t press',
        'focus-visible:outline-none focus-visible:shadow-focus',
        'disabled:pointer-events-none disabled:opacity-40',
        // `link` brings its own geometry (`h-auto`, `px-0`) and must not also take a
        // size block: `.h-control` and `.px-[22px]` are emitted after it, so every link
        // button was rendering as a 50px-tall, 22px-padded block inside a caption
        // (V2 round 2, P2-C). A primitive can fight itself, not only its callers.
        variant !== 'link' && SIZES[size],
        (TONES[tone] as Partial<Record<ButtonVariant, string>>)[variant] ?? VARIANTS[variant],
        variant !== 'link' && 'hover:-translate-y-0.5',
        className,
      )}
      onPointerDown={(event) => {
        onPress(event);
        onPointerDown?.(event);
      }}
      {...props}
    >
      {children}
      {sparks}
    </button>
  );
});
