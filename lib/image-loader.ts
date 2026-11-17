"use client";

/**
 * Static image loader: maps next/image requests to pre-generated WebP variants
 * (public/images/_w/<name>-<w>.webp, made by `npm run images`). No runtime image
 * optimizer is needed, so the deploy folder runs on any Node host without native deps.
 */
const WIDTHS = [128, 256, 384, 512, 640, 960];

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const m = src.match(/^\/images\/([^/]+)\.webp$/);
  if (!m) return src;
  const w = WIDTHS.find((x) => x >= width) ?? WIDTHS[WIDTHS.length - 1];
  return `/images/_w/${m[1]}-${w}.webp`;
}
