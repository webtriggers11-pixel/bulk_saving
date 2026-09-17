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
 *    never produce a message the provider would split or reject;
 *  - a body promises only what the system actually sends. There is no scheduling
 *    message, no "a new round opened" broadcast and no rating request in v1, so
 *    no template may imply one (V2 P1-3).
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
      /** The next threshold that would unlock a better price, or null if none is left. */
      nextTier: { threshold: number; price: number } | null;
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
  const deadline = formatDeadline(input.round.deadline);
  const gap = input.target === null ? 0 : Math.max(0, input.target - input.unitsCount);

  // Progress: once the target is met the "x of y" fraction is nonsense (an
  // over-subscribed round would read "12 of 5"), so it is dropped.
  let progress: string;
  if (input.target === null) {
    progress = `${units(input.unitsCount)} pledged so far.`;
  } else if (gap > 0) {
    progress =
      `${input.unitsCount} of ${input.target} units pledged — ${units(gap)} to go. ` +
      `If the round doesn't reach ${input.target} units by then, it won't go ahead.`;
  } else {
    const price = input.currentPrice === null ? '' : ` at ${rupees(input.currentPrice)}/unit`;
    progress = `${units(input.unitsCount)} pledged — the target is met${price}.`;
  }

  // Only ask for more neighbours when there is actually a better price to unlock.
  const invite = input.nextTier
    ? ` ${units(Math.max(1, input.nextTier.threshold - input.unitsCount))} more unlock ` +
      `${rupees(input.nextTier.price)}/unit — invite a neighbour.`
    : '';

  return `${SENDER}: ${input.round.serviceName} closes ${deadline}. ${progress}${invite}`;
}

function closedMet(input: Extract<TemplateInput, { type: 'ROUND_CLOSED_MET' }>): string {
  // The tier price is INDICATIVE: the amount actually owed is the admin's
  // negotiated finalPrice, quoted in the ROUND_ASSIGNED message. Saying so here
  // stops the two SMS contradicting each other (V2 P1-2).
  const indicative =
    input.currentPrice === null
      ? ''
      : ` At today's ${rupees(input.currentPrice)}/unit that's about ` +
        `${rupees(input.currentPrice * input.units)} for your ${units(input.units)} — ` +
        `we'll confirm the final amount when a vendor is assigned.`;
  return (
    `${SENDER}: Target reached! The ${input.round.serviceName} round has closed.${indicative} ` +
    `We'll text you when a vendor is assigned.`
  );
}

function closedExpired(input: Extract<TemplateInput, { type: 'ROUND_CLOSED_EXPIRED' }>): string {
  return (
    `${SENDER}: The ${input.round.serviceName} round closed without reaching its target, ` +
    `so it won't go ahead and there's nothing to pay.`
  );
}

function assigned(input: Extract<TemplateInput, { type: 'ROUND_ASSIGNED' }>): string {
  return (
    `${SENDER}: ${input.vendorName} is scheduled for ${input.round.serviceName}. ` +
    `Your ${units(input.units)} at ${rupees(input.finalPrice)}/unit = ` +
    `${rupees(input.finalPrice * input.units)}, payable to the vendor on completion.`
  );
}

function delivered(input: Extract<TemplateInput, { type: 'ROUND_DELIVERED' }>): string {
  return (
    `${SENDER}: Your ${input.round.serviceName} job is marked complete. ` +
    `Thanks for pooling with your society.`
  );
}

function cancelled(input: Extract<TemplateInput, { type: 'ROUND_CANCELLED' }>): string {
  return (
    `${SENDER}: The ${input.round.serviceName} round has been cancelled and there's nothing to pay. ` +
    `Sorry for the change.`
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
