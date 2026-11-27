/* Europe PMC and Crossref, for the fact-check scripts (fetch.mjs, ids.mjs; FACT_CHECK_PLAN.md, steps 2-3).
   Papers are read through these open APIs, not the publishers' pages, which serve robot checks and
   cookie walls to scripts. No dependencies.

   - getJSON / getText: one request, with retries and backoff on 429 and 5xx
   - recordFor(source): the Europe PMC core record of a sources.json entry, by pmid, else doi, else pmcid
   - agrees(record, cite): does the record's title and year match the cite string?
   - notices(record, doi): retractions, expressions of concern and corrections, from Europe PMC and Crossref
   - abstractUnits / fullTextUnits: the text, as units { where, text } that a locator can name
   - locate(units, quote): is the excerpt in the text? exactly, or only ignoring case, spacing and punctuation */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const UA = "HumanPhysiology-factcheck/1.0 (https://github.com/drtomforce/HumanPhysiology)";
const REST = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, accept, as){
  for (let attempt = 0; ; attempt++){
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept }, signal: AbortSignal.timeout(40000) });
      if (res.ok) return as === "json" ? await res.json() : await res.text();
      if (res.status === 404) return null;
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt >= 3) throw new Error(`${res.status} from ${new URL(url).host}`);
    } catch (e){ if (attempt >= 3 || /^\d{3} from/.test(e.message)) throw e; }
    await sleep(2000 * 2 ** attempt);
  }
}
export const getJSON = url => get(url, "application/json", "json");
export const getText = url => get(url, "application/xml,text/xml,*/*", "text");

/* ---------- cache: fact-check/cache/ (git-ignored), so a second look doesn't fetch again ---------- */
const CACHE = join(dirname(fileURLToPath(import.meta.url)), "cache");
const cacheFile = key => join(CACHE, key.replace(/[^A-Za-z0-9._-]+/g, "_") + ".json");
export async function cached(key, maxAgeDays, load){
  const f = cacheFile(key);
  if (maxAgeDays > 0 && existsSync(f)){
    const c = JSON.parse(readFileSync(f, "utf8"));
    if ((Date.now() - Date.parse(c.fetched)) / 864e5 < maxAgeDays) return c.data;
  }
  const data = await load();
  if (data != null){ mkdirSync(CACHE, { recursive: true }); writeFileSync(f, JSON.stringify({ fetched: new Date().toISOString(), data })); }
  return data;
}

/* ---------- Europe PMC ---------- */
export const search = async (q, type = "lite", size = 5) =>
  (await getJSON(`${REST}/search?query=${encodeURIComponent(q)}&format=json&resultType=${type}&pageSize=${size}`))?.resultList?.result || [];

/* the links a look-up cites: the REST record by PMID (the form the ledger already uses), and the full text */
export const abstractUrl = pmid => `${REST}/search?query=EXT_ID:${pmid}%20AND%20SRC:MED&resultType=core&format=json`;
export const fullTextUrl = pmcid => `${REST}/${pmcid}/fullTextXML`;
/* the same paper for a person to read in a browser */
export const readingUrls = r => [r.pmid && `https://europepmc.org/article/MED/${r.pmid}`, r.pmid && `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`, r.pmcid && `https://pmc.ncbi.nlm.nih.gov/articles/${r.pmcid}/`].filter(Boolean);

/* a source's record: { pmid, doi, pmcid } from sources.json (or given directly), looked up in that order */
export async function recordFor(ids, maxAgeDays = 30){
  const tries = [ids.pmid && [`pmid-${ids.pmid}`, `EXT_ID:${ids.pmid} AND SRC:MED`, r => r.pmid === ids.pmid],
    ids.doi && [`doi-${ids.doi.toLowerCase()}`, `DOI:"${ids.doi}"`, r => (r.doi || "").toLowerCase() === ids.doi.toLowerCase()],
    ids.pmcid && [`${ids.pmcid}`, `PMCID:${ids.pmcid}`, r => r.pmcid === ids.pmcid]].filter(Boolean);
  for (const [key, q, is] of tries){
    const r = await cached(`record-${key}`, maxAgeDays, async () => (await search(q, "core", 5)).find(is) || null);
    if (r) return r;
  }
  return null;
}
export const fullTextXML = (pmcid, maxAgeDays = 30) => cached(`fulltext-${pmcid}`, maxAgeDays, () => getText(fullTextUrl(pmcid)).catch(e => { if (/^500 /.test(e.message)) return null; throw e; }));

