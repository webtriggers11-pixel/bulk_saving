import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Icon, type IconName } from './icon';

/**
 * An inline message attached to a form or panel — the shape that four copies of the
 * same markup were spelling out by hand across the auth and admin screens (ADR-0022:
 * a recurring shape is a primitive, and its variation is a closed prop).
 *
 * `role` follows the tone rather than being passed in: an error is an `alert` and a
 * waiting/offline message is a `status`, and getting that pair wrong is the difference
 * between a screen reader interrupting and staying silent.
 */
const NOTICE_TONE = {
  error: { surface: 'bg-danger-ink/10 text-danger-ink', icon: 'alert', role: 'alert' },
  warn: { surface: 'bg-amber-ink/15 text-amber-ink', icon: 'clock', role: 'status' },
} as const satisfies Record<string, { surface: string; icon: IconName; role: 'alert' | 'status' }>;

interface NoticeProps {
  tone: keyof typeof NOTICE_TONE;
  children: ReactNode;
  /** Placement only — margins and grid spans, never colour or type (ADR-0022). */
  className?: string;
  'data-testid'?: string;
}

export function Notice({ tone, children, className, ...rest }: NoticeProps) {
  const { surface, icon, role } = NOTICE_TONE[tone];
  return (
    <p
      role={role}
      className={cn(
        'animate-rise mt-3 flex items-center gap-2 rounded-chip border border-white/55 px-3 py-2 text-meta font-bold',
        surface,
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={15} strokeWidth={2.2} className="shrink-0" />
      {children}
    </p>
  );
}
