import { vehicles, stock } from './vehicles.mjs';
import { resolve, newSetup, presets, validValue, usableSetup, straightLine, atTime, MPH } from './models.mjs';
import { example, clone, modified, shareFragment, readFragment, getSaved, saveBuild, shareResult } from './configuration.mjs';
import { home, build, compare, toolsView, learn, inputGroups, toolResults } from './views.mjs';
import { fmt, numberField } from './ui.mjs';
import { ovalLap, ovalPoint, ovalLength } from './oval.mjs';

const app = document.querySelector('#app');
const notice = document.querySelector('#link-notice');
const status = document.querySelector('#status');
const defaults = { brake: .4, lateral: .9 };
let saved = getSaved();
let state = example();
let view = 'home';
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
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function applyLocation() {
  const route = readFragment(location.hash);
  if (route.state) {
    state = route.state;
    sharedLinkNotice = 'Shared experiment. Try a change or run the comparison to see it play out.';
  } else if (route.invalid) {
    state = example();
    sharedLinkNotice = 'This experiment link could not be restored. The default matchup is ready to try.';
  } else {
    sharedLinkNotice = '';
  }
  render(route.view);
}

function render(next = view, restoreDetails = false) {
  const openSections = restoreDetails ? [...app.querySelectorAll('details[open][data-details]')].map(el => el.dataset.details) : [];
  const priorFocus = restoreDetails ? app.querySelector(':focus') : null;
  const focusData = priorFocus && Object.entries(priorFocus.dataset)[0];
  stopReplay();
  pendingPreset = null;
  view = next;
  switch (view) {
    case 'build': app.innerHTML = build(state, saved); break;
    case 'compare': {
      const a = resolve(state.a, state.aMode === 'after');
      const b = resolve(state.b, state.bMode === 'after');
      const oval = state.event === 'oval';
      const runModel = oval ? ovalLap : straightLine;
      const runs = [runModel(a), runModel(b)];
      app.innerHTML = compare(state, a, b, runs);
      if (runs.every(r => r.trace)) {
        replay = { runs, oval, elapsed: 0, duration: Math.max(...runs.map(r => r.trace.at(-1).t)) };
        updateReplay(0);
      }
      break;
    }
    case 'tools': app.innerHTML = toolsView(state, toolSettings(), shareFragment(state, 'tools'), saved); break;
    case 'learn': app.innerHTML = learn(); break;
    default: app.innerHTML = home(state, saved);
  }
  notice.textContent = sharedLinkNotice;
  notice.classList.toggle('link-notice', Boolean(sharedLinkNotice));
  for (const nav of document.querySelectorAll('nav a[data-view]')) {
    if (nav.dataset.view === view) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  }
  for (const detail of app.querySelectorAll('[data-details]')) {
    detail.open = openSections.includes(detail.dataset.details);
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
  const benchmark = section === 'base' ? stock(next.id) : resolve(next, false);
  for (const key of inputGroups[group]) {
    const value = numericValue(key, values.get(key).trim());
    if (!validValue(key, value)) {
      issue.textContent = 'Check the highlighted specifications. Use positive numbers and decreasing comma-separated gear ratios.';
      form.elements.namedItem(key).focus();
      return;
    }
    const same = key === 'gears' ? value.length === benchmark[key].length && value.every((n, i) => n === benchmark[key][i]) :
      Math.abs(value - benchmark[key]) < .000051;
    if (same) delete next[section][key];
    else next[section][key] = value;
  }
  if (!commitExperiment(next, 'Specifications updated.'))
    issue.textContent = 'The resulting mass or axle balance is outside the model limits.';
});

app.addEventListener('change', event => {
  const el = event.target;
  const selected = el.dataset.vehicle;
  if (selected) {
    const key = selected === 'focus' ? state.focus : selected;
    if (el.value === state[key].id) return;
    const previous = state[key];
    if (modified(previous) || Object.keys(previous.base).length) {
      const replace = window.confirm('Replace the current experiment in this lane? Your saved build stays available.');
      if (!replace) { el.value = previous.id; return; }
    }
    state[key] = newSetup(el.value);
    state[key + 'Mode'] = 'before';
    render(view, true);
    speak('Selected ' + vehicles[el.value].name + '.');
  } else if (el.dataset.mode) {
    state[el.dataset.mode + 'Mode'] = el.value;
    render(view, true);
  }
});

function stopReplay() {
  if (replay?.frame) cancelAnimationFrame(replay.frame);
  replay = null;
}

function updateReplay(t) {
  if (!replay) return;
  replay.elapsed = t;
  byId('race-time').textContent = t.toFixed(1);
  byId('scrubber').value = Math.round(t / replay.duration * 1000);
  const current = replay.runs.map(run => atTime(run, t));
  if (replay.oval) drawOval(current);
  current.forEach((sample, i) => {
    if (!replay.oval) byId('runner-' + i).style.left = Math.min(100, sample.x / 13.2) + '%';
    byId('speed-' + i).textContent = fmt(sample.speed / MPH);
    byId('gear-' + i).textContent = sample.gear === 0 ? (replay.oval ? 'braking' : 'shifting') :
      (sample.limited ? 'grip limited' : 'gear ' + sample.gear);
  });
}

