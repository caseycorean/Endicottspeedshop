import { getSaved, example, readFragment, shareFragment, modified } from './configuration.mjs';
import { resolve, newSetup } from './models.mjs';
import { vehicles } from './vehicles.mjs';
import { vehicleSelector } from './ui.mjs';

function fillCalculator(tool, setup, mode, settings) {
  const v = resolve(setup, mode === 'after');
  const fields = { w: v.weight, fp: v.front * 100 };
  if (tool === 'load-transfer') {
    Object.assign(fields, { wb: v.wheelbase, h: v.cg, tf: v.frontTrack, tr: v.rearTrack });
    if (settings) Object.assign(fields, { ax: settings.brake, ay: settings.lateral, lm: 'b', dirn: 'r' });
  }
  if (tool === 'spring-rate') Object.assign(fields, {
    uf: v.frontUnsprung, ur: v.rearUnsprung, kt: v.tireRate,
    sf: v.frontSpring, sr: v.rearSpring, mf: v.frontMotion, mr: v.rearMotion,
    af: 0, ar: 0,
  });
  for (const [id, value] of Object.entries(fields)) {
    const input = document.getElementById(id);
    if (input) input.value = typeof value === 'number' ? String(+value.toFixed(5)) : value;
  }
  // Inputs are populated as a group before invoking the existing calculation listener.
  document.getElementById('w').dispatchEvent(new Event('input', { bubbles: true }));
}

for (const panel of document.querySelectorAll('[data-ess-vehicle]')) {
  const tool = panel.dataset.essVehicle;
  const saved = getSaved();
  const incoming = readFragment(location.hash);
  const state = incoming.state ?? example();
  const selected = state[state.focus];
  const full = 'Use this configuration';
  const target = tool === 'article' ? 'tools' : 'build';

  panel.innerHTML = `<details><summary>Use an ESS vehicle configuration</summary>
    <div class="ess-selector-fields">${vehicleSelector('Reference vehicle', selected.id)}
    <button type="button" class="btn-small" data-apply="reference">${full}</button>
    ${saved ? '<button type="button" class="btn-small" data-apply="saved">Use my saved build</button>' : ''}</div>
    <p class="hint">Estimates fill gaps in the reference data. Check the inputs against your own car.</p>
    </details>
    <p class="hint" data-feedback role="status"></p>
    <a class="ess-config-link" href="../../experience/#${target}">Open Vehicle Lab</a>`;

  const picker = panel.querySelector('select');
  const feedback = panel.querySelector('[data-feedback]');
  const lab = panel.querySelector('.ess-config-link');
  const setConfig = (setup, mode, settings) => {
    if (tool !== 'article') fillCalculator(tool, setup, mode, settings);
    const linkState = { ...state, [state.focus]: setup, [state.focus + 'Mode']: mode };
    lab.hash = shareFragment(linkState, target);
    const name = vehicles[setup.id].name;
    const qualifier = mode === 'after' ? 'modified' : Object.keys(setup.base).length ? 'original' : 'stock-based';
    feedback.textContent = `${name} · ${qualifier} configuration selected. ${tool === 'article' ? 'Open Vehicle Lab to use it in an experiment.' : 'Calculator inputs have been updated.'}`;
  };

  panel.addEventListener('click', event => {
    const source = event.target.closest('button[data-apply]')?.dataset.apply;
    if (!source) return;
    const s = source === 'saved' && saved ? saved : newSetup(picker.value);
    setConfig(s, modified(s) ? 'after' : 'before');
    picker.value = s.id;
  });

  if (incoming.state) {
    panel.querySelector('details').open = true;
    // Vehicle Lab tools show the modified result; carry it through regardless of race lane selection.
    setConfig(selected, modified(selected) ? 'after' : 'before', state.tool);
  } else if (incoming.invalid) {
    feedback.textContent = 'The experiment link could not be read. The original calculator inputs are ready to use.';
  }
}