/* free to read in Europe PMC (inEPMC), and machine-readable full text (the open-access subset, isOpenAccess) */
export const access = r => ({ free: r?.inEPMC === "Y" || r?.inPMC === "Y", openSubset: r?.isOpenAccess === "Y" });

/* ---------- retractions and corrections ---------- */
const SERIOUS = /retract|withdraw|expression of concern|expression_of_concern/i;
export async function notices(r, doi, maxAgeDays = 30){
  const out = [];
  for (const t of r?.pubTypeList?.pubType || []) if (/Retracted Publication|Retraction of Publication|Expression of Concern/i.test(t)) out.push({ kind: t, from: "Europe PMC", serious: true });
  for (const c of r?.commentCorrectionList?.commentCorrection || [])
    if (/Retraction in|Expression of concern in|Erratum in|Corrected and republished in|Republished in|Update in/i.test(c.type))
      out.push({ kind: c.type, ref: c.reference || c.id, from: "Europe PMC", serious: SERIOUS.test(c.type) });
  if (doi){
    const cr = await cached(`updates-${doi.toLowerCase()}`, maxAgeDays, async () =>
      (await getJSON(`https://api.crossref.org/works?filter=updates:${encodeURIComponent(doi)}&select=DOI,update-to&rows=20`))?.message?.items || []);
    const known = out.map(x => String(x.ref || "").toLowerCase()).join(" ");
    for (const it of cr) for (const u of it["update-to"] || []) if ((u.DOI || "").toLowerCase() === doi.toLowerCase()){
      if (known.includes(it.DOI.toLowerCase())) continue; /* the same notice, already listed by Europe PMC */
      /* publishers sometimes deposit one notice against several papers by mistake (seen: a retracted comment
         naming the papers it cited), so a Crossref-only retraction counts as serious when Retraction Watch
         recorded it, or when the notice names this paper alone */
      const targets = (it["update-to"] || []).length, sure = u.source === "retraction-watch" || targets === 1;
      const bad = SERIOUS.test(u.type || "");
      out.push({ kind: bad && !sure ? `${u.type} (unconfirmed: the notice names ${targets} papers, and PubMed records none for this one; check by hand)` : u.type,
        ref: `doi:${it.DOI}`, from: `Crossref (${u.source || "?"})`, serious: bad && (sure || out.some(x => x.serious)) });
    }
  }
  return out;
}

/* ---------- matching a record to a cite string ---------- */
export const norm = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set("the and for with from into that this than are was were its their after during between within without".split(" "));
/* share of the record title's words (4+ letters) that appear in the cite: 1 = every word. A cite often
   leaves out the subtitle, so the title before its colon counts on its own too, and so do the record
   title's opening words, word for word, when the subtitle runs on with no colon */
export function titleScore(title, cite){
  const c = new Set(norm(cite).split(" "));
  const score = t => { const w = norm(t).split(" ").filter(x => x.length >= 4 && !STOP.has(x)); return w.length ? w.filter(x => c.has(x)).length / w.length : 0; };
  const main = title.split(/:\s/)[0];
  const w = norm(title).split(" "), n = norm(cite);
  let k = 0; while (k < w.length && n.includes(w.slice(0, k + 1).join(" "))) k++;
  return Math.max(score(title), main.length >= 20 && main !== title ? score(main) : 0, k >= 7 ? 1 : 0);
}
export const citeYear = cite => (cite.match(/(?:^|[.;,]\s*)((?:18|19|20)\d\d)(?=[;:.,\s]|$)/) || cite.match(/\b((?:18|19|20)\d\d)\b/) || [])[1];
export const citeDoi = cite => (cite.match(/\bdoi:\s*(10\.\d{4,9}\/\S+?)\.?(?:\s|$)/i) || [])[1];
export const surname = cite => norm(cite.split(/[ ,.]/)[0] || "");
export function agrees(rec, cite){
  const t = titleScore(rec.title || "", cite), y = citeYear(cite), ry = String(rec.pubYear || rec.year || "");
  const ok = t >= 0.8 && (!y || !ry || Math.abs(Number(y) - Number(ry)) <= 1);
  return { ok, why: ok ? "" : `title match ${Math.round(t * 100)}%, year ${y || "?"} vs ${ry || "?"}` };
}

