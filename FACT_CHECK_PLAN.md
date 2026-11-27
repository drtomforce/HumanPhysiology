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

### 1. Fix the Node proxy problem (small, first)
In this container, Node 22's built-in `fetch` ignores `HTTPS_PROXY`, so every request fails with `ENOTFOUND`. `scan.mjs` would then refuse a good link as dead, or record it as `broken` in `links.json`. Running with `NODE_USE_ENV_PROXY=1` fixes it (tested). Either:
- document `NODE_USE_ENV_PROXY=1 node fact-check/scan.mjs …` in FACTUAL_CHECK.md, or
- have `probe()` in `scan.mjs` print a hint when `HTTPS_PROXY` is set and the error is `ENOTFOUND` (better: the failure is silent today).

Expect each request to take a few seconds through the proxy.

### 2. Add identifiers to `sources.json`
Give each paper, review and guideline the optional `doi`, `pmid` and `pmcid` fields, filled from its `cite` string and Europe PMC.
- 175 of the 241 recalled paper sources have a DOI in their `cite`; parse it out once.
- The 66 without one carry **more** recalled citations (1,917) than those with one (1,164), including the most-cited papers: `charkoudian2003` and `drachman1994` (132 each), `coyle1986` (115), `schwellnus2009` (99), `diffey2002` (81). Find each identifier with Crossref's `query.bibliographic` search or a Europe PMC title search, and **confirm each match by hand**. A wrong match is worse than none. This is the highest-value part of the step.
- Guidelines and standards without a DOI (`aasm3`, `acsm11`, `gold2027`, `iso7029`, `ansi-s36`) stay as they are: no API covers them.
- Guidelines and books often have no PMID; leave the field out. Their `access` and `home` matter more.

### 3. A fetch helper: `fact-check/fetch.mjs`
A small script with no dependencies, like `scan.mjs`, that the checker runs before marking a row:

```
node fact-check/fetch.mjs <source id>                 # metadata, abstract, open-access status, retraction flag
node fact-check/fetch.mjs <source id> --full          # also the full text, if open access
node fact-check/fetch.mjs <source id> --find "<excerpt>"   # is this excerpt verbatim in the fetched text?
node fact-check/fetch.mjs --audit [--cites-only]      # every paper in sources.json: metadata and retractions
```

