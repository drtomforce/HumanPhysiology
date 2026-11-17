#!/usr/bin/env node
/* Headless check of the organ pages on a small phone (Playwright + Chromium):
     node tests/organ-mobile-check.mjs          every organ page
     node tests/organ-mobile-check.mjs gut      only pages whose name contains "gut"
   At 339 × 568 (an Android phone, the size in issue #1), for each organ page, loaded both
   plainly and with a section hash, it scrolls every canvas figure (canvas.trace) into view and
   checks that it has drawn something, that it is not wider than the screen, and that the
   page has no horizontal scroll and no errors. It serves the repository on a local port
   itself. Needs the playwright package. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv[2] || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/organs/`;
const pages = readdirSync(join(root, "organs")).filter(f => f.endsWith(".html") && f !== "_template.html" && f.includes(only));

const browser = await chromium.launch();
let failed = 0;
for (const file of pages){
  for (const hashed of [false, true]){
    const ctx = await browser.newContext({ viewport: { width: 339, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
    await page.goto(base + file);
    /* with a hash: the section that holds the first canvas figure, as a shared link would */
    let tag = file;
    if (hashed){
      const sec = await page.evaluate(() => { const c = document.querySelector("[data-section] canvas.trace"); return c ? c.closest("[data-section]").id : ""; });
      if (!sec){ await ctx.close(); continue; }
      tag += "#" + sec;
      await page.goto(base + file + "#" + sec);
    }
    await page.waitForTimeout(1200);
    const before = failed, fail = msg => { failed++; console.log(`  ✗ ${tag}: ${msg}`); };
    const ids = await page.evaluate(() => [...document.querySelectorAll("canvas.trace[id]")].filter(c => c.getClientRects().length).map(c => c.id));
    for (const id of ids){
      await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: "center" }), id);
      await page.waitForTimeout(400);
      const r = await page.evaluate(id => {
        const n = document.getElementById(id), b = n.getBoundingClientRect();
        const d = n.getContext("2d").getImageData(0, 0, n.width, n.height).data;
        let ink = 0; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 0) ink++;
        return { w: b.width, right: b.right, ink };
      }, id);
      if (!r.ink) fail(`${id} is blank`);
      if (r.right > 339 + 1) fail(`${id} runs off the screen (${Math.round(r.right)} px)`);
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 339 + 1) fail(`horizontal scroll (${sw} px)`);
    if (errors.length) fail("page errors: " + errors.join(" | "));
    console.log(`${failed > before ? "✗" : "✓"} ${tag}: ${ids.length} canvas figures`);
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nEvery canvas figure draws on a small phone.");
process.exit(failed ? 1 : 0);
