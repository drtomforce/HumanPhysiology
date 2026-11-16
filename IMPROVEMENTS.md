# Improvements

A roadmap of what is still to build: the remaining organ deep dives, the body systems the body view doesn't animate yet, and further in-depth explorations, both on the organ pages and across the whole body.
The README describes what already exists. This file only lists what doesn't exist yet.

## Where things stand

| | Done | Remaining |
|---|---|---|
| Organs on the body (close-up + phase text) | 13: brain, heart, lungs, stomach & gut, liver, pancreas, kidneys, muscles, skin, bones, eyes, ears, throat | New organs: see [New organs for the body](#new-organs-for-the-body) |
| Organ deep-dive pages (`organs/<id>.html`) | 6: heart, lungs, brain, kidneys, stomach & gut, liver | 7 existing organs + any new ones |
| Body systems animated on the body | 6: circulatory, nervous, endocrine, respiratory, digestive, urinary | 4: immune & lymphatic, muscles & skeleton, skin, reproductive |
| Journeys ("follow a …") | 6: red cell, nerve impulse, hormone cascade, breath, bite, drop | One per new system, plus cross-system journeys |

## Next up

Both items here are done. The liver page is built; the next step is the pancreas page (see [Suggested order](#suggested-order)).

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
4. **Body-systems lens** covering all ten systems. The six animated ones link back to the body with `?live=<system>`.
5. **Changes bar** through `OrganPage.alter()`: every control registers a change, lists the sections it reaches, and adds a "Because of …" note there. Undo, reset and a shareable link all work.
6. **Scenarios** (`alter.scenarios`): 4–6 ready-made cases that set several controls at once.
7. **Healthy reference** through `OrganPage.delta()`: dashed healthy traces, ▲/▼ readouts and the healthy value in the hero stats.
8. **Wired into `index.html`**: an entry in `ORGAN_PAGES`, links in both directions that carry `level` and `hour`, and glossary terms for every new word.
9. **README** updated with a paragraph for the page.
10. **Export**: every figure has an id, an `aria-label` and a `data-export-name`; canvases are sized by a helper that reads `window.__exportDpr` and sets `node.__fit`; live recordings are added to the CSV with `OrganPage.exportData()`, and `node tests/export-check.mjs <page>` passes.

---

## 1. Remaining organ deep dives

Ordered roughly by teaching value and by how much the existing body simulation already gives each page to build on.

### 1.1 Kidneys (`organs/kidneys.html`) ✅ Done
Built as planned below; see the README for what it covers. Still open for this page: a Starling-based clearance calculator you fill in yourself, K⁺ handling as its own interactive section, an AKI section that separates prerenal, renal and postrenal injury, and passing a condition across to the heart and lungs pages.
- **Anatomy**: the kidney in coronal section (cortex, medullary pyramids, calyces, pelvis, renal artery and vein, ureter), then a nephron (glomerulus, Bowman's capsule, PCT, loop of Henle, DCT, collecting duct, vasa recta, juxtaglomerular apparatus).
- **Filtration**: Starling forces across the glomerulus (glomerular capillary pressure, Bowman's pressure, oncotic pressure) give GFR live. Use sliders for afferent and efferent arteriolar tone, show autoregulation (myogenic response and tubuloglomerular feedback) holding GFR steady over a range of blood pressure, and add a clearance calculator (inulin, creatinine, PAH).
- **Concentrating urine**: a countercurrent multiplier you can step through, with the osmolality gradient building from 300 to 1200 mOsm/kg, urea recycling, and ADH and aquaporin-2 setting the final urine concentration. Include a water-deprivation versus water-load test.
- **Acid–base and electrolytes**: bicarbonate reabsorption, H⁺ secretion and ammonia buffering. K⁺ handling with aldosterone. A Davenport diagram or a simple pH, PaCO₂ and HCO₃⁻ panel that reads the lungs' PaCO₂ for respiratory compensation.
- **Scenarios**: dehydration, diabetes insipidus (central vs nephrogenic), SIADH, acute kidney injury (prerenal, renal, postrenal), chronic kidney disease, an SGLT2 inhibitor, a loop diuretic.

### 1.2 Stomach & gut (`organs/gut.html`) ✅ Done
Built as planned below; see the README for what it covers. Still open for this page: tie the enterocyte and the meal clock to the body’s bite journeys (open the page at the stage a bite has reached), an interactive enzyme cascade you can step through (trypsinogen → trypsin is a list for now), serotonin and the enterochromaffin cells (with IBS and anti-nausea drugs), bile acids and the enterohepatic circulation (the liver page now exists, so the loop can be shared between the two), and the oesophagus and reflux, which belong with the throat page.
- **Anatomy**: the GI tract from oesophagus to rectum, then wall layers (mucosa, submucosa, muscularis with Meissner's and Auerbach's plexuses, serosa), gastric glands (parietal, chief, G and D cells) and a villus with its crypt.
- **Motility**: slow waves from the interstitial cells of Cajal, with spike bursts on top that make contractions. Peristalsis versus segmentation, the migrating motor complex, gastric emptying rate by meal type (liquid, carbohydrate, fat), and the gastrocolic reflex.
- **Secretion and digestion**: the parietal cell (H⁺/K⁺-ATPase, the alkaline tide) and the cephalic, gastric and intestinal phases with gastrin, histamine, ACh and somatostatin. Enzyme cascades (trypsinogen → trypsin), with brush-border enzymes and transporters tied to the existing bite journeys.
- **The gut–brain axis and microbiome**: vagal afferents, enteroendocrine cells (CCK, GLP-1, PYY, ghrelin) and satiety. Bacterial fermentation to short-chain fatty acids, and how fibre intake changes the community.
- **Scenarios**: peptic ulcer (H. pylori or NSAIDs), a proton-pump inhibitor, lactose intolerance, coeliac disease (flattened villi), cholera (CFTR secretion and oral rehydration), gastroparesis, constipation vs diarrhoea.

### 1.3 Liver (`organs/liver.html`) ✅ Done
Built as planned below; see the README for what it covers. Still open for this page: the enterohepatic circulation of bile acids as its own interactive section (it is a readout and a paragraph for now, and needs the gut page's ileum to tie into), an ammonia and urea-cycle section with hepatic encephalopathy, a drug of the reader's choosing followed through absorption, first pass, effect and clearance (the first-pass table is static apart from this liver's extraction), regeneration after a resection or an injury over weeks, zonation beyond three zones, and carrying a condition across to the pancreas page once it exists (fatty liver and insulin resistance belong to both).
- **Anatomy**: lobes and Couinaud segments, the dual blood supply (portal vein ~75%, hepatic artery ~25%), the lobule and the acinus with zones 1–3, sinusoids, hepatocytes, Kupffer and stellate cells, bile canaliculi.
- **Metabolism through the day**: glycogen filling after meals and emptying overnight, gluconeogenesis, ketogenesis in a long fast, and lipoprotein output (VLDL), all driven by the body's existing insulin and glucagon channels.
- **Detoxification and drugs**: phase I (CYP450) and phase II conjugation, first-pass metabolism, and an interactive paracetamol overdose (glutathione depletion, NAPQI, zone 3 necrosis, the N-acetylcysteine antidote). Ethanol metabolism, with alcohol dehydrogenase and its zero-order kinetics.
- **Bile and bilirubin**: haem → bilirubin → conjugation → bile → urobilinogen loop. Use this section to sort jaundice into pre-hepatic, hepatic and post-hepatic, with urine and stool colour.
- **Scenarios**: fatty liver, cirrhosis with portal hypertension (varices, ascites, caput medusae), hepatitis, a gallstone blocking the common bile duct, a paracetamol overdose, a long fast.

### 1.4 Pancreas (`organs/pancreas.html`)
- **Anatomy**: head, body and tail, the duct system and sphincter of Oddi, acini, and the islets of Langerhans (α, β, δ, PP cells).
- **The β-cell**: glucose → GLUT2 → ATP/ADP → K_ATP channel closes → depolarisation → Ca²⁺ → insulin granules, with first- and second-phase release. Sliders for glucose, a sulfonylurea and GLP-1 (incretin effect).
- **Glucose control**: an oral glucose tolerance test and a clamp, driven by a minimal model of glucose and insulin (Bergman), showing insulin sensitivity versus secretion. Glucagon counter-regulation.
- **Exocrine juice**: bicarbonate from duct cells (CFTR) and enzymes from acini. Secretin and CCK control, and what goes wrong in cystic fibrosis.
- **Scenarios**: type 1 diabetes and DKA, type 2 diabetes, hypoglycaemia from too much insulin, acute pancreatitis, cystic fibrosis, a GLP-1 agonist.

### 1.5 Muscles (`organs/muscles.html`)
- **Anatomy**: muscle → fascicle → fibre → myofibril → sarcomere (Z-lines, A and I bands, actin, myosin, titin), the neuromuscular junction, and T-tubules with the sarcoplasmic reticulum.
- **Contraction**: the cross-bridge cycle step by step (ATP, ADP + Pᵢ, the power stroke), excitation–contraction coupling (DHPR → RyR1 → Ca²⁺ → troponin). Length–tension and force–velocity curves you can probe.
- **Recruitment and fibre types**: motor units recruited in order of size (Henneman), rate coding from twitch to tetanus, and type I, IIa and IIx fibres. Energy systems (phosphocreatine, glycolysis, oxidative) over the course of the evening run.
- **Fatigue and training**: lactate threshold, glycogen depletion, endurance vs strength adaptations, and delayed-onset soreness.
- **Scenarios**: myasthenia gravis, botulinum toxin, a cramp, rigor mortis, a marathon "wall", long bed rest (atrophy), malignant hyperthermia.

### 1.6 Bones (`organs/bones.html`)
- **Anatomy**: a long bone (epiphysis, growth plate, diaphysis, marrow cavity, periosteum), osteons with Haversian canals, trabecular vs cortical bone, and the marrow niche.
- **Remodelling**: an animated basic multicellular unit (osteoclasts resorb, osteoblasts refill, osteocytes sense strain), with the RANKL/OPG balance and Wolff's law: load the bone and watch it adapt.
- **Calcium and phosphate**: PTH, vitamin D (skin → liver → kidney) and calcitonin, linking bone, gut and kidney, with a serum Ca²⁺ readout.
- **Blood formation**: haematopoiesis from stem cell to red cell, white cells and platelets. Tie it to the EPO cascade that already exists.
- **Fractures**: haematoma → soft callus → hard callus → remodelling, over weeks.
- **Scenarios**: osteoporosis (menopause, steroids), rickets/osteomalacia, hyperparathyroidism, a fracture healing, an astronaut in microgravity, anaemia from marrow failure.

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

Organ pages already have lens cards for these four systems, but the body view can't show them yet. Each needs what the existing six have: a layer (`.sys-<id>`) with its own animator, text for each phase at four levels, numbered fact pins, a card in the side panel, a "Part of" chip mapping in `ORGAN_SYSTEMS`, and a journey to ride along. Once a system is animated, its lens cards on the organ pages should link back to it.

### 2.1 Immune & lymphatic
- **Draw**: lymph vessels and nodes (neck, armpits, groin, mesenteric), thoracic duct → left subclavian vein, spleen, thymus, tonsils, bone marrow and Peyer's patches.
- **Animate**: lymph creeping centrally, faster with muscle activity in the run and with breathing. White-cell traffic through nodes. The overnight peak of immune activity in sleep and the effect of cortisol through the day. Chylomicrons already ride the lacteals in the fat bite journey, so share that path.
- **Physiology channels**: lymph flow, neutrophil and lymphocyte counts (with their daily rhythm), and inflammatory markers.
- **Journey: follow an infection**: a splinter or a cold virus → mast cells and neutrophils → a dendritic cell carries antigen to a lymph node → a T cell is activated → B cells → plasma cells → antibodies → memory. Time-lapse from minutes to about two weeks. Add a "vaccinated" toggle for a faster second response.
- **Needs**: a new organ for the spleen and lymph nodes (see 3.1).

### 2.2 Muscles & skeleton
- **Draw**: the main skeleton and the big muscle groups (quadriceps, hamstrings, calves, glutes, back, arms, intercostals and the diaphragm, which is already drawn).
- **Animate**: the posture of each phase (lying in sleep with REM atonia, sitting, walking, the running stride with alternating legs), muscle activation lighting up with motor traffic from the nervous system, and bone strain at each footstep.
- **Physiology channels**: muscle O₂ use, glycogen, lactate, ground-reaction force.
- **Journey: follow a step**: motor cortex → spinal cord → motor neuron → NMJ → the sarcomere's cross-bridges → force → tendon → bone strain → osteocytes, then proprioceptors back to the cerebellum. This can share code with the nerve-impulse journey and the existing knee-jerk reflex.

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

### 3.1 Spleen & lymph nodes
Red pulp filtering old red cells, white pulp as an immune hub, a node's cortex, paracortex and medulla. Needed for the immune system (2.1).

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
- Follow an infection (immune, see 2.1).
- Follow a step (muscles & skeleton, see 2.2).
- Follow the heat, and sunlight → vitamin D (skin, see 2.3).
- Follow a cycle (reproductive, see 2.4).
- Follow a drug (see Pharmacology in 4.2).
- Follow a calcium ion: gut → blood → bone, controlled by PTH and vitamin D, with the kidney deciding what to keep.
- Follow a platelet to a cut: injury → plug → clot → repair.

---

## 5. Shared and supporting work

- **Changes across pages**: carry a condition from one organ page to another, for example heart failure on the heart page → pulmonary oedema on the lungs page → lower GFR on the kidneys page, through the shareable-link format.
- **Body view scenarios**: bring the organ pages' scenarios (an asthma attack, a heart attack, dehydration) to the whole body, so every vital, system and journey responds.
- **Quizzes**: a short check-your-understanding set per section at each reading level.
- **Accessibility**: keyboard access to every figure and slider, text alternatives for the animated figures, a reduced-motion mode, and colour-blind-safe system colours.
- **Performance**: `index.html` is ~800 KB. Consider splitting it into modules once more systems are added, keeping the no-build, open-in-a-browser promise.
- **Tests**: `tests/export-check.mjs` already loads every page without errors and applies one scenario. Extend it (or add a sibling) so every scenario applies and resets cleanly, and the sync engine is up to date (`node organs/sync-engine.mjs --check`).
- **Glossary**: add every new term from the pages above, with its match forms.

## Suggested order

1. ~~Kidneys page~~ (done).
2. ~~Gut page~~ (done).
3. ~~Export utility~~ (done).
4. ~~Mobile view of the body~~ (done).
5. ~~Liver page~~ (done). **The pancreas page**, which completes the trio and builds on the bite journeys and the insulin/glucagon channels.
6. Immune & lymphatic system on the body, with the spleen and lymph nodes as a new organ.
7. Muscles and bones pages, then the muscles & skeleton system on the body.
8. Skin page and the skin system on the body (heat balance).
9. Eyes, ears and throat pages.
10. Endocrine glands, and blood & vessels as new organs with pages.
11. Reproductive system and organs.
12. Cross-organ explorations and the extra sections on the heart, lungs and brain.
