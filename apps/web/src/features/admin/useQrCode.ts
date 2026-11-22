import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * A QR code for `text` as an SVG data URL (FEAT-032, ADR-0043 §5), or null while it renders.
 * SVG, not a canvas PNG: it needs no canvas (so it also renders under jsdom), and it stays
 * sharp at any print size. Error correction "M" survives a poster that is creased or glared.
 */
export function useQrCode(text: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
      .then((svg) => {
        if (live) setUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (live) setUrl(null);
      });
    return () => {
      live = false;
    };
  }, [text]);
  return url;
}
