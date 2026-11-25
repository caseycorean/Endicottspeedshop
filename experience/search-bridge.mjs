import { getSaved, getActive, useConfig, example, readFragment, shareFragment, modified, modeOf } from './configuration.mjs';
import { resolve, newSetup } from './models.mjs';
import { vehicleSelector, escape } from './ui.mjs';
import { setupName } from './matchup.mjs';
import { installCatalog } from './catalog.mjs';

installCatalog();

const filledMessage = {
  'load-transfer': 'Weight and geometry have been applied.',
  'spring-rate': 'Weight and suspension parameters have been applied.',
  'cg-builder': 'Weight and geometry have been applied. Left/right starts at 50% until you enter measurements.',
  'scale-delta': 'Wheelbase and mean track have been applied. Use your own scale readings.',
  'weight-distribution-calculator': 'Weight, front percentage and wheelbase have been applied.',
};

function fillCalculator(tool, setup, mode, settings) {
  const v = resolve(setup, mode === 'after');
  const weight = {w: v.weight, fp: Number.isFinite(v.front) ? v.front * 100 : null};
  const mapping = {
    'load-transfer': {...weight, wb: v.wheelbase, h: v.cg, tf: v.frontTrack, tr: v.rearTrack,
      ...(settings ? {ax: settings.brake, ay: settings.lateral, lm: 'b', dirn: 'r'} : {})},
    'spring-rate': {...weight, uf: v.frontUnsprung, ur: v.rearUnsprung, kt: v.tireRate,
      sf: v.frontSpring, sr: v.rearSpring, mf: v.frontMotion, mr: v.rearMotion, af: 0, ar: 0},
    'cg-builder': {mode: 'total', wb: v.wheelbase, tf: v.frontTrack, tr: v.rearTrack,
      tot: v.weight, fpct: weight.fp, hcg: v.cg, lpct: 50},
    'scale-delta': {wb: v.wheelbase, tw: (v.frontTrack + v.rearTrack) / 2},
    'weight-distribution-calculator': {totalWeight: v.weight, frontPct: weight.fp, wheelbase: v.wheelbase},
  };
  const fields = mapping[tool];
  if (!fields) return;
  for (const [id, value] of Object.entries(fields)) {
    const input = document.getElementById(id);
    if (input && value != null) input.value = typeof value === 'number' ? String(+value.toFixed(5)) : value;
  }
  // Populate the group before invoking the existing calculator.
  const first = document.getElementById(Object.keys(fields)[0]);
  first?.dispatchEvent(new Event(tool === 'cg-builder' ? 'change' : 'input', {bubbles: true}));
  return Object.values(fields).some(value => value == null);
}

for (const panel of document.querySelectorAll('[data-ess-vehicle]')) {
  const tool = panel.dataset.essVehicle;
  const saved = getSaved();
  const active = getActive();
  const incoming = readFragment(location.hash);
  const state = incoming.state ?? example();
  const selected = incoming.state ? {setup: state[state.focus], mode: modeOf(state, state.focus)} : active;
  const isArticle = !Object.hasOwn(filledMessage, tool);
  const target = isArticle ? 'tools' : 'build';
  const labRoot = panel.dataset.labRoot || '../../experience/';

  panel.innerHTML = `<details><summary>Vehicle configuration <span data-active-name></span></summary>
    <div class="ess-selector-fields">${vehicleSelector('Reference vehicle', selected?.setup.id ?? state.a.id, {name: selected ? setupName(selected.setup) : 'Choose your car'})}
    ${saved ? '<button type="button" class="btn-small" data-apply="saved">Use my saved build</button>' : ''}</div>
    <p class="hint">Reference estimates are editable in Vehicle Lab. Your active configuration follows you across ESS on this browser.</p>
    </details>
    <p class="hint" data-feedback role="status"></p>
    <a class="ess-config-link" href="${escape(labRoot)}#${target}">${isArticle ? 'Try it in Vehicle Lab' : 'Edit in Vehicle Lab'}</a>`;

  const picker = panel.querySelector('[data-open-catalog]');
  const feedback = panel.querySelector('[data-feedback]');
  const activeName = panel.querySelector('[data-active-name]');
  const lab = panel.querySelector('.ess-config-link');
  const setConfig = (setup, mode, settings, indicateActive) => {
    const hasMissing = fillCalculator(tool, setup, mode, settings);
    const linkState = {...state, [state.focus]: setup, [state.focus + 'Mode']: mode};
    lab.hash = shareFragment(linkState, target);
    const name = setupName(setup);
    activeName.textContent = ' · ' + name;
    picker.textContent = name;
    const qualifier = mode === 'after' ? 'modified' : Object.keys(setup.base).length ? 'original' : 'stock-based';
    feedback.textContent = `${qualifier[0].toUpperCase() + qualifier.slice(1)} ${indicateActive ? 'active setup' : 'setup from link'}. ${filledMessage[tool] ?? 'Open Vehicle Lab for the interactive tools.'}${hasMissing ? ' Unavailable fields kept their existing inputs.' : ''}`;
  };

  panel.addEventListener('click', event => {
    const source = event.target.closest('button[data-apply]')?.dataset.apply;
    if (!source) return;
    const s = saved;
    const mode = modified(s) ? 'after' : 'before';
    const carried = useConfig(s, mode);
    setConfig(s, mode, undefined, carried);
    if (!carried) feedback.append(' Use the Vehicle Lab link to carry this setup.');

  });

  panel.addEventListener('ess:vehicle-selected', event => {
    const {id, template} = event.detail;
    const candidate = newSetup(id);
    const carried = useConfig(candidate, 'before');
    setConfig(candidate, 'before', undefined, carried);
    if (template) {
      const linkState = {...state, [state.focus]: candidate, [state.focus + 'Mode']: 'before'};
      location.href = labRoot + shareFragment(linkState, 'build');
    }
  });

  if (incoming.state) {
    const mode = incoming.view === 'tools' && modified(selected.setup) ? 'after' : selected.mode;
    setConfig(selected.setup, mode, state.tool, false);
  } else if (incoming.invalid) {
    feedback.textContent = 'The experiment link could not be read. The original calculator inputs are ready to use.';
  } else if (active && !location.hash.startsWith('#lab:')) {
    setConfig(active.setup, active.mode, undefined, true);
  }
}
