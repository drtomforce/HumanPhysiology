#!/usr/bin/env node
/* Headless check of the Export menu on every page (Playwright + Chromium):
     node tests/export-check.mjs            all pages
     node tests/export-check.mjs heart      only pages whose name contains "heart"
   For each page it checks that the page loads without errors and that every figure exports
   as a valid SVG (vector figures) and a non-blank PNG; that one figure records as WebM, GIF
   and a ZIP of PNG frames; that a settings file round-trips (with a scenario applied on the
   organ pages); and that the CSV data has rows. It serves the repository on a local port
   itself. Needs the playwright package (preinstalled in the cloud sessions). */
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
const base = `http://127.0.0.1:${server.address().port}/`;

const pages = ["index.html", ...readdirSync(join(root, "organs")).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => "organs/" + f)]
  .filter(p => p.includes(only));

const browser = await chromium.launch();
let failed = 0;
const fail = (page, msg) => { failed++; console.log(`  ✗ ${msg}`); };
for (const path of pages){
  console.log(path);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + path);
  await page.waitForTimeout(1200);
  if (!(await page.evaluate(() => !!window.Exporter))){ fail(page, "no Exporter on the page"); await ctx.close(); continue; }

  /* the button opens the menu */
  await page.click(".xp-btn");
  if (!(await page.isVisible(".xp"))) fail(page, "the Export menu did not open");
  await page.keyboard.press("Escape");

  /* every figure: SVG and PNG */
  const figs = await page.evaluate(async () => {
    const out = [];
    const blank = async blob => {
      const bmp = await createImageBitmap(blob), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext("2d");
      x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
      const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return { w: bmp.width, h: bmp.height, colours: seen.size };
    };
    for (const f of Exporter.figures()){
      const r = { id: f.id, canvas: f.canvas, shown: !!(f.node.offsetParent || f.node.getClientRects().length) };
      if (!r.shown){ out.push(r); continue; }
      try {
        if (!f.canvas){
          const svg = Exporter.svg(f.id), doc = new DOMParser().parseFromString(svg, "image/svg+xml");
          r.svgOk = !doc.querySelector("parsererror") && doc.documentElement.localName === "svg";
          r.svgKB = Math.round(svg.length / 1024);
          r.svgVars = /var\(--/.test(svg);
        }
        const png = await Exporter.png(f.id, { scale: 2 });
        const sig = new Uint8Array(await png.slice(0, 8).arrayBuffer());
        r.pngOk = sig[0] === 0x89 && sig[1] === 0x50;
        Object.assign(r, await blank(png));
      } catch(e){ r.error = e.message; }
      out.push(r);
    }
    return out;
  });
  for (const r of figs){
    if (!r.shown){ console.log(`  · ${r.id}: hidden in this view, skipped`); continue; }
    const bad = r.error || (!r.canvas && (!r.svgOk || r.svgVars)) || !r.pngOk || r.colours < 3;
    if (bad) fail(page, `${r.id}: ${r.error || JSON.stringify(r)}`);
    else console.log(`  ✓ ${r.id}: ${r.canvas ? "canvas" : `SVG ${r.svgKB} KB`}, PNG ${r.w}×${r.h}, ${r.colours} colours`);
  }

  /* animations of the first figure */
  const anim = await page.evaluate(async () => {
    const f = Exporter.figures().find(x => x.node.getClientRects().length), out = { id: f.id };
    const head = async (b, n) => [...new Uint8Array(await b.slice(0, n).arrayBuffer())].map(x => x.toString(16).padStart(2, "0")).join("");
    const t0 = performance.now();
    const webm = await Exporter.record(f.id, "video", { length: { seconds: .6 }, fps: 15 });
    out.webmMs = Math.round(performance.now() - t0);
    if (webm){
      out.webm = await head(webm, 4); out.webmKB = Math.round(webm.size / 1024);
      const v = document.createElement("video"); v.muted = true; v.src = URL.createObjectURL(webm);
      out.webmPlays = await new Promise(r => { v.onloadeddata = () => r(v.videoWidth > 0); v.onerror = () => r(false); setTimeout(() => r(false), 5000); });
    }
    const gif = await Exporter.record(f.id, "gif", { length: { seconds: .5 }, fps: 12 });
    if (gif){ out.gif = await head(gif, 6); const bmp = await createImageBitmap(gif).catch(() => null); out.gifOk = !!bmp; out.gifKB = Math.round(gif.size / 1024); }
    const zip = await Exporter.record(f.id, "frames", { length: { seconds: .3 }, fps: 10 });
    if (zip) out.zip = await head(zip, 4);
    return out;
  });
  if (anim.webm !== "1a45dfa3" || !anim.webmPlays) fail(page, `WebM: ${JSON.stringify(anim)}`); else console.log(`  ✓ ${anim.id}: WebM ${anim.webmKB} KB in ${anim.webmMs} ms, plays`);
  if (anim.gif !== "474946383961" || !anim.gifOk) fail(page, `GIF: ${JSON.stringify(anim)}`); else console.log(`  ✓ ${anim.id}: GIF ${anim.gifKB} KB, decodes`);
  if (anim.zip !== "504b0304") fail(page, `PNG frames: ${JSON.stringify(anim)}`); else console.log(`  ✓ ${anim.id}: PNG frames ZIP`);

  /* GIF colours (issue #10): the 256-colour palette must keep small regions' colours, here the
     blue right heart of the body page's heart close-up, instead of averaging them into purple */
  if (path === "index.html"){
    await page.evaluate(() => HumanPhysiology.store.set({ topic: "heart" }));
    await page.waitForTimeout(1500);
    const pal = await page.evaluate(async () => {
      const blue = async blob => {
        const bmp = await createImageBitmap(blob), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext("2d");
        x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 40 && d[i + 2] > d[i + 1] + 20) n++;
        return n / (d.length / 4);
      };
      const id = "closeup-heart";
      if (!Exporter.figures().some(f => f.id === id)) return null;
      const png = await Exporter.png(id, { scale: 2, caption: true });
      const gif = await Exporter.record(id, "gif", { length: { seconds: .3 }, fps: 10, scale: 2, caption: true });
      return { png: await blue(png), gif: await blue(gif) };
    });
    if (!pal) fail(page, "GIF colours: no heart close-up on the body page");
    else if (!(pal.png > .01 && pal.gif > pal.png * .6)) fail(page, `GIF colours: blue share ${(pal.gif * 100).toFixed(1)}% in the GIF vs ${(pal.png * 100).toFixed(1)}% in the PNG`);
    else console.log(`  ✓ GIF keeps the heart's blues (${(pal.gif * 100).toFixed(1)}% vs ${(pal.png * 100).toFixed(1)}% in the PNG)`);
  }

  /* settings round trip, with a scenario on the organ pages */
  if (await page.$("[data-alt-scen-toggle]")){
    await page.click("[data-alt-scen-toggle]");
    await page.click("[data-alt-scen]");
    await page.waitForTimeout(200);
  }
  const trip = await page.evaluate(async () => {
    const saved = Exporter.settings(), want = JSON.stringify(saved.state.changes || saved.state.shown);
    const other = JSON.parse(JSON.stringify(saved)); other.state.level = "ms"; other.state.hour = 3; other.state.changes = {}; if (other.state.shown) other.state.shown = { circulatory: true };
    await Exporter.applySettings(other);
    await Exporter.applySettings(saved);
    const back = Exporter.settings();
    return { ok: back.state.level === saved.state.level && Math.abs(back.state.hour - saved.state.hour) < .01 && JSON.stringify(back.state.changes || back.state.shown) === want,
      changes: want, scenario: back.state.scenario, before: saved.state.scenario };
  });
  if (!trip.ok || trip.scenario !== trip.before) fail(page, `settings round trip: ${JSON.stringify(trip)}`);
  else console.log(`  ✓ settings round-trip${trip.scenario ? ` (scenario ${trip.scenario})` : ""}`);

  /* data */
  const data = await page.evaluate(() => Exporter.data().map(t => [t.name, t.rows.length, t.columns.length]));
  if (!data.length || data.some(t => !t[1])) fail(page, `data: ${JSON.stringify(data)}`); else console.log(`  ✓ CSV: ${data.map(t => `${t[0]} ${t[1]}×${t[2]}`).join("; ")}`);

  if (errors.length) fail(page, "page errors: " + errors.join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nAll exports work.");
process.exit(failed ? 1 : 0);
