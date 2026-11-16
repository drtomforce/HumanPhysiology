#!/usr/bin/env node
/* Headless check of the scenarios and the changes bar on every organ page (Playwright + Chromium):
     node tests/scenario-check.mjs            all organ pages
     node tests/scenario-check.mjs liver      only pages whose name contains "liver"
   For each scenario on each page it checks that applying it:
     - raises no page errors;
     - puts at least one change in the changes bar, and the scenario shows as the active one;
     - writes the change into the address bar, so the set-up can be shared;
     - reaches at least one other section with a "Because of …" note (warned, not failed:
       a scenario may legitimately only change the section it is set in);
   then that "Reset all" clears every change, every note and every parameter from the URL,
   and that reloading the page with the scenario's link brings the same changes back.
   It serves the repository on a local port itself. Needs the playwright package. */
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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(root, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch(e){ res.writeHead(404); res.end("not found"); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const pages = readdirSync(join(root, "organs")).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => "organs/" + f).filter(p => p.includes(only));

const browser = await chromium.launch();
let failed = 0, warned = 0;
const fail = msg => { failed++; console.log(`  ✗ ${msg}`); };
const warn = msg => { warned++; console.log(`  ! ${msg}`); };

/* what the page looks like right now: changes, notes, the active scenario and the URL's own parameters */
const snapshot = () => ({
  items: [...document.querySelectorAll(".alt-go")].map(n => n.textContent.trim()),
  notes: document.querySelectorAll(".because-note").length,
  active: (document.querySelector("[data-alt-scen][aria-pressed=true]") || {}).dataset?.altScen || null,
  params: [...new URLSearchParams(location.search)].filter(([k]) => k !== "level" && k !== "hour").map(([k, v]) => `${k}=${v}`).sort().join("&"),
  sections: [...document.querySelectorAll("[data-section]")].filter(s => s.querySelector(".because-note")).map(s => s.id)
});

for (const path of pages){
  console.log(path);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + path);
  await page.waitForTimeout(900);

  const scenarios = await page.evaluate(() => (window.OrganPage ? OrganPage.get("alter.scenarios") || [] : []).map(s => ({ id: s.id, name: s.name })));
  if (!scenarios.length){ console.log("  · no scenarios on this page, skipped"); await ctx.close(); continue; }

  const clean = await page.evaluate(snapshot);
  if (clean.items.length) fail(`starts with changes already in the bar: ${clean.items.join(", ")}`);

  for (const sc of scenarios){
    const before = errors.length;
    await page.click("[data-alt-scen-toggle]");
    await page.click(`[data-alt-scen="${sc.id}"]`);
    await page.waitForTimeout(450);
    const s = await page.evaluate(snapshot);
    const link = await page.evaluate(() => location.href);
    if (errors.length > before){ fail(`${sc.id}: page errors: ${errors.slice(before).join(" | ")}`); continue; }
    if (!s.items.length){ fail(`${sc.id}: applied no changes`); continue; }
    if (s.active !== sc.id) fail(`${sc.id}: the scenario does not show as the active one (${s.active})`);
    if (!s.params) fail(`${sc.id}: the changes are not in the address bar`);
    if (!s.sections.length) warn(`${sc.id}: no "Because of …" note in any section`);

    /* reset clears everything */
    await page.click("[data-alt-reset]");
    await page.waitForTimeout(350);
    const r = await page.evaluate(snapshot);
    if (r.items.length) fail(`${sc.id}: reset left changes: ${r.items.join(", ")}`);
    if (r.notes) fail(`${sc.id}: reset left ${r.notes} "Because of …" note(s)`);
    if (r.params) fail(`${sc.id}: reset left parameters in the address bar: ${r.params}`);

    /* the shared link brings the same set-up back */
    const p2 = await ctx.newPage();
    const errs2 = [];
    p2.on("pageerror", e => errs2.push(e.message));
    await p2.goto(link);
    await p2.waitForTimeout(900);
    const back = await p2.evaluate(snapshot);
    if (errs2.length) fail(`${sc.id}: errors when opened from its link: ${errs2.join(" | ")}`);
    else if (back.params !== s.params) fail(`${sc.id}: its link restores "${back.params}" instead of "${s.params}"`);
    else if (back.items.length !== s.items.length) fail(`${sc.id}: its link restores ${back.items.length} change(s), not ${s.items.length}`);
    else console.log(`  ✓ ${sc.id}: ${s.items.length} change(s)${s.sections.length ? `, notes in ${s.sections.join(", ")}` : ""}, resets and shares`);
    await p2.close();
  }
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)${warned ? `, ${warned} warning(s)` : ""}` : `\nEvery scenario applies, resets and shares${warned ? ` (${warned} warning(s))` : ""}.`);
process.exit(failed ? 1 : 0);
