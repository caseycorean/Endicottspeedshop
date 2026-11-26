// ESS Suspension V2 — page behaviour. One state object drives drag, keyboard, sliders, typed values and reset.
// Order of priorities (owner, 26 Nov): reliable engineering, recognizable consistent drawings, direct manipulation,
// meaningful interpretation, then onward discovery.
import { architectures, galleryOrder, pointNames, movable, TRAVEL, ROLL, BOUNDS, STATUS, defaults, defaultEnd, cleanState,
  planarGeometry, liveLinks, isEdited, planarSolver, liveSolver, vehicleChoice, vehicleList, chassisDims, encodeState, decodeState } from './model.mjs';
import { planarSvg, planarTopSvg, liveSvg, illustrationSvg, chartSvg, planarMap, liveMap, PLANAR, LIVE } from './draw.mjs';
import { interpret, rideHeightGeometry, KINDS, RC_EXTREME } from '../../engine/linkage.mjs';
import { attachHandles } from '../manipulate.mjs';
import { format, parse, inputValue, unitLabel, unitsControl, bindUnitControls, canonicalStep, getUnits } from '../units.mjs';
import { rollSteerMeaning } from '../rear-link-insights.mjs';

const KEY = 'ess.suspension-v2.v1';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = (v, o = {}) => format('length', v, { digits: 2, metricDigits: 0, ...o });
const A = (v, o = {}) => format('angle', v, { digits: 2, ...o });
const statusText = { ok: 'Valid geometry', caution: 'Valid, worth checking', limit: 'Mechanical limit', invalid: 'Not a buildable layout', failure: 'Solver failure' };

function load() {
  const hash = location.hash.match(/v2=([A-Za-z0-9+/]+)/);
  if (hash) { const s = decodeState(hash[1]); if (s) return s; }
  try { return cleanState(JSON.parse(sessionStorage.getItem(KEY))); } catch { return defaults(); }
}
function save(s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* fine */ } }

// ---------------------------------------------------------------- derived engineering for one end
function planarState(st, end) {
  const e = st[end], a = architectures[end][e.arch], solver = planarSolver(e, end);
  const reach = solver.reach ? { lo: Math.max(-TRAVEL, solver.reach.droop?.travel ?? -TRAVEL), hi: Math.min(TRAVEL, solver.reach.bump?.travel ?? TRAVEL) } : { lo: 0, hi: 0 };
  const travel = Math.min(reach.hi, Math.max(reach.lo, e.travel));
  const now = solver.valid ? solver.at(travel) : solver.at(0);
  const zero = solver.at(0);
  const notes = now.status === STATUS.ok ? interpret(solver, now) : [];
  const status = now.status !== STATUS.ok ? now.status : notes.some(n => n.level === STATUS.caution) ? STATUS.caution : STATUS.ok;
  // reference: the original example at the same travel when edited; ride height when only travel moved
  const edited = isEdited(e);
  let base = null, baseLabel = '';
  if (edited) {
    const orig = planarSolver(defaultEnd(e.arch), end);
    const r = orig.at(Math.min(orig.reach?.bump?.travel ?? TRAVEL, Math.max(orig.reach?.droop?.travel ?? -TRAVEL, travel)));
    if (r.status === STATUS.ok) { base = r; baseLabel = 'Reference: original example'; }
  } else if (Math.abs(travel) > 1e-9 && zero.status === STATUS.ok) { base = zero; baseLabel = 'Reference: ride height'; }
  return { kind: a.kind, solver, reach, travel, now, zero, notes, status, base, baseLabel, edited, g: planarGeometry(e, end) };
}

function liveReach(solver) {
  const probe = (key, max, step) => {
    let lo = 0, hi = 0;
    for (const dir of [1, -1]) {
      let last = 0;
      for (let v = step; v <= max + 1e-9; v += step) {
        const r = solver.at(key === 'heave' ? { heave: dir * v } : { roll: dir * v });
        if (r.status === STATUS.ok || r.status === STATUS.caution) last = dir * v; else break;
      }
      if (dir > 0) hi = last; else lo = last;
    }
    return { lo, hi };
  };
  return { heave: probe('heave', TRAVEL, .25), roll: probe('roll', ROLL, .5) };
}
const reachMemo = new WeakMap();
function liveState(st, end, { fast = false } = {}) {
  const e = st[end], solver = liveSolver(e, end), links = liveLinks(e, end);
  if (!solver.valid) return { solver, links, now: solver.at({}), status: STATUS.invalid, reach: null };
  let reach = reachMemo.get(solver);
  if (!reach && !fast) { reach = liveReach(solver); reachMemo.set(solver, reach); }
  const rr = reach ?? { heave: { lo: -TRAVEL, hi: TRAVEL }, roll: { lo: -ROLL, hi: ROLL } };
  const heave = Math.min(rr.heave.hi, Math.max(rr.heave.lo, e.travel)), roll = Math.min(rr.roll.hi, Math.max(rr.roll.lo, e.roll));
  let now = solver.at({ heave, roll });
  if (now.status === STATUS.limit || now.status === STATUS.failure) now = { ...now, shown: solver.at({}) };
  const dims = chassisDims(st);
  const zeroRoll = Math.abs(roll) < 1e-9 && now.pose ? now : solver.at({ heave });
  const side = zeroRoll.pose ? solver.sideView(zeroRoll, dims) : null;
  const deriv = now.pose && !fast ? solver.derivatives(now) : null;
  const edited = isEdited(e);
  let base = null, baseLabel = '';
  if (edited) { const o = liveSolver(defaultEnd(e.arch), end).at({ heave, roll }); if (o.pose) { base = o; baseLabel = 'Reference: original example'; } }
  else if ((heave || roll) && now.pose) { base = solver.at({}); baseLabel = 'Reference: ride height'; }
  return { solver, links, now, heave, roll, reach, side, deriv, dims, status: now.status, base, baseLabel, edited };
}

// ---------------------------------------------------------------- HTML
function galleryHtml(st, end) {
  const cur = st[end].arch;
  const v = st.vehicle && vehicleChoice(st.vehicle);
  const vehicleCode = v ? (end === 'front' ? v.frontCode : v.rearCode) : null;
  return `<div class="v2-gallery" role="radiogroup" aria-label="${end === 'front' ? 'Front' : 'Rear'} suspension type">${galleryOrder[end].map(code => {
    const a = architectures[end][code];
    const pic = thumbSvg(end, code);
    return `<button type="button" role="radio" class="v2-card${code === cur ? ' on' : ''}" aria-checked="${code === cur}" data-arch="${code}">
      <span class="v2-thumb">${pic}</span><span class="v2-card-name">${esc(a.name)}</span>
      ${a.model ? (a.equivalent ? '<span class="v2-chip eq">Equivalent model</span>' : '') : '<span class="v2-chip ill">Illustration only</span>'}
      ${code === vehicleCode ? '<span class="v2-chip car">This car’s type</span>' : ''}</button>`;
  }).join('')}</div>`;
}
function thumbSvg(end, code) {
  const a = architectures[end][code];
  if (!a.model) return illustrationSvg(code, { thumb: true });
  if (a.model === 'live') return liveSvg({ view: 'top', links: liveLinks(defaultEnd(code), end), result: null, thumb: true });
  const s = planarSolver(defaultEnd(code), end).at(0);
  return planarSvg({ kind: a.kind, end, result: s, radius: a.preset.tireRadius, thumb: true });
}

