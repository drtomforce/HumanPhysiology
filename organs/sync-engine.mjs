#!/usr/bin/env node
/* Copies the shared engine blocks from organs/_template.html into the other pages:
     ORGAN ENGINE CSS / JS    → every other organs/*.html page
     EXPORT ENGINE CSS / JS   → every organ page and ../index.html (the Export menu)
     node organs/sync-engine.mjs           update the pages
     node organs/sync-engine.mjs --check   only list pages that are out of date (exit 1)
   An organ page without the EXPORT blocks gets them added after its ORGAN ENGINE blocks.
   No dependencies. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
const ORGAN = ["ORGAN ENGINE CSS", "ORGAN ENGINE JS"], EXPORT = ["EXPORT ENGINE CSS", "EXPORT ENGINE JS"];
const re = k => new RegExp(`(/\\* ===== ${k} · BEGIN[^\\n]*\\n)([\\s\\S]*?)(/\\* ===== ${k} · END ===== \\*/)`);
const end = k => `/* ===== ${k} · END ===== */`;

const template = readFileSync(join(dir, "_template.html"), "utf8");
const source = Object.fromEntries([...ORGAN, ...EXPORT].map(k => {
  const m = template.match(re(k));
  if (!m) throw new Error(`_template.html has no ${k} block`);
  return [k, m[0]];
}));

const pages = [
  ...readdirSync(dir).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => ({ name: f, path: join(dir, f), blocks: [...ORGAN, ...EXPORT] })),
  { name: "../index.html", path: join(dir, "..", "index.html"), blocks: EXPORT }
];

let stale = 0;
for (const { name, path, blocks } of pages){
  const html = readFileSync(path, "utf8");
  let out = html;
  for (const k of blocks){
    if (re(k).test(out)){ out = out.replace(re(k), () => source[k]); continue; }
    /* an organ page from before the Export menu: put the block after its organ twin */
    const twin = k.replace("EXPORT", "ORGAN");
    if (k !== twin && out.includes(end(twin))){ out = out.replace(end(twin), () => end(twin) + "\n" + source[k]); continue; }
    console.warn(`${name}: no ${k} block, skipped`);
  }
  if (out === html){ console.log(`${name}: up to date`); continue; }
  stale++;
  if (check) console.log(`${name}: engine out of date`);
  else { writeFileSync(path, out); console.log(`${name}: engine updated`); }
}
if (check && stale) process.exit(1);
