import { devOtpEchoEnabled } from '../auth/otp.service';

/**
 * Sign in with WhatsApp (FEAT-027, ADR-0038) — how this server talks to WhatsApp.
 *
 *  - `cloud`: all five `WHATSAPP_*` variables are set; prompts go to Meta's Cloud API and
 *    the webhook accepts signed deliveries.
 *  - `stub`: none are set and the dev echo is on (`OTP_DEV_LOG=true` + an explicit
 *    `NODE_ENV=development|test`, ADR-0037's gate): the sender logs and stashes its prompts
 *    in Redis, and the dev-only simulator plays the WhatsApp side. Never production.
 *  - `off`: the method is not offered; the start routes answer WHATSAPP_LOGIN_DISABLED.
 */
export type WhatsAppLoginMode = 'cloud' | 'stub' | 'off';

export interface WhatsAppCloudConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  /** Digits with the country code, no `+` — what `wa.me/<number>` wants. */
  businessNumber: string;
  graphVersion: string;
}

/** The Graph API version the ADR's quick check was made against (2026-10-20). */
export const DEFAULT_GRAPH_VERSION = 'v26.0';

/** The number the stub mode links to. Nobody is behind it; the simulator stands in for WhatsApp. */
export const STUB_BUSINESS_NUMBER = '910000000000';

export function whatsAppCloudConfig(env: NodeJS.ProcessEnv = process.env): WhatsAppCloudConfig | null {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const appSecret = env.WHATSAPP_APP_SECRET?.trim();
  const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.trim();
  const businessNumber = env.WHATSAPP_BUSINESS_NUMBER?.trim();
  if (!phoneNumberId || !accessToken || !appSecret || !verifyToken || !businessNumber) {
    return null;
  }
  return {
    phoneNumberId,
    accessToken,
    appSecret,
    verifyToken,
    businessNumber,
    graphVersion: env.WHATSAPP_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
  };
}

export function whatsAppLoginMode(env: NodeJS.ProcessEnv = process.env): WhatsAppLoginMode {
  if (whatsAppCloudConfig(env)) return 'cloud';
  return devOtpEchoEnabled(env) ? 'stub' : 'off';
}

/** The number the pre-filled message goes to, for the current mode (null when off). */
export function whatsAppBusinessNumber(env: NodeJS.ProcessEnv = process.env): string | null {
  const mode = whatsAppLoginMode(env);
  if (mode === 'cloud') return whatsAppCloudConfig(env)?.businessNumber ?? null;
  return mode === 'stub' ? STUB_BUSINESS_NUMBER : null;
}
