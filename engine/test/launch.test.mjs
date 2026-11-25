// Launch dynamics checks. Expected values are derived by hand or from the unchanged straightLine model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { straightLine, tractionLimit, resistanceAt, tireGrip } from '../acceleration.mjs';
import { launchRun, runPreset, bestLaunchRpm, timeLost, performanceWithTires, presets } from '../launch.mjs';
import { frictionFor } from '../traction.mjs';
import { archiveCatalog } from '../archive.mjs';
import { labVehicle } from '../garage-adapter.mjs';
import * as lab from '../../experience/models.mjs';

const car = id => lab.resolve(lab.newSetup(id), false);
const G = 32.174;

test('engine-limited run (unlimited grip, instant clutch) reproduces straightLine to 0.005 s', () => {
  for (const id of ['corvette', 'miata', 'camaro']) {
    const v = car(id);
    const a = straightLine(v, { mu: 9 }), b = launchRun(v, { mu: 9, clutchSeconds: 0, dt: .001 });
    assert.ok(Math.abs(a.finish.t - b.finish.t) < .005, `${id} ET ${a.finish.t} vs ${b.finish.t}`);
    assert.ok(Math.abs(a.zeroTo60 - b.zeroTo60) < .005, `${id} 0-60`);
  }
});

test('at the grip limit the car accelerates at (grip − resistance)/mass, by hand', () => {
  const v = car('corvette');
  const r = launchRun(v, { dt: .0005 });
  const s = r.trace.filter(p => p.limit === 'grip' && p.gear === 1);
  const [p, q] = [s[5], s[6]];
  const mph = 5280 / 3600, vMid = (p.speed + q.speed) / 2 * mph;
  const R = resistanceAt(v, vMid), hand = (tractionLimit(v, R, v.grip) - R) / v.weight * G;
  const model = (q.speed - p.speed) * mph / (q.t - p.t);
  assert.ok(Math.abs(model - hand) / hand < .01, `${model} vs ${hand} ft/s²`);
});

test('presets: typical is slowest, maximum effort quickest; the clutch dump spins and is slower than maximum on the Z06', () => {
  for (const id of ['corvette', 'gto', 'camaro', 'miata', 'mustang']) {
    const v = car(id);
    const [ty, pe, mx] = ['typical', 'performance', 'maximum'].map(p => runPreset(v, p).magazine.et);
    assert.ok(ty > pe && pe >= mx - .005, `${id}: ${ty} ${pe} ${mx}`);
  }
  const z = car('corvette');
  const dump = runPreset(z, 'dump'), max = runPreset(z, 'maximum');
  assert.ok(dump.time.wheelspin > 1 && dump.magazine.zeroTo60 > max.magazine.zeroTo60 + .2);
  assert.ok(dump.peakShock > 1.3, `shock ${dump.peakShock}`);
  assert.equal(max.time.wheelspin, 0);
});

test('best launch rpm depends on the car: high for the low-torque Miata, irrelevant for the grip-limited Z06', () => {
  assert.ok(bestLaunchRpm(car('miata')).best.rpm >= 5000);
  const z = bestLaunchRpm(car('corvette')).rows;
  const spread = Math.max(...z.map(r => r.zeroTo60)) - Math.min(...z.map(r => r.zeroTo60));
  assert.ok(spread < .15, `Z06 0-60 spread across launch rpm ${spread}`);
  const lost = timeLost(car('miata'), { launchRpm: 2000, clutchSeconds: .7 });
  assert.ok(lost.lost.launchRpm.zeroTo60 > .8 && lost.lost.traction.zeroTo60 === 0);
});

test('C5 Z06 diagnosis: the 5.96 s shipped figure reproduces; maximum effort is within 0.3 s of the 4.07 s test', () => {
  const v = car('corvette');
  assert.ok(Math.abs(straightLine(v, { mu: .9, inertia: false, shiftSeconds: .3, launchRpm: 1800, rolloutFt: 0 }).zeroTo60 - 5.96) < .01);
  const m = runPreset(v, 'maximum').magazine;
  assert.ok(Math.abs(m.zeroTo60 - 4.07) < .3 && Math.abs(m.et - 12.48) < .15, `${m.zeroTo60} ${m.et}`);
  // The remaining 0-60 gap closes at μ ≈ 1.18, inside the extreme-summer class range (1.03–1.22) — reported, not adopted.
  const at = mu => runPreset(v, 'maximum', { mu }).magazine.zeroTo60;
  assert.ok(at(1.15) > 4.07 && at(1.22) < 4.07);
});

test('maximum effort against the 59 archive road tests (hold-out, no constant changed): ET MAE ≤ 0.27 s, |bias| ≤ 0.1 s', () => {
  const et = [], s60 = [];
  for (const x of Object.values(archiveCatalog)) {
    if (x.tier !== 'simulation-ready') continue;
    const f = x.record.fields; if (!f.testEt && !f.test60) continue;
    const m = runPreset(labVehicle(x.id).vehicle, 'maximum', { dt: .001 }).magazine;
    if (f.testEt && m.et) et.push(m.et - f.testEt[0]);
    if (f.test60 && m.zeroTo60) s60.push(m.zeroTo60 - f.test60[0]);
  }
  const mae = a => a.reduce((s, e) => s + Math.abs(e), 0) / a.length, mean = a => a.reduce((s, e) => s + e, 0) / a.length;
  assert.ok(et.length >= 55);
  assert.ok(mae(et) <= .27, `ET MAE ${mae(et)}`);
  assert.ok(Math.abs(mean(et)) <= .1, `ET bias ${mean(et)}`);
  assert.ok(mae(s60) <= .27, `0-60 MAE ${mae(s60)}`);
});

test('one tire/surface setting feeds both the run and the traction check; range brackets the typical result', () => {
  const v = car('corvette');
  const r = performanceWithTires(v, { tire: 'extremeSummer', surface: 'dryAsphalt' });
  const f = frictionFor({ tire: 'extremeSummer' });
  assert.equal(r.friction.typical, f.typical);
  assert.equal(r.check.friction.typical, f.typical);
  assert.ok(Math.abs(r.result.et - runPreset(v, 'performance', { mu: f.typical, dt: .001 }).magazine.et) < 1e-9);
  assert.ok(r.range.quickest.et < r.result.et && r.result.et < r.range.slowest.et);
  const wet = performanceWithTires(v, { tire: 'extremeSummer', surface: 'wetAsphalt' });
  assert.ok(wet.result.zeroTo60 > r.result.zeroTo60 + .5);
  assert.equal(f.typical, tireGrip.extreme.mu);
});

test('automatics use the converter model; presets have labels and notes', () => {
  const v = { ...car('gto'), transmission: 'automatic' };
  assert.match(runPreset(v, 'typical').model, /converter/);
  for (const p of Object.values(presets)) assert.ok(p.label && p.note);
});
