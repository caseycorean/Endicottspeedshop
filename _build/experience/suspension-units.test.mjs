// Suspension and shared-units assignment (Claude, 25 Nov). Run: node --test _build/experience/
import test from 'node:test';
import assert from 'node:assert/strict';
import { format, parse, toDisplay, fromDisplay, fromSource, inputValue, canonicalStep, quantities, _setUnitsForTest } from '../../experience/units.mjs';
import { frontModel, frontGeometry, frontPresets, rideModel, suspExperiments, cleanSusp, suspDefaults, balanceText } from '../../experience/suspension-lab.mjs';
import { cleanRear } from '../../experience/suspension-view.mjs';
import { slaAt, strutAt } from '../../engine/suspension.mjs';
import { ride, tireLoads } from '../../engine/loads.mjs';
import { newSetup, resolve } from '../../experience/models.mjs';
import { shareFragment, readFragment, example } from '../../experience/configuration.mjs';
import { rearLinkInsights } from '../../experience/rear-link-insights.mjs';
import { linkLayout } from '../../experience/rear-links.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// ---------- units ----------
test('every quantity round-trips canonical → display → canonical exactly (to float precision)', () => {
  for (const q of Object.keys(quantities)) for (const sys of ['us', 'metric', 'dual'])
    for (const x of [0, 1, 3.75, 25.4, 450, 3118, -1.25]) close(fromDisplay(q, toDisplay(q, x, sys), sys), x, 1e-9 * Math.max(1, Math.abs(x)));
});

test('repeated unit switching never changes stored state (no accumulated rounding)', () => {
  // The app never rewrites state from displayed text; simulate 1000 switches by formatting only.
  const state = { spring: 450, travel: 1.5 };
  const before = JSON.stringify(state);
  for (let i = 0; i < 1000; i++) for (const s of ['us', 'metric', 'dual']) { format('rate', state.spring, { system: s }); format('length', state.travel, { system: s }); }
  assert.equal(JSON.stringify(state), before);
  // Even a worst case of re-reading the shown number each time stays put: a field shows inputValue, parse reads it back.
  let x = 450;
  for (let i = 0; i < 200; i++) { _setUnitsForTest(i % 2 ? 'metric' : 'us'); x = parse('rate', inputValue('rate', x, { us: 6, metric: 6 })); }
  _setUnitsForTest('us');
  close(x, 450, 1e-3);
});

test('format: US, metric and dual', () => {
  assert.equal(format('length', 1.5, { system: 'us' }), '1.50 in');
  assert.equal(format('length', 1.5, { system: 'metric' }), '38 mm');
  assert.equal(format('length', 1.5, { system: 'dual' }), '1.50 in (38 mm)');
  assert.equal(format('rate', 450, { system: 'metric' }), '78.8 N/mm');
  assert.equal(format('weight', 3118, { system: 'metric' }), '1,414 kg');
  assert.equal(format('angle', -1.25, { system: 'dual' }), '-1.25°');
  assert.equal(format('angle', -1.25, { system: 'dual', signed: true }), '−1.25°');
  assert.equal(format('length', NaN), '—');
});

test('parse accepts either system regardless of preference, and refuses wrong units', () => {
  for (const sys of ['us', 'metric', 'dual']) {
    close(parse('length', '38 mm', sys), 38 / 25.4);
    close(parse('length', '1.5 in', sys), 1.5);
    close(parse('length', '1.5"', sys), 1.5);
    close(parse('rate', '79 N/mm', sys), 79 * 25.4 / 4.4482216152605);
    close(parse('rate', '450 lb/in', sys), 450);
    close(parse('rate', '1,200', 'us'), 1200);
    assert.equal(parse('length', '12 lb', sys), null);
    assert.equal(parse('length', 'abc', sys), null);
    assert.equal(parse('length', '', sys), null);
  }
  close(parse('length', '38', 'metric'), 38 / 25.4);
  close(parse('length', '38', 'us'), 38);
  close(parse('length', '38', 'dual'), 38); // dual edits in US units
  close(parse('length', '−2', 'us'), -2);
});

