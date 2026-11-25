# Improvements

A roadmap of what is still to build: the remaining organ deep dives, the body systems the body view doesn't animate yet, and further in-depth explorations, both on the organ pages and across the whole body.
The README describes what already exists. This file only lists what doesn't exist yet.
When a section is done, replace its plan with a one-line pointer to the README and keep only what is still open, and what changed from the plan where the model is simpler than the plan said.

## Where things stand

| | Done | Remaining |
|---|---|---|
| Organs on the body (close-up + phase text) | 14: brain, heart, lungs, stomach & gut, liver, pancreas, kidneys, muscles, skin, bones, eyes, ears, throat, spleen & lymph nodes | New organs: see [New organs for the body](#3-new-organs-for-the-body) |
| Organ deep-dive pages (`organs/<id>.html`) | 10: heart, lungs, brain, kidneys, stomach & gut, liver, pancreas, muscles, bones, skin | 4 existing organs (eyes, ears, throat, spleen & lymph nodes) + any new ones |
| Body systems animated on the body | 9: circulatory, nervous, endocrine, respiratory, digestive, urinary, immune & lymphatic, muscles & skeleton, skin | 1: reproductive |
| Journeys ("follow a …") | 8: red cell, nerve impulse, hormone cascade, breath, bite, drop, infection, step | One per new system, plus cross-system journeys |
| Prediction questions | 30: three on each of the 10 deep-dive pages, with the hub | One per new page: see [Questions](#6-questions-predict-then-watch) |
| Converging cases (run across pages) | 1: diabetic ketoacidosis | 4: cholera to shock, heart failure, the marathon wall, altitude over weeks |

## Next up

Both items below are built; what is listed under them is still open. The prediction questions, their hub and the first converging case (diabetic ketoacidosis) are built ([6](#6-questions-predict-then-watch)), and so are the skin page ([1.7](#17-skin-organsskinhtml--done)) and the skin system on the body, with its heat flows ([2.3](#23-skin-integumentary--done-the-layer-follow-the-heat-still-open)); next is the “follow the heat” journey (see [Suggested order](#suggested-order)).

### A. Export: figures, animations, context and settings ✅ Done
Built as planned; see the README for what it covers. Checked by `node tests/export-check.mjs`. Still open:
- **Overlays on the body**: the body's SVG and PNG leave out what is drawn over the scene in HTML (the organ labels, the big clock, the journey cards). The caption strip gives the time instead. Draw the labels into the export, or offer a "screen as you see it" capture.
- **Fonts**: exported SVGs name Literata and Schibsted Grotesk, but don't embed them, so PNGs and SVGs opened elsewhere fall back to system fonts. Embed a subset as a data URL when the files are needed for print.
- **Canvas figures** are PNG only. The traces could also be written out as SVG paths from their recordings.
- **MP4**: there is no MP4 muxer of our own. Safari without WebCodecs records through `MediaRecorder` in real time, so a figure that is slow to draw comes out slower than real time there.
- **Data**: the gut page exports its readouts but not yet its meal-clock traces (emptying, acid, hormones). The body exports its vitals through the day, not the live ECG strip.
- **Settings by position**: a settings file finds radio groups, toggles and tabs by their order in each section. If a page's controls change order, an older file could set the wrong one. Give every control a stable id.
- **Other apps and browsers**: the files are checked in Chromium. Open them once in Inkscape, PowerPoint and Keynote, and try the menu in Safari and Firefox.

### B. Mobile view of the body on the starting page ✅ Done
Built as planned; see the README for what it covers. Checked by `node tests/mobile-check.mjs` at 360, 390 and 430 px wide in portrait and 667–932 px wide in landscape. What changed from the plan, and what is still open:
- **Body width**: the body is 167–231 px wide in portrait, depending on the screen (it was about 150 px on a 390 × 664 phone, and is now 174 px there), not twice as wide. The figure is about three times taller than it is wide, so filling the width would need a scene about three screens tall. Pinch-zoom covers the rest. A "head to hips" crop that you scroll through could make it larger still, if testing with readers shows it's needed.
- **Double-tap to zoom** is not built: tapping a dot already opens the organ zoomed in, and a double-tap would clash with tapping a red cell to follow it.
- **Labels for the live system**: the dots have no labels on phones. Showing the names only for the organs of the live system could help readers find their way.
- **Fact pins** are drawn in the body's own units, so they grow when you zoom in. Keep them a fixed size on screen.
- **Ride cards** (the journey cards) still cover the top third of the scene on a phone. They could fold into the clock bar, with a tap to expand them.
- **Real devices**: checked in Chromium's phone emulation, with touch events sent through the DevTools protocol. Try it on an iPhone (Safari) and an Android phone, especially the pinch and the sheet drag.
- **Desktop at 1280 × 800**: the vitals cards cover the Liver, Kidneys and Bones labels. Spread the desktop labels the way the phone dots are spread, or move the vitals.

## What a finished deep-dive page includes

These are the conventions the heart, lungs and brain pages set. Each new page should meet them.

1. **Built from `organs/_template.html`**, with the shared engine kept in sync by `node organs/sync-engine.mjs` (`--check` passes).
2. **Anatomy** section: a labelled figure that animates with the body's own heartbeat, breathing and hour, plus a part inspector with text at all four reading levels.
3. **Three interactive "how it works" sections**, each driven by a real (simplified) model rather than canned animation, with sliders or controls.
4. **Body-systems lens** covering all ten systems. The animated ones (eight so far) link back to the body with `?live=<system>`.
5. **Changes bar** through `OrganPage.alter()`: every control registers a change, lists the sections it reaches, and adds a "Because of …" note there. Undo, reset and a shareable link all work.
6. **Scenarios** (`alter.scenarios`): 4–6 ready-made cases that set several controls at once.
7. **Healthy reference** through `OrganPage.delta()`: dashed healthy traces, ▲/▼ readouts and the healthy value in the hero stats.
8. **Wired into `index.html`**: an entry in `ORGAN_PAGES`, links in both directions that carry `level` and `hour`, and glossary terms for every new word.
9. **README** updated with a paragraph for the page.
10. **Export**: every figure has an id, an `aria-label` and a `data-export-name`; canvases are sized by a helper that reads `window.__exportDpr` and sets `node.__fit`; live recordings are added to the CSV with `OrganPage.exportData()`, and `node tests/export-check.mjs <page>` passes.
11. **Facts checked** (see `FACTUAL_CHECK.md`): the page's numbers agree with the consistency registry there, the PhD / MD text names its key sources, every ledger row it approves cites sources from `fact-check/sources.json`, with `--by claude-nightly-<date>`, as `--lookup <id>:<locator> --url <the page it fetched> --quote "<text copied from that page>"` only for a passage it actually fetched and read in the session, and as `--memory <id>` otherwise, and after `node fact-check/scan.mjs --update`, `node fact-check/scan.mjs --check --page <id>` passes, or the page is listed as unchecked in `FACTUAL_CHECK.md`. Add the page's drawing and UI constants and functions to `ledger.ignore` in `fact-check/ledger.json`.
12. **European setting and SI units only**: lab values, readouts, axes, CSV headers and text use SI units alone (glucose and urea in mmol/L, bilirubin and creatinine in µmol/L), with no US conventional units in brackets. Blood pressure stays in mmHg. Where a rule differs by country (a legal limit, a guideline), show the UK value and the usual European one.
13. **Predict section**: 2–3 questions built on the page's own scenarios, in the format of [6.2](#62-question-format), with `node explore/sync-questions.mjs` run so the hub and the body's side panel list them, and `node tests/questions-check.mjs <page>` passing.

---

## 1. Remaining organ deep dives

Ordered roughly by teaching value and by how much the existing body simulation already gives each page to build on.

### 1.1 Kidneys (`organs/kidneys.html`) ✅ Done
Built; see the README for what it covers. Still open for this page: a Starling-based clearance calculator you fill in yourself, K⁺ handling as its own interactive section, an AKI section that separates prerenal, renal and postrenal injury, and passing a condition across to the heart and lungs pages.

### 1.2 Stomach & gut (`organs/gut.html`) ✅ Done
Built; see the README for what it covers. Still open for this page: tie the enterocyte and the meal clock to the body’s bite journeys (open the page at the stage a bite has reached), an interactive enzyme cascade you can step through (trypsinogen → trypsin is a list for now), serotonin and the enterochromaffin cells (with IBS and anti-nausea drugs), bile acids and the enterohepatic circulation (the liver page now exists, so the loop can be shared between the two), and the oesophagus and reflux, which belong with the throat page.

### 1.3 Liver (`organs/liver.html`) ✅ Done
Built; see the README for what it covers. Still open for this page: the enterohepatic circulation of bile acids as its own interactive section (it is a readout and a paragraph for now, and needs the gut page's ileum to tie into), an ammonia and urea-cycle section with hepatic encephalopathy, a drug of the reader's choosing followed through absorption, first pass, effect and clearance (the first-pass table is static apart from this liver's extraction), regeneration after a resection or an injury over weeks, zonation beyond three zones, and carrying a condition across to the pancreas page once it exists (fatty liver and insulin resistance belong to both).

### 1.4 Pancreas (`organs/pancreas.html`) ✅ Done
Built; see the README for what it covers. What changed from the plan, and what is still open for this page:
- **Electrical bursts are drawn, not solved**: the β-cell's plateau fraction comes from the coupling chain (glucokinase → ATP/ADP → K_ATP), but the bursts themselves are not a channel-level model (Chay–Keizer or similar). A real ion-channel β-cell, with gap-junction coupling across an islet, would let readers block channels one by one as on the brain page.
- **Glucagon counter-regulation** is a simple rule (low glucose, intra-islet insulin, stress), without a separate adrenaline or cortisol channel; exercise is not yet a test you can run, and the body's insulin and glucagon channels are not yet driven by this model (or the reverse).
- **The day**: the tests run on their own clocks (three hours, or a meal), not on the body's hour. A day of meals with insulin doses (carbohydrate counting, a pump) would tie it to the body and the liver page's day.
- **More scenarios**: MODY (glucokinase and HNF1A), neonatal diabetes treated with a sulfonylurea, an insulinoma, gestational diabetes, chronic pancreatitis with type 3c diabetes, SGLT2 inhibitors (shared with the kidneys page) and DPP-4 inhibitors.
- **Exocrine**: the enzyme cascade is a list, not a step-through; the phases of secretion (cephalic, gastric, intestinal) are shown on one meal clock rather than separated; a secretin test and faecal elastase could be added. Carrying a condition across to the liver page (fatty liver and insulin resistance) and the gut page (enzyme capsules, steatorrhoea) is still to do.

### 1.5 Muscles (`organs/muscles.html`) ✅ Done
Built; see the README for what it covers. What changed from the plan, and what is still open for this page:
- **Cross-bridges**: a four-state kinetic scheme (D → A1 → A2 → R) driven by Ca²⁺ on troponin and by ATP, without strain-dependent rates, so the force–velocity curve is Hill's equation drawn beside it rather than a result of the same model. A Huxley (1957) style strain-dependent model would let the two sections share one mechanism, and would also give the force transient after a quick length step.
- **Fatigue inside the fibre** is not modelled: force does not fall with inorganic phosphate, H⁺ or reduced SR Ca²⁺ release, so a sprint's power fall comes only from the energy-supply model, and the motor-unit pool only tires through its junctions (myasthenia). The energy-systems chart is its own three-minute model and does not feed the run model.
- **The run** uses rules rather than a full physiology: a carbohydrate share that rises with intensity, a fat-oxidation ceiling, a liver that releases 0.3–0.45 g/min until ~90 g is gone, lactate from the lactate threshold, cardiac drift of 0.1 bpm/min, and exhaustion when a fixed work capacity above the critical speed is spent. There is no heat, sweat or dehydration, no central fatigue, and the page's run is not the body's run.
- **Training, bed rest and soreness** are fixed rules (12 weeks of endurance or strength training; bed rest losing ~0.5% of muscle a day at first; soreness and CK curves scaled by the eccentric load), not models of protein turnover. There is no ageing (sarcopenia), no feeding or protein effect on muscle building, and no muscle protein balance through the day.
- **Malignant hyperthermia** in the readouts is a timeline rule (temperature, end-tidal CO₂, K⁺ after 20 minutes, dantrolene at 10 minutes), not driven by the coupling model's ATP use.
- **Not yet built**: the stretch reflex and spindle as an interactive circuit (shared with the brain page), EMG, smooth and cardiac muscle side by side with skeletal muscle, and passing a condition across to other pages (bed rest → bones, myasthenia → lungs).
- **More scenarios**: Duchenne muscular dystrophy, statin myopathy, McArdle disease, hypokalaemic periodic paralysis, Lambert–Eaton syndrome, ALS, sarcopenia and a hamstring strain.
- **Facts**: listed as unchecked in `FACTUAL_CHECK.md` (row 8b); the PhD text names its key sources.

### 1.6 Bones (`organs/bones.html`) ✅ Done
Built; see the README for what it covers. What changed from the plan, and what is still open for this page:
- **Remodelling is a rule, not a cell model**: hip density is turnover × balance plus the remodelling space, mineral and Frost's mechanostat (with strain rising as density² falls), calibrated to published rates (menopause, prednisolone, bed rest and space, the FREEDOM and FRAME trials). There are no RANKL, OPG and sclerostin concentrations driving osteoclast and osteoblast numbers (a Lemaire / Pivonka-style model would do it), no separate cortical and trabecular compartments, no spine, and only one site (the hip). The BMU figure takes its depth, refill and rest from the same rules.
- **Wolff's law is one number a day**: the loading choice sets a daily peak strain; the number of cycles, their rate and rest between bouts (Rubin & Lanyon) are in the text, not the model. The body's own run is the default, and the anatomy figure follows the body's hour.
- **Calcium** has no phosphate intake, no FGF23 or Klotho as their own variables, no albumin or pH effect on ionised calcium, no calcimimetic, thiazide or loop diuretic, and the PTH rhythm and the CTX rhythm in the hero are rules over the steady state. Pregnancy and lactation are text only.
- **Fracture healing** is a staged curve (scaled by smoking, steroids, osteomalacia, space and instability), not a mechanobiological model of the callus; there is no choice of fixation (cast, nail, plate) or of bone, and no child (faster healing, remodelling of angulation).
- **The marrow** has three lineages with simple feedback (EPO, G-CSF, TPO); there is no altitude (it belongs with the lungs page and the EPO cascade, which the page links to), no B12 or folate, no haemolysis, no G-CSF drug, no transfusion, and lymphocytes are drawn but not modelled. The neutrophil blood half-life (7 h) is the classical value; deuterium studies suggest longer.
- **Not yet built**: the growth plate as its own interactive section (growth hormone, puberty, rickets at the physis), bone as a calcium store across a day of meals tied to the body's meal times, osteogenesis imperfecta, Paget's disease and bone metastases, joints and arthritis, and carrying a condition across to other pages (bed rest from the muscles page, CKD from the kidneys page, which also sets EPO).
- **More scenarios**: hypoparathyroidism, an anorexia or RED-S athlete, a teenager building peak bone mass, stopping denosumab (rebound), Paget's disease, multiple myeloma, iron-deficiency anaemia, a hip fracture in an older person.
- **Facts**: listed as unchecked in `FACTUAL_CHECK.md` (row 8c); the PhD text names its key sources, and three registry rows (blood calcium and PTH, bone turnover, haemoglobin and blood cell production) were added.

### 1.7 Skin (`organs/skin.html`) ✅ Done
Built; see the README for what it covers. What changed from the plan, and what is still open for this page:
- **The heat model is two nodes**: a core and a skin shell (after Gagge 1971) with a fixed shell of 10% of body mass, one mean skin temperature and no hands, feet or limbs of their own, so the arteriovenous anastomoses are drawn and explained but not modelled, and sleep-onset distal warming is in the anatomy figure (from the body's day) but not in the heat model. Sun is a mean radiant temperature 18 °C above the air; there is no wet clothing, wind chill on exposed skin, altitude, body size, age or fat thickness. Cold water uses h_c ≈ 230 W/m²/K and a shell conductance that rises with shivering, calibrated to ~1.7 °C/h of core cooling at 10 °C; cold shock is text only. Dehydration is a rule (sweat and skin flow fall beyond ~1% body-mass loss) and nobody drinks. After the run the resting controller takes over at once (the exercise skin-flow ceiling lifts over ~5 min), without post-exercise baroreflex limits on skin flow and sweating. Acclimatisation is a lower threshold and a higher gain and ceiling for sweating, without the plasma-volume or sweat-sodium changes. The run is the page's own model calibrated to the body view's ~38.2 °C; the body samples its skin temperature and skin blood flow from the page's day (`DAY`) and calibrates its heat-flow rules to `thermo()`, but doesn't run the model.
- **Touch and pain**: the four receptor responses are rules (rates from depth, velocity, Pacinian bursts at each edge and tuning curves for vibration), not a mechanical model of the skin or the corpuscle; C-tactile afferents and thermoreceptors are text only. The dermatome map and the body map of receptive fields from the plan are not built: two-point discrimination uses seven sites on a small figure with Weinstein's thresholds, scaled up by neuropathy. The pain gate is qualitative arithmetic (its numbers are illustrative), with stress, morphine and ketamine as single factors; no wind-up over time and no chronic pain.
- **Sun**: the dose is UV index × minutes; there is no latitude, date or hour picker (the UV index stands in for them), no tanning over days, and the MED by skin type (I ~2.5 to VI ~10 SED) is one value per type although they overlap widely. Vitamin D is a single saturating curve (289 µg × area × (1 − e^(−MED/0.5))) times a ramp that removes it below a UV index of ~3; sunscreen divides the dose by the labelled SPF. DNA damage is shown relative to the reference, with no repair or cancer risk model.
- **Wound healing** is a staged curve (scaled by diabetes, smoking, infection, age and neuropathy) for a stitched cut, not a cell model; there is no open wound healing by secondary intention, no chronic ulcer, no keloid or hypertrophic scar, and no dressing or pressure-offloading choice.
- **Burns** use the adult rule of nines only (no Lund & Browder chart for children, no palm method), the Parkland formula without a model of the fluid response (urine output, oedema, fluid creep), and the burn's evaporative water loss ((25 + %TBSA) × BSA mL/h) feeds the heat balance; inhalation injury, escharotomy and grafting are not covered.
- **More scenarios**: frostbite and non-freezing cold injury, Raynaud's phenomenon, urticaria, psoriasis, a pressure ulcer, melanoma, hyperhidrosis treated with botulinum toxin, cystic fibrosis sweat (shared with the pancreas page), a child's burn by Lund & Browder, and heat exhaustion versus heat stroke in an older person on diuretics.
- **Not yet built**: the skin system's journeys on the body ([2.3](#23-skin-integumentary--done-the-layer-follow-the-heat-still-open)), and carrying a condition across to other pages (sweat loss → the kidneys page's dehydration, a large burn → the kidneys and heart, vitamin D → the bones page's calcium model, a diabetic foot ↔ the pancreas page). The skin system is now on the body, so the integumentary lens cards link there (`main: true`); the body's `skinTemp` and `skinFlow` are copied from this page's `DAY` keyframes, but the page still doesn't read the body, nor the body run `thermo()`.
- **Facts**: listed as unchecked in `FACTUAL_CHECK.md` (row 8e); the PhD texts name their key sources, 19 sources were added to `fact-check/sources.json`, and two registry rows (thermoregulation, UV dose and vitamin D) were added.

### 1.8 Eyes (`organs/eyes.html`)
- **Anatomy**: cornea, iris, lens, ciliary body, aqueous and vitreous, retina layers, fovea, optic disc, extraocular muscles.
- **Optics**: an interactive ray diagram with accommodation, and myopia, hyperopia, presbyopia and astigmatism corrected with lenses. Pupil size vs depth of field.
- **Phototransduction and the retina**: rhodopsin → transducin → cGMP → the channel closes (light hyperpolarises), dark adaptation over time, rods vs cones, colour matching with three cone types, and centre–surround receptive fields.
- **Visual pathways**: optic nerve → chiasm → LGN → V1, with visual field defects from a lesion you place. Pupillary light reflex and the ipRGCs that set the body clock (link to the melatonin cascade).
- **Scenarios**: glaucoma, cataract, colour blindness, macular degeneration, a pituitary tumour (bitemporal hemianopia), night blindness.

### 1.9 Ears (`organs/ears.html`)
- **Anatomy**: outer, middle (ossicles, eardrum, Eustachian tube) and inner ear (cochlea, vestibule, semicircular canals), and the organ of Corti.
- **Hearing**: impedance matching by the ossicles, the travelling wave and tonotopy (play a tone and see where the basilar membrane peaks), and outer hair cells as an amplifier. An audiogram you can take, with a pure-tone test.
- **Balance**: semicircular canals (rotation) and otoliths (tilt and linear acceleration), the vestibulo-ocular reflex and nystagmus, and motion sickness as a sensory mismatch.
- **Scenarios**: noise-induced hearing loss, age-related hearing loss, otitis media, otosclerosis, BPPV, Ménière's disease, a cochlear implant.

### 1.10 Throat (`organs/throat.html`)
- **Anatomy**: pharynx, larynx (vocal folds, epiglottis, cartilages), oesophagus, tonsils and adenoids, thyroid and parathyroids nearby.
- **Swallowing**: the oral, pharyngeal and oesophageal phases, airway protection, and oesophageal manometry with the upper and lower sphincters.
- **Voice**: vocal fold vibration (myoelastic–aerodynamic theory), pitch and loudness, and formants from the vocal tract filter.
- **Airway and sleep**: upper-airway collapse in sleep (the snoring the body already shows), with obstructive sleep apnoea and its oxygen dips linked to the lungs' chemoreflex.
- **Scenarios**: choking and the Heimlich manoeuvre, aspiration after a stroke, GERD, achalasia, laryngitis, sleep apnoea, tonsillitis.

---

## 2. Body systems still to animate on the body

Organ pages already have lens cards for these systems; the ones below that aren't done can't be shown on the body yet. Each needs what the existing eight have: a layer (`.sys-<id>`) with its own animator, text for each phase at four levels, numbered fact pins, a card in the side panel, a "Part of" chip mapping in `ORGAN_SYSTEMS`, and a journey to ride along. Once a system is animated, its lens cards on the organ pages should link back to it.

### 2.1 Immune & lymphatic ✅ Done
The layer, the "follow an infection" journey and the spleen & lymph nodes topic ([3.1](#31-spleen--lymph-nodes--done-on-the-body-deep-dive-page-still-open)) are built: see the README for what they cover, and `node tests/systems-check.mjs immune` for their check. What changed from the plan, and what is still open:
- **Follow an infection**:
  - **The journey doesn't change the body**: there is no infection state in the physiology, so the fever, the rising neutrophil count, CRP, the swollen node and the tiredness are told in the text but not shown in the vitals or the layer. An `infection` channel driven by the ride's real time could feed `coreTemp`, `neutrophils`, `lymphocytes`, `il6` and node size.
  - **One thread**: the ride follows one line (innate → dendritic cell → T cell → B cell → plasma cell → antibodies → memory). In reality B-cell and T-cell activation overlap, and killer T cells reach the nose while antibodies are still being made; the text says so, but the ride shows them one after the other.
  - **More germs**: a cold virus (no vaccine, all innate and T cells), tetanus in a dirty wound (a toxin, neutralised by vaccine antibodies), a gut infection through the Peyer's patches with IgA, and a urinary infection (shared with the urinary system).
  - **Vaccinated is per ride**: the toggle switches between the twin journeys rather than being a body-wide setting that other rides or a future infection state could read.
  - **Neck nodes** sit under the throat's label in the whole-body view, so a tap there opens the throat. The armpit nodes, the other nodes, the spleen, the thymus and the moving cells start a ride.
- **Chylomicrons** ride their own lymph routes here; the fat bite journey still draws its own path up `THORACIC_D`. The two could share the lymph dots, so a bite's chylomicron is one of the milky dots.
- **Channels are simplified**: thoracic duct flow (`lymphFlow`, ~1.2 mL/min at rest, ~3× in the run), `chyle` (gut activity lagged by 1.5 h), `nodeTraffic` (0–1, high in deep sleep with low cortisol), `spleen` (−25% in the run), and keyframed `neutrophils`, `lymphocytes` (×10⁹/L) and `il6`. They are not yet read by the vitals panel, and there is no CRP, fever or infection state.

### 2.2 Muscles & skeleton ✅ Done
The layer and the "follow a step" journey are built: see the README for what they cover, and `node tests/systems-check.mjs musculo` for their check. What changed from the plan, and what is still open:
- **Follow a step**:
  - **Order**: the stops run in real-time order, so the stretch report reaches the cerebellum (about 13 ms after the spindles fire) before the tendon and the bone take the load up to mid-stance, rather than coming last as planned.
  - **Shared engine**: the step ride and the nerve impulse run on one bullet-time engine (`bulletRide`), and the step's first seven stops are the "Brain → thigh muscle" impulse's legs and text. Those texts say "the right leg", so the *Other leg* ride (the left leg) is labelled for the wrong side at the motor cortex stop.
  - **Running only**: there is one journey, a running step; outside the run the clock jumps to 17:30. A walking step (~1.2 × body weight, ~700 µε) belongs with short walks through the day (below).
  - **The cerebellum doesn't correct anything**: its stop explains the comparison and the correction, but the next step is not changed. Uneven ground, a missed step or a split-belt treadmill could make the correction visible.
  - **Not ridden**: Golgi tendon organs (Ib) and the stretch reflex back onto the quadriceps are in the text only; the push-off with the calf and the Achilles tendon's recoil, and the slow loading response of the bone (NO, PGE2, sclerostin over hours) as a time-lapse after the step.
- **No postures**: the figure stays standing all day. Every system's paths are drawn on that one figure, so lying in sleep, sitting and the running stride are shown by which muscles work (limp in REM, postural tone awake, alternating legs in the run), not by moving the limbs. Posing the figure would need the paths of every layer to follow a skeleton.
- **No walking in the day**: the body only steps when the `muscle` channel is above 0.2 (the run and its warm-up and cool-down). Short walks through the day (to breakfast, at lunch) would add steps at ~1.2 × body weight and ~700 µε.
- **Motor traffic is the layer's own**: the sparks follow each muscle's activation, not the pulses the nervous layer sends down the motor nerves, and the activation timing through the stride (quadriceps and glutes at landing, calf at push-off, hamstrings in late swing) is a set of bumps, not a model of the stretch reflex or a central pattern generator.
- **Channels are simplified**: `muscleVO2` (45 / 60 / ~1,700 mL/min) is a rule on the `muscle` channel; `muscleGlycogen` and `lactate` are keyframes sampled from the muscles page's `dayAt`; `cadence`, `grf` and `boneStrain` are rules (lying, standing, walking, running), with strain on the bones page's scale. The body doesn't yet drive the muscles page's run or the bones page's loading choice from these, and the vitals panel doesn't show them.
- **Not drawn**: the abdominal wall and the hip flexors, the scapulae, hands and feet, the joints' cartilage, and the tibialis anterior on the front of the shin.

### 2.3 Skin (integumentary) ✅ Done (the layer; “follow the heat” still open)
The layer is built: see the README for what it covers, and `node tests/systems-check.mjs integ` for its check (it also checks the heat balance at rest and in the run). What changed from the plan, and what is still open:
- **Journey: follow the heat** (next): heat made in a working muscle → carried by blood → hypothalamus senses it → sympathetic cholinergic nerves → sweat gland → evaporation from the skin. Use the bullet-time / time-lapse ride engine; the layer's `skinGeo` (pores, edge points, arrow anchors) and the `heat*` channels are ready for it. Also a sunlight → vitamin D journey (skin → liver → kidney → gut calcium uptake) that links to bones.
- **Sampled, not simulated**: `skinTemp` and `skinFlow` are keyframes copied from the skin page's `DAY` (which follows its `thermo()` model), and `coreTemp` and `sweat` are the body's own keyframes, as before. The heat flows in `Physio.at()` are rules calibrated to `thermo()` (dry loss = k × (skin − air), with k ~4.8 W/K under the bedclothes, ~7.2 sitting, ~24 running; air 23 °C indoors, 20 °C on the run; ASHRAE breathing loss; evaporation = TEWL + sweat × 2,426 kJ/L). They balance heat made within a few watts at rest and at the run's plateau, but not on the way up or down: early in the run heat is stored, and in the hour after it the core cools while the rules don't show the stored heat leaving (no `heatStore` channel is exported for that reason). Running `thermo()` itself over the day would fix both.
- **Goosebumps** come only from cool skin while the core is near its morning low (faint, ~7:00–8:30), because the day has no cold. Shivering, pale skin in the cold and a cold or hot day need body-view scenarios ([5](#5-shared-and-supporting-work)): the skin page's heat stroke, cold water and fever cases are the obvious ones.
- **One skin**: the rim, plexus and pores are the same everywhere; there are no regional differences (the hands and feet warming most at sleep onset are told in the text and pins, not drawn), no apocrine glands, no sebaceous glands and no nails.
- **Insensible water** (`tewl`, ~16 mL/h) is a constant: it doesn't rise with skin temperature, and it doesn't yet feed the urinary system's water balance or ADH.
- **Not on the vitals panel**: the skin channels are exported with the vitals but not shown in the vitals cards.

### 2.4 Reproductive
- **Draw**: either sex, chosen in the settings, using the same see-through style, with the hypothalamic–pituitary–gonadal axis.
- **Animate**: the HPG axis with pulsatile GnRH → LH and FSH → sex steroids, and testosterone's morning peak. Over a longer time-lapse, the menstrual cycle (follicular phase, LH surge, ovulation, luteal phase) and its effect on core temperature and breathing.
- **Physiology channels**: GnRH pulses, LH, FSH, oestradiol, progesterone, testosterone, cycle day.
- **Journey: follow a cycle**: a 28-day time-lapse from follicle recruitment to ovulation and the corpus luteum, with negative and positive feedback made visible. Use the hormone-cascade machinery with a "days" clock.
- **Care**: keep the text age-appropriate at the middle-school level and factual at every level.

---

## 3. New organs for the body

The body has no close-up or topic yet for these. Each would need a body topic, a close-up simulation, phase text, `ORGAN_SYSTEMS` entries, and later a deep-dive page.

### 3.1 Spleen & lymph nodes ✅ Done (on the body; deep-dive page still open)
Built as the body topic `spleen`; see the README for what it covers. Still open:
- **Deep-dive page** (`organs/spleen.html`): anatomy of the spleen, a node and the lymphatic tree; how it works: a red cell's deformability against the slit size (spherocytosis, sickle cell, malaria), lymphocyte recirculation (HEV entry, dwell time, S1P exit, fingolimod), and a germinal centre over two weeks; scenarios: splenectomy (vaccines, Howell–Jolly bodies), splenomegaly and hypersplenism, a swollen node in an infection, lymphoedema, and glandular fever with a splenic rupture risk.
- **One node for all**: the close-up shows a generic node that turns milky after meals, as a mesenteric node would. A choice of node (neck, armpit, gut) could show what each drains.
- **The node doesn't swell**: there is no infection state yet (see 2.1), so the close-up can't show a reactive node with germinal centres growing.
- **Thymus, tonsils and marrow** could get topics of their own, or join this one as tabs.

### 3.2 Endocrine glands: pituitary, thyroid, adrenal glands
These already appear in the hormone cascades but have no organ card. One "Endocrine glands" topic, or three separate ones, with a deep-dive page covering:
- **Pituitary**: anterior vs posterior, the portal system, and the six anterior hormones with their axes.
- **Thyroid**: follicles, iodine trapping, T4 → T3, the TSH feedback loop. Scenarios: hypo- and hyperthyroidism, Graves' disease, iodine deficiency.
- **Adrenals**: cortex zones (aldosterone, cortisol, androgens) and the medulla (adrenaline), with the cortisol rhythm already in the body. Scenarios: Cushing's, Addison's, phaeochromocytoma, a steroid taper.

### 3.3 Blood & blood vessels
Not an organ in the usual sense, but central enough for its own page.
- **Blood**: composition, haematocrit, haemostasis (platelet plug → coagulation cascade → fibrinolysis) you can trigger, blood groups and a transfusion compatibility game.
- **Vessels**: arteries, arterioles, capillaries, veins, with Poiseuille's law (r⁴), Starling forces and oedema, the baroreflex with an orthostatic stand-up test, and the venous return and muscle pump.
- **Scenarios**: haemorrhage and shock, anaemia, haemophilia, deep vein thrombosis → pulmonary embolism (links to the lungs page), hypertension, atherosclerosis.

### 3.4 Reproductive organs
Ovaries and uterus or testes, depending on the settings. Needed for the reproductive system (2.4).

### 3.5 Bladder (split from the kidneys)
The micturition reflex, detrusor and sphincters, and the pontine micturition centre, with scenarios for overactive bladder and spinal cord injury.

### 3.6 Spinal cord
Tracts (dorsal columns, spinothalamic, corticospinal), reflex arcs, and lesion localisation (hemisection, Brown-Séquard) on a dermatome map. It could be a fifth section on the brain page rather than an organ of its own.

---

## 4. In-depth explorations

### 4.1 More sections for the finished pages

**Heart**
- **Heart sounds and murmurs**: S1–S4 synced to the Wiggers diagram, with an auscultation map and valve disease (aortic stenosis, mitral regurgitation, etc.) that changes the pressure traces and the pressure–volume loop.
- **Cardiac output control**: a Guyton venous return vs cardiac function curve, with blood volume, venous tone and contractility.
- **Exercise testing**: a treadmill (Bruce protocol) that ramps heart rate, stroke volume and blood pressure, with ischaemic ST depression if an artery is narrowed.
- **The fetal circulation**: the foramen ovale, ductus arteriosus and changes at birth. Congenital defects (ASD, VSD, tetralogy of Fallot).
- **Drugs**: β-blockers, nitrates, digoxin and antiarrhythmics acting on the existing models.

**Lungs**
- **Pulmonary function in depth**: diffusing capacity (DLCO) and the alveolar gas equation with the A–a gradient.
- **Mechanical ventilation**: volume vs pressure control, PEEP and the risk of barotrauma, using the existing compliance–resistance model.
- **Acid–base**: respiratory acidosis and alkalosis with renal compensation, shared with the kidneys page.
- **Diving and hyperbaric air**: Boyle's law in the lungs, nitrogen narcosis and decompression sickness.

**Brain**
- **Spinal cord and reflexes** (if not its own page, see 3.6).
- **Memory and learning**: long-term potentiation at the synapse model, and the hippocampus.
- **The autonomic nervous system**: sympathetic vs parasympathetic outflow, organ by organ, driving the body's heart, pupils, gut and sweat glands.
- **Neurotransmitters and drugs**: caffeine (already in), SSRIs, opioids, benzodiazepines, alcohol, nicotine, each acting on the synapse close-up.
- **EEG in disease**: a seizure (spike-and-wave) and anaesthesia.

### 4.2 Cross-organ explorations
These span several organs and are best built as their own pages (for example `explore/<id>.html`) or as journeys on the body.
- **Homeostasis loops**: a single page showing sensor → integrator → effector for glucose, blood pressure, temperature, blood volume and osmolality, Ca²⁺ and pH. Each loop links to the organ page that does the work.
- **Exercise, whole body**: the evening run, scaled from a walk to a sprint, showing every organ's response at once (cardiac output split, ventilation, lactate, glycogen, sweat, kidney blood flow falling).
- **Fasting and feeding**: from the fed state through overnight fasting to 3 days without food (glycogen → gluconeogenesis → ketones), across liver, muscle, fat and brain.
- **Shock**: haemorrhagic, septic, cardiogenic and anaphylactic shock side by side, each pulling a different lever on the circulation.
- **Altitude acclimatisation over weeks**: hyperventilation → renal bicarbonate loss → EPO → more red cells, combining the lungs page, the kidneys and the EPO cascade.
- **A whole lifespan**: the fetus, birth (first breath, closing shunts), childhood growth, puberty, pregnancy (blood volume, cardiac output, breathing), and ageing (lower maximum heart rate, stiffer lungs, falling GFR, bone loss).
- **Pharmacology**: one drug taken by mouth and followed through absorption, first-pass metabolism, distribution, effect and clearance by the liver or kidney, with a plasma-concentration curve and dosing intervals.

### 4.3 New journeys on the body
- Follow the heat (next), and sunlight → vitamin D (skin, see 2.3).
- Follow a cycle (reproductive, see 2.4).
- Follow a drug (see Pharmacology in 4.2).
- Follow a calcium ion: gut → blood → bone, controlled by PTH and vitamin D, with the kidney deciding what to keep.
- Follow a platelet to a cut: injury → plug → clot → repair.

---

## 5. Shared and supporting work

- **Changes across pages**: carry a condition from one organ page to another, for example heart failure on the heart page → pulmonary oedema on the lungs page → lower GFR on the kidneys page, through the shareable-link format.
- **Body view scenarios**: bring the organ pages' scenarios (an asthma attack, a heart attack, dehydration) to the whole body, so every vital, system and journey responds.
- **Quizzes**: replaced by prediction questions; see [Questions](#6-questions-predict-then-watch).
- **Accessibility**: keyboard access to every figure and slider, text alternatives for the animated figures, a reduced-motion mode, and colour-blind-safe system colours.
- **Performance**: `index.html` is ~800 KB. Consider splitting it into modules once more systems are added, keeping the no-build, open-in-a-browser promise.
- **Tests**: `tests/scenario-check.mjs` now applies, resets and shares every scenario, and `tests/questions-check.mjs` checks the questions. Still to add: a check that `node organs/sync-engine.mjs --check` and `node explore/sync-questions.mjs --check` pass, in one place that runs the whole suite.
- **Glossary**: add every new term from the pages above, with its match forms.

## 6. Questions: predict, then watch ✅ Done (the questions, the hub and the first converging case; four cases still open)

Built as planned: a Predict section on each of the nine deep-dive pages (three questions each, 27 in all; the skin page has since added three more) and the hub at `explore/questions.html`. See the README for what they cover, and `node tests/questions-check.mjs` for their check. What changed from the plan, and what is still open:

- **Diabetic ketoacidosis runs** ([6.4](#64-converging-cases)) ✅: see the README. The lungs page has a blood-bicarbonate slider in its control section that moves the chemoreflex set point (Winters’ formula for an acidosis, ~0.7 mmHg per mmol/L for an alkalosis) and a *Diabetic ketoacidosis* scenario at HCO₃⁻ 11 mmol/L, the same patient as the pancreas and kidneys pages (PaCO₂ ~24, pH ~7.29). The hub's *Start the case* opens each stop's page on its scenario through `?scenario=`, and the shared engine draws a case strip (stops, back, next, all stops, leave) from the `case`, `ctitle`, `stop` and `route` parameters. What changed from the plan, and what is still open for it:
  - **Each stop applies its own scenario**: nothing is carried from one page to the next. The four scenarios were set to agree (glucose, ketones, bicarbonate, pH), and the registry row in `FACTUAL_CHECK.md` holds them together, but changing a slider on one page doesn't reach the next. Carrying state needs "Changes across pages" ([5](#5-shared-and-supporting-work)).
  - **No question at each stop**: the strip says where you are and leads on; it doesn't ask you to predict again at every stop, as the hub's text once promised. A stop could name one of the page's questions, or carry its own.
  - **The heart's low-K⁺ ECG is not built**: the plan wanted one after insulin (flattened T waves, U waves); the case ends on the brain page's high potassium instead. A K⁺ control on the heart page's ECG, and a fifth stop after insulin, are still to do.
  - **Open before its questions**: a runnable case can be started before its parent questions are done; the card says they make a good warm-up, and the case still lights up only when they are done.
  - **The other cases' stops still to build**:
  - **Cholera to shock**: the gut's water loss carried across to the kidneys, and a low-blood-volume scenario on the heart page.
  - **Heart failure**: a pulmonary-oedema scenario on the lungs page.
  - **The marathon wall**: the liver's fasting model at the pace of a run, and exercise as a test on the pancreas page.
  - **Altitude**: a respiratory-alkalosis scenario on the kidneys page and a hypoxia scenario on the bones page.
  Carrying the condition across needs "Changes across pages" ([5](#5-shared-and-supporting-work)): the shareable-link format is there, but nothing yet writes one page's state into another page's link.
- **One question of the starter set was merged**: the plan's two pancreas questions on a sulfonylurea and a GLP-1 drug are one question that contrasts them (`t2dsu` runs, and the deeper paragraph points to `t2dglp`). A question can only run one scenario; running two side by side would need the format to take a list.
- **`expect` is checked against the healthy page, not along the run**: the test compares each watched readout with the same readout after a reset, so it catches a claim that points the wrong way, but not the shape of a trace over time ("ketones rise for six hours, then plateau"). Readouts that never settle (a firing neuron's voltage, live muscle force) can't be named in `expect` at all, so for those questions only the figure is watched.
- **The watch list reaches readouts and figures, not traces**: a question can light up a readout tile, a hero stat or a whole figure, but not a single line inside a chart.
- **Remembered per browser**: answers are in `localStorage` under `humanphysiology.questions`, keyed by question id. They don't travel between devices, and the hub's "Forget my answers" is the only way to clear them. Nothing is scored and nothing is timed.
- **Still to add**: a Predict section on each new page as it is built (convention 13), questions on the body view once "Body view scenarios" exists, and predicting a number on a slider ([6.7](#67-later)).

### 6.1 The loop

Built as planned (Background → Setting → Hypothesis → Run → Reconcile → Deeper); see the README. The background is links to the page's own sections rather than excerpts of them, and the figures named in `watch` are highlighted and mirrored into the card rather than scrolled to, with a button on each that scrolls to it.

### 6.2 Question format

Built as planned, with three additions: `ask` (the question itself, apart from the setting), `expect` (how each watched readout moves against the healthy reference, which the test checks) and `sources` (the ids behind the PhD / MD paragraph). The schema is documented above `buildPredict()` in `organs/_template.html`.

### 6.3 Single-organ questions

Built: three on each of the nine pages, on the scenarios the plan named, except that the two pancreas drug questions became one (above) and the bones page's third is chronic kidney disease rather than a question shared with the kidneys page.

### 6.4 Converging cases

Diabetic ketoacidosis is built and runs; the other four are still open: see the list at the top of this section.

### 6.5 Hub page (`explore/questions.html`)

Built as planned; see the README. The map is hidden on phones, where the cards say the same thing.

### 6.6 Conventions

Followed. The test, `tests/questions-check.mjs`, checks everything the plan listed except that `leadsTo` points at a case on the hub rather than one that can be run.

### 6.7 Later

- **Predicting a number**: a slider ("GFR will fall to about … mL/min"), judged against the model's result within a margin, with an explanation for each of too high, too low and close.
- **On the body**: questions on the body view once "Body view scenarios" ([5](#5-shared-and-supporting-work)) exists, so a converging case can end on the whole body with every vital responding.
- **New pages**: eyes, ears, throat and spleen each get a Predict section as they are built (convention 13; the skin page has three), and each new page opens the converging cases that were waiting for it.

## Suggested order

Done so far: the kidneys, gut, liver, pancreas, muscles, bones and skin pages, export, the mobile view of the body, the immune & lymphatic system on the body with the spleen & lymph nodes, the muscles & skeleton system on the body with its "follow a step" journey, the skin system on the body, the prediction questions with their hub, and the first converging case (diabetic ketoacidosis).

1. ~~The first converging case, diabetic ketoacidosis ([6.4](#64-converging-cases)), with the scenarios its stops need.~~ ✅ Done (the heart's low-K⁺ ECG is still open; see [6](#6-questions-predict-then-watch)).
2. ~~Skin page~~ ✅ Done (see [1.7](#17-skin-organsskinhtml--done) for what is still open on it).
3. ~~The skin system on the body (heat balance, sweat and skin blood flow; [2.3](#23-skin-integumentary--done-the-layer-follow-the-heat-still-open))~~ ✅ Done (see 2.3 for what is still open on it).
4. “Follow the heat” on the body ([2.3](#23-skin-integumentary--done-the-layer-follow-the-heat-still-open)).
5. Eyes, ears and throat pages.
6. Endocrine glands, and blood & vessels as new organs with pages.
7. Reproductive system and organs.
8. Cross-organ explorations and the extra sections on the heart, lungs and brain.
