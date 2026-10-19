import type { Accent, PushPayload } from '@bulk/shared';
import { NotificationType } from '@prisma/client';

/**
 * What each round event looks like as a push (FEAT-020, ADR-0032). The BODY is the
 * message the outbox already rendered for that resident (ADR-0013 — no OTP, token or
 * phone number in it); this adds the title, where a tap goes, and the tag that collapses
 * repeats so one round never stacks five notifications.
 *
 * The title is written per event, and the icon follows the device's accent (FEAT-019),
 * so the notification arrives in the colour the person chose.
 */
const EVENT: Record<NotificationType, { title: string; url: string; urgency: 'normal' | 'high' }> = {
  [NotificationType.ROUND_JOINED]: { title: "You're in ✓", url: '/rounds', urgency: 'normal' },
  [NotificationType.ROUND_CLOSING_SOON]: { title: 'Closing soon ⏳', url: '/rounds', urgency: 'high' },
  [NotificationType.ROUND_CLOSED_MET]: { title: 'It’s going ahead 🎉', url: '/my-requests', urgency: 'high' },
  [NotificationType.ROUND_CLOSED_EXPIRED]: { title: 'Round closed', url: '/my-requests', urgency: 'normal' },
  [NotificationType.ROUND_ASSIGNED]: { title: 'Vendor confirmed 🛠️', url: '/my-requests', urgency: 'normal' },
  [NotificationType.ROUND_DELIVERED]: { title: 'Job done — how was it? ⭐', url: '/my-requests', urgency: 'normal' },
  [NotificationType.ROUND_CANCELLED]: { title: 'Round cancelled', url: '/my-requests', urgency: 'high' },
};

/** How long a push may wait for an offline device before the push service drops it. */
export const PUSH_TTL_SECONDS = 24 * 60 * 60;

export function pushFor(
  notification: { type: NotificationType; body: string; roundId: string | null },
  accent: Accent,
): { payload: PushPayload; urgency: 'normal' | 'high' } {
  const event = EVENT[notification.type];
  return {
    urgency: event.urgency,
    payload: {
      title: event.title,
      body: notification.body,
      url: event.url,
      tag: notification.roundId ? `round:${notification.roundId}` : `event:${notification.type}`,
      accent,
      icon: `/push/icon-${accent}.png`,
      badge: '/push/badge.png',
    },
  };
}
