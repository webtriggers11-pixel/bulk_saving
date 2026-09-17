import type { RoundStatus } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { STATUS_LABELS, STATUS_TONES } from './adminFormat';

/** A round status rendered as a coloured, human-labelled badge. */
export function StatusBadge({ status }: { status: RoundStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
