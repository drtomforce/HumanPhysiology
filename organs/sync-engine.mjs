#!/usr/bin/env node
/* Copies the shared blocks from organs/_template.html into the other pages:
     ORGAN ENGINE CSS / JS    → every other organs/*.html page
     EXPORT ENGINE CSS / JS   → every organ page and ../index.html (the Export menu)
     REPORTER CSS / JS        → every organ page and ../index.html ("Report a problem")
   so all pages run the same engine, the same Export menu and the same report form.
     node organs/sync-engine.mjs           update the pages
     node organs/sync-engine.mjs --check   only list pages that are out of date (exit 1)
   An organ page missing EXPORT or REPORTER blocks gets them added: EXPORT after its
   ORGAN ENGINE blocks, REPORTER CSS after EXPORT ENGINE CSS and REPORTER JS in its own
   <script> just before the ORGAN ENGINE JS one.
   No dependencies. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
const ORGAN = ["ORGAN ENGINE CSS", "ORGAN ENGINE JS"], EXPORT = ["EXPORT ENGINE CSS", "EXPORT ENGINE JS"], REPORTER = ["REPORTER CSS", "REPORTER JS"];
const re = k => new RegExp(`(/\\* ===== ${k} · BEGIN[^\\n]*\\n)([\\s\\S]*?)(/\\* ===== ${k} · END ===== \\*/)`);
const begin = k => `/* ===== ${k} · BEGIN`;
const end = k => `/* ===== ${k} · END ===== */`;

const template = readFileSync(join(dir, "_template.html"), "utf8");
const source = Object.fromEntries([...ORGAN, ...EXPORT, ...REPORTER].map(k => {
  const m = template.match(re(k));
  if (!m) throw new Error(`_template.html has no ${k} block`);
  return [k, m[0]];
}));

/* where a missing block goes, relative to a block the page already has */
function insert(out, k){
  if (k.startsWith("EXPORT")){
    const twin = k.replace("EXPORT", "ORGAN");
    if (out.includes(end(twin))) return out.replace(end(twin), () => end(twin) + "\n" + source[k]);
  }
  if (k === "REPORTER CSS" && out.includes(end("EXPORT ENGINE CSS")))
    return out.replace(end("EXPORT ENGINE CSS"), () => end("EXPORT ENGINE CSS") + "\n" + source[k]);
  if (k === "REPORTER JS"){
    const i = out.indexOf(begin("ORGAN ENGINE JS")), s = i < 0 ? -1 : out.lastIndexOf("<script>", i);
    if (s >= 0) return out.slice(0, s) + "<script>\n" + source[k] + "\n</script>\n" + out.slice(s);
  }
  return null;
}

const pages = [
  ...readdirSync(dir).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => ({ name: f, path: join(dir, f), blocks: [...ORGAN, ...EXPORT, ...REPORTER] })),
  { name: "../index.html", path: join(dir, "..", "index.html"), blocks: [...EXPORT, ...REPORTER] }
];

let stale = 0;
for (const { name, path, blocks } of pages){
  const html = readFileSync(path, "utf8");
  let out = html;
  for (const k of blocks){
    if (re(k).test(out)){ out = out.replace(re(k), () => source[k]); continue; }
    const added = insert(out, k);
    if (added != null){ out = added; continue; }
    console.warn(`${name}: no ${k} block, skipped`);
  }
  if (out === html){ console.log(`${name}: up to date`); continue; }
  stale++;
  if (check) console.log(`${name}: shared blocks out of date`);
  else { writeFileSync(path, out); console.log(`${name}: shared blocks updated`); }
}
if (check && stale) process.exit(1);
