#!/usr/bin/env node
/* Fact-check scan: keeps fact-check/ledger.json in step with the pages (see FACTUAL_CHECK.md).

   What it reads, per page (index.html is page "body", organs/<id>.html is page "<id>", and the shared
   ORGAN ENGINE JS block of organs/_template.html is page "engine"):
     - every string and number in the <script type="application/json"> blocks, keyed like the
       in-app reporter: "<block id>:<json path>", e.g. body-content:topics.heart.phases.exercise.college
     - every top-level `const UPPERCASE = [ … ]` or `{ … }` in the page's own scripts (the shared
       ORGAN ENGINE / EXPORT ENGINE / REPORTER blocks are skipped), keyed "const:<NAME>", split into
       "const:<NAME>.<id>" for arrays of { id: … } entries and "const:<NAME>.<prop>" for objects;
       a numeric one (const HB = 150, N_HILL = 2.7;) is one item per statement, keyed by its first name
     - every top-level PascalCase module (const Physio = { … }, const Scene = (() => { … })()), keyed
       "mod:<Name>", as one item
     - every top-level function in the page's own scripts, declared or as an arrow function in a
       lowercase const, keyed "fn:<name>": the organ models and the numbers inside drawing code.
       A change to the code sends it back to "unchecked"; look at its git diff to see whether a
       physiological number or rule changed.
       Names listed under ledger.ignore[<page>] (drawing, layout, UI, helpers) are left out.

     node fact-check/scan.mjs                     summary: new / changed / removed since the ledger, and counts
     node fact-check/scan.mjs --update            write new and changed items into the ledger as "unchecked"
     node fact-check/scan.mjs --check             exit 1 if any item is unchecked, or the ledger or status.js is out of date
     node fact-check/scan.mjs --status            rewrite fact-check/status.js, the per-section summary that fact-check.html
                                                  draws (--update, --mark and --verify rewrite it too)
     node fact-check/scan.mjs --list              print unchecked items with their text
     node fact-check/scan.mjs --mark <status>     set the status of the selected items (ok, fixed, n/a, "issue #12")
         [--note "…"]                             … with a note
         --by <who>                               … who made the check (a person's handle, or an agent run such
                                                  as claude-nightly-2026-11-18); required for ok, fixed and issues
         [--lookup <id>:<locator>                 … citing a source from fact-check/sources.json that was opened
            --url <link> --quote "<excerpt>"]       and read at <locator> during this check, with a working link to
                                                  it and a short verbatim excerpt (repeatable: the n-th --url and
                                                  --quote go with the n-th --lookup). Each link is fetched first,
                                                  and a dead one is refused (--no-link-check to skip, offline).
                                                  A link to a paper in Europe PMC, PubMed or PMC must be to the
                                                  paper the source id names, and its --quote must be in that
                                                  paper's text (fact-check/epmc.mjs); --no-quote-check to skip
         [--memory <id>[:<locator>]]              … citing a source recalled from memory, not opened (repeatable)
                                                  ok, fixed and "issue #n" need at least one of the two; the row
                                                  gets "via": "lookup" if every source was looked up, "partial" if some were
         [--recheck]                              … as the result of a random re-check (needs --key): keeps the
                                                  original "checked" date, sets "rechecked" and logs the outcome
                                                  to fact-check/rechecks.jsonl; once per key per day. Fixed in the
                                                  text first? --update, then --recheck --mark fixed
     node fact-check/scan.mjs --sample <n>        pick n approved items (ok, fixed, n/a) at random for a re-check
         [--seed <s>] [--min-age <days>]          seed defaults to today's date; skips items (re)checked in the
                                                  last 60 days
     node fact-check/scan.mjs --verify-sample <n> pick n look-up citations at random for independent verification
         --by <verifier>                          (never one the verifier made themselves)
     node fact-check/scan.mjs --verify <result>   record a verification: confirmed, partial (supports only part of the
         --page --key --cite <id> --by <verifier> row: --note names what it doesn't support), link-broken,
                                                  wrong-locator or not-supported, logged to fact-check/verifications.jsonl
     node fact-check/scan.mjs --uncite <id>       take a recalled source off the selected rows, where it doesn't bear on
         --by <who> --note "<why>"                their claim (a blanket citation set applied with --prefix). Status,
         --key / --keys-from <file> / --prefix    checked date and checker stay; the row's note and narrowed.jsonl record it.
                                                  Never removes a look-up, never leaves a row citing nothing
     node fact-check/scan.mjs --check-quotes      for every look-up linked to a paper in Europe PMC, PubMed or PMC: is its
                                                  quote in that paper's text, and is it the paper its source id names?
     node fact-check/scan.mjs --check-links       fetch every look-up link in the selection and report dead ones
         [--max-age <days>]                       (only links not checked in the last 30 days; results in
                                                  fact-check/links.json)
     node fact-check/scan.mjs --recheck-stats     re-check and verification results by page, batch, method, checker
     node fact-check/scan.mjs --sources           each source with how many rows looked it up or recalled it,
                                                  overdue guidelines, unknown ids, approved rows that cite nothing
   Select with --page <id> (repeatable), --prefix <key prefix> (repeatable), --key <exact key>
   (repeatable), --batch <YYYY-MM-DD> (rows whose "checked" date is that day), --cites <source id> and
   --via <lookup|partial|memory|unknown> (how the row was checked; "partial" = some sources looked up, some recalled;
   "unknown" = approved before this was recorded);
   --all with --list lists every item, not just the unchecked ones. --mark only touches items whose
   hash is current; add --unchecked to leave rows that already have a status (ok, fixed, an issue) alone.
   Behind an HTTPS proxy, the link-fetching commands re-run themselves with NODE_USE_ENV_PROXY=1, and a
   link whose host the environment's network doesn't allow is reported as not checked, not as dead
   (fact-check/net.mjs).
   No dependencies. */
