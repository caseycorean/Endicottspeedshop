// Independent checks for engine/maneuvers.mjs. Expected values come from closed forms or from the shared primitives
// the maneuvers are built on (consistency), never from the maneuver code itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { accelerationProfile, brakeBetween, steadyCorner, brakeAvailable, tractionAvailable, driveAvailable, runPath, MANEUVERS, rollDefaults, G, MPH } from '../maneuvers.mjs';
import { straightLine } from '../acceleration.mjs';
import { brakingStop, decelAt } from '../braking.mjs';
import { stock } from '../../experience/vehicles.mjs';

const car = (id, extra = {}) => { const s = { ...stock(id), ...extra }; return { ...s, frontLb: s.weight * s.front, rearLb: s.weight * (1 - s.front) }; };
const civic = car('honda-civic-fl5--2023-type-r-k20c1-m6-hatch');
const camaro = car('camaro');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

test('acceleration profile reproduces the shared straight-line run (quarter mile and 0–60)', () => {
  const base = straightLine(civic);
  const p = accelerationProfile(civic, { distanceFt: 1320, fromMph: 0, toMph: 60 });
  near(p.distance.t, base.finish.t, 0.03, 'quarter mile time (trace sampled every 0.02 s)');
  near(p.interval.t, base.zeroTo60, 0.03, '0–60');
});

test('rolling intervals are consistent: t(0–70) = t(0–30) + t(30–70)', () => {
  const a = accelerationProfile(camaro, { fromMph: 0, toMph: 70 }).interval.t;
  const b = accelerationProfile(camaro, { fromMph: 0, toMph: 30 }).interval.t;
  const c = accelerationProfile(camaro, { fromMph: 30, toMph: 70 }).interval.t;
  near(a, b + c, 0.03, 'interval addition');
});

test('top speed falls with more aerodynamic drag; a short top gear hits the rev limiter', () => {
  const lo = accelerationProfile(civic).top.mph, hi = accelerationProfile({ ...civic, cda: civic.cda * 1.5 }).top.mph;
  assert.ok(hi < lo, `more drag → lower top speed (${hi} < ${lo})`);
  const short = accelerationProfile({ ...civic, finalDrive: civic.finalDrive * 2 });
  assert.equal(short.top.limit, 'rev limit in top gear');
});

test('braking between speeds uses the shared stop and adds up (rise time counted once)', () => {
  near(brakeBetween(civic, 60).distance, brakingStop(civic, { from: 60 }).distance, 1e-9, 'same model');
  const o = { riseTime: 0 };
  const whole = brakeBetween(civic, 80, 0, o).distance, parts = brakeBetween(civic, 80, 40, o).distance + brakeBetween(civic, 40, 0, o).distance;
  near(whole, parts, 0.5, '80→0 = 80→40 + 40→0 without rise time');
  assert.ok(brakeBetween(civic, 100).distance > 2.5 * brakeBetween(civic, 60).distance, 'distance grows ~ with speed²');
});

test('steady cornering speed is sqrt(ay·g·R); more front roll stiffness moves the limit to the front', () => {
  const c = steadyCorner(civic, { radiusFt: 200 });
  near(c.mph, Math.sqrt(c.ay * G * 200) / MPH, 1e-9, 'v = sqrt(ay g R)');
  const soft = steadyCorner(camaro, { frontRoll: .40 }), stiff = steadyCorner(camaro, { frontRoll: .75 });
  assert.ok(stiff.frontAy < soft.frontAy, 'front axle limit falls as it carries more load transfer');
  assert.ok(stiff.rearAy > soft.rearAy, 'rear axle limit rises');
  assert.equal(stiff.limitingAxle, 'front');
  const d = rollDefaults(civic);
  assert.ok(d.frontRoll > civic.front && d.frontRoll <= .75, 'default split is front weight + margin');
});

test('friction ellipse: full braking at zero lateral, none at the cornering limit', () => {
  const sp = 60 * MPH, ay = steadyCorner(civic).ay;
  near(brakeAvailable(civic, sp, 0), decelAt(civic, sp).a, 1e-9, 'straight-line braking');
  near(brakeAvailable(civic, sp, ay), 0, 1e-6, 'at the limit');
  near(brakeAvailable(civic, sp, ay * .6), decelAt(civic, sp).a * .8, 1e-6, 'ellipse at 60% lateral → 80% braking');
  assert.equal(brakeAvailable(civic, sp, .5, { trailBraking: false }), 0, 'no trail braking: no braking while turning');
});

