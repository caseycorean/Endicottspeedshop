// Claude sprint 26 Nov 2026 — engine/roll.mjs. Expected values are worked by hand in the comments, not taken from the module.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollStiffness, rollEstimate, rollSetup, barWheelRate, CALCULATOR_DEFAULTS } from '../roll.mjs';
import { rollDefaults } from '../maneuvers.mjs';
import { corneringLimit } from '../cornering.mjs';
import { stock } from '../../experience/vehicles.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const axles = s => ({ ...s, frontLb: s.weight * s.front, rearLb: s.weight * (1 - s.front) });

test('roll stiffness of springs alone: K = k_w·t²/2', () => {
  // 200 lb/in wheel rate, 60 in track: 200·3600/2 = 360,000 lb·in/rad = 6,283.2 lb·in/deg = 523.6 lb·ft/deg
  const r = rollStiffness({ frontTrack: 60, rearTrack: 60, frontWheelRate: 200, rearWheelRate: 200 });
  near(r.front, 523.6, .1, 'front lb·ft/deg'); near(r.frontRoll, .5, 1e-12, 'equal axles split evenly');
  // spring 500 lb/in at motion ratio 0.6 → wheel rate 180
  near(rollStiffness({ frontTrack: 60, rearTrack: 60, frontSpring: 500, frontMotion: .6, rearWheelRate: 180 }).frontRoll, .5, 1e-12, 'spring × motion²');
});

test('a front bar raises the front share; the tire in series softens both axles', () => {
  const base = { frontTrack: 60, rearTrack: 60, frontWheelRate: 200, rearWheelRate: 200 };
  // bar 200 lb/in at each wheel doubles front: share 2/3
  near(rollStiffness({ ...base, frontBar: 200 }).frontRoll, 2 / 3, 1e-12, 'front bar');
  const t = rollStiffness({ ...base, tireRate: 1800 });
  near(t.front, 523.6 * 1800 / 2000, .1, 'series with a 1,800 lb/in tire');
});

test('roll gradient = W·(h − roll-axis height)/(K_f + K_r)', () => {
  // 3,000 lb, 50/50, cg 20 in, centres 2 and 4 → axis 3 in; K_f + K_r = 2·6,283.2 lb·in/deg ⇒ 3000·17/12566.4 = 4.06 deg/g
  const r = rollStiffness({ weight: 3000, front: .5, cg: 20, frontTrack: 60, rearTrack: 60, frontWheelRate: 200, rearWheelRate: 200 }, { frontCenter: 2, rearCenter: 4 });
  near(r.gradient, 4.058, .005, 'deg/g');
});

test('anti-roll bar wheel rate from bar size (solid and tubular)', () => {
  // 1.25 in solid, 40 in long, 10 in arms, motion 1: J = π·1.25⁴/32 = 0.23968 in⁴; K_t = 11.5e6·J/40 = 68,908 lb·in/rad;
  // per-wheel roll rate 2·K_t/a² = 1,378 lb/in
  near(barWheelRate({ diameterIn: 1.25, lengthIn: 40, armIn: 10 }), 1378.2, 1, 'solid');
  assert.ok(barWheelRate({ diameterIn: 1.25, wallIn: .188, lengthIn: 40, armIn: 10 }) < 1378, 'tubular is softer');
  near(barWheelRate({ diameterIn: 1.25, lengthIn: 40, armIn: 10, motion: .5 }), 1378.2 / 4, .5, 'motion ratio squared');
});

test('rollSetup uses springs only when they are data, and given values win', () => {
  const v = { weight: 3000, front: .55, frontLb: 1650, rearLb: 1350, cg: 20, frontTrack: 60, rearTrack: 60, archFront: 'strut', archRear: 'irsMultilink',
    frontSpring: 300, rearSpring: 300, frontMotion: 1, rearMotion: 1, evidence: { frontSpring: 'estimate', rearSpring: 'estimate' } };
  const e = rollSetup(v);
  near(e.frontRoll, .60, 1e-12, 'estimated springs → weight share + 5 %'); assert.equal(e.frontCenter, 3); assert.equal(e.rearCenter, 4);
  near(rollSetup({ ...v, frontBar: 300 }).frontRoll, 2 / 3, 1e-12, 'bar data → stiffness split');
  near(rollSetup(v, { fromSprings: true }).frontRoll, .5, 1e-12, 'caller asks for springs');
  assert.deepEqual([rollSetup(v, { frontRoll: .7, frontCenter: 1, rearCenter: 9 })].map(s => [s.frontRoll, s.frontCenter, s.rearCenter, s.basis.split]), [[.7, 1, 9, 'given']]);
});

test('one roll-estimate path: maneuvers rollDefaults is roll.mjs rollEstimate', () => {
  assert.equal(rollDefaults, rollEstimate);
  assert.deepEqual(CALCULATOR_DEFAULTS, { frontRoll: .6, frontCenter: 2, rearCenter: 12 });
});

test('per-car setup makes front-heavy independent-rear cars push; calculator defaults (unchanged) still name the rear', () => {
  const civic = axles(stock('honda-civic-fl5--2023-type-r-k20c1-m6-hatch'));
  assert.equal(corneringLimit(civic).limitingAxle, 'rear', 'defaults unchanged');
  assert.equal(corneringLimit(civic, rollSetup(civic)).limitingAxle, 'front', 'FWD hatch understeers');
  const mustang = axles(stock('ford-mustang-s550--2018-gt-pp2-5.0-m6-fastback'));
  assert.equal(corneringLimit(mustang, rollSetup(mustang)).limitingAxle, 'front');
});

test('oval opt-in: roll "car" changes the limit only when asked', async () => {
  const { ovalLap } = await import('../../experience/oval.mjs');
  const { newSetup, resolve } = await import('../../experience/models.mjs');
  const v = resolve(newSetup('camaro'), false);
  const a = ovalLap(v), b = ovalLap(v), c = ovalLap(v, { roll: 'car' });
  assert.deepEqual(a, b, 'default deterministic and unchanged');
  assert.ok(Number.isFinite(c.lateralLimit ?? c.cornering?.ay ?? c.time ?? c.lap), 'opt-in runs');
  assert.notDeepEqual(a, c, 'opt-in uses the per-car setup');
});
