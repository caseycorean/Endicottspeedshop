// Claude independent check, 25 Nov 2026.
// Expected values come from a separate Python implementation (0.0005 s steps, event-timed shifts,
// 1 ft oval segments, iterative traction solve) written from the README's stated assumptions,
// not from this code. Tolerances cover the browser model's 0.02 s step and 10 ft oval pieces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newSetup, resolve, straightLine, tireLoads, ride } from '../../experience/models.mjs';
import { ovalLap } from '../../experience/oval.mjs';
import { changeFromOriginal } from '../../experience/change.mjs';

// id: [0–60 s, quarter-mile s, trap mph, oval lap s]
const legacyOptions = { inertia: false, shiftSeconds: .3, launchRpm: 1800, rolloutFt: 0 };
const independent = {
  firebird: [7.779, 16.172, 88.94, 28.641], mustang: [6.775, 15.296, 96.74, 28.268],
  camaro: [6.599, 15.121, 97.69, 28.227], fiero: [7.767, 16.246, 86.28, 28.816],
  corvette: [5.964, 13.803, 115.51, 27.711], miata: [8.501, 16.621, 85.11, 28.761],
  gto: [6.283, 14.628, 104.1, 27.939],
};

for (const [id, [z60, et, trap, lap]] of Object.entries(independent)) {
  test(`${id} legacy effect settings agree with independent physics checkpoints`, () => {
    const v = {...resolve(newSetup(id), false), grip: .9};
    const run = straightLine(v, legacyOptions);
    assert.ok(Math.abs(run.zeroTo60 - z60) < .04, `0–60 ${run.zeroTo60} vs ${z60}`);
    assert.ok(Math.abs(run.finish.t - et) < .04, `ET ${run.finish.t} vs ${et}`);
    assert.ok(Math.abs(run.finish.trap - trap) < .1, `trap ${run.finish.trap} vs ${trap}`);
    assert.ok(Math.abs(ovalLap(v).lap - lap) < .02, `lap ${ovalLap(v).lap} vs ${lap}`);
  });
}

test('hand-checked Firebird: 23 lb seats at 76 in → 3,807 lb, 58.171% front', () => {
  const s = { ...newSetup('firebird'), parts: [{ label: 's', oldWeight: 23, oldX: 76, newWeight: 0, newX: 76 }] };
  const v = resolve(s);
  // rear = (3830·0.42·108.1 − 23·76) / 108.1 = 1592.43 lb
  assert.equal(v.weight, 3807);
  assert.ok(Math.abs(v.rearLb - (3830 * .42 * 108.1 - 23 * 76) / 108.1) < 1e-9);
});

test('tire loads conserve weight and match first-principles transfer', () => {
  const v = resolve(newSetup('camaro'), false);
  const { tires } = tireLoads(v, .4, .7);
  assert.ok(Math.abs(tires.reduce((a, b) => a + b) - v.weight) < 1e-9);
  // Longitudinal: W·h·a/L moved to the front axle
  assert.ok(Math.abs((tires[0] + tires[1]) - (v.frontLb + v.weight * v.cg * .4 / v.wheelbase)) < 1e-9);
});

test('ride frequency equals (1/2π)√(k·g/m) with spring×MR² in series with the tire', () => {
  const v = resolve(newSetup('firebird'), false);
  const kw = v.frontSpring * v.frontMotion ** 2;
  const k = kw * v.tireRate / (kw + v.tireRate);
  const hz = Math.sqrt(k * 386.088 / (v.frontLb / 2 - v.frontUnsprung)) / (2 * Math.PI);
  assert.ok(Math.abs(ride(v, 'front').hz - hz) < 1e-3);
});

test('lighter-but-slower Corvette is explained by rear weight share', () => {
  const base = newSetup('corvette');
  const x = resolve(base, false).wheelbase * .7;
  const mod = { ...base, parts: [{ label: 'r', oldWeight: 50, oldX: x, newWeight: 0, newX: x }] };
  const o = {...resolve(base, false), grip: .9}; const m = {...resolve(mod), grip: .9};
  const c = changeFromOriginal('Car B', o, m, straightLine(o, legacyOptions), straightLine(m, legacyOptions), false);
  assert.ok(c.delta > 0, 'removing rear weight slows a grip-limited launch in this model');
  assert.match(c.headline, /slower/);
  assert.match(c.why, /47\.0% to 46\.6%/);
});

test('oval change note says turn speed is grip-only', () => {
  const base = newSetup('firebird');
  const mod = { ...base, parts: [{ label: 's', oldWeight: 23, oldX: 76, newWeight: 0, newX: 76 }] };
  const o = resolve(base, false); const m = resolve(mod);
  const ro = ovalLap(o); const rm = ovalLap(m);
  assert.equal(ro.turnSpeed, rm.turnSpeed);
  const c = changeFromOriginal('Car A', o, m, ro, rm, true);
  assert.match(c.why, /Turn speed does not change/);
});