/* ---------- text ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ", shy: "\u00ad",
  ndash: "–", mdash: "—", minus: "−", hyphen: "‐", plusmn: "±", micro: "µ", deg: "°", times: "×", divide: "÷", middot: "·", bull: "•", hellip: "…",
  lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", laquo: "«", raquo: "»", prime: "′", Prime: "″",
  le: "≤", ge: "≥", ne: "≠", asymp: "≈", sim: "∼", infin: "∞", rarr: "→", larr: "←", harr: "↔", uarr: "↑", darr: "↓",
  frac12: "½", frac14: "¼", frac34: "¾", sup1: "¹", sup2: "²", sup3: "³", copy: "©", reg: "®", trade: "™", sect: "§", para: "¶",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", kappa: "κ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", tau: "τ", omega: "ω", Delta: "Δ" };
export const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? ENT[e.toLowerCase()] ?? m);
const clean = s => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/* the abstract, split at its headings (<h4>Results</h4>…) into units "abstract" or "abstract, Results" */
export function abstractUnits(r){
  const a = r?.abstractText; if (!a) return [];
  const parts = a.split(/<h4>(.*?)<\/h4>/i), out = [];
  if (clean(parts[0])) out.push({ where: "abstract", text: clean(parts[0]) });
  for (let i = 1; i < parts.length; i += 2) if (clean(parts[i + 1] || "")) out.push({ where: `abstract, ${clean(parts[i])}`, text: clean(parts[i + 1]) });
  return out;
}

/* JATS full text (Europe PMC fullTextXML) as units: each paragraph, list item, caption and table row, named
   by its section path ("Results > Heat loss, para 3", "Table 2", "Fig 1 caption"). References are left out */
export function fullTextUnits(xml){
  if (!xml) return [];
  const out = [], stack = [], secs = [], paras = new Map();
  let buf = null, bufWhere = null, title = null, label = null, skip = 0, row = null, cell = null;
  const path = () => secs.map(s => s.title || "untitled").join(" > ") || "body";
  const inSec = () => secs[secs.length - 1];
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g)){
    const [, close, tag0, , selfClose, text] = m;
    if (text != null){
      if (skip) continue;
      if (title) title.t += text; else if (label) label.t += text;
      if (cell) cell.t += text; else if (buf != null) buf += text;
      continue;
    }
    const tag = tag0.toLowerCase();
    if (selfClose) continue;
    if (!close){
      stack.push(tag);
      if (["ref-list", "back", "front", "permissions", "funding-group", "kwd-group", "contrib-group", "author-notes"].includes(tag)) skip++;
      if (skip) continue;
      if (tag === "sec") secs.push({ title: null, n: 0 });
      else if (tag === "title" && stack[stack.length - 2] === "sec" && inSec() && inSec().title == null) title = { t: "" };
      else if (tag === "label" && ["table-wrap", "fig"].includes(stack[stack.length - 2])) label = { t: "" };
      else if (tag === "caption") { buf = ""; bufWhere = null; }
      else if (tag === "tr") row = [];
      else if ((tag === "td" || tag === "th") && row) cell = { t: "" };
      else if (tag === "p" && buf == null){
        const s = inSec(); const key = path(); paras.set(key, (paras.get(key) || 0) + 1);
        buf = ""; bufWhere = `${key}, para ${paras.get(key)}`; if (s) s.n++;
      }
    } else {
      while (stack.length && stack[stack.length - 1] !== tag) stack.pop();
      stack.pop();
      if (["ref-list", "back", "front", "permissions", "funding-group", "kwd-group", "contrib-group", "author-notes"].includes(tag)){ skip = Math.max(0, skip - 1); continue; }
      if (skip) continue;
      if (tag === "title" && title){ inSec().title = clean(title.t); title = null; }
      else if (tag === "label" && label){ label.done = clean(label.t); }
      else if (tag === "sec") secs.pop();
      else if (tag === "caption" && buf != null){
        const name = label?.done || "caption";
        if (clean(buf)) out.push({ where: `${name} caption`, text: clean(buf) });
        buf = null;
      }
      else if ((tag === "td" || tag === "th") && cell){ row?.push(clean(cell.t)); cell = null; }
      else if (tag === "tr" && row){ if (row.some(Boolean)) out.push({ where: `${label?.done || "table"}, row`, text: row.join(" | ") }); row = null; }
      else if (tag === "table-wrap" || tag === "fig") label = null;
      else if (tag === "p" && buf != null && bufWhere){ if (clean(buf)) out.push({ where: bufWhere, text: clean(buf) }); buf = null; bufWhere = null; }
    }
  }
  return out;
}

