import type { RoundStatus } from '@bulk/shared';
import type { BadgeTone } from '../../components/ui/badge';
import { ApiError } from '../../lib/api';

export { formatRupees } from '../rounds/formatPrice';

/** Human labels for every round status, in lifecycle order. */
export const STATUS_LABELS: Record<RoundStatus, string> = {
  OPEN: 'Open',
  CLOSED_MET: 'Needs vendor',
  CLOSED_EXPIRED: 'Expired',
  ASSIGNED: 'Awaiting delivery',
  DELIVERED: 'Delivered',
  RATED: 'Rated',
  CANCELLED: 'Cancelled',
};

/** Statuses in lifecycle order (for tiles and filter options). */
export const STATUS_ORDER: RoundStatus[] = [
  'OPEN',
  'CLOSED_MET',
  'CLOSED_EXPIRED',
  'ASSIGNED',
  'DELIVERED',
  'RATED',
  'CANCELLED',
];

/** Badge colour per status; the two "admin must act" statuses stand out in amber. */
export const STATUS_TONES: Record<RoundStatus, BadgeTone> = {
  OPEN: 'teal',
  CLOSED_MET: 'amber',
  CLOSED_EXPIRED: 'slate',
  ASSIGNED: 'amber',
  DELIVERED: 'green',
  RATED: 'blue',
  CANCELLED: 'red',
};

/** Format an ISO timestamp as a short local date + time, e.g. "24 Sept 2026, 5:30 pm". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** The backend message for an ApiError, else a generic fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  return fallback;
}
