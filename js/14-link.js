/* Telescope Simulator – 14-link.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   12. LINK TAB (future hardware integration)
   ===================================================================== */
$('#p-link').innerHTML=`<h2>Hardware link <span class="chip">SIMULATED</span></h2>
<p>The 3D view and hand controller never talk to the scope directly. They call a <code>TelescopeDriver</code> interface. Today a <code>SimDriver</code> answers. A future <code>NexStarSerialDriver</code> would send real commands with the same calls.</p>
<div class="tb"><b>Mode</b><br><button class="b sm on">Simulation (active)</button> <button class="b sm" disabled title="Not available in this page">Hardware (disabled)</button><p class="sm mu">This page runs in a sandbox with no serial/USB access, so hardware mode is deliberately disabled. When a hardware driver is added, the HUD badge turns red (“LIVE HARDWARE”) and every motion command needs an explicit confirmation.</p></div>
<h3>Architecture</h3>
<pre>UI (3D view · hand controller · sky)
        │ calls only the driver API
        ▼
TelescopeDriver
 ├─ SimDriver            (this page)
 ├─ NexStarSerialDriver  (Web Serial / USB-serial bridge)
 ├─ CPWI bridge          (Celestron PWI software)
 └─ ASCOM Alpaca / INDI  (network)</pre>
<h3>Driver API in this code</h3>
<pre>state()  gotoRaDec(ra,dec)  setManual(az,alt,rate)
stop()  home()  park()  unpark()
setTracking(mode)  addAlignPoint(obj)  clearAlign()
update(dt)</pre>
<h3>NexStar serial commands (reference)</h3>
<table>${NEXSTAR_CMDS.map(c=>`<tr><td><code>${c[0]}</code></td><td>${c[1]}</td></tr>`).join('')}</table>
<p class="sm mu">Listed from memory of the commonly published NexStar protocol; verify against Celestron’s current protocol document before wiring any hardware.</p>
<h3>Safety rules for any real driver</h3>
<ul><li>Visible live-hardware mode indicator at all times, different colour from simulation.</li><li>Confirm before the first slew and before large GoTo moves; a one-key Stop that always works.</li><li>Never send a simulated command to hardware or the reverse: one driver is active at a time.</li><li>Keep Sun GoTo and solar tracking behind a solar-filter confirmation.</li></ul>
<h3>Simulation notes</h3>
<ul><li>Alignment uses an offset-only model (hidden mount error is a fixed offset). Real two-star alignment also solves for tilt.</li><li>Simulated slew speeds up to 5°/s.</li><li>Moon, Sun and planets use low-precision formulas.</li></ul>`;

