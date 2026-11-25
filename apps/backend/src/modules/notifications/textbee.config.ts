/**
 * TextBee SMS gateway (FEAT-046, ADR-0054): an Android phone running the TextBee app
 * sends our SMS from its own SIM. Both `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID` set =
 * the real channel is bound; neither = the stub channel (local dev, tests). A partial
 * set refuses to boot (`assertTextbeeConfigComplete`).
 */
export interface TextbeeConfig {
  apiKey: string;
  deviceId: string;
  /** Which SIM on the phone sends (TextBee's `simSlotIndex`); unset = the phone's default. */
  simSlotIndex: number | null;
  /** API root, without a trailing slash. */
  baseUrl: string;
}

export const DEFAULT_TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1';

export function textbeeConfig(env: NodeJS.ProcessEnv = process.env): TextbeeConfig | null {
  const apiKey = env.TEXTBEE_API_KEY?.trim();
  const deviceId = env.TEXTBEE_DEVICE_ID?.trim();
  if (!apiKey || !deviceId) {
    return null;
  }
  const slot = env.TEXTBEE_SIM_SLOT?.trim();
  return {
    apiKey,
    deviceId,
    simSlotIndex: slot ? Number(slot) : null,
    baseUrl: (env.TEXTBEE_BASE_URL?.trim() || DEFAULT_TEXTBEE_BASE_URL).replace(/\/+$/, ''),
  };
}
