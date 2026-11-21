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
- **The hash** is of the text or code. When it changes, the row goes back to `unchecked`, remembering its old status in `was` and keeping its `note`, `src` and `mem` (but not `via`) as a lead for the next check. An approved row also keeps the approval's date and method in `wasChecked` and `wasVia`, so that a re-check that failed can still be logged against its batch after the text has been fixed. New keys arrive as `unchecked`. Keys that no longer exist are dropped.

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
- **`internal`** is for consistency fixes: the value was brought into line with the [consistency registry](#consistency-registry) or another key, named in the locator (`internal:registry/cardiac-output`, `internal:liver/fn:metab`). Its link is a GitHub permalink to that line at the current commit (`https://github.com/<owner>/<repo>/blob/<commit>/FACTUAL_CHECK.md#L130`). An internal source is only as good as the registry row it points to, so registry rows must cite real sources. A commit that has not been pushed yet has no working permalink (the link check sees a 404), so cite the registry with `--memory` until it is pushed, naming the row in the note.
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
  A pass adds the new citations to the old ones; a source looked up replaces the same source recalled. Mark the item `fixed` or `issue #<n>` if it fails. If you corrected the text before recording, run `--update` and then `--recheck --mark fixed` as usual: the row's `was`, `wasChecked` and `wasVia` stand in for the approval it had. Every result goes into `fact-check/rechecks.jsonl` with the batch it was approved in (its old `checked` date). A key can be re-checked once a day, and `--mark` and `--verify` refuse to write anything while the selected pages have changes the ledger hasn't recorded (run `--update` first).
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
| Cerebral blood flow | ~700–750 mL/min (~14–15% of CO), autoregulated: the brain page uses 50 mL/100 g/min × 1.4 kg = 700 (grey matter ~80, white ~20), the body model 0.75 L/min | +~15% in the run (PaCO₂ 40); ~−20% in N3, about waking in REM | body, brain | `guyton14` ch. 62; `cipolla2009` |
| Blood gases at altitude | 2,400 m (cabin): PIO₂ ~110, PaO₂ ~55–60 mmHg; 4,000 m: PaO₂ ~45, PaCO₂ ~32 | Everest summit, acclimatised: PB ~253, PaO₂ ~25–30, PaCO₂ ~7–13 mmHg, SaO₂ ~70%, pH ~7.5–7.7 | lungs | `west11` ch. 9; `west1983`; `grocott2009` |
| Skeletal muscle blood flow and O₂ use | ~1 L/min (~20% of CO), ~60 mL O₂/min, a–v O₂ ~60 mL/L; ~0.8 L/min and ~45 mL/min asleep | ~11 L/min and ~1.7 L O₂/min in the run (a–v O₂ ~150 mL/L, ~70% of CO) | muscles | `guyton14` ch. 21, 85; `rowell1993` |
| Muscle glycogen | ~420 g (~15 g/kg × 28 kg of muscle; the body text says 400–500 g); ~25% more when endurance-trained, ~60% more after carbohydrate loading | the 1-h run at ~67% VO₂max uses ~a third of the leg muscles’ glycogen; at marathon pace it runs out after ~2.5 h without carbohydrate; afterwards it refills slowly until carbohydrate is eaten (~1–2 mmol/kg/h), then fast (~5, at most ~8 mmol/kg/h): after the 1-h run ~85% is back by morning and all of it within ~24 h | body, muscles | `guyton14` ch. 85; `ivy1988`; `jentjens2003` |

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
| 4 ✅ | Kidneys | 1110 | 100%: the organ header and hero stats, the four phases, every section (anatomy, filtration, concentrating and water balance, acid–base, body systems), all segments and parts (nephron, transporters, cell types, gross anatomy) at four levels, the scenarios and notes, the whole glossary (with the page’s linker run over the content), and every model, run headless across phases and scenarios: the filtration model (MAP 90 → RBF 1.07 L/min, GFR 125, FF 21%, P_GC 53 mmHg; sleep GFR 110, run 90), water balance (Umax ~1,125, Umin ~60 mOsm/kg; central DI 7.4 mL/min at 81 mOsm/kg; SIADH Na⁺ 131), glucose (Tm 375 mg/min, SGLT2i 59 g/day) and acid–base (DKA pH 7.28 / HCO₃⁻ 11 / PaCO₂ 25; COPD 7.34 / 30 / 58). Fixed on 2026-11-20: the barrier’s free-filtration cut-off ~20 → ~7 kDa. Fixed on 2026-11-21: the potassium switch was reversed (high K⁺ turns WNK–SPAK *down*, switching NCC off); renal gluconeogenesis “up to a quarter in a long fast” → about a fifth overnight and about half after weeks of fasting (looked up in `owen1969`); cortical flow per gram is among the highest, not the highest; most antenatal hydronephrosis is transient; a DI note’s “leaky to nothing but salt” → water-tight; three glossary match forms that linked the wrong thing (“alkaline” in “blood stays slightly alkaline, pH 7.4” → alkalosis, “acidic” for urine → acidosis, “ascending limb” inside “thin ascending limb” → the thick limb). Model fixes: metabolic compensation now follows Winter’s formula, which the readout already showed as “expected”; the renal response now follows the metabolic component, so compensated COPD no longer excretes bicarbonate (NAE 9 → 60) and chronic hyperventilation no longer makes more ammonium (NAE 136 → 60); the run’s bicarbonate offset −4 → −1.5, so pH 7.37 at PaCO₂ 40 as in the registry; nephrogenic DI’s response to desmopressin +14% → +3%. Filed: the night-time urine (#21; its cause is the thirst floor, which keeps intake at 1.8 mL/min while asleep, so a night settles at Posm 277 and +1.6 L of water). 8 rows looked up (`openstax-ap2e` 7, `owen1969`); the rest from memory. Drawing helpers went to the ignore list | 2026-11-21 | #21 |
| 5 ✅ | Brain | 1050 | 100%: the organ header and hero stats (run headless across phases and scenarios: flow 700 / 800 / 670 mL/min at rest / in the run / in N2, O₂ 50 mL/min, glucose 78 mg/min, melatonin 3 → ~70 pg/mL at night), the four phases, every section (anatomy, signals, sleep, blood supply, body systems), all 42 parts, the sleep stages, strokes, lens cards, scenarios and notes at four levels, the whole glossary (with the page’s linker run over the content), and every model: the Hodgkin–Huxley neuron (run headless: rest −65 mV, peak +40, repetitive firing from 6.3 µA/cm², spontaneous firing from K⁺ 6 mM and depolarisation block from 9), the myelin race, the EEG generator, the two-process sleep model, the circle of Willis flows (they add up to 700 in every stroke) and cerebral autoregulation. Fixed: the BOLD signal comes from flow exceeding O₂ use; the HH onset and its Hopf bifurcation; Nav inactivation is a hinged lid, not a ball and chain; resurgent Na⁺ current is a Purkinje-cell mechanism; the REM flip-flop (Lu, Saper et al. 2006) is GABAergic; six → seven live systems; grey matter flow ~80 at college level too (it said 50, against the PhD text); the ATTENTION (within 12 h) and BAOCHE (6–24 h) trial windows; nigral cell vs striatal dopamine loss in Parkinson’s; CSF is secreted, not filtered; astrocytes help maintain the blood–brain barrier, they don’t form it (looked up in `openstax-ap2e`); the brain gets about a seventh of cardiac output, not a fifth (ms); a quarter → more than a third of the 4 pm coffee left at 11 pm, as the model says; the ACA territory; the delta band; Gidon et al. and nodopathy antigens; wording that linked “threshold” to the neuron’s firing voltage. Model fixes: the run’s PaCO₂ 38 → 40 (as in the registry), so brain flow rises 15% as the text says, not 9%; awake all night uses waking PaCO₂ 40, not the asleep 43; the faint scenario’s MAP 45 → 40 (flow 31 → 25, about half, where syncope sets in), with the flow notes’ thresholds corrected (protein synthesis falters below ~35, synaptic failure near ~20); the all-nighter note no longer claims more flow than healthy REM; the K⁺ messages now match where the model fires alone (≥6 mM) and blocks (≥9). A new glossary term, muscle spindles, so the lens no longer links sleep spindles. 1 row looked up (`openstax-ap2e`); the rest from memory (the Cipolla book and the trial abstracts were behind robot and cookie walls). Drawing helpers went to the ignore list | 2026-11-21 | |
| 6 ✅ | Stomach & gut | 1322 | 100%: the organ header and hero stats, the four phases, every section (anatomy, motility, digestion, gut–brain and microbes, body systems), the three close-ups, all 70 parts, the meals, motility patterns, messages, lens cards, scenarios and notes at four levels, the glossary, and the model, run headless across meals, phases and scenarios: water empties with T½ 11 min, the mixed meal (700 kcal) T½ 135 min with 3% left at 4 h, basal acid 1.4 mmol/h at pH 1.9, peak ~25 mmol/h, fasting gastrin 28 pg/mL, 9 L into the small intestine and 1.65 L into the colon a day, stool water 160 mL, colonic transit 35 h, SCFA 358 mmol/day; an H₂ blocker cuts peak acid by two thirds and a PPI by 88%; cholera 9.5 L/day of stool, with ORS a positive balance of +2.8 L. Fixed: the tract is about 5 m long in life (as the body page says), not nine (a cadaver length), and the small intestine is about 3 m, the jejunum about 1 m and the ileum about 2 m in life (looked up in `openstax-ap2e`); D cells are in the oxyntic glands too; LES tone is largely, not purely, myogenic; short vs long ileal resection (bile-acid diarrhoea vs steatorrhoea); the liver is the biggest *internal* organ, and fat bypasses it; procolipase; peristalsis 1–2 cm/s; SCFA about 300–600 mmol/day depending on fibre. Model fixes: butyrate was 35% of the SCFA, against the text’s 60:20:20; now 20%. A healthy fry-up (38% left at 4 h) set off the “delayed gastric emptying, over 10% is abnormal” alert; that cut-off is for a standard low-fat test meal, so the alert now compares with a healthy stomach on the same meal. 3 rows looked up (`openstax-ap2e`); the rest from memory. The glossary’s match forms were read but the page’s linker was not run over the content. Drawing and UI helpers went to the ignore list | 2026-11-21 | |
| 7 ✅ | Liver | 922 | 100%: the organ header and hero stats, the four phases, every section (anatomy, metabolism, drugs and toxins, bile and bilirubin, body systems), all 43 parts, the zone cards, the jaundice table and its verdicts, the 13 lens cards, the drug table, the scenarios and notes at four levels, the 54-term glossary, and every model, run headless across all ten scenarios and four phases: total flow 1.45 L/min at rest (portal 1.1, arterial 0.35) at HVPG 3 mmHg, F4 cirrhosis 19 mmHg with 35% shunting, glycogen 52–106 g over the day, a three-day fast emptying the store at 32.5 h with gluconeogenesis at 100% of output and β-hydroxybutyrate 2.4 mmol/L, bilirubin 12 µmol/L healthy, 50 in fasting Gilbert's, 259 with a stone (ALP 460, no urobilinogen), 24 g of paracetamol giving ALT 7,800 and INR 2.8 untreated against 1,580 and 1.18 with NAC at 8 h, and 7 units of alcohol crossing the UK driving limit. Fixed: the right hepatic vein's plane (it splits the anterior sector V, VIII from the posterior VI, VII; the text had it splitting VII–VIII from V–VI, which is the portal plane); the kidney's share of gluconeogenesis in a long fast (up to a quarter → about a fifth overnight and about half after weeks, as on the kidneys page, looked up in `owen1969`); the glycogen range over a day (40–100 → 50–110 g, the registry's and the model's); bile 600 → 600–1,000 mL/day (looked up in `openstax-ap2e`); the PhD text's claim that the model takes ~45% of overnight glucose output from gluconeogenesis when it takes ~37% (raising the model's gluconeogenic gain only pushes the extra into glycogen and delays the fast's hand-over, so the text now gives the model's own value and the gap from the isotope studies); the right lobe "about five times" → several times bigger than the left; and two code comments that contradicted their own code (portal insulin 2–3× in life but 1.6× in the model, and glycogen filling pericentrally, not zone 1 first). 13 rows looked up in `openstax-ap2e`; the rest from memory. 38 drawing and UI helpers went to the ignore list. The README's liver paragraph was checked against the model and agrees (glycogen gone at ~32 h, gluconeogenesis a third of output → all of it, ketones 2.4 mmol/L) | 2026-11-21 | |
| 8 ✅ | Pancreas | 897 | 100%: the organ header and hero stats, the four phases, every section (anatomy, the β-cell, glucose control, pancreatic juice, body systems), all 43 parts, the islet cell types, the enzyme cascade, the WHO table and its verdicts, the 11 lens cards, the scenarios and notes at four levels, the 54-term glossary (its match forms read against the page’s word-boundary linker), and the three models, run headless across all 11 scenarios: healthy OGTT fasting 4.9 mmol/L and insulin 8 µU/mL, 7.6 at 30 min (peak 7.8 at ~35), 2-h 6.0, insulin peak 93; clamp M 8.9 mg/kg/min at 111 µU/mL (2.3 in type 2 diabetes); type 2 diabetes 2-h 12.2 with a disposition index of ~10%; a day without insulin β-hydroxybutyrate 7.2, HCO₃⁻ 11, pH 7.28, PaCO₂ 25; too much insulin a nadir of 1.8 with almost no glucagon response; second-phase secretion threshold ~5, half-maximal ~7, saturating ~15 mmol/L; juice 1.07 L/day with fat digestion 98%, cystic fibrosis 0.39 L and 50% (85% with capsules), pancreatitis lipase 640 U/L. Model fix: renal glucose spill began at 16.7 mmol/L (Tm ÷ GFR, with no splay) against the text’s ~10; it now uses the kidneys page’s splayed Tm, so spill starts at ~10.4. Text fixed: the PhD calibration line (insulin peak ~70 → ~90 µU/mL, glucose peak ~7.8 at ~35 min); the fall in intra-islet insulin is *a* key signal for glucagon in a hypo, not *the* signal; most people with CF are pancreatic insufficient from birth or within the first year, not all from birth; amylase and lipase don’t digest the gland’s own cells (escaped lipase does cause fat necrosis); CTRC *and trypsin autolysis* clear the trypsin SPINK1 misses; a normal HOMA-IR is ~1–2, not ~1 (the page’s own healthy model gives 1.8). The OpenStax islet shares (β 75%, α 20%, δ 4%) are the classic rodent-like figures; the page keeps the human ones (β 50–60%, α 30–40%, δ ~10%, from memory: `cabrera2006`). 22 rows looked up in `openstax-ap2e`; the rest from memory (16 sources added, among them `who2006`, `jbds-dka2023`, `pearson2006` and `cabrera2006`). 38 drawing and UI helpers went to the ignore list. The README’s pancreas paragraph was checked against the page and agrees | 2026-11-21 | |
| 8b ✅ | Muscles (new on 2026-11-21: `organs/muscles.html`, its glossary and its models `fn:capacity`, `fn:ecStep`, `fn:muStep`, `fn:run`, `fn:energy`, `fn:doms`, `fn:mhAt`, `fn:dayAt`) | 989 | 100%: the organ header and hero stats (run headless: flow 0.8 / 1.0 / 11.3 L/min and O₂ use 45 / 60 / 1,696 mL/min asleep / at rest / in the run, glycogen ~410 → ~350 g after the run, lactate 1.0 → 1.9 mmol/L, all as in the registry), the four phases, the anatomy section and all 41 parts, the contraction section and cross-bridge cycle, motor units, fuel and fatigue, the fibre-type table, the lens, scenarios and notes at four levels, the whole glossary (56 terms), and every model (run headless: E–C coupling, twitch-to-tetanus fusion, the 120-unit pool, the run, DOMS, MH). Fixed on the first pass: the SR’s Ca²⁺ gradient a thousand-fold → ten-thousand-fold, human end plates are small (looked up in `jones2017`), in-vivo sarcomere lengths (looked up in `llewellyn2008`), the optical-trap step and force, “sympathetic fibres” → axons, glycolysis “without needing oxygen”. Fixed on the second pass (2026-11-21): the peak free Ca²⁺ in a twitch ~1–2 → ~10–20 µM in a fast fibre, with the PhD text noting the model’s smoothed peak of ~1.5 µM (looked up in `baylor2003`); men have ~55% more muscle than women (33 vs 21 kg), not ~40% (looked up in `janssen2000`); the cramp note had spindle unloading favouring firing (backwards); the motor-unit force shares now match `fn:muPool` (46 / 34 / 20); the trained on-kinetics τ 22 → 18 s, as the model gives; the cramp message’s “nerve endings” → the nerves. Filed: quanta per impulse at the human NMJ (#25). 23 rows looked up (`openstax-ap2e` 18, `jones2017`, `llewellyn2008`, `baylor2003` 2, `janssen2000`); the rest from memory. `fn:muRun` went to the ignore list. Then fixed: `fn:dayAt` refilled glycogen slowly for 2 h after the run and faster afterwards, the reverse of the fed pattern; it now refills slowly until dinner and fast after it, capped at ~8 mmol/kg/h (from memory: `ivy1988`, `jentjens2003`) | 2026-11-21 | #25 |
| 9 ✅ | Glossaries (included in the counts above) | | body, heart, lungs: 100% (2026-11-19); muscles, kidneys, brain, gut, liver, pancreas: 100% (2026-11-21) | 2026-11-21 | |
| 10a ✅ | Shared organ engine (`engine`: phase vitals, schedule, beat and breath loop) | 6 | 100% (the loop, `delta()` and the UI helpers went to the ignore list on 2026-11-19) | 2026-11-19 | |
| 10 | `README.md` (not in the ledger; check by hand) | | The liver and pancreas paragraphs checked on 2026-11-21 against the pages' models; the rest 0% | 2026-11-21 | |
| 11 | Random re-checks (`--recheck-stats`) | | 34 re-checked, 2 failed (6%), all body rows from the 2026-11-17 batch with no recorded method. On 2026-11-21: a targeted sample of 14 factual rows (`--via unknown`; not the uniform 10, since no approved row was yet 60 days old), 3 of them looked up on Europe PMC (Zeevi 2015, Button 2012, Andersen & Saltin 1985), the rest from memory. One failed: the gut topic's PhD text gave solid emptying as 1–4 kcal/min against the registry's 2–4; fixed. That set off the batch follow-up (`--batch 2026-11-17 --sample 20`), all from memory: one more failed, the renin journey blurb, which had renin making angiotensin II; fixed. 1 of 20 is under the 2 that re-opens the batch. Soft spots that passed: `urine.stops.portalWater.phd` rests on animal studies; `bite.stops.bileSalts.phd` gives the low end of reported CMCs | 2026-11-21 | |
| 13 ✅ | Code the scan missed until 2026-11-19 (arrow functions and numeric constants, now tracked on every page) | | 100%: on 2026-11-21 the last 7 were checked. Body: `fn:pick`, `fn:skinP` and `fn:eyePupil`, which carry the topic illustrations registered after them; fixed the pancreas close-up, which drew rodent islets (β-cells in the core, α-cells at the rim) where the pancreas page has the human mix, now β ~57%, α ~35%, δ ~8% throughout. Heart: `fn:makeHeart` (the model itself: PR and the AV blocks, escape, QT, action potentials, elastance, coronary flow, ST patterns), `fn:flowShare`, `const:CA0`, `const:R_MIN`, all from memory. `node fact-check/scan.mjs --check` now passes on the whole ledger | 2026-11-21 | |
| 12 | Independent verifications of look-ups (`--recheck-stats`) | | 19 verified, 0 failed (2026-11-21: 9 more, 5 body and 4 kidneys, all confirmed, most with notes that the excerpt backs only part of the row; a tenth, `kiss2015` on PubMed, could not be read through the cookie wall and was left unrecorded) | 2026-11-21 | |
| 14 | Body view in full re-check (set off by row 11: 6% failed over 34 re-checks, above the 5% rule). Both failures came from the 2026-11-17 batch's 1,335 rows with no recorded method, and both were inconsistencies or loose wording, not wrong numbers; the 34 were not a uniform sample of the page, so the rate may overstate it. Start with that batch (`--page body --batch 2026-11-17 --via unknown --list --all`), looking up where possible, and sample 20 a run on the body page until then | 3068 | 0% | 2026-11-21 | |

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
