import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fix = process.argv.includes("--fix");
const errors = [];
const warnings = [];
const read = (p) => readFileSync(join(root, p), "utf8");

let html = read("index.html");
const css = read("css/style.css");
const js = read("js/main.js");

function versionOf(file) {
  return createHash("sha256").update(readFileSync(join(root, file))).digest("hex").slice(0, 8);
}

for (const [file, pattern] of [
  ["css/style.css", /(href="\/css\/style\.css\?v=)([^"]*)(")/],
  ["js/main.js", /(src="\/js\/main\.js\?v=)([^"]*)(")/],
]) {
  const match = html.match(pattern);
  const expected = versionOf(file);
  if (!match) {
    errors.push(`index.html does not load /${file} with a ?v= version`);
  } else if (match[2] !== expected) {
    if (fix) {
      html = html.replace(pattern, `$1${expected}$3`);
      console.log(`updated ${file} version: ${match[2]} -> ${expected}`);
    } else {
      errors.push(`${file} changed: set its ?v= to ${expected} in index.html (or run: node tools/check.mjs --fix)`);
    }
  }
}
if (fix) writeFileSync(join(root, "index.html"), html);

function imageSize(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

const localPath = (url) => {
  const clean = url.split(/[?#]/)[0];
  if (clean.startsWith("https://larinoo.com/")) return clean.slice("https://larinoo.com".length);
  return clean.startsWith("/") ? clean : null;
};

const referenced = new Set();
const refs = [];
for (const m of html.matchAll(/\s(?:src|href|content)="([^"]+)"/g)) refs.push(m[1]);
for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
  for (const part of m[1].split(",")) refs.push(part.trim().split(/\s+/)[0]);
}
for (const m of html.matchAll(/"image":\s*"([^"]+)"/g)) refs.push(m[1]);
for (const m of css.matchAll(/url\("?([^")]+)"?\)/g)) refs.push(m[1]);
for (const ref of refs) {
  const p = localPath(ref);
  if (!p || p === "/") continue;
  referenced.add(p);
  if (!existsSync(join(root, p))) errors.push(`missing file: ${p}`);
}

for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
  for (const part of m[1].split(",")) {
    const [url, descriptor] = part.trim().split(/\s+/);
    const p = localPath(url);
    if (!p || !descriptor || !existsSync(join(root, p))) continue;
    const size = imageSize(join(root, p));
    if (size && descriptor.endsWith("w") && size.w !== Number(descriptor.slice(0, -1))) {
      errors.push(`${p} is ${size.w}px wide but srcset says ${descriptor}`);
    }
  }
}

for (const m of html.matchAll(/<img\b[^>]*>/g)) {
  const tag = m[0];
  const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
  const w = Number(tag.match(/\swidth="(\d+)"/)?.[1]);
  const h = Number(tag.match(/\sheight="(\d+)"/)?.[1]);
  if (!/\salt="/.test(tag)) errors.push(`image without alt text: ${src}`);
  if (!w || !h) {
    warnings.push(`image without width/height (may shift the layout while loading): ${src}`);
    continue;
  }
  const p = src && localPath(src);
  const size = p && existsSync(join(root, p)) ? imageSize(join(root, p)) : null;
  if (size && Math.abs(size.w / size.h - w / h) > 0.02) {
    warnings.push(`${p} is ${size.w}x${size.h} but its tag declares ${w}x${h}; update width/height to the same proportions`);
  }
}

const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const p = join(dir, name);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
for (const file of [...walk("assets/images"), ...walk("assets/fonts")]) {
  const p = "/" + file.split("\\").join("/");
  if (!referenced.has(p)) warnings.push(`unused file (safe to delete if no longer needed): ${p}`);
  const m = p.match(/-(\d+)w\.(webp|jpg|png)$/);
  const size = m ? imageSize(join(root, p)) : null;
  if (m && size && size.w !== Number(m[1])) errors.push(`${p} is ${size.w}px wide, the name says ${m[1]}w`);
  if (m && size) {
    const ratio = p.includes("-portrait-") ? size.h / size.w : size.w / size.h;
    if (Math.abs(ratio - 4 / 3) > 0.02) warnings.push(`${p} is ${size.w}x${size.h}; the page expects ${p.includes("-portrait-") ? "3:4" : "4:3"}`);
  }
}
const og = join(root, "assets/images/og-image.jpg");
if (existsSync(og)) {
  const size = imageSize(og);
  if (!size || size.w !== 1200 || size.h !== 630) warnings.push("og-image.jpg should be 1200x630");
}

const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (ld) {
  try { JSON.parse(ld[1]); } catch (e) { errors.push(`structured data (JSON-LD) is not valid JSON: ${e.message}`); }
}

for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/\ssrc=/.test(m[1]) && !/type="application\/ld\+json"/.test(m[1])) {
    errors.push("inline <script> found: the security policy blocks it, move the code to js/main.js");
  }
}
if (/<style\b/.test(html) || /\sstyle="/.test(html)) {
  errors.push("inline styles found: the security policy blocks them, move them to css/style.css");
}
if (/\son[a-z]+="/.test(html)) errors.push("inline event handler (onclick=...) found: the security policy blocks it, use js/main.js");
if (/https?:\/\/(?!larinoo\.com|schema\.org|wa\.me|www\.instagram\.com|www\.facebook\.com)[^"'\s]+\.(?:js|css|woff2?)\b/.test(html)) {
  errors.push("external script, style or font found: the security policy only allows files from this site");
}

for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
  if (!/rel="noopener noreferrer"/.test(m[0])) errors.push(`link opening a new tab without rel="noopener noreferrer": ${m[0].slice(0, 80)}`);
}

const numbers = new Map();
const note = (n, where) => numbers.set(n, [...(numbers.get(n) || []), where]);
for (const m of html.matchAll(/wa\.me\/(\d+)/g)) note(m[1], "index.html wa.me link");
for (const m of html.matchAll(/tel:\+?(\d+)/g)) note(m[1], "index.html tel: link");
for (const m of html.matchAll(/"telephone":\s*"\+?(\d+)"/g)) note(m[1], "index.html structured data");
for (const m of html.matchAll(/dir="ltr">\+?([\d\s&nbsp;]+)</g)) note(m[1].replace(/\D/g, ""), "index.html visible number");
for (const m of js.matchAll(/WHATSAPP_NUMBER\s*=\s*"(\d+)"/g)) note(m[1], "js/main.js");
if (numbers.size > 1) {
  errors.push("the phone/WhatsApp number differs between places:\n    " +
    [...numbers].map(([n, where]) => `${n}: ${[...new Set(where)].join(", ")}`).join("\n    "));
}

const productNames = [...html.matchAll(/class="product-card__name">([^<]+)</g)].map((m) => m[1].trim());
const options = [...html.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1].trim());
for (const name of productNames) {
  if (!options.includes(name)) warnings.push(`product "${name}" is not in the wholesale form list, so "order this product" cannot preselect it`);
}

console.log(`checked ${relative(process.cwd(), root) || "."}: ${referenced.size} local files referenced`);
for (const w of warnings) console.log("warning: " + w);
for (const e of errors) console.log("error:   " + e);
if (errors.length) {
  console.log(`\n${errors.length} error(s). Fix them before publishing.`);
  process.exit(1);
}
console.log(warnings.length ? `\nOK with ${warnings.length} warning(s).` : "\nOK");
