import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [kind, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => {
  const [k, v] = a.slice(2).split("=");
  return [k, v ?? true];
}));
const args = rest.filter((a) => !a.startsWith("--"));
const out = flags.out ? join(process.cwd(), flags.out) : join(root, "assets/images");
const webp = { quality: Number(flags.quality || 84), effort: 6, smartSubsample: true };

const usage = `Usage:
  node tools/images.mjs scene <name> <master> [--portrait] [--focus=0.58]
      4:3 scene -> <name>-640w/960w/1280w/1600w.webp
      --portrait also writes <name>-portrait-600w/900w.webp (3:4); --focus is the horizontal
      position of the subject in the portrait crop (0 = left edge, 1 = right edge).
      --widths=640,960,1280 writes only these widths.
  node tools/images.mjs pack <name> <master>
      4:3 product photo -> <name>-520w/780w/1040w.webp
  node tools/images.mjs og <master>
      share image -> og-image.jpg (1200x630)
Options: --out=<folder> writes somewhere else (default: assets/images), --quality=<1-100> (default 84).`;

function sharpenFor(ratio) {
  return { sigma: ratio <= 0.5 ? 0.6 : 0.5, m1: 0.6, m2: 1.2, x1: 2, y2: 8, y3: 12 };
}

async function base(master, width, height) {
  const meta = await sharp(master).metadata();
  if (meta.width < width || meta.height < height) {
    if (!flags["allow-upscale"]) {
      throw new Error(`${master} is ${meta.width}x${meta.height}; it must be at least ${width}x${height} (use --allow-upscale to force)`);
    }
  }
  if (Math.abs(meta.width / meta.height - width / height) > 0.01) {
    console.log(`note: ${master} is ${meta.width}x${meta.height}, cropping the centre to ${width}:${height}` +
      " (crop it yourself first to choose the framing)");
  }
  return sharp(master).rotate().toColorspace("srgb")
    .resize(width, height, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .png().toBuffer();
}

async function write(buffer, width, masterWidth, file) {
  let img = sharp(buffer);
  if (width < masterWidth) img = img.resize({ width, kernel: "lanczos3" }).sharpen(sharpenFor(width / masterWidth));
  const info = await img.webp(webp).toFile(join(out, file));
  console.log(`${file.padEnd(40)} ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`);
}

async function main() {
  mkdirSync(out, { recursive: true });
  if (kind === "scene" && args.length === 2) {
    const [name, master] = args;
    const full = await base(master, 1600, 1200);
    const widths = flags.widths ? String(flags.widths).split(",").map(Number) : [640, 960, 1280, 1600];
    for (const w of widths) await write(full, w, 1600, `${name}-${w}w.webp`);
    if (flags.portrait) {
      const focus = Math.min(1, Math.max(0, Number(flags.focus ?? 0.58)));
      const left = Math.round((1600 - 900) * focus);
      const crop = await sharp(full).extract({ left, top: 0, width: 900, height: 1200 }).png().toBuffer();
      for (const w of [600, 900]) await write(crop, w, 900, `${name}-portrait-${w}w.webp`);
    }
  } else if (kind === "pack" && args.length === 2) {
    const [name, master] = args;
    const full = await base(master, 1040, 780);
    for (const w of [520, 780, 1040]) await write(full, w, 1040, `${name}-${w}w.webp`);
  } else if (kind === "og" && args.length === 1) {
    const full = await base(args[0], 1200, 630);
    const info = await sharp(full).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toFile(join(out, "og-image.jpg"));
    console.log(`og-image.jpg ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`);
  } else {
    console.log(usage);
    process.exit(1);
  }
  if (!existsSync(join(root, "index.html"))) return;
  console.log("\nNext: node tools/check.mjs");
}

main().catch((e) => {
  console.error("error: " + e.message);
  process.exit(1);
});
