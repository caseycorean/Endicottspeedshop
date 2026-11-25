import { components } from './components.mjs';
import { resolve, tractionReadout } from './models.mjs';
import { escape, fmt } from './ui.mjs';

export function drivetrainPanel(setup, {open = false} = {}) {
  return `<details class="explain swap-panel" data-details="drivetrain" ${open ? 'open' : ''}><summary>Engine, transmission and traction</summary>
    <div class="pair-grid">
    ${Object.entries(components).map(([kind, list]) => `<label><span>${kind === 'engine' ? 'Engine' : 'Transmission'}</span>
      <select data-component="${kind}"><option value="">Use original</option>
      ${Object.entries(list).map(([id, item]) => `<option value="${id}" ${setup.components?.[kind] === id ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}
      </select></label>`).join('')}
    </div>
    ${tractionPanel(resolve(setup))}
    <details class="explain"><summary>Component sources and assumptions</summary>
      <p>Engine and transmission choices change power or gear ratios independently. Enter installation mass and position as separate component changes. Check fitment and clutch, converter and bellhousing requirements on the actual car.</p>
      ${Object.entries(setup.components ?? {}).map(([kind,id]) => {const spec = components[kind][id];
       return `<p>${escape(spec.name)}. ${escape(spec.note)}${spec.url ? ` <a href="${escape(spec.url)}" rel="noreferrer" target="_blank">Source</a>` : ''}</p>`;}).join('')}
      <p>Traction is an illustration at the model's launch condition. Equal grip at all driven tires is idealized. Surface, tire temperature, slip, and available engine torque vary. Automatic converter multiplication and shift behavior are estimates.</p></details>
  </details>`;
}

export function tractionPanel(v) {
  const r = tractionReadout(v);
  if (!r) return '<div data-traction-result><p class="quiet small">Add the missing weight and drivetrain inputs to see gearing and grip.</p></div>';
  return `<div data-traction-result class="traction-panel" data-level="${r.color}">
    <strong>${r.color === 'red' ? 'Grip limits launch force' : r.color === 'yellow' ? 'Near the modeled grip limit' : 'Modeled grip reserve'}</strong>
    <p>${fmt(r.demand)} lbf demand · ${fmt(r.limit)} lbf available · ${fmt(r.utilization * 100)}% utilization</p>
    <p>${fmt(r.rear)} lb dynamic rear load · ${fmt(r.mphInFirst, 1)} mph at shift RPM in first · ${fmt(r.cruiseRpm)} rpm at 70 mph</p>
  </div>`;
}
