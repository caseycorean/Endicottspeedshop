import { vehicles, fields, firebirdEvidence } from './vehicles.mjs';
import { presets, limits, resolve, massIssue, powerIssue, tireLoads, ride } from './models.mjs';
import { modified } from './configuration.mjs';
import { vehicleSelector, configModes, evidence, explanation, fmt, delta, metricTable, numberField, escape } from './ui.mjs';

export const concepts = {
  moments: ['Mass moments and center of gravity', 'Move 40 lb by 72 in and the total weight stays the same. Rear axle load rises by 40 × 72 ÷ wheelbase. Removing a part ahead of the front axle can increase rear axle load even as total weight falls.'],
  torque: ['Force moments and torque', 'Torque equals force × perpendicular lever arm. The same 50 lb on a 1 ft wrench makes 50 lb-ft. A 2 ft wrench makes 100 lb-ft. At the tire, wheel torque divided by rolling radius gives drive force.'],
  inertia: ['Mass moment of inertia', 'Moving weight toward the center can make a car change direction more readily even when its total and axle weights match. A point mass contributes m × r² about the chosen axis. Acceleration replay does not model yaw inertia.'],
  transfer: ['Weight transfer', 'Braking adds front tire load and takes the same total away from the rear. On a level surface the amount is weight × braking in g × CG height ÷ wheelbase. Lowering the CG changes this amount, even when the parked weight split stays the same.'],
  grip: ['Combined acceleration and tire grip', 'A tire has a finite grip budget. Braking and turning at the same time use that budget together. In a simple friction circle, the required grip is √(braking g² + cornering g²). Real tires vary with vertical load, slip, temperature and the road.'],
  ride: ['Spring rates and ride frequency', 'Wheel rate equals spring rate × motion ratio squared. Tire stiffness and wheel stiffness work in series, and only sprung weight enters the simple bounce frequency. A higher frequency usually feels firmer. Geometry, dampers and travel still matter.'],
};

const concept = (key, more) => explanation(...concepts[key], more);
const choice = (value, title, detail) => `<a class="route-card" href="#${value}"><strong>${title}</strong><span>${detail}</span></a>`;

function pageTitle(eyebrow, title, copy) {
  return `<div class="page-title"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="lede">${copy}</p></div>`;
}

export function home(state, saved) {
  const a = resolve(state.a, state.aMode === 'after');
  const b = resolve(state.b, state.bMode === 'after');
  return `<section class="hero shell" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow"><span></span> Vehicle Lab</p>
      <h1 id="hero-title">Build it.<br><em>Then prove it.</em></h1>
      <p>Pick a project car, change a part and see what it does to balance and acceleration.</p>
      <div class="actions"><a class="button primary" href="#compare">Compare performance</a>
      <a class="button secondary" href="#build">Build a car</a></div>
    </div>
    <div class="hero-image"><span>Virtual test strip</span></div>
  </section>
  <section class="shell home-bay" aria-labelledby="starter-title">
    <div class="section-heading"><div><p class="eyebrow">Head to head</p><h2 id="starter-title">Pick your matchup</h2></div>
      <a class="text-link" href="#learn">How the model works</a></div>
    <div class="starter">
      <div class="starter-vehicle car-a">${vehicleSelector('Car A', state.a.id, { key: 'a' })}
        <p>${escape(vehicles[state.a.id].trim)}</p><strong>${fmt(a.weight)} lb <i></i> ${fmt(a.hp)} hp</strong></div>
      <div class="match-mark" aria-hidden="true">VS</div>
      <div class="starter-vehicle car-b">${vehicleSelector('Car B', state.b.id, { key: 'b' })}
        <p>${escape(vehicles[state.b.id].trim)}</p><strong>${fmt(b.weight)} lb <i></i> ${fmt(b.hp)} hp</strong></div>
      <a class="button primary" href="#compare" aria-label="Open the acceleration matchup">Run matchup</a>
    </div>
    ${saved ? `<p><button class="button secondary" data-action="load-saved">Open my saved build</button></p>` : ''}
  </section>
  <section class="shell intent-grid" aria-label="Choose an experiment">
    ${choice('build', 'Improve my car', 'Explore lighter parts, engine swaps, gearing and balance.')}
    ${choice('compare', 'Compare project cars', 'Put stock and modified builds side by side.')}
    ${choice('tools', 'Test an idea', 'Explore tire loads and ride frequency with your build.')}
    ${choice('learn', 'Learn the engineering', 'Try the relationships behind the results.')}
  </section>`;
}

