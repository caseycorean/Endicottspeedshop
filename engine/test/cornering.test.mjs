// Claude sprint 26 Nov 2026 — independent checks of engine/cornering.mjs and its use in the oval.
// The closed form below is derived by hand, not from the bisection in the module:
//   axle capacity with transfer ΔF = μ0 (W_a − 4kΔF²/W_a), ΔF = c·a_y, demand W_a·a_y
//   ⇒ (4kμ0c²/W_a²)·a_y² + a_y − μ0 = 0.
// c (lb per g) is re-derived from the Load Transfer calculator's stated formula: roll axis height at the CG
// = 2 + (12 − 2)·rear share; elastic part split 60/40 front/rear by roll stiffness; geometric part = axle
// load × roll-center height; both divided by that axle's track.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newSetup, resolve } from '../../experience/models.mjs';
import { corneringLimit } from '../cornering.mjs';
import { ovalLap } from '../../experience/oval.mjs';

const ids = ['firebird', 'mustang', 'camaro', 'fiero', 'corvette', 'miata', 'gto'];
const k = .15;

function closedForm(v) {
  const rearShare = v.rearLb / v.weight;
  const elastic = v.cg - (2 + 10 * rearShare);
  const cF = (v.weight * elastic * .6 + v.frontLb * 2) / v.frontTrack;
  const cR = (v.weight * elastic * .4 + v.rearLb * 12) / v.rearTrack;
  const solve = (W, c) => { const a = 4 * k * v.grip * c * c / (W * W); return (-1 + Math.sqrt(1 + 4 * a * v.grip)) / (2 * a); };
  const front = solve(v.frontLb, cF), rear = solve(v.rearLb, cR);
  // validity of the closed form: inside tire keeps load at the limit
  assert.ok(v.frontLb / 2 - cF * front > 0 && v.rearLb / 2 - cR * rear > 0);
  return { front, rear, ay: Math.min(front, rear) };
}

for (const id of ids) {
  test(`${id}: cornering limit matches the hand-derived closed form`, () => {
    const v = resolve(newSetup(id), false);
    const r = corneringLimit(v);
    const x = closedForm(v);
    assert.ok(Math.abs(r.front - x.front) < 1e-6, `front ${r.front} vs ${x.front}`);
    assert.ok(Math.abs(r.rear - x.rear) < 1e-6, `rear ${r.rear} vs ${x.rear}`);
    assert.ok(r.ay < v.grip && r.loss > 0.02 && r.loss < 0.15, `loss ${r.loss}`);
  });

  test(`${id}: lower CG and wider track raise the limit and shorten the lap`, () => {
    const v = resolve(newSetup(id), false);
    const low = { ...v, cg: v.cg - 2 };
    const wide = { ...v, frontTrack: v.frontTrack + 2, rearTrack: v.rearTrack + 2 };
    assert.ok(corneringLimit(low).ay > corneringLimit(v).ay);
    assert.ok(corneringLimit(wide).ay > corneringLimit(v).ay);
    const lap = ovalLap(v).lap;
    assert.ok(ovalLap(low).lap < lap - .01, `CG −2 in: ${ovalLap(low).lap} vs ${lap}`);
    assert.ok(ovalLap(v, { loadSensitivity: 0 }).lap < lap, 'grip-only is the optimistic bound');
  });
}

test('without CG or track data the limit falls back to grip only and says so', () => {
  const v = { ...resolve(newSetup('camaro'), false), cg: undefined };
  const r = corneringLimit(v);
  assert.equal(r.ay, v.grip);
  assert.equal(r.gripOnly, true);
  assert.equal(corneringLimit({ ...resolve(newSetup('camaro'), false) }, { sensitivity: 0 }).ay, .95);
});

test('turn speed follows the cornering limit: v = √(0.96²·a_y·g·R) on the 200 ft radius', () => {
  const v = resolve(newSetup('mustang'), false);
  const r = ovalLap(v);
  const expected = Math.sqrt(.96 ** 2 * r.cornering.ay * 32.174 * 200) * 3600 / 5280;
  assert.ok(Math.abs(r.turnSpeed - expected) < .05, `${r.turnSpeed} vs ${expected}`);
});
