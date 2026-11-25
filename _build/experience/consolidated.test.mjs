import test from 'node:test';
import assert from 'node:assert/strict';
import { newSetup, resolve, ride, tireLoads, straightLine } from '../../experience/models.mjs';
import { missingFor, estimatedFor } from '../../experience/readiness.mjs';
import { example, shareFragment, readFragment } from '../../experience/configuration.mjs';
import { straightLine as kernel } from '../../engine/acceleration.mjs';

test('a ride-only setup need not have wheelbase, CG height or powertrain data', () => {
  const setup = newSetup('custom');
  setup.base = {weight: 3400, front: .52};
  setup.estimates = ['frontSpring', 'rearSpring', 'frontMotion', 'rearMotion', 'frontUnsprung', 'rearUnsprung', 'tireRate'];
  const state = {...example(), a: setup};
  const transferred = readFragment(shareFragment(state, 'tools')).state.a;
  const v = resolve(transferred, false);
  assert.equal(v.wheelbase, null);
  assert.equal(v.hp, null);
  assert.ok(ride(v, 'front').hz > 0);
  assert.equal(missingFor(v, 'spring-rate').length, 0);
  assert.equal(estimatedFor(v, 'spring-rate').length, 7);
  assert.equal(v.evidence.weight, 'user');
  assert.ok(tireLoads(v, .4, .8).missing.includes('wheelbase'));
  assert.ok(straightLine(v).issue.includes('Peak power'));
});

test('a loads-only setup requires neither spring data nor a drivetrain', () => {
  const s = newSetup('custom');
  s.base = {weight: 3400, front: .52, wheelbase: 102};
  s.estimates = ['cg', 'frontTrack', 'rearTrack'];
  const v = resolve(s);
  assert.deepEqual(missingFor(v, 'load-transfer'), []);
  assert.equal(v.frontSpring, null);
  assert.equal(v.drivetrain, null);
  const loads = tireLoads(v, .5, .75);
  assert.ok(Math.abs(loads.tires.reduce((a, b) => a + b) - 3400) < 1e-9);
});

test('v2 hits a closed-form constant-traction distance and two rollout clocks', () => {
  const base = resolve(newSetup('corvette'), false);
  const v = {...base, grip: .35, cda: 0};
  // Independent solution. With no resistance and one gear at these speeds, the axle remains
  // grip limited at F = μWr / (1 − μh/L). Wheel-only rotational inertia adds four percent.
  const a = 32.174 * v.grip * (1 - v.front) / (1 - v.grip * v.cg / v.wheelbase) / 1.04;
  const distanceFt = 60;
  const run = kernel(v, {distanceFt, rollResistance: 0});
  assert.ok(run.trace.slice(1).every(s => s.limit === 'traction'));
  assert.ok(Math.abs(run.finish.t - Math.sqrt(2 * distanceFt / a)) < .001);
  const stripClock = Math.sqrt(2 * (distanceFt + 1) / a) - Math.sqrt(2 / a);
  assert.ok(Math.abs(run.magazine.et - stripClock) < .001);
});

test('Z06 published trim benchmark uses the right clock and is marked calibration', () => {
  const v = resolve(newSetup('corvette'), false);
  const run = straightLine(v);
  assert.equal(v.evidence.grip, 'estimated');
  assert.ok(run.finish.t - run.magazine.et > .25);
  assert.ok(Math.abs(run.magazine.et - 12.48) < .25);
  assert.ok(Math.abs(run.magazine.trap - 114.9) < 2);
});
