import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { absolutiseSharePreview, SHARE_DESCRIPTION, SHARE_IMAGE } from './share-preview';

/**
 * BUG-037: link-preview scrapers (WhatsApp, Meta, Telegram…) do not run JavaScript. With no
 * description or Open Graph tags they fall back to the first text in the page — which was the
 * pre-paint theme <script>, so the invite link previewed as code.
 */
const WEB = process.cwd();
const html = readFileSync(join(WEB, 'index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const beforeFirstScript = head.slice(0, head.indexOf('<script'));
const meta = (attr: 'name' | 'property', key: string) =>
  new RegExp(`<meta ${attr}="${key.replace(':', '\\:')}" content="([^"]+)" />`).exec(beforeFirstScript)?.[1];

describe('index.html share preview (BUG-037)', () => {
  it('describes the app in plain words before any script', () => {
    expect(meta('name', 'description')).toBe(SHARE_DESCRIPTION);
    expect(meta('property', 'og:description')).toBe(SHARE_DESCRIPTION);
    expect(SHARE_DESCRIPTION).not.toMatch(/[{}();=]/);
  });

  it('names the site and title and shows the app icon, which exists', () => {
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:site_name')).toBe('Bulk Saving');
    expect(meta('property', 'og:title')).toBe('Bulk Saving');
    expect(meta('property', 'og:image')).toBe(SHARE_IMAGE);
    expect(meta('name', 'twitter:card')).toBe('summary');
    expect(existsSync(join(WEB, 'public', SHARE_IMAGE.replace(/^\//, '')))).toBe(true);
  });
});

describe('absolutiseSharePreview (BUG-037)', () => {
  it('without an origin the page is unchanged', () => {
    expect(absolutiseSharePreview(html, undefined)).toBe(html);
    expect(absolutiseSharePreview(html, '  ')).toBe(html);
  });

  it('with an origin, og:image is absolute and og:url names the site', () => {
    const out = absolutiseSharePreview(html, 'https://app.example.in/');
    expect(out).toContain(`<meta property="og:image" content="https://app.example.in${SHARE_IMAGE}" />`);
    expect(out).toContain('<meta property="og:url" content="https://app.example.in/" />');
    expect(out).not.toContain(`content="${SHARE_IMAGE}"`);
  });

  it('refuses an origin that is not http(s), so a typo cannot break the page', () => {
    expect(absolutiseSharePreview(html, 'app.example.in')).toBe(html);
    expect(absolutiseSharePreview(html, 'https://x" onload="y')).toBe(html);
  });
});