import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useEnvProxy, whyFailed } from "./net.mjs";
import { checkQuote, citeDoi, paperFromUrl } from "./epmc.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = join(root, "fact-check", "ledger.json");
const SOURCES = join(root, "fact-check", "sources.json");
const RECHECKS = join(root, "fact-check", "rechecks.jsonl");
const VERIFICATIONS = join(root, "fact-check", "verifications.jsonl");
const NARROWED = join(root, "fact-check", "narrowed.jsonl");
const LINKS = join(root, "fact-check", "links.json");
const STATUSES = /^(unchecked|ok|fixed|n\/a|issue #\d+)$/;

/* ---------- arguments ---------- */
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const many = f => argv.flatMap((a, i) => a === f && argv[i + 1] != null ? [argv[i + 1]] : []);
const one = f => many(f)[0];
const pagesWanted = many("--page"), prefixes = many("--prefix"), keys = many("--key");
/* --keys-from <file>: exact keys, one per line (blank lines and # comments ignored), added to --key */
for (const f of many("--keys-from")) keys.push(...readFileSync(f, "utf8").split("\n").map(l => l.replace(/#.*/, "").trim()).filter(Boolean));
const uncite = one("--uncite");
const batch = one("--batch"), cites = one("--cites");
const markStatus = one("--mark"), note = one("--note"), lookArgs = many("--lookup"), memArgs = many("--memory"), viaWanted = one("--via");
const urlArgs = many("--url"), quoteArgs = many("--quote"), by = one("--by") || process.env.FACT_CHECK_BY;
const verifyN = one("--verify-sample") != null ? Number(one("--verify-sample")) : null, verifyResult = one("--verify"), citeArg = one("--cite");
const squashArg = s => s.replace(/\s+/g, " ").trim();
const VERIFY_RESULTS = /^(confirmed|partial|link-broken|wrong-locator|not-supported)$/;
const sampleN = one("--sample") != null ? Number(one("--sample")) : null;
const seed = one("--seed") || new Date().toISOString().slice(0, 10);
const minAge = Number(one("--min-age") ?? 60);
if (markStatus && !STATUSES.test(markStatus)) die(`--mark: status must be unchecked, ok, fixed, n/a or "issue #<n>"`);
/* commands that fetch links: behind an HTTPS proxy, re-run with Node using it (fact-check/net.mjs) */
if ((urlArgs.length && markStatus && !flag("--no-link-check")) || flag("--check-links") || flag("--check-quotes")) useEnvProxy();

/* the source registry: every --lookup / --memory must name an id in it */
const sources = existsSync(SOURCES) ? JSON.parse(readFileSync(SOURCES, "utf8")) : {};
/* a look-up citation is { id, at, url, quote, by, verified?, verifiedBy?, partial? }; a memory citation is "<id>[:<locator>]" */
const srcId = s => typeof s === "string" ? s.split(":")[0] : s.id;
const srcText = s => typeof s === "string" ? s : `${s.id}:${s.at}`;
if (many("--source").length) die("--source is gone: use --lookup <id>:<locator> for a source you opened, --memory <id> for one you recalled");
for (const s of [...lookArgs, ...memArgs]) if (!sources[srcId(s)]) die(`${s}: "${srcId(s)}" is not in fact-check/sources.json; add it there first`);
for (const s of lookArgs){
  if (!/^[^:]+:\s*\S/.test(s)) die(`--lookup ${s}: give the locator you read it at, e.g. --lookup ${srcId(s)}:"ch. 9, table 9-1"`);
  const acc = sources[srcId(s)].access;
  if (acc === "none" || acc === "print")
    die(`--lookup ${s}: sources.json says "${srcId(s)}" has access "${acc}", so there is no link a verifier can follow; use --memory, or find an online edition`);
}
if (lookArgs.length && (urlArgs.length !== lookArgs.length || quoteArgs.length !== lookArgs.length))
  die(`each --lookup needs its own --url <link> and --quote "<excerpt>", in the same order (got ${lookArgs.length} --lookup, ${urlArgs.length} --url, ${quoteArgs.length} --quote)`);
if ((urlArgs.length || quoteArgs.length) && !lookArgs.length) die("--url and --quote go with --lookup");
const BAD_HOSTS = /(^|\.)(localhost|claude\.ai|chatgpt\.com|chat\.openai\.com|gemini\.google\.com|perplexity\.ai|wikipedia\.org)$/;
for (const u of urlArgs){
  let url; try { url = new URL(u); } catch { die(`--url ${u}: not a URL`); }
  if (!/^https?:$/.test(url.protocol)) die(`--url ${u}: must be http(s)`);
  if (BAD_HOSTS.test(url.hostname) || /^(127\.|10\.|192\.168\.)/.test(url.hostname)) die(`--url ${u}: ${url.hostname} is not a source a verifier can use (see FACTUAL_CHECK.md#links)`);
  if (/(^|\.)(google|bing|duckduckgo)\.[a-z.]+$/.test(url.hostname) && /\/search|[?&]q=/.test(url.pathname + url.search)) die(`--url ${u}: a search result is not a link to the source`);
}
for (const q of quoteArgs) if (squashArg(q).length < 8 || squashArg(q).length > 300) die(`--quote: give 8-300 characters copied verbatim from the passage (got ${squashArg(q).length})`);
if (markStatus && /^(ok|fixed|issue)/.test(markStatus) && !by) die(`--mark ${markStatus} needs --by <who> (or FACT_CHECK_BY): a person's handle or an agent run, e.g. claude-nightly-${new Date().toISOString().slice(0, 10)}`);
if (verifyResult && !VERIFY_RESULTS.test(verifyResult)) die("--verify: confirmed, partial, link-broken, wrong-locator or not-supported");
if (verifyResult === "partial" && !note) die(`--verify partial needs --note "<what the excerpt doesn't support>"`);
if (verifyResult && (!by || !citeArg || keys.length !== 1 || pagesWanted.length !== 1)) die("--verify needs --page <page> --key <key> --cite <source id> --by <verifier>");
if (verifyN != null && (!(verifyN > 0) || !by)) die("--verify-sample needs a positive number and --by <verifier>, so it can leave out the verifier's own look-ups");
const cited = lookArgs.length + memArgs.length;
if (cited && !markStatus) die("--lookup and --memory go with --mark");
if (cited && /^(unchecked|n\/a)$/.test(markStatus)) die(`--mark ${markStatus} takes no sources`);
if (markStatus && /^(ok|fixed|issue)/.test(markStatus) && !cited)
  die(`--mark ${markStatus} needs --lookup <id>:<locator> (a source you opened) or --memory <id> (one you recalled); internal:<registry row or key> for a consistency check`);
if (viaWanted && !/^(lookup|partial|memory|unknown)$/.test(viaWanted)) die("--via: lookup, partial, memory or unknown");
if (uncite && (markStatus || verifyResult)) die("--uncite goes on its own, not with --mark or --verify");
if (uncite && !sources[uncite]) die(`--uncite ${uncite}: not in fact-check/sources.json`);
if (uncite && (!by || !note || (!keys.length && !prefixes.length)))
  die(`--uncite <id> needs --by <who>, --note "<why it doesn't bear on these rows>" and a selection (--key, --keys-from or --prefix): narrowing is row by row, never a whole page`);
if (flag("--recheck") && (!markStatus || !keys.length || prefixes.length))
  die("--recheck goes with --mark and --key <exact key> (one or more), not --prefix: re-check items one at a time");
if (sampleN != null && !(sampleN > 0)) die("--sample: give a positive number");

function die(msg){ console.error(msg); process.exit(2); }

/* ---------- links: a look-up citation must carry a link that works for a verifier ---------- */
const links = existsSync(LINKS) ? JSON.parse(readFileSync(LINKS, "utf8")) : {};
async function probe(url){
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; fact-check link checker)", accept: "text/html,application/pdf,*/*" } });
    res.body?.cancel?.();
    /* 401 / 403 / 429: the server answered but wants a login or blocks robots; a person can still follow it */
    const state = res.ok ? "ok" : [401, 402, 403, 429].includes(res.status) ? "login" : "broken";
    return { state, code: res.status, final: res.url !== url ? res.url : undefined };
  } catch (e){ return { code: 0, ...(await whyFailed(url, e)) }; } /* "blocked": the proxy won't let this environment reach the host */
  finally { clearTimeout(timer); }
}
async function probeAll(urls){
  const out = {};
  for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(async u => {
    out[u] = { ...(await probe(u)), checked: new Date().toISOString().slice(0, 10) };
    if (out[u].state !== "blocked") links[u] = out[u]; /* not recorded: still due for a check from an environment that allows the host */
  }));
  writeFileSync(LINKS, JSON.stringify(Object.fromEntries(Object.entries(links).sort()), null, 1) + "\n");
  return out;
}
if (urlArgs.length && markStatus && !flag("--no-link-check")){
  const res = await probeAll([...new Set(urlArgs)]);
  const dead = Object.entries(res).filter(([, r]) => r.state === "broken");
  if (dead.length) die("These links don't work, so nothing was marked:\n  " + dead.map(([u, r]) => `${u}  (${r.code || r.error})`).join("\n  "));
  for (const [u, r] of Object.entries(res)) if (r.state === "blocked")
    console.error(`Not link-checked: this environment's network doesn't allow ${new URL(u).hostname} (${r.error}). Marking anyway; run --check-links from an environment that allows it.`);
}

/* ---------- quotes: a look-up linked to a paper in Europe PMC, PubMed or PMC must quote its text ---------- */
const paperIds = id => { const s = sources[id] || {}; return { pmid: s.pmid, pmcid: s.pmcid, doi: s.doi || citeDoi(s.cite || "") }; };
function quoteProblem(r){
  if (!r || r.state === "ok") return null;
  if (r.state === "not-verbatim") return `not verbatim (case, spacing or punctuation differ) in ${r.where}; the source has: ${JSON.stringify(r.found)}`;
  if (r.state === "missing") return `not found in ${r.searched}`;
  if (r.state === "wrong-paper") return `wrong paper: ${r.why}`;
  if (r.state === "retracted") return `the paper is retracted or under an expression of concern: ${r.why}`;
  if (r.state === "error") return `couldn't reach Europe PMC to check it (${r.why}); try again, or --no-quote-check and run --check-quotes later`;
  return null;
}
if (lookArgs.length && markStatus && !flag("--no-link-check") && !flag("--no-quote-check")){
  const bad = [];
  for (let i = 0; i < lookArgs.length; i++){
    const r = await checkQuote(urlArgs[i], squashArg(quoteArgs[i]), paperIds(srcId(lookArgs[i])));
    const why = quoteProblem(r);
    if (why) bad.push(`--lookup ${lookArgs[i]}: ${why}`);
    else if (r?.state === "unchecked") console.error(`Quote not checked for --lookup ${lookArgs[i]}: ${r.why}. Marking anyway: the excerpt must be from the page you read.`);
  }
  if (bad.length) die("These quotes don't check out against the paper they link to, so nothing was marked:\n  " + bad.join("\n  ") +
    "\n(read the paper with node fact-check/fetch.mjs <id>, and copy the excerpt from what it prints)");
}

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
  /* numeric UPPERCASE constants (const HB = 150, N_HILL = 2.7;): one item per statement, keyed by its first name */
  for (const m of js.matchAll(/^const ([A-Z][A-Z0-9_]*) *= *[-+.\d][^\n]*/gm)){
    if (ignore.has(m[1])) continue;
    out.set(uniq(out, `const:${m[1]}`), m[0]);
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
  /* top-level arrow functions (const makeLung = () => { … }, const sat = (p, p50) => …): also "fn:<name>",
     running to the next top-level declaration */
  for (const m of js.matchAll(/^const ([a-z_$][\w$]*) *= *(?:async *)?(?:\([^)\n]*\)|[A-Za-z_$][\w$]*) *=>/gm)){
    if (ignore.has(m[1])) continue;
    const rest = js.slice(m.index + m[0].length), next = rest.search(/^(?:const|let|var|function|async function|class) /m);
    out.set(uniq(out, `fn:${m[1]}`), js.slice(m.index, m.index + m[0].length + (next < 0 ? rest.length : next)).trimEnd());
  }
}
function uniq(map, key){ if (!map.has(key)) return key; let i = 2; while (map.has(`${key}#${i}`)) i++; return `${key}#${i}`; }

