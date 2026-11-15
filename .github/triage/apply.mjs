#!/usr/bin/env node
/* The trusted half of the nightly triage. No AI runs here; this script decides what
   reaches GitHub. The agent (judge job) only proposes: .triage/decisions.json plus
   fixed pages in .triage/fixes/<issue>/. Everything in them is treated as hostile.

     node apply.mjs list [--dump <dir>]
         The issues tonight's run may touch: the oldest MAX_ISSUES open issues labelled
         report + triage:pending. Writes $APPLY_DIR/eligible.json; with --dump, also each
         issue (body and comments) and the open triage PRs into <dir> for the agent.
         Needs GH_TOKEN (read is enough).
     node apply.mjs prepare
         Checks every decision and every fix. A fix becomes a local commit only if it
         touches nothing but existing pages, stays small, adds no scripts, links,
         network or storage code or hidden characters, keeps every JSON block valid,
         keeps the shared blocks in sync and passes the smoke test. A fix that fails
         is held back and the issue goes to needs-human. Writes $APPLY_DIR/plan.json
         and the run summary. Needs no token.
     node apply.mjs publish
         Carries out the plan: pushes triage/issue-<n> branches, opens PRs, comments,
         labels and closes. Needs GH_TOKEN with write access.

   Environment: TRIAGE_IN (the agent's output, default .triage), APPLY_DIR (work folder),
   MAX_ISSUES (10), MAX_FIXES (5), DRY_RUN, GITHUB_REPOSITORY, BASE_BRANCH (main). */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, lstatSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const IN = process.env.TRIAGE_IN || ".triage";
const WORK = process.env.APPLY_DIR || join(tmpdir(), "triage-apply");
const REPO = process.env.GITHUB_REPOSITORY || "drtomforce/HumanPhysiology";
const BASE = process.env.BASE_BRANCH || "main";
const int = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const MAX_ISSUES = int(process.env.MAX_ISSUES, 10, 1, 50);
const MAX_FIXES = int(process.env.MAX_FIXES, 5, 0, 10);
const MAX_LINES = 80;          /* distinct lines added or removed by one fix */
const MAX_TEXT = 6000;         /* characters in one comment or PR body */
const DRY = process.env.DRY_RUN === "true";
const VERDICTS = ["fix", "reject", "already-fixed", "duplicate", "needs-human", "skip"];
const PAGE = /^(index\.html|organs\/[a-z0-9_-]+\.html)$/;
const BOT = { name: "HumanPhysiology triage", email: "41898282+github-actions[bot]@users.noreply.github.com" };
const FOOTER = "\n\n---\n_Nightly automated triage. A maintainer reviews every change before it goes live; reply here if you disagree._";

mkdirSync(WORK, { recursive: true });
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["pipe", "pipe", "pipe"], ...opts });
const gh = (...args) => sh("gh", args);
/* hooks off: nothing in the checkout gets to run as part of a git command */
const git = (...args) => sh("git", ["-c", "core.hooksPath=/dev/null", ...args]);
const readJSON = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const writeJSON = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2)); };
const summary = s => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + "\n"); else console.log(s); };

