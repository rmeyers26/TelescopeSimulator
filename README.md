# TelescopeSimulator

Interactive 3D simulator of a Celestron C11 on a CPC Deluxe HD–style fork mount, in a single self-contained file (`index.html`, Three.js r128 loaded from a CDN).

## Run
Open `index.html` in a modern browser (or serve the folder with `python3 -m http.server`).

## Features
- Orbit / walk camera, Front · Rear · Left · Right · Top views, exploded and cutaway views, per-part Info and drill-down.
- **Setup guide** tab: 12 steps based on the CPC Deluxe HD and EdgeHD manuals (tripod, mounting, clutches, diagonal, eyepiece, finderscope, hand control, power, alignment). Parts appear as you install them.
- **Labels** toggle: numbered callouts from the CPC manual (Figure 3) and lettered ports A–F on the base panel.
- NexStar+ hand controller (on-screen, pressable 3D handset, keyboard): 16-character scrolling LCD, ALIGN, ENTER, BACK, SCROLL (hold to scroll fast, ⇕ indicator), Solar System / Stars (bright, double, variable, constellations, asterisms, SAO) / Deep Sky (best of, Messier, NGC, alphabetical), IDENTIFY, SKY TOUR, OBJECT INFO, OPTION, HELP, MOTOR SPEED, MENU (tracking, Allow Sun, UP/DOWN reversal, user objects), double-button max-speed slew.
- Sky chart, eyepiece view, realistic Saturn, StarSense-style AutoAlign, dew shield, Telrad, finder, cinematic mode.
- Driver abstraction (`SimDriver`, `TelescopeDriver`, `NexStarSerialDriver` stub) for future hardware.

## Notes
Simulation only. Pluto, constellation and asterism positions are approximate; the Messier list is complete, NGC/SAO are a small subset. RS-232 is not simulated.
