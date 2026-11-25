// Vehicle Lab · Performance: gearing, tires and traction on one page (isolated integration slice, Claude 25 Nov).
// Every number comes from the shared engine: experience/models.mjs → engine/acceleration.mjs for the run and
// engine/traction.mjs for tractionCheck / byGear / compareTires. Nothing here is a hard-coded outcome.
import { resolve, straightLine, powerIssue, massIssue, MPH } from './models.mjs';
import { tractionCheck, byGear, compareTires, frictionFor, tireClasses, pickerOrder, surfaces,
  missingFor as tractionMissing } from '../engine/traction.mjs';
import { wheelRpm } from '../engine/acceleration.mjs';
import { components } from './components.mjs';
import { missingFor as studyMissing, missingText } from './readiness.mjs';
import { vehicles } from './vehicles.mjs';
import { modified } from './configuration.mjs';
import { setupName } from './matchup.mjs';
import { vehicleSelector, escape, fmt, delta } from './ui.mjs';

/** Public reference cars offered as one-tap choices (all are in the shared vehicle reference). */
export const quickReferences = [
  ['corvette', '2002 Corvette Z06'], ['camaro', '1991 Camaro Z28'], ['gto', '2004 Pontiac GTO'], ['firebird', '1977 Trans Am'],
];
export const axleRatios = [3.08, 3.42, 3.73, 4.10];
const statusWord = { green: 'Grip to spare', yellow: 'Near the grip limit', red: 'More force than grip', missing: 'Needs data' };
const SESSION_KEY = 'ess.performance-page.v1';

export const perfDefaults = () => ({ vehicle: null, tire: null, surface: 'dryAsphalt', customMu: null, gear: 0 });

/** Page settings (tire, surface, selected gear) live in this tab's session so Back from an article restores them. */
export function loadPerf() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return cleanPerf(raw);
  } catch { return perfDefaults(); }
}
export function savePerf(perf) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(perf)); } catch { /* still works without storage */ }
}
export function cleanPerf(raw) {
  const p = perfDefaults();
  if (!raw || typeof raw !== 'object') return p;
  if (typeof raw.vehicle === 'string') p.vehicle = raw.vehicle;
  if (raw.tire === null || ['setup', 'custom'].includes(raw.tire) || Object.hasOwn(tireClasses, raw.tire)) p.tire = raw.tire ?? null;
  if (Object.hasOwn(surfaces, raw.surface)) p.surface = raw.surface;
  if (Number.isFinite(raw.customMu) && raw.customMu >= .1 && raw.customMu <= 3) p.customMu = raw.customMu;
  if (Number.isInteger(raw.gear) && raw.gear >= 0 && raw.gear < 10) p.gear = raw.gear;
  if (p.tire === 'custom' && p.customMu == null) p.tire = null;
  return p;
}

/** Street tire class whose calibrated typical value equals the vehicle's own grip input (so the defaults agree). */
export function matchedClass(v) {
  if (!Number.isFinite(v.grip)) return null;
  return pickerOrder.find(id => tireClasses[id].reference === 'dryAsphalt' &&
    Math.abs(tireClasses[id].longitudinal.typical - v.grip) < .001) ?? null;
}

/** Friction options for engine/traction.mjs from the page settings. */
export function frictionOptions(v, perf) {
  const tire = perf.tire ?? matchedClass(v) ?? 'setup';
  if (tire === 'setup') return { tire, opts: { customMu: Number.isFinite(v.grip) ? v.grip : null } };
  if (tire === 'custom') return { tire, opts: { customMu: perf.customMu } };
  return { tire, opts: { tire, surface: perf.surface } };
}

const blockedRun = v => powerIssue(v) || massIssue(v);