function fieldInput(key, value) {
  const [lo, hi] = limits[key] ?? [];
  if (key === 'gears') return `<label><span>Gear ratios, highest to lowest</span><input name="gears" value="${escape(value.join(', '))}" required></label>`;
  return numberField(key, fields[key], key === 'front' ? +(value * 100).toFixed(4) : +value.toFixed(4), {
    min: key === 'front' ? lo * 100 : lo, max: key === 'front' ? hi * 100 : hi, required: true,
  });
}

const powerKeys = ['hp', 'hpRpm', 'torque', 'torqueRpm', 'redline', 'gears', 'finalDrive', 'diameter', 'grip', 'cda'];
const geometryKeys = ['weight', 'front', 'wheelbase', 'cg', 'frontTrack', 'rearTrack'];
const rideKeys = ['frontSpring', 'rearSpring', 'frontMotion', 'rearMotion', 'frontUnsprung', 'rearUnsprung', 'tireRate'];
export const inputGroups = { original: [...geometryKeys, ...powerKeys, ...rideKeys], power: powerKeys, ride: rideKeys, geometry: ['cg'] };

function overrideForm(group, values, title, copy, keys) {
  return `<details class="explain" data-details="${group}"><summary>${title}</summary><p>${copy}</p>
    <form data-form="${group}" class="edit-form">
      <div class="input-grid">${keys.map(key => fieldInput(key, values[key])).join('')}</div>
      <button class="button secondary">Update ${group === 'original' ? 'original' : 'experiment'}</button>
      <p class="form-issue" role="alert"></p>
    </form></details>`;
}

function setupPicker(setup, label) {
  return `<div class="configuration-bar">
    ${vehicleSelector(label, setup.id, { key: 'focus' })}
    <span>${escape(vehicles[setup.id].trim)}</span>
  </div>`;
}

export function massMetrics(before, after, isCompare = false) {
  return metricTable([
    ['Total', before.weight, after.weight, 'lb'],
    ['Front axle', before.frontLb, after.frontLb, 'lb'],
    ['Rear axle', before.rearLb, after.rearLb, 'lb'],
    ['Front share', 100 * before.front, 100 * after.front, '%', 1, 'pp'],
    ['CG behind front axle', before.cgX, after.cgX, 'in', 1],
  ], isCompare ? ['Car A', 'Car B'] : undefined, isCompare);
}

function partForm() {
  return `<details class="explain" data-details="part"><summary>Add a custom removal, relocation or swap</summary>
    <p>Enter old and new weight and position. Use 0 lb for a missing part. Positive distance is behind the front axle.</p>
    <form data-form="part" class="edit-form">
      <label><span>Part name</span><input name="label" maxlength="60" placeholder="e.g. T5 transmission" required></label>
      <div class="input-grid">
      ${numberField('oldWeight', 'Old weight (lb)', 0, { min: 0, max: 1800, required: true })}
      ${numberField('oldX', 'Old position (in)', 0, { min: -75, max: 220, required: true })}
      ${numberField('newWeight', 'New weight (lb)', 0, { min: 0, max: 1800, required: true })}
      ${numberField('newX', 'New position (in)', 0, { min: -75, max: 220, required: true })}
      </div>
      <button class="button secondary">Add component change</button><p class="form-issue" role="alert"></p>
    </form>
  </details>`;
}

function axleGraphic(before, after) {
  return `<div class="balance-diagram" role="img" aria-label="Center of gravity moves from ${fmt(before.cgX, 1)} to ${fmt(after.cgX, 1)} inches behind the front axle.">
    <div class="chassis"><div class="axle"></div><div class="rail"><i class="marker before" style="left:${(1 - before.front) * 100}%"></i>
      <i class="marker after" style="left:${(1 - after.front) * 100}%"></i></div><div class="axle"></div></div>
    <div class="axle-labels"><span>Front axle</span><span>Rear axle</span></div>
    <p><i class="legend-dot original"></i> Original CG <i class="legend-dot"></i> Modified CG</p></div>`;
}

