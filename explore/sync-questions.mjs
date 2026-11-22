#!/usr/bin/env node
/* Copies every organ page's prediction questions into explore/questions.html, so the hub
   opens on its own (file:// or a web server) without fetching the pages:
     node explore/sync-questions.mjs           update the hub's #questions block
     node explore/sync-questions.mjs --check   only report whether it is out of date (exit 1)
   It takes from each organs/<id>.html (not _template.html) its #organ-meta name and, for each
   question, the id, title, ask, scenario and leadsTo. The converging cases (#cases) are written
   by hand in the hub. No dependencies. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url)), organs = join(dir, "..", "organs"), hubPath = join(dir, "questions.html");
const check = process.argv.includes("--check");
const block = (html, id) => { const m = html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`)); return m ? JSON.parse(m[1]) : null; };

const pages = readdirSync(organs).filter(f => f.endsWith(".html") && f !== "_template.html").sort().flatMap(f => {
  const html = readFileSync(join(organs, f), "utf8"), meta = block(html, "organ-meta") || {}, content = block(html, "organ-content") || {};
  const qs = content.questions || [];
  if (!qs.length) return [];
  return [{ page: f.replace(/\.html$/, ""), name: meta.name || f, questions: qs.map(q => ({ id: q.id, title: q.title, ask: q.ask, scenario: q.scenario, leadsTo: q.leadsTo || [] })) }];
});

/* index.html's side panel links to each organ's Predict section: keep its counts in step */
const idxPath = join(dir, "..", "index.html");
const index = readFileSync(idxPath, "utf8");
const counts = "const ORGAN_QUESTIONS = " + JSON.stringify(Object.fromEntries(pages.map(p => [p.page, p.questions.length]))) + ";";
const idxRe = /const ORGAN_QUESTIONS = \{[^\n]*\};/;
if (!idxRe.test(index)) throw new Error("index.html has no ORGAN_QUESTIONS line");
const idxOut = index.replace(idxRe, () => counts);
if (idxOut === index) console.log("index.html: up to date");
else if (check){ console.log("index.html: the side panel's question counts are out of date"); process.exit(1); }
else { writeFileSync(idxPath, idxOut); console.log("index.html: question counts updated"); }

const hub = readFileSync(hubPath, "utf8");
const re = /(<script type="application\/json" id="questions">)([\s\S]*?)(<\/script>)/;
if (!re.test(hub)) throw new Error("explore/questions.html has no #questions block");
const out = hub.replace(re, (m, a, b, c) => a + "\n" + JSON.stringify(pages, null, 1) + "\n" + c);
const n = pages.reduce((s, p) => s + p.questions.length, 0);
if (out === hub) console.log(`explore/questions.html: up to date (${n} questions on ${pages.length} pages)`);
else if (check){ console.log(`explore/questions.html: out of date (the pages have ${n} questions on ${pages.length} pages)`); process.exit(1); }
else { writeFileSync(hubPath, out); console.log(`explore/questions.html: updated (${n} questions on ${pages.length} pages)`); }
