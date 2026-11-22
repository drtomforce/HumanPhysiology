#!/usr/bin/env node
/* Headless check of the prediction questions (Playwright + Chromium):
     node tests/questions-check.mjs            every organ page with questions, and the hub
     node tests/questions-check.mjs kidneys    only pages whose name contains "kidneys"
   For every question in a page's content "questions" it checks that:
     - its scenario exists, and correct names one of its hypotheses;
     - title, setting, ask and every choice's text and explanation have ms and college text
       (hs and phd fall back to them), and the background sections and watched readouts exist;
     - its sources are ids in fact-check/sources.json, and every leadsTo case is on the hub;
     - in the page: "Run it" stays disabled until a choice is made, running it applies the
       scenario, locks the choices, shows the explanation and mirrors every watched readout;
     - each "expect" readout moves the way it says against the healthy reference: by its ▲/▼
       tag, or when it has none, against the same readout after "Reset all" at the same hour;
     - the card has text at all four reading levels, the answer is remembered in localStorage,
       and "Start over" clears it;
   and that explore/questions.html lists exactly the questions the pages have
   (node explore/sync-questions.mjs --check) and opens without errors.
   It serves the repository on a local port itself. Needs the playwright package. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv[2] || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const SOURCES = JSON.parse(readFileSync(join(root, "fact-check", "sources.json"), "utf8"));
const hubHTML = readFileSync(join(root, "explore", "questions.html"), "utf8");
const hubCases = (() => { const m = hubHTML.match(/<script type="application\/json" id="case-data">([\s\S]*?)<\/script>/); return m ? JSON.parse(m[1]) : []; })();
const CASE_IDS = new Set(hubCases.map(c => c.id));

const pages = readdirSync(join(root, "organs")).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => "organs/" + f).filter(p => p.includes(only));
const browser = await chromium.launch();
let failed = 0, checked = 0;
const fail = msg => { failed++; console.log(`  ✗ ${msg}`); };

const LEVELS = ["ms", "hs", "college", "phd"];
const has = (v, l) => typeof v === "string" ? v.trim().length > 0 : !!(v && typeof v[l] === "string" && v[l].trim());
/* wait until the watched readouts stop changing (the heart and lungs settle beat by beat) */
async function settle(page, keys){
  let last = null;
  for (let i = 0; i < 25; i++){
    await page.waitForTimeout(i ? 1000 : 600);
    const now = await page.evaluate(ks => JSON.stringify(ks.map(k => { const w = OrganPage.predict.find(k); return w && w.v ? w.v.textContent : ""; })), keys);
    if (now === last) return;
    last = now;
  }
}
const num = s => { const m = String(s).replace(/−/g, "-").match(/[-+]?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

for (const path of pages){
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + path);
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => ({
    qs: OrganPage.get("questions") || [],
    scen: (OrganPage.get("alter.scenarios") || []).map(s => s.id),
    secs: [...document.querySelectorAll("[data-section]")].map(s => s.id)
  }));
  if (!info.qs.length){ console.log(`${path}: no questions`); await ctx.close(); continue; }
  console.log(path);
  await page.evaluate(() => { try { localStorage.removeItem("humanphysiology.questions"); } catch(e){} });

  const ids = new Set();
  for (const q of info.qs){
    checked++;
    const before = failed, errs = errors.length;
    const bad = m => fail(`${q.id}: ${m}`);
    if (ids.has(q.id)) bad("duplicate id"); ids.add(q.id);
    if (!info.scen.includes(q.scenario)) { bad(`no scenario "${q.scenario}"`); continue; }
    const hs = q.hypotheses || [];
    if (hs.length < 2 || hs.length > 4) bad(`${hs.length} hypotheses (want 2–4)`);
    if (!hs.some(h => h.id === q.correct)) bad(`correct "${q.correct}" is not a hypothesis`);
    for (const [k, v] of [["title", q.title], ["setting", q.setting], ["ask", q.ask], ...hs.flatMap(h => [[`${h.id}.text`, h.text], [`${h.id}.reconcile`, h.reconcile]])])
      for (const l of ["ms", "college"]) if (!has(v, l)) bad(`${k} has no ${l} text`);
    if (!has(q.deeper, "phd") && !(typeof q.deeper === "string" && q.deeper.trim())) bad("no PhD / MD paragraph (deeper)");
    for (const s of q.background || []) if (!info.secs.includes(s)) bad(`background section "${s}" is not on the page`);
    for (const s of q.sources || []) if (!SOURCES[s]) bad(`source "${s}" is not in fact-check/sources.json`);
    if (!(q.sources || []).length) bad("names no sources");
    for (const c of q.leadsTo || []) if (!CASE_IDS.has(c)) bad(`leadsTo "${c}" is not a case on the hub`);
    const missing = await page.evaluate(w => w.filter(k => !OrganPage.predict.find(k)), q.watch || []);
    if (missing.length) bad(`watched readouts not found: ${missing.join(", ")}`);
    for (const k of Object.keys(q.expect || {})) if (!(q.watch || []).includes(k)) bad(`expect "${k}" is not in watch`);

    /* the card: pick, run, reconcile */
    const card = `[data-q="${q.id}"]`;
    if (!await page.$(card)){ bad("no card on the page"); continue; }
    if (!await page.$eval(`${card} [data-q-run]`, b => b.disabled)) bad("Run it is enabled before a choice");
    await page.click(`${card} [data-q-pick="${hs[0].id}"]`);
    await page.click(`${card} [data-q-run]`);
    await settle(page, Object.keys(q.expect || {}));
    const run = await page.evaluate(({ card, q }) => {
      const c = document.querySelector(card);
      const active = (document.querySelector("[data-alt-scen][aria-pressed=true]") || {}).dataset?.altScen || null;
      const read = k => { const w = OrganPage.predict.find(k); if (!w || !w.v) return null; const d = w.v.querySelector(".delta"); const x = w.v.cloneNode(true); x.querySelectorAll(".delta").forEach(n => n.remove()); return { v: x.textContent.trim(), d: d ? d.textContent.trim() : "" }; };
      return { active, locked: [...c.querySelectorAll("[data-q-pick]")].every(b => b.disabled), verdict: !!c.querySelector(".q-verdict"),
        mirror: c.querySelectorAll("[data-q-mirror] .q-ro").length, reads: Object.fromEntries(Object.keys(q.expect || {}).map(k => [k, read(k)])),
        saved: (() => { try { return JSON.parse(localStorage.getItem("humanphysiology.questions") || "{}")[q.id]; } catch(e){ return null; } })() };
    }, { card, q });
    if (run.active !== q.scenario) bad(`running it left "${run.active}" active, not "${q.scenario}"`);
    if (!run.locked) bad("the choices are not locked after running");
    if (!run.verdict) bad("no explanation after running");
    if (run.mirror !== (q.watch || []).length) bad(`mirrors ${run.mirror} of ${(q.watch || []).length} watched readouts`);
    if (!run.saved || run.saved.choice !== hs[0].id) bad("the answer is not remembered in localStorage");

    /* readouts without a ▲/▼ tag: compare with the healthy page at the same hour */
    await page.click("[data-alt-reset]");
    await settle(page, Object.keys(q.expect || {}));
    const healthy = await page.evaluate(keys => Object.fromEntries(keys.map(k => { const w = OrganPage.predict.find(k); if (!w || !w.v) return [k, null]; const x = w.v.cloneNode(true); x.querySelectorAll(".delta").forEach(n => n.remove()); return [k, x.textContent.trim()]; })), Object.keys(q.expect || {}));
    for (const [k, want] of Object.entries(q.expect || {})){
      const r = run.reads[k]; if (!r){ bad(`${k}: no value to compare`); continue; }
      let got;
      if (r.d.startsWith("▲")) got = "up"; else if (r.d.startsWith("▼")) got = "down";
      else { const a = num(r.v), b = num(healthy[k]); got = !Number.isFinite(a) || !Number.isFinite(b) ? "?" : Math.abs(a - b) <= 1e-9 + Math.abs(b) * 0.005 ? "same" : a > b ? "up" : "down"; }
      if (got !== want) bad(`${k} should go ${want}, but goes ${got} (${r.v}${r.d ? " " + r.d : ""} vs healthy ${healthy[k]})`);
    }

    /* every reading level renders */
    for (const l of LEVELS){
      await page.evaluate(l => OrganPage.set({ level: l }), l);
      const t = await page.$eval(card, c => ({ title: c.querySelector(".q-title").textContent.trim(), ask: c.querySelector(".q-ask").textContent.trim(), n: c.textContent.length, und: /undefined|\[object/.test(c.textContent) }));
      if (!t.title || !t.ask || t.und) bad(`level ${l}: empty or broken text`);
    }
    await page.evaluate(() => OrganPage.set({ level: "college" }));

    /* start over */
    await page.click(`${card} [data-q-over]`);
    const over = await page.evaluate(({ card, id }) => ({ open: !document.querySelector(card + " .q-res"), saved: (() => { try { return JSON.parse(localStorage.getItem("humanphysiology.questions") || "{}")[id]; } catch(e){ return 1; } })() }), { card, id: q.id });
    if (!over.open || over.saved) bad("Start over does not clear the answer");
    if (errors.length > errs) bad(`page errors: ${errors.slice(errs).join(" | ")}`);
    if (failed === before) console.log(`  ✓ ${q.id}: ${q.scenario}, ${hs.length} choices, ${Object.keys(q.expect || {}).length} readout(s) move as expected`);
  }
  await ctx.close();
}

/* the hub */
console.log("explore/questions.html");
try { execFileSync(process.execPath, [join(root, "explore", "sync-questions.mjs"), "--check"], { stdio: "pipe" }); console.log("  ✓ lists every question the pages have"); }
catch(e){ fail(`hub is out of date: ${String(e.stdout || e.message).trim()} (run node explore/sync-questions.mjs)`); }
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base + "explore/questions.html?level=hs");
  await page.waitForTimeout(600);
  const hub = await page.evaluate(() => ({ qs: document.querySelectorAll("[data-hub-q]").length, cases: document.querySelectorAll("[data-case]").length,
    links: [...document.querySelectorAll("[data-hub-q] a[href]")].map(a => a.getAttribute("href")) }));
  if (errors.length) fail(`hub errors: ${errors.join(" | ")}`);
  if (!hub.qs) fail("the hub shows no questions");
  if (hub.links.some(h => !/level=hs/.test(h))) fail("hub links do not carry the reading level");
  else console.log(`  ✓ opens with ${hub.qs} question(s) and ${hub.cases} case(s); links carry the level`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : `\nAll ${checked} question(s) check out.`);
process.exit(failed ? 1 : 0);
