import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "client", "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");
const SOURCE_PRIMARY = path.join(PUBLIC_DIR, "nrcs-logo-source.png");
const SOURCE_FALLBACK = path.join(PUBLIC_DIR, "nrcs-logo.png");

const ANY_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

async function readSourceBuffer() {
  for (const p of [SOURCE_PRIMARY, SOURCE_FALLBACK]) {
    try {
      return await fs.readFile(p);
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `Missing logo source. Add ${path.relative(ROOT_DIR, SOURCE_PRIMARY)} (or nrcs-logo.png as fallback).`
  );
}

/** Purpose "any": logo centered on white square. */
async function renderAnyPng(source, size) {
  return sharp(source)
    .resize(size, size, {
      fit: "contain",
      position: "center",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
}

/**
 * Favicons: outer ring text needs as many pixels as possible. The source is a square
 * JPG with white margins; `contain` alone scales the whole canvas so the seal is
 * tiny. Trim near-white padding first so the circular mark fills the bitmap, then
 * scale to `size` (still physics-limited at 16px, but much better than before).
 */
async function renderFaviconPng(source, size) {
  const trimmed = await sharp(source)
    .trim({ threshold: 28 })
    .toBuffer();

  return sharp(trimmed)
    .resize(size, size, {
      fit: "contain",
      position: "center",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

/** Purpose "maskable": 80% safe zone (10% inset), solid white background. */
async function renderMaskablePng(source, size) {
  const inner = Math.floor(size * 0.8);
  const innerBuf = await sharp(source)
    .resize(inner, inner, {
      fit: "contain",
      position: "center",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: innerBuf, gravity: "center" }])
    .png()
    .toBuffer();
}

async function writePng(buffer, relativePath) {
  const target = path.join(PUBLIC_DIR, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return target;
}

async function main() {
  const source = await readSourceBuffer();

  await fs.mkdir(ICONS_DIR, { recursive: true });

  for (const size of ANY_SIZES) {
    const buf = await renderAnyPng(source, size);
    await writePng(buf, path.join("icons", `icon-${size}x${size}.png`));
  }

  for (const size of MASKABLE_SIZES) {
    const buf = await renderMaskablePng(source, size);
    await writePng(buf, path.join("icons", `icon-${size}-maskable.png`));
  }

  const fav16 = await renderFaviconPng(source, 16);
  const fav32 = await renderFaviconPng(source, 32);
  const fav48 = await renderFaviconPng(source, 48);
  await writePng(fav16, "favicon-16x16.png");
  await writePng(fav32, "favicon-32x32.png");
  await writePng(fav48, "favicon-48x48.png");

  const icoBuffer = await pngToIco([fav16, fav32, fav48]);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), icoBuffer);

  const apple180 = await renderAnyPng(source, 180);
  await writePng(apple180, "apple-touch-icon.png");

  console.log("PWA icons generated from NRCS logo source.");
}

main().catch((error) => {
  console.error("Failed to generate PWA icons:", error);
  process.exitCode = 1;
});
