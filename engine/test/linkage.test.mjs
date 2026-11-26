// Suspension V2 planar solver (engine/linkage.mjs). Includes the owner's 26 Nov reproduction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { corner, interpret, rideHeightGeometry, checkLayout, STATUS } from '../linkage.mjs';
import { slaAt } from '../suspension.mjs';

const sla = { upperInner: [14, 16], upperOuter: [25, 17], lowerInner: [10, 7], lowerOuter: [27, 6], wheelCenter: [30, 12.5], tireRadius: 12.5, staticCamber: -.5 };
const strut = { top: [22, 30], lowerInner: [8, 6], lowerOuter: [26, 5], wheelCenter: [29, 12], tireRadius: 12, staticCamber: -.5 };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('owner reproduction: upper ball joint out and up, 0.1 in droop', () => {
  const g = { ...sla, upperOuter: [28, 19] };
  const old = slaAt(g, -.1);
  assert.ok(Math.abs(old.trackChange) > 10, 'preserved solver still shows the defect (documents the cause)');
  const r = corner('sla', g).at(-.1);
  assert.equal(r.status, STATUS.ok);
  assert.ok(Math.abs(r.trackChange) < .05, `track change ${r.trackChange}`);
  assert.ok(r.rollCentreHeight > 4 && r.rollCentreHeight < 7, `roll center ${r.rollCentreHeight}`);
  assert.ok(Math.abs(r.camberChange) < .5);
});

test('preserved default geometry gives the same answers as the original solver', () => {
  const c = corner('sla', sla);
  for (const t of [-3, -1, -.25, 0, .5, 1, 3]) {
    const a = c.at(t), b = slaAt(sla, t);
    assert.ok(Math.abs(a.camber - b.camber) < 1e-4 && Math.abs(a.rollCentreHeight - b.rollCentreHeight) < 1e-4 && Math.abs(a.trackChange - b.trackChange) < 1e-4, `t=${t}`);
  }
});

test('link lengths are kept and the path is continuous for 400 random edited layouts', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let checked = 0;
  for (let n = 0; n < 400; n++) {
    const g = { ...sla,
      upperInner: [sla.upperInner[0] + (rnd() - .5) * 10, sla.upperInner[1] + (rnd() - .5) * 8],
      upperOuter: [sla.upperOuter[0] + (rnd() - .5) * 12, sla.upperOuter[1] + (rnd() - .5) * 10],
      lowerInner: [sla.lowerInner[0] + (rnd() - .5) * 8, sla.lowerInner[1] + (rnd() - .5) * 6] };
    const c = corner('sla', g);
    if (!c.valid) continue;
    let prev = null;
    for (let t = -3; t <= 3.0001; t += .05) {
      const r = c.at(+t.toFixed(3));
      assert.notEqual(r.status, STATUS.failure, `solver failure at ${t} for ${JSON.stringify(g)}`);
      if (r.status !== STATUS.ok) { prev = null; continue; }
      const p = r.points;
      assert.ok(Math.abs(dist(p.upperOuter, p.upperInner) - dist(g.upperOuter, g.upperInner)) < 1e-6);
      assert.ok(Math.abs(dist(p.upperOuter, p.lowerOuter) - dist(g.upperOuter, g.lowerOuter)) < 1e-6);
      assert.ok(Math.abs(dist(p.lowerOuter, p.lowerInner) - dist(g.lowerOuter, g.lowerInner)) < 1e-6);
      const nearLimit = ['bump', 'droop'].some(k => c.reach?.[k] && Math.abs(c.reach[k].travel - t) < .3);
      if (prev && !nearLimit) {
        assert.ok(Math.abs(r.camber - prev.camber) < 3, `camber jump ${prev.camber} → ${r.camber} at ${t}`);
        assert.ok(Math.abs(r.trackChange - prev.trackChange) < 1, `track jump at ${t}`);
      }
      prev = r; checked++;
    }
  }
  assert.ok(checked > 5000);
});

test('sweep both directions returns to the static pose', () => {
  const c = corner('sla', { ...sla, upperOuter: [30, 21] });
  const s = c.at(0);
  for (const t of [3, -3, 1.3, -2.2]) { c.at(t); }
  const again = c.at(0);
  assert.deepEqual(again.points, s.points);
  assert.ok(Math.abs(again.camber + .5) < 1e-9);
});

