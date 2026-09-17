import { NotificationType } from '@prisma/client';

/**
 * SMS bodies for the round lifecycle (FEAT-006, ADR-0013). Pure functions: no
 * I/O, no Nest, no Prisma access — everything they need is passed in, which is
 * what lets the outbox render a body inside the staging transaction.
 *
 * Rules enforced here (asserted by the spec tests):
 *  - a body NEVER contains an OTP, a token, or a phone number — none of those
 *    are even reachable from {@link TemplateInput};
 *  - a body stays within {@link MAX_SMS_LENGTH}, so a long service name can
 *    never produce a message the provider would split or reject.
 */

/** Hard cap on a rendered body. Long inputs are truncated, never dropped. */
export const MAX_SMS_LENGTH = 320;

/** Product name used as the message prefix, so a resident knows who is texting. */
const SENDER = 'BulkSaving';

/** Timezone every deadline is rendered in — the product is India-only (BRIEF). */
const TIMEZONE = 'Asia/Kolkata';

/** A round, reduced to what a message may mention. Deliberately has no resident data. */
export interface RoundForMessage {
  serviceName: string;
  deadline: Date;
}

/**
 * Per-type render input. A discriminated union rather than one optional-field
 * bag, so a caller physically cannot render "vendor assigned" without a vendor.
 */
export type TemplateInput =
  | {
      type: typeof NotificationType.ROUND_JOINED;
      round: RoundForMessage;
      /** The resident's own pledged units. */
      units: number;
      /** Price per unit at the round's current tier, or null before any tier is met. */
      currentPrice: number | null;
    }
  | {
      type: typeof NotificationType.ROUND_CLOSING_SOON;
      round: RoundForMessage;
      units: number;
      /** Authoritative units pledged across the round. */
      unitsCount: number;
      /** Lowest tier threshold — the target that unlocks a price. Null if the round has no tiers. */
      target: number | null;
      currentPrice: number | null;
    }
  | {
      type: typeof NotificationType.ROUND_CLOSED_MET;
      round: RoundForMessage;
      units: number;
      currentPrice: number | null;
    }
  | { type: typeof NotificationType.ROUND_CLOSED_EXPIRED; round: RoundForMessage }
  | {
      type: typeof NotificationType.ROUND_ASSIGNED;
      round: RoundForMessage;
      vendorName: string;
      /** Negotiated ₹ per unit. */
      finalPrice: number;
      units: number;
    }
  | { type: typeof NotificationType.ROUND_DELIVERED; round: RoundForMessage }
  | { type: typeof NotificationType.ROUND_CANCELLED; round: RoundForMessage };

/** `700` -> `₹700`. Integer rupees throughout (ADR-0012). */
function rupees(amount: number): string {
  return `₹${amount}`;
}

/** `2 units` / `1 unit` — units are the threshold currency, not people (CLAUDE.md). */
function units(count: number): string {
  return `${count} unit${count === 1 ? '' : 's'}`;
}

/**
 * Month names are OURS, not ICU's: `month: 'short'` is data that changes between
 * ICU versions (Node 24 renders September as "Sept", Node 20 as "Sep"), which
 * would silently reword live SMS on a runtime upgrade.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Deadline in IST, e.g. `18 Sep, 11:30 pm`. Fixed locale + timezone so the text
 * is identical on a dev laptop, in CI, and on a server in any region.
 */
export function formatDeadline(deadline: Date): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(deadline);
  const get = (t: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === t)?.value ?? '';
  const month = MONTHS[Number(get('month')) - 1] ?? get('month');
  const dayPeriod = get('dayPeriod').toLowerCase().replace(/\s/g, '');
  return `${get('day')} ${month}, ${get('hour')}:${get('minute')} ${dayPeriod}`;
}

/** Truncate to {@link MAX_SMS_LENGTH}, keeping a visible ellipsis. */
function clamp(body: string): string {
  return body.length <= MAX_SMS_LENGTH ? body : `${body.slice(0, MAX_SMS_LENGTH - 1)}…`;
}

