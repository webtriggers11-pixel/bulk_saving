import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'md' | 'sm' | 'icon';
type ButtonTone = 'default' | 'onAccent';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** `onAccent` for a button sitting on a brand/dark surface — see {@link TONES}. */
  tone?: ButtonTone;
}

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
  primary: 'paint-brand text-white border border-white/20 shadow-accent sweep ripple',
  secondary:
    'paint-glass text-ink border border-white/70 shadow-control sweep ripple',
  outline: 'paint-tint text-brand-ink border border-brand/30 ripple',
  ghost: 'border border-transparent text-ink-muted hover:bg-white/60',
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
const TONES: Record<ButtonTone, Partial<Record<ButtonVariant, string>>> = {
  default: {},
  onAccent: {
    secondary: 'paint-glass text-brand-ink border border-white/50 shadow-control sweep ripple',
    ghost: 'border border-white/35 bg-white/15 text-white hover:bg-white/25',
  },
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-control px-[22px] text-lead',
  sm: 'h-11 px-4 text-meta',
  icon: 'h-icon w-icon px-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', tone = 'default', className, type = 'button', ...props },
  ref,
) {
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
        SIZES[size],
        TONES[tone][variant] ?? VARIANTS[variant],
        variant !== 'link' && 'hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
});
