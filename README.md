# Body Day
A day in the life of the human body: a fun, standalone, single-file educational web app about human physiology.

Open `index.html` in any modern browser. No build step and no dependencies (Google Fonts are optional).

- **Scrub through 24 hours** (or press play): sleep, breakfast, lunch, an evening run, dinner.
  The see-through body changes as you go: the heart beats, the lungs breathe, blood flows, food travels down, sweat drips and Zzz float.
- **Heart–lung circulation**: red blood cells travel two circuits in series: heart → lungs → heart → an organ → heart. They turn red in the lungs and give up oxygen in each organ, with the amount depending on the organ and the activity. Organs are chosen in proportion to their share of the cardiac output, so in the run most blood goes to the legs and comes back dark. Flow surges with each heartbeat and venous return speeds up with each in-breath. The heart fills and empties in time with the ECG, and breaths have an active in-breath and a passive out-breath.
- **Live vitals**: heart rate with a scrolling ECG (including the breath-by-breath speeding and slowing of respiratory sinus arrhythmia) and stroke volume, breathing rate and tidal volume, blood glucose (with a 24 h trace), core temperature, blood pressure, cardiac output, arterial → venous blood O₂, and insulin, glucagon, cortisol and melatonin.
- **Eight organs to explore**: brain, heart, lungs, stomach & gut, liver, pancreas, kidneys and muscles.
  Each has a close-up illustration and text for each phase of the day (Sleep, Rest, Meal, Exercise).
  The close-ups are live simulations driven by the same heartbeat, breathing and physiology as the body:
  synapses fire and the brain is rinsed in sleep, heart cells contract with the ECG, red cells load O₂ in the alveoli,
  the stomach churns and villi absorb, blood seeps through liver lobules, islets release insulin and glucagon,
  filtrate runs through the nephron, and sarcomeres slide with each running stride.
- **Four reading levels**: Middle school, High school, College and PhD / MD. A glossary links terms and shows their definitions as tooltips.

Values are typical for a healthy adult and simplified for teaching. This is not medical advice.

The structure follows the [Oak Year](../OakYear) template. See the architecture notes at the top of `index.html`.
