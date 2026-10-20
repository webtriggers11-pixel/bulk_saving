/**
 * AC5: the real page, rendered by Astro's container, has every section, every nav target and
 * every shipped feature. No jsdom: string assertions on the HTML.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Index from '../pages/index.astro';
import { features, sections } from '../content/features';

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

let html = '';
beforeAll(async () => {
  const container = await AstroContainer.create({ astroConfig: { site: 'https://bulksaving.example' } });
  html = decode(await container.renderToString(Index, { request: new Request('https://bulksaving.example/') }));
});

const SECTION_IDS = [...sections.map((s) => s.id), 'staples', 'not-yet'];

describe('index.astro', () => {
  it('carries the app’s html attributes', () => {
    expect(html).toMatch(/<html[^>]*data-look="vercel"/);
    expect(html).toMatch(/<html[^>]*data-theme="mono"/);
    expect(html).toMatch(/<html[^>]*data-accent="mono"/);
    expect(html).toMatch(/<html[^>]*data-scheme="light"/);
  });

  it('has a title, description, canonical and OG tags', () => {
    expect(html).toContain('<title>Bulk Saving</title>');
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/bulksaving\.example\/"/);
    expect(html).toMatch(/property="og:title"/);
  });

  it('renders every section with an id and a heading', () => {
    for (const id of SECTION_IDS) {
      expect(html, id).toMatch(new RegExp(`<section[^>]*id="${id}"`));
      expect(html, `${id}-title`).toContain(`id="${id}-title"`);
    }
  });

  it('every nav link resolves to a section, and every section has a nav link (AC5)', () => {
    const hrefs = [...html.matchAll(/<a [^>]*href="#([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(5);
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!));
    for (const h of hrefs) expect(ids.has(h), `#${h}`).toBe(true);
    const nav = html.match(/<nav class="nav__links"[\s\S]*?<\/nav>/)?.[0] ?? '';
    for (const id of SECTION_IDS) expect(nav, `nav link for #${id}`).toContain(`href="#${id}"`);
    expect(html).toMatch(/<section[^>]*id="hero"/);
  });

  it('shows every shipped feature exactly once, with its what and why', () => {
    for (const f of features) {
      const hits = html.split(`data-feature="${f.id}"`).length - 1;
      expect(hits, f.id).toBe(1);
      expect(html, f.id).toContain(f.title);
      expect(html, f.id).toContain(f.what);
      expect(html, f.id).toContain(f.why);
    }
  });

  it('marks nothing as coming soon unless the content says so', () => {
    const pills = html.split('Coming soon').length - 1;
    expect(pills).toBe(features.filter((f) => f.status === 'coming-soon').length);
  });

  it('the hero demo has the round card, the ladder and the controls', () => {
    expect(html).toContain('data-hero');
    expect(html).toContain('data-scene');
    expect(html).toContain('data-join');
    expect(html).toContain('data-invite');
    expect(html).toMatch(/data-step="0"[\s\S]*data-step="1"[\s\S]*data-step="2"/);
    expect(html).toContain('₹1,000');
    expect(html).toContain('₹700');
    // the SVG fallback is in the HTML, so the page reads without WebGL
    expect((html.match(/data-w="\d+"/g) ?? []).length).toBeGreaterThan(30);
  });

  it('has the services ticker, section reveals, and count-up tiles', () => {
    expect((html.match(/class="ticker__item"/g) ?? []).length).toBeGreaterThanOrEqual(2 * 20);
    expect((html.match(/<section class="section reveal"/g) ?? []).length).toBe(SECTION_IDS.length);
    expect((html.match(/data-count-to="/g) ?? []).length).toBe(4);
  });

  it('has the scroll story: four captions, a sticky scene with a HUD (T5c)', () => {
    expect(html).toContain('data-story');
    expect((html.match(/data-story-step/g) ?? []).length).toBe(4);
    expect(html).toContain('data-story-scene');
    for (const hud of ['data-hud-price', 'data-hud-units', 'data-hud-state', 'data-hud-fill']) expect(html).toContain(hud);
    expect(html).toMatch(/data-story-target="10"/);
  });

  it('offers all seven accents and a scheme switch', () => {
    for (const a of ['mono', 'ocean', 'aurora', 'bloom', 'sunset', 'forest', 'lagoon']) {
      expect(html).toContain(`data-set-accent="${a}"`);
    }
    expect((html.match(/data-toggle-scheme/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('every image-like element is labelled or hidden from assistive tech', () => {
    for (const svg of html.match(/<svg[^>]*>/g) ?? []) {
      expect(svg).toMatch(/aria-hidden="true"|aria-label=/);
    }
    expect(html).not.toMatch(/<img(?![^>]*alt=)/);
  });
});