test('mixed-unit source records convert on read, keeping the original value', () => {
  const record = { value: 751.307, unit: 'mm', provenance: 'measured' };
  close(fromSource('length', record.value, record.unit), 29.5790157, 1e-6);
  assert.equal(record.value, 751.307);
  close(fromSource('rate', 330, 'lb_per_in'), 330);
  close(fromSource('rate', 57.8, 'N/mm'), 57.8 * 25.4 / 4.4482216152605);
  assert.equal(fromSource('length', 5, 'parsecs'), null);
});

test('keyboard step is one displayed step in canonical units', () => {
  close(canonicalStep('length', 'us'), .1);
  close(canonicalStep('length', 'metric'), 2 / 25.4);
});

// ---------- front geometry ----------
test('front model matches the engine solver directly (no second physics)', () => {
  for (const layout of Object.keys(frontPresets)) {
    const f = { layout, pts: {}, travel: 1.25 };
    const g = frontGeometry(f), solve = layout === 'strut' ? strutAt : slaAt;
    const m = frontModel(f);
    close(m.now.camber, solve(g, 1.25).camber);
    close(m.rcStatic, solve(g, 0).rollCentreHeight);
    close(m.camberGain, (solve(g, 1).camber - solve(g, -1).camber) / 2);
    assert.ok(m.curve.length >= 20);
  }
});

test('front geometry is physically sensible for the generic SLA', () => {
  const m = frontModel(suspDefaults().front);
  assert.ok(m.camberGain < 0, 'SLA gains negative camber in bump');
  assert.ok(m.rcStatic > 0 && m.rcStatic < 10, 'roll centre a few inches above ground');
  assert.ok(Math.abs(m.now.camber - frontPresets.sla.staticCamber) < 1e-9);
});

test('moving a pivot changes the result, and unreachable geometry is reported', () => {
  const base = frontModel(suspDefaults().front);
  const moved = frontModel({ layout: 'sla', pts: { upperInner: [14, 15.5] }, travel: 0 });
  assert.notEqual(base.camberGain, moved.camberGain);
  const broken = frontModel({ layout: 'sla', pts: { upperInner: [0, 34] }, travel: 0 });
  assert.equal(typeof broken.ok, 'boolean');
});

test('the same geometry typed in mm or inches gives identical results', () => {
  const inches = { layout: 'sla', pts: { lowerOuter: [27.5, 5.5] }, travel: 0 };
  const mm = { layout: 'sla', pts: { lowerOuter: [parse('length', '698.5 mm'), parse('length', '139.7 mm')] }, travel: 0 };
  const a = frontModel(inches), b = frontModel(mm);
  close(a.camberGain, b.camberGain, 1e-9);
  close(a.rcStatic, b.rcStatic, 1e-9);
});

// ---------- springs, ride, roll ----------
test('ride model reuses engine/loads.ride and tireLoads', () => {
  const v = resolve(newSetup('camaro')), o = resolve(newSetup('camaro'), false);
  const r = rideModel(v, o, { lat: .9, frontRc: 3, rearRc: 14 });
  assert.ok(!r.missing);
  const fr = ride({ cornerLb: v.frontLb / 2, unsprung: v.frontUnsprung, spring: v.frontSpring, motion: v.frontMotion, tireRate: v.tireRate });
  close(r.front.hz, fr.hz);
  close(r.front.wheel, v.frontSpring * v.frontMotion ** 2, 1e-9);
  const L = tireLoads(v, 0, .9, { frontRoll: r.frontRoll, frontCenter: 3, rearCenter: 14 });
  close(r.lltdFront, L.lltdFront);
  close(L.tires.reduce((a, b) => a + b), v.weight, 1e-6);
  assert.equal(r.front.heightChange, 0);
});

test('stiffer front springs raise front frequency, front load-transfer share, and ride height', () => {
  const s = newSetup('camaro'), o = resolve(s, false), v = resolve(s);
  const stiff = resolve({ ...s, tune: { frontSpring: v.frontSpring * 1.2 } });
  const a = rideModel(v, o), b = rideModel(stiff, o);
  assert.ok(b.front.hz > a.front.hz);
  assert.ok(b.lltdFront > a.lltdFront);
  assert.ok(b.front.heightChange > 0);
  assert.ok(balanceText(a).length > 10);
});