test('differentials: open ≤ limited-slip ≤ locked; equal when not cornering', () => {
  for (const v of [civic, camaro]) {
    const o = tractionAvailable(v, .6, .2, { diff: 'open' }), l = tractionAvailable(v, .6, .2, { diff: 'lsd' }), k = tractionAvailable(v, .6, .2, { diff: 'locked' });
    assert.ok(o <= l + 1e-9 && l <= k + 1e-9, `${o} ≤ ${l} ≤ ${k}`);
    near(tractionAvailable(v, 0, .2, { diff: 'open' }), tractionAvailable(v, 0, .2, { diff: 'locked' }), 1e-6, 'straight line');
  }
  assert.equal(driveAvailable(civic, 40 * MPH, 5).a, 0, 'past the cornering limit no drive is available');
});

test('path solver: a straight braking zone matches the braking model; a long arc runs at the steady limit', () => {
  const r = runPath(civic, [{ type: 'straight', ft: 600 }], { startMph: 60, endMph: 0, ds: .5 });
  const zone = r.brakingZones[0], dist = zone.toFt - zone.fromFt + .5;
  const ref = brakingStop(civic, { from: zone.fromMph, riseTime: 0 }).distance; // the car accelerates first, so compare from where braking starts
  near(dist / ref, 1, .02, 'braking distance within 2% of the braking model (path uses 2 mph speed buckets)');
  const arc = runPath(civic, [{ type: 'arc', radiusFt: 120, deg: 270 }], { startMph: 80 });
  near(arc.trace[arc.trace.length - 1].mph, steadyCorner(civic, { radiusFt: 120 }).mph, .05, 'steady arc speed');
});

test('path solver is physically monotonic: more grip never slower, more weight never faster; trail braking helps', () => {
  for (const [key, m] of Object.entries(MANEUVERS)) {
    const t = runPath(civic, m.segments, { startMph: m.startMph ?? undefined }).time;
    const grippy = runPath({ ...civic, grip: civic.grip * 1.1 }, m.segments, { startMph: m.startMph ?? undefined }).time;
    const heavy = car('honda-civic-fl5--2023-type-r-k20c1-m6-hatch', { weight: civic.weight + 300 });
    const th = runPath(heavy, m.segments, { startMph: m.startMph ?? undefined }).time;
    assert.ok(grippy <= t + 1e-6, `${key}: grip ${grippy} ≤ ${t}`);
    assert.ok(th >= t - 1e-6, `${key}: weight ${th} ≥ ${t}`);
  }
  const e = MANEUVERS.entry;
  assert.ok(runPath(civic, e.segments, { startMph: 80 }).time < runPath(civic, e.segments, { startMph: 80, trailBraking: false }).time);
});

test('a closed lap converges to a repeating start speed', () => {
  const loop = [{ type: 'straight', ft: 800 }, { type: 'arc', radiusFt: 150, deg: 180 }, { type: 'straight', ft: 800 }, { type: 'arc', radiusFt: 150, deg: 180 }];
  const r = runPath(camaro, loop, { closed: true, startMph: 30 });
  near(r.entryMph, r.exitMph, .05, 'periodic');
});

test('timing conventions: road-test timing is shorter than an emergency stop by about the extra build-up distance', async () => {
  const { brakeBetween, BRAKING_CONVENTIONS } = await import('../maneuvers.mjs');
  const v = car('camaro');
  const r = brakeBetween(v, 60, 0, { convention: 'roadTest' }), e = brakeBetween(v, 60, 0, { convention: 'emergency' });
  assert.ok(BRAKING_CONVENTIONS.roadTest.params.riseTime < BRAKING_CONVENTIONS.emergency.params.riseTime);
  const extra = e.distance - r.distance, approx = 88 * (.15 - .05) / 2; // linear ramp ≈ half the speed × the extra time
  assert.ok(extra > 0 && Math.abs(extra - approx) < 3, `extra ${extra.toFixed(2)} ft vs ≈${approx.toFixed(2)} ft`);
});
