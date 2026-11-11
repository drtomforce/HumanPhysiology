# HumanPhysiology
A day in the life of the human body: a fun, standalone, single-file educational web app about human physiology.

Open `index.html` in any modern browser. No build step and no dependencies (Google Fonts are optional).

- **Scrub through 24 hours** (or press play): sleep, breakfast, lunch, an evening run, dinner.
  The see-through body changes as you go: the heart beats, the lungs breathe, blood flows, food travels down, sweat drips and Zzz float.
- **Heart–lung circulation**: red blood cells travel two circuits in series: heart → lungs → heart → an organ → heart. They turn red in the lungs and give up oxygen in each organ, with the amount depending on the organ and the activity. Organs are chosen in proportion to their share of the cardiac output, so in the run most blood goes to the legs and comes back dark. Flow surges with each heartbeat and venous return speeds up with each in-breath. The heart fills and empties in time with the ECG, and breaths have an active in-breath and a passive out-breath.
- **Three body systems you can switch on and off**: circulatory, nervous and endocrine. Show any combination; one at a time is *live* (animated) and the others are drawn faded and still.
  The nervous system fires action potentials driven by the hour's physiology: motor and sympathetic traffic in the run, vagal volleys on each out-breath at rest, gut sensory and enteric traffic after meals, and slow waves in the sleeping brain.
  In the endocrine system, the glands secrete hormones (melatonin, growth hormone, thyroid hormone, cortisol, adrenaline, insulin, glucagon and GLP-1) that ride the bloodstream through the heart and lungs to their target organs. Islet and gut hormones pass through the liver first.
  The live system has numbered fact pins on the body and a card in the side panel explaining it for the current part of the day, both at the chosen reading level.
- **Follow a red blood cell**: tap a cell on the body (or the button in the circulatory card) and the camera rides along with it through the right heart, lungs, left heart, an organ and back.
  A card shows where it is, its O₂ saturation, how much oxygen each organ takes, laps and how long a real lap takes right now. The side panel explains each stop at the chosen reading level.
- **Follow a nerve impulse in bullet time**: tap a nerve on the body (or the button in the nervous-system card) and ride one action potential along nine pathways: motor commands to the thigh and arm, the knee-jerk reflex, touch from the foot to the sensory cortex, the "I'm full" signal from the stomach, vagus and sympathetic nerves to the heart, the sympathetic nerve to the adrenal gland and the vagus to the stomach.
  Time slows thousands of times, so the heart, breathing, blood and clock almost stand still. A card shows the stop, the fibre type and its speed, real elapsed time in milliseconds and how much time is slowed. At each synapse transmitter puffs across the gap. On arrival the effect plays (the muscle contracts, the next beat comes late, adrenaline is released) and time catches up. The side panel explains each stop at the chosen reading level.
- **Real sleep stages**: the night runs through five 90-minute cycles of light (N1, N2), deep (N3) and REM sleep, shown as a hypnogram above the timeline.
  Deep sleep brings slow brain waves, the calmest heart and regular breathing. N2 has sleep spindles. REM brings darting eyes, paralysed limbs, snoring, irregular breathing and heart-rate surges.
- **Live vitals**: heart rate with a scrolling ECG (including the breath-by-breath speeding and slowing of respiratory sinus arrhythmia) and stroke volume, breathing rate and tidal volume, blood glucose (with a 24 h trace), core temperature, blood pressure, cardiac output, arterial → venous blood O₂, and insulin, glucagon, cortisol, melatonin and adrenaline.
- **Thirteen organs to explore**: brain, heart, lungs, stomach & gut, liver, pancreas, kidneys, muscles, skin, bones, eyes, ears and throat.
  Each has a close-up illustration and text for each phase of the day (Sleep, Rest, Meal, Exercise).
  The close-ups are live simulations driven by the same heartbeat, breathing and physiology as the body:
  synapses fire and the brain is rinsed in sleep, heart cells contract with the ECG, red cells load O₂ in the alveoli,
  the stomach churns and villi absorb, blood seeps through liver lobules, islets release insulin and glucagon,
  filtrate runs through the nephron, sarcomeres slide with each running stride,
  skin cells climb and flake off while sweat beads and heat escapes in the run, bone marrow releases new red cells
  while osteoclasts and osteoblasts trade calcium and osteocytes flash with every footstep,
  the pupil follows the light while rods, cones and the body-clock cells of the retina fire and the eyes dart in REM sleep,
  hair cells sway on the cochlea's travelling wave and balance fluid sloshes with each stride,
  and the throat swallows, snores and breathes while cilia sweep mucus up the windpipe.
- **Four reading levels**: Middle school, High school, College and PhD / MD. A glossary links terms and shows their definitions as tooltips.

Values are typical for a healthy adult and simplified for teaching. This is not medical advice.

The structure follows the [Oak Year](../OakYear) template. See the architecture notes at the top of `index.html`.