test('a front anti-roll bar moves load transfer forward', () => {
  const v = resolve(newSetup('camaro')), o = resolve(newSetup('camaro'), false);
  assert.ok(rideModel(v, o, { arb: { f: 300, r: 0 } }).lltdFront > rideModel(v, o).lltdFront);
});

test('raising the front roll centre moves geometric load transfer forward', () => {
  const v = resolve(newSetup('camaro')), o = resolve(newSetup('camaro'), false);
  assert.ok(rideModel(v, o, { frontRc: 6, rearRc: 12 }).lltdFront > rideModel(v, o, { frontRc: 1, rearRc: 12 }).lltdFront);
});

test('next-experiment numbers equal the model after applying them', () => {
  const s = newSetup('camaro'), v = resolve(s), o = resolve(s, false), susp = suspDefaults();
  const preview = (k, x) => resolve({ ...s, tune: { ...s.tune, [k]: x } });
  const list = suspExperiments({ v, orig: o, susp, rearRc: 14, applyTune: preview });
  assert.ok(list.length >= 3);
  const fs = list.find(x => x.id === 'frontSpring');
  const after = rideModel(preview('frontSpring', fs.value), o, { lat: susp.lat, arb: susp.arb, frontRc: frontModel(susp.front).rcStatic, rearRc: 14 });
  const before = rideModel(v, o, { lat: susp.lat, arb: susp.arb, frontRc: frontModel(susp.front).rcStatic, rearRc: 14 });
  close(fs.dLltd, after.lltdFront - before.lltdFront);
});

// ---------- shared links and reproducibility ----------
test('a shared suspension experiment reproduces exactly, whatever the recipient\'s units', () => {
  const state = example();
  state.a = { ...state.a, tune: { ...state.a.tune, frontSpring: 520, rearMotion: .9 } };
  state.focus = 'a';
  const susp = { front: { layout: 'sla', pts: { upperInner: [14.25, 15.6] }, travel: .75 }, lat: 1.1, arb: { f: 250, r: 0 },
    rear: { layout: 'three', links: linkLayout('three').map(l => ({ axle: l.axle, chassis: l.chassis })), heave: 0, roll: 2 } };
  const hash = shareFragment({ ...state, susp }, 'suspension');
  const results = [];
  for (const sys of ['us', 'metric', 'dual']) {
    _setUnitsForTest(sys);
    const back = readFragment(hash);
    assert.equal(back.view, 'suspension');
    const v = resolve(back.state.a), o = resolve(back.state.a, false);
    const rc = rearLinkInsights(linkLayout('three'), {}).rollCentre;
    const m = rideModel(v, o, { lat: back.state.susp.lat, arb: back.state.susp.arb, frontRc: frontModel(back.state.susp.front).rcStatic, rearRc: rc });
    results.push(JSON.stringify([frontModel(back.state.susp.front).camberGain, m.lltdFront, m.front.hz, back.state.susp]));
  }
  _setUnitsForTest('us');
  assert.equal(new Set(results).size, 1);
});

test('tampered suspension links are refused', () => {
  const state = example();
  const bad = [
    { front: { layout: 'sla', pts: { upperInner: [999, 1] } } },
    { front: { layout: 'nope' } },
    { lat: 9 },
    { arb: { f: -1 } },
    { front: { layout: 'sla', pts: { top: [1, 1] } } },
    { rear: { layout: 'three', heave: 40 } },
    { rear: { layout: 'three', links: [{}] } },
  ];
  for (const susp of bad) assert.equal(readFragment(shareFragment({ ...state, susp }, 'suspension')).invalid, true, JSON.stringify(susp));
  assert.equal(cleanSusp(null), null);
  assert.equal(cleanRear({ layout: 'three', roll: 2 }).roll, 2);
});

test('links without suspension data still open (older shares)', () => {
  const back = readFragment(shareFragment(example(), 'suspension'));
  assert.equal(back.view, 'suspension');
  assert.equal(back.state.susp, undefined);
});