export function build(state, saved) {
  const setup = state[state.focus];
  const before = resolve(setup, false);
  const after = resolve(setup);
  const estimateBalance = setup.base.front === undefined && vehicles[setup.id].data.front[1] === 'estimated';
  const frontMove = after.frontLb - before.frontLb;
  const rearMove = after.rearLb - before.rearLb;
  const massMessage = modified(setup) ?
    `Front axle ${delta(frontMove, 1)} lb. Rear axle ${delta(rearMove, 1)} lb. ${estimateBalance && 'Original front share is estimated.' || ''}` :
    `Add a part change to see its effect. ${estimateBalance && 'Original front share is estimated.' || ''}`;
  return `<section class="shell workspace">
    ${pageTitle('Garage', 'Build your car', 'Make a change and see where the weight goes. Keep an original to compare against.')}
    ${setupPicker(setup, `Car ${state.focus.toUpperCase()}`)}
    <div class="workspace-grid">
      <aside class="panel sticky-result">
        <div class="result-caption"><span>Modified weight</span><strong>${fmt(after.weight)} <small>lb</small></strong>
        <span>${delta(after.weight - before.weight)} lb vs original</span></div>
        <div class="result-body">
        ${massMetrics(before, after)}
        <p class="takeaway">${massMessage}</p>
        ${axleGraphic(before, after)}
        ${concept('moments')}
        </div>
      </aside>
      <div class="stack">
        <section class="panel content-panel">
          <h2>Try a modification</h2>
          <div class="quick-grid">${Object.entries(presets).filter(([, p]) => !p.firebird || setup.id === 'firebird').map(([key, p]) =>
            `<button class="preset" data-preset="${key}" ${setup.parts.some(x => x.preset === key) ? 'disabled' : ''}>
              <strong>${p.label}</strong><span>${p.note}</span></button>`).join('')}</div>
          <div id="preset-form"></div>
          ${partForm()}
          <div class="parts">${setup.parts.map((p, i) => `<div><span><strong>${escape(p.label)}</strong>
            <small>${fmt(p.oldWeight, 1)} lb at ${fmt(p.oldX, 1)} in → ${fmt(p.newWeight, 1)} lb at ${fmt(p.newX, 1)} in</small></span>
            <button class="button secondary small" data-remove="${i}" aria-label="Undo ${escape(p.label)}">Undo</button></div>`).join('')}</div>
          <div class="actions"><button class="button primary" data-action="compare-build">Compare performance</button>
            <button class="button secondary" data-action="use">Use this configuration</button></div>
          <div class="actions save-row"><button class="button secondary" data-action="save">Apply to my build</button>
            ${saved ? '<button class="button secondary" data-action="load-saved">Open my saved build</button>' : ''}
            ${modified(setup) ? '<button class="button plain" data-action="reset">Reset modifications</button>' : ''}</div>
          <p class="quiet small">Experiments stay temporary. Apply to my build saves this configuration in this browser.</p>
        </section>
        <section class="panel content-panel">
          <h2>Change the specifications</h2>
          ${overrideForm('original', before, 'Original specifications', 'Enter your real readings to replace the reference inputs used for both original and modified.', inputGroups.original)}
          ${overrideForm('power', after, 'Engine, transmission and tires', 'Enter your replacement power figures, gear ratios, or tire changes. Component weights are changed separately above.', powerKeys)}
          ${overrideForm('ride', after, 'Springs and tire stiffness', 'These settings affect ride frequency.', rideKeys)}
          ${overrideForm('geometry', after, 'Center of gravity height', 'Enter a different CG height to explore load transfer. Part movements above compute only longitudinal CG.', inputGroups.geometry)}
          ${powerIssue(after) ? `<p class="warning" role="alert">${powerIssue(after)}</p>` : ''}
          ${evidence(setup)}
        </section>
      </div>
    </div>
  </section>`;
}