/* ---------- finding an excerpt ---------- */
/* canonical form: compatibility characters folded, every dash a hyphen, curly quotes straight, spaces single */
export const canon = s => decode(s).normalize("NFKC").replace(/­/g, "")
  .replace(/[‐-―−﹘﹣－]/g, "-").replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"')
  .replace(/[\s  -​  　]+/g, " ").trim();
/* loose form, letters and digits only, with a map back to the canonical text */
function loose(s){
  let out = ""; const at = [];
  for (let i = 0; i < s.length; i++){ const ch = s[i].toLowerCase(); if (/[\p{L}\p{N}]/u.test(ch)){ out += ch; at.push(i); } }
  return { out, at };
}
/* every place the quote is, best match first: { how: "exact" | "loose", where, found (the source's own wording), context } */
export function locate(units, quote){
  /* a full stop, comma, semicolon or colon closing the excerpt may be the checker's, not the source's */
  const q = canon(quote).replace(/\s*[.,;:]+$/, ""), lq = loose(q).out, hits = [];
  if (!lq) return hits;
  for (const u of units){
    const t = canon(u.text);
    let i = t.indexOf(q);
    if (i >= 0){ hits.push({ how: "exact", where: u.where, found: t.slice(i, i + q.length), context: ctx(t, i, q.length) }); continue; }
    const L = loose(t), j = L.out.indexOf(lq);
    if (j >= 0){ const a = L.at[j], b = L.at[j + lq.length - 1] + 1; hits.push({ how: "loose", where: u.where, found: t.slice(a, b), context: ctx(t, a, b - a) }); }
  }
  return hits.sort((a, b) => (a.how === "exact" ? 0 : 1) - (b.how === "exact" ? 0 : 1));
}
const ctx = (t, i, n) => (i > 60 ? "…" + t.slice(i - 60, i) : t.slice(0, i)) + "«" + t.slice(i, i + n) + "»" + (t.length > i + n + 60 ? t.slice(i + n, i + n + 60) + "…" : t.slice(i + n));

/* ---------- checking a look-up's quote against the paper it links to (scan.mjs --mark, --check-quotes) ---------- */
/* which paper a link points to, and which text it shows: "abstract" (the record, PubMed) or "full" (full text, PMC);
   null for links that aren't to a paper in Europe PMC, PubMed or PMC */