function drawOval(samples) {
  const canvas = byId('oval-map');
  const ctx = canvas.getContext('2d');
  const project = position => [140 + position.x * .65, 18 + position.y * .60];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const route = () => {
    ctx.beginPath();
    ctx.moveTo(...project(ovalPoint(0)));
    for (let i = 1; i <= 128; i++) ctx.lineTo(...project(ovalPoint(i * ovalLength / 128)));
    ctx.closePath();
  };
  route();
  ctx.strokeStyle = '#77838a';
  ctx.lineWidth = 26;
  ctx.stroke();
  ctx.strokeStyle = '#303a41';
  ctx.lineWidth = 23;
  ctx.stroke();
  ctx.strokeStyle = '#829096';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
  const [sx, sy] = project(ovalPoint(0));
  ctx.fillStyle = '#e2e7e6';
  ctx.fillRect(sx, sy - 11, 2, 22);
  samples.forEach((sample, i) => {
    const [x, y] = project(ovalPoint(sample.x));
    ctx.beginPath();
    ctx.arc(x, y + (i ? 6 : -6), 8, 0, 2 * Math.PI);
    ctx.fillStyle = i ? '#9fcebd' : '#ffab58';
    ctx.fill();
    ctx.fillStyle = '#101417';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i ? 'B' : 'A', x, y + (i ? 6 : -6));
  });
}

function play(button) {
  if (!replay) return;
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
  const start = performance.now() - replay.elapsed * 1000;
  button.textContent = 'Pause replay';
  const tick = now => {
    const t = Math.min(replay.duration, (now - start) / 1000);
    updateReplay(t);
    if (t < replay.duration) replay.frame = requestAnimationFrame(tick);
    else { replay.frame = null; button.textContent = 'Replay comparison'; }
  };
  replay.frame = requestAnimationFrame(tick);
}

async function share() {
  const url = experimentUrl();
  const title = 'ESS Vehicle Lab comparison';
  const currentEvent = replay.oval ? 'test oval lap' : 'quarter mile';
  const results = replay.runs.map(r => r.lap ?? r.finish?.t).map(t => t ? fmt(t, 1) + ' s' : 'no finish').join(' vs. ');
  const summary = `${vehicles[state.a.id].name} vs. ${vehicles[state.b.id].name} · Estimated ${currentEvent} ${results}`;
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
  const drafts = ['a', 'b'].map(key => {
    const draft = clone(state[key]);
    if (!draft.parts.some(p => p.preset === 'remove')) addPreset(draft, 'remove');
    return draft;
  });
  if (drafts.some(s => !cleanSetup(s) || !usableSetup(s))) {
    speak('At least one car would exceed the model limits or eight component changes.');
    return;
  }
  [state.a, state.b] = drafts;
  state.aMode = state.bMode = 'after';
  render(view, true);
  speak('Applied the same 50 lb cabin removal to both cars.');
}

document.addEventListener('click', event => {
  const el = event.target.closest('a,button');
  if (!el) return;
  const href = el.getAttribute('href');
  if (href && ['#home', '#build', '#compare', '#tools', '#learn'].includes(href) &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    speak();
    navigate(href.slice(1));
    return;
  }
  if (el.dataset.preset) { choosePreset(el.dataset.preset); return; }
  if (el.dataset.remove !== undefined) {
    const next = clone(active());
    next.parts.splice(+el.dataset.remove, 1);
    if (!commitExperiment(next, 'Component change undone.')) speak('Undoing this change would exceed the model limits.');
    return;
  }
  if (el.dataset.event) { state.event = el.dataset.event; render(view, true); return; }
  if (el.dataset.edit) { state.focus = el.dataset.edit; navigate('build'); return; }
  const action = el.dataset.action;
  if (!action) return;
  switch (action) {
    case 'compare-build': state[state.focus + 'Mode'] = modified(active()) ? 'after' : 'before'; navigate('compare'); break;
    case 'compare-original': {
      const opposite = state.focus === 'a' ? 'b' : 'a';
      const source = state[opposite];
      if ((modified(source) || Object.keys(source.base).length) && !window.confirm('Replace the other lane with this build’s original configuration?')) break;
      const draft = clone(active());
      draft.tune = {};
      draft.parts = [];
      state[opposite] = draft;
      state[opposite + 'Mode'] = 'before';
      state[state.focus + 'Mode'] = 'after';
      navigate('compare');
      break;
    }
    case 'use': navigate('tools'); break;
    case 'save':
      if (saveBuild(active())) { saved = clone(active()); render(view, true); speak('Saved in this browser as my build.'); }
      else speak('This browser could not save the build. The temporary experiment is still open.');
      break;
    case 'load-saved':
      if (saved) { changeFocused(clone(saved)); navigate(view === 'tools' ? 'tools' : 'build'); speak('Opened a temporary copy of my saved build.'); }
      break;
    case 'reset': {
      const next = { ...active(), tune: {}, parts: [] };
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
  const key = target.dataset.slider;
  if (!key) return;
  const value = +target.value;
  const unit = key === 'lever' || key === 'radius' ? 'ft' : key.endsWith('Spring') ? 'lb/in' : 'g';
  byId('out-' + key).value = value + ' ' + unit;
  if (key === 'radius') {
    byId('inertia-demo').textContent = 'A 40 lb mass contributes ' + fmt(40 * value ** 2, 1) + ' lbm·ft² about this axis.';
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
});

window.addEventListener('hashchange', () => {
  if (location.hash !== '#content') applyLocation();
});
applyLocation();