/* ---------- the ledger ---------- */
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { version: 1, ignore: {}, pages: {} };
ledger.ignore ||= {}; ledger.pages ||= {};

const selected = page => !pagesWanted.length || pagesWanted.includes(page);
const keyed = key => (!prefixes.length && !keys.length) || keys.includes(key) || prefixes.some(p => key.startsWith(p));
/* the row filters (--batch, --cites) apply on top of the key selection */
const viaOf = row => row?.via || "unknown";
const rowOk = row => (!batch || row?.checked === batch) && (!cites || [...(row?.src || []), ...(row?.mem || [])].some(s => srcId(s) === cites))
  && (!viaWanted || viaOf(row) === viaWanted);
/* how a row was checked, from its citations: "lookup" if every source was looked up, "partial" if some were and
   some were recalled, "memory" if none was looked up. A row with no citations has no "via" ("unknown") */
const viaFrom = row => (row.src || []).length ? ((row.mem || []).length ? "partial" : "lookup") : (row.mem || []).length ? "memory" : undefined;
function setVia(row){ const v = viaFrom(row); if (v) row.via = v; else delete row.via; }
/* merge citations: a source looked up wins over the same source recalled */
function cite(row, keepOld){
  const look = new Map(), mem = new Map();
  if (keepOld){ for (const s of row.src || []) look.set(srcId(s), s); for (const s of row.mem || []) mem.set(srcId(s), s); }
  lookArgs.forEach((s, i) => {
    look.set(srcId(s), { id: srcId(s), at: s.slice(s.indexOf(":") + 1).trim(), url: urlArgs[i], quote: squashArg(quoteArgs[i]), by });
    mem.delete(srcId(s));
  });
  for (const s of memArgs) if (!look.has(srcId(s))) mem.set(srcId(s), s);
  delete row.src; delete row.mem; delete row.via;
  if (look.size) row.src = [...look.values()];
  if (mem.size) row.mem = [...mem.values()];
  setVia(row);
}
const prefixed = (key, row) => keyed(key) && rowOk(row);
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
const recheckLog = [], pool = [], verifyLog = [], vpool = [], narrowLog = [], narrowSkipped = [];
const recheckedToday = new Set();   /* "<page> <key>" already in rechecks.jsonl with today's date */
let verified = 0;

