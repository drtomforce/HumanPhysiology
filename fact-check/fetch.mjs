#!/usr/bin/env node
/* Read a paper through Europe PMC before citing it with --lookup (FACT_CHECK_PLAN.md, step 3).
   Publishers' pages and PubMed serve robot checks and cookie walls to scripts, so don't WebFetch them to
   check a paper: fetch it here, read what this prints, and quote from it.

     node fact-check/fetch.mjs <source id>              the paper's record: title, authors, journal, year, whether it
                                                        matches the cite in sources.json, retractions and corrections,
                                                        whether the full text is open, the links to cite, the abstract
     node fact-check/fetch.mjs <source id> --full       … and the full text, when it is in Europe PMC's open-access
                                                        subset, paragraph by paragraph, each with its locator
     node fact-check/fetch.mjs <source id> --find "<excerpt>"   (repeatable) is the excerpt in the abstract, or in the
                                                        open full text? Prints where, and the --lookup, --url and --quote
                                                        to give scan.mjs. Exit 1 if any excerpt isn't there verbatim
     node fact-check/fetch.mjs --audit [--cites-only]   every paper in sources.json with a PMID, DOI or PMCID: does its
         [--id <source id>] (repeatable)                record match the cite, has it been retracted or corrected, and is
                                                        its "access" right? --cites-only: only papers the ledger cites.
                                                        Exit 1 if a cited paper is retracted or under an expression of concern
   A <source id> can also be PMID:<n>, DOI:<doi> or PMC<n>, to read a paper before it is in sources.json.
   --refresh fetches again instead of using fact-check/cache/ (kept 30 days, git-ignored; never commit it).

   What counts as a look-up (FACTUAL_CHECK.md#looked-up-or-from-memory): the abstract or full text printed here,
   read in this session. An excerpt from the abstract supports only what the abstract says: if the claim needs a
   number from inside a closed paper, cite it with --memory. Needs www.ebi.ac.uk and api.crossref.org; behind an
   HTTPS proxy it re-runs itself with Node using it (fact-check/net.mjs). No dependencies. */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useEnvProxy } from "./net.mjs";
