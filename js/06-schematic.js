/* Telescope Simulator – 06-schematic.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   6. SCHEMATIC / OPTICS DIAGRAM (inline SVG)
   ===================================================================== */
function schem(sel,rays){
  const X=z=>200+z*280,Y=h=>85-h*280,c=id=>`class="sp${sel===id?' sel':''}" data-p="${id}"`;
  let s='<svg viewBox="0 0 360 200" class="sch">';
  s+=`<rect ${c('dew')} x="26" y="41" width="96" height="88" fill-opacity=".5" stroke-dasharray="4 3"/>`;
  s+=`<rect ${c('tube')} x="122" y="43" width="138" height="84"/>`;
  s+=`<rect ${c('dovetail')} x="150" y="37" width="100" height="6"/>`;
  s+=`<rect ${c('starsense')} x="128" y="22" width="26" height="15" rx="3"/>`;
  s+=`<rect ${c('telrad')} x="158" y="22" width="42" height="15" rx="2"/>`;
  s+=`<rect ${c('finder')} x="206" y="14" width="66" height="16" rx="3"/><line x1="220" y1="30" x2="220" y2="43" stroke="#5d6b93"/><line x1="250" y1="30" x2="250" y2="43" stroke="#5d6b93"/>`;
  s+=`<rect ${c('corrector')} x="120" y="46" width="4" height="78"/>`;
  s+=`<rect ${c('secondary')} x="114" y="72" width="20" height="26" rx="2"/>`;
  s+=`<path ${c('primary')} d="M250 46 Q259 85 250 124" fill="none" stroke-width="6"/>`;
  s+=`<rect ${c('baffle')} x="205" y="77" width="80" height="16" fill="none"/>`;
  s+=`<polygon ${c('rearcell')} points="260,43 281,65 281,105 260,127"/>`;
  s+=`<rect ${c('focuser')} x="289" y="103" width="12" height="12" rx="3"/>`;
  s+=`<rect ${c('visualback')} x="289" y="74" width="14" height="22"/>`;
  s+=`<rect ${c('diagonal')} x="303" y="74" width="18" height="22"/><rect ${c('diagonal')} x="307" y="56" width="10" height="20"/>`;
  s+=`<rect ${c('eyepiece')} x="304" y="26" width="16" height="32" rx="3"/>`;
  s+=`<rect ${c('fork')} x="188" y="85" width="24" height="86" rx="4" fill-opacity=".8"/>`;
  s+=`<rect ${c('fork')} x="160" y="171" width="80" height="12" rx="3"/>`;
  s+=`<path ${c('tripod')} d="M200 183 L140 200 M200 183 L260 200 M200 183 L200 200" fill="none" stroke-width="3"/>`;
  s+=`<rect ${c('handset')} x="222" y="132" width="12" height="22" rx="2"/>`;
  if(rays){[.07,-.07,.12,-.12].forEach(h=>{const p=rayPath(h);s+=`<polyline class="ray" stroke="${h>0?'#ffd54a':'#6ad0ff'}" points="${p.map(q=>X(q[0]).toFixed(1)+','+Y(q[1]).toFixed(1)).join(' ')}"/>`;});
    s+=`<text x="30" y="150">1 Light enters via corrector</text><text x="30" y="160">2 Reflects from primary</text><text x="30" y="170">3 Secondary sends it back</text><text x="30" y="180">4 Exits through primary hole to diagonal</text>`;}
  return s+'</svg>';
}

