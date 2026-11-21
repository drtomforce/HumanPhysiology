# Factual check

A plan for checking that every physiological claim in the app is correct, and for keeping it correct as the nightly build adds organs, body systems and journeys.

The README promises values that are "typical for a healthy adult and simplified for teaching". This check holds the app to that promise: simplifying is fine, being wrong is not.

## Why this has to be ongoing

The app has about 133,000 words of text, each written at four reading levels (`ms`, `hs`, `college`, `phd`), plus the numbers that drive the animations. Almost none of it cites a source. The only exception so far is the pleth caveat on the heart page, which ends with a `"phd"` "Key sources" line.

New content arrives every night. The nightly Claude build works through `IMPROVEMENTS.md` (its issues carry the `question` label) and adds pages, systems, journeys and glossary terms. A one-off audit would be out of date within days. So the check works in two parts:
1. **Backlog**: check what exists today once, highest exposure first.
2. **Delta**: after each nightly merge, check only what is new or changed since the last check.

A third part keeps the first two honest:
3. **Re-check**: each run also re-checks a small random sample of items that were already approved (see [Random re-checks](#random-re-checks)).

A ledger records what has been checked, and against which source (see [Keeping up with nightly builds](#keeping-up-with-nightly-builds)).

## The standard

| Severity | Meaning | Example |
|---|---|---|
| **Error** | The claim is wrong or outdated. | A wrong normal range, a reversed mechanism, a mislabelled structure. |
| **Misleading** | Each word is true, but the simplification leaves a false picture. | "The heart pumps blood to the lungs" with no mention of the second circuit. |
| **Imprecise** | Right in spirit, but it needs a qualifier, a range or a unit. | "Heart rate is 70" rather than "about 60–100 at rest". |
| **Style** | Not a factual problem: wording, a level mismatch in tone. | Note it, but don't hold up a page for it. |

**Acceptable simplification**: a lower level may leave out detail, but it may not say something the level above contradicts. `ms` → `hs` → `college` → `phd` should read as the same story told with more detail.

**Reading levels must agree** with each other, with the numbers the model uses, and with the other pages.

## What gets checked

The scope is defined by pattern, not by a list of today's pages, so new pages and systems are covered automatically.

0. **The shared organ engine**: the `ORGAN ENGINE JS` block of `organs/_template.html` is scanned once as page `engine` (phase vitals, schedule, the beat and breath loop), because the organ pages' copies are skipped.
1. **Text**: every string and number in every `<script type="application/json">` block in `index.html` and `organs/*.html`, except `organs/_template.html`:
   - `#body-content`, `#body-glossary` and `#body-hours` in `index.html`;
   - `#organ-meta`, `#organ-content` and `#organ-glossary` on each organ page.
2. **Model numbers in `index.html`** (tracked as code items, see [The ledger](#the-ledger)):
   - the `PHYSIO` keyframes (vitals across the day);
   - `VOIDS`, `SLEEP_CYCLES`;
   - the journey arrays `IMPULSES` (fibre types, conduction speeds, synaptic delays), `CASCADES` (hormone timings), `MOLECULES` and `BREATHS` (partial pressures), `BITES` and `URINES`, and every journey array a new system adds;
   - the values `Physio.at()` derives: cardiac output, Fick venous O₂ and the organ flow split;
   - the numbers inside the animation modules (`Rhythm`, `Scene`, `Nerves`, `Digestion`, `Urinary` and the rides).
3. **Organ-page models**: the parameters of each "how it works" simulation (the page's constants and functions), the `alter.scenarios` values (JSON), and the healthy references passed to `OrganPage.delta()`.
4. **Text drawn outside the JSON**: hero stats, fact pins, figure labels and the part-inspector text.
5. **`README.md`**: each new page adds a paragraph of claims.

## Keeping up with nightly builds

### The ledger
A committed file, `fact-check/ledger.json`, holds one row per checkable item, grouped by page (`body` for `index.html`, otherwise the organ page's id), one row per line (the example wraps one row to fit):

```json
"heart": {
 "organ-content:anatomy.parts.sa.phd": {"hash":"a3f9…","status":"ok","checked":"2026-11-17","by":"tf","via":"lookup",
   "src":[{"id":"guyton14","at":"ch. 10, p. 123","url":"https://…/chapter-10","quote":"The sinus node is a small, flattened, ellipsoid strip","by":"tf","verified":"2027-01-09","verifiedBy":"claude-verify-2027-01-09"}]},
 "organ-content:pleth.phd": {"hash":"…","status":"ok","checked":"2026-11-17","rechecked":"2027-02-03","by":"claude-nightly-2026-11-17","via":"memory","mem":["rowell1993"]},
 "const:STEN_LOSS.lm": {"hash":"…","status":"issue #41","checked":"2026-11-18","by":"tf","via":"lookup","src":[{"id":"gould1974","at":"fig. 3","url":"https://doi.org/…","quote":"…","by":"tf"}],"note":"10% too high for left main"}
}
```

- **Text keys** use the same format the in-app reporter uses (`<block id>:<json path>`), so a reader report, a fact-check issue and a ledger row all point to the same place.
- **Code keys**:
  - `const:<NAME>` for a top-level `UPPERCASE` constant, split into `const:<NAME>.<id>` for arrays of `{ id: … }` entries and `const:<NAME>.<prop>` for objects (for example `const:PHYSIO.heartRate`, `const:IMPULSES.kneeJerk`);
  - `mod:<Name>` for a PascalCase module such as `mod:Physio`, as one item;
  - `const:<NAME>` also for a numeric `UPPERCASE` constant (`const HB = 150, N_HILL = 2.7;`), one item per statement, keyed by its first name;
  - `fn:<name>` for a top-level function, declared or as an arrow function in a lowercase `const` (`const makeLung = () => { … }`), which catches the organ models and the numbers inside drawing code. Code between two declarations that is not itself one (an `App.registerTopic({ … })` call, say) goes with the declaration before it.
  When a code item changes, look at its `git diff` to see whether a physiological number or rule changed.
- **Ignore list**: `ledger.ignore[<page>]` names the constants, modules and functions that are only drawing, layout or UI. The scan leaves them out. Add a name there when a new page brings one.
- **Status** is one of `unchecked`, `ok`, `fixed`, `n/a` (no factual claim: a button label, an id) or `issue #<n>`.
- **Sources** record what the check was made against, and **how**: see [Looked up or from memory](#looked-up-or-from-memory).
  - `src`: sources that were **opened and read** during this check. Each is an object: `id` (from `sources.json`), `at` (the locator, for example `ch. 9, table 9-1`), `url` (a [working link](#links) to the passage), `quote` (a short verbatim excerpt from it), `by` (who looked it up), and, once [independently verified](#independent-verification), `verified` and `verifiedBy`.
  - `mem`: sources the checker **recalled from memory** without opening them, as `<source id>` with an optional locator.
  - `via`: `lookup` when every cited source was looked up, `memory` when any was recalled. A row with no `via` was approved before this was recorded, and counts as `unknown`.

  Every id must be in [`fact-check/sources.json`](#sources). Look-ups recorded before links were required, as plain `"<id>:<locator>"` strings, are listed by `--sources` to be re-cited. `ok`, `fixed` and `issue #<n>` rows must cite at least one source; `n/a` and `unchecked` rows cite none.
- **`by`** is who set the current status: a person's handle, or an agent run such as `claude-nightly-2026-11-18`. It is what makes [verification](#independent-verification) independent.
- **`checked`** is the date the current status was set. **`rechecked`** is the date of the last [random re-check](#random-re-checks) that confirmed it.
- **The hash** is of the text or code. When it changes, the row goes back to `unchecked`, remembering its old status in `was` and keeping its `note`, `src` and `mem` (but not `via`) as a lead for the next check. New keys arrive as `unchecked`. Keys that no longer exist are dropped.

### The scan
A small Node script, `fact-check/scan.mjs`, keeps the ledger up to date. Like `tests/*.mjs`, it needs no build and no dependencies.
- `node fact-check/scan.mjs` prints a table per page: items, counts by status, and how many are new, changed or removed since the ledger.
- `--update` writes new and changed items into the ledger as `unchecked` and drops removed ones.
- `--status` writes `fact-check/status.js`, the per-section counts (no keys or text) that the reader-facing overview `fact-check.html` draws. `--update`, `--mark` and `--verify` rewrite it too, and `--check` fails while it is out of date. Sections are found by pattern (`<block>:<first path segment>`, with each page's glossary, code and organ header as one section each), so a new page or system shows up without editing the overview; give a new section a readable name in `SECTION_LABELS` in `scan.mjs`.
- `--list` prints the unchecked items with their text; add `--all` for every item, or `--full` for untruncated text.
- `--mark <status>` sets the status of the selected items, with an optional `--note "…"`. `--mark ok`, `fixed` and `"issue #<n>"` need `--by <who>` (or the `FACT_CHECK_BY` environment variable) and at least one source:
  - `--lookup <id>:<locator> --url <link> --quote "<excerpt>"` for a source opened and read. Each `--lookup` needs its own `--url` and `--quote`, given in the same order. The script fetches every link first and refuses the whole mark if one is dead (see [Links](#links)).
  - `--memory <id>[:<locator>]` for a source recalled.

  Both are repeatable, and `via` is set from them. It only touches items whose hash is current. Add `--unchecked` to leave rows that already have a status (`ok`, `fixed`, an issue) alone; without it, a broad `--prefix` overwrites them.
- `--check` exits non-zero if any selected item is unchecked or the ledger is out of date, for use as a gate.
- `--sample <n>` prints `n` approved items picked at random for a re-check, with their text, sources and note (see [Random re-checks](#random-re-checks)). `--seed <s>` (default: today's date) makes the pick repeatable; `--min-age <days>` (default 60) skips items checked or re-checked more recently.
- `--recheck`, with `--mark` and `--key`, records the result of a re-check: it sets `rechecked`, keeps the original `checked` date when the item passes, and appends the outcome to `fact-check/rechecks.jsonl`.
- `--verify-sample <n> --by <verifier>` prints `n` look-up citations picked at random for [independent verification](#independent-verification), leaving out any the verifier made. `--verify <result> --page <page> --key <key> --cite <id> --by <verifier>` records the result.
- `--check-links` fetches every look-up link in the selection that hasn't been checked in the last 30 days (`--max-age <days>`) and lists dead ones with the rows that use them. It exits non-zero if any are dead. Results are kept in `fact-check/links.json`.
- `--recheck-stats` prints re-check failure rates by page, approval batch and method, and verification failure rates by checker, page and result.
- `--sources` lists each source with the number of rows that looked it up and that recalled it, its `access`, guidelines due for review, sources with no `access` recorded, unknown ids, and approved or filed rows that cite nothing (`--full` lists them). The summary table counts approved rows per page by `lookup`, `memory` and `via?` (unknown).
- Select with `--page <id>`, `--prefix <key prefix>` and `--key <exact key>`, each repeatable, then narrow with `--batch <date>` (rows whose `checked` date is that day), `--cites <source id>` or `--via <lookup|memory|unknown>`. For example:
  `node fact-check/scan.mjs --page body --prefix body-content:topics.heart. --mark ok --by tf --lookup "guyton14:ch. 9" --url <link> --quote "…"`.

### The routine
1. After each nightly merge, run `node fact-check/scan.mjs --update`, and commit the ledger with the checks that follow.
2. Check the unchecked items, using the [method](#method) below. Work through new pages and systems first, then the edited strings.
3. Fix or file each finding (see [Recording findings](#recording-findings)), and set each row's status, date and sources.
4. Re-check 10 approved items: `node fact-check/scan.mjs --sample 10 --seed <today>` (see [Random re-checks](#random-re-checks)).
5. Run `node fact-check/scan.mjs --sources` and `--check-links`, and deal with anything they flag.
6. Separately, and not by whoever did steps 2–4: verify 10 look-up citations (see [Independent verification](#independent-verification)).
7. Update the [status table](#status).

### The gate for new pages
Add a line to "What a finished deep-dive page includes" in `IMPROVEMENTS.md`:

> 11. **Facts checked**: the page's numbers agree with the [consistency registry](FACTUAL_CHECK.md#consistency-registry), the PhD / MD text names its key sources, its approved rows cite sources from `fact-check/sources.json` with an honest `--lookup` (with a working link and a verbatim excerpt) or `--memory`, and `node fact-check/scan.mjs --page <id>` reports nothing unchecked, or the page is listed as unchecked in `FACTUAL_CHECK.md`.

This lets the nightly build check its own work, or at least leave the new page clearly marked as not yet checked.

## Method

For each item:
1. **Check the PhD / MD level first**, against a standard source:
   - textbooks: Guyton & Hall, Boron & Boulpaep, Ganong, West's *Respiratory Physiology*, Kandel's *Principles of Neural Science*;
   - current guidelines where clinical thresholds appear: ESC/AHA, GOLD, KDIGO, ADA;
   - review papers for anything newer than the textbooks.
2. **Check each lower level** against the level above it: same story, less detail, no contradiction.
3. **Check numbers**: the value and the range, the units, and the order of magnitude. Compare the text with the model number that animates it and with the hero stat that shows it.
4. **Check glossary entries**: the definition is right, and its match forms don't link the wrong word (for example "CO" for cardiac output vs carbon monoxide).
5. **Spot-check the animations** against their text. Examples:
   - gastric waves about 3/min after a meal;
   - the migrating motor complex about every 90–120 min when fasting;
   - the timing of the six voids;
   - sleep cycles of about 90 min, with N3 early in the night and more REM toward morning;
   - conduction speeds per fibre type.
6. **Record the source** in the ledger row, with `--lookup` or `--memory` as it actually happened, and add a "Key sources" line to the `phd` text of a section when it has none. See [Sources](#sources).

## Sources

Every correction has to say where the right value came from, so that a later reader can check the check. Sources live in one registry, `fact-check/sources.json`, and everything else refers to them by id:

```json
"guyton14": {"kind": "textbook", "access": "subscription", "cite": "Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology. 14th ed. Elsevier; 2021."},
"esh2023":  {"kind": "guideline", "access": "open", "cite": "Mancia G, et al. 2023 ESH Guidelines … J Hypertens. 2023;41(12):1874-2071.", "review": "2027-11-01"},
"kandel6":  {"kind": "textbook", "access": "none", "cite": "Kandel ER, et al. Principles of Neural Science. 6th ed. McGraw-Hill; 2021."}
```

- **One id per edition.** Values move between editions, so `guyton14` and a later `guyton15` are different sources. Name ids `<first author or body><edition or year>`.
- **`kind`** is `textbook`, `guideline`, `review`, `primary` or `internal`. Prefer them in that order for settled physiology; for clinical thresholds the current guideline wins over a textbook.
- **`access`** says whether a verifier can follow a link into the source:
  - `open`: free online, so anyone can follow the link;
  - `subscription`: online behind a login (ClinicalKey, AccessMedicine, a journal), so the link works for a verifier with access;
  - `print`: only on paper, so there is no link to the passage;
  - `none`: no copy available.

  `--lookup` is refused for `print` and `none`: these can only be cited with `--memory`, unless an online edition is found. A source with no `access` yet shows as `?` in `--sources`; fill it in the first time it is cited.
- **`review`** (guidelines only) is the date by which to look for a newer edition. When it passes, `--sources` flags it; check for an update, and if there is one, add the new id and run `--cites <old id> --list --all` to re-check every row that relied on the old one.
- **`internal`** is for consistency fixes: the value was brought into line with the [consistency registry](#consistency-registry) or another key, named in the locator (`internal:registry/cardiac-output`, `internal:liver/fn:metab`). Its link is a GitHub permalink to that line at the current commit (`https://github.com/<owner>/<repo>/blob/<commit>/FACTUAL_CHECK.md#L130`). An internal source is only as good as the registry row it points to, so registry rows must cite real sources.
- **The locator** after the colon is a chapter, page, table or figure: enough to find the number in under a minute. A DOI or PMID alone is fine for a paper.

What does **not** count as a source: Wikipedia, AI output (including the nightly build's own text), a lecture slide, or "standard knowledge". Use them to find a real source, then cite that.

### Open sources to look up first

The standard textbooks (Guyton, Boron, Ganong, West, Kandel) are behind subscriptions, so an AI checker can only cite them from memory. These open sources can actually be opened and quoted, so try them first for a `--lookup`, then confirm or extend with the standard textbook from memory. An optional `home` in `sources.json` gives the place to start.

| Topic | Open source (id) |
|---|---|
| Any system, at ms / hs / college level | `openstax-ap2e` (OpenStax *Anatomy and Physiology 2e*) |
| Heart and circulation, pressures, ECG, the cardiac cycle | `klabunde-web` (Cardiovascular Physiology Concepts) |
| Brain, nerves, conduction velocities, sleep circuits | `byrne-nsonline` (Neuroscience Online); `purves2` (Purves *Neuroscience* 2nd ed.) |
| Hormones: thyroid, cortisol, insulin and glucagon, growth hormone | `endotext` (Endotext) |
| Immune system | `janeway5` (Janeway *Immunobiology* 5th ed.; for basics, prefer `janeway10` where they differ) |
| Cerebral, hepatic, gut circulation; capillaries, interstitium and lymph | `cipolla2009`, `lautt2009`, `kvietys2010`, `scallan2010` (Colloquium Series on Integrated Systems Physiology) |
| CKD stages, eGFR, albuminuria | `kdigo2024` |
| COPD, spirometry and its reference values | `gold2027`, `graham2019`, `quanjer2012` |
| Blood pressure categories and targets | `esc2024-htn` (and `esh2023`; say which one the app follows where they differ) |
| Blood glucose and diabetes thresholds | `ada2026` |

- The NCBI Bookshelf books (`purves2`, `janeway5`, `endotext` and the Colloquium Series) are free but some are "searchable, not browsable": find the passage with the Bookshelf search, and give the section's own `NBK…` page as the `--url`.
- NCBI and several publishers show scripts a robot check. The link check accepts that (see [Links](#links)), but a WebFetch may get the check page instead of the text. Then try the publisher's page or the PMC copy. If none opens, cite the source with `--memory`.
- StatPearls is open too, but its quality varies by chapter. Use it to find a primary source or guideline, not as the source.

### Looked up or from memory

A check made from memory is worth something, but much less than one made with the book open, and the ledger has to say which it was. Every citation is recorded one way or the other:

- **`--lookup <id>:<locator> --url <link> --quote "<excerpt>"`**: during this check, you opened the source at the link, read the passage at the locator, and it says what the row claims. The locator, the link and the excerpt are all required, because together they let someone else repeat the look-up in a minute. Reading the same source in an earlier check, or a summary of it, is not a look-up.
- **`--memory <id>`**: you are confident the source says this but did not open it this time, because no copy is to hand, the source's `access` is `print` or `none`, or it was not worth the trip for a well-known value. Add a locator if you remember one.

Rules:
- **When in doubt, it is memory.** Never upgrade a recall to a look-up because you are sure. A row is `via: lookup` only if every source it cites was looked up.
- **AI checkers**, including the nightly build, record a source as `--lookup` only if they fetched and read the passage during the session, give that page as the `--url`, and copy the `--quote` from the fetched text. Everything else they cite is `--memory`. An AI must never write a quote it did not just read.
- **A memory check can approve a row** (`ok`) or fix it (`fixed`), so the backlog can move without a library. But it is the first thing a re-check looks at: re-check `memory` rows by look-up when a copy becomes available (`--via memory --cites <id> --list --all`), and a confirming look-up turns the row into `lookup`.
- **Fixes on clinical thresholds** (guideline cut-offs, drug doses, diagnostic criteria) should be looked up. If the guideline can't be opened, file an issue rather than fixing it from memory.
- **Rows approved before this was recorded** have no `via` and count as `unknown`. Treat them like `memory`.

### Links

A look-up is only as good as the next person's ability to repeat it. So every `--lookup` carries a link, and the link has to work.

- **Point to the passage, as closely as the site allows.** In order of preference:
  - a stable URL for the section or page: an NCBI Bookshelf section, a PMC article with a `#section` anchor, a guideline PDF with `#page=<n>`;
  - an HTML page with a text fragment, `…#:~:text=<start of the excerpt>`, which jumps to and highlights the excerpt in most browsers;
  - for a paper, its DOI link (`https://doi.org/…`), with the locator naming the page, table or figure;
  - for a subscription textbook, the chapter URL on the platform (ClinicalKey, AccessMedicine), with the page in the locator.
- **Never a link to**: a search results page, an AI chat, Wikipedia, a personal drive or a local file, a URL that only works in your own session (a signed or tokenised link), or a private network address. The script refuses the obvious ones.
- **The excerpt** (`--quote`) is 8–300 characters copied verbatim from the passage, enough to find it with Ctrl-F. For a table or figure, quote its title and the value. Don't paraphrase it.
- **Checked when recorded.** `--mark` fetches each link and refuses a dead one (a 404, a DNS failure, a timeout). A link that answers with a login or a robot block (401, 403, 429) is accepted, because a verifier with access can still follow it. Many publishers block scripts, so check those once by hand. `--no-link-check` skips the fetch for offline work; run `--check-links` afterwards.
- **Checked again later.** Links rot. `--check-links` re-fetches them. Fix a dead link by re-citing the row (`--mark … --lookup … --url <new link>`); if the source is gone, move it to `--memory`.

### Independent verification

Random [re-checks](#random-re-checks) ask "is this claim right?". Verification asks a narrower question about the ledger itself: "does this look-up say what it claims to?". A verifier follows the recorded link and checks that the source, the locator and the excerpt are there and support the claim. It catches look-ups that were never made, invented quotes, wrong pages and dead links.

- **Independent** means the verifier is not whoever made the look-up or set the row's status: the script refuses a `--by` that matches either. An AI verifier must run in a fresh session, with no access to the checker's conversation, and record itself under its own run name (for example `claude-verify-2027-01-09`). The person or agent who checks content is never the only one who verifies it.
- **Every run**, verify 10 citations: `node fact-check/scan.mjs --verify-sample 10 --by <verifier> --seed <today>`. The pick is uniform over look-up citations on current, approved rows that the verifier didn't make and that haven't been verified in the last 60 days. For each one it prints the claim, the full citation, the locator, the link (with its last link check) and the excerpt.
- **For each citation**, open the link (don't search for the source some other way first), find the excerpt at the locator, and decide whether it supports the claim as written. Then record the result:
  `node fact-check/scan.mjs --page <page> --key <key> --cite <id> --by <verifier> --verify <result> [--note "…"]`.

| Result | Meaning | What happens to the row |
|---|---|---|
| `confirmed` | The link works, the excerpt is at the locator, and it supports the claim. | The citation gets `verified` and `verifiedBy`. |
| `link-broken` | The link is dead, or leads somewhere else. | The citation moves to `mem`, so the row becomes `via: memory`. The status stays. |
| `wrong-locator` | The link works, but the excerpt isn't where the locator says, or isn't in the source at all. | As for `link-broken`, with the verifier's note. |
| `not-supported` | The excerpt is there but doesn't support the claim. | As for `link-broken`, and the row goes back to `unchecked` (its old status in `was`) to be checked again. |

- Every result goes into `fact-check/verifications.jsonl`. `--recheck-stats` gives failure rates by checker. A checker with more than one failure in 10 verified citations, or any excerpt that isn't in the source at all, has all their look-ups verified (`--verify-sample` with `--cites`, `--batch`, or a large `n`) before they record more.

Where the id appears:
- the ledger row's `src` or `mem` (`--mark … --lookup <id>:<locator>` or `--memory <id>`);
- the consistency registry's Source column;
- the commit message for a fix (`Sources: guyton14 ch. 20 (looked up); boron3 ch. 34 (from memory)`), and the issue body for a filed finding, written out in full from `cite`;
- the "Key sources" line in the `phd` text, written out as a short citation, since readers don't see the ids.

## Random re-checks

The ledger holds over a thousand `ok` rows, many set in bulk with `--prefix`. A bulk approval is only as good as the attention behind it, and a mistake approved once is never looked at again unless its text changes. A small random re-check measures how good the approvals are and catches what slipped through.

- **Every run**, sample 10 items: `node fact-check/scan.mjs --sample 10 --seed <today>`. The pick is uniform over approved rows (`ok`, `fixed`, `n/a`) not checked or re-checked in the last 60 days, so the failure rate is a fair estimate of the error rate in the ledger. `n/a` rows are included, because a factual string wrongly marked `n/a` is never checked otherwise.
- **Check each item from scratch**, by the [method](#method), as if it were new: don't read the old note or source first, and look at it only to compare afterwards. Look sources up where you can: a re-check by look-up is what upgrades a `memory` or `unknown` row.
- **Record each result** one key at a time, with `--lookup` or `--memory` as it actually happened:
  `node fact-check/scan.mjs --page <page> --key <key> --recheck --mark ok --by <you> --lookup "<id>:<locator>" --url <link> --quote "…" --seed <today>`.
  A pass adds the new citations to the old ones; a source looked up replaces the same source recalled. Mark the item `fixed` or `issue #<n>` if it fails. Every result goes into `fact-check/rechecks.jsonl` with the batch it was approved in (its old `checked` date).
- **When an item fails**, look at its batch: `node fact-check/scan.mjs --page <page> --batch <its checked date> --sample 20 --min-age 0`. If 2 or more of those 20 also fail, re-open the whole batch: `node fact-check/scan.mjs --page <page> --batch <date> --mark unchecked --note "batch re-opened after re-check"`. It then goes back through the routine like new work.
- **Watch the rate** with `--recheck-stats`, which also splits it by how the approval was checked (`lookup`, `memory`, `unknown`). If any page's failure rate goes above 5% over at least 20 re-checks, raise its sample size and add a row to the [status table](#status) to re-check it in full. If `memory` approvals fail clearly more often than `lookup` ones, stop approving from memory on that page, and re-check its `memory` rows with `--via memory`.
- **To work through memory rows on purpose**, add `--via memory` (or `--via unknown`) to `--sample`. Keep these targeted samples separate from the uniform 10, because they don't estimate the overall rate.

## Consistency registry

One canonical value per shared quantity. Every page uses these values or explains why it differs (for example, a scenario that changes it). This stops a page built tonight from contradicting a page built last week.

| Quantity | Rest value | Range / exercise | Used on | Source |
|---|---|---|---|---|
| Heart rate | ~70 bpm awake, ~52–55 asleep | ~150 in the run | body, heart | `guyton14` ch. 9, 21 |
| Stroke volume | ~70 mL | ~105 mL upright running (+~50%) | body, heart | `guyton14` ch. 9; `rowell1993` |
| Cardiac output | ~5 L/min (~4 asleep) | ~16 L/min at VO₂ 2 L/min; >20 possible | body, heart, lungs, kidneys, liver | `guyton14` ch. 20, 21 |
| Blood pressure | ~118/76 awake, ~10–15% lower asleep | SBP ~165, DBP flat in the run | body, heart | `esh2023` (dipping); `acsm11` |
| O₂ uptake (VO₂) | ~250 mL/min awake, ~210 asleep | ~2.0 L/min in the run, a fast jog (~8 METs, about the ventilatory threshold for an average adult) | body, lungs | `acsm11` (3.5 mL/kg/min = 1 MET) |
| SpO₂ / SaO₂ | 97–98% awake, ~96% asleep | ~97% in the run | body, heart, lungs | `west11` ch. 6 |
| PaO₂ / PaCO₂ | ~94 / 40 mmHg awake; PaCO₂ +3–7 asleep | ~94 / 40 in the run (a fast jog, below respiratory compensation); pH ~7.37 | body, lungs, brain | `west11` ch. 5, 6, 9 |
| Mixed venous O₂ saturation | ~70% | ~30–35% in the run | body, heart, lungs | `guyton14` ch. 41 (Fick) |
| Tidal volume, breathing rate, dead space | ~500 mL × 14/min (~7 L/min); dead space ~150 mL (VD/VT ~0.3), so alveolar ventilation ~4.9 L/min | Fast jog: 26/min × 1.85 L ≈ 48 L/min (VE/VO₂ ≈ 24), dead space ~0.3 L (VD/VT ~0.16) | body, lungs, engine | `west11` ch. 2, 10; `wasserman-pet5` |
| GFR, renal blood flow | ~125 mL/min; RBF ~1.1–1.2 L/min (~20–25% of CO) | GFR −15% asleep, −25% in the run, up to +20–25% after a protein meal | body, kidneys | `boron3` ch. 34 |
| Urine output per day | ~1.2–1.5 L in six voids; bladder ~450 mL | osmolality ~530 by day, ~900–1000 overnight | body, kidneys | `boron3` ch. 38 |
| Fasting and after-meal blood glucose | 4.7–5.1 mmol/L | peaks ~6.9–7.2 mmol/L, 30–60 min after a meal | body, pancreas, liver | `ada2026` |
| Liver glycogen | ~50–110 g (0.45–0.95 of ~110 g); ~5 g/h overnight | ~20 g used in the ~1 h run (HGO ~5 mg/kg/min) | body, liver | `rothman1991`; `wasserman2009` |
| Insulin and glucagon timing | insulin lags glucose by ~20–30 min | insulin falls and glucagon rises in the run | body, pancreas, liver | `boron3` ch. 51 |
| Sleep architecture | ~5 cycles of ~90 min in 7.5 h | N1 ~4%, N2 ~49%, N3 ~20%, REM ~26%; first REM after ~80 min | body, brain | `aasm3`; `carskadon2017` |
| Gastric emptying, transit times | Water t½ ~10–20 min; solids lag, then ~2–4 kcal/min; fatty meals 3–4 h in the stomach | Small intestine 3–5 h; colon ~20–40 h; whole gut ~10–70 h | body, gut | `guyton14` ch. 64; `lewis1997` |
| Conduction velocities (Aα, Aβ, Aδ, B, C) | Aα / Ia 70–120 m/s (clinical motor 45–60 in the legs, ~55–65 in the arms); Aβ 35–75; Aδ 5–30; B 3–15; C 0.5–2; corticospinal ~60 (fastest); synaptic delay ~0.5–1 ms | knee jerk ~21 ms; tibial nerve to cortex ~40 ms (P40); cortex to quadriceps ~25 ms | body, brain | `kandel6` ch. 9; `purves2`; `guyton14` ch. 47 |
| Lymph flow (thoracic duct) | ~1–1.5 mL/min; ~8 L/day of afferent lymph, ~4 L/day reach the veins | ~3× in the run (model); intestinal lymph up several-fold after a fatty meal | body | `guyton14` ch. 16; `levick2010` (the hs text's "20 L filtered, a few litres left" is the classic view: #17) |
| Blood neutrophils, lymphocytes | neutrophils ~3.2 (early morning) → ~4.1 ×10⁹/L (afternoon); lymphocytes ~2.6 (midnight) → ~1.8 ×10⁹/L (late morning) | run: neutrophils ~5–5.6, lymphocytes ~3.1 then ~1.5 an hour after | body | `haus1999`; `campbell2018` |
| Immune response timing | neutrophils at a wound within hours; dendritic cells in the draining node in ~1–2 days; primary IgM ~day 5–7, IgG peak ~2 weeks; contraction of the clone by 90–95% | secondary response within 1–3 days, 10–100× more antibody, mostly IgG; flu incubation 1–4 days (~2), shedding 5–7 days in adults | body (infection ride) | `janeway10`; `amanna2007`; `krammer2018`, `carrat2008` (flu) |
| Cerebral blood flow | ~750 mL/min (~15% of CO), autoregulated | | body, brain | `guyton14` ch. 62 |
| Blood gases at altitude | 2,400 m (cabin): PIO₂ ~110, PaO₂ ~55–60 mmHg; 4,000 m: PaO₂ ~45, PaCO₂ ~32 | Everest summit, acclimatised: PB ~253, PaO₂ ~25–30, PaCO₂ ~7–13 mmHg, SaO₂ ~70%, pH ~7.5–7.7 | lungs | `west11` ch. 9; `west1983`; `grocott2009` |
| Skeletal muscle blood flow and O₂ use | ~1 L/min (~20% of CO), ~60 mL O₂/min, a–v O₂ ~60 mL/L; ~0.8 L/min and ~45 mL/min asleep | ~11 L/min and ~1.7 L O₂/min in the run (a–v O₂ ~150 mL/L, ~70% of CO) | muscles | `guyton14` ch. 21, 85; `rowell1993` |
| Muscle glycogen | ~420 g (~15 g/kg × 28 kg of muscle; the body text says 400–500 g); ~25% more when endurance-trained, ~60% more after carbohydrate loading | the 1-h run at ~67% VO₂max uses ~a third of the leg muscles’ glycogen; at marathon pace it runs out after ~2.5 h without carbohydrate | body, muscles | `guyton14` ch. 85 |

The Source column uses ids from [`fact-check/sources.json`](#sources). Fill in each row the first time the backlog reaches that quantity. Add rows as new pages bring new shared quantities (muscle blood flow, skin temperature, bone turnover and so on).

## Recording findings

- **Small, clear fixes** go straight in as commits, with a `Sources:` line in the message. Set the ledger row to `fixed` with `--by` and `--lookup` (with its link and excerpt) or `--memory`.
- **Larger or debatable fixes** become GitHub issues with the **`fact-check`** label. Set the ledger row to `issue #<n>`. Don't use the other labels: `report` is for reader reports and `question` is for the nightly build.
  - The issue gives the JSON key, the claim as written, the problem, the severity, the source (its id and full citation, with the locator, the link, whether it was looked up or recalled, and a short quote of the passage where the licence allows), and a suggested fix at each affected level.
  - It ends with the same context block as `.github/ISSUE_TEMPLATE/report.yml` (key, section, settings, `repro` link), so it can be traced the same way.
- **One-time setup**: create the `fact-check` label (Issues → Labels).

### After a fix
- Change all four reading levels together, and any model number, hero stat and glossary entry that says the same thing.
- Run `node organs/sync-engine.mjs --check` and the checks in `tests/`.
- Run `node fact-check/scan.mjs --update`, then set the fixed rows to `fixed` with their source: `--mark fixed --by <you> --lookup "<id>:<locator>" --url <link> --quote "…" --note "<old> → <new>"` (or `--memory <id>` if it wasn't opened).

## Status

The backlog, in order of exposure: the body view is what every reader sees first.

| # | Page / part | Items | Checked | Last check | Open issues |
|---|---|---|---|---|---|
| 1 ✅ | `index.html` body view (phases, systems, journeys, hours, model numbers) | 2602 | 100%: all 13 topics, the glossary, sleep stages, hours, UI strings; the circulatory, respiratory, urinary, digestive, endocrine and nervous systems; the cell, breath, drop, bite, impulse and cascade rides and their arrays (`IMPULSES`, `CASCADES`, `GLANDS`, `HORMONES`); `PHYSIO`, `Physio.at()`, sleep cycles, voids; `mod:Nerves`, `mod:Impulse`, `mod:Hormones`, `mod:Cascade`. On 2026-11-19 the nervous system and impulse ride (269 rows) were fixed in 3 places: saliva is started by the facial and glossopharyngeal nerves, not the vagus (looked up in `openstax-ap2e`); vagotomy slows solids but can speed liquids; a stray comma. The cascade ride (280 rows) got 5 fixes: haemoglobin recovery after a blood donation (looked up in `kiss2015`), the thyroid's 2–3 months of stored hormone, the splanchnic levels, the non-P450 step in cortisol synthesis, and the liver's first-pass share of glucagon in `HORMONES` (0.8 → 0.4). The glossary (508 rows: definitions and match forms) got 2 fixes: osteocytes are former osteoblasts, villi are projections, not folds (both looked up in `openstax-ap2e`). The animation modules got 3 fixes: stomach waves every 7 s → every 20 s (~3/min) whatever the motility, ureter waves 9–24/min → 2–6/min, and the fat ride's thoracic-duct leg 45 → 10 min. Drawing-only functions went to the ignore list | 2026-11-19 | |
| 1b ✅ | Immune & lymphatic system on the body (new on 2026-11-18: `systems.immune`, its glossary terms, `PHYSIO.neutrophils` / `lymphocytes` / `il6`, the lymph channels in `Physio.at()`, `mod:Immune`) | 177 | 100%: all four phases, the eight pins, 25 glossary terms, the white-cell and IL-6 keyframes, the lymph model. Fixed: splenic slit width, the neutrophil and lymphocyte glossary entries. Filed: the lymph volumes at hs vs college, tonsillectomy and immunity. One look-up each in `openstax-ap2e` and `campbell2018`; the rest from memory | 2026-11-19 | #17, #18 |
| 1c ✅ | Follow an infection on the body (new on 2026-11-19: `infection` in `#body-content` (4 journeys, 23 stops), 21 glossary terms, `INFECTIONS` and its legs (`NEUTRO_RIDE`, `DC_ARM`, `DC_NOSE`, `AB_ARM`, `AB_NOSE`), `mod:InfectionRide`, and the edited `fn:lapseRide`, `mod:Immune` and `mod:Scene`) | 245 | 100%: all journeys and stops at four levels, the glossary, the ride's timings against its text. Fixed: complement "punching holes" in Gram-positive splinter bacteria (alarm.hs and the glossary), the interferon glossary entry (IFN-γ), where nasal IgA comes from (abFlu.hs). 21 rows looked up in `openstax-ap2e`; the papers the PhD text names are now in `sources.json` (from memory). The edited `mod:Scene`, `mod:Cascade` and `mod:DropRide` go with the animation modules in row 1 | 2026-11-19 | |
| 1d ✅ | Spleen & lymph nodes on the body (new on 2026-11-20: `topics.spleen` at four phases and four levels, 7 glossary terms, the close-up in `mod:Scene`) | 44 | 100%: marked from memory by the nightly build; re-read on 2026-11-20. Filed: lymphocyte homing into the nodes at night tied to low cortisol (ms, hs and the close-up labels; looked up in `besedovsky2012`) | 2026-11-20 | #20 |
| 2 ✅ | Heart | 1092 | 100%: every section, part, rhythm, occlusion, scenario, lens card and pulse feature at four levels, the glossary, the 12-lead, coronary-territory, Gould stenosis and pleth models (measured in the page). Fixed: gut flow after a meal (hs vs college), six → seven live systems (also on the lungs page), left-main diameter, the AV delay vs the PR interval, left main and angina, a wrong glossary link ("echo"). 3 rows looked up in `klabunde-web`; the rest from memory. The blood-pressure model was retuned the same day: the aorta now stiffens as it is stretched, so rest 120/76, run 166/81, sleep 102/69 (was 125/74, 143/77, 109/53), with SV, EF and CO unchanged; the pleth's artery settings were retuned to match (SI 6.1 young, 9.2 at 70, 17 with atherosclerosis) | 2026-11-19 | |
| 3 ✅ | Lungs | 728 | 100%: every section, part, condition, control test, lens card, scenario and note at four levels, the glossary, and the model (run headless across phases, conditions, altitudes, 5% CO₂, breath-hold and hyperventilation). Fixed: the chemoreflex had no CO₂ set point or dog-leg, so PaCO₂ stayed 40 asleep and in COPD and nobody hyperventilated at altitude (Everest PaO₂ 15, SaO₂ 18%); now sleep 43, COPD 45, 4,000 m 44/33, Everest 27/10 with SaO₂ 68%, with renal bicarbonate compensation; the model's cardiac outputs now match the phase vitals (sleep 3.9, rest 4.7 L/min). Text: alveolar surface "a tennis court" → a badminton court and the barrier "a few hundredths" → under a thousandth of a mm (looked up in `openstax-ap2e`), alveolar ventilation 4.2 → 4.9 L/min, alveolus size (ms vs hs), the Everest gases, the Bohr effect, GLI Global, Kerley B lines, smoking and cilia, PCD, Dbx1 citation, chylomicrons, pulse-oximeter regulation, 2,3-BPG at altitude, the model description. 2 rows looked up; the rest from memory. Drawing functions went to the ignore list | 2026-11-19 | |
| 4 | Kidneys | 1150 | 22% (256 rows): the organ header and hero stats, the four phases, the filtration section (intro, autoregulation and clearance notes), the glomerular parts (glomerulus, Bowman’s capsule, podocyte, filtration barrier, afferent and efferent arterioles, JG cells, macula densa, peritubular capillaries), 23 glossary terms, and the filtration model (`fn:filt`, `fn:solve`, `fn:autoM`, `fn:glom`, `fn:oncotic`, run headless: MAP 90 → RBF 1.07 L/min, RPF 586 mL/min, GFR 125, FF 21%, P_GC 53 mmHg; sleep GFR 110, run 90). Fixed: the barrier’s free-filtration cut-off ~20 → ~7 kDa (college). Filed: the night-time urine in the water model (0.79 mL/min at 636 mOsm/kg vs the text’s 0.5 at ~900). 7 rows looked up in `openstax-ap2e`; the rest from memory. Still to do: the nephron segments and transporter parts, the concentrating section and water balance (`fn:makeKidney`, `const:BODY`, `UREA`), the balance and acid–base section, the gross-anatomy parts, the lens, scenarios and notes, the rest of the glossary, and the drawing helpers for the ignore list | 2026-11-20 | #21 |
| 5 | Brain | 1027 | 0% (`SLEEP_CYCLES` fixed with the body view) | 2026-11-17 | |
| 6 | Stomach & gut | 1342 | 0% | | |
| 7 | Liver | 934 | 0% | | |
| 8 | Pancreas | 910 | 0% | | |
| 8b | Muscles (new on 2026-11-21: `organs/muscles.html`, its glossary and its models `fn:capacity`, `fn:ecStep`, `fn:muStep`, `fn:run`, `fn:energy`, `fn:doms`, `fn:mhAt`, `fn:dayAt`) | 990 | 0%: not yet checked. The nightly build that wrote it cited its key sources in the PhD text (Huxley & Niedergerke 1954, Huxley & Hanson 1954, Lymn & Taylor 1971, Gordon et al. 1966, Walker & Schrodt 1974, Hill 1938, Henneman 1957, Fuglevand et al. 1993, Bergström et al. 1967, Coyle et al. 1986, Holloszy 1967, MacLennan et al. 1990, Patrick & Lindstrom 1973) but marked no rows; drawing and UI helpers are on the ignore list | | |
| 9 | Glossaries (included in the counts above) | | body, heart, lungs: 100% (2026-11-19); kidneys: the 23 filtration terms (2026-11-20); other organ pages: 0% | 2026-11-20 | |
| 10a ✅ | Shared organ engine (`engine`: phase vitals, schedule, beat and breath loop) | 6 | 100% (the loop, `delta()` and the UI helpers went to the ignore list on 2026-11-19) | 2026-11-19 | |
| 10 | `README.md` (not in the ledger; check by hand) | | 0% | | |
| 11 | Random re-checks (`--recheck-stats`) | | 0 re-checked (on 2026-11-20 no approved row was yet 60 days old) | 2026-11-20 | |
| 13 | Code the scan missed until 2026-11-19 (arrow functions and numeric constants, now tracked on every page) | | body: `fn:pick`, `fn:skinP` and `fn:eyePupil` (the topic illustrations registered after them, ~78 kB) still unchecked; heart: `fn:makeHeart` (the model itself: only `mod:Heart`, one line, was tracked when the model was retuned), `fn:flowShare`, `const:CA0`, `const:R_MIN` still unchecked. The rest checked or ignored | 2026-11-19 | |
| 12 | Independent verifications of look-ups (`--recheck-stats`) | | 10 verified, 0 failed (2026-11-20: 8 body, 1 heart, 1 lungs; all confirmed, three with notes that the excerpt backs only part of the row) | 2026-11-20 | |

Item counts come from `node fact-check/scan.mjs` on 2026-11-17 (rows 1b and 1c on the day they landed). On 2026-11-19 the body page as a whole was fully checked (3,018 items, after 6 drawing functions went to the ignore list): 2,612 `ok`, 51 `fixed`, 353 `n/a`, 2 filed. Later that day the scan was widened to arrow functions and numeric constants, and helpers went to the ignore lists: body 3,027 items (3 unchecked, see row 13), heart 1,097 (4 unchecked), lungs 728 (all checked: 680 `ok`, 24 `fixed`, 24 `n/a`). A glossary's items are the `body-glossary:` and `organ-glossary:` keys on each page.

New pages and systems from the nightly build get a row as they land, and are checked before the backlog continues. Tick a row ✅ when all its ledger rows are `ok`, `fixed` or filed.

## First steps

1. ✅ Write `fact-check/scan.mjs` and generate the first `fact-check/ledger.json`. Fill in the item counts above.
2. ✅ Create the `fact-check` label.
3. ✅ Add the "Facts checked" gate to the checklist in `IMPROVEMENTS.md`.
4. ✅ Fill in the consistency registry from the body view's `PHYSIO` keyframes, then start the backlog at row 1.
5. ✅ Add the source registry, `fact-check/sources.json`, seeded with the sources the consistency registry names.
6. Record `access` for each source in `sources.json` (`open`, `subscription`, `print` or `none`). Done for the open sources added on 2026-11-18 (see [Open sources to look up first](#open-sources-to-look-up-first)) and for `ada2026`, `wasserman2009` and `campbell2018`; on 2026-11-19 for the standard textbooks (`subscription`; `rowell1993` is `print`); still to do for the guidelines and papers.
7. The 1,335 rows approved on 2026-11-17 have no sources and no `via` (`node fact-check/scan.mjs --sources --full` lists them). Start with the 38 `fixed` ones: re-cite them, with `--lookup` only where the source is actually opened. Their notes name some sources (Shulman 1990 vs Cline 1999, Rubin & Lanyon); add those to `sources.json` first. The `ok` rows stay `unknown` and are reached by the random re-checks.
