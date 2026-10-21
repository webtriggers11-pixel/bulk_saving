/**
 * "Chrome · Android" from a User-Agent (FEAT-027, ADR-0038): the WhatsApp prompt names the
 * device that started the sign-in, so a person lured into sending someone else's message
 * reads "Signing in on Firefox · Windows" on their phone and stops. Coarse on purpose —
 * a family, not a fingerprint — and never trusted for anything but this sentence.
 */
export function describeDevice(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'a browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPod/.test(ua)
      ? 'iPhone'
      : /iPad/.test(ua)
        ? 'iPad'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
  return os ? `${browser} · ${os}` : browser;
}
