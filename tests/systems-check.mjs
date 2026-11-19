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
     - the follow button in its card (if it has one) starts a journey with its card on the body;
     - ?live=<id> (the link the organ pages' lens cards use) opens it live;
     - switching it off hides its layer.
   For the immune system it also plays every infection journey (?ride=infection:<id>) stop by
   stop to the end, checks each stop's text at all four reading levels, the Vaccinated toggle
   and "Another germ", and that tapping an armpit node starts the splinter journey.
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

  /* the card's follow button starts the system's journey */
  if (await page.$(".sys-card .follow-btn")){
    await page.click(".sys-card .follow-btn");
    await page.waitForTimeout(700);
    const j = await page.evaluate(() => ({ cards: document.querySelectorAll(".journey.on").length, h2: (document.querySelector("#panel h2") || {}).textContent || "" }));
    if (j.cards !== 1) fail(`the follow button shows ${j.cards} journey cards, not 1`);
    if (!/^Journey of|^Follow/i.test(j.h2) && j.h2.length < 5) fail("the follow button did not open the journey in the panel");
  }

  if (id === "immune") await infections(page, fail);

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

/* every infection journey, stop by stop, plus the Vaccinated toggle and a tap on a node */
async function infections(page, fail){
  const C = await page.evaluate(() => CONTENT.infection);
  for (const [k, st] of Object.entries(C.stops))
    for (const lv of ["name", "ms", "hs", "college", "phd"]) if (!st[lv] || st[lv].length < (lv === "name" ? 3 : 40)) fail(`infection stop ${k} has no ${lv} text`);
  for (const j of Object.keys(C.journeys)){
    await page.goto(base + `?hour=10&ride=infection:${j}`);
    await page.waitForTimeout(900);
    await page.evaluate(() => { window.store = HumanPhysiology.store; });
    const st = await page.evaluate(() => ({ id: store.get().infection, live: store.get().live, n: document.querySelectorAll(".journey-steps li").length,
      card: document.querySelector("#infectionCard").classList.contains("on") }));
    if (st.id !== j || st.live !== "immune" || !st.card){ fail(`?ride=infection:${j} did not start it (${JSON.stringify(st)})`); continue; }
    const seen = new Set();
    for (let i = 0; i < st.n; i++){
      const r = await page.evaluate(() => ({ seg: store.get().infectionSeg, where: document.querySelector("#infectionCard .j-where").textContent,
        on: (document.querySelector(".journey-steps li.on") || {}).textContent, text: (document.querySelector("#panel .reading .text") || {}).textContent || "" }));
      if (r.where !== r.on) fail(`${j}, stop ${i + 1}: the card says "${r.where}" but the panel marks "${r.on}"`);
      if (r.text.length < 40) fail(`${j}, stop ${i + 1}: no text in the panel`);
      seen.add(r.seg);
      await page.click("#infectionCard [data-j=next]");
      await page.waitForTimeout(120);
    }
    const end = await page.evaluate(() => ({ toast: document.querySelector("#infectionCard .j-toast").textContent, meta: document.querySelector("#infectionCard .j-meta").textContent }));
    if (seen.size !== st.n) fail(`${j}: visited ${seen.size} of ${st.n} stops`);
    if (end.toast !== C.journeys[j].effect) fail(`${j}: arrival says "${end.toast}", not "${C.journeys[j].effect}"`);
    if (!/days/.test(end.meta)) fail(`${j}: the end says "${end.meta}", without the days it took`);
  }
  /* the Vaccinated toggle and "Another germ" keep the other setting */
  await page.click("#infectionCard [data-j=vax]"); await page.waitForTimeout(300);
  const a = await page.evaluate(() => store.get().infection);
  await page.click("#infectionCard [data-j=another]"); await page.waitForTimeout(300);
  const b = await page.evaluate(() => store.get().infection);
  const last = Object.keys(C.journeys).pop();
  if (a !== (last.endsWith("Vax") ? last.slice(0, -3) : last + "Vax")) fail(`Vaccinated turned ${last} into ${a}`);
  if (!b || b === a || b.endsWith("Vax") !== a.endsWith("Vax")) fail(`"Another germ" turned ${a} into ${b}`);
  /* a tap on an armpit node (the third node drawn) starts the splinter; the neck nodes sit
     under the throat's label in the whole-body view, where a tap opens the throat */
  await page.click("#infectionCard [data-j=stop]"); await page.waitForTimeout(1500);
  const box = await page.evaluate(() => { const n = document.querySelectorAll("#scene .im-node")[2], r = n.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y) === n }; });
  if (!box.hit) fail("the armpit node is covered, so it can't be tapped");
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(500);
  const tapped = await page.evaluate(() => store.get().infection);
  if (tapped !== "splinter") fail(`tapping an armpit node started ${tapped}, not the splinter`);
  console.log(`  ✓ ${Object.keys(C.journeys).length} infection journeys, Vaccinated, Another germ, tap a node`);
}
console.log(failed ? `\n${failed} problem(s)` : "\nAll body systems work.");
process.exit(failed ? 1 : 0);
