import { vehicles, vehicleIds, customEstimates } from './vehicles.mjs';
import { resolve, massIssue, choices, cleanSetup, newSetup, presets, validValue, usableSetup } from './models.mjs';
import { example, clone, modified, shareFragment, readFragment, getSaved, saveBuild, getGarage, saveToGarage, removeFromGarage, shareResult, getActive, useConfig, laneKeys, lanes, labelLane, modeOf } from './configuration.mjs';
import { home, build, toolsView, learn, inputGroups, toolResults } from './views.mjs';
import { fmt, numberField } from './ui.mjs';
import { compare, matchupEntries, comparisonResults, liveGrid, resultTime, setupName, quickImpact } from './matchup.mjs';
import { paintReplay, replayFrame } from './replay.mjs';
import { garageView } from './garage-view.mjs';
import { mountSuspension, suspensionView } from './suspension-view.mjs';
import { installCatalog } from './catalog.mjs';
import { tractionPanel } from './drivetrain-view.mjs';
import { components, componentOverrides } from './components.mjs';
import { mountCamber } from './diagrams.mjs';
import { mountFrontGeometry, frontGeometry } from './front-geometry.mjs';
import { studies, missingFor } from './readiness.mjs';
import { performanceView, performanceExplain, loadPerf, savePerf, perfDefaults, summaryHtml, tractionHtml, gearTableHtml, tireTableHtml, perfModel } from './performance-view.mjs';

const app = document.querySelector('#app');
installCatalog();
const notice = document.querySelector('#link-notice');
const status = document.querySelector('#status');
const defaults = { brake: .4, lateral: .9 };
let saved = getSaved();
const draftKey = 'ess.lab-session.v1';
function initialState(useDraft = true) {
  const selected = getActive();
  const newVehicle = new URLSearchParams(location.search).has('start');
  if (useDraft && !newVehicle) {
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey));
      const saved = draft?.selection === JSON.stringify(selected) && readFragment(draft.fragment).state;
      if (saved) return saved;
    } catch {
      // The standalone lab also works with browser storage disabled.
    }
  }
  return selected ? {...example(), a: selected.setup, aMode: selected.mode} : {...example(), a: newSetup('camaro')};
}
let state = initialState();
const entryUrl = new URL(location.href);
if (entryUrl.searchParams.has('start')) {
  entryUrl.searchParams.delete('start');
  history.replaceState(null, '', entryUrl);
}

function rememberDraft() {
  try {
    sessionStorage.setItem(draftKey, JSON.stringify({selection: JSON.stringify(getActive()), fragment: shareFragment(state)}));
  } catch {
    // The live experiment still works with browser storage disabled.
  }
}
let view = 'home';
let perf = loadPerf();
const perfViews = ['performance', 'performance-why', 'performance-math'];
let replay;
let pendingPreset;
let sharedLinkNotice = '';

const active = () => state[state.focus];
const toolSettings = () => state.tool ?? defaults;
const byId = id => document.getElementById(id);

function speak(message = '') {
  status.textContent = message;
}

function experimentUrl(page = 'compare') {
  const url = new URL('./', location.href);
  url.hash = shareFragment(state, page);
  return url.href;
}