import { recordFor, fullTextXML, abstractUnits, fullTextUnits, locate, notices, agrees, access, abstractUrl, fullTextUrl, readingUrls, citeDoi } from "./epmc.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(readFileSync(join(here, "sources.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const many = f => argv.flatMap((a, i) => a === f && argv[i + 1] != null ? [argv[i + 1]] : []);
const VALUED = new Set(["--find", "--id"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUED.has(argv[i - 1]));
const finds = many("--find"), maxAge = flag("--refresh") ? 0 : 30;
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
if (!flag("--audit") && positional.length !== 1) die("give one source id (or PMID:<n>, DOI:<doi>, PMC<n>), or --audit; see the top of fact-check/fetch.mjs");
for (const q of finds) if (q.replace(/\s+/g, " ").trim().length < 8) die(`--find: give at least 8 characters (got "${q}")`);
useEnvProxy();

/* a source id from sources.json, or an identifier given directly */
function resolve(arg){
  if (sources[arg]) { const s = sources[arg]; return { id: arg, cite: s.cite, kind: s.kind, accessField: s.access, ids: { pmid: s.pmid, doi: s.doi || citeDoi(s.cite), pmcid: s.pmcid } }; }
  let m;
  if ((m = arg.match(/^pmid:(\d+)$/i))) return { id: null, ids: { pmid: m[1] } };
  if ((m = arg.match(/^doi:(10\.\S+)$/i))) return { id: null, ids: { doi: m[1] } };
  if ((m = arg.match(/^(PMC\d+)$/i))) return { id: null, ids: { pmcid: m[1].toUpperCase() } };
  die(`${arg}: not in fact-check/sources.json, and not PMID:<n>, DOI:<doi> or PMC<n>`);
}
const wrap = (s, w = 100, pad = "    ") => s.replace(new RegExp(`(.{1,${w}})(\\s+|$)`, "g"), `${pad}$1\n`).trimEnd();

/* ---------- --audit ---------- */
if (flag("--audit")){
  const ledger = JSON.parse(readFileSync(join(here, "ledger.json"), "utf8")).pages, cites = {};
  for (const rows of Object.values(ledger)) for (const r of Object.values(rows))
    for (const c of [...(r.src || []), ...(r.mem || [])]){ const id = typeof c === "string" ? c.split(":")[0] : c.id; cites[id] = (cites[id] || 0) + 1; }
  const want = many("--id");
  for (const id of want) if (!sources[id]) die(`${id}: not in sources.json`);
  const todo = Object.keys(sources).filter(id => (!want.length || want.includes(id)) && (!flag("--cites-only") || cites[id]))
    .map(resolve).filter(s => s.ids.pmid || s.ids.doi || s.ids.pmcid);
  console.log(`Auditing ${todo.length} source(s) with a PMID, DOI or PMCID (3 at a time; a few seconds each through a proxy)…`);
  const res = new Map(); let next = 0;
  await Promise.all([1, 2, 3].map(async () => { while (next < todo.length){ const s = todo[next++];
    try { const r = await recordFor(s.ids, maxAge); res.set(s.id, { r, n: await notices(r, r?.doi || s.ids.doi, maxAge) }); }
    catch (e){ res.set(s.id, { err: e.message }); } } }));
  const serious = [], minor = [], mismatch = [], missing = [], accessFix = [], errors = [];
  for (const s of todo){
    const { r, n = [], err } = res.get(s.id), used = cites[s.id] ? ` (cited by ${cites[s.id]} row(s))` : " (not cited)";
    if (err){ errors.push(`${s.id}: ${err}`); continue; }
    for (const x of n) (x.serious ? serious : minor).push(`${s.id}${used}: ${x.kind}${x.ref ? " " + x.ref : ""} [${x.from}]`);
    if (!r){ if (!n.length) missing.push(`${s.id}: no Europe PMC record for ${s.ids.pmid ? "PMID " + s.ids.pmid : s.ids.doi ? "DOI " + s.ids.doi : s.ids.pmcid}`); continue; }
    const a = agrees(r, s.cite || "");
    if (!a.ok) mismatch.push(`${s.id}${used}: ${a.why}\n      record: ${r.authorString?.slice(0, 50)}. ${r.title} ${r.journalTitle} ${r.pubYear}\n      cite:   ${s.cite}`);
    /* only where "access" is missing, or Europe PMC shows a "subscription" paper is free to read: a paper not
       free in Europe PMC may still be free on the publisher's site, so "open" is left alone */
    const acc = access(r), should = acc.free ? "open" : "subscription";
    if (!s.accessField || (acc.free && s.accessField !== "open"))
      accessFix.push(`${s.id}: "access" is ${s.accessField || "not set"}; Europe PMC says ${acc.free ? "free to read" + (acc.openSubset ? " (open-access subset)" : "") : "not free to read there"} → "${should}"`);
  }
  const show = (title, list) => { if (list.length) console.log(`\n${title} (${list.length}):\n  ` + list.join("\n  ")); };
  show("RETRACTED, WITHDRAWN OR UNDER AN EXPRESSION OF CONCERN: re-check every row that cites these", serious);
  show("Corrections, errata and unconfirmed notices: check they don't touch what the rows cite", minor);
  show("Record doesn't match the cite: a wrong identifier or a mixed-up citation", mismatch);
  show("Not found", missing);
  show("\"access\" to set (fill it in by hand; a paper not free in Europe PMC may still be free on the publisher's site, so check before writing \"subscription\")", accessFix);
  show("Errors (try again later)", errors);
  console.log(`\n${todo.length} audited: ${serious.length} serious notice(s), ${minor.length} correction(s), ${mismatch.length} mismatch(es), ${missing.length} not found, ${accessFix.length} access to check, ${errors.length} error(s).`);
  process.exit(serious.some(x => !/\(not cited\)/.test(x)) ? 1 : 0);
}

/* ---------- one paper ---------- */
const s = resolve(positional[0]);
const r = await recordFor(s.ids, maxAge);
if (!r) die(`${s.id || positional[0]}: no Europe PMC record for ${JSON.stringify(s.ids)}. If the identifiers are right, the paper isn't indexed there: read it some other way, or cite it with --memory.`, 1);
const acc = access(r), n = await notices(r, r.doi || s.ids.doi, maxAge);
const label = s.id || "<add it to sources.json first>";
console.log(`${s.id ? s.id + "  " : ""}PMID ${r.pmid || "–"}  DOI ${r.doi || "–"}  ${r.pmcid || ""}`);
console.log(`  ${r.authorString}\n  ${r.title}\n  ${r.journalInfo?.journal?.isoabbreviation || r.journalTitle || ""} ${r.pubYear};${r.journalInfo?.volume || ""}${r.journalInfo?.issue ? "(" + r.journalInfo.issue + ")" : ""}:${r.pageInfo || ""}  [${(r.pubTypeList?.pubType || []).join(", ")}]`);
if (s.cite){ const a = agrees(r, s.cite); console.log(a.ok ? "  matches the cite in sources.json" : `  DOESN'T MATCH the cite in sources.json (${a.why}): check the identifier before citing\n  cite: ${s.cite}`); }
for (const x of n) console.log(`  ${x.serious ? "WARNING: " : ""}${x.kind}${x.ref ? " " + x.ref : ""} [${x.from}]`);
if (n.some(x => x.serious)) console.log("  A retracted paper, or one under an expression of concern, is not a source for a claim.");
console.log(`  full text: ${acc.openSubset ? "open-access subset (--full prints it)" : acc.free ? "free to read in Europe PMC, but not in the open-access subset, so not fetched here (read it in a browser)" : "not free in Europe PMC: the abstract is all there is here"}`);
console.log(`  to cite:   ${r.pmid ? abstractUrl(r.pmid) + "  (abstract)" : "–"}${acc.openSubset && r.pmcid ? "\n             " + fullTextUrl(r.pmcid) + "  (full text)" : ""}`);
console.log(`  to read:   ${readingUrls(r).join("  ")}`);
if (s.id && s.accessField == null) console.log(`  sources.json has no "access" for ${s.id}: ${acc.free ? 'set it to "open"' : '"subscription", unless the publisher\'s site has it free (then "open")'}`);

const abs = abstractUnits(r);
let full = [];
if ((flag("--full") || finds.length) && acc.openSubset && r.pmcid) full = fullTextUnits(await fullTextXML(r.pmcid, maxAge));
if (!finds.length){
  console.log(abs.length ? "\nAbstract:" : "\nNo abstract in Europe PMC.");
  for (const u of abs) console.log(`  [${u.where}]\n${wrap(u.text)}`);
  if (flag("--full")){
    if (!acc.openSubset) console.log("\nNo full text: the paper isn't in Europe PMC's open-access subset.");
    else { console.log(`\nFull text (${full.length} paragraphs, captions and table rows):`); for (const u of full) console.log(`  [${u.where}]\n${wrap(u.text)}`); }
  }
  process.exit(0);
}

/* ---------- --find ---------- */
if (n.some(x => x.serious)) die(`\n${s.id || positional[0]} is retracted, withdrawn or under an expression of concern: not a source for a look-up. Find another source.`, 1);
let missingN = 0;
console.log("");
for (const q of finds){
  const inAbs = locate(abs, q), inFull = locate(full, q), hit = inAbs[0] || inFull[0];
  const url = inAbs[0] ? abstractUrl(r.pmid) : fullTextUrl(r.pmcid);
  if (!hit){
    missingN++;
    console.log(`NOT FOUND: "${q}"\n  not in the abstract${acc.openSubset ? " or the open full text" : " (the full text isn't open here)"}. Don't cite it as a look-up from this source.`);
    continue;
  }
  if (hit.how === "loose") missingN++;
  console.log(`${hit.how === "exact" ? "FOUND" : "FOUND, BUT NOT VERBATIM (case, spacing or punctuation differ)"} in ${hit.where}: "${q}"\n  ${hit.context}`);
  if (inAbs[0] && !r.pmid) { console.log("  (no PMID, so there is no abstract link to cite)"); continue; }
  const quote = hit.how === "exact" ? q : hit.found;
  if (hit.how === "loose") console.log(`  copy the source's own wording: "${hit.found}"`);
  console.log(`  --lookup "${label}:${hit.where}" --url "${url}" --quote ${JSON.stringify(quote)}`);
}
process.exit(missingN ? 1 : 0);
