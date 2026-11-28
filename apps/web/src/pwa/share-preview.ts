import type { Plugin } from 'vite';

/**
 * BUG-037: what a shared link looks like in WhatsApp, Telegram, iMessage… Scrapers do not run
 * JavaScript, so index.html carries these as static tags (share-preview.test.ts keeps them in
 * step). The words must stay free of code: they are the whole preview.
 */
export const SHARE_DESCRIPTION =
  'Book home services together with your neighbours. The more homes join a round, the less everyone pays.';

/** The 512px app icon (ADR-0041), already in public/. */
export const SHARE_IMAGE = '/pwa-512x512.png';

/**
 * Some scrapers (WhatsApp among them) ignore a relative og:image. Given the site's public origin
 * at build time, make the image absolute and add og:url. Anything that is not a plain http(s)
 * origin leaves the page as it is.
 */
export function absolutiseSharePreview(html: string, origin: string | undefined): string {
  const trimmed = origin?.trim().replace(/\/+$/, '');
  if (!trimmed || !/^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(trimmed)) return html;
  const imageTag = `<meta property="og:image" content="${SHARE_IMAGE}" />`;
  return html.replace(
    imageTag,
    `<meta property="og:url" content="${trimmed}/" />\n    <meta property="og:image" content="${trimmed}${SHARE_IMAGE}" />`,
  );
}

/** Vite hook: reads `VITE_PUBLIC_ORIGIN` from the build's env. */
export function sharePreviewPlugin(origin: string | undefined): Plugin {
  return { name: 'bulk-share-preview', transformIndexHtml: (html) => absolutiseSharePreview(html, origin) };
}
