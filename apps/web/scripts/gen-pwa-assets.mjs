// FEAT-029 (ADR-0041): renders every PWA icon and iOS launch image from pwa-assets/mark.svg.
// Run by hand when the mark changes: `node apps/web/scripts/gen-pwa-assets.mjs`. The outputs
// are committed. `sharp` is not a dependency of this package: it is already in the lockfile
// as Astro's optional dependency (apps/site), and is resolved through Astro so no new
// dependency is added.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Node 24 strips the types from this .ts import natively.
import { LAUNCH_IMAGES } from '../src/pwa/launch-images.ts';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const astro = createRequire(join(web, '../site/package.json')).resolve('astro/package.json');
const sharp = createRequire(astro)('sharp');

const out = join(web, 'public');
const PATH = readFileSync(join(web, 'pwa-assets/mark.svg'), 'utf8').match(/d="([^"]+)"/)[1];
// The Mono look: a dark tile (push/icon-mono.png) on the light ground (theme.css --ground).
const TILE_TOP = '#0a0a0a';
const TILE_BOTTOM = '#404040';
const GROUND = '#fafafa';

/** The tile: gradient square, optional corner radius, bolt at `markScale` of the side. */
function tileSvg(size, { radius = 0, markScale = 0.5 } = {}) {
  const mark = size * markScale;
  const offset = (size - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${TILE_TOP}"/><stop offset="1" stop-color="${TILE_BOTTOM}"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${mark / 24})">
    <path d="${PATH}" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
  </g>
</svg>`;
}

/** `opaque`: no alpha channel at all (maskable, apple-touch and launch images; pwa.test.ts checks). */
async function png(svg, file, { opaque = false } = {}) {
  mkdirSync(dirname(join(out, file)), { recursive: true });
  const image = sharp(Buffer.from(svg));
  await (opaque ? image.removeAlpha() : image).png({ compressionLevel: 9 }).toFile(join(out, file));
  console.log('wrote', file);
}

// `any`: a rounded tile with transparent corners; the platform shows it as is.
for (const size of [192, 512]) await png(tileSvg(size, { radius: size * 0.22 }), `pwa-${size}x${size}.png`);
// `maskable`: full bleed, the bolt well inside the 80% safe-zone circle (the platform crops).
for (const size of [192, 512]) await png(tileSvg(size, { markScale: 0.42 }), `pwa-maskable-${size}x${size}.png`, { opaque: true });
// iOS rounds the corners itself and shows transparency as black: opaque, full bleed.
await png(tileSvg(180, { markScale: 0.52 }), 'apple-touch-icon.png', { opaque: true });
for (const size of [32, 64]) await png(tileSvg(size, { radius: size * 0.22, markScale: 0.62 }), size === 64 ? 'favicon.png' : 'favicon-32.png');
for (const name of ['rounds', 'services', 'requests']) await png(tileSvg(96, { radius: 21, markScale: 0.5 }), `shortcuts/${name}.png`);

// iOS launch images: the ground with the tile centred, at each device's exact pixel size.
for (const { width, height } of LAUNCH_IMAGES) {
  const tile = Math.round(Math.min(width, height) * 0.28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${GROUND}"/>
  <g transform="translate(${(width - tile) / 2} ${(height - tile) / 2})">${tileSvg(tile, { radius: tile * 0.22 }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
</svg>`;
  await png(svg, `splash/launch-${width}x${height}.png`, { opaque: true });
}

// The SVG favicon: same tile, scalable.
writeFileSync(join(out, 'favicon.svg'), tileSvg(64, { radius: 14, markScale: 0.62 }));
console.log('wrote favicon.svg');
