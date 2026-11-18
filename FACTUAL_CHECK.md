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
A committed file, `fact-check/ledger.json`, holds one row per checkable item, grouped by page (`body` for `index.html`, otherwise the organ page's id), one row per line:

```json
"heart": {
 "organ-content:anatomy.parts.sa.phd": {"hash":"a3f9…","status":"ok","checked":"2026-11-17"},
 "const:STEN_LOSS.lm": {"hash":"…","status":"issue #41","checked":"2026-11-18","note":"10% too high for left main"}
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
- **The hash** is of the text or code. When it changes, the row goes back to `unchecked`, remembering its old status in `was`. New keys arrive as `unchecked`. Keys that no longer exist are dropped.

### The scan
A small Node script, `fact-check/scan.mjs`, keeps the ledger up to date. Like `tests/*.mjs`, it needs no build and no dependencies.
- `node fact-check/scan.mjs` prints a table per page: items, counts by status, and how many are new, changed or removed since the ledger.
- `--update` writes new and changed items into the ledger as `unchecked` and drops removed ones.
- `--list` prints the unchecked items with their text; add `--all` for every item, or `--full` for untruncated text.
- `--mark <status>` sets the status of the selected items, with an optional `--note "…"`. It only touches items whose hash is current. Add `--unchecked` to leave rows that already have a status (`ok`, `fixed`, an issue) alone; without it, a broad `--prefix` overwrites them.
- `--check` exits non-zero if any selected item is unchecked or the ledger is out of date, for use as a gate.
- Select with `--page <id>` and `--prefix <key prefix>`, each repeatable. For example:
  `node fact-check/scan.mjs --page body --prefix body-content:topics.heart. --mark ok`.

### The routine
1. After each nightly merge, run `node fact-check/scan.mjs --update`, and commit the ledger with the checks that follow.
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
| Heart rate | ~70 bpm awake, ~52–55 asleep | ~150 in the run | body, heart | Guyton & Hall ch. 9, 21 |
| Stroke volume | ~70 mL | ~105 mL upright running (+~50%) | body, heart | Guyton & Hall ch. 9; Rowell 1993 |
| Cardiac output | ~5 L/min (~4 asleep) | ~16 L/min at VO₂ 2 L/min; >20 possible | body, heart, kidneys, liver | Guyton & Hall ch. 20, 21 |
| Blood pressure | ~118/76 awake, ~10–15% lower asleep | SBP ~165, DBP flat in the run | body, heart | ESC/ESH 2023 (dipping); ACSM |
| O₂ uptake (VO₂) | ~250 mL/min awake, ~210 asleep | ~2.0 L/min in the run, a fast jog (~8 METs, about the ventilatory threshold for an average adult) | body, lungs | 3.5 mL/kg/min = 1 MET; ACSM |
| SpO₂ / SaO₂ | 97–98% awake, ~96% asleep | ~97% in the run | body, heart, lungs | West's Respiratory Physiology ch. 6 |
| PaO₂ / PaCO₂ | ~94 / 40 mmHg awake; PaCO₂ +3–7 asleep | ~94 / 40 in the run (a fast jog, below respiratory compensation); pH ~7.37 | body, lungs, brain | West ch. 5, 6, 9 |
| Mixed venous O₂ saturation | ~70% | ~30–35% in the run | body, heart, lungs | Fick; Guyton & Hall ch. 41 |
| Tidal volume, breathing rate, dead space | ~500 mL × 14/min (~7 L/min); dead space ~150 mL (VD/VT ~0.3), so alveolar ventilation ~4.9 L/min | Fast jog: 26/min × 1.85 L ≈ 48 L/min (VE/VO₂ ≈ 24), dead space ~0.3 L (VD/VT ~0.16) | body, lungs, engine | West ch. 2, 10; Wasserman, *Principles of Exercise Testing* |
| GFR, renal blood flow | ~125 mL/min; RBF ~1.1–1.2 L/min (~20–25% of CO) | GFR −15% asleep, −25% in the run, up to +20–25% after a protein meal | body, kidneys | Boron & Boulpaep ch. 34 |
| Urine output per day | ~1.2–1.5 L in six voids; bladder ~450 mL | osmolality ~530 by day, ~900–1000 overnight | body, kidneys | Boron & Boulpaep ch. 38 |
| Fasting and after-meal blood glucose | 4.7–5.1 mmol/L | peaks ~6.9–7.2 mmol/L, 30–60 min after a meal | body, pancreas, liver | ADA Standards of Care 2026 |
| Liver glycogen | ~50–110 g (0.45–0.95 of ~110 g); ~5 g/h overnight | ~20 g used in the ~1 h run (HGO ~5 mg/kg/min) | body, liver | Rothman et al. 1991; Wasserman 2009 |
| Insulin and glucagon timing | insulin lags glucose by ~20–30 min | insulin falls and glucagon rises in the run | body, pancreas, liver | Boron & Boulpaep ch. 51 |
| Sleep architecture | ~5 cycles of ~90 min in 7.5 h | N1 ~4%, N2 ~49%, N3 ~20%, REM ~26%; first REM after ~80 min | body, brain | AASM Manual; Carskadon & Dement |
| Gastric emptying, transit times | Water t½ ~10–20 min; solids lag, then ~2–4 kcal/min; fatty meals 3–4 h in the stomach | Small intestine 3–5 h; colon ~20–40 h; whole gut ~10–70 h | body, gut | Guyton & Hall ch. 64; Lewis & Heaton 1997 |
| Conduction velocities (Aα, Aβ, Aδ, B, C) | | | body, brain | |
| Lymph flow (thoracic duct) | ~1–1.5 mL/min; ~8 L/day of afferent lymph, ~4 L/day reach the veins | ~3× in the run (model); intestinal lymph up several-fold after a fatty meal | body | Guyton & Hall ch. 16; Levick & Michel 2010 (unchecked) |
| Blood neutrophils, lymphocytes | neutrophils ~3.2 (early morning) → ~4.1 ×10⁹/L (afternoon); lymphocytes ~2.6 (midnight) → ~1.8 ×10⁹/L (late morning) | run: neutrophils ~5–5.6, lymphocytes ~3.1 then ~1.5 an hour after | body | Haus & Smolensky (circadian haematology); Campbell & Turner 2018 (unchecked) |
| Cerebral blood flow | ~750 mL/min (~15% of CO), autoregulated | | body, brain | Guyton & Hall ch. 62 |

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
| 1 | `index.html` body view (phases, systems, journeys, hours, model numbers) | 2602 | 58%: all 13 topics, sleep stages, hours, UI strings; the circulatory, respiratory, urinary, digestive and endocrine systems; the cell, breath, drop and bite rides and their arrays; `PHYSIO`, `Physio.at()`, sleep cycles, voids. Still to do: the cascade ride, the nervous system and impulse ride, the glossary, the animation modules | 2026-11-17 | |
| 1b | Immune & lymphatic system on the body (new on 2026-11-18: `systems.immune`, its glossary terms, `PHYSIO.neutrophils` / `lymphocytes` / `il6`, the lymph channels in `Physio.at()`, `mod:Immune`) | 177 | 0%: not yet checked. Written from Guyton & Hall (lymph), Janeway's *Immunobiology* and the reviews named in its PhD text | | |
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

Item counts come from `node fact-check/scan.mjs` on 2026-11-17. A glossary's items are the `body-glossary:` and `organ-glossary:` keys on each page.

New pages and systems from the nightly build get a row as they land, and are checked before the backlog continues. Tick a row ✅ when all its ledger rows are `ok`, `fixed` or filed.

## First steps

1. ✅ Write `fact-check/scan.mjs` and generate the first `fact-check/ledger.json`. Fill in the item counts above.
2. ✅ Create the `fact-check` label.
3. ✅ Add the "Facts checked" gate to the checklist in `IMPROVEMENTS.md`.
4. ✅ Fill in the consistency registry from the body view's `PHYSIO` keyframes, then start the backlog at row 1.
