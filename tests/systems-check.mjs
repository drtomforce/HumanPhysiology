#!/usr/bin/env node
/* Headless check of the body systems on the starting page (Playwright + Chromium):
     node tests/systems-check.mjs            every system
     node tests/systems-check.mjs immune     only systems whose id contains "immune"
   For each body system it checks that:
     - its switch makes it the live system, and its layer is drawn (not .dim or .off);
     - the side panel shows its card with text, and a legend;
     - its numbered fact pins are drawn, one per pin in the content, and open a tip;
     - the hours of the day (sleep, breakfast, rest, the run, dinner) play for a few
       seconds each without page errors, and the physiology channels it reads are numbers;
     - ?live=<id> (the link the organ pages' lens cards use) opens it live;
     - switching it off hides its layer.
   It serves the repository on a local port itself. Needs the playwright package. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv[2] || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const HOURS = [3, 7.75, 12, 17.5, 18.6, 19.6];
/* channels each system's animator reads (beyond the shared ones) */
const CHANNELS = { urinary: ["gfr", "urineFlow", "urineOsm", "renin", "bladder"], immune: ["lymphFlow", "chyle", "nodeTraffic", "spleen", "neutrophils", "lymphocytes", "il6"] };

const browser = await chromium.launch();
let failed = 0;
const ids = await (async () => {
  const p = await browser.newPage(); await p.goto(base); await p.waitForTimeout(600);
  const out = await p.evaluate(() => [...document.querySelectorAll("#sysSwitch [data-sys]")].map(e => e.dataset.sys)); await p.close(); return out;
})();
for (const id of ids.filter(x => x.includes(only))){
  console.log(id);
  const before = failed;
  const fail = msg => { failed++; console.log(`  ✗ ${msg}`); };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + "?hour=12");
  await page.waitForTimeout(700);
  /* the page keeps its code in a closure; it exposes the store and the physiology here */
  await page.evaluate(() => { window.store = HumanPhysiology.store; window.Physio = HumanPhysiology.Physio;
    window.CONTENT = JSON.parse(document.getElementById("body-content").textContent); });

  /* the switch: show it, then make it live */
  if (!(await page.evaluate(i => store.get().shown[i], id))) await page.click(`#sysSwitch [data-sys="${id}"] .sw-tog`);
  await page.click(`#sysSwitch [data-sys="${id}"] .sw-name`);
  await page.waitForTimeout(400);
  const st = await page.evaluate(i => {
    const s = store.get(), layers = [...document.querySelectorAll(`#scene .sys-${i}`)];
    const card = document.querySelector(".sys-card h3");
    return { live: s.live, layers: layers.length, hidden: layers.filter(g => g.classList.contains("off") || g.classList.contains("dim")).length,
             card: card && card.textContent, name: CONTENT.systems[i].name, text: (document.querySelector(".sys-card p.text") || {}).textContent || "",
             legend: document.querySelectorAll(".sys-card .sys-legend li").length, pins: document.querySelectorAll("#s-pins .mk").length,
             want: (CONTENT.systems[i].pins || []).length };
  }, id);
  if (st.live !== id) fail(`the switch did not make it live (live = ${st.live})`);
  if (!st.layers) fail("no .sys-" + id + " layer in the scene");
  if (st.hidden) fail(`${st.hidden} of its layers are dimmed or hidden while live`);
  if (st.card !== st.name) fail(`the panel card shows "${st.card}", not "${st.name}"`);
  if (st.text.length < 80) fail("the panel card has no text");
  if (id !== "endocrine" && !st.legend) fail("the card has no legend");
  if (st.pins !== st.want) fail(`${st.pins} fact pins drawn, ${st.want} in the content`);
  if (st.pins){
    await page.focus("#s-pins .mk");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const tip = await page.evaluate(() => (document.querySelector("#pinTip") || {}).textContent || "");
    if (tip.length < 20) fail("the first fact pin opens no tip");
  }

  /* the day: each hour plays for a moment */
  for (const h of HOURS){
    await page.evaluate(hh => store.set({ hour: hh }), h);
    await page.waitForTimeout(1500);
    const bad = await page.evaluate(([hh, keys]) => { const p = Physio.at(hh); return keys.filter(k => !Number.isFinite(p[k])); }, [h, CHANNELS[id] || []]);
    if (bad.length) fail(`at ${h} h these channels are not numbers: ${bad.join(", ")}`);
  }

  /* the organ pages' lens link */
  await page.goto(base + `?live=${id}&hour=17.5`);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.store = HumanPhysiology.store; });
  if ((await page.evaluate(() => store.get().live)) !== id) fail(`?live=${id} did not open it live`);

  /* switching it off hides it */
  await page.click(`#sysSwitch [data-sys="${id}"] .sw-tog`);
  await page.waitForTimeout(300);
  const off = await page.evaluate(i => [...document.querySelectorAll(`#scene .sys-${i}`)].every(g => g.classList.contains("off")), id);
  if (!off) fail("switching it off left its layer drawn");

  if (errors.length) fail("page errors: " + [...new Set(errors)].join(" | "));
  if (failed === before) console.log("  ✓ live, card, pins, a day of hours, ?live link, off");
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nAll body systems work.");
process.exit(failed ? 1 : 0);