function navigate(next) {
  sharedLinkNotice = '';
  history.pushState(null, '', '#' + next);
  render(next);
  const heading = app.querySelector('h1');
  heading?.setAttribute('tabindex', '-1');
  heading?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function applyLocation() {
  const route = readFragment(location.hash);
  if (route.state) {
    state = route.state;
    sharedLinkNotice = 'Shared experiment. Try a change or run the comparison to see it play out.';
  } else if (route.invalid) {
    state = initialState(false);
    sharedLinkNotice = 'This experiment link could not be restored. The default matchup is ready to try.';
  } else {
    sharedLinkNotice = '';
  }
  render(route.view);
  if (route.view === 'build') {
    const query = new URLSearchParams(location.search);
    if (query.get('edit') === 'original') app.querySelector('[data-details="original"]').open = true;
    const study = query.get('study');
    if (Object.hasOwn(studies, study)) {
      app.querySelector('[data-study-select]').value = study;
      app.querySelector('[data-study-select]').dispatchEvent(new Event('change', {bubbles: true}));
      app.querySelector('#data-readiness').scrollIntoView({block: 'start'});
    }
  }
}

function render(next = view, restoreDetails = false) {
  const openSections = new Map(restoreDetails ? [...app.querySelectorAll('details[data-details]')].map(el => [el.dataset.details, el.open]) : []);
  const priorFocus = restoreDetails ? app.querySelector(':focus') : null;
  const focusData = priorFocus && Object.entries(priorFocus.dataset)[0];
  stopReplay();
  pendingPreset = null;
  view = next;
  switch (view) {
    case 'build': app.innerHTML = build(state, saved); break;
    case 'compare': {
      const entries = matchupEntries(state);
      app.innerHTML = compare(state, entries);
      setReplay(entries);
      break;
    }
    case 'tools': app.innerHTML = toolsView(state, toolSettings(), shareFragment(state, 'tools'), saved); break;
    case 'garage': app.innerHTML = garageView(getGarage(), getActive()); break;
    case 'suspension': {
      const selected = getActive();
      const vehicle = selected && resolve(selected.setup, selected.mode === 'after');
      app.innerHTML = suspensionView(selected && setupName(selected.setup), vehicle) + frontGeometry(vehicle?.archFront);
      mountSuspension(app, vehicle);
      break;
    }
    case 'learn': app.innerHTML = learn(); break;
    case 'performance':
    case 'performance-why':
    case 'performance-math': {
      const setup = active();
      if (perf.vehicle !== setup.id) { perf = {...perfDefaults(), surface: perf.surface, vehicle: setup.id}; savePerf(perf); }
      app.innerHTML = view === 'performance' ? performanceView(state, perf, perfLinks()) :
        performanceExplain(state, perf, view === 'performance-why' ? 'why' : 'math');
      break;
    }
    default: app.innerHTML = home(state, saved);
  }
  mountCamber(app);
  mountFrontGeometry(app);
  rememberDraft();
  notice.textContent = sharedLinkNotice;
  notice.classList.toggle('link-notice', Boolean(sharedLinkNotice));
  for (const nav of document.querySelectorAll('nav a[data-view]')) {
    if (nav.dataset.view === view) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  }
  for (const detail of app.querySelectorAll('[data-details]')) {
    if (openSections.has(detail.dataset.details)) detail.open = openSections.get(detail.dataset.details);
  }
  if (focusData) {
    const [key, value] = focusData;
    [...app.querySelectorAll('button,select')].find(el => el.dataset[key] === value && !el.disabled)?.focus({ preventScroll: true });
  }
}

function changeFocused(next) {
  state[state.focus] = next;
  state[state.focus + 'Mode'] = modified(next) ? 'after' : 'before';
}

function commitExperiment(next, message) {
  if (!usableSetup(next)) return false;
  changeFocused(next);
  render(view, true);
  speak(message);
  return true;
}

function addPreset(setup, key) {
  const preset = presets[key];
  const part = {
    label: preset.label, preset: key,
    oldWeight: preset.oldWeight, newWeight: preset.newWeight,
    oldX: preset.oldX, newX: preset.newX,
  };
  if (key === 'remove') part.oldX = part.newX = +(resolve(setup, false).wheelbase * .7).toFixed(2);
  setup.parts.push(part);
  return part;
}

function choosePreset(key) {
  const preset = presets[key];
  const next = clone(active());
  if (!preset || next.parts.some(p => p.preset === key)) return;
  if (next.parts.length >= 8) {
    speak('The experiment can hold eight component changes. Undo one to add another.');
    return;
  }
  if (preset.requiresOld) {
    pendingPreset = key;
    byId('preset-form').innerHTML = `<form data-form="measured" class="edit-form">
      <p>${preset.note}</p><div class="input-grid">
      ${numberField('oldWeight', 'Removed package (lb)', '', { min: 1, max: 1800, required: true })}
      ${numberField('oldX', 'Removed package position (in)', preset.oldX, { min: -75, max: 220, required: true })}
      ${numberField('newX', 'Installed package position (in)', preset.newX, { min: -75, max: 220, required: true })}
      </div><label class="checkbox-line"><input type="checkbox" name="donor">
      <span>Use the donor GTO’s published 350 hp and 365 lb-ft engine ratings in simulation.</span></label>
      <button class="button secondary">Add LS1/T5 swap</button><p class="form-issue" role="alert"></p></form>`;
    byId('preset-form').querySelector('input').focus();
    return;
  }
  addPreset(next, key);
  if (!commitExperiment(next, preset.label + ' applied to the experiment.'))
    speak('This change puts the mass or axle loading outside the model limits.');
}

function numericValue(key, text) {
  if (choices[key]) return text;
  if (key === 'gears') {
    const values = text.split(',').map(s => s.trim());
    return values.every(s => /^\d*\.?\d+$/.test(s)) ? values.map(Number) : null;
  }
  if (!/^-?\d*\.?\d+$/.test(text)) return null;
  return key === 'front' ? Number(text) / 100 : Number(text);
}

app.addEventListener('submit', event => {
  const form = event.target;
  const group = form.dataset.form;
  if (!group) return;
  event.preventDefault();
  const issue = form.querySelector('.form-issue');
  const next = clone(active());
  const values = new FormData(form);
  if (group === 'part' || group === 'measured') {
    if (next.parts.length >= 8) { issue.textContent = 'The experiment can hold eight component changes.'; return; }
    if (group === 'part') {
      next.parts.push({
        label: values.get('label').trim(), oldWeight: +values.get('oldWeight'), newWeight: +values.get('newWeight'),
        oldX: +values.get('oldX'), newX: +values.get('newX'),
      });
    } else if (pendingPreset) {
      const part = addPreset(next, pendingPreset);
      Object.assign(part, { oldWeight: +values.get('oldWeight'), oldX: +values.get('oldX'), newX: +values.get('newX') });
      if (values.has('donor')) {
        const donor = stock('gto');
        for (const field of ['hp', 'hpRpm', 'torque', 'torqueRpm']) next.tune[field] = donor[field];
        next.tune.redline = donor.redline; // Illustrative shift ceiling, not a measured installed limit.
      }
    }
    if (!cleanSetup(next) || !commitExperiment(next, 'Component change applied to the experiment.'))
      issue.textContent = 'Check the part name and values. The result must stay within the mass and axle-balance limits.';
    return;
  }
  const section = group === 'original' ? 'base' : 'tune';
  if (section === 'base') {
    const name = values.get('setupName').trim();
    if (name) next.name = name;
    else delete next.name;
  }
  const benchmark = section === 'base' ? resolve({...next, base: {}}, false) : {...resolve(next, false), ...componentOverrides(next)};
  for (const key of inputGroups[group]) {
    const entered = values.get(key).trim();
    if (!entered) {
      delete next[section][key];
      continue;
    }
    const value = numericValue(key, entered);
    if (!validValue(key, value)) {
      issue.textContent = 'Check the highlighted specifications. Use positive numbers and decreasing comma-separated gear ratios.';
      form.elements.namedItem(key).focus();
      return;
    }
    const same = key === 'gears' ? value.length === benchmark[key]?.length && value.every((n, i) => n === benchmark[key][i]) :
      choices[key] ? value === benchmark[key] : Number.isFinite(benchmark[key]) && Math.abs(value - benchmark[key]) < .000051;
    if (same) delete next[section][key];
    else next[section][key] = value;
  }
  if (!commitExperiment(next, 'Specifications updated.'))
    issue.textContent = 'The resulting mass or axle balance is outside the model limits.';
});

app.addEventListener('ess:vehicle-selected', event => {
  const target = event.target.dataset.vehicleKey;
  if (!target) return;
  const key = target === 'focus' || target === 'garage' ? state.focus : target;
  const {id, template} = event.detail;
  const previous = state[key];
  if (id === previous.id && !template && target !== 'garage') return;
  if ((modified(previous) || previous.name || Object.keys(previous.base).length) && target !== 'garage' &&
      !window.confirm('Replace the current experiment in this lane? Your saved builds stay available.')) return;
  state[key] = newSetup(id);
  state[key + 'Mode'] = 'before';
  if (target === 'garage') carryLane(key, 'before');
  if (template) {
    state.focus = key;
    navigate('build');
    app.querySelector('[data-details="original"]').open = true;
  } else render(view, true);
  speak('Selected ' + vehicles[id].name + '.');
});

app.addEventListener('change', event => {
  const el = event.target;
  if (el.hasAttribute('data-study-select')) {
    for (const row of app.querySelectorAll('[data-study]')) row.hidden = row.dataset.study !== el.value;
  } else if (el.dataset.component) {
    const kind = el.dataset.component;
    const next = clone(active());
    const before = next.components?.[kind];
    if (before === el.value) return;
    const specs = components[kind][el.value] ?? components[kind][before];
    const config = {...next.components};
    if (el.value) config[kind] = el.value;
    else delete config[kind];
    next.components = config;
    for (const key of Object.keys(specs?.values ?? {})) delete next.tune[key];
    commitExperiment(next, specs ? specs.name + (el.value ? ' applied.' : ' removed.') : '');
  } else if (el.hasAttribute('data-perf-tire')) {
    perf = {...perf, tire: el.value};
    perfCommit('Tire class: ' + el.selectedOptions[0].textContent.trim() + '.');
  } else if (el.hasAttribute('data-perf-surface')) {
    perf = {...perf, surface: el.value};
    perfCommit('Surface: ' + el.selectedOptions[0].textContent.trim() + '.');
  } else if (el.hasAttribute('data-perf-fd')) {
    perfFinalDrive(Number(el.value), true);
  } else if (el.dataset.mode) {
    state[el.dataset.mode + 'Mode'] = el.value;
    render(view, true);
  }
});

function stopReplay() {
  if (replay?.frame) cancelAnimationFrame(replay.frame);
  replay = null;
}

function setReplay(entries) {
  stopReplay();
  const playable = entries.filter(e => e.run.trace);
  replay = {entries, playable, event: state.event ?? 'strip', elapsed: 0,
    duration: Math.max(0, ...playable.map(e => e.run.trace.at(-1).t))};
  updateReplay(0);
}

function updateReplay(t) {
  if (!replay) return;
  replay.elapsed = t;
  byId('race-time').textContent = t.toFixed(1);
  byId('scrubber').value = replay.duration ? Math.round(t / replay.duration * 1000) : 0;
  const samples = replayFrame(replay.playable, t);
  paintReplay(byId('race-scene'), replay.event, replay.entries, samples, t);
  for (const sample of samples) {
    const {key, mph, gear, limited, gap, finished} = sample;
    byId('speed-' + key).textContent = fmt(mph);
    byId('gear-' + key).textContent = finished ? 'Finished' : gear === 0 ?
      (replay.event === 'oval' ? 'Braking' : 'Shifting') : (limited ? 'Grip limited' : 'Gear ' + gear);
    byId('gap-' + key).textContent = t && !finished ? (gap < 1 ? 'Lead' : '−' + fmt(gap) + ' ft') : '';
  }
}

function play(button) {
  if (!replay?.duration) return;
  byId('replay-details').open = true;
  if (replay.frame) {
    cancelAnimationFrame(replay.frame);
    replay.frame = null;
    button.textContent = 'Resume comparison';
    return;
  }
  if (replay.elapsed >= replay.duration) updateReplay(0);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    updateReplay(replay.duration);
    button.textContent = 'Show final result';
    return;
  }
  let lastFrame = performance.now();
  button.textContent = 'Pause replay';
  const tick = now => {
    const rate = Number(byId('playback-rate').value);
    const t = Math.min(replay.duration, replay.elapsed + (now - lastFrame) / 1000 * rate);
    lastFrame = now;
    updateReplay(t);
    if (t < replay.duration) replay.frame = requestAnimationFrame(tick);
    else { replay.frame = null; button.textContent = 'Replay comparison'; }
  };
  replay.frame = requestAnimationFrame(tick);
}