function compareCard(setup, key, mode) {
  const name = 'Car ' + key.toUpperCase();
  return `<div class="panel comparison-car car-${key}">
    <div class="pair-grid">${vehicleSelector(name, setup.id, {key})}${configModes(setup, key, mode)}</div>
    <p>${escape(vehicles[setup.id].trim)}</p>
    <div class="actions"><button class="button secondary small" data-edit="${key}">Edit ${name}</button>
    ${mode === 'after' ? `<span class="quiet small">${setup.parts.length} component ${setup.parts.length === 1 ? 'change' : 'changes'}</span>` : ''}</div>
  </div>`;
}

export function racePanel(runs, state) {
  const labels = ['a', 'b'].map(k => vehicles[state[k].id].name);
  const hasRun = runs.every(r => r.trace);
  return `<section class="panel race" aria-labelledby="race-title">
    <div class="race-header"><div><p class="eyebrow">Acceleration replay</p><h2 id="race-title">Quarter mile</h2></div>
      <div class="clock"><span id="race-time">0.0</span><small> s</small></div></div>
    <div class="track" aria-hidden="true">
      ${labels.map((name, i) => `<div class="lane car-${i ? 'b' : 'a'}"><div class="runner" id="runner-${i}"><span>${i ? 'B' : 'A'}</span></div></div>`).join('')}
      <div class="track-scale"><span>0 ft</span><span>330</span><span>660</span><span>990</span><span>1,320 ft</span></div>
    </div>
    <div class="live-grid">${labels.map((name, i) => `<div class="car-${i ? 'b' : 'a'}"><strong>${escape(name)}</strong>
      <span><b id="speed-${i}">0</b> mph <small id="gear-${i}">gear 1</small></span></div>`).join('')}</div>
    <div class="actions race-actions">
      <button class="button primary" data-action="play" ${hasRun ? '' : 'disabled'}>Run comparison</button>
      <button class="button secondary" data-action="share" ${hasRun ? '' : 'disabled'}>Share this result</button>
    </div>
    <label class="scrubber">Replay position <input id="scrubber" type="range" min="0" max="1000" value="0" ${hasRun ? '' : 'disabled'}></label>
    <div id="share-feedback" role="status"></div>
    ${runs.map((r, i) => r.issue ? `<p class="warning">${i ? 'Car B' : 'Car A'} · ${escape(r.issue)}</p>` :
      !r.finish ? `<p class="warning">${i ? 'Car B' : 'Car A'} did not reach 1,320 ft within the 45 s model limit.</p>` : '').join('')}
  </section>`;
}

