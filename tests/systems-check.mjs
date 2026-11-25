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
   For the muscles & skeleton it plays the step journey (?ride=step:<id>) stop by stop from
   an hour outside the run (the clock must jump to the run), checks its text at four levels,
   that the foot lands and the bone bends when the ride says (the stride is pinned to it),
   "Other leg", and that tapping a shin starts a step on that side.
   For the skin it checks the heat balance: at rest radiation > convection > evaporation, in
   the run evaporation > convection > radiation, heat lost within 10% of heat made at noon and
   at the end of the run, skin cooler and skin blood flow ~4× higher in the run than at noon,
   and that the layer draws it: pores swollen with sweat and the heat arrows out in the run,
   dry pores at noon, and the rim cooler (bluer) in the run. Then it plays the heat journey
   (?ride=heat:<id>) stop by stop from an hour outside the run (the clock must jump to the
   run), checks its text at four levels, that the rider reaches the hypothalamus, a sweat
   pore and the air above it, Replay, the skin panel's chip, and that tapping a pore starts it.
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
const CHANNELS = { urinary: ["gfr", "urineFlow", "urineOsm", "renin", "bladder"], immune: ["lymphFlow", "chyle", "nodeTraffic", "spleen", "neutrophils", "lymphocytes", "il6"],
  musculoskeletal: ["muscleVO2", "muscleGlycogen", "lactate", "cadence", "grf", "boneStrain"],
  integumentary: ["skinTemp", "skinFlow", "sweatRate", "tewl", "heatMade", "heatRad", "heatConv", "heatEvap", "heatResp", "goose"] };

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
  if (id === "musculoskeletal") await steps(page, fail);
  if (id === "integumentary"){ await skin(page, fail); await heats(page, fail); }

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
  await page.click("#infectionCard [data-j=stop]"); await page.waitForTimeout(600);
  /* wait for the camera to settle back on the whole body */
  await page.waitForFunction(() => { const r = document.querySelectorAll("#scene .im-node")[2].getBoundingClientRect(), k = `${r.x.toFixed(1)},${r.y.toFixed(1)}`;
    const same = window.__nodeAt === k; window.__nodeAt = k; return same; }, null, { polling: 300, timeout: 5000 }).catch(() => {});
  const box = await page.evaluate(() => { const n = document.querySelectorAll("#scene .im-node")[2], r = n.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y) === n }; });
  if (!box.hit) fail("the armpit node is covered, so it can't be tapped");
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(500);
  const tapped = await page.evaluate(() => store.get().infection);
  if (tapped !== "splinter") fail(`tapping an armpit node started ${tapped}, not the splinter`);
  console.log(`  ✓ ${Object.keys(C.journeys).length} infection journeys, Vaccinated, Another germ, tap a node`);
}
/* the skin's heat balance at rest and in the run, and what the layer draws */
async function skin(page, fail){
  const [rest, run] = await page.evaluate(() => [12, 17.9].map(h => { const p = Physio.at(h);
    return { R: p.heatRad, C: p.heatConv, E: p.heatEvap, B: p.heatResp, M: p.heatMade, T: p.skinTemp, F: p.skinFlow, S: p.sweatRate }; }));
  if (!(rest.R > rest.C && rest.C > rest.E)) fail(`at rest radiation ${rest.R.toFixed(0)}, convection ${rest.C.toFixed(0)}, evaporation ${rest.E.toFixed(0)} W are not in that order`);
  if (!(run.E > run.C && run.C > run.R)) fail(`in the run evaporation ${run.E.toFixed(0)}, convection ${run.C.toFixed(0)}, radiation ${run.R.toFixed(0)} W are not in that order`);
  for (const [k, v] of [["noon", rest], ["the run", run]]){
    const lost = v.R + v.C + v.E + v.B;
    if (Math.abs(lost - v.M) > .1 * v.M) fail(`at ${k} ${lost.toFixed(0)} W are lost but ${v.M.toFixed(0)} W made`);
  }
  if (!(run.T < rest.T - 1.5)) fail(`skin is ${run.T.toFixed(1)} °C in the run and ${rest.T.toFixed(1)} °C at noon: it should be cooled by sweat`);
  if (!(run.F > 3 * rest.F)) fail(`skin blood flow is ${run.F.toFixed(2)} L/min in the run, ${rest.F.toFixed(2)} at noon`);
  const look = h => page.evaluate(async hh => { store.set({ hour: hh }); await new Promise(r => setTimeout(r, 1200));
    const q = s => [...document.querySelectorAll("#s-skin " + s)];
    return { pore: Math.max(...q(".sk-pore").map(e => +e.getAttribute("r"))), arrows: q(".sk-rad, .sk-conv").filter(e => +e.getAttribute("opacity") > 0).length,
      rim: q(".sk-rim")[0].getAttribute("stroke"), dots: q("#s-skinDots circle").filter(e => +e.getAttribute("opacity") > 0).length }; }, h);
  const a = await look(12), b = await look(17.9);
  if (a.pore > 1.5) fail(`the pores are swollen (r ${a.pore}) at noon, with no sweat`);
  if (b.pore < 2.5) fail(`the pores are not swollen (r ${b.pore}) in the run`);
  if (b.arrows < 10) fail(`only ${b.arrows} heat arrows are drawn in the run`);
  if (!b.dots) fail("no heat or vapour dots move in the run");
  const blue = c => parseInt(c.slice(5, 7), 16) - parseInt(c.slice(1, 3), 16);
  if (!(blue(b.rim) > blue(a.rim))) fail(`the rim is ${b.rim} in the run and ${a.rim} at noon: it should be cooler (bluer) in the run`);
  console.log(`  ✓ heat balance at rest (${rest.M.toFixed(0)} W) and in the run (${run.M.toFixed(0)} W), skin cooler and flushed, pores, arrows and rim`);
}
/* the heat journey, stop by stop: where the rider goes, Replay, the skin panel's chip and a tap on a pore */
async function heats(page, fail){
  const C = await page.evaluate(() => CONTENT.heat);
  for (const [k, st] of Object.entries(C.stops))
    for (const lv of ["name", "ms", "hs", "college", "phd"]) if (!st[lv] || st[lv].length < (lv === "name" ? 3 : 40)) fail(`heat stop ${k} has no ${lv} text`);
  const rider = () => page.evaluate(() => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(document.querySelector("#s-heatRide .cas-dot").getAttribute("transform")); return [+m[1], +m[2]]; });
  const pores = await page.evaluate(() => [...document.querySelectorAll("#s-skin .sk-pore")].map(e => [+e.getAttribute("cx"), +e.getAttribute("cy")]));
  for (const j of Object.keys(C.journeys)){
    for (const lv of ["ms", "phd"]){
      await page.goto(base + `?hour=10&level=${lv}&ride=heat:${j}`);
      await page.waitForTimeout(900);
      await page.evaluate(() => { window.store = HumanPhysiology.store; });
      const st = await page.evaluate(() => ({ id: store.get().heat, live: store.get().live, hour: store.get().hour, n: document.querySelectorAll(".journey-steps li").length,
        card: document.querySelector("#heatCard").classList.contains("on") }));
      if (st.id !== j || st.live !== "integumentary" || !st.card){ fail(`?ride=heat:${j} did not start it (${JSON.stringify(st)})`); continue; }
      if (st.hour < 17.1 || st.hour > 18) fail(`started at 10:00, the heat ride left the clock at ${st.hour.toFixed(2)} h, not in the run`);
      const at = {};
      for (let i = 0; i < st.n; i++){
        await page.evaluate(() => store.set({ ridePaused: false })); await page.waitForTimeout(400);
        await page.evaluate(() => store.set({ ridePaused: true })); await page.waitForTimeout(80);
        const r = await page.evaluate(() => ({ seg: store.get().heatSeg, where: document.querySelector("#heatCard .j-where").textContent,
          on: (document.querySelector(".journey-steps li.on") || {}).textContent, text: (document.querySelector("#panel .reading .text") || {}).textContent || "",
          meta: document.querySelector("#heatCard .j-meta").textContent }));
        if (r.where !== r.on) fail(`${j} (${lv}), stop ${i + 1}: the card says "${r.where}" but the panel marks "${r.on}"`);
        if (r.text.length < 40) fail(`${j} (${lv}), stop ${i + 1}: no text in the panel`);
        if (/undefined|NaN/.test(r.meta)) fail(`${j} (${lv}), stop ${i + 1}: the card's meta reads "${r.meta}"`);
        if (r.seg !== i) fail(`${j} (${lv}): stop ${i + 1} shows as stop ${r.seg + 1}`);
        at[r.where] = await rider();
        await page.click("#heatCard [data-j=next]");
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(300);
      const end = await page.evaluate(() => ({ toast: document.querySelector("#heatCard .j-toast").textContent, meta: document.querySelector("#heatCard .j-meta").textContent, hour: store.get().hour }));
      if (end.toast !== C.journeys[j].effect) fail(`${j}: arrival says "${end.toast}", not "${C.journeys[j].effect}"`);
      if (!/of real time/.test(end.meta)) fail(`${j}: the end says "${end.meta}", without the time it took`);
      /* the rider goes where the text says: the hypothalamus, a sweat pore, then up into the air */
      const near = (p, q, d) => p && Math.hypot(p[0] - q[0], p[1] - q[1]) < d;
      if (!near(at[C.stops.preoptic.name], [600, 152], 4)) fail(`${j}: at the thermostat the rider is at ${at[C.stops.preoptic.name]}, not the hypothalamus`);
      const gland = at[C.stops.sweatGland.name];
      if (!pores.some(q => near(gland, q, 3))) fail(`${j}: at the sweat gland the rider is at ${gland}, not on a sweat pore`);
      const air = at[C.stops.evaporation.name];
      if (!air || !(air[1] < gland[1])) fail(`${j}: the vapour (${air}) doesn't rise above the pore (${gland})`);
      /* Replay starts again from the same hour */
      await page.click("#heatCard [data-j=next]"); await page.waitForTimeout(300);
      const again = await page.evaluate(() => ({ seg: store.get().heatSeg, id: store.get().heat, hour: store.get().hour }));
      if (again.id !== j || again.seg !== 0 || Math.abs(again.hour - st.hour) > .02) fail(`${j}: Replay didn't start again from ${st.hour.toFixed(2)} h (${JSON.stringify(again)})`);
    }
  }
  await page.click("#heatCard [data-j=stop]"); await page.waitForTimeout(500);
  if (await page.evaluate(() => store.get().heat != null || document.querySelector("#heatCard").classList.contains("on"))) fail("Stop didn't end the heat ride");
  /* the skin's organ panel offers it */
  await page.evaluate(() => store.set({ topic: "skin" })); await page.waitForTimeout(500);
  if (!(await page.$("#panel [data-heat]"))) fail("the skin panel has no heat-ride chip");
  else {
    await page.click("#panel [data-heat]"); await page.waitForTimeout(500);
    if ((await page.evaluate(() => store.get().heat)) !== "run") fail("the skin panel's chip didn't start the heat ride");
    await page.click("#heatCard [data-j=stop]"); await page.waitForTimeout(700);
  }
  /* a tap on a sweat pore (one that isn't covered) starts it */
  await page.evaluate(() => store.set({ hour: 12 })); await page.waitForTimeout(800);
  const box = await page.evaluate(() => {
    for (const e of document.querySelectorAll("#s-skin .sk-pore")){
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
      if (hit && hit.closest("#scene") && !hit.closest(".mk")) return { x, y };
    }
    return null;
  });
  if (!box) fail("every sweat pore is covered, so none can be tapped");
  else {
    await page.mouse.click(box.x, box.y); await page.waitForTimeout(500);
    const t = await page.evaluate(() => ({ id: store.get().heat, hour: store.get().hour }));
    if (t.id !== "run") fail(`tapping a sweat pore didn't start the heat ride (${JSON.stringify(t)})`);
    else if (t.hour < 17.1 || t.hour > 18) fail(`a tap at noon left the clock at ${t.hour.toFixed(2)} h, not in the run`);
  }
  console.log(`  ✓ ${Object.keys(C.journeys).length} heat journey(s) at two levels, the rider at the hypothalamus, a pore and the air, Replay, the skin chip, tap a pore`);
}
/* the step journey, stop by stop, with the stride pinned to it, "Other leg" and a tap on a thigh */
async function steps(page, fail){
  const C = await page.evaluate(() => CONTENT.step);
  for (const [k, st] of Object.entries(C.stops))
    for (const lv of ["name", "ms", "hs", "college", "phd"]) if (!st[lv] || st[lv].length < (lv === "name" ? 3 : 40)) fail(`step stop ${k} has no ${lv} text`);
  for (const j of Object.keys(C.journeys)){
    for (const lv of ["ms", "phd"]){
      await page.goto(base + `?hour=10&level=${lv}&ride=step:${j}`);
      await page.waitForTimeout(900);
      await page.evaluate(() => { window.store = HumanPhysiology.store; });
      const st = await page.evaluate(() => ({ id: store.get().step, live: store.get().live, hour: store.get().hour, n: document.querySelectorAll(".journey-steps li").length,
        card: document.querySelector("#stepCard").classList.contains("on") }));
      if (st.id !== j || st.live !== "musculoskeletal" || !st.card){ fail(`?ride=step:${j} did not start it (${JSON.stringify(st)})`); continue; }
      if (st.hour < 17.1 || st.hour > 17.95) fail(`started at 10:00, the step ride left the clock at ${st.hour.toFixed(2)} h, not in the run`);
      const seen = new Set(), arrow = {};
      /* each stop plays for a moment, then the ride is paused to read it (the stride stays pinned) */
      const pause = on => page.evaluate(v => HumanPhysiology.store.set({ ridePaused: v }), on);
      /* back to the start with the card's scrubber */
      await page.evaluate(() => { const r = document.querySelector("#stepCard .j-scrub input"); r.value = 0; r.dispatchEvent(new Event("input", { bubbles: true })); });
      for (let i = 0; i < st.n; i++){
        await pause(false); await page.waitForTimeout(450); await pause(true); await page.waitForTimeout(80);
        const r = await page.evaluate(() => ({ seg: store.get().stepSeg, where: document.querySelector("#stepCard .j-where").textContent,
          on: (document.querySelector(".journey-steps li.on") || {}).textContent, text: (document.querySelector("#panel .reading .text") || {}).textContent || "",
          meta: document.querySelector("#stepCard .j-meta").textContent }));
        if (r.where !== r.on) fail(`${j} (${lv}), stop ${i + 1}: the card says "${r.where}" but the panel marks "${r.on}"`);
        if (r.text.length < 40) fail(`${j} (${lv}), stop ${i + 1}: no text in the panel`);
        if (/undefined|NaN/.test(r.meta)) fail(`${j} (${lv}), stop ${i + 1}: the card's meta reads "${r.meta}"`);
        seen.add(r.seg);
        /* the foot's arrow and the tibia's glow on this stop */
        arrow[r.seg] = await page.evaluate(() => ({ grf: +getComputedStyle(document.querySelectorAll("#scene .ms-grf")[0]).opacity,
          bone: Math.max(...[...document.querySelectorAll('#scene .ms-strain[data-side="1"]')].map(e => +getComputedStyle(e).opacity)) }));
        await page.click("#stepCard [data-j=next]");
        await page.waitForTimeout(120);
      }
      const end = await page.evaluate(() => ({ toast: document.querySelector("#stepCard .j-toast").textContent, meta: document.querySelector("#stepCard .j-meta").textContent }));
      if (seen.size !== st.n) fail(`${j} (${lv}): visited ${seen.size} of ${st.n} stops`);
      if (end.toast !== C.journeys[j].effect) fail(`${j}: arrival says "${end.toast}", not "${C.journeys[j].effect}"`);
      if (!/s of real time/.test(end.meta)) fail(`${j}: the end says "${end.meta}", without the time it took`);
      /* before the landing the foot is in the air; from it on the ground pushes back, and at mid-stance the bone bends */
      const idx = await page.evaluate(() => [...document.querySelectorAll(".journey-steps li")].map(e => e.textContent));
      const at = name => idx.indexOf(C.stops[name].name);
      if (arrow[at("crossBridges")] && arrow[at("crossBridges")].grf > .05) fail(`${j}: the ground pushes back before the foot lands`);
      if (!arrow[at("footStrike")] || arrow[at("footStrike")].grf < .05) fail(`${j}: no ground-reaction arrow as the foot lands (${JSON.stringify(arrow[at("footStrike")])})`);
      const mid = arrow[at("boneBend")];
      if (!mid || mid.grf < .6 || mid.bone < .4) fail(`${j}: at mid-stance the arrow or the tibia's glow is faint (${JSON.stringify(mid)})`);
    }
  }
  /* "Other leg" runs it on the other side: by the cross-bridges stop the rider is in the viewer's right thigh */
  const inThigh = async () => {
    await page.evaluate(() => HumanPhysiology.store.set({ ridePaused: true }));
    const k = await page.evaluate(n => [...document.querySelectorAll(".journey-steps li")].findIndex(e => e.textContent === n), C.stops.crossBridges.name);
    for (let i = 0; i < k; i++){ await page.click("#stepCard [data-j=next]"); await page.waitForTimeout(60); }
    return page.evaluate(() => ({ id: HumanPhysiology.store.get().step, x: +document.querySelector("#s-stepRide .imp-dot").getAttribute("cx") }));
  };
  await page.click("#stepCard [data-j=other]"); await page.waitForTimeout(300);
  const other = await inThigh();
  if (!other.id || other.x < 600) fail(`"Other leg" didn't move the ride to the other leg (${JSON.stringify(other)})`);
  await page.click("#stepCard [data-j=stop]"); await page.waitForTimeout(600);
  /* a tap on the viewer's right shin bone starts a step on that side (the thigh sits under the Muscles label) */
  await page.waitForFunction(() => { const r = document.querySelector('#scene .ms-strain[data-side="-1"][data-bone="1"]').getBoundingClientRect(), k = `${r.x.toFixed(1)},${r.y.toFixed(1)}`;
    const same = window.__shinAt === k; window.__shinAt = k; return same; }, null, { polling: 300, timeout: 5000 }).catch(() => {});
  const box = await page.evaluate(() => { const r = document.querySelector('#scene .ms-strain[data-side="-1"][data-bone="1"]').getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return { x, y, hit: !!document.elementFromPoint(x, y).closest("#scene") }; });
  if (!box.hit) fail("the right shin is covered, so it can't be tapped");
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(500);
  const tapped = await inThigh();
  if (!tapped.id || tapped.x < 600) fail(`tapping the right shin didn't start a step on that side (${JSON.stringify(tapped)})`);
  console.log(`  ✓ ${Object.keys(C.journeys).length} step journey(s) at two levels, the stride pinned to the ride, Other leg, tap a shin`);
}
console.log(failed ? `\n${failed} problem(s)` : "\nAll body systems work.");
process.exit(failed ? 1 : 0);
