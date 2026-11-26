# TelescopeSimulator

Interactive 3D telescope simulators that help a beginner (or a middle-school student) learn how telescopes work. They run in any modern browser on desktop or phone.

- **Celestron C11** on a CPC Deluxe HD fork mount – `index.html` (a classic computerized GoTo telescope you align and drive yourself).
- **Seestar S50 Pro** smart telescope – `seestar.html` (an all-in-one scope with a telephoto and a wide-angle camera that finds north by plate-solving and live-stacks photos). Choose it from the home screen, or open `seestar.html` directly.

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

seestar.html          the Seestar S50 Pro simulator page (uses js/01 and js/02 from above, plus its own files below)
css/seestar.css       styling for the Seestar page
js/s50/s50-model.js   specs (from the S50 Pro manual), sky/weather, power button + indicator-light language, mount state machine (boot, connection, initialization, GoTo, tracking, zero position, EQ mode, solar safety)
js/s50/s50-imaging.js telephoto + wide-angle imaging: star fields, galaxies, nebulae, Milky Way, stacking with realistic noise, star trails, Sun / Moon / scenery renderers
js/s50/s50-scene.js   Three.js 3D model of the S50 Pro on its carbon tripod: the whole L-shaped body turns, the slab-shaped head hangs from a pivot at its top and tilts (EQ wedge, solar filter, indicator lights), photo-realistic rendering, sky dome, orbit camera
js/s50/s50-app.js     the phone app and device controls: tabs, connection wizard, modes, targets, EQ set-up, album (JPEG / FITS / video)
js/s50/s50-live.js    live view and overlays, photo / video capture, scenarios, learn text, main loop and start-up
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

## Seestar S50 Pro simulator (short)

Built from the S50 Pro user manual (V1) and quick guide. It does what the manual describes:

- **The physical device:** press-and-hold power button with the manual's timings (short press shows the battery, 2 s on/off, 6 s forced off, special first-use press), indicator-light patterns (red running / breathing, yellow steady or breathing, green in EQ mode, four battery lights), USB-C charging while running, auto-shutdown below 5 %, and a "zero position" where the head hangs straight down in front of the column with the lens facing forward.
- **Phone connection:** scan, first-time reset-button pairing, online activation (internet, ZWO account, region), Wi-Fi hotspot (iOS automatic / Android manual with password), firmware update and reboot, NFC quick connect, and an imaging session that keeps going if the phone disconnects.
- **Four modes:** Stargazing (Tonight's Best, GOTO, automatic initialization on the first GoTo, auto-stacking at 10 s, Stop saves to the album), Milky Way (63° wide camera, SkyAtlas framing, photo / wide-angle stacking / star trails, constellation lines), Solar System (the Sun with the full solar-filter procedure and safety stop, Moon, planets, 1×/2×/4× magnification) and Scenery (birds and landscapes, 15 m focus limit of the telephoto lens).
- **EQ mode:** set-up checklist, wedge angle and north alignment, "calculate polar alignment error" (within 1°), green light, almost no field rotation, no zenith blind spot.
- **Cameras and filters:** telephoto (2160 × 3840 portrait, 2.8°) and wide-angle (63°); UV/IR-cut, Duo-Band and Dark filters; joystick speeds from 8× to 1440× sidereal; tap-twice "GO" in the wide view.
- **Conditions from the manual:** light pollution, twilight, Moon glare, clouds, dew heater, temperature range and cold-battery loss, wind above Force 3, vibration from bumping the tripod, trees/buildings hiding the sky.
- **Album:** device and phone ("Saved") tabs, storage use, JPEG and FITS download, video clips (WebM in the browser).
- **Learn tab:** specifications, the manual's safety reminders and observing tips, and one-click scenarios.
- **Phones and tablets:** works in portrait and landscape. On a phone the 3D model and the camera's live view share one slot with a switch button (the Device tab shows the 3D unit so you can watch the lights; other tabs show the live view). Touch: press-and-hold the on-screen power button, hold the joystick arrows, tap twice to GO in the wide view, one finger to orbit the 3D model and two fingers to zoom. Buttons are enlarged for fingers, form text is 16 px so iPhones do not zoom the page, and the layout respects notches. Graphics **Auto / High / Fast** (top bar) switches shadows off on slower phones.

The numbers (sensitivity, noise, rates) are a teaching model tuned to look and behave plausibly; they are not measurements of a real unit. Pointing the telephoto lens at the Sun without the solar filter permanently damages the simulated sensor, as the manual warns.
