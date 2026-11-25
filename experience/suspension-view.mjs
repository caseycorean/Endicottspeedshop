import { linkLayout, layouts, solveRearLinks, stages } from './rear-links.mjs';
import { escape, fmt } from './ui.mjs';

const colors = {lower: '#b3a487', upper: '#ffb971', lateral: '#8bcdb7', slider: '#9fc8ed'};
const dimensions = [
  {name: 'Forward from axle (in)', min: -12, max: 60},
  {name: 'Right of center (in)', min: -30, max: 30},
  {name: 'Height above road (in)', min: 5, max: 30},
];

function dial(id, name, min, max, step, value) {
  return `<label class="slider"><span>${name} <output data-link-value="${id}">${value}</output></span>
    <input type="range" data-link-input="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

export function suspensionView(activeName) {
  return `<section class="shell workspace suspension-workspace" data-suspension-lab>
    <header class="page-title"><p class="eyebrow">Engineering experiments</p><h1>Rear suspension</h1>
      <p class="lede">Move a mount. Raise or roll the axle. Watch the links and the constraint change together.</p></header>
    <div class="susp-controller panel content-panel">
      <label><span>Link layout</span><select data-link-layout>${Object.entries(layouts).map(([id, l]) => `<option value="${id}">${l.name}</option>`).join('')}</select></label>
      <div class="tool-controls">
        ${stages.map(({id, name, min, max, step}) => dial(id, name, min, max, step, 0)).join('')}
      </div>
      <div class="actions"><button class="button secondary small" data-link-quick="roll">Try 8° roll</button>
      <button class="button secondary small" data-link-quick="reset">Reset pose</button></div>
      <p data-link-status class="link-status" role="status"></p>
      <dl class="link-readout" data-link-readout></dl>
      <div class="link-canvas-grid"><figure><figcaption>Side view · front to the right</figcaption>
        <canvas width="580" height="225" data-link-canvas="side" role="img" aria-label="Side projection of axle and link positions"></canvas></figure>
        <figure><figcaption>Top view · front to the right</figcaption>
        <canvas width="580" height="225" data-link-canvas="top" role="img" aria-label="Plan projection of axle and link positions"></canvas></figure></div>
    </div>
    <div class="tool-grid">
      <section class="panel content-panel">
        <h2>Move a mounting point</h2>
        <div class="pair-grid"><label><span>Link</span><select data-picked-link></select></label>
          <label><span>End</span><select data-link-end><option value="chassis">Chassis</option><option value="axle">Axle</option></select></label></div>
        <div class="link-mount-inputs" data-mount-inputs></div>
        <p class="quiet small">Link lengths are set from the edited ride-height coordinates. The blue arm guide constrains height only.</p>
        <button class="button secondary small" data-link-quick="mounts">Restore example mounts</button>
      </section>
      <section class="panel content-panel">
        <h2>Vehicle assumptions</h2>
        <div class="tool-controls">${dial('wheelbase','Wheelbase (in)',75,160,.1,108)}${dial('cg','CG height (in)',8,34,.1,20)}</div>
        <p class="quiet small" data-link-assumptions>Illustrative live-axle geometry and vehicle dimensions.</p>
        ${activeName ? `<button class="button secondary small" data-link-quick="garage">Use dimensions from ${escape(activeName)}</button>` : ''}
        <details class="explain"><summary>Instant center and anti-squat</summary><p>In level, symmetric travel the side-view link lines meet at a virtual pivot. The anti-squat estimate compares the slope from the rear tire contact patch to that pivot against CG height divided by wheelbase. It applies to the idealized rear-drive longitudinal force. For a torque arm, the height-only guide makes a vertical constraint line through the current nose. Roll, nonphysical fits and unresolved intersections suppress the readout.</p></details>
        <details class="explain"><summary>Leaf spring reference and model limits</summary><p>A conventional leaf spring locates and supports the axle through the eyes, spring and shackle. The axle path and windup depend on spring deformation and shackle geometry. This fixed-length solver covers rod-link layouts and a simplified torque-arm guide. Real bushings, joints, springs, dampers, stops, clearances, strength and safety require separate checks. Green reports agreement with these modeled constraints only.</p></details>
      </section>
    </div>
  </section>`;
}

function draw(canvas, view, links, result, selected) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const {width, height} = canvas;
  const xMax = Math.max(48, ...links.map(l => l.chassis[0]), view === 'side' && result.center ?
    Math.min(110, result.center[0] + 4) : 0);
  const xMin = Math.min(-10, ...links.map(l => l.axle[0])) - 2;
  const x = n => 21 + (n - xMin) / (xMax - xMin) * (width - 42);
  const y = view === 'side' ? z => height - 26 - z * 5.5 : q => height / 2 + q * 3.12;
  const point = p => [x(p[0]), y(p[view === 'side' ? 2 : 1])];
  const line = (a, b, color, size = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = size;
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  };
  ctx.fillStyle = '#141b21'; ctx.fillRect(0, 0, width, height);
  for (let i = Math.ceil(xMin / 10) * 10; i <= xMax; i += 10) line([x(i), 10], [x(i),height - 12], '#2b363d');
  line([15,y(0)], [width - 15,y(0)], '#68777c');
  const axle = result.pose ?? [0,0,0,0];
  if (view === 'side') {
    const rear = point([axle[0], axle[1], (result.radius ?? 13) + (result.heave ?? 0)]);
    ctx.beginPath(); ctx.arc(...rear, 32, 0, 2 * Math.PI); ctx.strokeStyle = '#697578'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(...rear, 5, 0, 2 * Math.PI); ctx.fillStyle = '#d2d6cf'; ctx.fill();
  } else {
    const deltaX = 26 * Math.sin(axle[3]);
    line(point([axle[0] + deltaX, axle[1] - 26, 0]), point([axle[0] - deltaX, axle[1] + 26, 0]), '#b5bbb8', 4);
  }
  const center = result.center;
  if (view === 'side' && center && center[0] <= xMax && center[0] >= xMin && center[1] >= 0 && center[1] <= 32) {
    const ic = [x(center[0]), y(center[1])];
    ctx.setLineDash([8, 5]);
    line([x(result.lowerLine[0][0]), y(result.lowerLine[0][1])], ic, colors.lower);
    if (!links.some(l => l.group === 'slider')) line([x(result.upperLine[0][0]), y(result.upperLine[0][1])], ic, colors.upper);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffdda8'; ctx.fillText('IC', ic[0] - 10, ic[1] - 11);
    ctx.beginPath(); ctx.arc(...ic, 4, 0, 2 * Math.PI); ctx.fill();
  }
  for (const [index, link] of (result.current ?? links).entries()) {
    const rear = point(link.current ?? link.axle);
    const front = point(link.chassis);
    const color = colors[link.group];
    ctx.setLineDash(index === selected ? [] : [6, 3]);
    if (link.group === 'slider' && view === 'side') {
      line([rear[0], rear[1] - 20], [rear[0], rear[1] + 20], color, 3);
    } else line(rear, front, color, index === selected ? 4 : 2.4);
    ctx.setLineDash([]);
    for (const p of [rear, front]) {
      ctx.beginPath(); ctx.arc(...p, index === selected ? 5.5 : 3.8, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
  }
  ctx.font = '13px monospace';
  ctx.fillStyle = '#a9b3b4';
  ctx.fillText(view === 'side' ? 'ROAD DATUM' : 'CENTERLINE', 15, height - 8);
}

export function mountSuspension(root, reference) {
  const panel = root.querySelector('[data-suspension-lab]');
  if (!panel) return;
  const layout = panel.querySelector('[data-link-layout]');
  const pick = panel.querySelector('[data-picked-link]');
  const end = panel.querySelector('[data-link-end]');
  const axes = panel.querySelector('[data-mount-inputs]');
  const status = panel.querySelector('[data-link-status]');
  const readout = panel.querySelector('[data-link-readout]');
  let links = linkLayout(layout.value);
  let state = {heave: 0, roll: 0, wheelbase: 108, cg: 20};
  function pickFields(refreshOptions = false) {
    if (refreshOptions) pick.innerHTML = links.map((l, i) => `<option value="${i}">${l.name}</option>`).join('');
    const current = links[Number(pick.value)];
    axes.innerHTML = dimensions.map(({name, min, max}, i) =>
      current.group === 'slider' && end.value === 'chassis' && i !== 2 ? '' :
        dial('axis-' + i, name, min, max, .25, current[end.value][i])).join('');
  }
  function update() {
    const result = solveRearLinks(links, state);
    status.dataset.level = result.level;
    status.textContent = result.message + (Number.isFinite(result.residual) ? ' Max mismatch ' + fmt(result.residual, 3) + ' in.' : '');
    const metrics = [
      ['Instant center', result.center ? fmt(result.center[0], 1) + ' in forward · ' + fmt(result.center[1], 1) + ' in high' : '—'],
      ['Anti-squat', Number.isFinite(result.antiSquat) ? fmt(result.antiSquat, 0) + '%' : '—'],
      ['Axle shift', result.pose ? fmt(result.pose[0], 2) + ' fore/aft · ' + fmt(result.pose[1], 2) + ' lateral (in)' : '—'],
      ['Axle steer / pitch', result.pose ? fmt(result.yaw, 2) + '° / ' + fmt(result.pitch, 2) + '°' : '—'],
    ];
    readout.innerHTML = metrics.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    for (const canvas of panel.querySelectorAll('canvas')) draw(canvas, canvas.dataset.linkCanvas, links, result, Number(pick.value));
  }
  panel.addEventListener('input', event => {
    const key = event.target.dataset.linkInput;
    if (!key) return;
    const n = Number(event.target.value);
    if (key.startsWith('axis-')) links[Number(pick.value)][end.value][Number(key.slice(-1))] = n;
    else state[key] = n;
    panel.querySelector(`[data-link-value="${key}"]`).value = n;
    update();
  });
  panel.addEventListener('change', event => {
    if (event.target === layout) {
      links = linkLayout(layout.value);
      pickFields(true);
    } else if (event.target === pick || event.target === end) pickFields();
    else return;
    update();
  });
  panel.addEventListener('click', ({target}) => {
    const key = target.closest('[data-link-quick]')?.dataset.linkQuick;
    if (!key) return;
    if (key === 'garage') {
      if (Number.isFinite(reference?.wheelbase) && Number.isFinite(reference?.cg)) {
        state = {...state, wheelbase: reference.wheelbase, cg: reference.cg};
        panel.querySelector('[data-link-assumptions]').textContent = 'Wheelbase and CG height use the active build. Missing source provenance is shown in My Garage.';
      } else panel.querySelector('[data-link-assumptions]').textContent = 'Add wheelbase and CG height to the active build before applying it.';
    }
    if (key === 'roll') state.roll = 8;
    if (key === 'reset') Object.assign(state, {heave: 0, roll: 0});
    if (key === 'mounts') { links = linkLayout(layout.value); pickFields(); }
    for (const [field, n] of Object.entries(state)) {
      panel.querySelector(`[data-link-input="${field}"]`).value = n;
      panel.querySelector(`[data-link-value="${field}"]`).value = n;
    }
    update();
  });
  pickFields(true);
  update();
}
