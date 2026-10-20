import { apiRequest } from '../../lib/api';
import type { DevWaPrompt } from './useDevWhatsApp';

const ATTEMPTS = [0, 300, 600, 1200];

/**
 * DEV ONLY (FEAT-027): reached only through a dynamic `import()` behind a build-time constant
 * in `useDevWhatsApp`, so a production bundle does not contain this module at all (checked by
 * `scripts/check-dev-only.mjs`).
 */
export function devWhatsAppInbound(body: { from: string; text: string; name?: string }): Promise<{ handled: true }> {
  return apiRequest<{ handled: true }>('/dev/whatsapp/inbound', { method: 'POST', body, auth: false });
}

export function devWhatsAppTap(body: { from: string; buttonId: string }): Promise<{ handled: true }> {
  return apiRequest<{ handled: true }>('/dev/whatsapp/tap', { method: 'POST', body, auth: false });
}

/** The business's latest reply to a phone, newer than `after` if given; null when none yet. */
export async function fetchDevWhatsAppPrompt(phone: string, after: string | null): Promise<DevWaPrompt | null> {
  for (const wait of ATTEMPTS) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const found = await apiRequest<DevWaPrompt>(`/dev/whatsapp/prompt?phone=${encodeURIComponent(phone)}`, { auth: false });
      if (!after || found.at > after) return found;
    } catch {
      // nothing stashed yet
    }
  }
  return null;
}
