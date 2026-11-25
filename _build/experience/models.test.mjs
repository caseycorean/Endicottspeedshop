import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicles } from '../../experience/vehicles.mjs';
import { newSetup, cleanSetup, usableSetup, resolve, tireLoads, ride, straightLine,
  driveResistance, tractiveLimit, powerIssue, MPH, presets, atTime } from '../../experience/models.mjs';
import { example, readFragment, shareFragment, shareResult } from '../../experience/configuration.mjs';

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const firebird = () => newSetup('firebird');

test('component removal ahead of the front axle reduces front load by more than its weight', () => {
  const s = firebird();
  const before = resolve(s);
  s.parts.push(presets.radiator);
  const after = resolve(s);
  near(after.weight, before.weight - 20);
  near(after.frontLb - before.frontLb, -20 * (1 + 16 / before.wheelbase));
  near(after.rearLb - before.rearLb, 20 * 16 / before.wheelbase);
});

test('relocation conserves total weight and moves axle loads by W times distance divided by wheelbase', () => {
  const s = firebird();
  const before = resolve(s);
  s.parts.push(presets.ballast);
  const after = resolve(s);
  near(after.weight, before.weight);
  near(after.rearLb - before.rearLb, 40 * 72 / before.wheelbase);
  near(after.frontLb + after.rearLb, after.weight);
  near(resolve(s, false).cgX, before.cgX);
});

test('an impossible component operation cannot be shared or applied', () => {
  const s = firebird();
  for (let i = 0; i < 8; i++) s.parts.push({ label: 'Removal', oldWeight: 500, oldX: 0, newWeight: 0, newX: 0 });
  assert.ok(cleanSetup(s));
  assert.equal(usableSetup(s), false);
  assert.equal(readFragment(shareFragment({ ...example(), a: s })).invalid, true);
});

test('tire load model reproduces published ESS Grip Lab numbers and conserves supported load', () => {
  const w = 3300;
  const v = { weight: w, front: .54, frontLb: w * .54, rearLb: w * .46, cg: 20,
    wheelbase: 108, frontTrack: 61, rearTrack: 60 };
  const result = tireLoads(v, .4, .9);
  assert.deepEqual(result.tires.map(Math.round), [1457, 569, 1175, 98]);
  near(result.tires.reduce((a, b) => a + b, 0), w);
  assert.equal(tireLoads(v, 1.2, 1.2).invalid, true);
});

test('ride model agrees with the existing ESS spring example and rejects zero sprung weight', () => {
  const w = 3300;
  const v = { frontLb: w * .54, rearLb: w * .46, frontSpring: 500, rearSpring: 150,
    frontMotion: .55, rearMotion: 1, frontUnsprung: 95, rearUnsprung: 150, tireRate: 1400 };
  assert.equal(ride(v, 'front').hz.toFixed(2), '1.30');
  assert.equal(ride(v, 'rear').hz.toFixed(2), '1.48');
  assert.equal(ride({ ...v, frontLb: 190 }, 'front').hz, null);
});

test('all reference vehicles produce finite, monotonic-distance traces with explicit shift intervals', () => {
  for (const id of Object.keys(vehicles)) {
    const run = straightLine(resolve(newSetup(id)));
    assert.ok(run.zeroTo60 > 0, id);
    assert.ok(run.finish.t > run.zeroTo60, id);
    near(run.trace.at(-1).x, 1320);
    assert.ok(run.trace.some(s => s.gear === 0), id);
    for (const [i, s] of run.trace.entries()) {
      assert.ok(Number.isFinite(s.speed) && s.speed >= 0, id);
      assert.ok(i === 0 || (s.t > run.trace[i - 1].t && s.x >= run.trace[i - 1].x), id);
    }
    const at60 = atTime(run, run.zeroTo60);
    near(at60.speed, 60 * MPH, .05);
  }
});

test('time step convergence and lower mass reduce elapsed time in a power-limited comparison', () => {
  const v = resolve(firebird());
  near(straightLine(v).finish.t, straightLine(v, { dt: .01 }).finish.t, .12);
  const light = { ...v, weight: v.weight * .9, frontLb: v.frontLb * .9, rearLb: v.rearLb * .9 };
  assert.ok(straightLine(light).finish.t < straightLine(v).finish.t);
});

