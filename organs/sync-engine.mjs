#!/usr/bin/env node
/* Copies the shared blocks from organs/_template.html into the other pages:
     ORGAN ENGINE CSS / JS   into every other organs/*.html page
     REPORTER CSS / JS       into every organ page and ../index.html
   so all pages run the same engine and the same "Report a problem" form.
     node organs/sync-engine.mjs           update the pages
     node organs/sync-engine.mjs --check   only list pages that are out of date (exit 1)
     --dir <organs folder>                 work on another checkout (the nightly triage
                                           runs a pristine copy of this script on the
                                           working tree)
   No dependencies. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const argDir = process.argv.indexOf("--dir");
const dir = argDir > 0 ? process.argv[argDir + 1] : dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
const ENGINE = ["ORGAN ENGINE CSS", "ORGAN ENGINE JS"], REPORTER = ["REPORTER CSS", "REPORTER JS"];
const re = k => new RegExp(`(/\\* ===== ${k} · BEGIN[^\\n]*\\n)([\\s\\S]*?)(/\\* ===== ${k} · END ===== \\*/)`);

const template = readFileSync(join(dir, "_template.html"), "utf8");
const source = Object.fromEntries([...ENGINE, ...REPORTER].map(k => {
  const m = template.match(re(k));
  if (!m) throw new Error(`_template.html has no ${k} block`);
  return [k, m[2]];
}));

const targets = [
  ...readdirSync(dir).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => [join(dir, f), [...ENGINE, ...REPORTER]]),
  [join(dir, "..", "index.html"), REPORTER]
];
let stale = 0;
for (const [path, blocks] of targets){
  const f = relative(join(dir, ".."), path), html = readFileSync(path, "utf8");
  let out = html;
  for (const k of blocks){
    if (!re(k).test(out)){ console.warn(`${f}: no ${k} block, skipped`); continue; }
    out = out.replace(re(k), (_, a, _b, c) => a + source[k] + c);
  }
  if (out === html){ console.log(`${f}: up to date`); continue; }
  stale++;
  if (check) console.log(`${f}: shared blocks out of date`);
  else { writeFileSync(path, out); console.log(`${f}: shared blocks updated`); }
}
if (check && stale) process.exit(1);