function resetProgress() {
  if (!replay) return;
  if (replay.frame) cancelAnimationFrame(replay.frame);
  replay.frame = null;
  updateReplay(0);
  app.querySelector('[data-action="play"]').textContent = 'Run comparison';
}

function tuneComparison(key, value) {
  const current = active();
  if (value === resolve(current, false)[key] && !Object.hasOwn(componentOverrides(current), key)) delete current.tune[key];
  else current.tune[key] = value;
  state[state.focus + 'Mode'] = modified(current) ? 'after' : 'before';
  byId('quick-' + key).value = fmt(value, 2);
  const mode = app.querySelector(`[data-mode="${state.focus}"]`);
  mode.options[1].disabled = !modified(current);
  mode.value = modeOf(state, state.focus);
  if (key === 'finalDrive') for (const chip of app.querySelectorAll('[data-axle-ratio]'))
    chip.setAttribute('aria-pressed', String(Number(chip.dataset.axleRatio) === value));
  refreshComparison();
}

function refreshComparison() {
  const entries = matchupEntries(state);
  byId('race-live').innerHTML = liveGrid(entries);
  const oval = state.event === 'oval';
  byId('race-results').innerHTML = comparisonResults(entries, oval);
  const selected = entries.find(entry => entry.key === state.focus);
  byId('quick-impact').textContent = quickImpact(selected, oval);
  const traction = app.querySelector('[data-traction-result]');
  if (traction) traction.outerHTML = tractionPanel(resolve(selected.setup));
  byId('share-feedback').replaceChildren();
  setReplay(entries);
  const playable = Boolean(replay.duration);
  for (const action of ['play', 'share', 'restart']) app.querySelector(`[data-action="${action}"]`).disabled = !playable;
  app.querySelector('[data-action="play"]').textContent = 'Run comparison';
  byId('scrubber').disabled = !playable;
  rememberDraft();
}