/** All results for the page. Pure: safe to call from tests with the same inputs the browser uses. */
export function perfModel(setup, perf) {
  const original = resolve(setup, false);
  const v = resolve(setup, true);
  const { tire, opts } = frictionOptions(v, perf);
  const frictionReady = opts.customMu !== null;
  const mu = frictionReady ? frictionFor(opts) : null;
  const gears = Array.isArray(v.gears) ? v.gears : [];
  const gear = Math.min(perf.gear, Math.max(0, gears.length - 1));

  // Acceleration: original car on its own grip input vs. this experiment at the chosen tire/surface (low/typical/high).
  const runIssue = blockedRun(v);
  const originalIssue = blockedRun(original);
  const baseRun = originalIssue ? null : straightLine(original);
  const runs = runIssue || !mu ? null : Object.fromEntries(['low', 'typical', 'high'].map(k => [k, straightLine(v, { mu: mu[k] })]));
  const accel = runs ? {
    et: runs.typical.finish?.t, trap: runs.typical.finish?.trap, zeroTo60: runs.typical.zeroTo60,
    etRange: [runs.high.finish?.t, runs.low.finish?.t], sixtyRange: [runs.high.zeroTo60, runs.low.zeroTo60],
    magazineEt: runs.typical.magazine.et, time: runs.typical.time, mu: mu.typical,
  } : null;
  const base = baseRun && !baseRun.issue ? { et: baseRun.finish?.t, trap: baseRun.finish?.trap, zeroTo60: baseRun.zeroTo60, mu: original.grip } : null;

  // Gearing: speed at the shift point in each gear and cruise rpm (needs ratios, final drive, tire, shift rpm).
  const gearingMissing = ['gears', 'finalDrive', 'diameter', 'redline'].filter(k => k === 'gears' ? gears.length < 2 : !Number.isFinite(v[k]));
  const gearing = gearingMissing.length ? null : gears.map((ratio, i) => ({
    gear: i + 1, ratio, overall: ratio * v.finalDrive, shiftMph: v.redline / wheelRpm(v, MPH, i),
  }));
  const cruiseRpm = gearing ? wheelRpm(v, 70 * MPH, gears.length - 1) : null;

  // Traction: selected gear (first gear uses the launch rpm; higher gears the torque peak, matching byGear).
  const tOpts = { ...opts, gear, ...(gear > 0 && Number.isFinite(v.torqueRpm) ? { rpm: v.torqueRpm } : {}) };
  const check = frictionReady ? tractionCheck(v, tOpts) : { status: 'missing', missing: ['tire grip value'] };
  const gearRows = frictionReady ? byGear(v, opts) : [];
  const tireRows = check.status === 'missing' ? [] :
    compareTires(v, { surface: perf.surface, gear, ...(tOpts.rpm ? { rpm: tOpts.rpm } : {}) });

  return { setup, v, original, tire, opts, mu, gear, accel, base, runIssue, originalIssue, gearing, gearingMissing, cruiseRpm,
    check, gearRows, tireRows, quarterMissing: studyMissing(v, 'quarter'), tractionMissing: tractionMissing(v, opts),
    modified: modified(setup) };
}

// ---------- HTML ----------
const secs = (n, p = 2) => Number.isFinite(n) ? fmt(n, p) + ' s' : '—';
const pct = n => fmt(n * 100) + '%';

function meter(check) {
  const a = check.availableLb;
  const top = Math.max(check.demandLb, a.high) * 1.15;
  const at = x => (100 * x / top).toFixed(1) + '%';
  return `<div class="perf-meter" role="img" aria-label="Drive force ${fmt(check.demandLb)} lb against available grip ${fmt(a.low)} to ${fmt(a.high)} lb.">
    <span class="perf-band" style="left:${at(a.low)};width:calc(${at(a.high)} - ${at(a.low)})"></span>
    <span class="perf-typical" style="left:${at(a.typical)}"></span>
    <span class="perf-demand" style="left:${at(check.demandLb)}"></span>
  </div>
  <div class="perf-meter-key"><span><i class="key-demand"></i>Drive force ${fmt(check.demandLb)} lb</span><span><i class="key-band"></i>Grip ${fmt(a.low)}–${fmt(a.high)} lb</span></div>`;
}

