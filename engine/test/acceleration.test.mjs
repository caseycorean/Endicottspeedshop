import test from 'node:test';
import assert from 'node:assert/strict';
import { straightLine, tireGrip, massFactor } from '../acceleration.mjs';
import * as lab from '../../experience/models.mjs';
import { vehicleIds } from '../../experience/vehicles.mjs';

const car = id => lab.resolve(lab.newSetup(id), false);

test('Vehicle Lab uses v2 and keeps the final replay sample on the finish line', () => {
  for (const id of vehicleIds) {
    const v = car(id);
    const ui = lab.straightLine(v);
    const core = straightLine(v);
    assert.deepEqual(ui.finish, core.finish);
    assert.deepEqual(ui.magazine, core.magazine);
    assert.equal(ui.trace.at(-1).x, 1320);
    assert.equal(ui.trace.at(-1).t, ui.finish.t);
  }
});

// Road tests. 'calibration' cars set the tire-type grip values; 'hold-out' cars were not used to set anything.
// Flagged cases are reported, not asserted (see validation notes in engine/README.md).
const roadTests = [
  { id: 'corvette', tire: 'extreme', et: 12.48, trap: 114.9, t60: 4.07, use: 'calibration', src: 'MotorTrend 2002 Z06 first test' },
  { id: 'gto', tire: 'uhp', et: 14.0, trap: 102, t60: 5.3, use: 'calibration', src: 'record test fields' },
  { id: 'camaro', tire: 'perf80s', et: 14.9, trap: 93, t60: 6.4, use: 'calibration', src: 'Car and Driver 1991 Z28' },
  { id: 'miata', tire: 'perf80s', et: 16.5, trap: 82, t60: 9.2, use: 'hold-out', src: 'C/D 9/1989 0-60; ET/trap secondary aggregator' },
  { id: 'mustang', tire: 'perf80s', et: 14.8, trap: 96, t60: 6.2, use: 'hold-out', patch: { hp: 225, torque: 300, torqueRpm: 3200 },
    src: 'MotorTrend 7/1990 5.0 LX (secondary quote); 1990 rating used, record is 1993 SSP' },
];

for (const r of roadTests) {
  test(`road test ${r.id} (${r.use}): ET within 0.3 s, trap within 3 mph, 0–60 within 0.5 s`, () => {
    const v = { ...car(r.id), ...(r.patch ?? {}) };
    const m = straightLine(v, { mu: tireGrip[r.tire].mu }).magazine;
    assert.ok(Math.abs(m.et - r.et) <= .3, `ET ${m.et.toFixed(2)} vs ${r.et}`);
    assert.ok(Math.abs(m.trap - r.trap) <= 3, `trap ${m.trap.toFixed(1)} vs ${r.trap}`);
    assert.ok(Math.abs(m.zeroTo60 - r.t60) <= .5, `0-60 ${m.zeroTo60.toFixed(2)} vs ${r.t60}`);
  });
}

test('shipped model misses the Corvette by more than a second; candidate is within 0.3 s', () => {
  const v = car('corvette');
  const old = straightLine(v, {mu: .9, inertia: false, shiftSeconds: .3, launchRpm: 1800, rolloutFt: 0});
  assert.ok(old.finish.t - 12.48 > 1.0);
  assert.ok(Math.abs(straightLine(v, { mu: tireGrip.extreme.mu }).magazine.et - 12.48) < .3);
});

test('mass factor (Gillespie): 1.04 + 0.0025 N²', () => {
  assert.equal(massFactor(10), 1.29);
});
