#!/usr/bin/env node
/* Headless check of the converging cases that can be run (Playwright + Chromium):
     node tests/case-check.mjs
   For each case on explore/questions.html whose stops all name a scenario, it clicks
   "Start the case" and walks every stop with the strip's "Next" button, checking that each page:
     - raises no page errors;
     - opens on the stop's scenario (the changes bar shows it as the active one);
     - shows the case strip at the right stop, and keeps the case in its address bar;
   that the last stop's button leads back to the case on the hub, that "Leave the case" removes
   the strip and the case parameters, and that a plain ?scenario=<id> link applies the scenario.
   It also checks the lungs page's respiratory compensation: in its diabetic ketoacidosis
   scenario, PaCO₂ falls inside Winters' range (1.5 × HCO₃⁻ + 8 ± 2) with pH below 7.35.
   It serves the repository on a local port itself. Needs the playwright package. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
let failed = 0;
const fail = msg => { failed++; console.log(`  ✗ ${msg}`); };
const ok = msg => console.log(`  ✓ ${msg}`);
const page = await browser.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const settle = async () => { await page.waitForLoadState("load"); await page.waitForTimeout(600); };

await page.goto(base + "explore/questions.html?level=college"); await settle();
const cases = await page.evaluate(() => JSON.parse(document.getElementById("case-data").textContent));
const runnable = cases.filter(c => c.stops.every(s => !s.needs));
if (!runnable.length) fail("no case can be run");
for (const c of runnable){
  console.log(`${c.id}: ${c.stops.length} stops`);
  await page.goto(base + "explore/questions.html?level=college"); await settle();
  const start = await page.$(`#case-${c.id} [data-case-start]`);
  if (!start){ fail("no Start button on its card"); continue; }
  errors.length = 0;
  await start.click();
  for (let i = 0; i < c.stops.length; i++){
    await settle();
    const s = c.stops[i], u = new URL(page.url());
    const at = `stop ${i + 1} (${s.page}${s.scenario ? ", " + s.scenario : ""})`;
    if (!u.pathname.endsWith(`/organs/${s.page}.html`)){ fail(`${at}: opened ${u.pathname}`); break; }
    const info = await page.evaluate(() => {
      const strip = document.querySelector(".op-case"), cur = strip && strip.querySelector('[aria-current="step"]');
      const dots = strip ? [...strip.querySelectorAll(".case-dots a")] : [];
      const on = document.querySelector("[data-alt-scen][aria-pressed=true]");
      return { strip: !!strip, stop: cur ? dots.indexOf(cur) : -1, scen: on ? on.dataset.altScen : null, next: strip && strip.querySelector("a.next") ? strip.querySelector("a.next").getAttribute("href") : null };
    });
    const p = new URL(page.url()).searchParams;
    if (errors.length) fail(`${at}: page errors: ${errors.join("; ")}`);
    else if (!info.strip) fail(`${at}: no case strip`);
    else if (info.stop !== i) fail(`${at}: the strip marks stop ${info.stop + 1}`);
    else if (s.scenario && info.scen !== s.scenario) fail(`${at}: the active scenario is ${info.scen}`);
    else if (p.get("case") !== c.id || p.get("stop") !== String(i)) fail(`${at}: the address bar lost the case (${page.url()})`);
    else if (p.has("scenario")) fail(`${at}: the address bar still has scenario= after applying it`);
    else ok(at);
    errors.length = 0;
    if (!info.next){ fail(`${at}: no next button`); break; }
    await page.click(".op-case a.next");
  }
  await settle();
  const end = new URL(page.url());
  if (!end.pathname.endsWith("/explore/questions.html") || end.hash !== `#case-${c.id}`) fail(`the last stop leads to ${end.pathname}${end.hash}`);
  else ok("the last stop leads back to the case");
}

/* leaving a case, and a plain scenario link */
await page.goto(base + "organs/lungs.html?level=hs&scenario=dka&case=dka&ctitle=Test&stop=0&route=lungs.dka~brain.hyperK"); await settle();
await page.click("[data-case-leave]"); await page.waitForTimeout(400);
if (await page.$(".op-case")) fail("Leave the case kept the strip");
else if (/[?&](case|route|stop|ctitle)=/.test(page.url())) fail(`Leave the case kept the case in the address bar (${page.url()})`);
else ok("Leave the case");
await page.goto(base + "organs/lungs.html?level=hs&case=bad&stop=7&route=lungs.dka"); await settle();
if (await page.$(".op-case")) fail("a stop outside the route still drew a strip"); else ok("a broken case link is ignored");

/* the lungs' compensation for a metabolic acidosis */
await page.goto(base + "organs/lungs.html?level=college&scenario=dka"); await settle();
const g = await page.evaluate(() => { const L = window.__lung; L.settle(); L.advance(20); return { hco3: L.S.hco3m, paco2: L.S.PaCO2, ph: L.S.pH, ve: L.S.VE }; });
const winters = 1.5 * g.hco3 + 8;
if (Math.abs(g.paco2 - winters) > 2) fail(`lungs dka: PaCO₂ ${g.paco2.toFixed(1)} outside Winters' ${winters} ± 2`);
else if (!(g.ph < 7.35)) fail(`lungs dka: pH ${g.ph.toFixed(2)} is fully compensated`);
else ok(`lungs dka: HCO₃⁻ ${g.hco3}, PaCO₂ ${g.paco2.toFixed(1)} (Winters' ${winters} ± 2), pH ${g.ph.toFixed(2)}, ventilation ${g.ve.toFixed(1)} L/min`);

await browser.close(); server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nAll cases run.");
process.exit(failed ? 1 : 0);
