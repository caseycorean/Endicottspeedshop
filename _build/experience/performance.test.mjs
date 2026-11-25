// Performance page (gearing and traction): page model must equal direct calls to the shared engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { perfModel, perfDefaults, matchedClass, cleanPerf } from '../../experience/performance-view.mjs';
import { newSetup, resolve, straightLine } from '../../experience/models.mjs';
import { tractionCheck, byGear, compareTires, frictionFor } from '../../engine/traction.mjs';

const perf = over => ({ ...perfDefaults(), ...over });

test('default tire class equals the vehicle grip input, so the page matches Compare', () => {
  for (const [id, cls] of [['corvette', 'extremeSummer'], ['camaro', 'perf80s'], ['gto', 'maxSummer'], ['firebird', 'radial70s']]) {
    const v = resolve(newSetup(id));
    assert.equal(matchedClass(v), cls);
    const m = perfModel(newSetup(id), perf());
    assert.equal(m.accel.et, straightLine(v).finish.t, id); // same μ → identical to the Compare run
    assert.equal(m.base.et, m.accel.et);
  }
});

test('C5 Z06: traction check, gear by gear and tire comparison come straight from engine/traction.mjs', () => {
  const v = resolve(newSetup('corvette'));
  const m = perfModel(newSetup('corvette'), perf());
  const opts = { tire: 'extremeSummer', surface: 'dryAsphalt' };
  assert.deepEqual(m.check, tractionCheck(v, { ...opts, gear: 0 }));
  assert.deepEqual(m.gearRows, byGear(v, opts));
  assert.deepEqual(m.gearRows.slice(0, 3).map(r => r.status), ['red', 'yellow', 'green']);
  assert.deepEqual(m.tireRows, compareTires(v, { surface: 'dryAsphalt', gear: 0 }));
});

test('tire and surface change the run only through the friction cap, with a low/typical/high range', () => {
  const setup = newSetup('corvette');
  const v = resolve(setup);
  const m = perfModel(setup, perf({ tire: 'maxSummer', surface: 'wetAsphalt' }));
  const f = frictionFor({ tire: 'maxSummer', surface: 'wetAsphalt' });
  assert.equal(m.accel.et, straightLine(v, { mu: f.typical }).finish.t);
  assert.deepEqual(m.accel.etRange, [straightLine(v, { mu: f.high }).finish.t, straightLine(v, { mu: f.low }).finish.t]);
  assert.ok(m.accel.et > m.base.et, 'wet is slower than dry');
});

test('a car that is not grip limited does not get faster on stickier tires', () => {
  const setup = newSetup('firebird');
  const a = perfModel(setup, perf({ tire: 'extremeSummer' }));
  const b = perfModel(setup, perf({ tire: 'slick', surface: 'preppedStrip' }));
  if (a.accel.time.traction < .05) assert.equal(a.accel.et, b.accel.et);
  else assert.ok(b.accel.et <= a.accel.et);
});

test('gearing change is a normal setup override and moves the results', () => {
  const setup = newSetup('corvette');
  setup.tune.finalDrive = 4.1;
  const m = perfModel(setup, perf());
  assert.equal(m.v.finalDrive, 4.1);
  assert.equal(m.check.demandLb, tractionCheck(resolve(setup), { tire: 'extremeSummer', surface: 'dryAsphalt', gear: 0 }).demandLb);
  assert.ok(m.check.demandLb > perfModel(newSetup('corvette'), perf()).check.demandLb);
});

test('missing data blocks only dependent results', () => {
  const gn = perfModel(newSetup('buick-regal-g-body--1987-grand-national-lc2-a4-coupe'), perf());
  assert.equal(gn.accel, null);
  assert.equal(gn.check.status, 'missing');
  assert.ok(gn.check.missing.includes('weight'));
  assert.ok(gn.gearing.length >= 4, 'gear speeds do not need weight');
  const gtr = newSetup('nissan-gt-r-r35--2017-premium-3.8-a6-coupe');
  assert.equal(perfModel(gtr, perf()).accel, null);
  gtr.tune.finalDrive = 3.73;
  const fixed = perfModel(gtr, perf());
  assert.ok(Number.isFinite(fixed.accel.et));
  assert.notEqual(fixed.check.status, 'missing');
});

test('stored page settings are validated', () => {
  assert.deepEqual(cleanPerf({ tire: 'nope', surface: 'lava', gear: -1, customMu: 9 }), perfDefaults());
  assert.equal(cleanPerf({ tire: 'custom', customMu: 1.3 }).customMu, 1.3);
  assert.equal(cleanPerf({ tire: 'custom' }).tire, null);
});
