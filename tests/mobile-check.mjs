#!/usr/bin/env node
/* Headless check of the starting page on phones (Playwright + Chromium):
     node tests/mobile-check.mjs              all sizes
     node tests/mobile-check.mjs --shots DIR  also save a screenshot per size into DIR
   At each phone size, portrait and landscape, it checks that:
     - the page has no horizontal scroll;
     - no two organ dots overlap, each is a tap target of at least 44 × 44 px, and all sit
       inside the scene, clear of the clock bar and the systems row;
     - the clock bar and the systems row don't cover the body;
     - every body-system switch is at least 44 px tall;
     - tapping a dot names the organ, tapping the name opens it in a bottom (or side) sheet,
       the organ stays in view beside the sheet, and dragging the sheet down closes it;
     - a two-finger pinch zooms the body and "Whole body" zooms it back out.
   It serves the repository on a local port itself. Needs the playwright package. */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotsAt = process.argv.indexOf("--shots"), shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (shots) await mkdir(shots, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const SIZES = [
  [360, 640], [390, 664], [430, 740], [390, 844],      /* portrait */
  [667, 375], [750, 342], [844, 390], [932, 430]       /* landscape */
];
const overlap = (a, b, slack = 1) => a.x < b.x + b.w - slack && b.x < a.x + a.w - slack && a.y < b.y + b.h - slack && b.y < a.y + a.h - slack;

const browser = await chromium.launch();
let failed = 0;
for (const [w, h] of SIZES){
  const tag = `${w}×${h}`, before = failed;
  const fail = msg => { failed++; console.log(`  ✗ ${tag}: ${msg}`); };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(base);
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector("#sceneWrap").scrollIntoView());
  await page.waitForTimeout(250);

  const m = await page.evaluate(() => {
    const R = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of document.querySelectorAll("#s-body .skin")){ const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    return {
      phone: document.documentElement.classList.contains("phone"),
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      dots: [...document.querySelectorAll(".hs")].map(b => ({ id: b.dataset.topic, hidden: b.hidden, ...R(b) })),
      scene: R(document.querySelector("#scene")), bar: R(document.querySelector(".moment")), sys: R(document.querySelector("#sysSwitch")),
      body: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      switches: [...document.querySelectorAll("#sysSwitch .sw-tog, #sysSwitch .sw-name")].map(R)
    };
  });
  if (!m.phone) fail("the phone layout is not on");
  if (m.scrollW > m.innerW + 1) fail(`horizontal scroll (${m.scrollW} > ${m.innerW})`);
  for (const d of m.dots){
    if (d.hidden){ fail(`${d.id} has no dot on the whole body`); continue; }
    if (d.w < 44 || d.h < 44) fail(`${d.id} dot is ${d.w.toFixed(0)}×${d.h.toFixed(0)} px`);
    if (d.y < m.scene.y - 1 || d.y + d.h > m.scene.y + m.scene.h + 1 || d.x < m.scene.x - 1 || d.x + d.w > m.scene.x + m.scene.w + 1) fail(`${d.id} dot is outside the scene`);
  }
  for (let i = 0; i < m.dots.length; i++) for (let j = i + 1; j < m.dots.length; j++)
    if (overlap(m.dots[i], m.dots[j])) fail(`dots ${m.dots[i].id} and ${m.dots[j].id} overlap`);
  if (overlap(m.bar, m.body)) fail("the clock bar covers the body");
  if (overlap(m.sys, m.body)) fail("the systems row covers the body");
  for (const s of m.switches) if (s.h < 44) fail(`a system switch is only ${s.h.toFixed(0)} px tall`);
  /* the old layout drew the body about 150 px wide on a 390 × 664 phone */
  if (h > w && m.body.w < 165) fail(`the body is only ${m.body.w.toFixed(0)} px wide`);
  if (shots) await page.screenshot({ path: join(shots, `body-${w}x${h}.png`) });

  /* tap a dot: its name shows; tap the name: the organ opens in a sheet */
  await page.locator('.hs[data-topic="heart"]').tap();
  await page.waitForTimeout(150);
  const tip = await page.evaluate(() => { const t = document.querySelector(".hs-tip"); const r = t.getBoundingClientRect(); return { on: t.classList.contains("on"), text: t.textContent, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
  if (!tip.on || !/Heart/.test(tip.text)) fail("tapping the heart dot didn't name it");
  if (tip.h < 44) fail(`the name tip is only ${tip.h.toFixed(0)} px tall`);
  if (tip.left < 0 || tip.right > w) fail("the name tip runs off the screen");
  await page.locator(".hs-tip").tap();
  await page.waitForTimeout(1300);
  const open = await page.evaluate(() => {
    const p = document.querySelector("#panel"), r = p.getBoundingClientRect(), heart = document.querySelector("#s-ring").getBoundingClientRect();
    return { sheet: p.classList.contains("sheet"), top: r.top, left: r.left, h1: (document.querySelector("#panelInner h2") || {}).textContent,
             heart: { x: heart.left + heart.width / 2, y: heart.top + heart.height / 2 } };
  });
  if (!open.sheet) fail("the organ did not open as a sheet");
  if (!/Heart/.test(open.h1 || "")) fail("the sheet doesn't show the heart");
  const landscape = w > h;
  if (landscape ? open.heart.x > open.left - 10 : open.heart.y > open.top - 10) fail("the heart is hidden behind the sheet");
  if (open.heart.y < 0 || open.heart.x < 0) fail("the heart is off screen");
  if (shots) await page.screenshot({ path: join(shots, `sheet-${w}x${h}.png`) });
  if (!landscape){
    const hb = await page.locator("#sheetHandle").boundingBox();
    if (hb.height < 44) fail(`the sheet handle is only ${hb.height.toFixed(0)} px tall`);
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, h - 10, { steps: 8 }); await page.mouse.up();
  } else await page.locator("#panelInner [data-home]").first().tap();
  await page.waitForTimeout(400);
  if (await page.evaluate(() => document.querySelector("#panel").classList.contains("sheet"))) fail("the sheet didn't close");

  /* pinch out with two fingers over the chest, then "Whole body" */
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector("#sceneWrap").scrollIntoView());
  const vb0 = await page.evaluate(() => document.querySelector("#scene").viewBox.baseVal.width);
  const sc = await page.locator("#scene").boundingBox(), cx = sc.x + sc.width / 2, cy = sc.y + sc.height * .35;
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, d) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] });
  await touch("touchStart", 20);
  for (let d = 24; d <= 80; d += 8) await touch("touchMove", d);
  await touch("touchEnd", 0);
  await page.waitForTimeout(150);
  const z = await page.evaluate(() => ({ w: document.querySelector("#scene").viewBox.baseVal.width, reset: document.querySelector("#zoomReset").classList.contains("on") }));
  if (!(z.w < vb0 * .6)) fail(`pinching didn't zoom in (view ${vb0.toFixed(0)} → ${z.w.toFixed(0)})`);
  if (!z.reset) fail("no Whole body button while zoomed");
  const zd = await page.evaluate(() => [...document.querySelectorAll(".hs:not([hidden])")].map(b => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
  const sc2 = await page.locator("#scene").boundingBox();
  for (const d of zd) if (d.y < sc2.y - 1 || d.y + d.h > sc2.y + sc2.height + 1) fail("a dot sits outside the zoomed scene");
  for (let i = 0; i < zd.length; i++) for (let j = i + 1; j < zd.length; j++) if (overlap(zd[i], zd[j])) fail("two dots overlap when zoomed");
  if (shots) await page.screenshot({ path: join(shots, `zoom-${w}x${h}.png`) });
  await page.locator("#zoomReset").tap();
  await page.waitForTimeout(100);
  const vb1 = await page.evaluate(() => document.querySelector("#scene").viewBox.baseVal.width);
  if (Math.abs(vb1 - vb0) > 1) fail("Whole body didn't zoom back out");

  if (errors.length) fail("page errors: " + errors.join(" | "));
  console.log(`${failed > before ? "✗" : "✓"} ${tag}`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nAll phone checks passed");
process.exit(failed ? 1 : 0);