const today = new Date().toISOString().slice(0, 10);
if (existsSync(RECHECKS)) for (const l of readFileSync(RECHECKS, "utf8").split("\n").filter(Boolean)){
  const e = JSON.parse(l); if (e.date === today) recheckedToday.add(`${e.page} ${e.key}`);
}
const report = [];
let dirty = false, unchecked = 0, marked = 0, narrowed = 0, viaFixed = 0;

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
  if (Object.values(rows).some(r => r.via && viaFrom(r) !== r.via)) dirty = true;   /* --update brings "via" into line */

  if (flag("--update")){
    for (const key of fresh) rows[key] = { hash: hash(squash(items.get(key))), status: "unchecked" };
    for (const key of changed){
      const old = rows[key], was = old.status, approved = /^(ok|fixed|n\/a)$/.test(was);
      rows[key] = { hash: hash(squash(items.get(key))), status: "unchecked", ...(old.note ? { note: old.note } : {}),
        ...(old.src ? { src: old.src } : {}), ...(old.mem ? { mem: old.mem } : {}), ...(was !== "unchecked" ? { was } : {}),
        /* the approval this row had, so a re-check that failed and was fixed in the text can still be logged against its batch */
        ...(approved ? { wasChecked: old.wasChecked || old.checked || null, wasVia: old.wasVia || viaOf(old) } : {}) };
    }
    for (const key of removed) delete rows[key];
    /* "via" follows the citations (rows recorded before "partial" existed say "memory" when only some were recalled) */
    for (const row of Object.values(rows)) if (row.via){ const v = row.via; setVia(row); if (row.via !== v) viaFixed++; }
    ledger.pages[page] = Object.fromEntries(Object.entries(rows).sort(([a], [b]) => a.localeCompare(b, "en")));
  }

  if (markStatus){
    for (const [key, row] of Object.entries(ledger.pages[page] || {})){
      if (!prefixed(key, row) || !items.has(key) || row.hash !== hash(squash(items.get(key)))) continue;
      if (flag("--unchecked") && row.status !== "unchecked") continue;
      const fixedFirst = flag("--recheck") && row.status === "unchecked" && /^(ok|fixed|n\/a)$/.test(row.was || "") && markStatus === "fixed";
      const before = fixedFirst ? row.was : row.status, batchDate = fixedFirst ? row.wasChecked : row.checked;
      if (flag("--recheck")){
        if (!/^(ok|fixed|n\/a)$/.test(before)) die(`--recheck: ${page} ${key} is "${before}", not an approved row` +
          (row.status === "unchecked" && row.was ? ` (its text changed since it was "${row.was}"; a re-check that failed and was fixed in the text is recorded with --mark fixed)` : ""));
        if (recheckedToday.has(`${page} ${key}`)) die(`--recheck: ${page} ${key} was already re-checked today (see fact-check/rechecks.jsonl)`);
        recheckLog.push({ date: today, seed: one("--seed") || today, page, key, was: before, batch: batchDate || null, wasVia: fixedFirst ? row.wasVia || "unknown" : viaOf(row), wasBy: row.by || null, by: by || null, now: markStatus,
          via: !cited ? null : memArgs.length ? (lookArgs.length ? "partial" : "memory") : "lookup", ...(lookArgs.length ? { lookup: lookArgs } : {}), ...(memArgs.length ? { memory: memArgs } : {}), ...(note ? { note } : {}) });
        row.rechecked = today;
        if (markStatus !== before){ row.status = markStatus; row.checked = today; if (by) row.by = by; }
        if (fixedFirst){ row.status = markStatus; row.checked = today; delete row.rechecked; delete row.was; }
      } else {
        if (markStatus === "unchecked" && before !== "unchecked") row.was = before; else { delete row.was; delete row.wasChecked; delete row.wasVia; }
        row.status = markStatus; row.checked = today; delete row.rechecked;
        if (by && markStatus !== "unchecked") row.by = by; else delete row.by;
      }
      if (cited) cite(row, flag("--recheck") && markStatus === before);   /* a confirming re-check adds to the old citations */
      else if (!flag("--recheck")) delete row.via;                        /* unchecked, n/a: the old src / mem stay as a lead */
      if (note != null){ if (note) row.note = note; else delete row.note; }
      if (row.status !== "unchecked"){ delete row.wasChecked; delete row.wasVia; }
      marked++;
    }
  }

  /* --uncite: take a recalled source off rows it doesn't bear on (a blanket citation set applied with --prefix).
     A provenance fix, not a re-check: status, checked and by stay; the row's note and fact-check/narrowed.jsonl
     say who removed what, when and why. A looked-up citation is never removed this way (verification handles
     those), and a row is never left citing nothing. */
  if (uncite){
    for (const [key, row] of Object.entries(ledger.pages[page] || {})){
      if (!prefixed(key, row) || !items.has(key) || row.hash !== hash(squash(items.get(key)))) continue;
      const gone = (row.mem || []).filter(m => srcId(m) === uncite);
      if (!gone.length) continue;
      if ((row.src || []).some(c => srcId(c) === uncite)){ narrowSkipped.push(`${page} ${key}: ${uncite} is also a look-up citation here; left alone`); continue; }
      const mem = row.mem.filter(m => srcId(m) !== uncite);
      if (!mem.length && !(row.src || []).length){ narrowSkipped.push(`${page} ${key}: ${uncite} is its only source; cite a source that bears on it first (--mark … --memory <id>)`); continue; }
      if (mem.length) row.mem = mem; else delete row.mem;
      if (row.via) setVia(row);
      /* one note per checker and day, however many sources they take off */
      const head = `citation narrowed by ${by}, ${today}: `, item = `${uncite} removed (${note})`;
      row.note = row.note?.startsWith(head) ? row.note.replace(head, `${head}${item}; `) : head + item + (row.note ? ` | ${row.note}` : "");
      narrowLog.push({ date: today, page, key, removed: gone, by, note, status: row.status, via: row.via || null });
      narrowed++;
    }
  }

  /* ---------- independent verification of look-up citations ---------- */
  for (const [key, row] of Object.entries(ledger.pages[page] || {})){
    if (!items.has(key) || row.hash !== hash(squash(items.get(key))) || !/^(ok|fixed|issue)/.test(row.status)) continue;
    for (const c of row.src || []){
      if (typeof c === "string") continue;   /* a look-up recorded before links were required: nothing to follow */
      if (verifyN != null && prefixed(key, row) && c.by !== by && row.by !== by && !(days(c.verified || "1970-01-01", today) < minAge))
        vpool.push({ page, key, row, c, text: items.get(key) });
      if (verifyResult && keyed(key) && c.id === citeArg){
        if (c.by === by || row.by === by) die(`--verify: ${by} made this check, so can't verify it; verification has to be independent`);
        verifyLog.push({ date: today, page, key, cite: c.id, at: c.at, url: c.url, checkedBy: c.by || row.by || null, by, result: verifyResult, ...(note ? { note } : {}) });
        if (verifyResult === "confirmed" || verifyResult === "partial"){
          c.verified = today; c.verifiedBy = by;
          /* partial: the look-up is real and backs part of the row; say which part it doesn't back */
          if (verifyResult === "partial"){ c.partial = note; row.note = `partial on verification by ${by}, ${today}: ${note}` + (row.note ? ` | ${row.note}` : ""); }
          else delete c.partial;
        }
        else {
          /* the look-up can't be reproduced: keep it only as a recollection */
          row.src = row.src.filter(x => x !== c);
          row.mem = [...new Set([...(row.mem || []), `${c.id}:${c.at}`])];
          if (!row.src.length) delete row.src;
          setVia(row);
          row.note = `${verifyResult} on verification by ${by}, ${today}${note ? ": " + note : ""}` + (row.note ? ` | ${row.note}` : "");
          if (verifyResult === "not-supported"){ row.was = row.status; row.status = "unchecked"; row.checked = today; }
        }
        verified++;
      }
    }
  }

  const live = ledger.pages[page] || {};
  const counts = { items: items.size, unchecked: 0, ok: 0, fixed: 0, "n/a": 0, issue: 0, lookup: 0, partial: 0, memory: 0, "via?": 0 };
  for (const key of items.keys()){
    const row = live[key];
    const st = !row || row.hash !== hash(squash(items.get(key))) ? "unchecked" : row.status.startsWith("issue") ? "issue" : row.status;
    counts[st]++;
    if (st === "unchecked" && prefixed(key, row)) unchecked++;
    if (/^(ok|fixed|issue)$/.test(st)) counts[{ lookup: "lookup", partial: "partial", memory: "memory" }[viaOf(row)] || "via?"]++;
    if (flag("--list") && prefixed(key, row) && (flag("--all") || st === "unchecked"))
      console.log(`${page} ${key} [${row && row.hash === hash(squash(items.get(key))) ? row.status + (st === "n/a" ? "" : ", via " + viaOf(row)) : "unchecked"}]\n    ${squash(items.get(key)).slice(0, flag("--full") ? Infinity : 400)}`);
    /* approved, current, and not (re)checked in the last --min-age days: eligible for a random re-check */
    if (sampleN != null && /^(ok|fixed|n\/a)$/.test(st) && prefixed(key, row) && !recheckedToday.has(`${page} ${key}`) && !(days(row.rechecked || row.checked || "1970-01-01", today) < minAge))
      pool.push({ page, key, row, text: items.get(key) });
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
if ((markStatus || verifyResult || uncite) && dirty && !flag("--update"))
  die("The ledger is out of date for the selected pages: run with --update first. Nothing was marked or logged.");
if (verifyResult && !verified) die(`--verify: no current look-up citation "${citeArg}" on that key (or the row isn't approved)`);
if (flag("--update") || markStatus || verified || narrowed) writeFileSync(LEDGER, format(ledger));
if (narrowLog.length) appendFileSync(NARROWED, narrowLog.map(r => JSON.stringify(r)).join("\n") + "\n");
if (verifyLog.length) appendFileSync(VERIFICATIONS, verifyLog.map(r => JSON.stringify(r)).join("\n") + "\n");
if (recheckLog.length) appendFileSync(RECHECKS, recheckLog.map(r => JSON.stringify(r)).join("\n") + "\n");

/* ---------- fact-check/status.js: the per-section summary that fact-check.html draws ----------
   Counts only (no keys or text), from the ledger as it now stands, so it is small and loads from file://.
   Sections are found by pattern, so new pages and systems show up without touching this:
   "<block>:<first path segment>", with every glossary, all code and the organ header collapsed into one each. */
const SECTION_LABELS = {
  "body-content:topics": "Topics", "body-content:systems": "Body systems", "body-content:journey": "Cell ride",
  "body-content:breath": "Breath ride", "body-content:bite": "Bite ride", "body-content:urine": "Drop ride",
  "body-content:impulse": "Impulse ride", "body-content:cascade": "Hormone ride", "body-content:infection": "Infection ride",
  "body-content:sleepStages": "Sleep stages", "body-content:subject": "The subject", "body-hours": "Hour by hour",
  "organ-meta": "Header & stats", glossary: "Glossary", code: "Model & code",
  "organ-content:sections": "Sections", "organ-content:parts": "Parts", "organ-content:phases": "Through the day",
  "organ-content:lens": "Body-systems lens", "organ-content:alter": "Changes & scenarios", "organ-content:conditions": "Conditions",
  "organ-content:control": "Control of breathing", "organ-content:occlusions": "Occlusions", "organ-content:pulse": "Pulse",
  "organ-content:rhythms": "Rhythms", "organ-content:stages": "Sleep stages", "organ-content:strokes": "Strokes",
  "organ-content:dx": "Diagnosis", "organ-content:hp": "H. pylori", "organ-content:msgs": "Messages",
  "organ-content:nacOpts": "Paracetamol antidote", "organ-content:ab": "Acid–base", "organ-content:adh": "ADH",
  "organ-content:cycle": "Cross-bridge cycle", "organ-content:fibres": "Fibre types", "organ-content:adapt": "Training table",
};
const sectionOf = key => {
  const i = key.indexOf(":"), block = key.slice(0, i), first = key.slice(i + 1).split(".")[0];
  if (/^(const|mod|fn)$/.test(block)) return "code";
  if (block.endsWith("-glossary")) return "glossary";
  if (block === "organ-meta" || block === "body-hours") return block;
  return `${block}:${first}`;
};
const sectionLabel = id => SECTION_LABELS[id] || (s => s[0].toUpperCase() + s.slice(1))(id.split(":").pop().replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());
const SECTION_ORDER = ["organ-meta", "code", "glossary"];   /* these go last, in this order; the rest keep first-seen order */
function statusJs(){
  const pageName = {};
  for (const { id, path, engine } of pageFiles()){
    if (engine){ pageName[id] = "Shared organ engine"; continue; }
    if (id === "body"){ pageName[id] = "Body view (main page)"; continue; }
    const m = readFileSync(path, "utf8").match(/<script type="application\/json" id="organ-meta">([\s\S]*?)<\/script>/);
    try { pageName[id] = JSON.parse(m[1]).name; } catch { pageName[id] = id; }
  }
  let updated = "", verifiedCites = 0, lookupCites = 0;
  const pages = Object.entries(ledger.pages).map(([id, rows]) => {
    const secs = new Map();
    for (const [key, row] of Object.entries(rows)){
      const sid = sectionOf(key);
      const s = secs.get(sid) || secs.set(sid, { id: sid, label: sectionLabel(sid), n: 0,
        src: { lookup: 0, partial: 0, memory: 0, unknown: 0, na: 0, changed: 0, unchecked: 0 },
        out: { ok: 0, fixed: 0, issue: 0, na: 0, unchecked: 0 }, levels: {}, issues: [] }).get(sid);
      const st = row.status, approved = /^(ok|fixed|issue)/.test(st);
      s.n++;
      s.src[st === "n/a" ? "na" : st === "unchecked" ? (row.was ? "changed" : "unchecked") : { lookup: "lookup", partial: "partial", memory: "memory" }[row.via] || "unknown"]++;
      s.out[st === "n/a" ? "na" : st.startsWith("issue") ? "issue" : st]++;
      if (st.startsWith("issue")){ const n = Number(st.slice(7)); if (!s.issues.includes(n)) s.issues.push(n); }
      const lv = key.match(/\.(ms|hs|college|phd)$/);
      if (lv){ const l = (s.levels[lv[1]] ||= [0, 0]); l[1]++; if (approved || st === "n/a") l[0]++; }
      if (row.checked && row.checked > updated) updated = row.checked;
      if (row.rechecked && row.rechecked > updated) updated = row.rechecked;
      for (const c of row.src || []) if (typeof c === "object"){ lookupCites++; if (c.verified) verifiedCites++; }
    }
    const sections = [...secs.values()].sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));
    return { id, name: pageName[id] || id, sections };
  });
  const done = p => { let n = 0, d = 0; for (const s of p.sections){ n += s.n; d += s.n - s.src.unchecked - s.src.changed; } return n ? d / n : 0; };
  /* the body view first, the shared engine last, organ pages by how far their check has got */
  pages.sort((a, b) => (a.id === "body" ? -1 : b.id === "body" ? 1 : 0) || (a.id === "engine") - (b.id === "engine") || done(b) - done(a) || a.name.localeCompare(b.name));
  const data = { updated, lookupCites, verifiedCites, rechecks: existsSync(RECHECKS) ? readFileSync(RECHECKS, "utf8").split("\n").filter(Boolean).length : 0, pages };
  return "/* Generated by node fact-check/scan.mjs from fact-check/ledger.json; drawn by fact-check.html. Don't edit by hand. */\n" +
    "window.FACT_STATUS = " + JSON.stringify(data) + ";\n";
}
const STATUS = join(root, "fact-check", "status.js");
const statusStale = () => !existsSync(STATUS) || readFileSync(STATUS, "utf8") !== statusJs();
if ((flag("--update") || markStatus || verified || narrowed || flag("--status")) && statusStale()) writeFileSync(STATUS, statusJs());
if (flag("--status")){ console.log(`wrote ${STATUS.slice(root.length + 1)}`); process.exit(0); }