function provenanceHtml(st, end, edited) {
  const a = architectures[end][st[end].arch];
  const v = st.vehicle && vehicleChoice(st.vehicle);
  const code = v && (end === 'front' ? v.frontCode : v.rearCode);
  const fromCar = v && code === st[end].arch;
  return `<p class="v2-prov">${edited
    ? '<b data-prov="user">Your geometry</b> Edited from the generic example. Not verified vehicle data: results are only as good as the points you enter.'
    : '<b data-prov="example">Generic example</b> Educational mounting points, not measured from any car.'}
    ${fromCar ? ` <span class="v2-prov-car">${esc(v.name)} uses this suspension type; ESS has no measured mounting points for it.</span>` : ''}
    ${a.equivalent ? `<span class="v2-prov-eq">${esc(a.equivalent)}</span>` : ''}</p>`;
}

function field(id, label, value, attrs, unit = unitLabel('length')) {
  return `<div class="v2-field"><label for="${id}">${esc(label)}</label><div class="v2-input"><input id="${id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(value)}" ${attrs}><span>${esc(unit)}</span></div><small class="v2-err" data-err-for="${id}" role="alert"></small></div>`;
}

function travelControl(id, label, value, reach, max, q, ends) {
  const lo = ((reach.lo + max) / (2 * max) * 100).toFixed(1), hi = ((reach.hi + max) / (2 * max) * 100).toFixed(1);
  const unit = q === 'angle' ? '°' : unitLabel('length');
  const shown = q === 'angle' ? value.toFixed(2) : inputValue('length', value, { us: 2, metric: 0 });
  return `<div class="v2-travel"><div class="v2-travel-head"><label for="${id}">${esc(label)}</label>
      <div class="v2-input sm"><input id="${id}-n" type="text" inputmode="decimal" value="${esc(shown)}" data-${id}-n aria-label="${esc(label)} value"><span>${esc(unit)}</span></div></div>
    <input id="${id}" type="range" min="${-max}" max="${max}" step="${q === 'angle' ? .25 : .05}" value="${value}" data-${id} style="--lo:${lo}%;--hi:${hi}%" aria-valuetext="${esc(q === 'angle' ? A(value) : L(value, { signed: true }))}">
    <div class="v2-travel-ends"><span>${ends[0]}</span><span class="v2-reach">${reach.lo > -max + 1e-6 || reach.hi < max - 1e-6 ? `Reachable ${q === 'angle' ? A(reach.lo) : L(reach.lo, { signed: true })} to ${q === 'angle' ? A(reach.hi, { signed: true }) : L(reach.hi, { signed: true })}` : ''}</span><span>${ends[1]}</span></div></div>`;
}

function banner(status, text) {
  return `<div class="v2-status" data-status="${status}" role="status"><b>${statusText[status]}</b> <span>${esc(text)}</span></div>`;
}

