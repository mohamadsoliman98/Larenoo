import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
const site = [
  "index.html",
  "_headers",
  "robots.txt",
  "sitemap.xml",
  "favicon.svg",
  "favicon.png",
  "apple-touch-icon.png",
  "css",
  "js",
  "assets",
];

try {
  execFileSync(process.execPath, [join(root, "tools/check.mjs")], { stdio: "inherit" });
} catch {
  console.error("\nThe site check failed, so nothing was built.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const item of site) {
  if (!existsSync(join(root, item))) {
    console.error(`missing: ${item}`);
    process.exit(1);
  }
  cpSync(join(root, item), join(out, item), { recursive: true });
}

const blocks = readFileSync(join(out, "_headers"), "utf8").trim().split(/\n\s*\n/);
const kept = blocks.filter((block) => !/^\/(README\.md|tools\/)/.test(block.trim()));
writeFileSync(join(out, "_headers"), kept.join("\n\n") + "\n");

let count = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else { count += 1; bytes += statSync(p).size; }
  }
};
walk(out);
console.log(`\ndist/ is ready: ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
console.log("Upload the dist folder (or a zip of its contents) to Cloudflare Pages.");