function missingBlock(text, laneKey, study = 'quarter') {
  return `<p class="warning">${escape(text)}</p>
    <button type="button" class="text-button missing-action" data-study-lane="${laneKey}" data-study-tool="${study}">Add the missing values in Build</button>`;
}

export function summaryHtml(m, laneKey) {
  if (!m.accel) {
    const keys = m.quarterMissing;
    return `<div class="perf-summary" id="perf-summary">
      <div class="perf-sticky"><span>Quarter mile</span><strong>—</strong><span class="perf-chip" data-level="${m.check.status}">${statusWord[m.check.status]}</span></div>
      ${missingBlock(keys.length ? 'The acceleration run needs: ' + missingText(keys) + '. Results that do not depend on these still show below.' : (m.runIssue || 'Choose a tire grip value to run.'), laneKey)}
    </div>`;
  }
  const a = m.accel, b = m.base;
  const d = b && Number.isFinite(a.et) && Number.isFinite(b.et) ? a.et - b.et : null;
  const d60 = b && Number.isFinite(a.zeroTo60) && Number.isFinite(b.zeroTo60) ? a.zeroTo60 - b.zeroTo60 : null;
  const gripSecs = a.time.traction;
  return `<div class="perf-summary" id="perf-summary">
    <div class="perf-sticky" aria-live="polite"><span>Quarter mile</span><strong>${secs(a.et)}</strong>
      <span class="perf-chip" data-level="${m.check.status}">${statusWord[m.check.status]}</span></div>
    <div class="perf-figures">
      <div><small>Quarter mile</small><b>${secs(a.et)}</b><span>${fmt(a.trap)} mph finish</span></div>
      <div><small>0–60 mph</small><b>${secs(a.zeroTo60, 1)}</b><span>${Number.isFinite(a.sixtyRange[0]) ? fmt(a.sixtyRange[0], 1) + '–' + fmt(a.sixtyRange[1], 1) + ' s range' : ''}</span></div>
    </div>
    <p class="perf-range">Grip range on this tire and surface: ${secs(a.etRange[0])} to ${secs(a.etRange[1])} (μ ${fmt(m.mu.high, 2)} to ${fmt(m.mu.low, 2)}).</p>
    ${b ? `<p class="perf-delta">Original ${secs(b.et)} · 0–60 ${secs(b.zeroTo60, 1)} (μ ${fmt(b.mu, 2)}, dry)${d !== null && (Math.abs(d) >= .005 || Math.abs(d60 ?? 0) >= .005) ? ` → this experiment <b>${delta(d, 2)} s</b> quarter, ${delta(d60, 2)} s 0–60` : ' · this experiment matches it so far'}</p>` : ''}
    <p class="perf-limit">Grip-limited for ${fmt(gripSecs, 1)} s of the run${gripSecs < .05 ? ': the engine, not the tires, sets the pace, so a grippier tire will not change this result.' : '. Only that part of the run responds to tire grip.'}</p>
  </div>`;
}