/* ---------- random re-check: a uniform sample, so the failure rate estimates the error rate of approvals ---------- */
function rng(s){
  let a = parseInt(createHash("sha1").update(String(s)).digest("hex").slice(0, 8), 16);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
if (sampleN != null){
  const r = rng(seed), pick = [...pool];
  for (let i = pick.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
  const chosen = pick.slice(0, sampleN).sort((a, b) => a.page.localeCompare(b.page) || a.key.localeCompare(b.key, "en"));
  console.log(`Random re-check: ${chosen.length} of ${pool.length} eligible approved items (seed "${seed}", not (re)checked in the last ${minAge} days)\n`);
  for (const { page, key, row, text } of chosen){
    console.log(`${page} ${key} [${row.status}, via ${viaOf(row)}, checked ${row.checked || "?"}${row.rechecked ? ", rechecked " + row.rechecked : ""}]`);
    for (const c of row.src || []) console.log(`    looked up: ${srcText(c)}${c.url ? "  " + c.url : ""}${c.by ? "  (by " + c.by + ")" : ""}`);
    if (row.mem?.length) console.log(`    from memory: ${row.mem.join("; ")}`);
    if (row.note) console.log(`    note: ${row.note}`);
    console.log(`    ${squash(text).slice(0, flag("--full") ? Infinity : 1200)}\n`);
  }
  if (chosen.length) console.log(`Record each result with:\n  node fact-check/scan.mjs --page <page> --key <key> --recheck --mark <ok|fixed|n/a|"issue #n"|unchecked> --by <you> --lookup <id>:<locator> --url <link> --quote "…" | --memory <id> [--note "…"] --seed ${seed}`);
  process.exit(0);
}

/* ---------- independent verification: a uniform sample of look-up citations ---------- */
if (verifyN != null){
  const r = rng(seed), pick = [...vpool];
  for (let i = pick.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
  const chosen = pick.slice(0, verifyN);
  console.log(`Verification sample: ${chosen.length} of ${vpool.length} look-up citations not made by ${by} (seed "${seed}", not verified in the last ${minAge} days)\n`);
  console.log(`For each: open the link, find the excerpt at the locator, read the passage around it, and judge with only the claim and the passage in front of you:
    List the factual claims in the row. For each, answer SUPPORTED, CONTRADICTED or NOT IN PASSAGE, quoting the sentence
    that decides it. Flag any mismatch of drug, dose, number, unit, population, direction of effect or structure name.
  Any CONTRADICTED → not-supported. All SUPPORTED → confirmed. SUPPORTED and NOT IN PASSAGE → partial, with a --note naming
  the claims the passage doesn't cover. A dead link → link-broken; an excerpt that isn't where the locator says → wrong-locator.\n`);
  for (const { page, key, row, c, text } of chosen){
    const l = links[c.url];
    console.log(`${page} ${key} [${row.status}, checked by ${c.by || row.by || "?"} on ${row.checked}]`);
    console.log(`    claim:   ${squash(text).slice(0, flag("--full") ? Infinity : 1200)}`);
    console.log(`    source:  ${sources[c.id]?.cite || c.id}`);
    console.log(`    at:      ${c.at}`);
    console.log(`    link:    ${c.url}${l ? `  (link check ${l.checked}: ${l.state}${l.code ? " " + l.code : ""})` : ""}`);
    console.log(`    excerpt: "${c.quote}"`);
    if (paperFromUrl(c.url)) console.log(`    read:    node fact-check/fetch.mjs ${c.id} --find ${JSON.stringify(c.quote)}   (counts as opening the link)`);
    console.log(`    record:  node fact-check/scan.mjs --page ${page} --key '${key}' --cite ${c.id} --by ${by} --verify <confirmed|partial|link-broken|wrong-locator|not-supported> [--note "…"]\n`);
  }
  process.exit(0);
}

/* ---------- quote check: does every look-up linked to a paper quote that paper? ---------- */
if (flag("--check-quotes")){
  const todo = [];
  for (const [page, rows] of Object.entries(ledger.pages)) if (selected(page)) for (const [key, row] of Object.entries(rows))
    for (const c of row.src || []) if (typeof c === "object" && keyed(key) && rowOk(row)) todo.push({ page, key, c });
  let checked = 0, other = 0;
  const bad = [], unchecked = [];
  for (const t of todo){
    const r = await checkQuote(t.c.url, t.c.quote, paperIds(t.c.id));
    if (!r){ other++; continue; }
    checked++;
    const why = quoteProblem(r);
    if (why) bad.push(`${t.page} ${t.key} (${t.c.id}:${t.c.at}): ${why}\n      quote: ${JSON.stringify(t.c.quote)}\n      url:   ${t.c.url}`);
    else if (r.state === "unchecked") unchecked.push(`${t.page} ${t.key} (${t.c.id}): ${r.why}`);
  }
  console.log(`Quotes: ${todo.length} look-up citation(s) in the selection; ${checked} link to a paper in Europe PMC, PubMed or PMC and were checked, ${other} link elsewhere. ${bad.length} problem(s).`);
  if (bad.length) console.log("\n" + bad.join("\n\n"));
  if (unchecked.length) console.log(`\n${unchecked.length} couldn't be checked (closed full text):\n  ` + unchecked.join("\n  "));
  process.exit(bad.length ? 1 : 0);
}

/* ---------- link check: is every look-up link still alive? ---------- */
if (flag("--check-links")){
  const maxAge = Number(one("--max-age") ?? 30), uses = {};
  for (const [page, rows] of Object.entries(ledger.pages)) if (selected(page)) for (const [key, row] of Object.entries(rows))
    for (const c of row.src || []) if (typeof c === "object" && keyed(key) && rowOk(row)) (uses[c.url] ||= []).push(`${page} ${key} (${c.id})`);
  const due = Object.keys(uses).filter(u => !(links[u] && days(links[u].checked, today) < maxAge));
  const res = await probeAll(due);
  const bad = Object.entries(uses).filter(([u]) => (res[u] || links[u])?.state === "broken");
  const blocked = due.filter(u => res[u]?.state === "blocked");
  console.log(`Links: ${Object.keys(uses).length} in the selection, ${due.length - blocked.length} checked now, ${bad.length} broken.`);
  if (blocked.length) console.log(`\n${blocked.length} link(s) not checked: this environment's network doesn't allow their hosts (${[...new Set(blocked.map(u => new URL(u).hostname))].sort().join(", ")}). They stay due; check them from an environment that allows those hosts.`);
  for (const [u, at] of bad) console.log(`\n${u}  (${(res[u] || links[u]).code || (res[u] || links[u]).error})\n  ` + at.join("\n  "));
  const login = Object.keys(uses).filter(u => links[u]?.state === "login").length;
  if (login) console.log(`\n${login} link(s) answer with a login or robot block (401/403/429): fine for a verifier with access, but confirm by hand once.`);
  process.exit(bad.length ? 1 : 0);
}

/* ---------- re-check results ---------- */
if (flag("--recheck-stats")){
  const log = existsSync(RECHECKS) ? readFileSync(RECHECKS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
  const group = by => { const g = {}; for (const e of log){ const k = by(e); (g[k] ||= { rechecked: 0, failed: 0 }).rechecked++; if (e.now !== e.was) g[k].failed++; } return g; };
  for (const [title, by] of [["page", e => e.page], ["approval batch (page, checked date)", e => `${e.page} ${e.batch || "?"}`],
    ["how the approval was checked", e => e.wasVia || "unknown"]]){
    console.log(`By ${title}:`);
    for (const [k, v] of Object.entries(group(by)).sort()) console.log(`  ${k.padEnd(28)} ${String(v.rechecked).padStart(4)} rechecked  ${String(v.failed).padStart(3)} failed  ${(100 * v.failed / v.rechecked).toFixed(0).padStart(3)}%`);
    console.log("");
  }
  if (!log.length) console.log("No re-checks logged yet.");
  const vlog = existsSync(VERIFICATIONS) ? readFileSync(VERIFICATIONS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
  console.log("\nIndependent verifications of look-up citations:");
  if (!vlog.length) console.log("  none logged yet.");
  for (const [title, f] of [["checker", e => e.checkedBy || "?"], ["page", e => e.page], ["result", e => e.result]]){
    const g = {};
    /* partial is not a failure: the look-up is real, it just backs less than the whole row */
    for (const e of vlog){ const k = f(e); const x = (g[k] ||= { n: 0, failed: 0, partial: 0 }); x.n++; if (e.result === "partial") x.partial++; else if (e.result !== "confirmed") x.failed++; }
    if (vlog.length) console.log(`  by ${title}:\n` + Object.entries(g).sort().map(([k, v]) => `    ${k.padEnd(28)} ${String(v.n).padStart(4)} verified  ${String(v.failed).padStart(3)} failed  ${(100 * v.failed / v.n).toFixed(0).padStart(3)}%${v.partial ? `  (${v.partial} partial)` : ""}`).join("\n"));
  }
  process.exit(0);
}

/* ---------- the source registry ---------- */
if (flag("--sources")){
  const uses = {}, unknown = [], nosrc = [], nolink = [];
  const use = (s, how, page, key) => sources[srcId(s)] ? ((uses[srcId(s)] ||= { lookup: 0, memory: 0 })[how]++) : unknown.push(`${page} ${key}: ${s}`);
  for (const [page, rows] of Object.entries(ledger.pages)) for (const [key, row] of Object.entries(rows)){
    for (const s of row.src || []){ use(s, "lookup", page, key); if (typeof s === "string") nolink.push(`${page} ${key}: ${s}`); }
    for (const s of row.mem || []) use(s, "memory", page, key);
    if (/^(ok|fixed|issue)/.test(row.status) && !row.src?.length && !row.mem?.length) nosrc.push(`${page} ${key} [${row.status}]${row.note ? " — " + row.note : ""}`);
  }
  console.log(`${"id".padEnd(16)} looked up  recalled  access    kind`);
  for (const [id, s] of Object.entries(sources))
    console.log(`${id.padEnd(16)} ${String(uses[id]?.lookup || 0).padStart(9)}  ${String(uses[id]?.memory || 0).padStart(8)}  ${(s.access || "?").padEnd(8)}  ${s.kind.padEnd(9)} ${s.review && s.review <= today ? "REVIEW DUE " + s.review + "  " : ""}${s.cite}`);
  const noAccess = Object.keys(sources).filter(id => !sources[id].access);
  if (noAccess.length) console.log(`\nSources with no "access" recorded (${noAccess.length}): ${noAccess.join(", ")}`);
  if (unknown.length) console.log(`\nUnknown source ids (${unknown.length}):\n  ` + unknown.join("\n  "));
  if (nolink.length) console.log(`\nLook-ups with no link (${nolink.length}): re-cite them with --url and --quote, or move them to --memory:\n  ` + nolink.join("\n  "));
  const byStatus = nosrc.reduce((n, l) => (n[l.match(/\[(\w+)/)[1]] = (n[l.match(/\[(\w+)/)[1]] || 0) + 1, n), {});
  if (nosrc.length) console.log(`\nApproved or filed rows that cite no source and have no "via" (${nosrc.length}: ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(", ")})` +
    (flag("--full") ? ":\n  " + nosrc.join("\n  ") : "; add --full to list them"));
  process.exit(0);
}

if (!flag("--list")){
  const cols = ["page", "items", "unchecked", "ok", "fixed", "n/a", "issue", "lookup", "partial", "memory", "via?", "new", "changed", "removed"];
  const w = cols.map(c => Math.max(c.length, ...report.map(r => String(r[c]).length)));
  const line = r => cols.map((c, i) => String(r[c]).padStart(w[i])).join("  ");
  console.log(line(Object.fromEntries(cols.map(c => [c, c]))));
  report.forEach(r => console.log(line(r)));
  if (verified) console.log(`\nrecorded ${verified} verification(s) "${verifyResult}" (logged to fact-check/verifications.jsonl)`);
  if (markStatus) console.log(`\nmarked ${marked} item(s) "${markStatus}"${flag("--recheck") ? " as a re-check (logged to fact-check/rechecks.jsonl)" : ""}`);
  if (uncite){
    console.log(`\nnarrowed ${narrowed} row(s): ${uncite} removed (logged to fact-check/narrowed.jsonl)`);
    if (narrowSkipped.length) console.log(`${narrowSkipped.length} left alone:\n  ` + narrowSkipped.join("\n  "));
  }
  if (viaFixed) console.log(`\n"via" brought into line with the citations on ${viaFixed} row(s)`);
  if (dirty && !flag("--update")) console.log("\nThe ledger is out of date: run with --update.");
}
if (flag("--check") && !flag("--update") && statusStale()){ console.log("\nfact-check/status.js is out of date: run with --status."); process.exit(1); }
if (flag("--check") && (unchecked || (dirty && !flag("--update")))) process.exit(1);
