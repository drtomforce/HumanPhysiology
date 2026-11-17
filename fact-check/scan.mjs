#!/usr/bin/env node
/* Fact-check scan: keeps fact-check/ledger.json in step with the pages (see FACTUAL_CHECK.md).

   What it reads, per page (index.html is page "body", organs/<id>.html is page "<id>", and the shared
   ORGAN ENGINE JS block of organs/_template.html is page "engine"):
     - every string and number in the <script type="application/json"> blocks, keyed like the
       in-app reporter: "<block id>:<json path>", e.g. body-content:topics.heart.phases.exercise.college
     - every top-level `const UPPERCASE = [ … ]` or `{ … }` in the page's own scripts (the shared
       ORGAN ENGINE / EXPORT ENGINE / REPORTER blocks are skipped), keyed "const:<NAME>", split into
       "const:<NAME>.<id>" for arrays of { id: … } entries and "const:<NAME>.<prop>" for objects
     - every top-level PascalCase module (const Physio = { … }, const Scene = (() => { … })()), keyed
       "mod:<Name>", as one item
     - every top-level function in the page's own scripts, keyed "fn:<name>": the organ models and
       the numbers inside drawing code. A change to the code sends it back to "unchecked"; look at
       its git diff to see whether a physiological number or rule changed.
       Names listed under ledger.ignore[<page>] (drawing, layout, UI, helpers) are left out.

     node fact-check/scan.mjs                     summary: new / changed / removed since the ledger, and counts
     node fact-check/scan.mjs --update            write new and changed items into the ledger as "unchecked"
     node fact-check/scan.mjs --check             exit 1 if any item is unchecked or the ledger is out of date
     node fact-check/scan.mjs --list              print unchecked items with their text
     node fact-check/scan.mjs --mark <status>     set the status of the selected items (ok, fixed, n/a, "issue #12")
         [--note "…"]                             … with a note
   Select with --page <id> (repeatable) and --prefix <key prefix> (repeatable); --all with --list
   lists every item, not just the unchecked ones. --mark only touches items whose hash is current.
   No dependencies. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = join(root, "fact-check", "ledger.json");
const STATUSES = /^(unchecked|ok|fixed|n\/a|issue #\d+)$/;

/* ---------- arguments ---------- */
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const many = f => argv.flatMap((a, i) => a === f && argv[i + 1] != null ? [argv[i + 1]] : []);
const one = f => many(f)[0];
const pagesWanted = many("--page"), prefixes = many("--prefix");
const markStatus = one("--mark"), note = one("--note");
if (markStatus && !STATUSES.test(markStatus)) die(`--mark: status must be unchecked, ok, fixed, n/a or "issue #<n>"`);

function die(msg){ console.error(msg); process.exit(2); }

/* ---------- reading the pages ---------- */
function pageFiles(){
  const organs = readdirSync(join(root, "organs")).filter(f => f.endsWith(".html") && f !== "_template.html").sort();
  return [{ id: "body", path: join(root, "index.html") }, ...organs.map(f => ({ id: f.replace(/\.html$/, ""), path: join(root, "organs", f) })),
    /* the shared ORGAN ENGINE JS, once (it is synced into every organ page): phase vitals, schedule, rhythm */
    { id: "engine", path: join(root, "organs", "_template.html"), engine: true }];
}
const hash = s => createHash("sha1").update(s).digest("hex").slice(0, 12);
const squash = s => s.replace(/\s+/g, " ").trim();

function jsonItems(html, out){
  for (const m of html.matchAll(/<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g)){
    let data;
    try { data = JSON.parse(m[2]); } catch (e){ die(`JSON block #${m[1]} does not parse: ${e.message}`); }
    const walk = (v, path) => {
      if (typeof v === "string" || typeof v === "number"){
        const text = String(v);
        if (squash(text)) out.set(`${m[1]}:${path.join(".")}`, text);
      } else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], [...path, k]);
    };
    walk(data, []);
  }
}

/* the page's own JS: inline <script> blocks that aren't JSON, without the synced engine blocks
   (or, for the "engine" page, only the ORGAN ENGINE JS block) */