export function tractionHtml(m, laneKey) {
  const c = m.check;
  const gears = m.v.gears ?? [];
  const chips = gears.length ? `<div class="event-switch perf-gears" role="group" aria-label="Gear for the traction check">${gears.map((r, i) =>
    `<button type="button" class="button secondary small" data-perf-gear="${i}" aria-pressed="${i === m.gear}">${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}</button>`).join('')}</div>` : '';
  if (c.status === 'missing') {
    return `<section class="panel content-panel perf-traction" id="perf-traction" data-level="missing" aria-labelledby="perf-traction-title">
      <h2 id="perf-traction-title">Drive force vs. grip</h2>${chips}
      ${missingBlock('This check needs: ' + c.missing.join(', ') + '.', laneKey)}</section>`;
  }
  const i = c.inputs;
  return `<section class="panel content-panel perf-traction" id="perf-traction" data-level="${c.status}" aria-labelledby="perf-traction-title">
    <h2 id="perf-traction-title">Drive force vs. grip</h2>${chips}
    <p class="perf-status"><strong>${statusWord[c.status]}</strong> · ${pct(c.utilization)} of typical grip</p>
    ${meter(c)}
    <p>${escape(c.text)}</p>
    <p class="quiet small">Gear ${i.gear} · ${fmt(i.torqueLbFt)} lb-ft at ${fmt(i.rpm)} rpm${i.converterRatio > 1 ? ` · converter ×${i.converterRatio}` : ''} · overall ${fmt(i.overallRatio, 2)}:1 · ${({ rear: 'rear-wheel', front: 'front-wheel', all: 'all-wheel' })[i.drive]} drive</p>
  </section>`;
}

function gearChoices(m) {
  const original = m.original.finalDrive;
  const values = [...new Set([...(Number.isFinite(original) ? [original] : []), ...axleRatios])].sort((a, b) => a - b);
  return values.map(r => `<button type="button" class="button secondary small" data-axle-ratio="${r}" aria-pressed="${m.v.finalDrive === r}">${fmt(r, 2)}${r === original ? ' <small>orig.</small>' : ''}</button>`).join('');
}