async function share() {
  const url = experimentUrl();
  const title = 'ESS Vehicle Lab comparison';
  const oval = replay.event === 'oval';
  const currentEvent = oval ? 'test oval lap' : 'quarter mile';
  const results = replay.entries.map(({setup, run}) => {
    const time = resultTime(run, oval);
    return setupName(setup) + ' ' + (time ? fmt(time, 1) + ' s' : 'no finish');
  });
  const summary = 'Estimated ' + currentEvent + ' · ' + results.join(' vs. ');
  const target = byId('share-feedback');
  const result = await shareResult(url, title, summary);
  if (!target.isConnected || result === 'cancelled') return;
  target.replaceChildren();
  if (result === 'copied') target.append('Link copied. ');
  if (result === 'shared') target.append('Matchup shared. ');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.textContent = 'Open shared link';
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  target.append(anchor);
  if (result === 'manual') {
    const label = document.createElement('label');
    label.textContent = 'Copy the experiment link';
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = url;
    label.append(input);
    target.append(label);
    input.focus();
    input.select();
  }
}

function sameChange() {
  const keys = lanes(state);
  if (keys.some(key => massIssue(resolve(state[key])))) {
    speak('Add weight and balance data for each car before applying the same part change.');
    return;
  }
  const drafts = keys.map(key => {
    const draft = clone(state[key]);
    if (!draft.parts.some(p => p.preset === 'remove')) addPreset(draft, 'remove');
    return draft;
  });
  if (drafts.some(s => !cleanSetup(s) || !usableSetup(s))) {
    speak('At least one car would exceed the model limits or eight component changes.');
    return;
  }
  keys.forEach((key, index) => {
    state[key] = drafts[index];
    state[key + 'Mode'] = 'after';
  });
  render(view, true);
  speak('Applied the same 50 lb cabin removal to all cars.');
}

