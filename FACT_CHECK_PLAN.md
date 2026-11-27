# Fact-check plan: better look-ups

A plan for raising the share of ledger rows that were actually looked up, by fetching papers through open biomedical APIs instead of publisher web pages. It builds on [FACTUAL_CHECK.md](FACTUAL_CHECK.md) (the rules) and [fact-check/improving-lookups.md](fact-check/improving-lookups.md) (the open-textbook plan of 2026-11-19), and changes neither until the steps below are agreed.

Written on 2026-11-27. The figures come from `fact-check/ledger.json`, `fact-check/sources.json` and test calls to the APIs, made that day from a session on the `humanphysiology` environment.

## Where things stand

| | Rows |
|---|---|
| `via: lookup` | 131 |
| `via: memory` | 10,964 |
| no `via` (approved before it was recorded) | 6,071 |

The 251 look-up citations are almost all OpenStax (212) or PMC and Europe PMC (31). Recalled citations fall into two groups, and they need different fixes:

| What is recalled | Recalled citations | Can an API fetch it? |
|---|---|---|
| Subscription textbooks: Guyton 8,346, Boron 6,076, Kandel 2,559, West 1,019, others | ~18,500 | **No.** No API carries textbook text. The fix is the open-textbook plan in `improving-lookups.md`. |
| Papers, reviews and guidelines (241 sources) | 3,081 | **Mostly yes**, for the abstract, and for the full text where the paper is open access. |
| `internal` (the consistency registry) | 466 | Not needed: it's a permalink into this repo. |

So the APIs are worth adopting, but they fix the smaller slice. The open-textbook work is still where most of the look-ups have to come from.

## Assessment of the suggestions

The suggestions arrived as advice pasted from another assistant. Each one was tested here before being adopted.

