import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'md' | 'sm' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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

const SIZES: Record<ButtonSize, string> = {
  md: 'h-control px-[22px] text-lead',
  sm: 'h-11 px-4 text-meta',
  icon: 'h-icon w-icon px-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
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
        VARIANTS[variant],
        variant !== 'link' && 'hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
});
