# Factual check

A plan for checking that every physiological claim in the app is correct, and for keeping it correct as the nightly build adds organs, body systems and journeys.

The README promises values that are "typical for a healthy adult and simplified for teaching". This check holds the app to that promise: simplifying is fine, being wrong is not.

## Why this has to be ongoing

The app has about 133,000 words of text, each written at four reading levels (`ms`, `hs`, `college`, `phd`), plus the numbers that drive the animations. Almost none of it cites a source. The only exception so far is the pleth caveat on the heart page, which ends with a `"phd"` "Key sources" line.

New content arrives every night. The nightly Claude build works through `IMPROVEMENTS.md` (its issues carry the `question` label) and adds pages, systems, journeys and glossary terms. A one-off audit would be out of date within days. So the check works in two parts:
1. **Backlog**: check what exists today once, highest exposure first.
2. **Delta**: after each nightly merge, check only what is new or changed since the last check.

A ledger records what has been checked (see [Keeping up with nightly builds](#keeping-up-with-nightly-builds)).

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

1. **Text**: every `<script type="application/json">` block in `index.html` and `organs/*.html`, except `organs/_template.html`:
   - `#body-content`, `#body-glossary` and `#body-hours` in `index.html`;
   - `#organ-meta`, `#organ-content` and `#organ-glossary` on each organ page.
2. **Model numbers in `index.html`**:
   - the `PHYSIO` keyframes (vitals across the day);
   - `VOIDS`, `SLEEP_CYCLES`;
   - the journey arrays `IMPULSES` (fibre types, conduction speeds, synaptic delays), `CASCADES` (hormone timings), `MOLECULES` and `BREATHS` (partial pressures), `BITES` and `URINES`, and every journey array a new system adds;
   - the values `Physio.at()` derives: cardiac output, Fick venous O₂ and the organ flow split.
3. **Organ-page models**: the parameters of each "how it works" simulation, the `alter.scenarios` values, and the healthy references passed to `OrganPage.delta()`.
4. **Text drawn outside the JSON**: hero stats, fact pins, figure labels and the part-inspector text.
5. **`README.md`**: each new page adds a paragraph of claims.

## Keeping up with nightly builds

### The ledger
A committed file, `fact-check/ledger.json`, holds one row per checkable item:

```json
"body-content:topics.heart.phases.exercise.college": {
  "hash": "a3f9…",
  "status": "ok",
  "checked": "2026-11-17",
  "note": ""
}
```

- **Keys** use the same format the in-app reporter uses (`<block id>:<json path>`), so a reader report, a fact-check issue and a ledger row all point to the same place.
- **Model numbers** use `<file>:<CONSTANT>.<entry id>` keys, for example `index.html:IMPULSES.kneeJerk`.
- **Status** is one of `unchecked`, `ok`, `fixed` or `issue #<n>`.
- **The hash** is of the text (or the entry's serialized numbers). When a string changes, its hash no longer matches and the row goes back to `unchecked`. New keys arrive as `unchecked`. Keys that no longer exist are dropped.

### The scan
A small Node script, `fact-check/scan.mjs`, keeps the ledger up to date. Like `tests/*.mjs`, it needs no build and no dependencies.
- `node fact-check/scan.mjs` reads every JSON block and the constants listed above. It reports new, changed and removed keys, grouped by page and section, with a per-page count of unchecked items.
- `node fact-check/scan.mjs --update` writes the new and changed keys into the ledger as `unchecked`.
- `node fact-check/scan.mjs --page heart` limits the scan to one page.
- `node fact-check/scan.mjs --check` exits non-zero if a page has unchecked items, for use as a gate.

### The routine
1. After each nightly merge, run `node fact-check/scan.mjs --update`.
2. Check the unchecked items, using the [method](#method) below. Work through new pages and systems first, then the edited strings.
3. Fix or file each finding (see [Recording findings](#recording-findings)), and set each row's status and date.
4. Update the [status table](#status).

### The gate for new pages
Add a line to "What a finished deep-dive page includes" in `IMPROVEMENTS.md`:

> 11. **Facts checked**: the page's numbers agree with the [consistency registry](FACTUAL_CHECK.md#consistency-registry), the PhD / MD text names its key sources, and `node fact-check/scan.mjs --page <id>` reports nothing unchecked, or the page is listed as unchecked in `FACTUAL_CHECK.md`.

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
6. **Record the source** for anything non-obvious, and add a "Key sources" line to the `phd` text of a section when it has none.

## Consistency registry

One canonical value per shared quantity. Every page uses these values or explains why it differs (for example, a scenario that changes it). This stops a page built tonight from contradicting a page built last week.

| Quantity | Rest value | Range / exercise | Used on | Source |
|---|---|---|---|---|
| Heart rate | | | body, heart | |
| Stroke volume | | | body, heart | |
| Cardiac output | | | body, heart, kidneys, liver | |
| SpO₂ / SaO₂ | | | body, heart, lungs | |
| PaO₂ / PaCO₂ | | | body, lungs, brain | |
| Mixed venous O₂ saturation | | | body, heart, lungs | |
| Tidal volume, breathing rate, dead space | | | body, lungs | |
| GFR, renal blood flow | | | body, kidneys | |
| Urine output per day | | | body, kidneys | |
| Fasting and after-meal blood glucose | | | body, pancreas, liver | |
| Insulin and glucagon timing | | | body, pancreas, liver | |
| Gastric emptying, transit times | | | body, gut | |
| Conduction velocities (Aα, Aβ, Aδ, B, C) | | | body, brain | |
| Cerebral blood flow | | | body, brain | |

Fill in each row the first time the backlog reaches that quantity. Add rows as new pages bring new shared quantities (muscle blood flow, skin temperature, bone turnover and so on).

## Recording findings

- **Small, clear fixes** go straight in as commits. Set the ledger row to `fixed`.
- **Larger or debatable fixes** become GitHub issues with the **`fact-check`** label. Set the ledger row to `issue #<n>`. Don't use the other labels: `report` is for reader reports and `question` is for the nightly build.
  - The issue gives the JSON key, the claim as written, the problem, the severity, a source, and a suggested fix at each affected level.
  - It ends with the same context block as `.github/ISSUE_TEMPLATE/report.yml` (key, section, settings, `repro` link), so it can be traced the same way.
- **One-time setup**: create the `fact-check` label (Issues → Labels).

### After a fix
- Change all four reading levels together, and any model number, hero stat and glossary entry that says the same thing.
- Run `node organs/sync-engine.mjs --check` and the checks in `tests/`.
- Run `node fact-check/scan.mjs --update`, then set the fixed rows to `fixed` with today's date.

## Status

The backlog, in order of exposure: the body view is what every reader sees first.

| # | Page / part | Items | Checked | Last check | Open issues |
|---|---|---|---|---|---|
| 1 | `index.html` body view (phases, systems, journeys, hours, model numbers) | | 0% | | |
| 2 | Heart | | 0% | | |
| 3 | Lungs | | 0% | | |
| 4 | Kidneys | | 0% | | |
| 5 | Brain | | 0% | | |
| 6 | Stomach & gut | | 0% | | |
| 7 | Liver | | 0% | | |
| 8 | Pancreas | | 0% | | |
| 9 | Glossaries (all pages) | | 0% | | |
| 10 | `README.md` | | 0% | | |

New pages and systems from the nightly build get a row as they land, and are checked before the backlog continues. Tick a row ✅ when all its ledger rows are `ok`, `fixed` or filed.

## First steps

1. Write `fact-check/scan.mjs` and generate the first `fact-check/ledger.json`. Fill in the item counts above.
2. Create the `fact-check` label.
3. Add the "Facts checked" gate to the checklist in `IMPROVEMENTS.md`.
4. Fill in the consistency registry from the body view's `PHYSIO` keyframes and the heart page, then start the backlog at row 1.