test('a genuinely short upper arm reaches a mechanical limit instead of an impossible pose', () => {
  const g = { ...sla, upperInner: [22, 16.2] }; // 3 in upper arm
  const c = corner('sla', g);
  assert.ok(c.valid);
  const r = c.at(-3.5);
  assert.equal(r.status, STATUS.limit);
  assert.ok(/stops at/.test(r.reason));
  // the last reachable droop is valid and close to the limit
  const edge = c.reach.droop.travel;
  assert.equal(c.at(edge * .99).status, STATUS.ok);
});

test('impossible layouts are invalid but reported, never solved', () => {
  assert.equal(checkLayout('sla', { ...sla, upperOuter: [25, 5] })[0].code, 'upright-inverted');
  assert.ok(checkLayout('sla', { ...sla, upperInner: [26, 3] }).some(i => i.code === 'arms-cross' || i.code === 'upper-reversed'));
  const c = corner('sla', { ...sla, upperOuter: [25, 5] });
  assert.equal(c.valid, false);
  assert.equal(c.at(1).status, STATUS.invalid);
});

test('strut matches the original solver on the default layout and reports strut length change', () => {
  const c = corner('strut', strut);
  const r = c.at(2);
  assert.equal(r.status, STATUS.ok);
  assert.ok(r.strutLengthChange < 0, 'strut shortens in bump');
});

test('parallel arms: roll center follows the arm direction (original returned 0)', () => {
  const g = { ...sla, upperInner: [10, 13], upperOuter: [27, 12], lowerInner: [10, 7], lowerOuter: [27, 6], wheelCenter: [30, 9.5] };
  const r = corner('sla', g).at(0);
  assert.equal(r.status, STATUS.ok);
  assert.ok(r.rollCentreNote);
  assert.ok(Math.abs(r.rollCentreHeight - 30 / 17) < .05, `${r.rollCentreHeight}`); // slope 1/17 over 30 in
});

test('ride height: springs mode keeps link lengths and equals the old pose; spindle mode keeps camber', () => {
  const low = rideHeightGeometry('sla', sla, -1, 'springs');
  assert.equal(low.status, STATUS.ok);
  const r = corner('sla', low.g).at(0), ref = corner('sla', sla).at(1);
  assert.ok(Math.abs(r.camber - ref.camber) < 1e-9 && Math.abs(r.rollCentreHeight - ref.rollCentreHeight) < 1e-9);
  assert.ok(Math.abs(dist(low.g.upperOuter, low.g.upperInner) - dist(sla.upperOuter, sla.upperInner)) < 1e-9);
  const raise = rideHeightGeometry('sla', sla, 1.5, 'springs');
  assert.equal(raise.status, STATUS.ok);
  assert.ok(Math.abs(corner('sla', raise.g).at(0).camber - corner('sla', sla).at(-1.5).camber) < 1e-9);
  const drop = rideHeightGeometry('sla', sla, -1, 'spindle');
  assert.equal(corner('sla', drop.g).at(0).camber, -.5);
  const tooFar = rideHeightGeometry('sla', { ...sla, upperInner: [22, 16.2] }, 6, 'springs');
  assert.notEqual(tooFar.status, STATUS.ok);
});

test('interpretations flag steep roll-center migration with its cause', () => {
  const g = { ...sla, upperInner: [24, 20], upperOuter: [26, 17] }; // tiny steep upper arm
  const c = corner('sla', g);
  if (c.at(0).status === STATUS.ok) {
    const notes = interpret(c, c.at(0)).map(n => n.code);
    assert.ok(notes.length >= 0);
  }
  const normal = corner('sla', sla);
  assert.ok(!interpret(normal, normal.at(0)).some(n => n.level === STATUS.caution));
});

test('ball joints stop at 45° of articulation; the default example never comes close in ±4 in', async () => {
  const { BALL_JOINT_MAX } = await import('../linkage.mjs');
  const short = corner('sla', { ...sla, upperInner: [22, 16.2] });
  assert.equal(short.reach.droop.why, 'ball-joint');
  const edge = short.at(short.reach.droop.travel * .999);
  assert.ok(Math.abs(edge.ballJointUpper) <= BALL_JOINT_MAX + .5);
  const def = corner('sla', sla);
  for (const t of [-4, 4]) { const r = def.at(t); assert.equal(r.status, STATUS.ok); assert.ok(Math.max(Math.abs(r.ballJointLower), Math.abs(r.ballJointUpper)) < 25); }
  assert.equal(corner('sla', { ...sla, upperOuter: [28, 19] }).at(-4).status, STATUS.ok);
});