// ---------------------------------------------------------------- planar end
function planarHtml(st, end, D) {
  const e = st[end], a = architectures[end][e.arch];
  const sel = movable[a.kind].includes(st.ui?.[end]?.point) ? st.ui[end].point : movable[a.kind][0];
  const g = D.g;
  return `${provenanceHtml(st, end, D.edited)}
    <div data-v2-banner>${planarBanner(D)}</div>
    <div class="v2-work">
      <div class="v2-views" data-count="2">
        <div class="v2-viewtabs" role="tablist" aria-label="Views">
          <button type="button" role="tab" aria-selected="true" data-view="main">${end === 'front' ? 'Front view' : 'Rear view'}</button>
          <button type="button" role="tab" aria-selected="false" data-view="top">Top view</button></div>
        <figure class="v2-view on" data-view-panel="main"><div class="dm-stage v2-stage" data-stage="main">${planarPicture(st, end, D)}<div class="dm-layer" data-layer="main"></div></div>
          <figcaption>${end === 'front' ? 'Left front corner seen from ahead of the car' : 'Left rear corner seen from behind the car'}. Drag a pivot or ball joint; drag the wheel center up or down for travel.</figcaption></figure>
        <figure class="v2-view" data-view-panel="top">${planarTopSvg({ kind: a.kind, end })}<figcaption>Orientation only. ESS models this suspension in ${end === 'front' ? 'front' : 'rear'} view; fore/aft mounting positions are not modelled.</figcaption></figure>
      </div>
      <div class="v2-side">
        ${travelControl('travel', 'Wheel travel', D.travel, D.reach, TRAVEL, 'length', ['← Droop (rebound)', 'Bump (compression) →'])}
        <div class="v2-readout" data-v2-readout>${planarReadout(D)}</div>
        <div class="v2-notes" data-v2-notes>${notesHtml(D.notes)}</div>
      </div>
    </div>
    <div class="v2-charts" data-v2-charts>${planarCharts(D, end, st)}</div>
    <div class="v2-tools">
      <section class="v2-box"><h3>Edit a mounting point exactly</h3>
        <label class="v2-pick"><span>Point</span><select data-point>${movable[a.kind].map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(pointNames[k])}</option>`).join('')}</select></label>
        <div class="v2-pair">${field('pt-y', 'Outboard from centerline', inputValue('length', g[sel][0], { us: 2, metric: 0 }), 'data-pt="0"')}${field('pt-z', 'Height above road', inputValue('length', g[sel][1], { us: 2, metric: 0 }), 'data-pt="1"')}</div>
        <p class="v2-small">At ride height. Type in either system: “25.5”, “648 mm” or “25.5 in”. Keyboard on the drawing: Tab to a point, arrows move it (Shift ×10, Alt fine), Home puts it back.</p>
        <div class="v2-actions"><button type="button" class="button secondary small" data-reset>Reset to the generic example</button>
          <label class="v2-check"><input type="checkbox" data-overlay ${st.overlay ? 'checked' : ''}> Show reference outline</label></div>
      </section>
      <section class="v2-box"><h3>Raise or lower the car</h3>
        <p class="v2-small">Arm lengths stay the same. Choose how the change is made, preview it, then apply it as your new ride height.</p>
        <div class="v2-pair">${field('rh', 'Ride-height change (+ raise, − lower)', st.ui?.[end]?.rh ?? '-1', 'data-rh')}
          <label class="v2-pick"><span>Made with</span><select data-rh-mode>
            <option value="springs" ${st.ui?.[end]?.rhMode !== 'spindle' ? 'selected' : ''}>Springs only (arm angles change)</option>
            <option value="spindle" ${st.ui?.[end]?.rhMode === 'spindle' ? 'selected' : ''}>Keep arm angles (drop spindle or relocated mounts)</option></select></label></div>
        <p class="v2-rh-preview" data-rh-preview aria-live="polite"></p>
        <button type="button" class="button small" data-rh-apply>Apply as new ride height</button>
        ${e.history.length ? `<p class="v2-small">Applied: ${e.history.map(esc).join(' · ')}</p>` : ''}
      </section>
    </div>
    <details class="v2-explain"><summary>What this model includes and leaves out</summary>
      <p>Two-dimensional ${end === 'front' ? 'front' : 'rear'} view of one corner with the body held still and the road moving with travel (both wheels moving together). Arms are rigid at the lengths you draw; bushings, steering, caster, kingpin inclination and toe are not modelled. The solver follows the linkage continuously from ride height and keeps its original assembly, so it never jumps to a different way the parts could fit together. Every answer is re-measured: if a link length or the requested height does not check out, the result is withheld and marked as a solver failure.</p>
      <p><b>Roll center</b>: where the line from the tire contact patch through the arms' instant center crosses the car's centerline. <b>Valid but worth checking</b> means the geometry is buildable but has a property most designers avoid, explained in the notes. <b>Mechanical limit</b> means the parts physically stop the wheel (arms fully stretched or folded, a toggle position, arms colliding, or the end of the arm's arc). The tire is drawn at a constant loaded radius.</p></details>`;
}
function planarPicture(st, end, D) {
  const a = architectures[end][st[end].arch];
  if (!D.solver.valid) return planarSvg({ kind: a.kind, end, result: null, invalidPts: D.g, invalidCamber: D.g.staticCamber, radius: a.preset.tireRadius });
  const shown = D.now.status === STATUS.ok ? D.now : D.zero.status === STATUS.ok ? D.zero : null;
  return planarSvg({ kind: a.kind, end, result: shown, base: st.overlay ? D.base : null, overlayLabel: D.baseLabel, radius: a.preset.tireRadius });
}
function planarBanner(D) {
  if (!D.solver.valid) return banner(STATUS.invalid, D.solver.issues.map(i => i.text).join(' ') + ' Keep editing: results return as soon as the layout can be built.');
  if (D.now.status === STATUS.failure) return banner(STATUS.failure, D.now.reason);
  if (D.now.status === STATUS.limit) return banner(STATUS.limit, D.now.reason);
  const lim = [];
  if (D.reach.lo > -TRAVEL + 1e-6) lim.push(`droop stops at ${L(D.reach.lo, { signed: true })} (${D.solver.reach.droop.text})`);
  if (D.reach.hi < TRAVEL - 1e-6) lim.push(`bump stops at ${L(D.reach.hi, { signed: true })} (${D.solver.reach.bump.text})`);
  const tail = lim.length ? ` Travel is limited: ${lim.join('; ')}.` : '';
  if (D.status === STATUS.caution) return banner(STATUS.caution, 'The linkage works, but see the notes below.' + tail);
  return banner(lim.length ? STATUS.caution : STATUS.ok, (lim.length ? 'The linkage works within its reach.' : 'Every link keeps its length through ±4 in of travel.') + tail);
}
function planarReadout(D) {
  if (!D.solver.valid || D.now.status !== STATUS.ok) return '<p class="v2-empty">Results withheld until the geometry solves.</p>';
  const n = D.now, z = D.zero, s = D.solver;
  const a = s.at(Math.max(D.reach.lo, n.travel - .25)), b = s.at(Math.min(D.reach.hi, n.travel + .25));
  const dt = b.travel - a.travel;
  const gain = a.status === STATUS.ok && b.status === STATUS.ok && dt > 0 ? (b.camber - a.camber) / dt : null;
  const mig = a.status === STATUS.ok && b.status === STATUS.ok && dt > 0 ? (b.rollCentreHeight - a.rollCentreHeight) / dt : null;
  const metric = getUnits() === 'metric';
  const perIn = metric ? 'per 25 mm' : 'per in';
  const k = metric ? 25 / 25.4 : 1;
  const row = (t, v, sm = '') => `<div><dt>${t}</dt><dd>${v}${sm ? ` <small>${sm}</small>` : ''}</dd></div>`;
  return `<dl>
    ${row('Camber', A(n.camber), `${A(n.camberChange, { signed: true })} from ride height`)}
    ${row('Camber gain', Number.isFinite(gain) ? `${A(gain * k, { signed: true })} ${perIn}` : '—', gain < -.05 ? 'top of tire tips in as it compresses' : gain > .05 ? 'top of tire tips out as it compresses' : 'nearly constant camber')}
    ${row('Roll center', !Number.isFinite(n.rollCentreHeight) ? 'undefined' : Math.abs(n.rollCentreHeight) > RC_EXTREME ? 'extremely sensitive' : L(n.rollCentreHeight, { digits: 1 }), `${Math.abs(z.rollCentreHeight) > RC_EXTREME ? 'extremely sensitive' : L(z.rollCentreHeight, { digits: 1 })} at ride height`)}
    ${row('Roll center movement', Number.isFinite(mig) && Math.abs(a.rollCentreHeight) <= RC_EXTREME && Math.abs(b.rollCentreHeight) <= RC_EXTREME ? `${L(mig * k, { signed: true })} ${perIn}` : '—', 'vertical, as the suspension moves')}
    ${row('Track change', L(n.trackChange, { signed: true }), 'both sides together')}
    ${row('Swing-arm length', Number.isFinite(n.swingArm) && n.swingArm < 2000 ? L(n.swingArm, { digits: 0 }) : 'very long (near-parallel arms)')}
    ${Number.isFinite(n.strutLengthChange) ? row('Strut length change', L(n.strutLengthChange, { signed: true }), 'compresses in bump') : ''}
    ${Number.isFinite(n.ballJointLower) ? row('Ball-joint rotation', `${Math.abs(n.ballJointLower).toFixed(0)}° lower · ${Math.abs(n.ballJointUpper).toFixed(0)}° upper`, 'from ride height') : ''}
  </dl>`;
}
function notesHtml(notes) {
  if (!notes?.length) return '';
  return `<ul>${notes.map(n => `<li data-level="${n.level}">${esc(n.text)}</li>`).join('')}</ul>`;
}
function planarCharts(D, end, st) {
  if (!D.solver.valid) return '';
  const rows = [], baseRows = [];
  const orig = D.edited ? planarSolver(defaultEnd(st[end].arch), end) : null;
  for (let t = -TRAVEL; t <= TRAVEL + 1e-9; t += .2) {
    const tt = +t.toFixed(2);
    const r = tt < D.reach.lo - 1e-9 || tt > D.reach.hi + 1e-9 ? null : D.solver.at(tt);
    const ok = r?.status === STATUS.ok;
    rows.push({ t: tt, r: ok ? r : null, status: ok && interpret(D.solver, r).some(n => n.level === STATUS.caution && n.code !== 'near-limit') ? 'caution' : 'ok' });
    if (orig) { const o = orig.at(tt); baseRows.push({ t: tt, r: o.status === STATUS.ok ? o : null }); }
  }
  const shown = (key, r) => !r ? NaN : key === 'rollCentreHeight' && Math.abs(r[key]) > RC_EXTREME ? NaN : r[key];
  const series = key => rows.map(x => ({ t: x.t, y: shown(key, x.r), status: x.r && key === 'rollCentreHeight' && Math.abs(x.r[key]) > RC_EXTREME ? 'caution' : x.status }));
  const bs = key => baseRows.map(x => ({ t: x.t, y: shown(key, x.r) }));
  const nowPt = key => D.now.status === STATUS.ok && Number.isFinite(shown(key, D.now)) ? { t: D.travel, y: D.now[key] } : null;
  const metric = getUnits() === 'metric', k = metric ? 25.4 : 1, lu = metric ? 'mm' : 'in';
  const conv = list => list.map(p => p && ({ ...p, y: p.y * k }));
  return chartSvg({ title: 'Camber', unit: '°', rows: series('camber'), base: bs('camber'), reach: D.reach, now: nowPt('camber'), span: .5 })
    + chartSvg({ title: 'Roll center height', unit: lu, rows: conv(series('rollCentreHeight')), base: conv(bs('rollCentreHeight')), reach: D.reach, now: nowPt('rollCentreHeight') && conv([nowPt('rollCentreHeight')])[0], span: k, digits: metric ? 0 : 1 })
    + chartSvg({ title: 'Track change', unit: lu, rows: conv(series('trackChange')), base: conv(bs('trackChange')), reach: D.reach, now: nowPt('trackChange') && conv([nowPt('trackChange')])[0], span: .2 * k, digits: metric ? 0 : 2 })
    + `<p class="v2-small v2-chart-key">Blue: this geometry. Dashed gray: original example. Amber bands: valid but worth checking. Hatched: the linkage cannot reach.</p>`;
}