test('launch cap satisfies the implicit driven-axle load and invalid peak curves are rejected', () => {
  const v = resolve(newSetup('mustang'));
  const resistance = driveResistance(v, 0);
  const f = tractiveLimit(v, resistance);
  near(f, v.grip * (v.rearLb + (f - resistance) * v.cg / v.wheelbase));
  assert.ok(powerIssue({ ...v, hp: 500 }));
  assert.ok(straightLine({ ...v, redline: 3000 }).issue);
});

test('share format preserves two configurations and overrides; malformed and out-of-range input fails closed', () => {
  const state = example();
  state.a.parts.push({ ...presets.seats, preset: 'seats' });
  state.b.tune.grip = 1;
  state.aMode = 'after';
  const hash = shareFragment(state);
  const decoded = readFragment(hash);
  assert.equal(decoded.view, 'compare');
  assert.equal(decoded.state.a.parts[0].oldWeight, 23);
  assert.equal(decoded.state.b.tune.grip, 1);
  assert.equal(decoded.state.aMode, 'after');
  assert.equal(readFragment(hash.slice(0, -4)).invalid, true);
  assert.equal(readFragment('#v7/compare/' + hash.split('/')[2]).invalid, true);
  assert.equal(cleanSetup({ ...state.a, tune: { hp: '400junk' } }), null);
  assert.equal(cleanSetup({ ...state.a, tune: { gears: [2, 2] } }), null);
  assert.equal(cleanSetup({ ...state.a, id: '__proto__' }), null);
});

test('non-cancelled native share failure falls back to clipboard then manual sharing', async () => {
  const unavailable = async () => { throw new Error('blocked'); };
  assert.equal(await shareResult('url', 'title', 'summary', {
    share: unavailable, clipboard: { writeText: async () => {} },
  }), 'copied');
  assert.equal(await shareResult('url', 'title', 'summary', { share: unavailable }), 'manual');
  assert.equal(await shareResult('url', 'title', 'summary', {
    share: async () => { throw { name: 'AbortError' }; }, clipboard: { writeText: assert.fail },
  }), 'cancelled');
});

test('oval closes and solves physically ordered flying laps without exceeding the turn speed cap', async () => {
  const { ovalLap, ovalLength, ovalPoint } = await import('../../experience/oval.mjs');
  const { G } = await import('../../experience/models.mjs');
  near(ovalLength, 1040 + 400 * Math.PI);
  assert.deepEqual(ovalPoint(0), ovalPoint(ovalLength));
  assert.deepEqual(ovalPoint(520), { x: 520, y: 0 });
  for (const id of Object.keys(vehicles)) {
    const v = resolve(newSetup(id));
    const r = ovalLap(v);
    near(r.trace[0].speed, r.trace.at(-1).speed);
    near(r.trace.at(-1).x, ovalLength);
    assert.ok(r.peakSpeed > r.turnSpeed && r.lap > 0, id);
    assert.ok(r.trace.some(s => s.gear === 0), id);
    for (let i = 1; i < r.trace.length; i++) {
      const a = r.trace[i - 1];
      const b = r.trace[i];
      assert.ok(b.t > a.t && b.x > a.x, id);
      const halfway = atTime(r, (a.t + b.t) / 2);
      near(halfway.x, (a.x + b.x) / 2, 1e-6);
      if ((i > 52 && i <= 116) || i > 168) {
        assert.ok(b.speed ** 2 <= v.grip * G * 200, id);
      }
    }
    assert.ok(ovalLap({ ...v, grip: v.grip + .2 }).lap < r.lap, id);
  }
});

test('sharing restores the selected event and tool settings', () => {
  const state = { ...example(), event: 'oval', tool: { brake: 0.5, lateral: 0.6 } };
  const decoded = readFragment(shareFragment(state, 'tools'));
  assert.equal(decoded.view, 'tools');
  assert.equal(decoded.state.event, 'oval');
  assert.deepEqual(decoded.state.tool, state.tool);
  assert.equal(readFragment(shareFragment({ ...state, tool: { brake: 4, lateral: 0 } })).invalid, true);
});

test('published test checkpoints stay distinct from the editable configuration', () => {
  const setup = firebird();
  const stockRun = straightLine(resolve(setup));
  assert.equal(resolve(setup).test60, 9.3);
  setup.tune.grip = .55;
  const tuned = resolve(setup);
  assert.equal(tuned.test60, 9.3);
  assert.equal(tuned.testEt, 16.9);
  assert.ok(straightLine(tuned).zeroTo60 > stockRun.zeroTo60);
});

