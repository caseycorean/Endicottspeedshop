// Claude sprint 26 Nov 2026 — independent checks of engine/braking.mjs.
// Expected values are derived by hand here, not taken from the module:
//  • constant deceleration: d = v²/(2·μ·g) (feet, v in ft/s)
//  • with load sensitivity k and ABS efficiency η, peak a solves  W·a = η·μ0·(W − k·ΔW²·(1/Wf + 1/Wr)),
//    ΔW = W·h·a/L  ⇒  (η·μ0·k·W²h²/L²·(1/Wf+1/Wr))·a² + W·a − η·μ0·W = 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { brakingStop, decelAt, idealBias, installedBias, axleLoadsAt, lockedStop, impliedG, standardStops } from '../braking.mjs';

const G = 32.174, MPH = 5280 / 3600;
const car = { weight: 3400, frontLb: 1870, rearLb: 1530, cg: 20, wheelbase: 106, grip: 1.05, cda: 7, diameter: 26 };
const bare = { riseTime: 0, sensitivity: 0, absEfficiency: 1, rollResistance: 0, longitudinalRatio: 1 };

test('constant-deceleration baseline: no drag, no rise, no load sensitivity → v²/2μg', () => {
  for (const mph of [60, 70, 100]) {
    const d = brakingStop({ ...car, cda: 0 }, { from: mph, ...bare }).distance;
    const expect = (mph * MPH) ** 2 / (2 * car.grip * G);
    assert.ok(Math.abs(d - expect) < .3, `${mph}: ${d} vs ${expect}`);
  }
});

test('axle loads always sum to the car weight and move forward with deceleration', () => {
  for (const a of [0, .5, 1, 1.3]) {
    const L = axleLoadsAt(car, a);
    assert.ok(Math.abs(L.front + L.rear - car.weight) < 1e-9);
    assert.ok(Math.abs(L.transfer - car.weight * car.cg * a / car.wheelbase) < 1e-9);
  }
});

test('peak deceleration with load sensitivity matches the hand-derived quadratic', () => {
  for (const k of [.1, .15, .2]) for (const eta of [.9, .95, 1]) {
    const { weight: W, frontLb: Wf, rearLb: Wr, cg: h, wheelbase: L, grip: mu } = car;
    const A = eta * mu * k * W * W * h * h / (L * L) * (1 / Wf + 1 / Wr);
    const a = (-W + Math.sqrt(W * W + 4 * A * eta * mu * W)) / (2 * A);
    const got = decelAt({ ...car, cda: 0 }, 0, { sensitivity: k, absEfficiency: eta, rollResistance: 0, longitudinalRatio: 1 }).a;
    assert.ok(Math.abs(got - a) < 1e-6, `k ${k} η ${eta}: ${got} vs ${a}`);
  }
});

test('ideal split saturates both axles together; front-biased locks the front, rear-biased is flagged unstable', () => {
  const opts = { ...bare, abs: false };
  const ideal = idealBias(car, car.grip, 0);
  const at = decelAt({ ...car, cda: 0 }, 0, { ...opts, bias: ideal });
  assert.ok(Math.abs(at.a - car.grip) < 1e-6);
  assert.ok(Math.abs(at.utilization.front - 1) < 1e-6 && Math.abs(at.utilization.rear - 1) < 1e-6);
  const fwd = decelAt(car, 0, { ...opts, bias: ideal + .08 });
  const rwd = decelAt(car, 0, { ...opts, bias: ideal - .08 });
  assert.equal(fwd.limit, 'front tires'); assert.equal(fwd.unstable, false);
  assert.equal(rwd.limit, 'rear tires'); assert.equal(rwd.unstable, true);
  assert.ok(fwd.a < at.a && rwd.a < at.a);
  // installed estimate is front-biased: stable, front locks first
  const inst = decelAt(car, 0, { abs: false, bias: installedBias(car) });
  assert.equal(inst.limit, 'front tires');
});

test('bigger brakes do not shorten a tire-limited stop; too little brake torque does lengthen it', () => {
  const big = brakingStop(car, { from: 70, brakeTorque: { front: 4000, rear: 2500 } });
  const huge = brakingStop(car, { from: 70, brakeTorque: { front: 8000, rear: 5000 } });
  const none = brakingStop(car, { from: 70 });
  assert.equal(big.limit, 'tires');
  assert.ok(Math.abs(big.distance - huge.distance) < 1e-9 && Math.abs(big.distance - none.distance) < 1e-9);
  assert.match(none.notes[0], /Bigger brakes would not shorten/);
  const small = brakingStop(car, { from: 70, brakeTorque: { front: 1200, rear: 2500 } });
  assert.equal(small.limit, 'front brakes');
  assert.ok(small.distance > none.distance + 5);
  assert.match(small.notes.join(' '), /more brake torque would shorten/);
});

test('lower CG shortens the stop only through tire load sensitivity', () => {
  const low = { ...car, cg: 17 };
  assert.ok(brakingStop(low, { from: 60 }).distance < brakingStop(car, { from: 60 }).distance);
  const o = { from: 60, sensitivity: 0 };
  assert.ok(Math.abs(brakingStop(low, o).distance - brakingStop(car, o).distance) < 1e-9);
});

test('more grip is never longer; drag helps more from 100 mph; rise time adds about v·t/2', () => {
  let last = Infinity;
  for (const grip of [.7, .8, .9, 1, 1.1, 1.2]) { const d = brakingStop({ ...car, grip }, { from: 60 }).distance; assert.ok(d < last); last = d; }
  const noAero = brakingStop({ ...car, cda: 0 }, { from: 100 }).distance, aero = brakingStop(car, { from: 100 }).distance;
  assert.ok(aero < noAero);
  const r0 = brakingStop(car, { from: 70, riseTime: 0 }).distance, r15 = brakingStop(car, { from: 70, riseTime: .15 }).distance;
  const expect = 70 * MPH * .15 / 2;
  assert.ok(Math.abs((r15 - r0) - expect) < 1.5, `${r15 - r0} vs ≈${expect}`);
});

test('locked-wheel panic stop is longer than ABS; front axle takes most of the energy', () => {
  const abs = brakingStop(car, { from: 60 }), lock = lockedStop(car, { from: 60 });
  assert.ok(lock.distance > abs.distance * 1.15);
  assert.ok(abs.energyShare.front > car.frontLb / car.weight);
  assert.ok(Math.abs(abs.energyShare.front + abs.energyShare.rear - 1) < 1e-9);
});

test('readiness, helpers and finite results', () => {
  assert.equal(brakingStop({ weight: 3000 }).status, 'missing');
  assert.ok(Math.abs(impliedG(60, 120.4) - 1) < .002);
  const s = standardStops(car);
  for (const mph of [60, 70, 100]) assert.ok(Number.isFinite(s[mph].distance) && Number.isFinite(s[mph].time) && s[mph].time > 0);
  assert.ok(s[100].distance > s[70].distance && s[70].distance > s[60].distance);
});

test('longitudinalRatio scales peak braking friction: constant-decel stop = v²/(2·L·μ·g); default 1 leaves stops unchanged', () => {
  for (const L of [1, 1.04, 1.08]) {
    const d = brakingStop({ ...car, cda: 0 }, { from: 70, ...bare, longitudinalRatio: L }).distance;
    const expect = (70 * MPH) ** 2 / (2 * L * car.grip * G);
    assert.ok(Math.abs(d - expect) < .3, `L ${L}: ${d} vs ${expect}`);
  }
  assert.equal(brakingStop(car, { from: 60 }).distance, brakingStop(car, { from: 60, longitudinalRatio: 1 }).distance);
});