/* ---------- text the agent wrote, made safe to post ---------- */
const SECRET = /sk-ant-[\w-]{8,}|\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[\w-]{10,}/;
const LINK_OK = u => {
  try {
    const x = new URL(u), h = x.hostname.toLowerCase();
    if (h === "github.com") return x.pathname.toLowerCase().startsWith(`/${REPO.toLowerCase()}/`);
    return ["drtomforce.github.io", "doi.org", "pubmed.ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov", "en.wikipedia.org"].includes(h);
  } catch { return false; }
};
function clean(s, max = MAX_TEXT){
  if (typeof s !== "string") return "";
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁩﻿]/g, "")
    .replace(/<!--[\s\S]*?(-->|$)/g, "")                 /* hidden comments */
    .replace(/<\/?[a-z][^>]*>/gi, "")                    /* raw HTML */
    .replace(/!\[/g, "[")                                /* images (tracking pixels) */
    .replace(/\bhttps?:\/\/[^\s)<>\]"'`]+/gi, u => LINK_OK(u) ? u : "`" + u.replace(/^https?:\/\//i, "") + "`")
    .replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, "$1@​")  /* no @-mentions */
    .replace(/\b([\w.-]+\/[\w.-]+)#(\d+)/g, "`$1#$2`")   /* no backlinks into other repositories */
    .trim();
  return s.length > max ? s.slice(0, max) + " …" : s;
}
const line = (s, max = 120) => clean(s, max * 2).replace(/\s+/g, " ").replace(/[`|]/g, "").slice(0, max).trim();

/* ---------- list ---------- */
function list(){
  const all = JSON.parse(gh("issue", "list", "--repo", REPO, "--label", "report", "--label", "triage:pending", "--state", "open", "--limit", "300", "--json", "number,createdAt"));
  const queue = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, MAX_ISSUES).map(i => i.number);
  writeJSON(join(WORK, "eligible.json"), queue);
  console.log(`${all.length} pending, ${queue.length} for tonight: ${queue.map(n => "#" + n).join(" ") || "none"}`);
  const i = process.argv.indexOf("--dump");
  if (i > 0){
    const dir = process.argv[i + 1];
    for (const n of queue)
      writeJSON(join(dir, "issues", `${n}.json`), JSON.parse(gh("issue", "view", String(n), "--repo", REPO, "--json", "number,title,body,createdAt,labels,author,comments")));
    writeJSON(join(dir, "open-prs.json"), JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "open", "--limit", "100", "--json", "number,title,headRefName,body")));
    writeJSON(join(dir, "queue.json"), queue);
  }
}

/* ---------- prepare: check every proposal ---------- */
const RED = [
  [/<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|style|svg|img|video|audio|source)\b/i, "adds an HTML tag that can load or run something"],
  [/javascript\s*:|data\s*:\s*text\/html/i, "adds a script URL"],
  [/<[^>]*\son[a-z]+\s*=/i, "adds an inline event handler"],
  [/\b(?:https?:)?\/\/[a-z0-9-]+\.[a-z]/i, "adds a web address"],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|\bimport\s*\(|\bimportScripts\b|\bset(Timeout|Interval)\s*\(\s*["'`]/, "adds dynamically evaluated code"],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection|serviceWorker|Worker)\b/, "adds network or worker code"],
  [/\b(document\.cookie|localStorage|sessionStorage|indexedDB|navigator\.clipboard)\b/, "touches browser storage or the clipboard"],
  [/\b(atob|btoa|fromCharCode|unescape|decodeURIComponent)\s*\(|\\x[0-9a-f]{2}|\\u00[0-9a-f]{2}/i, "adds encoded content"],
  [/\b(window\.open|location\s*(\.href)?\s*=|location\.(assign|replace)|innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/, "adds navigation or raw HTML writing"],
  [/[​-‏‪-‮⁠-⁩﻿]/, "adds invisible or direction-changing characters"]
];
function walk(dir){
  const out = [];
  for (const f of readdirSync(dir)){
    const p = join(dir, f), st = lstatSync(p);
    if (st.isSymbolicLink()) throw new Error(`symbolic link ${f}`);
    if (st.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
function jsonBlocksOk(html){
  const re = /<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) { try { JSON.parse(m[2]); } catch (e){ return `JSON block #${m[1]} no longer parses (${e.message})`; } }
  return null;
}
/* the smoke test gets no tokens: only what node and Playwright need */
const smokeEnv = () => Object.fromEntries(["PATH", "HOME", "NODE_PATH", "PLAYWRIGHT_BROWSERS_PATH"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const checkTools = () => existsSync(join(HERE, "check.mjs")) ? HERE : join(ROOT, ".github", "triage");
function tryFix(n, title){
  const dir = join(IN, "fixes", String(n)), fail = reasons => ({ ok: false, reasons });
  if (!existsSync(dir)) return fail(["no saved fix (save-fix.mjs was not run)"]);
  let files;
  try { files = walk(dir).map(p => relative(dir, p).split(sep).join("/")); } catch (e){ return fail([e.message]); }
  if (!files.length) return fail(["the saved fix is empty"]);
  const tracked = new Set(git("ls-files").split("\n"));
  for (const f of files){
    if (!PAGE.test(f)) return fail([`touches ${f}, which a fix may not change`]);
    if (!tracked.has(f)) return fail([`adds a new file ${f}`]);
    if (statSync(join(dir, f)).size > 4 << 20) return fail([`${f} is too large`]);
  }
  const branch = `triage-local/${n}`, reasons = [];
  git("switch", "-q", "-C", branch, BASE);
  try {
    for (const f of files) writeFileSync(join(ROOT, f), readFileSync(join(dir, f)));
    const diff = git("diff", "-U0", "--no-color", "--no-ext-diff", "--", ...files);
    const added = [], removed = [];
    for (const l of diff.split("\n")){
      if (l.startsWith("+++") || l.startsWith("---")) continue;
      if (l.startsWith("+")) added.push(l.slice(1)); else if (l.startsWith("-")) removed.push(l.slice(1));
    }
    if (!added.length && !removed.length) return fail(["the saved fix changes nothing"]);
    /* a change copied into every page by sync-engine counts once */
    const distinct = new Set([...added.map(l => "+" + l.trim()), ...removed.map(l => "-" + l.trim())]).size;
    if (distinct > MAX_LINES) reasons.push(`changes ${distinct} distinct lines (limit ${MAX_LINES})`);
    for (const l of added){
      if (SECRET.test(l)) reasons.push("adds something that looks like a secret");
      for (const [re, why] of RED) if (re.test(l)) reasons.push(why);
    }
    for (const f of files){ const e = jsonBlocksOk(readFileSync(join(ROOT, f), "utf8")); if (e) reasons.push(`${f}: ${e}`); }
    try { sh("node", [join(ROOT, "organs", "sync-engine.mjs"), "--check"]); } catch { reasons.push("the shared blocks are out of sync (edit organs/_template.html and sync)"); }
    if (!reasons.length){
      try { sh("node", [join(checkTools(), "check.mjs"), "smoke"], { env: smokeEnv() }); }
      catch (e){ reasons.push("the smoke test failed: " + (String(e.stdout || "").split("\n").filter(l => l.startsWith("FAIL") || l.startsWith("     ")).slice(0, 6).join(" ") || String(e.stderr || e.message).split("\n").slice(-4).join(" ")).slice(0, 400)); }
    }
    if (reasons.length) return fail([...new Set(reasons)]);
    git("add", "--", ...files);
    git("-c", `user.name=${BOT.name}`, "-c", `user.email=${BOT.email}`, "commit", "-q", "--no-verify", "-m", `Fix: ${title} (reported in #${n})`);
    const stat = git("diff", "--shortstat", `${BASE}..${branch}`).trim();
    return { ok: true, branch, stat, distinct };
  } finally {
    git("reset", "-q", "--hard");
    git("switch", "-q", BASE);
  }
}
function prepare(){
  const queue = readJSON(join(WORK, "eligible.json"), []);
  const raw = existsSync(join(IN, "decisions.json")) && statSync(join(IN, "decisions.json")).size < (1 << 20) ? readJSON(join(IN, "decisions.json"), null) : null;
  const decisions = raw && Array.isArray(raw.decisions) ? raw.decisions : [];
  const plan = [], ignored = [], seen = new Set();
  let fixes = 0;
  for (const d of decisions){
    const n = Number(d && d.issue);
    if (!queue.includes(n)){ ignored.push(`a decision for #${String(d && d.issue).slice(0, 12)}, which is not in tonight's queue`); continue; }
    if (seen.has(n)){ ignored.push(`a second decision for #${n}`); continue; }
    seen.add(n);
    const item = { issue: n, verdict: VERDICTS.includes(d.verdict) ? d.verdict : "skip", reason: line(d.reason, 160), comment: clean(d.comment), held: "" };
    if (!VERDICTS.includes(d.verdict)) item.held = `unknown verdict "${line(String(d.verdict), 20)}"`;
    if (item.verdict === "duplicate"){
      const of = Number(d.duplicateOf);
      if (Number.isInteger(of) && of > 0 && of !== n) item.duplicateOf = of;
      else { item.verdict = "needs-human"; item.held = "marked as a duplicate without a valid original"; }
    }
    if (item.verdict === "fix"){
      const title = line(d.pr && d.pr.title, 100) || `Fix the problem reported in #${n}`;
      if (fixes >= MAX_FIXES){ item.verdict = "skip"; item.held = `tonight's limit of ${MAX_FIXES} fixes was reached; it stays pending`; }
      else {
        const r = tryFix(n, title);
        if (r.ok){ fixes++; Object.assign(item, { branch: r.branch, stat: r.stat, pr: { title, body: clean(d.pr && d.pr.body) } }); }
        else { item.verdict = "needs-human"; item.held = "a fix was drafted but held back by the safety checks: " + r.reasons.join("; "); }
      }
    }
    if ([item.reason, item.comment, item.pr && item.pr.body, item.pr && item.pr.title].some(s => s && SECRET.test(s))){
      Object.assign(item, { verdict: "needs-human", comment: "", reason: "", pr: undefined, branch: undefined, held: "the agent's text looked like it contained a secret, so none of it was posted" });
    }
    if (!item.comment && item.verdict !== "skip") item.comment = {
      fix: "Thanks for the report! A fix is on its way.", reject: "Thanks for the report. After checking, we're keeping the text as it is.",
      "already-fixed": "Thanks for the report! This has already been fixed.", duplicate: "Thanks! This was already reported.",
      "needs-human": "Thanks for the report. A maintainer will take a look."
    }[item.verdict];
    plan.push(item);
  }
  for (const n of queue) if (!seen.has(n)) plan.push({ issue: n, verdict: "skip", held: "the agent made no decision; it stays pending" });
  writeJSON(join(WORK, "plan.json"), { plan, ignored });
  if (DRY) report(plan, ignored, "Dry run: nothing was posted");
  else console.log(JSON.stringify(plan.map(p => ({ issue: p.issue, verdict: p.verdict, held: p.held || undefined })), null, 1));
}
function report(plan, ignored, head){
  const v = { fix: "fix PR", reject: "rejected", "already-fixed": "already fixed", duplicate: "duplicate", "needs-human": "needs a human", skip: "left pending" };
  summary(`### Nightly triage · ${head}\n\n| Issue | Outcome | Why |\n|---|---|---|\n` + plan.map(p =>
    `| #${p.issue} | ${v[p.verdict]}${p.stat ? ` (${p.stat})` : ""}${p.url ? ` [PR](${p.url})` : ""} | ${line([p.reason, p.held].filter(Boolean).join(" · "), 300) || "–"} |`).join("\n") +
    (ignored.length ? `\n\nIgnored: ${ignored.map(s => line(s, 100)).join("; ")}.` : "") +
    `\n\nFix commits are checked again by this script before anything is pushed; every PR waits for a maintainer.`);
}

/* ---------- publish ---------- */
const LABELS = [
  ["report", "0E8A16", "Filed from the app's Report a problem form"], ["triage:pending", "FBCA04", "Waiting for the nightly triage"],
  ["verdict:fixed", "1D76DB", "Triage opened a fix PR"], ["verdict:rejected", "CCCCCC", "Triage found nothing to change"],
  ["verdict:duplicate", "CCCCCC", "Already reported"], ["needs-human", "D93F0B", "Triage needs a maintainer's decision"]
];
function labels(){ for (const [name, color, desc] of LABELS) gh("label", "create", name, "--repo", REPO, "--color", color, "--description", desc, "--force"); }
function publish(){
  labels();
  if (DRY){ console.log("Dry run: nothing published."); return; }
  const { plan = [], ignored = [] } = readJSON(join(WORK, "plan.json"), {});
  const still = new Set(JSON.parse(gh("issue", "list", "--repo", REPO, "--label", "triage:pending", "--state", "open", "--limit", "300", "--json", "number")).map(i => i.number));
  const auth = ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from("x-access-token:" + process.env.GH_TOKEN).toString("base64")}`];
  const body = text => { const f = join(WORK, "body.md"); writeFileSync(f, text); return f; };
  const comment = (n, text) => gh("issue", "comment", String(n), "--repo", REPO, "--body-file", body(clean(text, MAX_TEXT + 500) + FOOTER));
  const relabel = (n, add) => gh("issue", "edit", String(n), "--repo", REPO, "--add-label", add, "--remove-label", "triage:pending");
  for (const p of plan){
    if (p.verdict === "skip") continue;
    if (!still.has(p.issue)){ p.held = "no longer pending when the plan was carried out"; p.verdict = "skip"; continue; }
    try {
      let text = p.comment + (p.held ? `\n\n> ${p.held}` : "");
      if (p.verdict === "fix"){
        let name = `triage/issue-${p.issue}`;
        if (git(...auth, "ls-remote", "--heads", "origin", name).trim()) name += `-${process.env.GITHUB_RUN_NUMBER || Date.now()}`;
        git(...auth, "push", "-q", "origin", `${p.branch}:refs/heads/${name}`);
        const prBody = `Fixes #${p.issue}\n\n${p.pr.body}\n\n---\n**Automatic checks passed:** only existing pages changed (${p.stat}), no scripts, links, network, storage or hidden characters added, JSON blocks valid, shared blocks in sync, smoke test on every page. A maintainer must review and merge.`;
        p.url = gh("pr", "create", "--repo", REPO, "--base", BASE, "--head", name, "--title", p.pr.title, "--body-file", body(prBody)).trim().split("\n").pop();
        comment(p.issue, `${text}\n\nProposed fix: ${p.url}`);
        relabel(p.issue, "verdict:fixed");
      } else if (p.verdict === "reject" || p.verdict === "already-fixed"){
        comment(p.issue, text);
        relabel(p.issue, "verdict:rejected");
        gh("issue", "close", String(p.issue), "--repo", REPO, "--reason", p.verdict === "reject" ? "not planned" : "completed");
      } else if (p.verdict === "duplicate"){
        comment(p.issue, `${text}\n\nDuplicate of #${p.duplicateOf}.`);
        relabel(p.issue, "verdict:duplicate");
        gh("issue", "close", String(p.issue), "--repo", REPO, "--reason", "not planned");
      } else if (p.verdict === "needs-human"){
        comment(p.issue, text);
        relabel(p.issue, "needs-human");
      }
    } catch (e){
      p.held = `publishing failed: ${String(e.stderr || e.message).slice(0, 200)}`;
      console.error(`#${p.issue}: ${p.held}`);
    }
  }
  report(plan, ignored, "Done");
}

const cmd = process.argv[2];
if (cmd === "list") list();
else if (cmd === "prepare") prepare();
else if (cmd === "publish") publish();
else { console.log("usage: node apply.mjs list [--dump <dir>] | prepare | publish"); process.exit(2); }
