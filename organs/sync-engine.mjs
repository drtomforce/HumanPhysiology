#!/usr/bin/env node
/* Copies the shared ORGAN ENGINE blocks (CSS and JS) from organs/_template.html
   into every other organs/*.html page, so all organ pages run the same engine.
     node organs/sync-engine.mjs           update the pages
     node organs/sync-engine.mjs --check   only list pages that are out of date (exit 1)
   No dependencies. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
const BLOCKS = ["CSS", "JS"];
const re = k => new RegExp(`(/\\* ===== ORGAN ENGINE ${k} · BEGIN[^\\n]*\\n)([\\s\\S]*?)(/\\* ===== ORGAN ENGINE ${k} · END ===== \\*/)`);

const template = readFileSync(join(dir, "_template.html"), "utf8");
const source = Object.fromEntries(BLOCKS.map(k => {
  const m = template.match(re(k));
  if (!m) throw new Error(`_template.html has no ORGAN ENGINE ${k} block`);
  return [k, m[2]];
}));

let stale = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith(".html") && f !== "_template.html")){
  const path = join(dir, f), html = readFileSync(path, "utf8");
  let out = html;
  for (const k of BLOCKS){
    if (!re(k).test(out)){ console.warn(`${f}: no ORGAN ENGINE ${k} block, skipped`); continue; }
    out = out.replace(re(k), (_, a, _b, c) => a + source[k] + c);
  }
  if (out === html){ console.log(`${f}: up to date`); continue; }
  stale++;
  if (check) console.log(`${f}: engine out of date`);
  else { writeFileSync(path, out); console.log(`${f}: engine updated`); }
}
if (check && stale) process.exit(1);