function ownScript(html, engine){
  if (engine) return (html.match(/\/\* ===== ORGAN ENGINE JS · BEGIN[\s\S]*?\/\* ===== ORGAN ENGINE JS · END ===== \*\//) || [""])[0];
  const js = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
  return js.replace(/\/\* ===== ([A-Z ]+) · BEGIN[\s\S]*?\/\* ===== \1 · END ===== \*\//g, "");
}

/* index just past the bracketed literal starting at s (s points at [ { or ( ), skipping strings and comments */
function literalEnd(src, s){
  let depth = 0;
  for (let i = s; i < src.length; i++){
    const c = src[i];
    if (c === '"' || c === "'" || c === "`"){
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*"){ i = src.indexOf("*/", i + 2) + 1; continue; }
    if (c === "/" && src[i + 1] === "/"){ i = src.indexOf("\n", i); continue; }
    if ("[{(".includes(c)) depth++;
    else if ("]})".includes(c) && --depth === 0) return i + 1;
  }
  return src.length;
}
/* split the inside of a literal at its top-level commas */
function topLevelParts(lit){
  const parts = []; let depth = 0, start = 1;
  for (let i = 0; i < lit.length; i++){
    const c = lit[i];
    if (c === '"' || c === "'" || c === "`"){ for (i++; i < lit.length && lit[i] !== c; i++) if (lit[i] === "\\") i++; continue; }
    if (c === "/" && lit[i + 1] === "*"){ i = lit.indexOf("*/", i + 2) + 1; continue; }
    if (c === "/" && lit[i + 1] === "/"){ i = lit.indexOf("\n", i); continue; }
    if ("[{(".includes(c)) depth++;
    else if ("]})".includes(c)) depth--;
    if ((c === "," && depth === 1) || i === lit.length - 1){ parts.push(lit.slice(start, i)); start = i + 1; }
  }
  return parts.map(p => p.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "$1").trim()).filter(Boolean);
}

function codeItems(html, ignore, out, engine){
  const js = ownScript(html, engine);
  const seen = {};
  for (const m of js.matchAll(/^const ([A-Z][A-Z0-9_]*) *= *([\[{])/gm)){
    const name = m[1];
    if (ignore.has(name)) continue;
    const n = seen[name] = (seen[name] || 0) + 1, base = `const:${name}${n > 1 ? "#" + n : ""}`;
    const s = m.index + m[0].length - 1, lit = js.slice(s, literalEnd(js, s));
    const parts = topLevelParts(lit);
    const ids = parts.map(p => (p.match(/^\{\s*id:\s*["']([^"']+)["']/) || [])[1]);
    const props = parts.map(p => (p.match(/^["']?([A-Za-z_$][\w$]*)["']?\s*:/) || [])[1]);
    if (m[2] === "[" && parts.length > 1 && ids.every(Boolean)) parts.forEach((p, i) => out.set(uniq(out, `${base}.${ids[i]}`), p));
    else if (m[2] === "{" && parts.length > 1 && props.every(Boolean)) parts.forEach((p, i) => out.set(uniq(out, `${base}.${props[i]}`), p));
    else out.set(base, lit);
  }
  /* PascalCase modules (const Physio = { … }, const Scene = (() => { … })()): one item each, "mod:<Name>",
     running to the next top-level declaration */
  for (const m of js.matchAll(/^const ([A-Z][a-z]\w*) *=/gm)){
    if (ignore.has(m[1])) continue;
    const rest = js.slice(m.index + m[0].length), next = rest.search(/^(?:const|let|var|function|async function|class) /m);
    out.set(uniq(out, `mod:${m[1]}`), js.slice(m.index, m.index + m[0].length + (next < 0 ? rest.length : next)));
  }
  /* top-level functions: models and the numbers inside drawing code ("fn:<name>") */
  for (const m of js.matchAll(/^(?:async )?function\*? ?([A-Za-z_$][\w$]*)\s*\(/gm)){
    if (ignore.has(m[1])) continue;
    const p = m.index + m[0].length - 1, b = js.indexOf("{", literalEnd(js, p));
    out.set(uniq(out, `fn:${m[1]}`), js.slice(m.index, literalEnd(js, b)));
  }
}
function uniq(map, key){ if (!map.has(key)) return key; let i = 2; while (map.has(`${key}#${i}`)) i++; return `${key}#${i}`; }

/* ---------- the ledger ---------- */
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { version: 1, ignore: {}, pages: {} };
ledger.ignore ||= {}; ledger.pages ||= {};

const selected = page => !pagesWanted.length || pagesWanted.includes(page);
const prefixed = key => !prefixes.length || prefixes.some(p => key.startsWith(p));

const today = new Date().toISOString().slice(0, 10);
const report = [];
let dirty = false, unchecked = 0, marked = 0;

for (const { id: page, path, engine } of pageFiles()){
  if (!selected(page)) continue;
  const html = readFileSync(path, "utf8");
  const items = new Map();
  if (!engine) jsonItems(html, items);
  codeItems(html, new Set(ledger.ignore[page] || []), items, engine);

  const rows = ledger.pages[page] || {};
  const fresh = [], changed = [], removed = Object.keys(rows).filter(k => !items.has(k));
  for (const [key, text] of items){
    const h = hash(squash(text)), row = rows[key];
    if (!row) fresh.push(key);
    else if (row.hash !== h) changed.push(key);
  }
  if (fresh.length || changed.length || removed.length) dirty = true;

  if (flag("--update")){
    for (const key of fresh) rows[key] = { hash: hash(squash(items.get(key))), status: "unchecked" };
    for (const key of changed){
      const was = rows[key].status;
      rows[key] = { hash: hash(squash(items.get(key))), status: "unchecked", ...(rows[key].note ? { note: rows[key].note } : {}), ...(was !== "unchecked" ? { was } : {}) };
    }
    for (const key of removed) delete rows[key];
    ledger.pages[page] = Object.fromEntries(Object.entries(rows).sort(([a], [b]) => a.localeCompare(b, "en")));
  }

  if (markStatus){
    for (const [key, row] of Object.entries(ledger.pages[page] || {})){
      if (!prefixed(key) || !items.has(key) || row.hash !== hash(squash(items.get(key)))) continue;
      row.status = markStatus; row.checked = today; delete row.was;
      if (note != null){ if (note) row.note = note; else delete row.note; }
      marked++;
    }
  }

  const live = ledger.pages[page] || {};
  const counts = { items: items.size, unchecked: 0, ok: 0, fixed: 0, "n/a": 0, issue: 0 };
  for (const key of items.keys()){
    const row = live[key];
    const st = !row || row.hash !== hash(squash(items.get(key))) ? "unchecked" : row.status.startsWith("issue") ? "issue" : row.status;
    counts[st]++;
    if (st === "unchecked" && prefixed(key)) unchecked++;
    if (flag("--list") && prefixed(key) && (flag("--all") || st === "unchecked"))
      console.log(`${page} ${key} [${row && row.hash === hash(squash(items.get(key))) ? row.status : "unchecked"}]\n    ${squash(items.get(key)).slice(0, flag("--full") ? Infinity : 400)}`);
  }
  report.push({ page, ...counts, new: fresh.length, changed: changed.length, removed: removed.length });
}

/* one row per line, so nightly diffs stay readable */
function format(l){
  const ig = Object.entries(l.ignore).map(([p, names]) => `  ${JSON.stringify(p)}: ${JSON.stringify(names)}`).join(",\n");
  const pg = Object.entries(l.pages).map(([p, rows]) => `  ${JSON.stringify(p)}: {\n` +
    Object.entries(rows).map(([k, r]) => `   ${JSON.stringify(k)}: ${JSON.stringify(r)}`).join(",\n") + "\n  }").join(",\n");
  return `{\n "version": ${l.version},\n "ignore": {\n${ig}\n },\n "pages": {\n${pg}\n }\n}\n`;
}
if (flag("--update") || markStatus) writeFileSync(LEDGER, format(ledger));

if (!flag("--list")){
  const cols = ["page", "items", "unchecked", "ok", "fixed", "n/a", "issue", "new", "changed", "removed"];
  const w = cols.map(c => Math.max(c.length, ...report.map(r => String(r[c]).length)));
  const line = r => cols.map((c, i) => String(r[c]).padStart(w[i])).join("  ");
  console.log(line(Object.fromEntries(cols.map(c => [c, c]))));
  report.forEach(r => console.log(line(r)));
  if (markStatus) console.log(`\nmarked ${marked} item(s) "${markStatus}"`);
  if (dirty && !flag("--update")) console.log("\nThe ledger is out of date: run with --update.");
}
if (flag("--check") && (unchecked || (dirty && !flag("--update")))) process.exit(1);
