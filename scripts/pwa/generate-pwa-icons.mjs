import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "client", "public");

function buildCircleSvg(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#FFFFFF"/>
    </svg>`,
  );
}

function buildCrossSvg(size, inset = 4) {
  const stroke = Math.round(size * 0.26);
  const arm = size - inset * 2;
  const left = Math.round((size - stroke) / 2);
  const top = inset;
  const horizontalTop = Math.round((size - stroke) / 2);
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${left}" y="${top}" width="${stroke}" height="${arm}" fill="#DC2626"/>
      <rect x="${inset}" y="${horizontalTop}" width="${arm}" height="${stroke}" fill="#DC2626"/>
    </svg>`,
  );
}

async function writePng(buffer, filename, size) {
  const target = path.join(PUBLIC_DIR, filename);
  await sharp(buffer).resize(size, size, { fit: "fill" }).png().toFile(target);
  return target;
}

async function generateCircularFavicon() {
  const size = 256;
  const circle = buildCircleSvg(size);
  const cross = buildCrossSvg(size, 10);

  const faviconMaster = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: circle, top: 0, left: 0 },
      { input: cross, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  const png16 = await writePng(faviconMaster, "favicon-16x16.png", 16);
  const png32 = await writePng(faviconMaster, "favicon-32x32.png", 32);
  const png48 = await writePng(faviconMaster, "favicon-48x48.png", 48);

  const icoBuffer = await pngToIco([png16, png32, png48]);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), icoBuffer);
}

async function generateAppleTouchIcon() {
  const size = 180;
  const cross = buildCrossSvg(size, 18);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: cross, top: 0, left: 0 }])
    .png()
    .toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png"));
}

async function main() {
  await generateCircularFavicon();
  await generateAppleTouchIcon();
  console.log("Generated favicon and apple-touch-icon assets.");
}

main().catch((error) => {
  console.error("Failed to generate PWA icons:", error);
  process.exitCode = 1;
});