export function paperFromUrl(u){
  let url; try { url = new URL(u); } catch { return null; }
  const h = url.hostname.replace(/^www\./, ""), p = decodeURIComponent(url.pathname), q = decodeURIComponent(url.search);
  let m;
  if (h === "ebi.ac.uk" && /\/europepmc\/webservices\/rest\/search$/.test(p) && (m = q.match(/EXT_ID:\s*(\d+)/i))) return { pmid: m[1], shows: "abstract" };
  if (h === "ebi.ac.uk" && (m = p.match(/\/europepmc\/webservices\/rest\/(PMC\d+)\/fullTextXML$/i))) return { pmcid: m[1].toUpperCase(), shows: "full" };
  if (h === "europepmc.org" && (m = p.match(/^\/(?:article|abstract)\/MED\/(\d+)/i))) return { pmid: m[1], shows: "full" };
  if (h === "europepmc.org" && (m = p.match(/^\/(?:article\/PMC|articles)\/(PMC\d+)/i))) return { pmcid: m[1].toUpperCase(), shows: "full" };
  if (h === "pubmed.ncbi.nlm.nih.gov" && (m = p.match(/^\/(\d+)/))) return { pmid: m[1], shows: "abstract" };
  if ((h === "pmc.ncbi.nlm.nih.gov" && (m = p.match(/^\/articles\/(PMC\d+)/i))) || (h === "ncbi.nlm.nih.gov" && (m = p.match(/^\/pmc\/articles\/(PMC\d+)/i))))
    return { pmcid: m[1].toUpperCase(), shows: "full" };
  return null;
}

/* Is the quote in the paper the link points to?
     { state: "ok", how, where }                    found verbatim (after folding dashes, quotes and spaces)
     { state: "not-verbatim", where, found }        only ignoring case, spacing or punctuation: copy `found`
     { state: "missing", searched }                 not in the text that was searched
     { state: "unchecked", why }                    the text the link shows isn't available here (closed full text)
     { state: "wrong-paper", why }                  the link is to a different paper than the source id
     { state: "retracted", why }                    the paper is retracted or under an expression of concern
     { state: "error", why }                        Europe PMC couldn't be reached
   `source` is the sources.json entry (its pmid / pmcid / doi are compared with the link's paper). */
export async function checkQuote(url, quote, source = {}, maxAgeDays = 30){
  const ref = paperFromUrl(url);
  if (!ref) return null;
  let r;
  try { r = await recordFor(ref, maxAgeDays); } catch (e){ return { state: "error", why: e.message }; }
  if (!r) return { state: "missing", searched: `nothing: Europe PMC has no record for ${ref.pmid ? "PMID " + ref.pmid : ref.pmcid}` };
  const same = (a, b) => !a || !b || String(a).toLowerCase() === String(b).toLowerCase();
  if (!same(source.pmid, r.pmid) || !same(source.pmcid, r.pmcid) || !same(source.doi, r.doi))
    return { state: "wrong-paper", why: `the link is to PMID ${r.pmid || "–"} / ${r.pmcid || "no PMCID"} / DOI ${r.doi || "–"} (${(r.title || "").slice(0, 80)}), but sources.json has ${[source.pmid && "PMID " + source.pmid, source.pmcid, source.doi && "DOI " + source.doi].filter(Boolean).join(" / ")}` };
  try {
    const n = await notices(r, r.doi, maxAgeDays);
    const bad = n.find(x => x.serious);
    if (bad) return { state: "retracted", why: `${bad.kind}${bad.ref ? " " + bad.ref : ""} [${bad.from}]` };
  } catch (e){ return { state: "error", why: e.message }; }
  const abs = abstractUnits(r);
  let hit = locate(abs, quote)[0], searched = abs.length ? "the abstract" : "nothing (no abstract)";
  if (!hit && ref.shows === "full"){
    if (access(r).openSubset && r.pmcid){
      let xml; try { xml = await fullTextXML(r.pmcid, maxAgeDays); } catch (e){ return { state: "error", why: e.message }; }
      hit = locate(fullTextUnits(xml), quote)[0]; searched = "the abstract and the open full text";
    } else return { state: "unchecked", why: "not in the abstract, and the full text isn't in Europe PMC's open-access subset, so it can't be read here" };
  }
  if (!hit) return { state: "missing", searched };
  return hit.how === "exact" ? { state: "ok", how: hit.how, where: hit.where } : { state: "not-verbatim", where: hit.where, found: hit.found };
}