export function compare(state, a, b, runs) {
  const [ra, rb] = runs;
  const gap = ra.finish && rb.finish ? Math.abs(ra.finish.t - rb.finish.t) : null;
  const faster = gap === null ? '' : gap < .05 ? 'The quarter-mile estimates are within 0.05 s.' :
    `Car ${ra.finish.t < rb.finish.t ? 'A' : 'B'} reaches 1,320 ft ${fmt(gap, 1)} s sooner in this model.`;
  return `<section class="shell workspace">
    ${pageTitle('Performance', 'Compare project cars', 'Choose a car in each lane. Compare stock setups or bring in your own modifications.')}
    <div class="compare-grid">
      <div class="stack">
        ${compareCard(state.a, 'a', state.aMode)}
        ${compareCard(state.b, 'b', state.bMode)}
        <section class="panel content-panel same-change"><h2>Try the same change</h2>
          <p>Remove 50 lb from the rear cabin of both cars. The weight sits 70% of the way from front to rear axle.</p>
          <button class="button secondary" data-action="same-change" ${[state.a, state.b].every(s => s.parts.some(p => p.preset === 'remove')) ? 'disabled' : ''}>Apply to both cars</button>
        </section>
      </div>
      <div class="stack">
        ${racePanel(runs, state)}
        <section class="panel content-panel">
          <div class="section-heading"><h2>Estimated results</h2><span class="quiet small">Equal grip starts at 0.90</span></div>
          ${metricTable([['0–60 mph', ra.zeroTo60, rb.zeroTo60, 's', 1],
          ['Quarter mile', ra.finish?.t, rb.finish?.t, 's', 1],
          ['Speed at finish', ra.finish?.trap, rb.finish?.trap, 'mph', 0],
          ['Weight per horsepower', a.weight / a.hp, b.weight / b.hp, 'lb/hp', 1]], ['Car A', 'Car B'], true)}
          <p class="takeaway">${faster || 'Check the input warnings before interpreting the comparison.'}</p>
          ${explanation('What the simulation assumes',
            'The model calculates drive force from an estimated torque curve, gear ratios, tire radius and drivetrain loss. A rear-axle grip limit, drag, rolling resistance and a shift delay affect every step. Results show comparative sensitivity on a level strip. Launch grip, dyno curves, actual shift points and vehicle drag need independent validation.')}
          <details class="explain"><summary>Published test checkpoints</summary>
            ${metricTable([['0–60 mph', a.test60, b.test60, 's', 1],
              ['Quarter mile', a.testEt, b.testEt, 's', 1], ['Reported trap', a.testTrap, b.testTrap, 'mph', 1]], ['Car A stock', 'Car B stock'], true)}
            <p>Tests describe the stock references and their reported conditions. A modified result has no paired road test. Modeled finish speed is instantaneous, while a published trap may be averaged over a timing interval.</p></details>
          <details class="explain"><summary>Weight and balance comparison</summary>${massMetrics(a, b, true)}</details>
          ${explanation('Why gearing changes acceleration', 'A shorter gear multiplies torque more, but reaches shift RPM at a lower speed. A shift can use up the time gained from shorter gearing. Tire diameter changes both leverage and speed at each RPM.')}
          <details class="explain"><summary>Inputs for both cars</summary><h3>Car A</h3>
            ${evidence(state.a, state.aMode === 'after' || Object.keys(state.a.base).length > 0)}
            <h3>Car B</h3>${evidence(state.b, state.bMode === 'after' || Object.keys(state.b.base).length > 0)}</details>
        </section>
      </div>
    </div></section>`;
}

