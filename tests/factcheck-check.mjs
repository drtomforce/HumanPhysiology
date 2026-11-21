#!/usr/bin/env node
/* Headless check of the fact-check overview (Playwright + Chromium):
     node tests/factcheck-check.mjs              checks, writes nothing
     node tests/factcheck-check.mjs --shots <dir> also saves screenshots (light, dark, phone)
   On the main page, at desktop and phone width: the header reads Reading level → Fact check →
   Report a problem, and Fact check opens fact-check.html with a Back link to the same view.
   On fact-check.html, in light and dark: fact-check/status.js is loaded, the waffle draws one
   square per ledger row (its section counts add up to the ledger), both colour modes switch the
   legend, hovering a square shows a tooltip that marks that square's category and goes away when
   the pointer leaves, the reports list fills in (or falls back to links when GitHub can't be reached; the
   GitHub API is blocked here so the check doesn't depend on the network), and nothing scrolls
   sideways at 390 px. It serves the repository on a local port itself. Needs the playwright package. */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
if (shots) await mkdir(shots, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const ledger = JSON.parse(readFileSync(join(root, "fact-check", "ledger.json"), "utf8"));
const ledgerRows = Object.values(ledger.pages).reduce((n, rows) => n + Object.keys(rows).length, 0);

let failed = 0;
const fail = (tag, msg) => { failed++; console.log(`FAIL ${tag}: ${msg}`); };
const browser = await chromium.launch();

async function open(url, opts){
  const ctx = await browser.newContext(opts);
  await ctx.route(/api\.github\.com/, r => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::|api\.github/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + url);
  return { ctx, page, errors };
}

/* ---------- the header button on the main page ---------- */
for (const [tag, opts] of [["desktop", { viewport: { width: 1400, height: 900 } }], ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]]){
  const { ctx, page, errors } = await open("index.html?level=college&hour=18.5", opts);
  await page.waitForSelector("#factCheckBtn");
  const order = await page.evaluate(() => [...document.querySelector(".levels").children].map(e => e.id || e.className || e.tagName));
  const iSeg = order.indexOf("levelSeg"), iFc = order.indexOf("factCheckBtn"), iRep = order.findIndex(c => /hpr-open/.test(c) && c !== "factCheckBtn");
  if (!(iSeg >= 0 && iSeg < iFc && iFc < iRep)) fail(tag, `header order is ${order.join(" | ")}`);
  const box = await page.locator("#factCheckBtn").boundingBox();
  if (!box || box.width < 20 || box.x + box.width > opts.viewport.width) fail(tag, `Fact check button is off screen: ${JSON.stringify(box)}`);
  const label = await page.locator("#factCheckBtn .hpr-open-t").textContent();
  if (label !== "Fact check") fail(tag, `button label "${label}"`);
  await page.locator("#factCheckBtn").click();
  await page.waitForURL(/fact-check\.html/);
  const back = await page.locator("#back").getAttribute("href");
  if (!/^index\.html\?.*level=college/.test(back) || !/hour=18\.5/.test(back)) fail(tag, `Back link doesn't return to the view: ${back}`);
  if (errors.length) fail(tag, errors.join("; "));
  console.log(`${tag}: header ${order.slice(iSeg, iRep + 1).join(" → ")}; back → ${back}`);
  await ctx.close();
}