function addLane(setup, mode = 'before') {
  const key = laneKeys.find(k => !state[k]);
  if (!key) return false;
  state[key] = clone(setup);
  state[key + 'Mode'] = mode;
  return true;
}

function carryLane(key, selection = modeOf(state, key)) {
  if (!useConfig(state[key], selection)) {
    speak('The browser could not save an active configuration. Use the experiment link to carry it to another page.');
    return false;
  }
  const message = setupName(state[key]) + ' is the active configuration across ESS.';
  if (byId('active-feedback')) byId('active-feedback').textContent = message;
  else speak(message);
  return true;
}


// ---- Performance page (gearing and traction) ----
function perfLinks() {
  return {loadTransfer: '../tools/load-transfer/' + shareFragment(state, 'tools')};
}

function perfCommit(message) {
  savePerf(perf);
  render(view, true);
  if (message) speak(message);
}

let perfFrame = 0;
function perfFinalDrive(value, final) {
  const current = active();
  if (!Number.isFinite(value) || value < 2 || value > 6) return;
  const original = resolve(current, false).finalDrive;
  if (value === original && !Object.hasOwn(componentOverrides(current), 'finalDrive')) delete current.tune.finalDrive;
  else current.tune.finalDrive = value;
  state[state.focus + 'Mode'] = modified(current) ? 'after' : 'before';
  if (final) { perfCommit('Final drive ' + fmt(value, 2) + '.'); return; }
  byId('perf-fd').textContent = fmt(value, 2);
  cancelAnimationFrame(perfFrame);
  perfFrame = requestAnimationFrame(() => {
    // Live update while dragging: recompute only the result regions so the slider keeps focus.
    const m = perfModel(active(), perf);
    byId('perf-summary').outerHTML = summaryHtml(m, state.focus);
    byId('perf-traction').outerHTML = tractionHtml(m, state.focus);
    byId('perf-gearing').outerHTML = gearTableHtml(m);
    const tires = byId('perf-tires');
    if (tires) tires.outerHTML = tireTableHtml(m) || '<span id="perf-tires"></span>';
    for (const chip of app.querySelectorAll('#perf-controls [data-axle-ratio]'))
      chip.setAttribute('aria-pressed', String(Number(chip.dataset.axleRatio) === value));
    rememberDraft();
  });
}

