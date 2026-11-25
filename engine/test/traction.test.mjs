// Traction model checks. Hand calculations are written out independently of engine/traction.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tireClasses, frictionFor, tractionCheck, compareTires, byGear, muFromSixtyFoot, pickerOrder, surfaces, missingFor } from '../traction.mjs';
import { tireGrip, tractionLimit } from '../acceleration.mjs';
import { labVehicle } from '../garage-adapter.mjs';

// Owner prototype (25 Nov): 3600 lb, 44% rear, 108 in wheelbase, 20 in CG, 27 in tire, 85% efficiency.
const proto = { weight: 3600, front: .56, wheelbase: 108, cg: 20, diameter: 27, gears: [2.95, 1.94, 1.34, 1, .73], finalDrive: 3.73,
  torque: 400, torqueRpm: 4000, hp: 400, hpRpm: 5600, redline: 6200, transmission: 'manual' };

test('owner formula F = mu Wr / (1 - mu h/L), by hand', () => {
  for (const mu of [.85, 1, 1.2, 1.5]) {
    const hand = mu * 3600 * .44 / (1 - mu * 20 / 108);
    const r = tractionCheck(proto, { customMu: mu, torque: 300 });
    assert.ok(Math.abs(r.availableLb.typical - hand) < 1, `${mu}: ${r.availableLb.typical} vs ${hand}`);
  }
  // demand: 300 lb-ft × 2.95 × 3.73 × .85 / (13.5/12 ft)
  const demand = 300 * 2.95 * 3.73 * .85 / (27 / 24);
  assert.equal(tractionCheck(proto, { customMu: 1, torque: 300 }).demandLb, Math.round(demand));
});

test('front-lift cap and the mu·h/L ≥ 1 guard', () => {
  const lift = 3600 * .56 * 108 / 20; // Wf·L/h
  const tall = { ...proto, cg: 40 };   // lever .37: mu 3 → mu·h/L > 1
  assert.equal(Math.round(tractionLimit(tall, 0, 3, 'rear')), Math.round(3600 * .56 * 108 / 40));
  const r = tractionCheck(proto, { customMu: 5, torque: 300 });
  assert.equal(r.availableLb.typical, Math.round(lift));
  assert.ok(r.frontLift);
  assert.match(r.text, /front end would lift/);
});

test('typical class values equal the calibrated acceleration grip (no existing result changes)', () => {
  assert.equal(tireClasses.maxSummer.longitudinal.typical, tireGrip.uhp.mu);
  assert.equal(tireClasses.extremeSummer.longitudinal.typical, tireGrip.extreme.mu);
  assert.equal(tireClasses.dragRadial.longitudinal.typical, tireGrip.dragRadial.mu);
  for (const k of ['bias', 'radial70s', 'perf80s', 'track200']) assert.equal(tireClasses[k].longitudinal.typical, tireGrip[k].mu);
  for (const [id, c] of Object.entries(tireClasses)) {
    const l = c.longitudinal; assert.ok(l.low < l.typical && l.typical < l.high, id);
    assert.ok(c.src.length && c.evidence, id);
  }
});

test('class ordering follows the Tire Rack 2024 category ranking on dry asphalt', () => {
  const t = id => frictionFor({ tire: id }).typical;
  assert.ok(t('allSeason') < t('maxSummer') && t('maxSummer') < t('extremeSummer'));
  assert.ok(frictionFor({ tire: 'slick', surface: 'preppedStrip' }).typical > frictionFor({ tire: 'dragRadial', surface: 'preppedStrip' }).typical);
});

test('surface, temperature and drag tires', () => {
  const dry = frictionFor({ tire: 'maxSummer' }), wet = frictionFor({ tire: 'maxSummer', surface: 'wetAsphalt' });
  assert.ok(wet.typical < .8 * dry.typical && wet.typical > .5 * dry.typical);
  assert.ok(frictionFor({ tire: 'dragRadial', surface: 'wetAsphalt' }).typical < wet.typical, 'drag radial worse in the wet');
  assert.ok(frictionFor({ tire: 'dragRadial', surface: 'preppedStrip' }).typical > frictionFor({ tire: 'dragRadial' }).typical, 'prep helps drag tires');
  const cold = frictionFor({ tire: 'extremeSummer', ambientF: 35 });
  assert.ok(cold.typical < frictionFor({ tire: 'extremeSummer' }).typical && cold.notes.some(n => /50 °F/.test(n)));
  assert.equal(frictionFor({ tire: 'allSeason', ambientF: 35 }).typical, frictionFor({ tire: 'allSeason' }).typical);
  assert.equal(frictionFor({ customMu: 1.3 }).typical, 1.3);
  for (const s of Object.keys(surfaces)) for (const c of pickerOrder) assert.ok(frictionFor({ tire: c, surface: s }).low > 0);
});

test('60-ft derivation: t = sqrt(120/a)', () => {
  assert.equal(muFromSixtyFoot(1.5), 1.66);
  assert.equal(muFromSixtyFoot(Math.sqrt(120 / 32.174)), 1);
});

test('status thresholds and comparison across classes', () => {
  const green = tractionCheck(proto, { customMu: 1, torque: 100 });
  assert.equal(green.status, 'green'); assert.ok(green.reserveLb > 0);
  assert.equal(tractionCheck(proto, { tire: 'allSeason', torque: 450 }).status, 'red');
  const rows = compareTires(proto, { torque: 300 });
  assert.equal(rows.length, pickerOrder.length);
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.ok(by.allSeason.utilization > by.maxSummer.utilization && by.maxSummer.utilization > by.extremeSummer.utilization);
  assert.ok(rows.every(r => r.demandLb === rows[0].demandLb), 'same configuration → same demand');
});

test('real vehicles: C5 Z06 spins first gear on its OE class, hooks by third; missing facts reported', () => {
  const z06 = labVehicle('chevrolet-corvette-c5--2002-z06-ls6-m6-hardtop').vehicle;
  const g = byGear(z06, { tire: 'extremeSummer' });
  assert.equal(g[0].status, 'red'); assert.equal(g[2].status, 'green');
  const fwd = { ...proto, drive: 'front' };
  const hand = 1 * 3600 * .56 / (1 + 20 / 108);
  assert.ok(Math.abs(tractionCheck(fwd, { customMu: 1, torque: 300 }).availableLb.typical - hand) < 1);
  assert.ok(Math.abs(tractionCheck({ ...proto, drive: 'all' }, { customMu: 1, torque: 300 }).availableLb.typical - 3600) < 1);
  const partial = { ...proto, gears: [] };
  assert.equal(tractionCheck(partial, { tire: 'allSeason' }).status, 'missing');
  assert.deepEqual(missingFor(partial), ['gear ratios']);
});