function slider(name, label, value, unit, min, max, step) {
  return `<label class="slider"><span>${label} <output id="out-${name}">${value} ${unit}</output></span>
    <input type="range" data-slider="${name}" id="slider-${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

export function toolResults(before, after, settings) {
  const prior = tireLoads(before, settings.brake, settings.lateral);
  const now = tireLoads(after, settings.brake, settings.lateral);
  const invalid = prior.invalid || now.invalid;
  const overGrip = Math.hypot(settings.brake, settings.lateral) > after.grip;
  const tires = ['Left front', 'Right front', 'Left rear', 'Right rear'];
  const rideBefore = ['front', 'rear'].map(axle => ride(before, axle));
  const rideNow = ['front', 'rear'].map(axle => ride(after, axle));
  const lightest = now.tires.indexOf(Math.min(...now.tires));
  const first = invalid ? 'The simplified model reaches a wheel-lift or roll-axis limit.' :
    `${tires[lightest]} carries ${fmt(now.tires[lightest])} lb in this turn.`;
  return {
    loads: `<div class="tire-diagram" role="img" aria-label="${invalid ? first : tires.map((t, i) => t + ' ' + fmt(now.tires[i]) + ' lb').join(', ')}">
      ${now.tires.map((v, i) => `<div class="${i === lightest ? 'light-tire' : ''}"><i style="--tire-fill:${Math.min(100, Math.max(0, v / after.weight * 245)).toFixed(0)}%"></i>
        <span>${tires[i]} <b>${invalid ? '—' : fmt(v) + ' lb'}</b></span></div>`).join('')}</div>
      <p class="${invalid || overGrip ? 'warning' : 'takeaway'}">${first}
        ${overGrip ? ' Combined demand exceeds the selected grip in the simple friction circle.' : ''}</p>
      ${metricTable(tires.map((t, i) => [t, prior.invalid ? null : prior.tires[i], now.invalid ? null : now.tires[i], 'lb']))}`,
    ride: `${metricTable(['Front', 'Rear'].flatMap((name, i) => [
      [name + ' frequency', rideBefore[i].hz, rideNow[i].hz, 'Hz', 2],
      [name + ' wheel rate', rideBefore[i].wheel, rideNow[i].wheel, 'lb/in'],
    ]))}
    <p class="${rideNow.some(r => r.hz === null) || rideBefore.some(r => r.hz === null) ? 'warning' : 'takeaway'}">${rideNow.some(r => r.hz === null) || rideBefore.some(r => r.hz === null) ?
      'A corner has no sprung weight. Check the unsprung-weight inputs.' :
      `The modified front rides at ${fmt(rideNow[0].hz, 2)} Hz. A higher value means quicker body bounce in this simplified model.`}</p>`,
  };
}

const calculatorLink = (state, target) => `../tools/${target}/${escape(state)}`;

export function toolsView(state, settings, bridgeHash, saved) {
  const setup = state[state.focus];
  const before = resolve(setup, false);
  const after = resolve(setup);
  const result = toolResults(before, after, settings);
  return `<section class="shell workspace">
    ${pageTitle('Engineering tools', 'See what changes', 'Use the same original and modified car to explore tire loads and ride frequency.')}
    ${setupPicker(setup, `Car ${state.focus.toUpperCase()}`)}
    <div class="actions tool-actions"><button class="button secondary" data-edit="${state.focus}">Edit vehicle setup</button>
      ${saved ? '<button class="button secondary" data-action="load-saved">Use my saved build</button>' : ''}</div>
    <div class="tool-grid">
      <section class="panel content-panel">
        <h2>Load transfer</h2>
        <p class="quiet small">Turning right. Example roll stiffness and roll-center inputs match the ESS Grip Lab.</p>
        <div class="tool-controls">${slider('brake','Braking', settings.brake, 'g', 0, 1.2, .01)}
        ${slider('lateral','Cornering', settings.lateral, 'g', 0, 1.2, .01)}</div>
        <div id="load-result">${result.loads}</div>
        ${concept('transfer')}${concept('grip')}
        <p><a id="load-link" href="${calculatorLink(bridgeHash, 'load-transfer')}">Open full load transfer calculator</a></p>
      </section>
      <section class="panel content-panel">
        <h2>Spring rate &amp; ride frequency</h2>
        <p class="quiet small">Move the spring rate to test a change. Starting spring and tire rates are illustrative.</p>
        <div class="tool-controls">${slider('frontSpring', 'Front spring', after.frontSpring, 'lb/in', 40, 2000, 1)}
        ${slider('rearSpring', 'Rear spring', after.rearSpring, 'lb/in', 40, 2000, 1)}</div>
        <div id="ride-result">${result.ride}</div>
        ${concept('ride')}
        <p><a id="spring-link" href="${calculatorLink(bridgeHash, 'spring-rate')}">Open full spring rate calculator</a></p>
      </section>
    </div>
    ${evidence(setup)}
  </section>`;
}

export function learn() {
  return `<section class="shell workspace">
    ${pageTitle('Engineering notes', 'Try the physics', 'Explore how weight, force and grip affect a car. Your experiment stays open in the Lab.')}
    <div class="tool-grid">
      <section class="panel content-panel"><h2>Balance and response</h2>
      ${concept('moments')}${concept('inertia')}${concept('torque', `
        ${slider('lever', 'Lever arm', 1, 'ft', .25, 4, .05)}
        <p class="takeaway" id="torque-demo">50 lb of force makes 50.0 lb-ft of torque.</p>`)}
      <p><a href="../articles/weight-distribution-50-50/">Read about weight distribution</a></p></section>
      <section class="panel content-panel"><h2>Grip and ride</h2>${concept('transfer')}${concept('grip')}${concept('ride')}
      <p><a href="../articles/traction-circle/">Read about the traction circle</a></p></section>
    </div>
    <section class="panel content-panel evidence-history"><h2>What the ESS Firebird measured</h2>
      <p>The cars and load states below differ. They show the build history and which measurements are still needed.</p>
      <dl class="evidence">${firebirdEvidence.map(([weight, note]) => `<div><dt>${weight}</dt><dd>${note}</dd></div>`).join('')}</dl>
      <p><a href="../articles/measured-firebird-weights/">Inspect the ESS component measurements</a></p>
    </section>
  </section>`;
}
