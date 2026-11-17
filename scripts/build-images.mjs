/**
 * Pre-generates responsive WebP variants of public/images/*.webp so the site needs
 * no runtime image optimizer (no native `sharp` on the host → deployable anywhere).
 * Output: public/images/_w/<name>-<width>.webp   Run: npm run images
 */
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const WIDTHS = [128, 256, 384, 512, 640, 960];
const src = "public/images";
const out = path.join(src, "_w");
mkdirSync(out, { recursive: true });

for (const file of readdirSync(src).filter((f) => f.endsWith(".webp"))) {
  const name = file.replace(/\.webp$/, "");
  const img = sharp(path.join(src, file));
  const { width } = await img.metadata();
  for (const w of WIDTHS) {
    const target = Math.min(w, width);
    await sharp(path.join(src, file))
      .resize({ width: target })
      .webp({ quality: 72, alphaQuality: 85, effort: 6, smartSubsample: true })
      .toFile(path.join(out, `${name}-${w}.webp`));
  }
  console.log(`✓ ${file} (${width}px) → ${WIDTHS.join(", ")}`);
}
