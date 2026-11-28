#!/usr/bin/env node
/* Headless check of the throat page's controls and models (Playwright + Chromium):
     node tests/throat-check.mjs
   In light and dark mode it checks that:
     - every switch (a few drinks, a stroke, thickened drinks, a PPI, choking, big tonsils, a
       jaw-forward splint) puts exactly one change in the changes bar and switches back;
     - choking blocks the airway and the back blows and thrusts clear it;
     - every choice (the food pipe, the vocal folds, the gas, the sleeping position, the bolus,
       the speaker, the vowel, breathe or say) cycles and returns to healthy, and the views
       (bolus, speaker, vowel, the night window) are not changes;
     - achalasia and oesophageal spasm are classified as such (Chicago v4.0);
     - BMI 38 gives sleep apnoea (AHI > 15) and CPAP 12 cmH₂O takes it below 5;
     - an octave up doubles the voice's pitch, and below the phonation threshold there is no voice;
     - the reading levels and parts of the day switch without errors, every part of the anatomy
       figure opens the inspector, every figure part has content at four levels and every
       content part is drawn;
   and that the page raises no console errors. It serves the repository on a local port itself.
   Needs the playwright package. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const b = await chromium.launch();
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
for (const scheme of ['light', 'dark']){
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto(`${base}organs/throat.html`); await pg.waitForTimeout(1200);
  const bar = async () => pg.evaluate(() => [...document.querySelectorAll('.op-alter .alt-list li')].length);
  const ro = k => pg.evaluate(k => document.querySelector(`[data-ro="${k}"]`).textContent, k);
  /* every toggle */
  for (const id of ['tAlc', 'tStroke', 'tThick', 'tPpi', 'tChoke', 'tTons', 'tMad']){
    await pg.click('#' + id); await pg.waitForTimeout(250);
    const n = await bar(); ok(n === 1, `${scheme}: ${id} registers one change (${n})`);
    await pg.click('#' + id); await pg.waitForTimeout(150);
    ok(await bar() === 0, `${scheme}: ${id} toggles back`);
  }
  /* choking then thrusts */
  await pg.click('#tChoke'); await pg.waitForTimeout(200);
  ok((await ro('aRoute')).includes('blocked'), `${scheme}: choking blocks the airway`);
  await pg.click('#tThrust'); await pg.waitForTimeout(200);
  ok(await bar() === 0 && (await pg.textContent('#swMsg')).length > 10, `${scheme}: thrusts clear it`);
  /* every choice group */
  for (const [host, vals, change] of [['#oesChoice', ['gord', 'achalasia', 'poem', 'spasm', 'weak', 'none'], true], ['#foldChoice', ['laryngitis', 'nodules', 'palsy', 'none'], true], ['#gasChoice', ['heliox', 'air'], true], ['#posChoice', ['back', 'side', 'mixed'], true],
    ['#bolusChoice', ['w20', 'thick', 'solid', 'w5'], false], ['#speakerChoice', ['woman', 'child', 'man'], false], ['#vowelChoice', ['i', 'e', 'o', 'u', 'a'], false], ['#modeChoice', ['breathe', 'say'], false]]){
    for (const v of vals){ await pg.click(`${host} [data-v="${v}"]`); await pg.waitForTimeout(150); }
    ok(await bar() === 0, `${scheme}: ${host} cycles and returns to healthy`);
  }
  await pg.click('#oesChoice [data-v="achalasia"]'); await pg.waitForTimeout(150);
  ok((await ro('sChi')).includes('achalasia'), `${scheme}: achalasia classified (${await ro('sChi')})`);
  await pg.click('#oesChoice [data-v="spasm"]'); await pg.waitForTimeout(150);
  ok(/spasm/.test(await ro('sChi')), `${scheme}: spasm classified`);
  await pg.click('#oesChoice [data-v="none"]');
  /* sliders */
  const setR = async (id, v) => { await pg.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]); await pg.waitForTimeout(250); };
  await setR('sBmi', 38); ok(+(await ro('nAhi')).match(/\d+/)[0] > 15, `${scheme}: BMI 38 gives sleep apnoea (${await ro('nAhi')})`);
  await setR('sCpap', 12); ok(+(await ro('nAhi')).match(/\d+/)[0] < 5, `${scheme}: CPAP 12 fixes it (${await ro('nAhi')})`);
  await setR('sCpap', 0); await setR('sBmi', 23);
  await setR('sAge', 80); ok(await bar() === 1, `${scheme}: age registers`); await setR('sAge', 30);
  const f1 = await ro('vF0'); await setR('sPitch', 12); const f2 = await ro('vF0'); ok(parseInt(f2) > 1.8 * parseInt(f1), `${scheme}: an octave up doubles the pitch (${f1} → ${f2})`); await setR('sPitch', 0);
  await setR('sPush', 2); ok((await ro('vF0')).trim() === '–', `${scheme}: below threshold there is no voice`); await setR('sPush', 7);
  await setR('sAt', 2); ok(await bar() === 0, `${scheme}: the night window is a view, not a change`);
  await pg.click('#tPlay'); await pg.click('#tSwallow'); await pg.click('#tLabels'); await pg.waitForTimeout(300); await pg.click('#tLabels');
  /* levels and phases */
  for (const lv of ['ms', 'college', 'phd', 'hs']){ await pg.click(`.op-ctrls [data-v="${lv}"]`); await pg.waitForTimeout(250); }
  for (const ph of ['sleep', 'meal', 'exercise', 'rest']){ await pg.click(`.op-ctrls [data-v="${ph}"]`); await pg.waitForTimeout(600); }
  ok((await ro('aRoute')).includes('nose'), `${scheme}: back at rest, breathing through the nose`);
  /* parts */
  const parts = await pg.evaluate(() => [...new Set([...document.querySelectorAll('#anatomy [data-part]')].map(n => n.dataset.part))]);
  for (const p of parts){ await pg.evaluate(p => { const n = document.querySelector(`#anatomy [data-part="${p}"]`); n.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, p); }
  const insp = await pg.textContent('#anatomy [data-inspector]');
  ok(insp.length > 50, `${scheme}: ${parts.length} parts click into the inspector`);
  const content = await pg.evaluate(() => JSON.parse(document.getElementById('organ-content').textContent));
  const used = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-part]')].map(n => n.dataset.part))]);
  const missing = used.filter(p => !content.parts[p]); ok(!missing.length, `${scheme}: every figure part has content (${missing.join(',')})`);
  const unused = Object.keys(content.parts).filter(p => !used.includes(p)); ok(!unused.length, `${scheme}: every content part is in a figure (${unused.join(',')})`);
  const lv4 = Object.entries(content.parts).filter(([k, p]) => !['ms', 'hs', 'college', 'phd'].every(l => p[l])).map(([k]) => k); ok(!lv4.length, `${scheme}: parts have four levels (${lv4})`);
  ok(!errs.length, `${scheme}: no console errors ${errs.slice(0, 3).join(' | ')}`);
  await pg.close();
}
await b.close();
server.close();
console.log(fails ? `\n${fails} problem(s)` : "\nEvery control on the throat page works.");
process.exit(fails ? 1 : 0);
