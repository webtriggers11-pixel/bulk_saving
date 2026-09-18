import { cn } from '../../lib/utils';

interface MonogramProps {
  /** Full name; the initials are derived here so two callers cannot derive them differently. */
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'data-testid'?: string;
}

const SIZES = {
  sm: 'h-[46px] w-[46px] rounded-control text-[16px]',
  md: 'h-[60px] w-[60px] rounded-inset text-[21px]',
  lg: 'h-[70px] w-[70px] rounded-card text-[24px]',
} as const;

/**
 * The avatar mark (CHORE-008, ADR-0022): initials on the brand gradient, with the
 * slow light sweeping inside it. Home and Profile each had their own copy, including
 * their own `initialsOf`.
 */
export function Monogram({ name, size = 'md', className, 'data-testid': testId }: MonogramProps) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden paint-mono font-extrabold tracking-[-0.02em] text-white shadow-accent',
        SIZES[size],
        className,
      )}
    >
      <span aria-hidden="true" className="animate-halo halo-sweep absolute -inset-1/2" />
      <span className="relative" data-testid={testId}>
        {initialsOf(name)}
      </span>
    </span>
  );
}

/** "Priya Sharma" -> "PS". A glyph rather than an empty circle when there is no name. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '·';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