function perfClick(el) {
  const d = el.dataset;
  if (d.perfRef) {
    if (d.perfRef === active().id) return true;
    el.dispatchEvent(new CustomEvent('ess:vehicle-selected', {bubbles: true, detail: {id: d.perfRef}}));
    return true;
  }
  if (d.axleRatio) { perfFinalDrive(Number(d.axleRatio), true); return true; }
  if (d.perfGear !== undefined) { perf = {...perf, gear: Number(d.perfGear)}; perfCommit('Traction check in gear ' + (perf.gear + 1) + '.'); return true; }
  if (d.perfPickTire) { perf = {...perf, tire: d.perfPickTire}; perfCommit('Tire class changed.'); return true; }
  if (el.hasAttribute('data-perf-tire-reset')) { perf = {...perf, tire: null}; perfCommit('Back to tire classes.'); return true; }
  if (el.hasAttribute('data-perf-reset')) {
    const current = active();
    delete current.tune.finalDrive;
    delete current.tune.gears;
    if (current.components) { delete current.components.transmission; if (!Object.keys(current.components).length) delete current.components; }
    state[state.focus + 'Mode'] = modified(current) ? 'after' : 'before';
    perf = {...perfDefaults(), vehicle: current.id};
    perfCommit('Gearing and tires reset to the original car.');
    return true;
  }
  if (el.hasAttribute('data-perf-use')) { carryLane(state.focus, modified(active()) ? 'after' : 'before'); return true; }
  return false;
}