function joined(input: Extract<TemplateInput, { type: 'ROUND_JOINED' }>): string {
  const price = input.currentPrice === null ? '' : ` at ${rupees(input.currentPrice)}/unit`;
  return (
    `${SENDER}: You're in — ${units(input.units)} of ${input.round.serviceName}${price}. ` +
    `The round closes ${formatDeadline(input.round.deadline)}. ` +
    `More neighbours joining means a lower price for everyone.`
  );
}

function closingSoon(input: Extract<TemplateInput, { type: 'ROUND_CLOSING_SOON' }>): string {
  const price = input.currentPrice === null ? '' : ` Price now ${rupees(input.currentPrice)}/unit.`;
  const gap = input.target === null ? 0 : Math.max(0, input.target - input.unitsCount);
  const progress =
    input.target === null
      ? `${units(input.unitsCount)} pledged so far.`
      : gap > 0
        ? `${input.unitsCount} of ${input.target} units pledged — ${units(gap)} to go.`
        : `${input.unitsCount} of ${input.target} units pledged — the target is met.`;
  return (
    `${SENDER}: ${input.round.serviceName} closes ${formatDeadline(input.round.deadline)}. ` +
    `${progress}${price} Invite a neighbour to unlock a better price.`
  );
}

function closedMet(input: Extract<TemplateInput, { type: 'ROUND_CLOSED_MET' }>): string {
  const price = input.currentPrice === null ? '' : ` at ${rupees(input.currentPrice)}/unit`;
  const total =
    input.currentPrice === null ? '' : ` Your ${units(input.units)}: ${rupees(input.currentPrice * input.units)}.`;
  return (
    `${SENDER}: Target reached! The ${input.round.serviceName} round closed${price}.${total} ` +
    `We're lining up a vendor and will text you the schedule.`
  );
}

function closedExpired(input: Extract<TemplateInput, { type: 'ROUND_CLOSED_EXPIRED' }>): string {
  return (
    `${SENDER}: The ${input.round.serviceName} round closed without reaching its target, ` +
    `so it won't go ahead and there's nothing to pay. We'll let you know when the next one opens.`
  );
}

function assigned(input: Extract<TemplateInput, { type: 'ROUND_ASSIGNED' }>): string {
  return (
    `${SENDER}: ${input.vendorName} is scheduled for ${input.round.serviceName}. ` +
    `Your ${units(input.units)} at ${rupees(input.finalPrice)}/unit = ` +
    `${rupees(input.finalPrice * input.units)}, payable on completion. ` +
    `We'll confirm the visit time.`
  );
}

function delivered(input: Extract<TemplateInput, { type: 'ROUND_DELIVERED' }>): string {
  return (
    `${SENDER}: Your ${input.round.serviceName} job is marked complete. ` +
    `Thanks for pooling with your society — we'll ask how it went.`
  );
}

function cancelled(input: Extract<TemplateInput, { type: 'ROUND_CANCELLED' }>): string {
  return (
    `${SENDER}: The ${input.round.serviceName} round has been cancelled and there's nothing to pay. ` +
    `Sorry for the change — we'll open a fresh round soon.`
  );
}

/**
 * Render the SMS body for a staged notification. Total function over
 * {@link NotificationType}: adding an enum member without a template is a
 * compile error, not a silently empty message.
 */
export function renderNotification(input: TemplateInput): string {
  switch (input.type) {
    case NotificationType.ROUND_JOINED:
      return clamp(joined(input));
    case NotificationType.ROUND_CLOSING_SOON:
      return clamp(closingSoon(input));
    case NotificationType.ROUND_CLOSED_MET:
      return clamp(closedMet(input));
    case NotificationType.ROUND_CLOSED_EXPIRED:
      return clamp(closedExpired(input));
    case NotificationType.ROUND_ASSIGNED:
      return clamp(assigned(input));
    case NotificationType.ROUND_DELIVERED:
      return clamp(delivered(input));
    case NotificationType.ROUND_CANCELLED:
      return clamp(cancelled(input));
  }
}
