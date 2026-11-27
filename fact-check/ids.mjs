#!/usr/bin/env node
/* Identifiers for the papers in fact-check/sources.json: doi, pmid, pmcid (FACT_CHECK_PLAN.md, step 2).
   They let a checker fetch a paper's abstract or full text from Europe PMC instead of the publisher's page.

     node fact-check/ids.mjs                  report: for each paper, review and guideline, the identifiers it has,
                                              what Europe PMC holds for the DOI in its cite, and any mismatch
     node fact-check/ids.mjs --write          … and write the ones that are certain: the DOI already in the cite,
                                              and the PMID and PMCID of the Europe PMC record with that exact DOI,
                                              when its title and year agree with the cite
     node fact-check/ids.mjs --search         for papers with no DOI in sources.json: candidate matches from Crossref
                                              and Europe PMC, for a person to confirm. Never writes. A confirmed match
                                              goes into sources.json by hand: "doi", and "pmid" / "pmcid" if it has them
     [--id <source id>] (repeatable)          only these sources

   Fields, all optional: "doi" (as 10.xxxx/…, no https://doi.org/), "pmid" (digits), "pmcid" (PMC…).
   Sources with no DOI and no PubMed record (most guidelines, standards and books) stay without them.
   Untouched lines of sources.json are kept byte for byte. Needs network access to www.ebi.ac.uk and
   api.crossref.org; behind an HTTPS proxy it re-runs itself with Node using it (fact-check/net.mjs).
   No dependencies. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useEnvProxy } from "./net.mjs";
import { getJSON, search as epmcSearch, norm, agrees, citeDoi, surname } from "./epmc.mjs";

const SOURCES = join(dirname(fileURLToPath(import.meta.url)), "sources.json");
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const ids = argv.flatMap((a, i) => a === "--id" && argv[i + 1] ? [argv[i + 1]] : []);
const write = flag("--write"), search = flag("--search");
if (write && search) { console.error("--write and --search: one at a time"); process.exit(2); }
useEnvProxy();

const epmc = q => epmcSearch(q, "lite", 5);

/* ---------- sources.json, line by line, so untouched lines stay as they are ---------- */
const raw = readFileSync(SOURCES, "utf8"), lines = raw.split("\n"), sources = JSON.parse(raw), at = {};
lines.forEach((l, i) => { const m = l.match(/^ ("[^"]+"): \{/); if (m) at[JSON.parse(m[1])] = i; });
const fmtEntry = (id, v, comma) => ` ${JSON.stringify(id)}: {${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(", ")}}${comma ? "," : ""}`;
function setIds(id, add){
  const v = sources[id]; let changed = false;
  for (const [k, x] of Object.entries(add)) if (x && v[k] !== x){ if (v[k]) throw new Error(`${id}: ${k} is ${v[k]} in sources.json, Europe PMC says ${x}: settle it by hand`); v[k] = x; changed = true; }
  if (changed) lines[at[id]] = fmtEntry(id, v, lines[at[id]].trimEnd().endsWith(","));
  return changed;
}

const PAPERS = new Set(["primary", "review", "guideline"]);
const todo = Object.entries(sources).filter(([id, s]) => PAPERS.has(s.kind) && (!ids.length || ids.includes(id)));
if (ids.length) for (const id of ids) if (!sources[id]) { console.error(`${id}: not in sources.json`); process.exit(2); }

/* ---------- --search: candidates for papers with no DOI ---------- */
if (search){
  const missing = todo.filter(([, s]) => !s.doi && !citeDoi(s.cite));
  console.log(`${missing.length} paper(s) with no DOI. Candidates only: confirm each against the cite before adding it to sources.json.\n`);
  for (const [id, s] of missing){
    console.log(`${id}\n  cite:     ${s.cite}`);
    const seen = new Set();
    try {
      const cr = (await getJSON(`https://api.crossref.org/works?rows=3&select=DOI,title,issued,container-title,author&query.bibliographic=${encodeURIComponent(s.cite)}`))?.message?.items || [];
      for (const it of cr){
        const rec = { title: (it.title || [""])[0], year: it.issued?.["date-parts"]?.[0]?.[0] };
        const a = agrees(rec, s.cite), au = norm(it.author?.[0]?.family || "");
        seen.add(it.DOI.toLowerCase());
        console.log(`  ${a.ok && au === surname(s.cite) ? "LIKELY  " : "        "} crossref  doi ${it.DOI}  ${rec.year || "?"}  ${it.author?.[0]?.family || "?"}: ${rec.title.slice(0, 110)} (${(it["container-title"] || [""])[0]})`);
      }
    } catch (e){ console.log(`  crossref: ${e.message}`); }
    try {
      const title = s.cite.split(/\.\s+/).slice(1).find(p => p.split(" ").length >= 4) || s.cite;
      for (const r of (await epmc(`TITLE:"${title.replace(/["?]/g, "")}"`)).slice(0, 3)){
        const a = agrees(r, s.cite);
        if (r.doi && seen.has(r.doi.toLowerCase()) && !r.pmid) continue;
        console.log(`  ${a.ok && norm(r.authorString || "").startsWith(surname(s.cite)) ? "LIKELY  " : "        "} epmc      ${r.doi ? "doi " + r.doi + "  " : ""}${r.pmid ? "pmid " + r.pmid + "  " : ""}${r.pmcid ? r.pmcid + "  " : ""}${r.pubYear}  ${(r.authorString || "").slice(0, 30)}: ${(r.title || "").slice(0, 100)} (${r.journalTitle || ""})`);
      }
    } catch (e){ console.log(`  epmc: ${e.message}`); }
    console.log("");
  }
  process.exit(0);
}

/* ---------- report, and --write ---------- */
const rows = [], problems = [];
let next = 0, changedN = 0;
async function worker(){
  while (next < todo.length){
    const [id, s] = todo[next++];
    const doi = s.doi || citeDoi(s.cite);
    if (!doi && !s.pmid){ rows.push({ id, note: "no DOI or PMID" }); continue; }
    try {
      const recs = s.pmid ? await epmc(`EXT_ID:${s.pmid} AND SRC:MED`) : await epmc(`DOI:"${doi}"`);
      const r = recs.find(x => s.pmid ? x.pmid === s.pmid : (x.doi || "").toLowerCase() === doi.toLowerCase());
      if (!r){ rows.push({ id, doi, note: "not in Europe PMC" }); problems.push(`${id}: ${s.pmid ? "PMID " + s.pmid : "DOI " + doi} not found in Europe PMC: check the identifier (or the journal isn't indexed there, as for some physics and pre-1950 journals)`); continue; }
      const a = agrees(r, s.cite);
      if (!a.ok){ rows.push({ id, doi, note: "MISMATCH" }); problems.push(`${id}: Europe PMC's record for ${s.pmid ? "PMID " + s.pmid : "DOI " + doi} doesn't match the cite (${a.why}):\n    epmc: ${r.authorString?.slice(0, 40)}. ${r.title} ${r.journalTitle} ${r.pubYear}\n    cite: ${s.cite}`); continue; }
      rows.push({ id, doi, pmid: r.pmid, pmcid: r.pmcid, note: "" });
    } catch (e){ rows.push({ id, doi, note: "error" }); problems.push(`${id}: ${e.message}`); }
  }
}
await Promise.all([1, 2, 3, 4].map(worker));
const order = Object.fromEntries(todo.map(([id], i) => [id, i]));
rows.sort((a, b) => order[a.id] - order[b.id]);
for (const r of rows){
  if (write && !r.note && (setIds(r.id, { doi: r.doi, pmid: r.pmid, pmcid: r.pmcid }))) changedN++;
  console.log(`${r.id.padEnd(20)} ${(r.doi || "").padEnd(42)} ${(r.pmid || "").padEnd(9)} ${(r.pmcid || "").padEnd(11)} ${r.note}`);
}
const count = f => rows.filter(f).length;
console.log(`\n${rows.length} papers, reviews and guidelines: ${count(r => !r.note)} matched in Europe PMC (${count(r => r.pmid)} with a PMID, ${count(r => r.pmcid)} with a PMCID), ${count(r => r.note === "no DOI or PMID")} with no DOI or PMID (try --search), ${problems.length} to look at.`);
if (problems.length) console.log("\nTo look at:\n  " + problems.join("\n  "));
if (write){
  if (changedN) writeFileSync(SOURCES, lines.join("\n"));
  JSON.parse(readFileSync(SOURCES, "utf8"));
  console.log(`\nWrote identifiers for ${changedN} source(s) to fact-check/sources.json.`);
}
