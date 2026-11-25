import test from 'node:test';
import assert from 'node:assert/strict';
import { slaAt, strutAt, sweep, rearGeometry, antiDive, antiLift, liveAxleRollCentre, intersect } from '../suspension.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
// Illustrative SLA corner (inches; y outboard, z up). Not any specific car.
export const sla = { upperInner: [14, 16], upperOuter: [25, 17], lowerInner: [10, 7], lowerOuter: [27, 6],
  wheelCenter: [30, 12.5], tireRadius: 12.5, staticCamber: -.5 };

test('parallelogram (equal, parallel arms): no camber change, roll centre on the ground', () => {
  const g = { upperInner: [10, 17], upperOuter: [25, 17], lowerInner: [10, 7], lowerOuter: [25, 7], wheelCenter: [28, 12], tireRadius: 12 };
  for (const r of sweep(slaAt, g, { bump: 3, rebound: 3, step: 1 })) {
    close(r.camberChange, 0, 1e-6, `camber at ${r.travel}`);
    assert.equal(r.instantCentre, null);
    assert.equal(r.rollCentreHeight, 0);
  }
});

test('static roll centre equals the hand construction (contact → IC line at the centreline)', () => {
  const r = slaAt(sla, 0);
  const ic = intersect(sla.upperInner, sla.upperOuter, sla.lowerInner, sla.lowerOuter);
  close(r.instantCentre[0], ic[0], 1e-6, 'IC y'); close(r.instantCentre[1], ic[1], 1e-6, 'IC z');
  const hand = ic[1] * (0 - sla.wheelCenter[0]) / (ic[0] - sla.wheelCenter[0]);
  close(r.rollCentreHeight, hand, 1e-6, 'RC');
  close(r.camber, -.5, 1e-9, 'static camber');
});

test('camber gain at ride height ≈ 1 / front-view swing-arm length (small-angle theory)', () => {
  const d = .01;
  const up = slaAt(sla, d), dn = slaAt(sla, -d), at = slaAt(sla, 0);
  const gainDegPerIn = (up.camber - dn.camber) / (2 * d);
  const theory = 180 / Math.PI / at.swingArm; // magnitude
  close(Math.abs(gainDegPerIn), theory, .02 * theory, 'camber gain');
  assert.ok(up.camber < at.camber, 'short upper arm: bump adds negative camber');
});

test('linkage limits are reported, not invented', () => {
  assert.equal(slaAt(sla, 40), null);
});

test('MacPherson: camber change and roll centre are finite and monotonic over normal travel', () => {
  const g = { top: [22, 30], lowerInner: [8, 6], lowerOuter: [26, 5], wheelCenter: [29, 12], tireRadius: 12 };
  const rows = sweep(strutAt, g, { bump: 3, rebound: 3, step: .5 });
  assert.equal(rows.length, 13);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].camber < rows[i - 1].camber, 'more negative camber in bump');
  // strut shortens in bump
  assert.ok(rows.at(-1).strutLength < rows[0].strutLength);
  close(rows[6].strutLength, Math.hypot(22 - 26, 30 - 5), 1e-6, 'static strut length');
});

test('anti-squat: hand-calculated four-link and parallel-link cases', () => {
  const base = { wheelbase: 100, cg: 20 };
  // links meeting at x = 40 in ahead, z = 15 in: slope .375 → 187.5 %
  const r = rearGeometry('fourLink', { upper: [[0, 20], [40, 15]], lower: [[0, 10], [40, 15]] }, base);
  close(r.ic[0], 40, 1e-9, 'IC x'); close(r.antiSquat, 187.5, 1e-9, 'AS');
  // parallel links 5° nose-down → slope tan(5°)
  const p = rearGeometry('fourLink', { upper: [[0, 20], [30, 20 + 30 * Math.tan(.0873)]], lower: [[0, 10], [30, 10 + 30 * Math.tan(.0873)]] }, base);
  close(p.antiSquat, 100 * Math.tan(.0873) / .2, 1e-6, 'parallel AS');
});

test('torque arm: IC on the vertical through the arm front mount', () => {
  const r = rearGeometry('torqueArm', { lower: [[0, 12], [20, 10]], armFrontX: 50 }, { wheelbase: 101, cg: 19 });
  close(r.ic[0], 50, 1e-9, 'x'); close(r.ic[1], 7, 1e-9, 'z');
  close(r.antiSquat, 100 * (7 / 50) / (19 / 101), 1e-9, 'AS');
});

test('leaf spring is reported as an approximate range', () => {
  const r = rearGeometry('leaf', { frontEye: [27, 16], axleSeat: [0, 11] }, { wheelbase: 108, cg: 20 });
  assert.ok(r.approximate && r.range[0] < r.range[1]);
});

test('anti-dive / anti-lift / panhard roll centre', () => {
  close(antiDive({ wheelbase: 100, cg: 20, ic: [50, 10], frontBrakeShare: .7 }), 100 * .2 * 5 * .7, 1e-9, 'AD');
  close(antiLift({ wheelbase: 100, cg: 20, slope: .1, frontBrakeShare: .7 }), 100 * .1 * 5 * .3, 1e-9, 'AL');
  close(liveAxleRollCentre('panhard', { left: [-20, 14], right: [20, 12] }).height, 13, 1e-9, 'panhard');
});

// Reference values from the ESS 3-D short/long-arm solver (ess-knowledge archive/2026-11-24_fbody-front-suspension/
// kinematics.py) run on the same corner extruded fore-aft, tie rod parallel to the lower arm (zero bump steer).
const PY_3D = [[-2.0, 1.2189711435623807, 6.614523915933402, -2.617352833837009e-14], [-1.0, 0.6737442475343073, 5.295609158477594, 2.4295627263440958e-09], [0.0, -0.0, 4.0137931034482754, -0.0], [1.0, -0.8022552228199195, 2.7710233281318857, -4.160526838241073e-14], [2.0, -1.737600059799607, 1.569285466140408, -6.329754537237016e-15]];
test('agrees with the independent 3-D solver (planar case)', () => {
  const g = { ...sla, staticCamber: 0 };
  for (const [t, camber, rc] of PY_3D) {
    const r = slaAt(g, t);
    close(r.camber, camber, 1e-3, `camber at ${t}`);
    close(r.rollCentreHeight, rc, 1e-3, `roll centre at ${t}`);
  }
});
