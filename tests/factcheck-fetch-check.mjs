#!/usr/bin/env node
/* Offline check of fact-check/epmc.mjs, the text handling behind fact-check/fetch.mjs (no network):
     node tests/factcheck-fetch-check.mjs
   - fullTextUnits: JATS full text → paragraphs named by section path and number, figure and table captions
     by label, table rows; references, front matter and funding left out; entities and inline tags handled
   - abstractUnits: an abstract split at its headings
   - locate: exact after folding dashes, quotes and spaces; "loose" when only case, spacing or punctuation
     differ (with the source's own wording); nothing for an excerpt that isn't there
   - agrees: a record matches its cite when the cite drops the subtitle, and not when it is another paper
   - paperFromUrl: which paper (and which text) a Europe PMC, PubMed or PMC link points to; null for other links
   - pages.mjs: open textbook pages as units (headings, entities, inline tags), quotes across a line break, and a
     link filed under the wrong source refused before anything is fetched */
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const lib = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "fact-check", "epmc.mjs")).href);
const { fullTextUnits, abstractUnits, locate, agrees, canon, citeDoi, paperFromUrl } = lib;
let failed = 0;
const check = (ok, what, got) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || got === undefined ? "" : "\n     got: " + JSON.stringify(got)}`); if (!ok) failed++; };

const xml = `<?xml version="1.0"?><article><front><article-meta><title-group><article-title>Front title</article-title></title-group>
<abstract><p>Front abstract, left out.</p></abstract></article-meta></front>
<body>
<sec id="s1"><title>Introduction</title><p>Skin blood flow rises from about 250 mL&#x2009;min<sup>&#x2212;1</sup> at rest.</p>
<p>A second <italic>paragraph</italic> with a ref <xref ref-type="bibr" rid="b1">[1]</xref>.</p></sec>
<sec id="s2"><title>Results</title>
<sec id="s2a"><title>Heat loss</title><p>Sweat rates reached 1&#x2013;2 L&#x00b7;h<sup>&#x2212;1</sup> in trained subjects.</p>
<fig id="f1"><label>Fig 1</label><caption><title>Flow.</title><p>Forearm flow &amp; core temperature.</p></caption></fig>
<table-wrap id="t1"><label>Table 2</label><caption><p>Rates by group.</p></caption><table><thead><tr><th>Group</th><th>Rate</th></tr></thead>
<tbody><tr><td>Trained</td><td>1.8 &#xb1; 0.3</td></tr></tbody></table></table-wrap>
<p>Third: “curly quotes” and a non-breaking&#xa0;space.</p></sec></sec>
</body><back><ack><p>Thanks.</p></ack><ref-list><ref id="b1"><mixed-citation>Reference text, left out.</mixed-citation></ref></ref-list>
<funding-group><p>Funding, left out.</p></funding-group></back></article>`;

const units = fullTextUnits(xml), where = units.map(u => u.where), all = units.map(u => u.text).join(" ");
check(where[0] === "Introduction, para 1" && where[1] === "Introduction, para 2", "paragraphs named by section and number", where);
check(where.includes("Results > Heat loss, para 1") && where.includes("Results > Heat loss, para 2"), "nested sections give a path", where);
check(where.includes("Fig 1 caption") && where.includes("Table 2 caption"), "figure and table captions named by their label", where);
check(units.some(u => u.where === "Table 2, row" && u.text === "Trained | 1.8 ± 0.3"), "table rows, cells joined, entities decoded", units.filter(u => /row/.test(u.where)));
check(!/left out|Front title/.test(all), "front matter, references and funding left out", all);
check(units[0].text === "Skin blood flow rises from about 250 mL min−1 at rest.", "inline tags dropped, numeric entities decoded", units[0].text);
check(units[1].text === "A second paragraph with a ref [1].", "citation markers kept as printed", units[1].text);

let h = locate(units, "250 mL min-1 at rest");
check(h[0]?.how === "exact" && h[0].where === "Introduction, para 1", "exact match after folding the minus sign and thin space", h[0]);
h = locate(units, "Sweat rates reached 1-2 L·h−1");
check(h[0]?.how === "exact" && h[0].where === "Results > Heat loss, para 1", "en dash in the source, hyphen in the excerpt: exact", h[0]);
h = locate(units, 'Third: "curly quotes" and a non-breaking space');
check(h[0]?.how === "exact", "curly quotes and a non-breaking space fold to plain ones", h[0]);
h = locate(units, "sweat rates reached 1 2 l h 1 in trained");
check(h[0]?.how === "loose" && h[0].found === "Sweat rates reached 1-2 L·h-1 in trained", "case and punctuation differ: loose, with the source's wording (dashes folded)", h[0]);
check(locate(units, "Sweat rates reached 3 L per hour").length === 0, "an excerpt that isn't there: no match");
check(locate(units, "Sweat rates reached 1-2 L·h−1.")[0]?.how === "exact", "a full stop the checker added after a partial sentence: still exact");
check(locate(units, "Reference text, left out").length === 0, "references can't be quoted as the paper's own text");

const abs = abstractUnits({ abstractText: "<h4>Background</h4>Steroids are <i>controversial</i>.<h4>Results</h4>Recovery was faster (P&nbsp;=&nbsp;0.0001)." });
check(abs.length === 2 && abs[0].where === "abstract, Background" && abs[1].where === "abstract, Results", "abstract split at its headings", abs);
check(locate(abs, "faster (P = 0.0001)")[0]?.how === "exact", "abstract entities decoded, &nbsp; folded");
check(abstractUnits({ abstractText: "One plain paragraph." })[0]?.where === "abstract", "an abstract with no headings is one unit");

const cite = "Yam JC, Jiang Y, Tang SM, et al. Low-Concentration Atropine for Myopia Progression (LAMP) Study. Ophthalmology. 2019;126(1):113-124. doi:10.1016/j.ophtha.2018.05.029";
check(agrees({ title: "Low-Concentration Atropine for Myopia Progression (LAMP) Study: A Randomized, Double-Blinded, Placebo-Controlled Trial of 0.05%, 0.025%, and 0.01% Atropine Eye Drops in Myopia Control.", pubYear: "2019" }, cite).ok, "a cite without the subtitle matches");
check(agrees({ title: "2023 ESH Guidelines for the management of arterial hypertension The Task Force for the management of arterial hypertension of the European Society of Hypertension", pubYear: "2023" }, "Mancia G, et al. 2023 ESH Guidelines for the management of arterial hypertension. J Hypertens. 2023;41(12):1874-2071.").ok, "a subtitle with no colon matches on the opening words");
check(!agrees({ title: "Low-dose atropine for myopia: five-year outcomes", pubYear: "2023" }, cite).ok, "another paper doesn't match");
check(!agrees({ title: "Low-Concentration Atropine for Myopia Progression (LAMP) Study", pubYear: "2012" }, cite).ok, "the right title in the wrong year doesn't match");
check(citeDoi(cite) === "10.1016/j.ophtha.2018.05.029" && citeDoi("X. Lancet. 1998. doi:10.1016/S0140-6736(97)11096-0") === "10.1016/S0140-6736(97)11096-0", "DOIs parsed from a cite, brackets included");
check(canon("a b c–d­e") === "a b c-de", "canon: spaces, dashes and soft hyphens");

const P = u => JSON.stringify(paperFromUrl(u));
check(P("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:1734247%20AND%20SRC:MED&resultType=core&format=json") === '{"pmid":"1734247","shows":"abstract"}', "Europe PMC REST record → PMID, abstract");
check(P("https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8929548/fullTextXML") === '{"pmcid":"PMC8929548","shows":"full"}', "Europe PMC full text → PMCID, full text");
check(P("https://pubmed.ncbi.nlm.nih.gov/9500320/") === '{"pmid":"9500320","shows":"abstract"}', "PubMed page → PMID, abstract");
check(P("https://pmc.ncbi.nlm.nih.gov/articles/PMC5723673#sec2") === '{"pmcid":"PMC5723673","shows":"full"}' && P("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5723673/") === '{"pmcid":"PMC5723673","shows":"full"}', "PMC pages, old and new → PMCID, full text");
check(P("https://europepmc.org/article/MED/1734247") === '{"pmid":"1734247","shows":"full"}', "europepmc.org article page → PMID");
check(paperFromUrl("https://openstax.org/books/anatomy-and-physiology-2e/pages/10-2-skeletal-muscle") === null && paperFromUrl("https://www.ncbi.nlm.nih.gov/books/NBK279388/") === null, "other links (OpenStax, Bookshelf): not a paper link");

/* open textbook pages (fact-check/pages.mjs) */
const pg = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "fact-check", "pages.mjs")).href);
const html = `<html><head><script>var x = "not text";</script><style>.a{}</style></head><body><nav><a href="/">Home</a></nav>
<h2>Cardiac Cycle</h2><p>The SA node fires at 100-110 action potentials (&ldquo;beats&rdquo;) per minute, about 10<sup>5</sup> times a day.</p>
<p>Extravascular compression during systole affects coronary flow.<br>Therefore, most of the coronary flow occurs during diastole.</p>
<h3>Phases</h3><ul><li>Diastole: the ventricles are <em>relaxed</em>.</li></ul></body></html>`;
const pu = pg.pageUnits(html), ptext = pu.map(u => u.text).join(" | ");
check(!/not text|\.a\{/.test(ptext), "scripts and styles left out of a page", ptext);
check(pu.some(u => u.where === "Cardiac Cycle" && u.text.includes("(“beats”)")), "named entities (&ldquo;) decoded, units named by their heading", pu);
check(pu.some(u => u.text.includes("about 105 times")), "inline tags add no space (10<sup>5</sup> → 105)", ptext);
check(pu.some(u => u.where === "Phases" && u.text === "Diastole: the ventricles are relaxed."), "list items under a later heading", pu);
check(locate(pu, "during systole affects coronary flow. Therefore, most of the coronary flow").length === 0 &&
  locate([{ where: "page", text: pu.map(u => u.text).join(" ") }], "during systole affects coronary flow. Therefore, most of the coronary flow")[0]?.how === "exact",
  "a quote across a line break is found in the page as one run (as checkPageQuote does)");
check(pg.isPageUrl("https://openstax.org/books/anatomy-and-physiology-2e/pages/19-3-cardiac-cycle") && pg.isPageUrl("https://cvphysiology.com/arrhythmias/a005#:~:text=x") && !pg.isPageUrl("https://en.wikipedia.org/wiki/Heart"),
  "which pages are read: OpenStax, Klabunde; not others");
const ws = await pg.checkPageQuote("https://openstax.org/books/anatomy-and-physiology-2e/pages/19-3-cardiac-cycle", "any quote here", { home: "https://cvphysiology.com/" });
check(ws?.state === "wrong-source", "an OpenStax link filed under Klabunde: wrong source (no fetch needed)", ws);
const wb = await pg.checkPageQuote("https://openstax.org/books/biology-2e/pages/40-3-mammalian-heart-and-blood-vessels", "any quote here", { home: "https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction" });
check(wb?.state === "wrong-source", "another OpenStax book than the source's: wrong source", wb);
check((await pg.checkPageQuote("https://www.frontiersin.org/articles/x", "any quote here", {})) === null, "a site this doesn't read: no check (the link rule alone)");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
