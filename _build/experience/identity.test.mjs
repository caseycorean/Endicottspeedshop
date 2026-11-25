// Identity slice: suggestions and figures must be model runs, never invented numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { perfModel, perfDefaults, nextSteps, quickEt } from '../../experience/performance-view.mjs';
import { circleClasses, finding } from '../../experience/identity-figures.mjs';
import { newSetup } from '../../experience/models.mjs';
import { tireClasses } from '../../engine/traction.mjs';

test('quickEt equals the page result', () => {
  for (const id of ['corvette', 'camaro', 'gto', 'firebird']) {
    const s = newSetup(id);
    assert.equal(quickEt(s, perfDefaults()), perfModel(s, perfDefaults()).accel.et);
  }
});

test('each next-experiment delta equals the result after applying it', () => {
  const setup = newSetup('corvette');
  const m = perfModel(setup, perfDefaults());
  const steps = nextSteps(m, perfDefaults());
  assert.ok(steps.length >= 2);
  for (const s of steps) {
    const applied = { ...setup, tune: { ...setup.tune } };
    let perf = perfDefaults();
    if (s.kind === 'axle') applied.tune.finalDrive = s.ratio; else perf = { ...perf, tire: s.tire, surface: s.surface };
    const after = perfModel(applied, perf).accel.et;
    assert.ok(Math.abs(after - m.accel.et - s.change) < 1e-9, s.title);
  }
  assert.deepEqual(steps.map(s => s.change), [...steps.map(s => s.change)].sort((a, b) => a - b));
});

test('no suggestions without a run', () => {
  const m = perfModel(newSetup('buick-regal-g-body--1987-grand-national-lc2-a4-coupe'), perfDefaults());
  assert.deepEqual(nextSteps(m, perfDefaults()), []);
});

test('tire-circle figure is the tire model (lateral = typical × lateral ratio)', () => {
  for (const c of circleClasses) assert.equal(c.g, +(tireClasses[c.id].longitudinal.typical * tireClasses[c.id].lateralRatio).toFixed(2));
  assert.ok(circleClasses.every((c, i) => !i || c.g > circleClasses[i - 1].g), 'grows by era');
});

test('finding sentence reads the gear-by-gear result', () => {
  const z = perfModel(newSetup('corvette'), perfDefaults());
  assert.match(finding(z), new RegExp(`${Math.round(z.gearRows[0].utilization * 100)}%`));
  assert.match(finding(z), /grip-limited/);
});
