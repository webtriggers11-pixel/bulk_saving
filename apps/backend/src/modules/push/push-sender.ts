import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';

/** DI token for the active {@link PushSender} (tests swap in a capturing fake). */
export const PUSH_SENDER = 'PUSH_SENDER';

/** One device's push endpoint and its public encryption keys. */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Thrown when the push service says the device is gone for good (HTTP 404 / 410): the
 * person uninstalled the app, cleared site data or revoked permission. The subscription
 * must be deleted, and retrying is pointless.
 */
export class PushGoneError extends Error {
  constructor(public readonly statusCode: number) {
    super(`push endpoint gone (${statusCode})`);
    this.name = 'PushGoneError';
  }
}

/**
 * Sends one encrypted payload to one device (FEAT-020, ADR-0032). Behind an interface
 * so the worker can be tested without the network, and so a server with no VAPID keys
 * runs with push switched off instead of crashing.
 */
export interface PushSender {
  /** False when VAPID is not configured: subscribing is refused, nothing is sent. */
  readonly enabled: boolean;
  readonly publicKey: string | null;
  send(target: PushTarget, payload: string, options: { ttlSeconds: number; urgency: 'normal' | 'high' }): Promise<void>;
}

/** Push services this server will POST to. Anything else is refused at subscribe time (SSRF). */
export const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  '.push.apple.com',
  '.notify.windows.com',
] as const;

/** True when `endpoint` is an https URL on one of the known push services. */
export function isKnownPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') {
    return false;
  }
  const host = url.hostname.toLowerCase();
  // Plain DNS characters only: `https://;x.push.apple.com/` parses here with a hostname the
  // older parser inside web-push reads as EMPTY (→ localhost). Refuse anything it could
  // disagree about (V2 r2 P3).
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  return PUSH_SERVICE_HOSTS.some((known) => (known.startsWith('.') ? host.endsWith(known) : host === known));
}

/** The real sender: the `web-push` library with this server's VAPID identity. */
@Injectable()
export class WebPushSender implements PushSender {
  private readonly logger = new Logger(WebPushSender.name);
  readonly enabled: boolean;
  readonly publicKey: string | null;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    this.enabled = Boolean(publicKey && privateKey && subject);
    this.publicKey = this.enabled ? publicKey! : null;
    if (this.enabled) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    } else {
      this.logger.warn('VAPID keys not configured — web push is switched off');
    }
  }

  async send(target: PushTarget, payload: string, options: { ttlSeconds: number; urgency: 'normal' | 'high' }) {
    if (!this.enabled) return;
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: options.ttlSeconds, urgency: options.urgency },
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        throw new PushGoneError(statusCode);
      }
      // The library puts the response body in the message; keep it short and endpoint-free.
      throw new Error(`push send failed${statusCode ? ` (${statusCode})` : ''}`);
    }
  }
}

/** For logs: the push service host and the last 6 characters — never the full endpoint. */
export function redactEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.hostname}/…${endpoint.slice(-6)}`;
  } catch {
    return '…';
  }
}