/* ---------- the overview page ---------- */
for (const [tag, opts] of [
  ["light", { viewport: { width: 1280, height: 900 }, colorScheme: "light" }],
  ["dark", { viewport: { width: 1280, height: 900 }, colorScheme: "dark" }],
  ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, colorScheme: "light" }],
]){
  const { ctx, page, errors } = await open("fact-check.html", opts);
  await page.waitForSelector("#pages .sec canvas");
  const r = await page.evaluate(() => {
    const S = window.FACT_STATUS, figs = [...document.querySelectorAll("#pages .sec")];
    const squares = figs.reduce((n, f) => n + f.__cats.length, 0);
    const blank = figs.filter(f => { const c = f.querySelector("canvas"); return !c.width || !c.height; }).length;
    const sections = S.pages.reduce((n, p) => n + p.sections.length, 0);
    const n = S.pages.reduce((a, p) => a + p.sections.reduce((b, s) => b + s.n, 0), 0);
    const sums = S.pages.every(p => p.sections.every(s => Object.values(s.src).reduce((a, b) => a + b, 0) === s.n && Object.values(s.out).reduce((a, b) => a + b, 0) === s.n));
    const wide = figs.filter(f => f.getBoundingClientRect().right > innerWidth + 1).length;
    return { squares, blank, figs: figs.length, sections, n, sums, wide, scrollW: document.documentElement.scrollWidth, w: innerWidth,
      tiles: document.querySelectorAll("#tiles .tile").length, legend: document.querySelector("#legend").textContent,
      bars: document.querySelectorAll("#bars .bar").length, pages: S.pages.length };
  });
  if (r.n !== ledgerRows) fail(tag, `status.js has ${r.n} rows, the ledger ${ledgerRows}: run node fact-check/scan.mjs --status`);
  if (r.squares !== r.n) fail(tag, `${r.squares} squares drawn for ${r.n} rows`);
  if (!r.sums) fail(tag, "a section's category counts don't add up to its rows");
  if (r.figs !== r.sections || r.blank) fail(tag, `${r.figs} section blocks for ${r.sections} sections, ${r.blank} blank`);
  if (r.bars !== r.pages) fail(tag, `${r.bars} bars for ${r.pages} pages`);
  if (r.tiles < 4) fail(tag, `${r.tiles} stat tiles`);
  if (!/Looked up/.test(r.legend) || !/From memory/.test(r.legend)) fail(tag, `source legend: ${r.legend}`);
  if (r.scrollW > r.w || r.wide) fail(tag, `scrolls sideways (${r.scrollW} > ${r.w}) or ${r.wide} blocks overflow`);

  /* the other colour mode */
  await page.locator('#modeSeg button[data-mode="out"]').click();
  const legend2 = await page.locator("#legend").textContent();
  if (!/Correct/.test(legend2) || !/Fixed/.test(legend2)) fail(tag, `outcome legend: ${legend2}`);
  const sq2 = await page.evaluate(() => [...document.querySelectorAll("#pages .sec")].reduce((n, f) => n + f.__cats.length, 0));
  if (sq2 !== r.n) fail(tag, `outcome mode drew ${sq2} squares`);
  await page.locator('#modeSeg button[data-mode="src"]').click();

  /* tooltip on a section: hover the first square of the first waffle */
  if (!opts.hasTouch){
    const fig = page.locator("#pages .sec canvas").first();
    await fig.scrollIntoViewIfNeeded();
    /* the page hides the tooltip on scroll, and that event lands a frame late, so let it settle first */
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const b = await fig.boundingBox();
    await page.mouse.move(b.x + 2, b.y + 2);
    const tip = await page.evaluate(() => { const t = document.querySelector("#tip");
      return { on: t.classList.contains("on"), hot: t.querySelectorAll("tr.hot").length, text: t.textContent }; });
    if (!tip.on || !/·/.test(tip.text)) fail(tag, `no tooltip on hover: ${tip.text}`);
    else if (!tip.hot) fail(tag, `tooltip doesn't mark the hovered square's category: ${tip.text}`);
    await page.mouse.move(2, 2);
    if (await page.evaluate(() => document.querySelector("#tip").classList.contains("on"))) fail(tag, "tooltip stays up after the pointer leaves");
  }

  /* the reports list falls back when GitHub can't be reached */
  await page.waitForFunction(() => !/Loading/.test(document.querySelector("#issues").textContent));
  const iss = await page.locator("#issues").textContent();
  if (!/Couldn't load/.test(iss)) fail(tag, `reports fallback: ${iss}`);

  if (errors.length) fail(tag, errors.join("; "));
  if (shots) await page.screenshot({ path: join(shots, `fact-check-${tag}.png`), fullPage: true });
  console.log(`${tag}: ${r.squares} squares in ${r.figs} sections on ${r.pages} pages; no sideways scroll`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nall good");
process.exit(failed ? 1 : 0);
