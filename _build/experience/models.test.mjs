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
  assert.equal(readFragment('#v2/compare/' + hash.split('/')[2]).invalid, true);
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
