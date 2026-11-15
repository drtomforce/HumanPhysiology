#!/usr/bin/env node
/* Checks for the nightly triage (and for anyone changing the site). Serves the
   checkout on a local port and drives it with Playwright, so it tests the code
   in this working tree, not the published site.

     node .github/triage/check.mjs smoke
         Load index.html and every organ page (desktop and phone) and fail on any
         script error; also fail if organs/sync-engine.mjs --check finds pages out of date.

     node .github/triage/check.mjs repro <repro URL> [--text "selected text"] [--out shot.png]
         Open a report's "repro" link (its https://drtomforce.github.io/HumanPhysiology/
         prefix is mapped to the local checkout), say whether the reported text is
         on screen in that state, and save a screenshot.

   Run it from the repository root (or set TRIAGE_ROOT). In the nightly triage a
   read-only copy runs from outside the checkout, so the agent cannot change it.
   The browser gets no environment variables, so pages under test can't see secrets.
   Needs the playwright package and a Chromium (npx playwright install chromium). */
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, extname, normalize, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TRIAGE_ROOT || process.cwd();
const SITE = "https://drtomforce.github.io/HumanPhysiology/";
/* playwright from next to this script first (the triage's read-only copy), then the checkout */
let chromium, devices;
try { ({ chromium, devices } = createRequire(import.meta.url)("playwright")); }
catch { ({ chromium, devices } = createRequire(join(ROOT, "noop.js"))("playwright")); }
const launch = () => chromium.launch({ env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "/tmp", LANG: "en_US.UTF-8" } });

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
function serve(){
  return new Promise(res => {
    const srv = createServer(async (req, rsp) => {
      const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
      try {
        const body = await readFile(join(ROOT, path.endsWith("/") ? path + "index.html" : path));
        rsp.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); rsp.end(body);
      } catch { rsp.writeHead(404); rsp.end("not found"); }
    }).listen(0, "127.0.0.1", () => res({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}
const norm = s => String(s).replace(/[‘’ʼ′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐-―−]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

/* pages may only reach the local server: web fonts and anything else outside are blocked */
async function open(browser, url, opts = {}){
  const local = new URL(url).origin + "/";
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), errors = [];
  await ctx.route("**/*", r => r.request().url().startsWith(local) ? r.continue() : r.abort("blockedbyclient"));
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("response", r => { if (r.url().startsWith(local) && r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

async function smoke(){
  let bad = 0;
  const sync = existsSync(join(HERE, "sync-engine.mjs")) ? join(HERE, "sync-engine.mjs") : join(ROOT, "organs", "sync-engine.mjs");
  try { execFileSync("node", [sync, "--check", "--dir", join(ROOT, "organs")], { stdio: "pipe" }); console.log("ok   shared blocks in sync"); }
  catch (e){ bad++; console.log("FAIL shared blocks out of date: run node organs/sync-engine.mjs\n" + e.stdout); }
  const pages = ["index.html", ...(await readdir(join(ROOT, "organs"))).filter(f => f.endsWith(".html") && f !== "_template.html").map(f => "organs/" + f)];
  const { srv, base } = await serve(), browser = await launch();
  for (const p of pages) for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 860 } }], ["phone", devices["iPhone 13"]]]){
    const { ctx, page, errors } = await open(browser, base + p, opts);
    const reporter = await page.evaluate(() => !!(window.HPReport && document.querySelector("[data-report]")));
    if (!reporter) errors.push("no Report a problem button");
    console.log(`${errors.length ? "FAIL" : "ok  "} ${p} (${name})${errors.length ? "\n     " + errors.join("\n     ") : ""}`);
    bad += errors.length > 0;
    await ctx.close();
  }
  await browser.close(); srv.close();
  process.exit(bad ? 1 : 0);
}

async function repro(url, text, out){
  if (!url) throw new Error("usage: check.mjs repro <repro URL> [--text …] [--out shot.png]");
  const { srv, base } = await serve(), browser = await launch();
  const local = url.startsWith(SITE) ? base + url.slice(SITE.length) : url;
  if (!local.startsWith(base)) throw new Error("only links into the site can be reproduced: " + url);
  const { ctx, page, errors } = await open(browser, local, { viewport: { width: 1280, height: 860 } });
  const res = { url: local, errors };
  if (text){
    const body = norm(await page.evaluate(() => document.body.innerText));
    res.textOnScreen = body.includes(norm(text));
  }
  if (out){
    /* screenshots only go into .triage/, never elsewhere in the checkout */
    const dest = resolve(ROOT, out), box = resolve(ROOT, ".triage") + sep;
    if (!dest.startsWith(box) || !dest.endsWith(".png")) throw new Error("--out must be a .png inside .triage/");
    mkdirSync(dirname(dest), { recursive: true });
    await page.screenshot({ path: dest }); res.screenshot = out;
  }
  console.log(JSON.stringify(res, null, 2));
  await ctx.close(); await browser.close(); srv.close();
}

const [cmd, ...args] = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
if (cmd === "smoke") await smoke();
else if (cmd === "repro") await repro(args[0], flag("--text"), flag("--out"));
else { console.log("usage: node .github/triage/check.mjs smoke | repro <url> [--text …] [--out shot.png]"); process.exit(2); }
