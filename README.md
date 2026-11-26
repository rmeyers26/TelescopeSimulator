# TelescopeSimulator

Interactive 3D telescope simulators that help a beginner (or a middle-school student) learn how telescopes work. They run in any modern browser on desktop or phone.

- **Celestron C11** on a CPC Deluxe HD fork mount – `index.html` (a classic computerized GoTo telescope you align and drive yourself).
- **Seestar S50** smart telescope – `seestar.html` (an all-in-one scope that levels itself, finds north by plate-solving and live-stacks photos). Choose it from the home screen, or open `seestar.html` directly.

## Run it

- **Quickest:** open `index.html` in a browser (double-click works).
- **Like a real website:** from this folder run `python3 -m http.server 8000` and open http://localhost:8000.
- **Online:** turn on GitHub Pages (Settings → Pages → `main`, `/ (root)`).

Three.js r128 is loaded from a CDN, so the first load needs internet.

## Project layout

```
index.html            page markup only (toolbar, panels, dialogs) + the list of scripts
css/style.css         all styling, including phone layouts, Education mode and Night mode
assets/moon.jpg       Moon photo (NASA/JPL Galileo PIA00405, public domain)
js/01-core-astro.js   helpers ($, clamp…) and astronomy math (time, coordinates, Sun/Moon/planets)
js/02-catalogs.js     stars, Messier/NGC objects, Pluto, constellations, asterisms
js/03-driver.js       telescope "driver" layer: SimDriver (simulated mount) + NexStar serial stub
js/04-scene.js        Three.js scene: tube, fork, base, tripod, accessories, sky dome, Dipper guide
js/05-parts-data.js   text for every part (Info tab) and the kid-friendly versions
js/06-schematic.js    the optical-path diagram (SVG)
js/07-camera.js       orbit / walk camera, picking, highlight, cutaway, labels
js/08-ui.js           tabs, parts list, info panel
js/09-setup-guide.js  12-step setup guide from the Celestron manuals
js/10-missions-home.js missions & badges, comparison views, home screen, welcome, Night mode, toolbar
js/11-hand-controller.js NexStar+ hand controller, simple kid controller, keyboard/gamepad, safety pop-ups
js/12-sky-eyepiece.js sky chart, eyepiece views, seeing & light pollution, location & local time, Moon
js/13-learn.js        guided lessons (Follow the light, Find the North Star, …)
js/14-link.js         Link tab (future real-hardware connection)
js/15-main.js         start-up and the animation loop
js/16-align-wizard.js  Easy alignment wizard: 1-planet (Solar System) and 3-star alignment + tracking demo
js/17-ux.js            Quick tour, My First Night story, sky compass, swipe tabs, press-and-hold part labels
js/18-scope-popups.js  Tap the eyepiece/finder to look through it and swap eyepieces; tap the hand controller to pop it out
js/19-focus.js        Focus knob: slides the primary mirror; out-of-focus stars become doughnuts; per-eyepiece focus

seestar.html          the Seestar S50 simulator page (uses js/01 and js/02 from above, plus its own files below)
css/seestar.css       styling for the Seestar page
js/s50/s50-model.js   specs, sky conditions (light pollution, Moon glare, clouds, dew) and the mount state machine (start-up, GoTo, tracking)
js/s50/s50-imaging.js paints the sky patch in view and stacks simulated photos with realistic noise; field rotation; Moon
js/s50/s50-scene.js   Three.js 3D model of the S50 on a tripod, sky dome with real stars, orbit camera
js/s50/s50-app.js     user interface (tabs, object list, charts, scenarios) and the main loop
```

### Why plain scripts instead of ES modules?

The files are ordinary `<script>` tags, not `import`/`export` modules. Browsers refuse to load modules from a file opened by double-click (`file://`), and keeping that working matters for using the simulator offline at a dark site. Ordinary scripts share one global scope, so:

- **Load order matters.** The files run in the numbered order listed in `index.html`. Code at the top level of a file can only use things defined in the same file or an earlier one.
- Functions in later files can be *called later* (from button clicks, the animation loop, or `DOMContentLoaded`), just not while an earlier file is still loading.
- If you add a new file, give it a number that places it after everything it depends on.

## Features (short)

- Home screen to choose a telescope (C11 now; smart telescope, refractor and Dobsonian planned).
- 3D model matched to Celestron's CPC Deluxe 1100 HD and tripod drawings; exploded and cutaway views, labels, left/right/front/rear/top views.
- NexStar+ hand controller (full keypad) and a simple Education-mode controller with picture Go-to tiles.
- Real sky for any location and time (default Phoenix, AZ at 10 pm), sky chart, eyepiece/finder/naked-eye views, real Moon photo with phase and per-eyepiece scale.
- Viewing conditions: seeing (steady / average / shimmery), light pollution (dark site → city), and a true "mirrored diagonal / upside-down finder" view.
- Education mode, lessons, missions with badges, safety pop-ups, red Night mode, phone layouts.

Simulation only: the RS-232/Link features are not connected to real hardware yet.

## Seestar S50 simulator (short)

- Realistic start-up: power on → arm opens → self-levels → gets time/place → plate-solves to find north. No manual alignment.
- Plan tab: pick from Messier/NGC objects, planets and the Moon, see what is up now, how it fits the 1.27° × 0.72° frame, and GoTo.
- Live stack: every simulated 10 s / 20 s photo adds random noise that shrinks as 1/√N. Switch between the live stack and a single photo; adjust gain; save a PNG.
- Dual-band light-pollution filter vs IR-cut filter: nebulae pop, galaxies and stars fade. Light pollution (Bortle 1–9), twilight, Moon glare, clouds and dew all change the picture.
- Alt-az behaviour: field rotation (dark corners grow on long stacks) and the zenith blind spot (the mount loses a target that passes almost overhead).
- Learn tab: specifications, short explanations, and one-click scenarios.

The numbers (sensitivity, noise, rates) are a teaching model tuned to look and behave plausibly; they are not measurements of a real unit. The Sun is deliberately not offered as a target, and the simulator warns if you steer near it.
