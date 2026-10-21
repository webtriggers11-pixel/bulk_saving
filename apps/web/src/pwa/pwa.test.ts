import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUND_LIGHT, MANIFEST } from './manifest';
import { LAUNCH_IMAGES } from './launch-images';
import { REGISTER_TYPE, RUNTIME_CACHING } from './config';

/**
 * FEAT-029 (ADR-0041): the installable-app contract. Every icon, launch image and shortcut
 * the manifest or index.html names must exist at its stated pixel size, the colours must
 * be the Mono ground, and the service worker may cache Google Fonts and nothing else.
 */
const WEB = process.cwd();
const PUBLIC = join(WEB, 'public');
const html = readFileSync(join(WEB, 'index.html'), 'utf8');

/** Width and height from a PNG's IHDR chunk (bytes 16–23), no image library needed. */
function pngSize(publicPath: string): { width: number; height: number } {
  const file = join(PUBLIC, publicPath.replace(/^\//, ''));
  expect(existsSync(file), `${publicPath} exists`).toBe(true);
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString('latin1'), `${publicPath} is a PNG`).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function expectSize(publicPath: string, sizes: string): void {
  const [w, h] = sizes.split('x').map(Number);
  expect(pngSize(publicPath), publicPath).toEqual({ width: w, height: h });
}

describe('PWA manifest (FEAT-029)', () => {
  it('names the app properly and has an id, scope and start url', () => {
    expect(MANIFEST.id).toBe('/');
    expect(MANIFEST.name).toBe('Bulk Saving');
    expect(MANIFEST.short_name.length).toBeLessThanOrEqual(12);
    expect(MANIFEST.short_name).not.toBe('BulkSaving');
    expect(MANIFEST.start_url).toBe('/');
    expect(MANIFEST.scope).toBe('/');
    expect(MANIFEST.display).toBe('standalone');
    expect(MANIFEST.orientation).toBe('any');
    expect(MANIFEST.display_override).toEqual(['standalone']);
    expect(MANIFEST.launch_handler).toEqual({ client_mode: 'navigate-existing' });
    expect(MANIFEST.categories.length).toBeGreaterThan(0);
  });

  it('paints the splash and title bar in the Mono light ground from theme.css', () => {
    const css = readFileSync(join(WEB, 'src/styles/theme.css'), 'utf8');
    const start = css.indexOf("[data-theme='mono'] {");
    const [, r, g, b] = /--ground:\s*(\d+) (\d+) (\d+);/.exec(css.slice(start, css.indexOf('}', start))) ?? [];
    const hex = `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    expect(GROUND_LIGHT).toBe(hex);
    expect(MANIFEST.theme_color).toBe(GROUND_LIGHT);
    expect(MANIFEST.background_color).toBe(GROUND_LIGHT);
  });

  it('ships any AND maskable icons at 192 and 512, as different files of the right size', () => {
    for (const purpose of ['any', 'maskable']) {
      const icons = MANIFEST.icons.filter((icon) => icon.purpose === purpose);
      expect(icons.map((icon) => icon.sizes).sort(), purpose).toEqual(['192x192', '512x512']);
      for (const icon of icons) expectSize(icon.src, icon.sizes);
    }
    const anySrc = MANIFEST.icons.filter((i) => i.purpose === 'any').map((i) => i.src);
    for (const icon of MANIFEST.icons.filter((i) => i.purpose === 'maskable')) {
      expect(anySrc).not.toContain(icon.src);
    }
  });

  it('the maskable icon is full bleed (no transparent corner for the platform to crop into)', () => {
    // Reading a pixel would mean inflating the PNG; the colour type says enough: the
    // generator writes maskable icons with no alpha channel at all.
    for (const icon of MANIFEST.icons.filter((i) => i.purpose === 'maskable')) {
      const bytes = readFileSync(join(PUBLIC, icon.src.slice(1)));
      expect(bytes[25], `${icon.src} colour type`).toBe(2); // 2 = RGB, no alpha
    }
  });

  it('offers three shortcuts into real routes, each with a 96px icon', () => {
    expect(MANIFEST.shortcuts.map((s) => s.url)).toEqual(['/rounds', '/services', '/my-requests']);
    const app = readFileSync(join(WEB, 'src/App.tsx'), 'utf8');
    for (const shortcut of MANIFEST.shortcuts) {
      expect(app, shortcut.url).toContain(`path="${shortcut.url}"`);
      expect(shortcut.icons).toHaveLength(1);
      expectSize(shortcut.icons[0].src, shortcut.icons[0].sizes);
    }
  });

  it('every screenshot exists at its stated size, with a narrow and a wide one', () => {
    expect(MANIFEST.screenshots.some((s) => s.form_factor === 'narrow')).toBe(true);
    expect(MANIFEST.screenshots.some((s) => s.form_factor === 'wide')).toBe(true);
    for (const shot of MANIFEST.screenshots) {
      expectSize(shot.src, shot.sizes);
      expect(shot.label.length).toBeGreaterThan(0);
    }
  });
});

describe('index.html install tags (FEAT-029)', () => {
  it('names the app on the iOS home screen and links sized icons that exist', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Bulk Saving" />');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(existsSync(join(PUBLIC, 'favicon.svg'))).toBe(true);
    for (const [, sizes, href] of html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*sizes="(\d+x\d+)" href="([^"]+)"/g)) {
      expectSize(href, sizes);
    }
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
  });

  it('the apple-touch-icon is opaque (iOS paints transparency black)', () => {
    expect(readFileSync(join(PUBLIC, 'apple-touch-icon.png'))[25]).toBe(2);
  });

  it('links one launch image per table row, at the exact device pixels its media query matches', () => {
    const links = [...html.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)" media="([^"]+)" \/>/g)];
    expect(links).toHaveLength(LAUNCH_IMAGES.length);
    for (const image of LAUNCH_IMAGES) {
      const href = `/splash/launch-${image.width}x${image.height}.png`;
      const link = links.find(([, h]) => h === href);
      expect(link, href).toBeDefined();
      expect(link?.[2]).toBe(
        `(device-width: ${image.dw}px) and (device-height: ${image.dh}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)`,
      );
      expect(image.dw * image.ratio).toBe(image.width);
      expect(image.dh * image.ratio).toBe(image.height);
      expectSize(href, `${image.width}x${image.height}`);
    }
  });
});

describe('service worker runtime caching (FEAT-029, ADR-0015 stands)', () => {
  const matches = (url: string) =>
    RUNTIME_CACHING.filter((rule) =>
      typeof rule.urlPattern === 'function'
        ? rule.urlPattern({ url: new URL(url), request: new Request(url), event: new Event('fetch') as never, sameOrigin: false })
        : false,
    ).map((rule) => rule.options?.cacheName);

  it('caches the two Google Fonts hosts', () => {
    expect(matches('https://fonts.googleapis.com/css2?family=Geist')).toEqual(['google-fonts-css']);
    expect(matches('https://fonts.gstatic.com/s/geist/v1/a.woff2')).toEqual(['google-fonts-files']);
  });

  it('caches no API response, same-origin or not', () => {
    for (const url of [
      'http://localhost:3000/rounds',
      'https://api.bulksaving.in/me',
      'http://localhost:5173/api/rounds',
      'https://fonts.googleapis.com.evil.test/css',
    ]) {
      expect(matches(url), url).toEqual([]);
    }
    expect(RUNTIME_CACHING.every((rule) => typeof rule.urlPattern === 'function')).toBe(true);
  });
});

describe('service worker updates (BUG-025)', () => {
  it("waits for the resident: 'prompt', so UpdatePrompt's Reload is what activates a new build", () => {
    // 'autoUpdate' makes the worker skipWaiting + clientsClaim and the client reload the page
    // on activation; needRefresh never fires, and a half-filled form is lost on every deploy.
    expect(REGISTER_TYPE).toBe('prompt');
  });
});
