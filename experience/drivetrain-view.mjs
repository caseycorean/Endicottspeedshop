import { components, componentLabels } from './components.mjs';
import { resolve, tractionReadout } from './models.mjs';
import { escape, fmt } from './ui.mjs';

export function drivetrainPanel(setup, {open = false} = {}) {
  return `<details class="explain swap-panel" data-details="drivetrain" ${open ? 'open' : ''}><summary>Engine, transmission and traction</summary>
    <div class="pair-grid">
    ${Object.entries(components).map(([kind, list]) => `<label><span>${componentLabels[kind]}</span>
      <select data-component="${kind}"><option value="">Use original</option>
      ${Object.entries(list).filter(([id,item]) => !item.hidden || setup.components?.[kind] === id).map(([id, item]) => `<option value="${id}" ${setup.components?.[kind] === id ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}
      </select></label>`).join('')}
    </div>
    ${tractionPanel(resolve(setup))}
    <p class="small"><a href="#performance">Compare tire classes and check every gear</a></p>
    <details class="explain"><summary>How gearing changes grip</summary>
      <p>Wheel force equals engine torque multiplied by gear ratio, final drive and efficiency, divided by tire radius.
      The launch calculation compares that demand with the grip available at the driven tires after load transfer.</p>
      <p>The converter can multiply torque in an automatic while it is slipping. The model uses an estimated converter curve and checks force at its own launch condition.</p></details>
    <details class="explain"><summary>Component sources and assumptions</summary>
      <p>Engine, transmission and tire assumptions carry into applicable studies. To model installation weight, enter the actual or estimated part mass and position in Build.</p>
      ${Object.entries(setup.components ?? {}).map(([kind,id]) => {const spec = components[kind][id];
       return `<p>${escape(spec.name)}. ${escape(spec.evidence ?? '')}. ${escape(spec.note ?? '')}
        ${spec.mass ? ` Library mass: ${spec.mass.value ?? (spec.mass.low + '–' + spec.mass.high)} lb · ${escape(spec.mass.evidence)} · ${escape(spec.mass.basis ?? '')}.` : ''}${spec.url ? ` <a href="${escape(spec.url)}" rel="noreferrer" target="_blank">Source</a>` : ''}</p>`;}).join('')}
      <p>Traction is an illustration at the model's launch condition. Equal grip at all driven tires is idealized. Surface, tire temperature, slip, and available engine torque vary. Automatic converter multiplication and shift behavior are estimates.</p></details>
  </details>`;
}

export function tractionPanel(v) {
  const r = tractionReadout(v);
  if (!r) return '<div data-traction-result><p class="quiet small">Add the missing weight and drivetrain inputs to see gearing and grip.</p></div>';
  return `<div data-traction-result class="traction-panel" data-level="${r.color}">
    <strong>${r.color === 'red' ? 'Grip limits launch force' : r.color === 'yellow' ? 'Near the modeled grip limit' : 'Modeled grip reserve'}</strong>
    <div class="force-meter" role="img" aria-label="Modeled launch demand uses ${fmt(r.utilization * 100)} percent of grip."
      style="--force-mark:${Math.min(100, 100 * r.utilization / 1.6)}%"><span></span></div>
    <p class="force-caption">${fmt(r.demand)} lbf demand · ${fmt(r.limit)} lbf available · ${fmt(r.utilization * 100)}% utilization</p>
    <p>${r.color === 'red' ? 'A shorter gear adds wheel torque, but the tires already set the launch limit.' :
      r.color === 'yellow' ? 'A small gearing or grip change can move the launch across the traction limit.' :
      'A shorter gear may increase launch force. Check how soon it reaches shift RPM.'}</p>
    <p>${fmt(r.rear)} lb dynamic rear load · ${fmt(r.mphInFirst, 1)} mph at shift RPM in first · ${fmt(r.cruiseRpm)} rpm at 70 mph</p>
  </div>`;
}
