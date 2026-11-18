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
  - `fn:<name>` for a top-level function, which catches the organ models and the numbers inside drawing code.
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
| Cardiac output | ~5 L/min (~4 asleep) | ~16 L/min at VO₂ 2 L/min; >20 possible | body, heart, kidneys, liver | `guyton14` ch. 20, 21 |
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
| Conduction velocities (Aα, Aβ, Aδ, B, C) | | | body, brain | |
| Lymph flow (thoracic duct) | ~1–1.5 mL/min; ~8 L/day of afferent lymph, ~4 L/day reach the veins | ~3× in the run (model); intestinal lymph up several-fold after a fatty meal | body | `guyton14` ch. 16; `levick2010` (unchecked) |
| Blood neutrophils, lymphocytes | neutrophils ~3.2 (early morning) → ~4.1 ×10⁹/L (afternoon); lymphocytes ~2.6 (midnight) → ~1.8 ×10⁹/L (late morning) | run: neutrophils ~5–5.6, lymphocytes ~3.1 then ~1.5 an hour after | body | `haus1999`; `campbell2018` (unchecked) |
| Cerebral blood flow | ~750 mL/min (~15% of CO), autoregulated | | body, brain | `guyton14` ch. 62 |

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
| 1 | `index.html` body view (phases, systems, journeys, hours, model numbers) | 2602 | 58%: all 13 topics, sleep stages, hours, UI strings; the circulatory, respiratory, urinary, digestive and endocrine systems; the cell, breath, drop and bite rides and their arrays; `PHYSIO`, `Physio.at()`, sleep cycles, voids. Still to do: the cascade ride, the nervous system and impulse ride, the glossary, the animation modules | 2026-11-17 | |
| 1b | Immune & lymphatic system on the body (new on 2026-11-18: `systems.immune`, its glossary terms, `PHYSIO.neutrophils` / `lymphocytes` / `il6`, the lymph channels in `Physio.at()`, `mod:Immune`) | 177 | 0%: not yet checked. Written from `guyton14` (lymph), `janeway10` and the papers its text names (`besedovsky2012`, `lange2003`, `prather2015`, `scheiermann2012`, `campbell2018`) | | |
| 2 | Heart | 1111 | 0% | | |
| 3 | Lungs | 743 | 1% (the run's breathing model and text) | 2026-11-17 | |
| 4 | Kidneys | 1128 | 0% | | |
| 5 | Brain | 1027 | 0% (`SLEEP_CYCLES` fixed with the body view) | 2026-11-17 | |
| 6 | Stomach & gut | 1342 | 0% | | |
| 7 | Liver | 934 | 0% | | |
| 8 | Pancreas | 910 | 0% | | |
| 9 | Glossaries (included in the counts above) | | 0% | | |
| 10a | Shared organ engine (`engine`: phase vitals, schedule, beat and breath loop) | 9 | 56% | 2026-11-17 | |
| 10 | `README.md` (not in the ledger; check by hand) | | 0% | | |
| 11 | Random re-checks (`--recheck-stats`) | | 0 re-checked | | |
| 12 | Independent verifications of look-ups (`--recheck-stats`) | | 0 verified | | |

Item counts come from `node fact-check/scan.mjs` on 2026-11-17. A glossary's items are the `body-glossary:` and `organ-glossary:` keys on each page.

New pages and systems from the nightly build get a row as they land, and are checked before the backlog continues. Tick a row ✅ when all its ledger rows are `ok`, `fixed` or filed.

## First steps

1. ✅ Write `fact-check/scan.mjs` and generate the first `fact-check/ledger.json`. Fill in the item counts above.
2. ✅ Create the `fact-check` label.
3. ✅ Add the "Facts checked" gate to the checklist in `IMPROVEMENTS.md`.
4. ✅ Fill in the consistency registry from the body view's `PHYSIO` keyframes, then start the backlog at row 1.
5. ✅ Add the source registry, `fact-check/sources.json`, seeded with the sources the consistency registry names.
6. Record `access` for each source in `sources.json` (`open`, `subscription`, `print` or `none`).
7. The 1,335 rows approved on 2026-11-17 have no sources and no `via` (`node fact-check/scan.mjs --sources --full` lists them). Start with the 38 `fixed` ones: re-cite them, with `--lookup` only where the source is actually opened. Their notes name some sources (Shulman 1990 vs Cline 1999, Rubin & Lanyon); add those to `sources.json` first. The `ok` rows stay `unknown` and are reached by the random re-checks.