function transmissionSelect(setup) {
  const list = components.transmission;
  return `<label><span>Transmission</span><select data-component="transmission"><option value="">Original gearbox</option>
    ${Object.entries(list).filter(([id, item]) => !item.hidden || setup.components?.transmission === id)
      .map(([id, item]) => `<option value="${id}" ${setup.components?.transmission === id ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select></label>`;
}

function tireSelect(m) {
  const auto = matchedClass(m.v);
  const opt = (id, label) => `<option value="${id}" ${m.tire === id ? 'selected' : ''}>${escape(label)}</option>`;
  return `<label><span>Tire class</span><select data-perf-tire>
    ${!auto && Number.isFinite(m.v.grip) ? opt('setup', `Vehicle setup value (μ ${fmt(m.v.grip, 2)})`) : ''}
    ${pickerOrder.map(id => opt(id, (id === auto ? 'Stock · ' : '') + tireClasses[id].label)).join('')}
    ${m.tire === 'custom' ? opt('custom', `My friction value (μ ${fmt(m.opts.customMu, 2)})`) : ''}
  </select></label>`;
}

export function controlsHtml(m, perf) {
  const ownMu = m.tire === 'setup' || m.tire === 'custom';
  return `<section class="panel content-panel perf-controls" id="perf-controls" aria-labelledby="perf-controls-title" tabindex="-1">
    <h2 id="perf-controls-title">Try a change</h2>
    <h3>Gearing</h3>
    <div class="axle-ratio-picks" role="group" aria-label="Final-drive ratio">${gearChoices(m)}</div>
    <label class="slider"><span>Final drive <output id="perf-fd">${Number.isFinite(m.v.finalDrive) ? fmt(m.v.finalDrive, 2) : 'missing'}</output></span>
      <input type="range" data-perf-fd min="2" max="6" step=".01" value="${Number.isFinite(m.v.finalDrive) ? m.v.finalDrive : 3.42}" aria-label="Final drive ratio"></label>
    ${transmissionSelect(m.setup)}
    <p class="quiet small">Gears ${Array.isArray(m.v.gears) && m.v.gears.length ? m.v.gears.map(g => fmt(g, 2)).join(' · ') : 'missing'} · ${escape(m.v.transmission ?? 'transmission type missing')}</p>
    <h3>Tires and surface</h3>
    <div class="pair-grid">${tireSelect(m)}
      <label><span>Surface</span><select data-perf-surface ${ownMu ? 'disabled' : ''}>${Object.entries(surfaces).map(([id, s]) =>
        `<option value="${id}" ${perf.surface === id ? 'selected' : ''}>${escape(s.label)}</option>`).join('')}</select></label></div>
    ${ownMu ? '<p class="quiet small">A single friction value is used as entered; surface factors and ranges do not apply to it.</p>' : ''}
    <details class="explain" data-details="perf-own-mu"><summary>Use my own friction value</summary>
      <form data-perf-mu class="edit-form"><label class="number-field"><span>Peak longitudinal friction (μ)</span>
      <input type="number" name="mu" min="0.1" max="3" step="0.01" inputmode="decimal" value="${perf.customMu ?? ''}" required></label>
      <button class="button secondary small">Use this value</button>${m.tire === 'custom' ? ' <button type="button" class="button plain small" data-perf-tire-reset>Back to tire classes</button>' : ''}</form></details>
    <div class="actions"><button type="button" class="button plain small" data-perf-reset ${m.modified || perf.tire || perf.surface !== 'dryAsphalt' ? '' : 'disabled'}>Reset gearing and tires</button></div>
  </section>`;
}

export function gearTableHtml(m) {
  if (!m.gearing) return `<section class="panel content-panel" id="perf-gearing"><h2>Gear by gear</h2>
    <p class="warning">Gear speeds need: ${escape(missingText(m.gearingMissing))}.</p></section>`;
  const rows = new Map(m.gearRows.map(r => [r.gear, r]));
  return `<section class="panel content-panel" id="perf-gearing" aria-labelledby="perf-gear-title"><h2 id="perf-gear-title">Gear by gear</h2>
    <table class="metric-table perf-table"><thead><tr><th scope="col">Gear</th><th scope="col">Speed at shift rpm</th><th scope="col">Force at torque peak</th></tr></thead>
    <tbody>${m.gearing.map(g => { const r = rows.get(g.gear); return `<tr><th scope="row">${g.gear} <span>${fmt(g.ratio, 2)}</span></th>
      <td>${fmt(g.shiftMph)} <span>mph</span></td>
      <td>${r ? `<span class="perf-dot" data-level="${r.status}"></span>${fmt(r.demandLb)} <span>lb · ${pct(r.utilization)}</span>` : '—'}</td></tr>`; }).join('')}</tbody></table>
    <p class="quiet small">Speeds at ${fmt(m.v.redline)} rpm, gearing only (air drag can cap top gear lower) · ${fmt(m.cruiseRpm)} rpm at 70 mph in top gear.${m.gearRows.length ? ' Force uses peak torque in each gear against the selected tire.' : ''}</p></section>`;
}

export function tireTableHtml(m) {
  if (!m.tireRows.length) return '';
  const gearLabel = `gear ${m.gear + 1}`;
  return `<section class="panel content-panel" id="perf-tires" aria-labelledby="perf-tires-title"><h2 id="perf-tires-title">Compare tire classes</h2>
    <p class="quiet small">Same car, gearing and ${gearLabel} on ${escape(surfaces[m.opts.surface ?? 'dryAsphalt'].label.toLowerCase())}. Tap one to use it.</p>
    <ul class="perf-tire-list">${m.tireRows.map(r => `<li><button type="button" data-perf-pick-tire="${r.id}" aria-pressed="${r.id === m.tire}">
      <span class="perf-dot" data-level="${r.status}"></span><span>${escape(r.label)}</span>
      <b>${fmt(r.availableLb.typical)} lb</b><small>${pct(r.utilization)} used</small></button></li>`).join('')}</ul></section>`;
}

function assumptionsHtml(m) {
  const notes = [...(m.check.assumptions ?? []), ...(m.mu?.notes ?? [])];
  const surface = m.opts.surface && m.opts.surface !== 'dryAsphalt' ? ' Road-test calibration covers dry pavement; this surface uses the same physics with an estimated grip and has not been checked against tests.' : '';
  return `<details class="explain" data-details="perf-assumptions"><summary>Assumptions and uncertainty</summary>
    <p>The run uses the shared acceleration model (clutch-slip launch, rotating inertia, load transfer, 85% driveline, standard air). Tire grip enters it only as the cap on drive force at the driven tires; it does not change gearing, tire size, rolling resistance or drag.${surface}</p>
    <p>Friction ${m.mu ? `${fmt(m.mu.low, 2)} / ${fmt(m.mu.typical, 2)} / ${fmt(m.mu.high, 2)} (low / typical / high), evidence: ${escape(m.mu.evidence)}` : 'unavailable'}. Treadwear grade is never used as grip.</p>
    <ul>${notes.map(n => `<li>${escape(n)}</li>`).join('')}</ul>
    <p>Times start from standstill, as in Compare. ${m.accel?.magazineEt ? `With the 1 ft rollout that drag strips and magazines use: ${secs(m.accel.magazineEt)}.` : ''}
    ${m.original.testEt || m.original.test60 ? `Published road test of the stock car: ${m.original.test60 ? '0–60 ' + fmt(m.original.test60, 1) + ' s' : ''}${m.original.testEt ? ' · quarter ' + fmt(m.original.testEt, 2) + ' s' : ''}${m.original.testTrap ? ' at ' + fmt(m.original.testTrap) + ' mph' : ''}.` : ''}</p>
  </details>`;
}

export function performanceView(state, perf, links) {
  const setup = state[state.focus];
  const m = perfModel(setup, perf);
  const laneKey = state.focus;
  return `<section class="shell workspace perf-workspace">
    <div class="page-title"><p class="eyebrow">Measure. Test. Improve.</p><h1>Gearing and traction</h1>
      <p class="lede">Your car. Your experiment. Change the gear or the tire and see how much of the engine’s force the tires can use.</p></div>
    <div class="configuration-bar">${vehicleSelector('Vehicle', setup.id, { key: 'focus', name: setup.name })}
      <span>${escape(m.modified ? 'Modified · ' + setupName(setup) : vehicles[setup.id].trim ?? '')}</span></div>
    <div class="perf-refs" role="group" aria-label="Reference vehicles">${quickReferences.map(([id, label]) =>
      `<button type="button" class="button secondary small" data-vehicle-key="focus" data-perf-ref="${id}" aria-pressed="${setup.id === id}">${label}</button>`).join('')}</div>
    <div class="perf-grid">
      <div class="perf-results">${summaryHtml(m, laneKey)}${tractionHtml(m, laneKey)}</div>
      ${controlsHtml(m, perf)}
      ${gearTableHtml(m)}
      ${tireTableHtml(m)}
      <section class="panel content-panel perf-learn">
        <h2>Why it happens</h2>
        <a class="route-card" href="#performance-why"><strong>Why does a shorter gear stop helping?</strong><span>Plain-language answer, then the numbers behind this result.</span></a>
        ${assumptionsHtml(m)}
        <p><a href="../articles/traction-circle/">Read: the traction circle and tire grip</a></p>
        <p><a id="perf-load-link" href="${escape(links.loadTransfer)}">Open the load transfer calculator with this car</a></p>
        <p><a href="#compare">Race this setup in Compare</a></p>
        <div class="actions"><button type="button" class="button primary" data-perf-use>Use this configuration</button>
          <button type="button" class="button secondary" data-action="save">Save to My Garage</button></div>
        <p class="quiet small" id="active-feedback" role="status"></p>
      </section>
    </div>
  </section>`;
}

/** Progressive explanation: step 1 plain language, step 2 the calculation with this car's numbers. */
export function performanceExplain(state, perf, step) {
  const m = perfModel(state[state.focus], perf);
  const c = m.check;
  const back = `<div class="actions"><a class="button primary" href="#performance" data-perf-return>Return to my experiment</a></div>`;
  const head = (title) => `<div class="page-title"><p class="eyebrow">${escape(setupName(m.setup))}</p><h1>${title}</h1></div>`;
  if (step === 'why') {
    return `<section class="shell workspace perf-explain">${head('Why traction matters')}
      <div class="panel content-panel">
      <p>A shorter (numerically higher) gear multiplies the engine’s torque, so the tires are asked to push harder. That only helps while the tires can grip. Past that point the extra force turns into wheelspin, and the gear just reaches its shift point sooner.</p>
      <p>Grip depends on the tire, the surface and how much weight is on the driven tires. Accelerating moves weight toward the rear, which helps a rear-drive car and hurts a front-drive one.</p>
      ${c.status === 'missing' ? `<p class="warning">This car still needs ${escape(c.missing.join(', '))} for its own numbers.</p>` :
        `<p><strong>For this setup in gear ${c.inputs.gear}:</strong> the drivetrain can deliver ${fmt(c.demandLb)} lb and the tires can likely take ${fmt(c.availableLb.low)}–${fmt(c.availableLb.high)} lb. ${escape(statusWord[c.status])}.</p>`}
      <a class="route-card" href="#performance-math"><strong>Behind the calculation</strong><span>The two equations with this car’s values.</span></a>
      </div>${back}</section>`;
  }
  if (c.status === 'missing') return `<section class="shell workspace perf-explain">${head('Behind the calculation')}<div class="panel content-panel"><p class="warning">Needs ${escape(c.missing.join(', '))}.</p></div>${back}</section>`;
  const i = c.inputs, v = m.v;
  const rear = v.weight * (1 - v.front), frontW = v.weight * v.front, lever = v.cg / v.wheelbase;
  const formula = { rear: `F = μ × W<sub>rear</sub> ÷ (1 − μ × h ÷ L) = ${fmt(c.friction.typical, 2)} × ${fmt(rear)} ÷ (1 − ${fmt(c.friction.typical, 2)} × ${fmt(lever, 3)})`,
    front: `F = μ × W<sub>front</sub> ÷ (1 + μ × h ÷ L) = ${fmt(c.friction.typical, 2)} × ${fmt(frontW)} ÷ (1 + ${fmt(c.friction.typical, 2)} × ${fmt(lever, 3)})`,
    all: `F = μ × W = ${fmt(c.friction.typical, 2)} × ${fmt(v.weight)}` }[i.drive];
  return `<section class="shell workspace perf-explain">${head('Behind the calculation')}
    <div class="panel content-panel">
    <h2>1 · Force the drivetrain can send</h2>
    <p class="perf-formula">F = torque × gear × final drive${i.converterRatio > 1 ? ' × converter' : ''} × efficiency ÷ tire radius</p>
    <p>${fmt(i.torqueLbFt)} lb-ft × ${fmt(v.gears[i.gear - 1], 2)} × ${fmt(v.finalDrive, 2)}${i.converterRatio > 1 ? ' × ' + i.converterRatio : ''} × ${fmt(i.efficiency, 2)} ÷ ${fmt(i.tireRadiusIn / 12, 3)} ft = <b>${fmt(c.demandLb)} lb</b></p>
    <h2>2 · Force the tires can take</h2>
    <p class="perf-formula">${formula}</p>
    <p>= <b>${fmt(c.availableLb.typical)} lb</b> at typical grip (range ${fmt(c.availableLb.low)}–${fmt(c.availableLb.high)} lb from μ ${fmt(c.friction.low, 2)}–${fmt(c.friction.high, 2)}).
      W ${fmt(v.weight)} lb, ${fmt(v.front * 100, 1)}% front, CG height h ${fmt(v.cg)} in, wheelbase L ${fmt(v.wheelbase, 1)} in. ${i.drive === 'rear' ? `The front lifts at ${fmt(frontW * v.wheelbase / v.cg)} lb, which caps the result.` : ''}</p>
    <p>Steady state: no wheel hop, suspension squat or air drag; both driven tires share the load equally. Values with an estimate label in Build are estimates.</p>
    </div>${back}</section>`;
}