| Suggestion | Verdict | Why |
|---|---|---|
| Stop scraping publisher pages for papers and query open APIs instead | **Adopt** | The status table already records the failures: "the trial abstracts were behind robot and cookie walls" (brain), the "PubMed cookie wall" (`kiss2015`), and "curl met a robot check" (PMC). Tested: `pubmed.ncbi.nlm.nih.gov` and NCBI Bookshelf pages serve a reCAPTCHA page to scripts; `nejm.org` isn't on the environment's allowlist; the Europe PMC API returned the ONTT abstract at once. Nuance: the blocks seen here came from NCBI's robot check, cookie walls and the environment's own allowlist, more than from Cloudflare on publisher sites. |
| **Europe PMC REST API** | **Adopt as the main paper source** | Tested on `beck1992` (NEJM, paywalled): it returns the PMID, the publication types and the full structured abstract. Open-access papers return full-text XML with Methods and Results (tested on `brown2022`: 245 kB, every section). It flags retractions (tested on the retracted Wakefield 1998 paper: the publication types include "Retracted Publication", with "Retraction in" links). Its host, `www.ebi.ac.uk`, is already allowed, and 7 ledger rows already cite its REST URLs. Limits: `fullTextXML` answers 500 for PMC papers outside the open-access subset, and it answered 503 to the verifier twice, so a script needs retries. |
| **Crossref API** | **Adopt for metadata only** | Tested: title, journal and date for `beck1992`, but no abstract (most publishers don't deposit one). For checking that a `cite` string matches the DOI, it's the right tool. Correction: a retraction is **not** flagged on the original paper's Crossref record. The `update-to` link sits on the retraction *notice*, so a lookup needs `/works?filter=updates:<doi>`. Europe PMC is simpler for retractions. Host already allowed. |
| PubMed E-utilities | **Not needed now** | It returns the same abstracts as Europe PMC, which mirrors PubMed. `eutils.ncbi.nlm.nih.gov` isn't on the allowlist. Add it only if Europe PMC proves unreliable. |
| OpenAlex / Semantic Scholar | **Defer** | Useful for finding open-access PDF copies, but Europe PMC already gives OA status and a PMC id. Neither host is allowed. Worth a look later for the 66 sources with no DOI. |
| ClinicalTrials.gov API v2 | **Defer** | The app is about physiology; it names few trials (ONTT, ACHIEVE, LAMP, ATTENTION, BAOCHE), and their abstracts carry the arms and doses. Add `clinicaltrials.gov` if a page comes to lean on trial protocols. |
| A rule in `CLAUDE.md` | **Adapt** | The repo has no `CLAUDE.md`; the nightly checker follows `FACTUAL_CHECK.md`. Put the rule there (step 5). |
| Claim decomposition → retrieval → LLM entailment judge | **Adopt in part** | The ledger already splits text into one row per string, so decomposition is mostly done. The judge step matches a real failure: all 5 failed verifications so far were a real excerpt pasted onto rows it doesn't support (the troponin and tropomyosin rows). A strict claim-vs-excerpt check would catch those. "Unverifiable from abstract" already has a home: the row stays `--memory` and is never upgraded. |

One more reason to look things up: the pasted advice's own worked example gives the ONTT oral arm as "prednisolone". That is the error fixed in `b1a99c0`. The trial used oral **prednisone**, as the abstract fetched from Europe PMC says ("oral prednisone (1 mg per kilogram of body weight per day) for 14 days"). Recall, including another AI's recall, is what this plan is meant to replace.

## What does not change

- The rules in [Looked up or from memory](FACTUAL_CHECK.md#looked-up-or-from-memory): `--lookup` only for text fetched and read in this session, with a link and a verbatim excerpt. An abstract fetched through the API counts as read; a title and journal from Crossref don't.
- **An abstract supports only what it states.** If the claim needs a number from inside the paper and only the abstract is open, the source stays `--memory` for that row.
- Independent verification, random re-checks and the link check all stay as they are.

## The plan

### 1. Fix the Node proxy problem ✅ done 2026-11-27
In this container, Node 22's built-in `fetch` ignores `HTTPS_PROXY`, so every request fails with `ENOTFOUND`. `scan.mjs` would then refuse a good link as dead, or record it as `broken` in `links.json`. A second problem turned up while testing: through the cloud proxy, a host the environment's network doesn't allow fails exactly like a host that doesn't exist, so a working link to, say, `nejm.org` would also be called dead.

Done, in `fact-check/net.mjs` (shared with the fetch helper in step 3):
- `scan.mjs` re-runs itself with `NODE_USE_ENV_PROXY=1` when it needs the network and a proxy is set (Node 22.21+ or 24.5+), so nobody has to remember the variable.
- When a fetch fails, it asks the proxy for a tunnel to the host. A `403` or `407` means the environment's policy refuses the host: the link is **not checked**, not dead. `--mark` goes ahead with a warning, and `--check-links` reports it separately and leaves it due, instead of writing `broken` into `links.json`. This matters because WebFetch runs outside the container, so a checker can read a page the container can't reach.
- If the proxy allows the host but Node didn't use the proxy, the error says so and names the fix.
- `tests/factcheck-net-check.mjs` checks all of this against a fake local proxy, with no network.

Each request still takes a few seconds through the proxy.

### 2. Add identifiers to `sources.json` ✅ done 2026-11-27
Each paper, review and guideline now has the optional `doi`, `pmid` and `pmcid` fields where they exist. `fact-check/ids.mjs` fills them in and keeps them up to date as new sources arrive (see [Sources](FACTUAL_CHECK.md#sources)):
- `--write` writes only what is certain: the DOI already in the `cite`, plus the PMID and PMCID of the Europe PMC record with that exact DOI, when its title and year agree with the `cite`.
- `--search` lists candidates from Crossref and Europe PMC for sources with no DOI, and never writes.

Result, out of 266 papers, reviews and guidelines:

| | Sources |
|---|---|
| DOI from the `cite`, matched in Europe PMC | 194 |
| DOI found by search, confirmed by hand against the `cite` (first author, title, journal, volume, first page, year) | 51 |
| PMID only (no DOI exists: `brubaker1991`, IOVS 1991) | 1 |
| With a PMID / with a PMCID | 245 / 82 |
| No identifier: guidelines, standards, books, chapters and unindexed journals | 20 |

**What it unlocks:** 2,602 of the 3,081 recalled paper citations now point to a source with a PMID, so step 3 can fetch its abstract from Europe PMC; 467 of them also have a PMCID, for the full text. Before this step it was 1,157.

Found along the way:
- **Two wrong DOIs in `cite`, now corrected.** `coyle2001` had the journal's old prefix (`10.1249/…`); PubMed and Europe PMC use `10.1097/00003677-200104000-00009`. `sawka2012` had the early-view DOI (`…061026`, no pages); the published version is `10.1113/expphysiol.2011.061002`, 97(3):327-332, now in the `cite`.
- **`esh2023` has a correction** (J Hypertens 2024;42(1):194, `10.1097/hjh.0000000000003621`). Worth a look when the blood-pressure rows are next checked.
- **`moon1944`** (J Opt Soc Am) has a DOI but no PMID: the journal isn't in PubMed.
- **`hofstetter1950`** (Optom World 1950) stays without one; the 1947 *Am J Optom* abstract with the same title is a different publication.
- The 20 with no identifier, which no API covers: `acsm11`, `ada2026` (a whole supplement, no single DOI), `aasm3`, `cdc-flu-ve`, `gold2027`, `rinzel1989`, `who2006`, `jbds-dka2023`, `gagge1971` (ASHRAE Trans.), `weinstein1968`, `sacn2016`, `nnbc2012`, `hofstetter1950`, `iso7029`, `iso1999`, `bsa2018`, `cnawr2005`, `nice-ng233`, `who2018-noise`, `ansi-s36`.

### 3. A fetch helper: `fact-check/fetch.mjs` ✅ done 2026-11-27
A script with no dependencies, like `scan.mjs`, that the checker runs before marking a row. The Europe PMC and Crossref code is in `fact-check/epmc.mjs`, shared with `ids.mjs` (and step 4).

```
node fact-check/fetch.mjs <source id>                      # record, match with the cite, notices, links to cite, abstract
node fact-check/fetch.mjs <source id> --full               # … and the full text, if open access, with a locator per paragraph
node fact-check/fetch.mjs <source id> --find "<excerpt>"   # is it there? prints the --lookup/--url/--quote for scan.mjs
node fact-check/fetch.mjs --audit [--cites-only] [--id …]  # every paper: retractions, corrections, mismatches, access
```

A `<source id>` can also be `PMID:<n>`, `DOI:<doi>` or `PMC<n>`, to read a paper before adding it to `sources.json`.

How it works, and where it differs from the plan above:
- **Lookup order**: PMID, then DOI, then PMCID. Full text comes from `/{PMCID}/fullTextXML`, which answers only for Europe PMC's open-access subset (`isOpenAccess`). For a paper that is free to read but outside the subset, the script says so and gives the reading links; it doesn't scrape them.
- **Links to cite**: the REST record by PMID for the abstract (the form 7 ledger rows already use), and the `fullTextXML` URL for the full text. **Changed from the plan**: the plan said to cite the PMC article page for full text, but PMC now serves a reCAPTCHA page to scripts (tested on 3 articles), so neither a script nor step 4 could check a quote there. The PMC, PubMed and europepmc.org pages are printed as links "to read" in a browser.
- **Locators** name where the excerpt is: `abstract`, `abstract, Results`, `Results > Heat loss, para 3`, `Table 2, row`, `Fig 1 caption`. References, front matter and funding are left out, so a quote can't come from someone else's paper in the reference list.
- **`--find`**: the excerpt and the text are both folded first (dashes and the minus sign to a hyphen, curly quotes straight, all kinds of space to one space, soft hyphens removed, compatibility characters such as `µ` unified). An exact match prints the `--lookup "<id>:<locator>" --url … --quote …` to give `scan.mjs`. A match that differs only in case, spacing or punctuation is reported as **not verbatim**, with the source's own wording to copy instead, and exits 1 like a miss. A retracted paper, or one under an expression of concern, is refused outright.
- **Notices**: retractions, expressions of concern and errata from Europe PMC (PubMed's records), plus Crossref's `updates` filter (publisher deposits and Retraction Watch data). **Found in testing**: a publisher can deposit one retraction notice against several papers by mistake. A retracted 2023 Lancet Public Health comment names the 2020 Lancet dementia Commission (`livingston2020`) among four retracted DOIs, though PubMed records no retraction of it. So a Crossref-only retraction counts as serious only when Retraction Watch recorded it or the notice names that paper alone; otherwise it is shown as unconfirmed.
- **Cache**: `fact-check/cache/` (git-ignored), 30 days; `--refresh` fetches again.
- **Requests**: one at a time for a single paper, 3 at a time for `--audit` (each request takes a few seconds through the cloud proxy, so one at a time would take over half an hour). Retries with backoff on 429 and 5xx; a `User-Agent` naming the project and its repository; no email address.
- **Tests**: `tests/factcheck-fetch-check.mjs`, offline, against a small JATS sample: section paths, captions, table rows, references left out, the folding, exact, loose and missed excerpts, and the title matching.

**First audit**, of the 246 sources with an identifier:
- **No cited paper is retracted** or under an expression of concern.
- **18 corrections and errata** on cited papers, among them `esh2023`, `sjoding2020` (pulse oximetry and race, NEJM; 5 rows), `pivkin2016` (5 rows), `dutoit2015` (4 rows) and `russell2017`. Each needs one look, to see that the correction doesn't touch what the rows cite (step 8).
- **No record contradicts its cite.** `moon1944` isn't in Europe PMC (J Opt Soc Am isn't in PubMed).
- **148 `access` values to set**: 49 papers free to read in Europe PMC (10 of them currently marked `subscription`) and 99 not free there. Left for step 8, because a paper that isn't free in Europe PMC may still be free on the publisher's site.

### 4. Check excerpts against the fetched text in `scan.mjs` ✅ done 2026-11-27
When a `--lookup` links to a paper in Europe PMC, PubMed or PMC, `--mark` reads that paper's text from Europe PMC (`checkQuote` in `fact-check/epmc.mjs`) and refuses the mark:
- if the `--quote` isn't in the text: for an abstract link (the Europe PMC record, PubMed), in the abstract; for a full-text link (`fullTextXML`, PMC, europepmc.org), in the abstract or the open full text;
- if the quote is there only with different case, spacing or punctuation, showing the source's wording to copy instead;
- if the link is to a different paper than the source id's `pmid`, `pmcid` or `doi` (checked as well as the plan asked for: a right quote from the wrong paper is the same failure);
- if the paper is retracted, withdrawn or under an expression of concern (also beyond the plan: it was meant to be a rule for the checker, step 5, but the check is free once the record is fetched).

When the full text isn't open, the quote can't be checked: the mark goes ahead with a warning. `--no-quote-check` skips the check, and `--no-link-check` (offline) does too. Other sites keep the old rule: the link must answer.

`--check-quotes` runs the same check over the ledger's existing look-ups. **First run**: 251 look-up citations, 32 linked to a paper and checked. No invented or misplaced quotes. 2 couldn't be checked (`llewellyn2008`, `taylor2002`: closed full text). 2 failed only because the checker had added a full stop after a sentence the source carries on (`jones2017`). `locate` now ignores a trailing `.`, `,`, `;` or `:`, and both pass.

Tested on a copy of the repo: a real Beck 1992 quote marks; an invented one, a non-verbatim one, Beck's id with another paper's link, and a retracted paper are all refused, and nothing is written. `tests/factcheck-fetch-check.mjs` adds offline checks of which links count as a paper link.

### 5. Rules for the checker, in FACTUAL_CHECK.md ✅ done 2026-11-27
Added to FACTUAL_CHECK.md:
- **[Open sources to look up first](FACTUAL_CHECK.md#open-sources-to-look-up-first)**: papers are read with `fetch.mjs`, not WebFetch of `doi.org`, journal sites, PubMed or PMC; confirm the excerpt with `--find`, and cite the link it prints. An abstract supports only what it says; a number from inside a closed paper is `--memory`.
- **[Method](FACTUAL_CHECK.md#method)**, new step 6: don't rest a claim on a retracted paper; look at what `fetch.mjs` says about each cited paper, including corrections.
- **[The routine](FACTUAL_CHECK.md#the-routine)**, step 5: `--check-quotes` next to `--check-links`, and a monthly `fetch.mjs --audit --cites-only`.
- **[Looked up or from memory](FACTUAL_CHECK.md#looked-up-or-from-memory)**: for an AI checker, the fetched text of a paper is what `fetch.mjs` printed.
- **[Links](FACTUAL_CHECK.md#links)**: how the quote check at `--mark` works.
- **[Independent verification](FACTUAL_CHECK.md#independent-verification)**: for a paper link, `fetch.mjs <id> --find` counts as opening the link.

### 6. Turn recalled paper citations into look-ups — piloted 2026-11-27; ongoing
The workflow, now that steps 1–5 are in place:
1. List a paper's rows: `node fact-check/scan.mjs --via memory --cites <id> --list --all --full`.
2. Read the paper: `node fact-check/fetch.mjs <id>` (add `--full` if it's open access).
3. For each row the paper actually bears on, confirm the excerpt with `fetch.mjs <id> --find "<excerpt>"`. Then re-mark the row with the `--lookup … --url … --quote …` it prints, plus `--memory` for whatever the excerpt doesn't cover. `--mark` re-checks the quote itself.
4. Where a row also cites a recalled textbook, keep it as `--memory` unless the paper alone fully supports the row. The row stays `memory` until the [open policy question](fact-check/improving-lookups.md#open-policy-question) is settled.

**Pilot on `daan1984`** (the two-process sleep model; 82 recalled citations, the most-cited fetchable paper):
- **All 82 rows are on the brain page's sleep section, and 81 cite the same three sources** (`daan1984`, `aasm3`, `carskadon2017`): a whole-section citation set, applied with `--prefix`. Most of those rows are about sleep stages, spindles, REM or adenosine, which this paper doesn't address.
- **The abstract bears on 2 rows.** `sections.sleep.procNote.college` (the S thresholds) is now re-marked by look-up: the excerpt matched and `--mark`'s quote check passed. Its second sentence (the evening wake maintenance zone) isn't in the abstract, so it stays `--memory` (`carskadon2017`), and the row stays `via: memory`. `stages.n3.phd` (slow-wave activity as the marker of Process S) is only loosely backed: the abstract says S's time constants were derived from EEG power density.
- **The same pattern on the other most-cited papers.** On the muscles page, 97 rows cite `drachman1994` (a myasthenia gravis review), `coyle1986` (glycogen), `schwellnus2009` (cramps) and `guyton14` together. Only 22 of `drachman1994`'s 132 rows mention its topic, and 10 of `bergman1979`'s 81 (the minimal model, on the pancreas page).

**What this changes:**
- **Yield.** The coverage estimate below counts citations, and most are blanket citations. A paper supports perhaps one row in five or ten of those that cite it, and fewer still on its own. Expect tens of look-ups per paper session, not hundreds. The open-textbook route in `improving-lookups.md` (OpenStax, Klabunde) remains the bigger lever.
- **The blanket citations are a problem in themselves.** A row that cites a myasthenia review for muscle glycogen misstates where its claim came from, and a verifier or reader following it finds nothing.

**Narrowing the blanket citations ✅ done 2026-11-27, for the six papers above.** There's a new command, `scan.mjs --uncite <id> --by <who> --note "<why>"` with `--key`, `--keys-from` or `--prefix`. It takes a recalled source off the rows it doesn't bear on:
- **It isn't a re-check:** status, `checked` and `by` stay. The row's note says who removed what and why, and every removal goes into `fact-check/narrowed.jsonl`.
- **It's refused where it would lose evidence:** it never removes a looked-up citation and never leaves a row citing nothing (both tested).
- **The rule behind it is now in FACTUAL_CHECK.md:** cite what supports the row, not the section's reading list.

Each row was read and judged against the paper's abstract. A citation came off only where the row clearly makes no claim the paper speaks to; where in doubt, it stayed.

| Paper | Page | Rows citing it | Kept | Removed | Kept on |
|---|---|---|---|---|---|
| `daan1984` (two-process model) | brain | 81 | 16 | 65 | sleep pressure and the body clock, Process S in N3, the all-nighter, the model's code (`procS`, `procC`, `WAKE_AT`/`TW`/`TS`, `drawTwo`) |
| `drachman1994` (myasthenia gravis) | muscles | 132 | 48 | 84 | the myasthenia questions and scenarios, junction safety factor, neostigmine |
| `coyle1986` (carbohydrate and muscle glycogen) | muscles | 115 | 34 | 81 | the marathon question, glycogen and "the wall", the fuelled and unfuelled marathon scenarios |
| `schwellnus2009` (cramps) | muscles | 99 | 10 | 89 | the cramp rows |
| `bergman1979` (minimal model) | pancreas | 79 | 16 | 63 | the minimal model, insulin sensitivity and the insulin-resistance scenarios |
| `cabrera2006` (human islet layout) | pancreas | 65 | 10 | 55 | islet cell proportions and their arrangement along the capillaries |

437 citations removed. Every narrowed row still cites the textbook (`guyton14`, `boron3`) or the guideline and chapter (`aasm3`, `carskadon2017`) that it was checked against. Next, the same for the other blanket sets that `--sources` and step 6 turn up: `charkoudian2003` (132 rows, skin), `diffey2002` (81) and `gagge1971` (62) are the next by size.

**Found while narrowing: a claim the paper contradicts.** `muscles` `organ-content:alter.scenarios.8.college` says "Loading (~+60% glycogen) and 60 g/h exogenous carbohydrate spare glycogen and liver glycogen", citing `coyle1986`. Its abstract says: "The pattern of muscle glycogen utilization, however, was not different during the first 3 h of exercise with the placebo or the carbohydrate feedings." Carbohydrate maintained blood glucose and carbohydrate oxidation instead. Some running studies do report sparing in type I fibres, but that is recalled, not looked up. So "spare glycogen" should become "maintain blood glucose and carbohydrate oxidation, and spare liver glycogen", or the claim needs a source that supports it. The text is unchanged; this is for whoever checks the muscles page next (or file it as an issue).

### 7. A stricter verification prompt, and a `partial` result ✅ done 2026-11-27
- `--verify-sample` prints the prompt below before the sample, and for a paper link, the `fetch.mjs <id> --find` command that counts as opening it:

  > List the factual claims in the row. For each one, answer SUPPORTED, CONTRADICTED or NOT IN PASSAGE, quoting the sentence that decides it. Flag any mismatch of drug, dose, number, unit, population, direction of effect or structure name.

- Any CONTRADICTED → `not-supported`. All SUPPORTED → `confirmed`. A mix of SUPPORTED and NOT IN PASSAGE → the new **`partial`** result. It needs a `--note` naming what the passage doesn't cover. The citation counts as verified (it gets `verified`, `verifiedBy` and `partial`), the note is added to the row, and `--recheck-stats` counts it separately, not as a failure.
- The judge still runs in a fresh session, as verification does now.
- FACTUAL_CHECK.md's [Independent verification](FACTUAL_CHECK.md#independent-verification) has the prompt and the new row in the results table. Tested on a copy of the repo: refused without a note, recorded with one, and counted apart in the stats.

### 8. An audit of the paper sources ✅ done 2026-11-27 (monthly from now on)
- **Retractions and expressions of concern**: none on a cited paper (see step 3; the `livingston2020` notice is a publisher's metadata error).
- **Metadata mismatches**: none.
- **`access`**: `fetch.mjs --audit --write-access` set it for 148 papers from Europe PMC: `open` for the 49 free to read there (10 of them had been marked `subscription`), and `subscription` for the 99 that aren't. A script can't see past the publishers' robot checks: `journals.physiology.org` serves a Cloudflare challenge. So FACTUAL_CHECK.md now says `subscription`, for a paper, means "not free in Europe PMC"; change it to `open` when a paper turns out to be free on the journal's site. The 5 sources with no identifier were set by hand: `cdc-flu-ve` and `who2018-noise` `open` (free web pages), `acsm11` and `ansi-s36` `subscription` (sold online), `janeway10` `print` (the 10th edition has no linkable online text, unlike the open 5th on Bookshelf). Every source now has an `access`.
- **Corrections to read by hand.** 15 cited papers have a published correction. None of the erratum texts is in Europe PMC, and the publishers' pages can't be fetched from here (WebFetch failed on `doi.org` as well), so these need a person with a browser. Each needs a check that the correction doesn't touch what its rows cite:

| Paper | Correction | Rows that cite it |
|---|---|---|
| `esh2023` | J Hypertens 2024;42(1):194 | body: `systems.circulatory.phases.sleep.phd`, `topics.heart.phases.sleep.college` |
| `sjoding2020` | N Engl J Med 2021;385(26):2496 | lungs: `lens.integumentary.phd`; skin: `lens.respiratory.{ms,hs,college,phd}` |
| `pivkin2016` | PNAS 2017;114(22):E4521 | body: `systems.immune.pins.4.phd`, `topics.spleen.phases.rest.{ms,hs,college,phd}` |
| `dutoit2015` | N Engl J Med 2016;375(4):398 | skin: `lens.digestive.{ms,hs,college,phd}` |
| `slominski2000` | Endocr Rev 2002;23(3):364 | skin: `lens.endocrine.{ms,college,phd}` |
| `williams2016` | Cell 2025 (S0092-8674(25)00631-2) | body: `impulse.stops.gutAfferent.phd`, `systems.nervous.phases.meal.phd` |
| `herold2019` | N Engl J Med 2020;382(6):586 | pancreas: `lens.immune.phd` |
| `mcdonald2021` | Cell 2021;184(7):1940 | bones: `parts.osteoclast.phd` |
| `cummings2009` | N Engl J Med 2009;361(19):1914 | bones: `sections.remodelling.intro.phd` |
| `janssen2000` | J Appl Physiol 2014;116(10):1342 | muscles: `lens.reproductive.college` |
| `livingston2020` | Lancet 2023;402(10408):1132 | ears: `lens.nervous.phd` |
| `agrawal2009` | Arch Intern Med 2009;169(15):1419 | ears: `lens.musculoskeletal.phd` |
| `hofer2005` | J Neurosci 2006;26(2):722 | eyes: `parts.cone.phd` |
| `muller2003` | Exp Eye Res 2003;77(2):253 | eyes: `parts.cornea.phd` |
| `russell2017` | Lancet 2017;390(10097):848 | eyes: `parts.rpe.phd` |

### 9. Network
These steps need no new hosts: `www.ebi.ac.uk`, `api.crossref.org` and `pmc.ncbi.nlm.nih.gov` are already allowed in the `humanphysiology` environment. Add hosts only when a step needs them:
- `eutils.ncbi.nlm.nih.gov`, if Europe PMC proves unreliable;
- `api.openalex.org`, to find open copies of papers that Europe PMC lists as closed;
- `clinicaltrials.gov`, if trial protocols become a source.

## What this won't fix

- **Textbooks.** About 18,500 recalled citations are to Guyton, Boron, Kandel and West. No API helps. Follow `improving-lookups.md`: open textbooks first (OpenStax, Klabunde), and spend human time with institutional access on the values that matter most.
- **NCBI Bookshelf.** Endotext, Purves, Janeway 5 and the Colloquium Series are open, but the Bookshelf serves scripts a reCAPTCHA page (tested on `NBK279388`), and Europe PMC indexes almost none of it (5 records). These stay as WebFetch-by-hand, or `--memory` when the check page wins. Test the NCBI literature-archive open-access download (`ftp.ncbi.nlm.nih.gov/pub/litarch/`) before giving up on them.
- **Paywalled papers beyond the abstract.** A dose or sub-group buried in the Results of a closed paper stays `--memory`, unless someone with access looks it up.

## Next priorities (2026-11-27)

After steps 1–8, ranked by how much each raises the share of rows checked against an opened source, for what it costs. At this point 131 rows were `lookup`, out of about 17,000.

1. **Paste the new nightly instructions** (five minutes; the owner). The nightly fact-check's instructions still say to WebFetch papers, so it meets robot checks and doesn't use these tools. The replacement text was handed over on 2026-11-27; it can only be changed at claude.ai.
2. **Settle the "partly looked up" question** ✅ done 2026-11-27. One recalled textbook kept a row at `memory` even when its main source had been opened and quoted. There's now a third label, `via: partial` (some sources looked up, the rest recalled):
   - `scan.mjs` derives `via` from the citations everywhere (`--mark`, `--uncite`, `--verify`), and `--update` brings older rows into line. 121 rows moved from `memory` to `partial`.
   - It's counted in the summary table, `--via partial` and `status.js`.
   - `fact-check.html` shows it as "Partly looked up": a split swatch, split waffle squares, striped bar segments and its own tile. The ramp's blues are used together rather than adding a fifth shade, which failed the palette check: ΔE 8.6 to "from memory", below the floor of 15.
   - `lookup` keeps its strict meaning. FACTUAL_CHECK.md and `improving-lookups.md` record the decision.
3. **Re-cite the open textbooks** (the biggest lever, and cheap). On 2026-11-19 Klabunde had about 1,070 recalled citations against 3 look-ups, and OpenStax about 556 against 38. Both are free and reachable from the cloud environment, and one fetched page usually covers a part's four reading levels and its glossary entry. Extend the quote check at `--mark` to these pages, so the same refusal of invented or misplaced quotes covers them, and then re-cite section by section.
4. **Find and narrow every blanket citation set** (a few hours). A report of sources applied together across whole sections, instead of finding them one at a time. Next by size: `charkoudian2003` (132 rows), `diffey2002` (81), `gagge1971` (62).
5. **A nightly quota of paper look-ups**: "at least 10 look-ups via `fetch.mjs`, most-cited papers first", in the nightly instructions. After narrowing, the papers' rows are the ones they support, so the quota yields real look-ups (tens per paper, not hundreds).
6. **One session with institutional access** (ClinicalKey or AccessMedicine) for the rows that carry the most weight: the roughly 22 consistency-registry values, the clinical thresholds and the 271 approved model-code rows. Guyton and Boron make up about 14,400 recalled citations that no API reaches.
7. **Re-check the 923 approved rows that cite nothing** (897 ok, 26 fixed; approved before sources were tracked). Sample them first to see how good they are.
8. **Test NCBI's open-access literature archive** (`ftp.ncbi.nlm.nih.gov/pub/litarch/`) for Endotext, Purves, Janeway 5 and the Colloquium Series, whose Bookshelf pages show scripts a reCAPTCHA. If the books download, a reader like `fetch.mjs` unlocks several hundred recalled citations.
9. **Clear the leftovers**: the `coyle1986` "spare glycogen" claim (step 6), the 15 corrections to read by hand (step 8), and optionally `europepmc.org` on the environment's allowlist so its reading links pass the link check.

## Order of work

| # | Step | Effort | What it unlocks |
|---|---|---|---|
| 1 ✅ | Node proxy fix, and blocked hosts told apart from dead links | done | Link checks that don't lie in this container |
| 2 ✅ | `doi` / `pmid` in `sources.json` | done | Everything below; 1,917 more citations fetchable |
| 3 ✅ | `fetch.mjs` with cache, retries, `--find` and `--audit` | done | Paper look-ups in one command |
| 5 ✅ | The rule in FACTUAL_CHECK.md | done | The nightly checker uses it |
| 8 ✅ | `--audit` (retractions, metadata, `access`) | done; 15 corrections to read by hand | Catches wrong and retracted citations |
| 4 ✅ | Excerpt check in `scan.mjs --mark`, and `--check-quotes` | done | Invented quotes refused when written |
| 6 | Re-cite recalled papers, most-cited first | piloted; 437 blanket citations narrowed; ongoing | The look-up count rises, slowly, and citations mean what they say |
| 7 ✅ | Stricter verification prompt, and a `partial` result | done | Fewer excerpts approved for rows they don't support |

Each step should land with a test in `tests/` where it touches `scan.mjs`, like the existing checks.

## Coverage of the recalled papers

Test run on 2026-11-27: every recalled paper, review and guideline in the ledger, looked up in Europe PMC by the DOI in its `cite`.

| | Sources | Recalled citations |
|---|---|---|
| Recalled papers, reviews and guidelines | 241 | 3,081 |
| … with a DOI in `cite` | 175 | 1,164 |
| … found in Europe PMC | 173 | 1,157 |
| … with an abstract there | 157 | 994 |
| … with full text free to read in Europe PMC | 63 | 371 |
| … flagged as retracted | 0 | 0 |

- **Not found** (check the DOIs): `sawka2012` (`10.1113/expphysiol.2011.061026`) and `coyle2001` (`10.1249/00003677-200104000-00009`). Either could be a wrong DOI in `sources.json`, which is what the audit (step 8) is for.
- **No abstract** (16): mostly old papers (`saltin1968`, `nadel1971`, `rowell1974`, `albert1967`, `dimagno1973`), plus reports and commissions (`kdigo2024`, `livingston2020`, `livingston2024`) and `krammer2018`. These need the full text or stay `--memory`.
- **Free to read is not always machine-readable.** Only 15 of the 63 are in the open-access subset that `fullTextXML` serves; for the rest, the PMC page has the text, and WebFetch may meet a robot check.
- **Yield.** Up to about 1,000 recalled citations can be checked against an abstract today, and about 1,900 more once step 2 finds identifiers. How many become look-ups depends on how many rows the abstract alone supports. Physiology rows often cite a paper for a single number, so expect well under half. **The step 6 pilot puts it much lower**: most of these citations are whole-section citation sets, and a paper bears on roughly one in five to ten of the rows that cite it.
