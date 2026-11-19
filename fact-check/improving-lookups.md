# Improving the number of look-ups

Notes for later consideration, written on 2026-11-19. Nothing here has been acted on yet. The figures come from `fact-check/ledger.json` and `fact-check/sources.json` on that date. See [FACTUAL_CHECK.md](../FACTUAL_CHECK.md#looked-up-or-from-memory) for the rules they refer to.

## Why the count is low

1. **Rows cite textbooks no one can open.** Memory citations are dominated by subscription textbooks: Guyton about 2,840, Boron about 2,150, Kandel about 780, West about 650. FACTUAL_CHECK.md says an AI checker can only cite these from memory.
2. **One recalled source keeps the whole row at "memory".** `via: lookup` needs *every* cited source to have been opened. Most heart rows cite Klabunde (open) alongside Guyton (subscription), so even if Klabunde is opened, Guyton keeps the row at memory. Of the approved rows not marked as looked up, 2,185 already cite at least one open source (body 1,028, heart 1,070, lungs 87). Only 2 cite open sources and nothing else.
3. **Open sources are being recalled instead of opened.** Klabunde has 1,070 memory citations against 3 look-ups. OpenStax has 556 against 38, plus Endotext 266 and Purves 254. These are free to open, so this is the cheapest gap to close.
4. **Each look-up is done one row at a time.** A fetch plus a verbatim quote for every row is slow, so the nightly build falls back on memory.
5. **1,335 body rows have no source recorded at all.** They were approved before sources were tracked.

## What to do, in order of value per effort

1. **Re-cite the open-source memory rows by opening the source.** For example: `node fact-check/scan.mjs --via memory --cites klabunde-web --list --all`. Group the rows by topic and fetch each page once. Re-mark with only the source actually opened (`--lookup … --url … --quote …`) and leave out the recalled textbook. A fresh `--mark` replaces the old citations, so the row becomes `lookup`. Only drop Guyton where the open source fully supports the claim on its own. This alone could turn roughly 2,000 rows into look-ups, mostly on the heart and body pages.
2. **One fetched passage can cover many rows.** One OpenStax or Klabunde section usually supports a part's four reading levels, its glossary entry and its hero stat. Mark them together with `--prefix`, with the same link and quote, but only rows the quote actually supports. This lowers the cost of each look-up a lot.
3. **Do the five unstarted organs look-up-first.** Kidneys, brain, gut, liver and pancreas have about 5,500 rows. Before marking any section, fetch an open source for it: OpenStax for ms, hs and college; Endotext for the pancreas; the Colloquium Series (Lautt, Kvietys) for the liver and gut; KDIGO for kidney thresholds. Starting fresh costs far less than re-citing later.
4. **Spend scarce human time on the rows that matter most:**
   - the roughly 22 consistency-registry values, which propagate across every page;
   - clinical thresholds, where the method already says fixes should be looked up;
   - the 271 approved model-code rows.

   If someone has institutional access (ClinicalKey or AccessMedicine), a short session on these converts the Guyton and Boron citations that carry the most weight. The rules already allow a chapter URL on those platforms.
5. **Use the random re-checks as look-ups.** Each nightly `--sample 10` re-check that opens the source and confirms the row turns a memory row into a look-up. Sampling from `--via memory` or `unknown` rows aims this at the weakest evidence.
6. **Add more open sources where coverage is thin.** About 30 entries in `sources.json` have no `access` recorded. Find open copies of key papers through PMC or Europe PMC; those mirrors often get past the NCBI robot checks that block fetches. For kidney and gut physiology, look for open NCBI Bookshelf chapters the way the Colloquium Series was used.
7. **Set a nightly quota in the routine.** For example: "at least N look-ups per run, open-source memory rows first." That way the count rises even on nights that mostly clear new content. Watch it with `--sources` and the overview page, `fact-check.html`.

## Open policy question

Should a row count as looked up when its main source was opened and a textbook is cited only as backing from memory? The strict rule is the main reason the count stays near zero even where the open source was read. One option is a third label such as "partly looked up", which would show up on `fact-check.html`. That would need a change to `scan.mjs` and the page. Step 1 above works within the current rules, so it can start first.
