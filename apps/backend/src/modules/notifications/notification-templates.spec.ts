import { NotificationType } from '@prisma/client';
import {
  MAX_SMS_LENGTH,
  type TemplateInput,
  formatDeadline,
  renderNotification,
} from './notification-templates';

/** 18 Sep 2026, 23:30 IST — fixed so the rendered text is machine-independent. */
const DEADLINE = new Date('2026-09-18T18:00:00.000Z');
const round = { serviceName: 'AC servicing', deadline: DEADLINE };

/** One valid input per type — also the fixture the cross-cutting rules run over. */
const ALL_INPUTS: TemplateInput[] = [
  { type: NotificationType.ROUND_JOINED, round, units: 2, currentPrice: 800 },
  {
    type: NotificationType.ROUND_CLOSING_SOON,
    round,
    units: 2,
    unitsCount: 6,
    target: 10,
    currentPrice: 800,
  },
  { type: NotificationType.ROUND_CLOSED_MET, round, units: 2, currentPrice: 700 },
  { type: NotificationType.ROUND_CLOSED_EXPIRED, round },
  {
    type: NotificationType.ROUND_ASSIGNED,
    round,
    vendorName: 'CoolAir Services',
    finalPrice: 700,
    units: 2,
  },
  { type: NotificationType.ROUND_DELIVERED, round },
  { type: NotificationType.ROUND_CANCELLED, round },
];

describe('formatDeadline', () => {
  it('renders in IST regardless of the machine timezone', () => {
    // 18:00 UTC is 23:30 IST the same day.
    expect(formatDeadline(DEADLINE)).toBe('18 Sep, 11:30 pm');
  });
});

describe('renderNotification — per type', () => {
  it('ROUND_JOINED confirms the pledge, the price and the deadline', () => {
    const body = renderNotification(ALL_INPUTS[0]);
    expect(body).toContain('2 units');
    expect(body).toContain('AC servicing');
    expect(body).toContain('₹800/unit');
    expect(body).toContain('18 Sep, 11:30 pm');
  });

  it('ROUND_JOINED omits the price when no tier is met yet, and singularises 1 unit', () => {
    const body = renderNotification({
      type: NotificationType.ROUND_JOINED,
      round,
      units: 1,
      currentPrice: null,
    });
    expect(body).toContain('1 unit ');
    expect(body).not.toContain('units');
    expect(body).not.toContain('₹');
  });

  it('ROUND_CLOSING_SOON states progress, the gap to target and the deadline', () => {
    const body = renderNotification(ALL_INPUTS[1]);
    expect(body).toContain('6 of 10 units pledged');
    expect(body).toContain('4 units to go');
    expect(body).toContain('18 Sep, 11:30 pm');
  });

  it('ROUND_CLOSING_SOON says the target is met once it is reached', () => {
    const body = renderNotification({
      type: NotificationType.ROUND_CLOSING_SOON,
      round,
      units: 2,
      unitsCount: 12,
      target: 10,
      currentPrice: 700,
    });
    expect(body).toContain('the target is met');
    expect(body).not.toContain('to go');
  });

  it('ROUND_CLOSING_SOON falls back to a plain count when the round has no tiers', () => {
    const body = renderNotification({
      type: NotificationType.ROUND_CLOSING_SOON,
      round,
      units: 2,
      unitsCount: 3,
      target: null,
      currentPrice: null,
    });
    expect(body).toContain('3 units pledged so far');
    expect(body).not.toContain('NaN');
  });

  it('ROUND_CLOSED_MET gives the unlocked price and this resident’s total', () => {
    const body = renderNotification(ALL_INPUTS[2]);
    expect(body).toContain('₹700/unit');
    expect(body).toContain('₹1400');
  });

  it('ROUND_CLOSED_EXPIRED makes clear there is nothing to pay', () => {
    const body = renderNotification(ALL_INPUTS[3]);
    expect(body).toContain('nothing to pay');
    expect(body).toContain('AC servicing');
  });

  it('ROUND_ASSIGNED names the vendor and the amount due', () => {
    const body = renderNotification(ALL_INPUTS[4]);
    expect(body).toContain('CoolAir Services');
    expect(body).toContain('₹700/unit');
    expect(body).toContain('₹1400');
  });

  it('ROUND_DELIVERED reports completion', () => {
    expect(renderNotification(ALL_INPUTS[5])).toContain('complete');
  });

  it('ROUND_CANCELLED reports the cancellation and that nothing is owed', () => {
    const body = renderNotification(ALL_INPUTS[6]);
    expect(body).toContain('cancelled');
    expect(body).toContain('nothing to pay');
  });
});

describe('renderNotification — rules that hold for every type', () => {
  it('covers every NotificationType with a fixture', () => {
    expect(ALL_INPUTS.map((i) => i.type).sort()).toEqual(Object.values(NotificationType).sort());
  });

  it('names the sender and the service, and never renders an empty body', () => {
    for (const input of ALL_INPUTS) {
      const body = renderNotification(input);
      expect(body.startsWith('BulkSaving:')).toBe(true);
      expect(body).toContain('AC servicing');
      expect(body.length).toBeGreaterThan(20);
    }
  });

  it('stays within the SMS cap even with an absurdly long service name', () => {
    const longRound = { serviceName: 'A'.repeat(500), deadline: DEADLINE };
    for (const input of ALL_INPUTS) {
      const body = renderNotification({ ...input, round: longRound } as TemplateInput);
      expect(body.length).toBeLessThanOrEqual(MAX_SMS_LENGTH);
    }
  });

  it('keeps normal bodies comfortably under the cap', () => {
    for (const input of ALL_INPUTS) {
      expect(renderNotification(input).length).toBeLessThanOrEqual(MAX_SMS_LENGTH);
    }
  });

  it('never leaks a phone number, an OTP or a token — none are reachable from the input', () => {
    for (const input of ALL_INPUTS) {
      const body = renderNotification(input);
      // No 6+ digit run (an OTP or a phone number); rupee amounts here are ≤ 5 digits.
      expect(body).not.toMatch(/\d{6,}/);
      expect(body).not.toMatch(/\+\d{6,}/);
      expect(body.toLowerCase()).not.toContain('otp');
      expect(body).not.toContain('eyJ'); // a JWT prefix
    }
  });
});
