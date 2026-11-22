import { describe, expect, it } from 'vitest';
import { invitationMessage, joinLink, spacedCode, whatsappShareHref } from './invitation';

describe('invitation (FEAT-032)', () => {
  it('joinLink: origin + /onboard?code=, no doubled slash', () => {
    expect(joinLink('https://app.example.in', 'AB23CD45')).toBe('https://app.example.in/onboard?code=AB23CD45');
    expect(joinLink('http://localhost:5173/', 'AB23CD45')).toBe('http://localhost:5173/onboard?code=AB23CD45');
  });

  it('the message names the society and carries the link and the code', () => {
    const message = invitationMessage('Lakeview', 'AB23CD45', 'https://x/onboard?code=AB23CD45');
    expect(message).toContain('Lakeview');
    expect(message).toContain('https://x/onboard?code=AB23CD45');
    expect(message).toContain('AB23CD45');
  });

  it('whatsappShareHref encodes the whole message, newlines included', () => {
    const href = whatsappShareHref('Hi & welcome\nJoin: https://x/onboard?code=AB');
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href.slice('https://wa.me/?text='.length))).toBe('Hi & welcome\nJoin: https://x/onboard?code=AB');
  });

  it('spacedCode groups an 8-character code as 4 + 4', () => {
    expect(spacedCode('AB23CD45')).toBe('AB23 CD45');
    expect(spacedCode('SHORT')).toBe('SHORT');
  });
});
