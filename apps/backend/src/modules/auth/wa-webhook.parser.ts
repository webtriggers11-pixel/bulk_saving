/**
 * What the login flow needs from a Cloud API `messages` webhook (FEAT-027, ADR-0038), in the
 * documented shape: `entry[].changes[].value.{metadata.phone_number_id, contacts[].{wa_id,
 * profile.name}, messages[].{from, id, timestamp, type, text.body | interactive.button_reply}}`.
 * Tolerant: anything that is not a text or a button reply (statuses, reactions, media) is
 * skipped, and a malformed entry drops that entry, never the whole delivery.
 */
export type WaInboundEvent =
  | { kind: 'text'; messageId: string; from: string; profileName: string | null; text: string; phoneNumberId: string | null }
  | { kind: 'button'; messageId: string; from: string; profileName: string | null; buttonId: string; title: string; phoneNumberId: string | null };

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseWebhookEvents(body: unknown): WaInboundEvent[] {
  const root = rec(body);
  if (!root || root.object !== 'whatsapp_business_account') return [];
  const events: WaInboundEvent[] = [];
  for (const entry of arr(root.entry)) {
    for (const change of arr(rec(entry)?.changes)) {
      const c = rec(change);
      if (!c || (c.field !== undefined && c.field !== 'messages')) continue;
      const value = rec(c.value);
      if (!value) continue;
      const phoneNumberId = str(rec(value.metadata)?.phone_number_id);
      const names = new Map<string, string>();
      for (const contact of arr(value.contacts)) {
        const ct = rec(contact);
        const waId = str(ct?.wa_id);
        const name = str(rec(ct?.profile)?.name);
        if (waId && name) names.set(waId, name);
      }
      for (const message of arr(value.messages)) {
        const m = rec(message);
        const from = str(m?.from);
        const messageId = str(m?.id);
        if (!m || !from || !messageId) continue;
        const profileName = names.get(from) ?? null;
        if (m.type === 'text') {
          const text = str(rec(m.text)?.body);
          if (text) events.push({ kind: 'text', messageId, from, profileName, text, phoneNumberId });
        } else if (m.type === 'interactive') {
          const interactive = rec(m.interactive);
          const reply = rec(interactive?.button_reply);
          const buttonId = str(reply?.id);
          if (interactive?.type === 'button_reply' && buttonId) {
            events.push({ kind: 'button', messageId, from, profileName, buttonId, title: str(reply?.title) ?? '', phoneNumberId });
          }
        }
      }
    }
  }
  return events;
}