app.addEventListener('submit', event => {
  const form = event.target;
  if (!form.hasAttribute('data-perf-mu')) return;
  event.preventDefault();
  const mu = Number(form.elements.mu.value);
  if (!Number.isFinite(mu) || mu < .1 || mu > 3) return;
  perf = {...perf, tire: 'custom', customMu: mu};
  perfCommit('Using your friction value μ ' + fmt(mu, 2) + '.');
});

document.addEventListener('click', event => {
  const el = event.target.closest('a,button');
  if (!el) return;
  const href = el.getAttribute('href');
  if (href && ['#home', '#build', '#compare', '#tools', '#learn', '#garage', '#suspension', '#performance', '#performance-why', '#performance-math'].includes(href) &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    speak();
    navigate(href.slice(1));
    return;
  }
  if (perfViews.includes(view) && perfClick(el)) return;
  if (el.dataset.preset) { choosePreset(el.dataset.preset); return; }
  if (el.dataset.remove !== undefined) {
    const next = clone(active());
    next.parts.splice(+el.dataset.remove, 1);
    if (!commitExperiment(next, 'Component change undone.')) speak('Undoing this change would exceed the model limits.');
    return;
  }
  if (el.dataset.axleRatio) {
    const ratio = Number(el.dataset.axleRatio);
    app.querySelector('[data-quick="finalDrive"]').value = ratio;
    tuneComparison('finalDrive', ratio);
    return;
  }
  if (el.dataset.studyLane) {
    state.focus = el.dataset.studyLane;
    const study = state.event === 'oval' ? 'oval' : 'quarter';
    navigate('build');
    const filter = app.querySelector('[data-study-select]');
    filter.value = study;
    filter.dispatchEvent(new Event('change', {bubbles: true}));
    app.querySelector('#data-readiness').scrollIntoView({block: 'start'});
    app.querySelector('[data-details="original"]').open = true;
    return;
  }
  if (el.dataset.acceptEstimates) {
    const next = clone(active());
    const tool = el.dataset.acceptEstimates;
    if (next.id !== 'custom' || !Object.hasOwn(studies, tool)) return;
    const value = resolve(next);
    const missing = [...missingFor(value, tool), ...(studies[tool].optional ?? []).filter(key => value[key] == null)];
    next.estimates = [...new Set([...(next.estimates ?? []), ...missing.filter(key => Object.hasOwn(customEstimates, key))])];
    state[state.focus] = next;
    render(view, true);
    const filter = app.querySelector('[data-study-select]');
    filter.value = tool;
    filter.dispatchEvent(new Event('change', {bubbles: true}));
    speak('The listed model estimates have been applied to this setup.');
    return;
  }
  if (el.dataset.event) { state.event = el.dataset.event; render(view, true); return; }
  if (el.dataset.focusLane) { state.focus = el.dataset.focusLane; render(view, true); return; }
  if (el.dataset.useLane) { carryLane(el.dataset.useLane); return; }
  if (el.dataset.dropLane) {
    const key = el.dataset.dropLane;
    delete state[key];
    delete state[key + 'Mode'];
    if (state.focus === key) state.focus = 'a';
    render(view, true);
    speak(labelLane(key) + ' removed.');
    return;
  }
  if (el.dataset.edit) { state.focus = el.dataset.edit; navigate('build'); return; }
  const garageKey = el.dataset.garageOpen || el.dataset.garageUse || el.dataset.garageRemove;
  if (garageKey) {
    const item = getGarage().find(entry => entry.key === garageKey);
    if (!item) return;
    if (el.dataset.garageRemove) {
      if (window.confirm('Remove this saved variant from My Garage?')) {
        if (removeFromGarage(garageKey)) render(view, true);
      }
      return;
    }
    state[state.focus] = item.setup;
    state[state.focus + 'Mode'] = item.mode;
    if (el.dataset.garageUse) { carryLane(state.focus, item.mode); render(view, true); }
    else navigate('build');
    return;
  }
  const action = el.dataset.action;
  if (!action) return;
  switch (action) {
    case 'compare-build': state[state.focus + 'Mode'] = modified(active()) ? 'after' : 'before'; navigate('compare'); break;
    case 'compare-original': {
      const draft = clone(active());
      draft.tune = {};
      delete draft.components;
      draft.parts = [];
      if (!addLane(draft)) {
        speak('Four cars are already in the comparison. Remove an added lane to include the original.');
        break;
      }
      state[state.focus + 'Mode'] = 'after';
      navigate('compare');
      break;
    }
    case 'use':
      carryLane(state.focus, modified(active()) ? 'after' : 'before');
      navigate('tools');
      break;
    case 'watch-run':
      state.event = 'strip';
      navigate('compare');
      play(app.querySelector('[data-action="play"]'));
      byId('replay-details').scrollIntoView({block: 'start'});
      break;
    case 'add-car': {
      const available = vehicleIds.find(id => lanes(state).every(k => state[k].id !== id)) || vehicleIds[0];
      if (addLane(newSetup(available))) render(view, true);
      break;
    }
    case 'duplicate':
      if (addLane(active(), modeOf(state, state.focus))) render(view, true);
      break;
    case 'open-lineup': {
      const lineup = byId('lineup-panel');
      lineup.open = true;
      lineup.scrollIntoView({block: 'start'});
      lineup.querySelector('summary').focus({preventScroll: true});
      break;
    }
    case 'restart': resetProgress(); break;
    case 'save':
      if (saveToGarage(active(), modified(active()) ? 'after' : 'before')) {
        saveBuild(active());
        saved = clone(active());
        render(view, true);
        speak('Variant saved to My Garage.');
      }
      else speak('This browser could not save the build. The temporary experiment is still open.');
      break;
    case 'load-saved':
      if (saved) { changeFocused(clone(saved)); navigate(view === 'tools' ? 'tools' : 'build'); speak('Opened a temporary copy of my saved build.'); }
      break;
    case 'reset': {
      const next = {...active(), tune: {}, parts: []};
      delete next.components;
      commitExperiment(next, 'Modifications reset. Original specifications kept.');
      break;
    }
    case 'same-change': sameChange(); break;
    case 'play': play(el); break;
    case 'share': share(); break;
  }
});