- **Order of lookup**: Europe PMC by PMID, then by DOI (`/search?query=DOI:"…"&resultType=core`). Full text from `/{PMCID}/fullTextXML` when `isOpenAccess` is `Y`.
- **The link to record**: the Europe PMC REST URL by PMID, the form the ledger already uses (`…/rest/search?query=EXT_ID:<pmid>%20AND%20SRC:MED&resultType=core&format=json`). For full text, the `pmc.ncbi.nlm.nih.gov/articles/PMC…/` page with a section anchor, so a person can follow it. The script prints both.
- **Cache** the responses in `fact-check/cache/` (git-ignored), so a verifier re-reads the same text without fetching it again. Don't commit abstracts or full texts: the ledger keeps only the short excerpt, as now.
- **Be polite**: one request at a time, retries with backoff on 429, 500 and 503, and a `User-Agent` naming the project and its repository URL. Never send a personal email address (Crossref's "polite pool" asks for one; use a project address or leave it out).
- **Strip markup** before `--find`: abstracts carry `<h4>`, `<i>` and `<sup>` tags, and full text is JAT XML. Normalise whitespace and Unicode (dashes, µ, ±) on both sides.

### 4. Check excerpts against the fetched text in `scan.mjs`
When a `--lookup` link is a Europe PMC REST URL or a PMC article, `--mark` looks for the `--quote` in the cached text (via `fetch.mjs --find`) and refuses the mark if the excerpt isn't there. That catches an invented quote at the moment it's written, not weeks later in a verification sample. Other sites keep today's rule (the link must answer).

### 5. Rules for the checker, in FACTUAL_CHECK.md
Add to [Open sources to look up first](FACTUAL_CHECK.md#open-sources-to-look-up-first):

> **Papers: use the APIs, not the publisher's page.** For a source with a DOI or PMID, run `node fact-check/fetch.mjs <id>` and read the abstract (or the full text, if open access) it prints. Don't WebFetch `doi.org`, journal sites or `pubmed.ncbi.nlm.nih.gov` to check a paper: they serve robot checks and cookie walls to scripts. Cite the Europe PMC link the script prints, and quote from the text it fetched. If the claim isn't in the abstract and the paper isn't open access, cite the paper with `--memory`.

And to the Method: before approving a row that cites a paper, check that `fetch.mjs` doesn't flag it as retracted.

### 6. Turn recalled paper citations into look-ups
Use the same approach as step 1 of `improving-lookups.md`, but for papers.
- List them: `node fact-check/scan.mjs --via memory --cites <id> --list --all`, for paper sources in order of how many rows cite them. Among those already fetchable, the top are `daan1984` (82 citations), `bergman1979` (81) and `cabrera2006` (66). After step 2, `charkoudian2003`, `drachman1994`, `coyle1986` and `schwellnus2009` join them, with about 100 each.
- Fetch each paper once, then re-mark only the rows its abstract or full text actually supports, each with its own excerpt.
- Where a row also cites a recalled textbook, keep it as `--memory` unless the paper alone fully supports the row. The row stays `memory` until the [open policy question](fact-check/improving-lookups.md#open-policy-question) is settled.

**Expected yield**: see [Coverage](#coverage-of-the-recalled-papers) below. Realistically, only part of each paper's rows will be supported by its abstract alone.

### 7. A judge pass for excerpts (with verification)
The independent verifier already asks "does this excerpt support the claim?". Make the question stricter and the same every time, with this prompt, given only the claim (the row's text) and the fetched passage:

> List the factual claims in the row. For each one, answer SUPPORTED, CONTRADICTED or NOT IN PASSAGE, quoting the sentence that decides it. Flag any mismatch of drug, dose, number, unit, population, direction of effect or structure name.

- Any CONTRADICTED claim → `not-supported`, as now.
- All SUPPORTED → `confirmed`.
- A mix of SUPPORTED and NOT IN PASSAGE → `confirmed`, with a note naming the unsupported part. Most verifications already end with "backs only part of its row". If this is common, consider a `partial` result in `scan.mjs`, so partial support can be counted, not only described.
- The judge must run in a fresh session, as verification does now. A checker grading its own excerpt isn't independent.

### 8. A one-off audit of the paper sources
Run `node fact-check/fetch.mjs --audit` once, then monthly next to `--check-links`:
- **Retractions and expressions of concern**: none should be cited as support. If one is, re-check its rows.
- **Metadata mismatches**: the `cite` string's title, first author, year and journal compared with Crossref. A mismatch means a wrong DOI or a mixed-up citation, and every row citing that id needs a look.
- **Fill `access`**: 143 sources have no `access` recorded. Europe PMC settles it for papers: `open` if its full text is free to read there (`inEPMC`), otherwise `subscription`. In the test, 7 of these were open and 111 closed.

### 9. Network
These steps need no new hosts: `www.ebi.ac.uk`, `api.crossref.org` and `pmc.ncbi.nlm.nih.gov` are already allowed in the `humanphysiology` environment. Add hosts only when a step needs them:
- `eutils.ncbi.nlm.nih.gov`, if Europe PMC proves unreliable;
- `api.openalex.org`, to find open copies of papers that Europe PMC lists as closed;
- `clinicaltrials.gov`, if trial protocols become a source.

## What this won't fix

- **Textbooks.** About 18,500 recalled citations are to Guyton, Boron, Kandel and West. No API helps. Follow `improving-lookups.md`: open textbooks first (OpenStax, Klabunde), and spend human time with institutional access on the values that matter most.
- **NCBI Bookshelf.** Endotext, Purves, Janeway 5 and the Colloquium Series are open, but the Bookshelf serves scripts a reCAPTCHA page (tested on `NBK279388`), and Europe PMC indexes almost none of it (5 records). These stay as WebFetch-by-hand, or `--memory` when the check page wins. Test the NCBI literature-archive open-access download (`ftp.ncbi.nlm.nih.gov/pub/litarch/`) before giving up on them.
- **Paywalled papers beyond the abstract.** A dose or sub-group buried in the Results of a closed paper stays `--memory`, unless someone with access looks it up.

## Order of work

| # | Step | Effort | What it unlocks |
|---|---|---|---|
| 1 | Node proxy fix or hint | minutes | Link checks that don't lie in this container |
| 2 | `doi` / `pmid` in `sources.json` | an hour, plus hand checks for 66 | Everything below; 1,917 more citations fetchable |
| 3 | `fetch.mjs` with cache, retries and `--find` | half a day | Paper look-ups in one command |
| 5 | The rule in FACTUAL_CHECK.md | minutes | The nightly checker uses it |
| 8 | `--audit` (retractions, metadata, `access`) | an hour | Catches wrong and retracted citations |
| 4 | Excerpt check in `scan.mjs --mark` | an hour | Invented quotes refused when written |
| 6 | Re-cite recalled papers, most-cited first | ongoing, nightly quota | The look-up count rises |
| 7 | Stricter verification prompt, maybe a `partial` result | an hour | Fewer excerpts approved for rows they don't support |

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
- **Yield.** Up to about 1,000 recalled citations can be checked against an abstract today, and about 1,900 more once step 2 finds identifiers. How many become look-ups depends on how many rows the abstract alone supports. Physiology rows often cite a paper for a single number, so expect well under half. Even so, that is several times the 131 rows looked up so far.
