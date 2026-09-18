import type { RoundStatus } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { Icon, type IconName } from '../../components/ui/icon';
import { STATUS_LABELS, STATUS_TONES } from './adminFormat';

/**
 * A round status rendered as a coloured, human-labelled badge.
 *
 * CHORE-008 gives each status its glyph, so a dashboard of twenty rounds is
 * scannable by shape as well as by colour — which is what makes it readable to an
 * operator who is colour-blind, and faster for everyone else.
 */
const STATUS_ICONS: Record<RoundStatus, IconName> = {
  OPEN: 'clock',
  CLOSED_MET: 'check',
  CLOSED_EXPIRED: 'info',
  ASSIGNED: 'users',
  DELIVERED: 'check',
  RATED: 'spark',
  CANCELLED: 'close',
};

export function StatusBadge({ status }: { status: RoundStatus }) {
  return (
    <Badge
      tone={STATUS_TONES[status]}
      icon={<Icon name={STATUS_ICONS[status]} size={13} strokeWidth={2.2} />}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