app.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'scrubber' && replay) {
    if (replay.frame) {
      cancelAnimationFrame(replay.frame);
      replay.frame = null;
      app.querySelector('[data-action="play"]').textContent = 'Resume comparison';
    }
    updateReplay(replay.duration * +target.value / 1000);
    return;
  }
  if (target.hasAttribute('data-perf-fd')) { perfFinalDrive(Number(target.value), false); return; }
  const quick = target.dataset.quick;
  if (quick) {
    tuneComparison(quick, Number(target.value));
    return;
  }
  const key = target.dataset.slider;
  if (!key) return;
  const value = +target.value;
  const unit = key === 'lever' || key === 'radius' ? 'ft' : key.endsWith('Spring') ? 'lb/in' : 'g';
  byId('out-' + key).value = value + ' ' + unit;
  if (key === 'radius') {
    byId('inertia-demo').textContent = 'A 40 lbm mass contributes ' + fmt(40 * value ** 2, 1) + ' lbm·ft² about this axis.';
    return;
  }
  if (key === 'lever') {
    byId('torque-demo').textContent = '50 lb of force makes ' + fmt(50 * value, 1) + ' lb-ft of torque.';
    return;
  }
  if (key === 'brake' || key === 'lateral') state.tool = { ...toolSettings(), [key]: value };
  else {
    if (value === resolve(active(), false)[key]) delete active().tune[key];
    else active().tune[key] = value;
    state[state.focus + 'Mode'] = modified(active()) ? 'after' : 'before';
  }
  const result = toolResults(resolve(active(), false), resolve(active()), toolSettings());
  byId('load-result').innerHTML = result.loads;
  byId('ride-result').innerHTML = result.ride;
  const hash = shareFragment(state, 'tools');
  byId('spring-link').hash = hash;
  byId('load-link').hash = hash;
  rememberDraft();
});

window.addEventListener('hashchange', () => {
  if (location.hash !== '#content') applyLocation();
});
applyLocation();