// ---------------------------------------------------------------- live axle end
function liveHtml(st, end, D) {
  const e = st[end];
  const sel = Math.min(st.ui?.[end]?.link ?? 0, D.links.length - 1);
  const l = D.links[sel];
  const which = st.ui?.[end]?.endpt === 'axle' || l.group === 'slider' ? 'axle' : 'chassis';
  const p = which === 'axle' ? l.axle : l.chassis;
  const views = ['top', 'side', 'rear'];
  const names = { top: 'Top view', side: 'Side view', rear: 'Rear view' };
  const caps = { top: 'Seen from above, front to the right. Tap a link to select it; drag its ends.', side: 'Seen from the left side, front to the right. Drag the axle center for travel or a selected link end.', rear: 'Seen from behind. Drag the Panhard bar ends or the axle center.' };
  const reach = D.reach ?? { heave: { lo: -TRAVEL, hi: TRAVEL }, roll: { lo: -ROLL, hi: ROLL } };
  return `${provenanceHtml(st, end, D.edited)}
    <div data-v2-banner>${liveBanner(D)}</div>
    <div class="v2-work">
      <div class="v2-views" data-count="3">
        <div class="v2-viewtabs" role="tablist" aria-label="Views">${views.map((v, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-view="${v}">${names[v]}</button>`).join('')}</div>
        ${views.map((v, i) => `<figure class="v2-view${i === 0 ? ' on' : ''}" data-view-panel="${v}"><div class="dm-stage v2-stage" data-stage="${v}">${livePicture(st, end, D, v, sel)}<div class="dm-layer" data-layer="${v}"></div></div><figcaption>${caps[v]}</figcaption></figure>`).join('')}
      </div>
      <div class="v2-side">
        ${travelControl('travel', 'Axle travel', D.heave, reach.heave, TRAVEL, 'length', ['← Droop (rebound)', 'Bump (compression) →'])}
        ${travelControl('roll', 'Body roll relative to the axle', D.roll, reach.roll, ROLL, 'angle', ['← Left turn', 'Right turn →'])}
        <div class="v2-readout" data-v2-readout>${liveReadout(D)}</div>
        <div class="v2-notes" data-v2-notes>${liveNotes(D)}</div>
      </div>
    </div>
    <div class="v2-charts" data-v2-charts>${D.reach ? liveCharts(D, st, end) : ''}</div>
    <div class="v2-tools">
      <section class="v2-box"><h3>Edit a mounting point exactly</h3>
        <div class="v2-pair"><label class="v2-pick"><span>Link</span><select data-link-pick>${D.links.map((x, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="v2-pick"><span>End</span><select data-end-pick ${l.group === 'slider' ? 'disabled' : ''}><option value="chassis" ${which === 'chassis' ? 'selected' : ''}>Chassis mount</option><option value="axle" ${which === 'axle' ? 'selected' : ''}>${l.group === 'slider' ? 'Arm nose' : 'Axle mount'}</option></select></label></div>
        <div class="v2-triple">${field('lk-x', 'Forward of axle center', inputValue('length', p[0], { us: 2, metric: 0 }), 'data-lk="0"')}${field('lk-y', 'Right of centerline', inputValue('length', p[1], { us: 2, metric: 0 }), 'data-lk="1"')}${field('lk-z', 'Height above road', inputValue('length', p[2], { us: 2, metric: 0 }), 'data-lk="2"')}</div>
        <p class="v2-small">At ride height. Link lengths are set from these coordinates.</p>
        <div class="v2-actions"><button type="button" class="button secondary small" data-reset>Reset to the generic example</button>
          <label class="v2-check"><input type="checkbox" data-overlay ${st.overlay ? 'checked' : ''}> Show reference outline</label></div>
      </section>
      <section class="v2-box"><h3>Car used for anti-squat</h3><p class="v2-small">${esc(D.dims.source)}. Wheelbase and CG height are vehicle data; the link positions are not.</p></section>
    </div>
    <details class="v2-explain"><summary>What this model includes and leaves out</summary>
      <p>A rigid axle on rigid links. You set the axle's height and its roll relative to the body; the solver finds where it must move fore/aft and sideways, and how it pitches and steers, so every link keeps its length. It gets there in small steps from ride height so it stays on the layout you drew. A layout with more links than the axle has freedom (parallel four-link plus Panhard bar) cannot move in roll without the bushings deflecting: the page reports how much. Bushing compliance, the lower links' own twist, and spring and shock forces are not modelled.</p>
      <p><b>Anti-squat</b>: the side-view line from the tire contact patch to the instant center, compared with the line to the CG height above the front axle (dashed, labelled 100%). Above 100% the rear rises under power; below, it squats. <b>Roll center</b>: the height on the axle about which it rolls relative to the body. <b>Roll steer</b>: degrees the axle steers per degree of roll. <b>Pinion change</b>: how the axle nose rotates per inch of travel, which changes U-joint angles.</p></details>`;
}
function livePicture(st, end, D, view, sel) {
  const shown = D.now.pose ? D.now : D.now.shown?.pose ? D.now.shown : null;
  const hundred = D.dims ? [D.dims.wheelbase * .45, D.dims.cg * .45] : null;
  return liveSvg({ view, links: D.links, result: shown, base: st.overlay ? D.base : null, selected: sel,
    side: D.side ? { ...D.side, hundred } : null, rollCentre: D.deriv?.rollCentre });
}
function liveBanner(D) {
  if (D.status === STATUS.invalid) return banner(STATUS.invalid, (D.solver.issues ?? []).map(i => i.text).join(' ') + ' Keep editing: results return when every link can carry load.');
  const n = D.now;
  if (n.status === STATUS.failure || n.status === STATUS.limit) return banner(n.status, n.reason + ' Showing ride height.');
  const r = D.reach, lim = [];
  if (r) {
    if (r.heave.lo > -TRAVEL + 1e-6 || r.heave.hi < TRAVEL - 1e-6) lim.push(`travel reaches ${L(r.heave.lo, { signed: true })} to ${L(r.heave.hi, { signed: true })}`);
    if (r.roll.lo > -ROLL + 1e-6 || r.roll.hi < ROLL - 1e-6) lim.push(`roll reaches ${A(r.roll.lo)} to ${A(r.roll.hi, { signed: true })}`);
  }
  if (n.status === STATUS.caution) return banner(STATUS.caution, n.reason + (lim.length ? ` Limits: ${lim.join('; ')}.` : ''));
  return banner(lim.length ? STATUS.caution : STATUS.ok, lim.length ? `The links work within their reach: ${lim.join('; ')}.` : 'Every link keeps its length through ±4 in of travel and ±8° of roll.');
}
function liveReadout(D) {
  const n = D.now;
  if (!n.pose) return '<p class="v2-empty">Results withheld until the links can reach this position.</p>';
  const row = (t, v, sm = '') => `<div><dt>${t}</dt><dd>${v}${sm ? ` <small>${sm}</small>` : ''}</dd></div>`;
  const d = D.deriv, s = D.side;
  const metric = getUnits() === 'metric';
  return `<dl>
    ${row('Anti-squat', Number.isFinite(s?.antiSquat) ? `${s.antiSquat.toFixed(0)}%` : '—', s?.parallel ? 'parallel links: instant center at infinity' : 'at zero roll, this travel')}
    ${row('Instant center', s?.ic ? `${L(s.ic[0], { digits: 0 })} ahead, ${L(s.ic[1], { digits: 1 })} high` : 'at infinity')}
    ${row('Roll center', d ? L(d.rollCentre, { digits: 1 }) : '—', 'above the road')}
    ${row('Roll steer', d ? `${(d.rollSteer * 100).toFixed(1)}%` : '—', d ? (d.rollSteer > .01 ? 'steers out of the turn' : d.rollSteer < -.01 ? 'steers into the turn' : 'about neutral') : '')}
    ${row('Pinion change', d ? `${A(d.pinionRate * (metric ? 25 / 25.4 : 1), { signed: true })} ${metric ? 'per 25 mm' : 'per in'}` : '—', 'nose up + in bump')}
    ${row('Axle now', `${A(n.pitch, { signed: true })} pitch · ${A(n.yaw, { signed: true })} steer`, `${L(n.pose[0], { signed: true })} fore/aft · ${L(n.pose[1], { signed: true })} sideways`)}
    ${n.bind > 1e-4 ? row('Link bind', L(n.bind, { digits: 3 }), 'bushing deflection needed') : ''}
  </dl>`;
}
function liveNotes(D) {
  const notes = [];
  const s = D.side, d = D.deriv;
  if (Number.isFinite(s?.antiSquat)) notes.push({ level: 'info', text: s.antiSquat > 100 ? `At ${s.antiSquat.toFixed(0)}% anti-squat the rear rises under power: drive force lifts the body more than load transfer squats it. Common for drag launches; on a road course it can make the rear skittish as power comes on.` : s.antiSquat < 60 ? `At ${s.antiSquat.toFixed(0)}% the rear squats noticeably under power.` : `At ${s.antiSquat.toFixed(0)}% the rear squats a little under power.` });
  if (d) notes.push({ level: Math.abs(d.rollSteer) > .1 ? 'caution' : 'info', text: rollSteerMeaning(d.rollSteer) });
  if (D.now.bind > .005) notes.push({ level: 'caution', text: D.now.reason });
  return notesHtml(notes);
}
function liveCharts(D, st, end) {
  const rows = [], base = [];
  const orig = D.edited ? liveSolver(defaultEnd(st[end].arch), end) : null;
  for (let t = -TRAVEL; t <= TRAVEL + 1e-9; t += .5) {
    const r = t < D.reach.heave.lo - 1e-9 || t > D.reach.heave.hi + 1e-9 ? null : D.solver.at({ heave: t });
    const sv = r?.pose ? D.solver.sideView(r, D.dims) : null, dv = r?.pose ? D.solver.derivatives(r) : null;
    rows.push({ t, as: sv?.antiSquat, pitch: r?.pitch, rc: dv?.rollCentre });
    if (orig) { const o = orig.at({ heave: t }); base.push({ t, as: o.pose ? orig.sideView(o, D.dims)?.antiSquat : NaN, pitch: o.pitch, rc: o.pose ? orig.derivatives(o)?.rollCentre : NaN }); }
  }
  const pick = (list, k, f = 1) => list.map(x => ({ t: x.t, y: Number.isFinite(x[k]) ? x[k] * f : NaN, status: 'ok' }));
  const reach = { lo: D.reach.heave.lo, hi: D.reach.heave.hi };
  const metric = getUnits() === 'metric', k = metric ? 25.4 : 1;
  const nowT = D.heave;
  const at = (list, key, f = 1) => { const r = list.find(x => Math.abs(x.t - nowT) < 1e-9); return r && Number.isFinite(r[key]) ? { t: nowT, y: r[key] * f } : null; };
  return chartSvg({ title: 'Anti-squat', unit: '%', rows: pick(rows, 'as'), base: pick(base, 'as'), reach, now: at(rows, 'as'), span: 10, digits: 0 })
    + chartSvg({ title: 'Pinion angle change', unit: '°', rows: pick(rows, 'pitch'), base: pick(base, 'pitch'), reach, now: at(rows, 'pitch'), span: 1 })
    + chartSvg({ title: 'Roll center height', unit: metric ? 'mm' : 'in', rows: pick(rows, 'rc', k), base: pick(base, 'rc', k), reach, now: at(rows, 'rc', k), span: k, digits: metric ? 0 : 1 })
    + `<p class="v2-small v2-chart-key">At zero roll. Blue: this geometry. Dashed gray: original example. Hatched: the links cannot reach.</p>`;
}

// ---------------------------------------------------------------- illustration-only end
function illustrationHtml(st, end) {
  const a = architectures[end][st[end].arch];
  return `<div data-v2-banner><div class="v2-status" data-status="info" role="status"><b>Illustration only</b> <span>${esc(a.note[0].toUpperCase() + a.note.slice(1))}</span></div></div>
    <figure class="v2-view on v2-ill">${illustrationSvg(st[end].arch)}<figcaption>${esc(a.long)}. Pick a type marked without “Illustration only” to experiment.</figcaption></figure>`;
}

// ---------------------------------------------------------------- page
export function pageHtml(st) {
  const v = st.vehicle && vehicleChoice(st.vehicle);
  return `<section class="v2" data-v2>
    <header class="v2-head"><p class="kicker">Engineering experiments</p><h1>Suspension</h1>
      <p class="lede">Pick a suspension type. The drawing becomes the model: drag its pivots, move the wheel through its travel, and see what changes and why.</p></header>
    <div class="v2-top">
      <label class="v2-pick"><span>Start from a car (sets the suspension type only)</span><select data-vehicle><option value="">No car: choose types yourself</option>${vehicleList().map(x => `<option value="${esc(x.id)}" ${x.id === st.vehicle ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      ${unitsControl('v2-units')}
      <button type="button" class="button secondary small" data-share>Copy a link to this experiment</button><span class="v2-small" data-share-msg aria-live="polite"></span>
    </div>
    ${v ? `<p class="v2-small v2-carline">${esc(v.name)}: ${esc(architectures.front[v.front]?.long ?? (v.frontCode ? v.frontCode + ' front (not available here yet)' : 'front type unknown'))}; ${esc(architectures.rear[v.rear]?.long ?? (v.rearCode ? v.rearCode + ' rear (not available here yet)' : 'rear type unknown'))}. The drawings use ESS's generic example mounting points, not this car's measurements.</p>` : ''}
    <ul class="v2-legend" aria-label="Drawing colors"><li><i style="--c:#3979b9"></i>Lower arms and links</li><li><i style="--c:#d97706"></i>Upper arms and links</li><li><i style="--c:#159a87"></i>Lateral locator</li><li><i style="--c:#64748b"></i>Tire, axle, upright</li><li><i class="ring"></i>Roll center</li><li><i class="dash"></i>Reference or construction line</li></ul>
    <div class="v2-tabs" role="tablist" aria-label="Suspension end"><button type="button" role="tab" data-tab="front" aria-selected="${st.tab === 'front'}">Front suspension</button><button type="button" role="tab" data-tab="rear" aria-selected="${st.tab === 'rear'}">Rear suspension</button></div>
    <div class="v2-panel" data-panel></div>
    <section class="v2-more"><h2>Keep going</h2><ul>
      <li><a href="../experience/#suspension" data-site-link>Springs, ride frequency and roll balance</a> in the Vehicle Lab use the same car.</li>
      <li><a href="../tools/load-transfer/" data-site-link>Load transfer calculator</a>: how roll center height splits cornering load.</li>
      <li><a href="../articles/traction-circle/" data-site-link>The traction circle</a>: why tire load and camber decide grip.</li></ul>
      <p class="v2-small" data-compare-line>Compare with the current suspension lab: <a href="../experience/#suspension" data-site-link data-compare>Vehicle Lab → Suspension</a>.</p></section>
  </section>`;
}

export function mount(root) {
  const st = load();
  st.ui = { front: {}, rear: {} };
  let handles = [];
  const announce = t => { const live = root.querySelector('[data-share-msg]'); if (live) live.textContent = t; };

  function derive(end, opts) {
    const a = architectures[end][st[end].arch];
    return a.model === 'planar' ? planarState(st, end) : a.model === 'live' ? liveState(st, end, opts) : null;
  }
  function persist() { save(st); }

  function renderAll() {
    root.innerHTML = pageHtml(st);
    bindUnitControls(root);
    const base = root.dataset.siteBase;
    if (base) for (const a of root.querySelectorAll('[data-site-link]')) { a.href = base; a.target = '_blank'; a.rel = 'noopener'; }
    root.querySelector('[data-vehicle]').addEventListener('change', ev => {
      st.vehicle = ev.target.value || null;
      const v = st.vehicle && vehicleChoice(st.vehicle);
      if (v?.front && v.front !== st.front.arch) st.front = defaultEnd(v.front);
      if (v?.rear && v.rear !== st.rear.arch) st.rear = defaultEnd(v.rear);
      persist(); renderAll();
    });
    for (const b of root.querySelectorAll('[data-tab]')) b.addEventListener('click', () => { st.tab = b.dataset.tab; persist(); renderAll(); });
    root.querySelector('.v2-tabs').addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      st.tab = st.tab === 'front' ? 'rear' : 'front'; persist(); renderAll(); root.querySelector(`[data-tab="${st.tab}"]`).focus();
    });
    root.querySelector('[data-share]').addEventListener('click', async () => {
      const url = location.href.split('#')[0] + '#v2=' + encodeState(st);
      try { await navigator.clipboard.writeText(url); announce('Link copied. It reproduces this geometry and travel.'); }
      catch { announce('Copy this link: ' + url); }
    });
    renderPanel();
  }

  function renderPanel(focusSel) {
    handles.forEach(h => h.destroy()); handles = [];
    const end = st.tab, panel = root.querySelector('[data-panel]');
    const a = architectures[end][st[end].arch];
    const D = derive(end);
    panel.innerHTML = `<h2 class="v2-h2">${end === 'front' ? 'Front' : 'Rear'} suspension type</h2>${galleryHtml(st, end)}
      <div class="v2-model" data-model><h2 class="v2-h2">${esc(a.long)}</h2>${a.model === 'planar' ? planarHtml(st, end, D) : a.model === 'live' ? liveHtml(st, end, D) : illustrationHtml(st, end)}</div>`;
    panel.querySelector('[data-model]').classList.add('v2-enter');
    requestAnimationFrame(() => panel.querySelector('[data-model]')?.classList.remove('v2-enter'));
    bindPanel(end, a, D);
    if (focusSel) panel.querySelector(focusSel)?.focus();
  }

  // Fast refresh while dragging: pictures, banner, readout, notes; charts on release.
  function refresh(end, { charts = true, fast = false } = {}) {
    const a = architectures[end][st[end].arch], D = derive(end, { fast });
    const panel = root.querySelector('[data-panel]');
    if (a.model === 'planar') {
      panel.querySelector('[data-stage="main"] svg').outerHTML = planarPicture(st, end, D);
      panel.querySelector('[data-v2-banner]').innerHTML = planarBanner(D);
      panel.querySelector('[data-v2-readout]').innerHTML = planarReadout(D);
      panel.querySelector('[data-v2-notes]').innerHTML = notesHtml(D.notes);
      if (charts) panel.querySelector('[data-v2-charts]').innerHTML = planarCharts(D, end, st);
      syncTravel(panel, 'travel', D.travel, D.reach, TRAVEL, 'length');
      if (charts) panel._rhPreview?.();
    } else {
      for (const v of ['top', 'side', 'rear']) panel.querySelector(`[data-stage="${v}"] svg`).outerHTML = livePicture(st, end, D, v, st.ui[end].link ?? 0);
      panel.querySelector('[data-v2-banner]').innerHTML = liveBanner(D);
      panel.querySelector('[data-v2-readout]').innerHTML = liveReadout(D);
      panel.querySelector('[data-v2-notes]').innerHTML = liveNotes(D);
      if (charts && D.reach) panel.querySelector('[data-v2-charts]').innerHTML = liveCharts(D, st, end);
      const r = D.reach ?? { heave: { lo: -TRAVEL, hi: TRAVEL }, roll: { lo: -ROLL, hi: ROLL } };
      syncTravel(panel, 'travel', D.heave, r.heave, TRAVEL, 'length'); syncTravel(panel, 'roll', D.roll, r.roll, ROLL, 'angle');
    }
    const prov = panel.querySelector('.v2-prov');
    if (prov) prov.outerHTML = provenanceHtml(st, end, D.edited);
    handles.forEach(h => h.refresh());
    persist();
    return D;
  }
  function syncTravel(panel, id, value, reach, max, q) {
    const range = panel.querySelector(`[data-${id}]`), num = panel.querySelector(`[data-${id}-n]`);
    if (!range) return;
    range.style.setProperty('--lo', ((reach.lo + max) / (2 * max) * 100).toFixed(1) + '%');
    range.style.setProperty('--hi', ((reach.hi + max) / (2 * max) * 100).toFixed(1) + '%');
    if (document.activeElement !== range) range.value = value;
    if (document.activeElement !== num) num.value = q === 'angle' ? value.toFixed(2) : inputValue('length', value, { us: 2, metric: 0 });
    range.setAttribute('aria-valuetext', q === 'angle' ? A(value) : L(value, { signed: true }));
    const ends = range.parentElement.querySelector('.v2-reach');
    if (ends) ends.textContent = reach.lo > -max + 1e-6 || reach.hi < max - 1e-6 ? `Reachable ${q === 'angle' ? A(reach.lo) : L(reach.lo, { signed: true })} to ${q === 'angle' ? A(reach.hi, { signed: true }) : L(reach.hi, { signed: true })}` : '';
  }

  function bindPanel(end, a, D) {
    const panel = root.querySelector('[data-panel]');
    const e = st[end];
    for (const b of panel.querySelectorAll('[data-arch]')) b.addEventListener('click', () => {
      if (b.dataset.arch === e.arch) return;
      st[end] = defaultEnd(b.dataset.arch); st.ui[end] = {};
      persist(); renderPanel(`[data-arch="${b.dataset.arch}"]`);
      panel.querySelector('[data-model]')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    panel.querySelector('.v2-gallery').addEventListener('keydown', ev => {
      const list = galleryOrder[end], i = list.indexOf(e.arch);
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key]; if (!d) return;
      ev.preventDefault(); const next = list[(i + d + list.length) % list.length];
      st[end] = defaultEnd(next); st.ui[end] = {}; persist(); renderPanel(`[data-arch="${next}"]`);
    });
    if (!a.model) return;
    // view tabs (phone: one view at a time; desktop CSS shows all)
    for (const b of panel.querySelectorAll('[data-view]')) b.addEventListener('click', () => {
      for (const x of panel.querySelectorAll('[data-view]')) x.setAttribute('aria-selected', String(x === b));
      for (const f of panel.querySelectorAll('[data-view-panel]')) f.classList.toggle('on', f.dataset.viewPanel === b.dataset.view);
      handles.forEach(h => h.refresh());
    });
    const ov = panel.querySelector('[data-overlay]');
    ov?.addEventListener('change', () => { st.overlay = ov.checked; refresh(end, { charts: false }); });
    panel.querySelector('[data-reset]')?.addEventListener('click', () => { st[end] = defaultEnd(e.arch); persist(); renderPanel('[data-reset]'); announce('Back to the generic example.'); });
    bindTravel(panel, end, 'travel', TRAVEL, 'length', v => { st[end].travel = v; });
    if (a.model === 'live') bindTravel(panel, end, 'roll', ROLL, 'angle', v => { st[end].roll = v; });
    if (a.model === 'planar') bindPlanar(panel, end, a); else bindLive(panel, end, a);
  }

  function bindTravel(panel, end, id, max, q, set) {
    const range = panel.querySelector(`[data-${id}]`), num = panel.querySelector(`[data-${id}-n]`);
    if (!range) return;
    range.addEventListener('input', () => { set(+range.value); refresh(end, { charts: false, fast: true }); });
    range.addEventListener('change', () => { const D = refresh(end); clampMsg(end, D); });
    num.addEventListener('change', () => {
      const v = q === 'angle' ? Number(num.value.replace('°', '').replace('−', '-')) : parse('length', num.value);
      if (!Number.isFinite(v)) { num.setAttribute('aria-invalid', 'true'); announce('Type a number, for example 1.5 or 38 mm.'); return; }
      num.removeAttribute('aria-invalid');
      set(Math.max(-max, Math.min(max, v))); const D = refresh(end); clampMsg(end, D);
    });
  }
  function clampMsg(end, D) {
    const want = st[end].travel, got = D.travel ?? D.heave;
    if (Number.isFinite(want) && Math.abs(want - got) > 1e-6) announce(`The linkage stops at ${L(got, { signed: true })}; shown there.`);
    if (Number.isFinite(got)) st[end].travel = got;
    if (Number.isFinite(D.roll)) st[end].roll = D.roll;
  }

  // ---- planar handles, point fields and ride height
  function bindPlanar(panel, end, a) {
    const e = st[end];
    const stage = panel.querySelector('[data-stage="main"]'), layer = panel.querySelector('[data-layer="main"]');
    const scale = () => { const svg = stage.querySelector('svg'); const r = svg.getBoundingClientRect(); return r.width / PLANAR.w; };
    const toScreen = p => { const s = scale(), q = planarMap.to(p); return [q[0] * s, q[1] * s]; };
    const toModel = ([x, y]) => { const s = scale(); return planarMap.from([x / s, y / s]); };
    const D0 = () => planarState(st, end);
    const step = () => canonicalStep('length');
    const h = attachHandles(layer, {
      handles: () => {
        const D = D0(), g = D.g;
        const list = movable[a.kind].map(k => ({ id: k, point: g[k], label: pointNames[k], axes: 'xy', step: [step(), step()], selected: st.ui[end].point === k,
          describe: p => `${L(p[0], { digits: 1 })} outboard, ${L(p[1], { digits: 1 })} high` }));
        const wc = D.now.status === STATUS.ok ? D.now.points.wheelCenter : g.wheelCenter;
        list.push({ id: 'wheel', point: wc, label: 'Wheel center (travel)', axes: 'y', step: [step(), step()], describe: () => `${L(D.travel, { signed: true })} of travel` });
        return list;
      },
      toScreen, toModel,
      clamp: (id, p) => [Math.min(BOUNDS.planar.y[1], Math.max(BOUNDS.planar.y[0], p[0])), Math.min(BOUNDS.planar.z[1], Math.max(BOUNDS.planar.z[0], p[1]))],
      onMove: (id, p, phase) => {
        if (id === 'wheel') {
          const z0 = planarGeometry(st[end], end).wheelCenter[1];
          st[end].travel = Math.max(-TRAVEL, Math.min(TRAVEL, p[1] - z0));
        } else {
          if (st[end].travel) { st[end].travel = 0; announce('Showing ride height while you move mounting points.'); }
          st[end].pts[id] = [+p[0].toFixed(3), +p[1].toFixed(3)];
          st.ui[end].point = id;
        }
        const D = refresh(end, { charts: phase !== 'move' });
        if (phase !== 'move') { clampMsg(end, D); syncPointFields(panel, end, a); }
        if (phase !== 'move' && id !== 'wheel') { const sel = panel.querySelector('[data-point]'); if (sel) sel.value = id; }
      },
      onReset: id => { if (id === 'wheel') st[end].travel = 0; else delete st[end].pts[id]; refresh(end); syncPointFields(panel, end, a); },
      announce,
    });
    handles.push(h);
    window.addEventListener('resize', () => h.refresh(), { passive: true });
    panel.querySelector('[data-point]').addEventListener('change', ev => { st.ui[end].point = ev.target.value; syncPointFields(panel, end, a); h.refresh(); });
    for (const inp of panel.querySelectorAll('[data-pt]')) inp.addEventListener('change', () => {
      const v = parse('length', inp.value), err = panel.querySelector(`[data-err-for="${inp.id}"]`);
      const lim = inp.dataset.pt === '0' ? BOUNDS.planar.y : BOUNDS.planar.z;
      if (!Number.isFinite(v) || v < lim[0] || v > lim[1]) { err.textContent = `Enter ${L(lim[0], { digits: 0 })} to ${L(lim[1], { digits: 0 })}.`; inp.setAttribute('aria-invalid', 'true'); return; }
      err.textContent = ''; inp.removeAttribute('aria-invalid');
      const k = panel.querySelector('[data-point]').value, g = planarGeometry(st[end], end);
      const p = [...g[k]]; p[+inp.dataset.pt] = v; st[end].pts[k] = p; st[end].travel = 0;
      refresh(end);
    });
    // ride height
    const rh = panel.querySelector('[data-rh]'), mode = panel.querySelector('[data-rh-mode]'), out = panel.querySelector('[data-rh-preview]');
    const preview = () => {
      st.ui[end].rh = rh.value; st.ui[end].rhMode = mode.value;
      const change = parse('length', rh.value);
      if (!Number.isFinite(change) || Math.abs(change) > TRAVEL) { out.textContent = `Enter a change between ${L(-TRAVEL, { signed: true })} and ${L(TRAVEL, { signed: true })}.`; return null; }
      const g = planarGeometry(st[end], end);
      const r = rideHeightGeometry(a.kind, g, change, mode.value);
      if (r.status !== STATUS.ok) { out.textContent = `Not possible with this geometry: ${r.reason}`; return null; }
      const before = planarSolver(st[end], end), b0 = before.at(0);
      const after = planarSolver({ ...st[end], pts: Object.fromEntries(KINDS[a.kind].map(k => [k, r.g[k]])), camber: r.g.staticCamber }, end), a0 = after.at(0);
      if (a0.status !== STATUS.ok) { out.textContent = 'Not possible with this geometry.'; return null; }
      const room = after.reach?.bump && after.reach.bump.why !== 'range' ? ` Bump left before the linkage stops: ${L(after.reach.bump.travel)}.` : '';
      out.innerHTML = `${change < 0 ? 'Lowering' : 'Raising'} ${esc(L(Math.abs(change)))}: camber ${esc(A(b0.camber))} → <b>${esc(A(a0.camber))}</b>, roll center ${esc(L(b0.rollCentreHeight, { digits: 1 }))} → <b>${esc(L(a0.rollCentreHeight, { digits: 1 }))}</b>, track ${esc(L(a0.points.wheelCenter[0] * 2 - b0.points.wheelCenter[0] * 2, { signed: true }))}.${esc(room)}${mode.value === 'springs' && change < 0 ? ' Lowering on springs alone moves the roll center down faster than the body: a common reason lowered cars roll more.' : ''}`;
      return r;
    };
    rh.addEventListener('input', preview); mode.addEventListener('change', preview); preview();
    panel._rhPreview = preview;
    panel.querySelector('[data-rh-apply]').addEventListener('click', () => {
      const r = preview(); if (!r) return;
      const change = parse('length', rh.value);
      st[end].pts = Object.fromEntries(KINDS[a.kind].map(k => [k, r.g[k].map(v => +v.toFixed(4))]));
      st[end].camber = r.g.staticCamber; st[end].travel = 0;
      st[end].history = [...st[end].history, `${change < 0 ? 'lowered' : 'raised'} ${L(Math.abs(change))} (${mode.value === 'springs' ? 'springs' : 'kept arm angles'})`].slice(-4);
      persist(); renderPanel('[data-rh-apply]'); announce('Applied. Reset returns to the generic example.');
    });
  }
  function syncPointFields(panel, end, a) {
    const k = panel.querySelector('[data-point]')?.value; if (!k) return;
    const g = planarGeometry(st[end], end);
    panel.querySelector('#pt-y').value = inputValue('length', g[k][0], { us: 2, metric: 0 });
    panel.querySelector('#pt-z').value = inputValue('length', g[k][1], { us: 2, metric: 0 });
  }

  // ---- live-axle handles and fields
  function bindLive(panel, end, a) {
    const sel = () => Math.min(st.ui[end].link ?? 0, liveLinks(st[end], end).length - 1);
    const endKey = () => { const l = liveLinks(st[end], end)[sel()]; return l.group === 'slider' || st.ui[end].endpt === 'axle' ? 'axle' : 'chassis'; };
    for (const view of ['top', 'side', 'rear']) {
      const stage = panel.querySelector(`[data-stage="${view}"]`), layer = panel.querySelector(`[data-layer="${view}"]`), map = liveMap[view];
      const [i0, i1] = map.axes;
      const scale = () => stage.querySelector('svg').getBoundingClientRect().width / LIVE[view].w;
      const h = attachHandles(layer, {
        handles: () => {
          if (!stage.closest('.v2-view')?.classList.contains('on') && matchMedia('(max-width: 999px)').matches) return [];
          const links = liveLinks(st[end], end), i = sel(), l = links[i], list = [];
          const ends = l.group === 'slider' ? ['axle'] : ['chassis', 'axle'];
          for (const k of ends) {
            if (view === 'rear' && l.group !== 'lateral' && k === 'chassis') continue; // end-on links: chassis hidden behind axle mount
            const p = l[k];
            list.push({ id: k, point: [p[i0], p[i1]], label: `${l.name} ${k === 'axle' ? (l.group === 'slider' ? 'nose' : 'axle mount') : 'chassis mount'}`, axes: 'xy', selected: endKey() === k,
              step: [canonicalStep('length'), canonicalStep('length')], describe: q => `${L(q[0], { digits: 1 })}, ${L(q[1], { digits: 1 })}` });
          }
          if (view !== 'top') { const D = liveState(st, end, { fast: true }); list.push({ id: 'heave', point: view === 'side' ? [0, 13 + D.heave] : [0, 13 + D.heave], label: 'Axle center (travel)', axes: 'y', step: [canonicalStep('length'), canonicalStep('length')], describe: () => L(D.heave, { signed: true }) }); }
          return list;
        },
        toScreen: p => { const s = scale(); const full = [0, 0, 0]; full[i0] = p[0]; full[i1] = p[1]; const q = map.to(full); return [q[0] * s, q[1] * s]; },
        toModel: ([x, y]) => { const s = scale(); const m = map.from([x / s, y / s]); return [m[0], m[1]]; },
        clamp: (id, p) => {
          if (id === 'heave') return p;
          const b = BOUNDS.live, ax = ['x', 'y', 'z'];
          return [Math.min(b[ax[i0]][1], Math.max(b[ax[i0]][0], p[0])), Math.min(b[ax[i1]][1], Math.max(b[ax[i1]][0], p[1]))];
        },
        onMove: (id, p, phase) => {
          if (id === 'heave') { st[end].travel = Math.max(-TRAVEL, Math.min(TRAVEL, p[1] - 13)); }
          else {
            if (st[end].travel || st[end].roll) { st[end].travel = 0; st[end].roll = 0; announce('Showing ride height while you move mounting points.'); }
            const i = sel(), cur = liveLinks(st[end], end)[i][id];
            const next = [...cur]; next[i0] = +p[0].toFixed(3); next[i1] = +p[1].toFixed(3);
            st[end].pts[`${i}.${id}`] = next; st.ui[end].endpt = id;
          }
          const D = refresh(end, { charts: phase !== 'move', fast: phase === 'move' });
          if (phase !== 'move') { clampMsg(end, D); syncLinkFields(panel, end); }
        },
        onReset: id => { if (id === 'heave') st[end].travel = 0; else delete st[end].pts[`${sel()}.${id}`]; refresh(end); syncLinkFields(panel, end); },
        announce,
      });
      handles.push(h);
      // tap a link in the drawing to select it
      stage.addEventListener('click', ev => {
        const t = ev.target.closest('[data-link]'); if (!t) return;
        st.ui[end].link = +t.dataset.link; panel.querySelector('[data-link-pick]').value = t.dataset.link;
        refresh(end, { charts: false }); syncLinkFields(panel, end);
      });
    }
    window.addEventListener('resize', () => handles.forEach(h => h.refresh()), { passive: true });
    panel.querySelector('[data-link-pick]').addEventListener('change', ev => {
      st.ui[end].link = +ev.target.value; const l = liveLinks(st[end], end)[st.ui[end].link];
      const ep = panel.querySelector('[data-end-pick]'); ep.disabled = l.group === 'slider'; if (l.group === 'slider') ep.value = 'axle';
      refresh(end, { charts: false }); syncLinkFields(panel, end);
    });
    panel.querySelector('[data-end-pick]').addEventListener('change', ev => { st.ui[end].endpt = ev.target.value; syncLinkFields(panel, end); handles.forEach(h => h.refresh()); });
    for (const inp of panel.querySelectorAll('[data-lk]')) inp.addEventListener('change', () => {
      const v = parse('length', inp.value), ax = +inp.dataset.lk, lim = BOUNDS.live[['x', 'y', 'z'][ax]], err = panel.querySelector(`[data-err-for="${inp.id}"]`);
      if (!Number.isFinite(v) || v < lim[0] || v > lim[1]) { err.textContent = `Enter ${L(lim[0], { digits: 0 })} to ${L(lim[1], { digits: 0 })}.`; inp.setAttribute('aria-invalid', 'true'); return; }
      err.textContent = ''; inp.removeAttribute('aria-invalid');
      const i = sel(), k = endKey(), p = [...liveLinks(st[end], end)[i][k]]; p[ax] = v;
      st[end].pts[`${i}.${k}`] = p; st[end].travel = 0; st[end].roll = 0; refresh(end);
    });
    function syncLinkFields() {
      const i = sel(), k = endKey(), p = liveLinks(st[end], end)[i][k];
      ['lk-x', 'lk-y', 'lk-z'].forEach((id, ax) => { panel.querySelector('#' + id).value = inputValue('length', p[ax], { us: 2, metric: 0 }); });
    }
  }
  function syncLinkFields(panel, end) { panel.querySelector('[data-link-pick]')?.dispatchEvent(new Event('sync')); const i = Math.min(st.ui[end].link ?? 0, liveLinks(st[end], end).length - 1); const l = liveLinks(st[end], end)[i]; const k = l.group === 'slider' || st.ui[end].endpt === 'axle' ? 'axle' : 'chassis'; ['lk-x', 'lk-y', 'lk-z'].forEach((id, ax) => { const el = panel.querySelector('#' + id); if (el) el.value = inputValue('length', l[k][ax], { us: 2, metric: 0 }); }); }

  document.addEventListener('ess:units-changed', () => renderAll());
  renderAll();
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-suspension-v2]');
  if (root) mount(root);
}
