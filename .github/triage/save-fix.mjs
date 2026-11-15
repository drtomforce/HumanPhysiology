#!/usr/bin/env node
/* The triage agent's only way to hand over a fix. It has no git, so this script does
   the bookkeeping:
     node save-fix.mjs <issue>   sync the shared blocks, then store every page that
                                 differs from the original in .triage/fixes/<issue>/
                                 and put the original pages back, ready for the next issue
     node save-fix.mjs --reset   throw away the current edits
   Pages are index.html and organs/*.html. The originals are a read-only copy taken
   before the agent started (a "pristine" folder next to this script). Run locally,
   with no such folder, they come from git HEAD.
   The saved fix is only a proposal: .github/triage/apply.mjs checks it again
   before anything is pushed. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TRIAGE_ROOT || process.cwd();
const PRISTINE = join(HERE, "pristine");
const arg = process.argv[2] || "";
const reset = arg === "--reset";
if (!reset && !/^[1-9]\d{0,6}$/.test(arg)){ console.error("usage: save-fix.mjs <issue number> | --reset"); process.exit(2); }

const pages = () => ["index.html", ...readdirSync(join(ROOT, "organs")).filter(f => f.endsWith(".html")).map(f => "organs/" + f)];
function original(rel){
  if (existsSync(PRISTINE)){ const p = join(PRISTINE, rel); return existsSync(p) ? readFileSync(p, "utf8") : null; }
  try { return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "show", "HEAD:" + rel], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }); }
  catch { return null; }
}

/* the shared blocks first, so a change to organs/_template.html reaches every page */
if (!reset){
  const sync = existsSync(join(HERE, "sync-engine.mjs")) ? join(HERE, "sync-engine.mjs") : join(ROOT, "organs", "sync-engine.mjs");
  execFileSync("node", [sync, "--dir", join(ROOT, "organs")], { stdio: "ignore" });
}

const out = join(ROOT, ".triage", "fixes", arg);
const changed = [];
for (const rel of pages()){
  const now = readFileSync(join(ROOT, rel), "utf8"), was = original(rel);
  if (was === null){ console.log(`skipped ${rel}: a new page can't be part of a fix`); rmSync(join(ROOT, rel)); continue; }
  if (now === was) continue;
  if (!reset){
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), now);
    const a = was.split("\n"), b = now.split("\n"), A = new Set(a), B = new Set(b);
    changed.push(`${rel}: ${b.filter(l => !A.has(l)).length} lines added, ${a.filter(l => !B.has(l)).length} removed`);
  }
  writeFileSync(join(ROOT, rel), was);
}
if (reset) console.log("Edits thrown away; the pages are back to the original.");
else if (!changed.length) console.log("Nothing to save: no page differs from the original.");
else console.log(`Saved the fix for #${arg} in .triage/fixes/${arg}/ and restored the original pages:\n  ${changed.join("\n  ")}`);