test('local save is explicit; restoring and editing shared state leaves the saved build unchanged', async () => {
  const { getSaved, saveBuild } = await import('../../experience/configuration.mjs');
  const storage = new Map();
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) },
  });
  try {
    const state = example();
    assert.equal(getSaved(), null);
    state.a.parts.push({ ...presets.seats, preset: 'seats' });
    assert.equal(saveBuild(state.a), true);
    const restored = readFragment(shareFragment(state)).state;
    restored.a.parts.push({ ...presets.radiator, preset: 'radiator' });
    assert.equal(resolve(getSaved()).weight, 3807);
    assert.equal(resolve(restored.a).weight, 3787);
    assert.equal(saveBuild({ ...restored.a, id: 'missing' }), false);
    assert.equal(resolve(getSaved()).weight, 3807);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'localStorage', prior);
    else delete globalThis.localStorage;
  }
});

test('four-lane replay links preserve independent configurations, names, focus and v1 links still reopen', async () => {
  const { lanes, modeOf } = await import('../../experience/configuration.mjs');
  const legacy = '#v1/compare/' + encodeURIComponent(JSON.stringify(example()));
  assert.deepEqual(lanes(readFragment(legacy).state), ['a', 'b']);
  const state = example();
  state.c = { ...newSetup('firebird'), name: 'Autocross – rear axle', tune: {grip: 1.20, finalDrive: 3.90} };
  state.cMode = 'after';
  state.d = newSetup('camaro');
  state.dMode = 'before';
  state.focus = 'c';
  state.event = 'oval';
  const roundtrip = readFragment(shareFragment(state)).state;
  assert.deepEqual(lanes(roundtrip), ['a', 'b', 'c', 'd']);
  assert.equal(roundtrip.c.name, state.c.name);
  assert.equal(roundtrip.c.tune.finalDrive, 3.9);
  assert.equal(roundtrip.focus, 'c');
  assert.equal(roundtrip.event, 'oval');
  assert.equal(modeOf(roundtrip, 'c'), 'after');
  assert.equal(roundtrip.a.tune.finalDrive, undefined);
  state.focus = 'e';
  assert.equal(readFragment(shareFragment(state)).invalid, true);
});

test('live four-car comparison preserves baselines, lap gaps and independent end states', async () => {
  const { matchupEntries } = await import('../../experience/matchup.mjs');
  const { replayFrame } = await import('../../experience/replay.mjs');
  const state = example();
  state.c = { ...newSetup('firebird'), tune: {grip: 1.2} };
  state.cMode = 'after';
  state.d = { ...newSetup('firebird'), tune: {finalDrive: 4.1} };
  state.dMode = 'after';
  for (const event of ['strip', 'oval']) {
    const rows = matchupEntries({...state, event});
    const testTime = row => event === 'oval' ? row.lap : row.finish.t;
    assert.equal(testTime(rows[2].baseline), testTime(rows[0].run));
    assert.notEqual(testTime(rows[2].run), testTime(rows[0].run));
    const moving = replayFrame(rows, 3);
    assert.equal(moving.length, 4);
    assert.ok(moving.some(s => s.gap === 0));
    assert.ok(moving.every(s => !s.finished && s.mph > 0 && s.gap >= 0));
    assert.ok(replayFrame(rows, 100).every(s => s.finished));
  }
});

test('camber illustration shows signed angle with fixed joint height', async () => {
  const { camberIllustration } = await import('../../experience/models.mjs');
  near(camberIllustration(0), 0);
  near(camberIllustration(1), Math.atan(.1) * 180 / Math.PI);
  near(camberIllustration(-1), -camberIllustration(1));
});

test('using an active configuration leaves the saved build and incoming share independent', async () => {
  const { getActive, useConfig, getSaved, saveBuild } = await import('../../experience/configuration.mjs');
  const storage = new Map();
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: {setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key)},
  });
  try {
    saveBuild(newSetup('firebird'));
    assert.equal(getActive(), null);
    assert.equal(useConfig(newSetup('camaro'), 'before'), true);
    assert.equal(readFragment(shareFragment(example())).state.a.id, 'firebird');
    assert.equal(getActive().setup.id, 'camaro');
    assert.equal(getSaved().id, 'firebird');
    assert.equal(useConfig(newSetup('mustang'), 'unknown'), false);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'localStorage', prior);
    else delete globalThis.localStorage;
  }
});
