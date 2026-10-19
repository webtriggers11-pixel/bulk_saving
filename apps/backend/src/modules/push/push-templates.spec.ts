import { ACCENTS } from '@bulk/shared';
import { NotificationType } from '@prisma/client';
import { pushFor } from './push-templates';

describe('pushFor (FEAT-020)', () => {
  it.each(Object.values(NotificationType))('%s has its own title, an in-app link and the outbox body', (type) => {
    const { payload, urgency } = pushFor({ type, body: 'Your AC Servicing round is going ahead.', roundId: 'r1' }, 'ocean');
    expect(payload.title.length).toBeGreaterThan(0);
    expect(payload.url).toMatch(/^\/[a-z-]+$/);
    expect(payload.body).toBe('Your AC Servicing round is going ahead.');
    expect(payload.tag).toBe('round:r1');
    expect(['normal', 'high']).toContain(urgency);
  });

  it('titles differ per event — a closing reminder does not read like a cancellation', () => {
    const titles = Object.values(NotificationType).map((type) => pushFor({ type, body: '', roundId: null }, 'mono').payload.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(ACCENTS)('styles the icon in the device accent (%s)', (accent) => {
    const { payload } = pushFor({ type: NotificationType.ROUND_JOINED, body: '', roundId: null }, accent);
    expect(payload.accent).toBe(accent);
    expect(payload.icon).toBe(`/push/icon-${accent}.png`);
  });
});
