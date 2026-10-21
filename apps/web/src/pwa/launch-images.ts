// FEAT-029 (ADR-0041): the iOS launch-image table, shared by the generator
// (scripts/gen-pwa-assets.mjs), index.html's <link> tags (pwa.test.ts pins them) and the asset tests. Portrait, device pixels, from Apple's
// device sizes. A size iOS doesn't match is ignored silently (a white launch), never broken.
export interface LaunchImage {
  width: number;
  height: number;
  /** CSS pixels and device-pixel ratio, for the media query iOS matches on. */
  dw: number;
  dh: number;
  ratio: number;
}

export const LAUNCH_IMAGES: readonly LaunchImage[] = [
  { width: 1320, height: 2868, dw: 440, dh: 956, ratio: 3 }, // 16 Pro Max
  { width: 1206, height: 2622, dw: 402, dh: 874, ratio: 3 }, // 16 Pro
  { width: 1290, height: 2796, dw: 430, dh: 932, ratio: 3 }, // 14 Pro Max – 16 Plus
  { width: 1179, height: 2556, dw: 393, dh: 852, ratio: 3 }, // 14 Pro – 16
  { width: 1284, height: 2778, dw: 428, dh: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { width: 1170, height: 2532, dw: 390, dh: 844, ratio: 3 }, // 12 – 14
  { width: 1125, height: 2436, dw: 375, dh: 812, ratio: 3 }, // X – 11 Pro, 12/13 mini
  { width: 828, height: 1792, dw: 414, dh: 896, ratio: 2 }, // XR, 11
  { width: 750, height: 1334, dw: 375, dh: 667, ratio: 2 }, // SE 2/3, 8
];
