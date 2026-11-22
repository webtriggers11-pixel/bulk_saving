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

/** FEAT-036 (ADR-0046): a platform admin belongs to no society; say so where a society name goes. */
export const PLATFORM_ADMIN_LABEL = 'Platform admin';
export function societyLabel(society: { name: string } | null): string {
  return society ? society.name : PLATFORM_ADMIN_LABEL;
}

/** "3 min ago" (BUG-029): how long ago a resident asked. `now` is injectable for tests. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** BUG-029: an ask from the last 24 hours is marked New. */
export function isRecent(iso: string, now: number = Date.now()): boolean {
  return now - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

/** The New round form, prefilled for one society's request (FEAT-022). */
export function openRoundHref(societyId: string, serviceId: string): string {
  return `/admin/rounds/new?society=${encodeURIComponent(societyId)}&service=${encodeURIComponent(serviceId)}`;
}
