// QA-FAIL fixes for PR #18 (ChatGPT independent QA, 25 Nov 20:30 PT): finite results, non-completing runs, instant shifts,
// and grip monotonicity for the launch presets themselves (not only straightLine).
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../../experience/catalog-data.mjs';
import { archiveCatalog } from '../archive.mjs';
import { labVehicle } from '../garage-adapter.mjs';
import { launchRun, runPreset, timeLost, bestLaunchRpm } from '../launch.mjs';

const ids = [...Object.keys(catalog), ...Object.values(archiveCatalog).filter(x => x.tier === 'simulation-ready' && !x.mergedInto).map(x => x.id)];
const cars = ids.map(id => [id, labVehicle(id)]).filter(([, r]) => r && r.readiness.acceleration.status !== 'blocked').map(([id, r]) => [id, r.vehicle]);
const clutchCars = cars.filter(([, v]) => v.transmission !== 'automatic');
const finite = x => Number.isFinite(x);

test('finding 2: maximum preset on a run that cannot finish returns a labelled fallback, not a TypeError', () => {
  const [id, v] = clutchCars[0];
  const b = bestLaunchRpm(v, { maxTime: 3 });
  assert.equal(b.best, null, id);
  assert.match(b.unavailable, /No launch rpm completes/);
  const r = runPreset(v, 'maximum', { maxTime: 3 });
  assert.match(r.launchRpmFallback, /model launch rpm/);
  assert.equal(r.completed, false);
  assert.equal(r.magazine.et, null);
  const lost = timeLost(v, { maxTime: 3 });
  assert.equal(lost.lost.launchRpm.bestRpm, null);
  assert.equal(lost.base.et, null);
});

test('finding 3: an instant shift stays locked and rev-matched (no second clutch launch) on every clutch car', () => {
  assert.ok(clutchCars.length >= 30, `${clutchCars.length} clutch cars`);
  for (const [id, v] of clutchCars) {
    const inst = launchRun(v, { shiftSeconds: 0, dt: .001 }), slow = launchRun(v, { shiftSeconds: .2, dt: .001 });
    assert.equal(inst.clutchReentries, 0, `${id} instant shift re-entered the clutch phase`);
    assert.equal(slow.clutchReentries, 0, `${id} timed shift re-entered the clutch phase`);
    assert.equal(inst.time.shifting, 0, id);
    // Launch phase is identical up to the first shift, so clutch time must match.
    assert.equal(inst.time.clutch, slow.time.clutch, `${id} clutch time ${inst.time.clutch} vs ${slow.time.clutch}`);
    if (finite(inst.magazine.et) && finite(slow.magazine.et)) assert.ok(inst.magazine.et <= slow.magazine.et + .005, `${id} instant shifts slower`);
  }
});

test('finding 1: every preset completes with finite times on every clutch car', () => {
  for (const [id, v] of clutchCars) for (const p of ['typical', 'performance', 'maximum']) {
    const r = runPreset(v, p, { dt: .001 });
    assert.ok(finite(r.magazine.et) && finite(r.magazine.zeroTo60), `${id} ${p}: et ${r.magazine.et}, 0–60 ${r.magazine.zeroTo60}`);
    assert.equal(r.launchRpmFallback, undefined, `${id} ${p} fell back`);
  }
});

test('finding 1: a grippier tire is never slower under the maximum preset (clutch cars, finite-checked)', () => {
  const mus = [.7, 1, 1.35];
  for (const [id, v] of clutchCars) {
    const runs = mus.map(mu => runPreset(v, 'maximum', { mu, dt: .001 }).magazine);
    runs.forEach((r, i) => assert.ok(finite(r.et) && finite(r.zeroTo60), `${id} μ ${mus[i]} incomplete`));
    // best launch rpm is re-searched per μ on a 250 rpm grid, so allow the 0.02 s "lowest rpm within 0.02 s" tolerance.
    for (let i = 1; i < runs.length; i++) {
      assert.ok(runs[i].et <= runs[i - 1].et + .025, `${id} ET μ ${mus[i - 1]}→${mus[i]}: ${runs[i - 1].et} → ${runs[i].et}`);
      assert.ok(runs[i].zeroTo60 <= runs[i - 1].zeroTo60 + .025, `${id} 0–60 μ ${mus[i - 1]}→${mus[i]}: ${runs[i - 1].zeroTo60} → ${runs[i].zeroTo60}`);
    }
  }
});
