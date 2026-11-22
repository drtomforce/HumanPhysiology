# Improvements

A roadmap of what is still to build: the remaining organ deep dives, the body systems the body view doesn't animate yet, and further in-depth explorations, both on the organ pages and across the whole body.
The README describes what already exists. This file only lists what doesn't exist yet.
When a section is done, replace its plan with a one-line pointer to the README and keep only what is still open, and what changed from the plan where the model is simpler than the plan said.

## Where things stand

| | Done | Remaining |
|---|---|---|
| Organs on the body (close-up + phase text) | 14: brain, heart, lungs, stomach & gut, liver, pancreas, kidneys, muscles, skin, bones, eyes, ears, throat, spleen & lymph nodes | New organs: see [New organs for the body](#3-new-organs-for-the-body) |
| Organ deep-dive pages (`organs/<id>.html`) | 9: heart, lungs, brain, kidneys, stomach & gut, liver, pancreas, muscles, bones | 5 existing organs (skin, eyes, ears, throat, spleen & lymph nodes) + any new ones |
| Body systems animated on the body | 8: circulatory, nervous, endocrine, respiratory, digestive, urinary, immune & lymphatic, muscles & skeleton | 2: skin, reproductive |
| Journeys ("follow a …") | 8: red cell, nerve impulse, hormone cascade, breath, bite, drop, infection, step | One per new system, plus cross-system journeys |
| Prediction questions | 0 | A Predict section on the 9 finished pages, the questions hub and the converging cases: see [Questions](#6-questions-predict-then-watch) |

## Next up

Both items below are built; what is listed under them is still open. The muscles & skeleton system and its "follow a step" journey are on the body; next are the prediction questions (see [Suggested order](#suggested-order)).

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
13. **Predict section**: 2–3 questions built on the page's own scenarios, in the format of [6.2](#62-question-format), listed on the questions hub.

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

### 1.7 Skin (`organs/skin.html`)
- **Anatomy**: epidermis layers (basale → corneum), melanocytes, Langerhans cells, dermis, hair follicle, sebaceous and sweat glands (eccrine, apocrine), receptors (Meissner, Merkel, Pacinian, Ruffini, free nerve endings) and the dermal blood vessels.
- **Temperature control**: the hypothalamic set-point, sweating, vasodilation and vasoconstriction, arteriovenous anastomoses and shivering. Heat balance (conduction, convection, radiation, evaporation) with sliders for air temperature, humidity and wind, tied to the core temperature that already rises in the run.
- **Touch and pain**: receptive fields and two-point discrimination on a body map, adaptation (fast vs slow receptors), dermatomes, and gate control of pain.
- **Barrier, sun and wound healing**: UV → vitamin D vs DNA damage, melanin and skin type, and wound healing (haemostasis → inflammation → proliferation → remodelling).
- **Scenarios**: heat stroke, hypothermia, a sunburn, a burn (by depth, with a rule-of-nines fluid estimate), fever, eczema.

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

### 2.3 Skin (integumentary)
- **Draw**: a skin layer over the whole body with sweat glands, dermal vessels and hair.
- **Animate**: skin blood flow and colour (flushed in the run, pale in cold), sweat rate tied to core temperature, goosebumps, and heat flow arrows (radiation, convection, evaporation). The sweat drips already in the scene become this system's particles.
- **Physiology channels**: skin temperature, sweat rate, skin blood flow, insensible water loss (feeds the urinary system's water balance).
- **Journey: follow the heat**: heat made in a working muscle → carried by blood → hypothalamus senses it → sympathetic cholinergic nerves → sweat gland → evaporation from the skin. Also a sunlight → vitamin D journey (skin → liver → kidney → gut calcium uptake) that links to bones.

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
- Follow the heat, and sunlight → vitamin D (skin, see 2.3).
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
- **Tests**: `tests/export-check.mjs` already loads every page without errors and applies one scenario. Extend it (or add a sibling) so every scenario applies and resets cleanly, and the sync engine is up to date (`node organs/sync-engine.mjs --check`).
- **Glossary**: add every new term from the pages above, with its match forms.

## 6. Questions: predict, then watch

Questions that make the reader commit to a hypothesis before the model runs, then explain what happened. The loop follows quansatz (Brief → Predict → Run → Reconcile → Depth), but nothing here is new machinery: the background is the pages' existing text at the reader's level, the setting is a scenario a page already has, and the run is that page's own model with its healthy reference beside it. Questions start isolated, one organ and one scenario, and lead on to converging cases where several organ systems meet.

Decisions so far:
- **Where**: a Predict section on each organ page, run by that page's models, plus a hub page (`explore/questions.html`). Converging cases move from page to page through links.
- **Levels**: the same scenario and the same hypotheses at all four levels. Only the wording changes (background, setting, choices, explanations). The PhD / MD level adds a deeper paragraph with its sources.
- **No score**: each choice has its own explanation. Finished questions are remembered and unlock the converging cases.
- **Choices only** for now. Predicting a number on a slider comes later ([6.7](#67-later)).

### 6.1 The loop
1. **Background**: the parts of the page the question needs, at the reader's level. These are links to, or excerpts of, the page's anatomy and how-it-works sections, not new text. Every term the setting uses is in the glossary.
2. **Setting**: the scenario told as a case, without naming the diagnosis ("A 19-year-old with type 1 diabetes has been vomiting since yesterday and has missed two insulin doses …").
3. **Hypothesis**: 3–4 choices. The common wrong intuition comes first and nothing is preselected. "Run it" stays disabled until a choice is made, and the choice is locked once it runs.
4. **Run**: `applyScenario` on the page's real models. The dashed healthy traces and the ▲/▼ readouts of `OrganPage.delta()` show what changed. The Changes bar lists the scenario, so undo, reset and the shareable link work as they do now. The figures named in the question's `watch` list are scrolled to and highlighted.
5. **Reconcile**: the explanation for the choice that was made, saying why it holds or where it fails, and pointing at the trace or readout that shows it. The other choices' explanations can be opened afterwards.
6. **Deeper**: the PhD / MD paragraph and its sources, and a link to the next question or the converging case it leads to.

### 6.2 Question format
One entry per question in the page's content JSON, under `questions`:

```json
{ "id": "kidneys-dry-osm",
  "scenario": "dry",
  "background": ["concentrate"],
  "setting":   { "ms": "…", "hs": "…", "college": "…", "phd": "…" },
  "hypotheses": [
    { "id": "dilute", "text": { "ms": "…", … }, "reconcile": { "ms": "…", … } },
    { "id": "conc",   "text": { … }, "reconcile": { … } }
  ],
  "correct": "conc",
  "watch": ["urineOsm", "adh"],
  "leadsTo": ["cholera-shock"] }
```

A question names an existing scenario by its id rather than copying its params, so the two can't drift apart. Text objects use `levelText()`, so a missing level falls back the way it does now.

### 6.3 Single-organ questions
A starter set of two or three per finished page, each on a scenario that already exists (the scenario ids are in brackets):
- **Heart**: an inferior heart attack, then which ECG leads change (`inferiorMI`), and why the same patient's rate falls (`inferiorCHB`). Septic shock: what happens to systemic resistance and cardiac output (`sepsis`).
- **Lungs**: an asthma attack, then what the flow–volume loop does (`asthma`). The summit of Everest versus a week at altitude: which way PaCO₂ goes (`everest`, `acclimatised`).
- **Brain**: a local anaesthetic, then which fibres stop first (`lidocaine`). Panic and over-breathing: why the fingers tingle (`panic`). Very high potassium (`hyperK`).
- **Kidneys**: dehydrated after a run, then urine volume and osmolality (`dry`). An SGLT2 inhibitor: glucose in the urine with normal blood glucose (`sglt2`). SIADH: plasma sodium (`siadh`).
- **Stomach & gut**: cholera, then where the water comes from (`cholera`), and why sugar in the drink helps (`ors`). Lactose intolerance and a glass of milk (`lactose`).
- **Liver**: a paracetamol overdose, then which zone of the acinus dies first (`overdose`), and what NAC at 8 hours changes (`nac`). Three days without food: what fuels the brain (`fast`).
- **Pancreas**: type 1 diabetes and a day without insulin, then glucose, ketones and pH (`t1dka`). Too much insulin (`hypo`). Type 2 on a sulfonylurea versus a GLP-1 drug: which one can cause a hypo (`t2dsu`, `t2dglp`).
- **Bones**: primary hyperparathyroidism, then serum Ca²⁺ and phosphate (`hpt`). Six months in space: where the calcium goes (`astronaut`). Chronic kidney disease, shared with the kidneys page (`ckd`).
- **Muscles**: myasthenia, then force over repeated stimulation (`mg`) and with neostigmine (`mgNeo`). A marathon without fuel: when the wall comes (`wall`).

### 6.4 Converging cases
Each case unlocks once its parent questions are done. It visits several pages in turn and carries the condition across in the shareable-link format, which also builds "Changes across pages" ([5](#5-shared-and-supporting-work)). At every stop the reader predicts again, so the case is a chain of the same loop. The case card names the pages it needs and says "not yet available" until they all exist. Where a stop has no matching scenario yet, one is added to that page.
- **Diabetic ketoacidosis**: pancreas (`t1dka`: no insulin, glucose and ketones rise) → kidneys (`diabetes`: osmotic diuresis, dehydration, bicarbonate) → lungs (Kussmaul breathing and a low PaCO₂; needs a metabolic-acidosis scenario) → heart and brain (potassium when insulin is given: `hyperK`, and a low-K⁺ ECG).
- **Cholera to shock**: gut (`cholera`) → kidneys (prerenal injury; `dry` or a new `cholera` stop) → heart (rate and stroke volume with low volume) → gut again (`ors`, the cure).
- **Heart failure**: heart (`failure`) → lungs (pulmonary oedema; needs a scenario) → kidneys (low GFR, RAAS, a loop diuretic: `loop`).
- **The marathon wall**: muscles (`wall`) → liver (glycogen gone, gluconeogenesis; the `fast` model at the pace of a run) → pancreas (insulin down, glucagon up) → muscles again (`wallFuel`).
- **Altitude**: lungs (`everest` → `acclimatised`) → kidneys (bicarbonate loss; needs a scenario) → bones (EPO and red cells; `donation` shows the marrow refilling, and a hypoxia scenario is needed). This is also 4.2's "Altitude acclimatisation".

### 6.5 Hub page (`explore/questions.html`)
- The questions are grouped by organ and system, with a done or open mark on each, kept in `localStorage` by question id (wrapped in try/catch, so the page works without it).
- The converging cases are drawn as a small map with their parent questions, like quansatz's insight web. A case lights up when its parents are done, and any case can still be opened directly.
- The hub links to each Predict section and back, carrying `level`. `index.html` links to the hub, and an organ's side panel on the body lists that organ's questions.

### 6.6 Conventions
- The text is written at all four levels and uses SI units only, as in the deep-dive conventions.
- **Facts**: each explanation agrees with the model it runs and with the consistency registry in `FACTUAL_CHECK.md`. The PhD / MD paragraph names its sources from `fact-check/sources.json`.
- **A test**, `tests/questions-check.mjs`, checks every question:
  - its scenario exists and applies and resets cleanly;
  - `correct` names one of its hypotheses;
  - every level has its text, or a deliberate fallback;
  - each `watch` readout moves the way the correct explanation says (up, down or unchanged against the healthy reference);
  - every `leadsTo` case exists.

### 6.7 Later
- **Predicting a number**: a slider ("GFR will fall to about … mL/min"), judged against the model's result within a margin, with an explanation for each of too high, too low and close.
- **On the body**: questions on the body view once "Body view scenarios" ([5](#5-shared-and-supporting-work)) exists, so a converging case can end on the whole body with every vital responding.
- **New pages**: skin, eyes, ears, throat and spleen each get a Predict section as they are built (convention 13), and each new page opens the converging cases that were waiting for it.

## Suggested order

Done so far: the kidneys, gut, liver, pancreas, muscles and bones pages, export, the mobile view of the body, the immune & lymphatic system on the body with the spleen & lymph nodes, and the muscles & skeleton system on the body with its "follow a step" journey.

1. Prediction questions: Predict sections on the nine finished pages and the hub ([6.1–6.3](#61-the-loop), [6.5](#65-hub-page-explorequestionshtml)), then the first converging case (diabetic ketoacidosis).
2. Skin page and the skin system on the body (heat balance).
3. Eyes, ears and throat pages.
4. Endocrine glands, and blood & vessels as new organs with pages.
5. Reproductive system and organs.
6. Cross-organ explorations and the extra sections on the heart, lungs and brain.
