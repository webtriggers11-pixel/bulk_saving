/**
 * Provider-agnostic notification channel (ARCHITECTURE.md · ADR-0007).
 * v1 ships a stub SMS adapter; a real SMS/WhatsApp provider swaps in behind
 * this interface with no caller changes.
 */
export interface NotificationChannel {
  /** Deliver a one-time passcode to a phone number. */
  sendOtp(phone: string, code: string): Promise<void>;
  /** Deliver a generic message to a recipient. */
  send(to: string, message: string): Promise<void>;
}

/** DI token for the active {@link NotificationChannel}. */
export const NOTIFICATION_CHANNEL = 'NOTIFICATION_CHANNEL';

/**
 * Redact a phone number for logging — keep only the last 4 digits.
 * e.g. `+919812345678` -> `+91XXXXXX5678`. Never logs the full number.
 */
export function redactPhone(phone: string): string {
  if (phone.length <= 4) {
    return phone;
  }
  const head = phone.startsWith('+') ? '+' : '';
  const last4 = phone.slice(-4);
  const maskCount = Math.max(phone.length - head.length - last4.length, 0);
  return `${head}${'X'.repeat(maskCount)}${last4}`;
}

/** How the code appears in the SMS: `482-913` for 6 digits, as-is otherwise. */
export function shownOtp(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

/** Masks the code — bare and as shown in the SMS — in an error text before it is logged. */
export function maskOtp(text: string, code: string): string {
  return text.split(shownOtp(code)).join('******').split(code).join('******');
}
