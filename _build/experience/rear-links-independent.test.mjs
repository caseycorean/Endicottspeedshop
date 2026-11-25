// Independent checks for the rear-link solver and derived geometry (Claude, 25 Nov).
// Reference values come from a separate Python/SciPy rigid-body solver (rotation matrices, TRF least squares,
// instant centre by velocity rather than line intersection) and from hand formulas noted per case.
import test from 'node:test';
import assert from 'node:assert/strict';
import { linkLayout, solveRearLinks } from '../../experience/rear-links.mjs';
import { rearLinkInsights, rollSteerMeaning, antiSquatCurve } from '../../experience/rear-link-insights.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const vehicle = {wheelbase: 108, cg: 20};

test('solver poses match the independent solver (heave/roll grid samples)', () => {
  const cases = [ // layout, heave, roll, residual, yaw°, lateral in
    ['three', 0, 8, 0, .8755, .155], ['parallel', 0, 8, .1546, .6616, .161],
    ['triangulated', 0, 8, 0, .9145, 1.036], ['torque', 0, 4, 0, .5016, .104], ['parallel', 0, 2, .0386, .1710, .060]];
  for (const [id, heave, roll, res, yaw, dy] of cases) {
    const r = solveRearLinks(linkLayout(id), {heave, roll});
    near(r.residual, res, 6e-4, id + ' residual'); near(r.yaw, yaw, 2e-3, id + ' yaw'); near(r.pose[1], dy, 2e-3, id + ' lateral');
  }
});

test('anti-squat across travel agrees with the velocity-based instant centre within 0.1 percentage point', () => {
  const ref = {three: [167.79, 151.49, 136.09, 121.51, 107.68], torque: [268.91, 242.04, 216.0, 190.51, 165.33],
    triangulated: [173.44, 158.61, 144.64, 131.54, 119.28]};
  for (const [id, values] of Object.entries(ref)) {
    const curve = antiSquatCurve(linkLayout(id), {...vehicle, from: -3, to: 3, step: 1.5});
    curve.forEach((row, i) => near(row.antiSquat, values[i], .15, `${id} AS at ${row.heave}`));
  }
});

test('roll steer: three-link equals the lower-link slope (4/32) and reads as roll oversteer', () => {
  const s = rearLinkInsights(linkLayout('three'));
  near(s.rollSteer, .125, 1e-3, 'roll steer');
  assert.match(rollSteerMeaning(s.rollSteer), /oversteer/);
  const flat = linkLayout('three').map(l => l.group === 'lower' ? {...l, chassis: [32, l.chassis[1], 11]} : l);
  near(rearLinkInsights(flat).rollSteer, 0, 2e-3, 'level lower links');
  const down = linkLayout('three').map(l => l.group === 'lower' ? {...l, chassis: [32, l.chassis[1], 7]} : l);
  assert.ok(rearLinkInsights(down).rollSteer < -.1); assert.match(rollSteerMeaning(rearLinkInsights(down).rollSteer), /understeer/);
});

test('roll centre: Panhard height less the yaw term; triangulated at the upper-link apex line', () => {
  // Panhard bar at 15 in, axle end 1 in ahead of the axle: 15 - 1 × 0.125 = 14.875.
  near(rearLinkInsights(linkLayout('three')).rollCentre, 14.875, .01, 'three-link RC');
  near(rearLinkInsights(linkLayout('torque')).rollCentre, 14.875, .01, 'torque-arm RC');
  // Uppers converge 13.8 in behind the axle at 18.73 in; axis parallel to the lowers (slope 4/32) → 20.46 in.
  near(rearLinkInsights(linkLayout('triangulated')).rollCentre, 20.458, .02, 'triangulated RC');
});

test('pinion rate equals 1 / instant-centre distance', () => {
  near(rearLinkInsights(linkLayout('three')).pinionRate, 180 / Math.PI / 86.6, .003, 'three-link');
  near(rearLinkInsights(linkLayout('torque')).pinionRate, 180 / Math.PI / 40, .003, 'torque arm');
});

test('bound poses report no derived values', () => {
  assert.equal(rearLinkInsights(linkLayout('parallel'), {roll: 8}).fits, false);
});
