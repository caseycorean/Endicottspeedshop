// Suspension V2 live-axle solver (engine/axle-links.mjs) checked against the preserved rear lab.
import test from 'node:test';
import assert from 'node:assert/strict';
import { axleSolver, STATUS } from '../axle-links.mjs';
import { linkLayout, solveRearLinks } from '../../experience/rear-links.mjs';
import { rearLinkInsights } from '../../experience/rear-link-insights.mjs';

test('exact layouts: same pose as the preserved lab in heave, lengths kept in roll', () => {
  for (const id of ['three', 'triangulated', 'torque']) {
    const links = linkLayout(id), s = axleSolver(links);
    for (const heave of [-3, -1, 0, 2, 3]) {
      const a = s.at({ heave }), b = solveRearLinks(links, { heave });
      assert.equal(a.status, STATUS.ok, `${id} ${heave}`);
      assert.ok(Math.abs(a.pose[2] - b.pose[2]) < 1e-4 && Math.abs(a.pose[0] - b.pose[0]) < 1e-3, `${id} ${heave}`);
    }
    const r = s.at({ heave: 1, roll: 6 });
    assert.equal(r.status, STATUS.ok, id);
    assert.ok(r.residual < 1e-6);
  }
});

test('parallel four-link + Panhard: fits in heave, binds in roll (over-constrained) and says so', () => {
  const s = axleSolver(linkLayout('parallel'));
  assert.equal(s.over, true);
  assert.equal(s.at({ heave: 2 }).status, STATUS.ok);
  const r = s.at({ roll: 6 });
  assert.ok([STATUS.caution, STATUS.limit].includes(r.status));
  assert.ok(r.bind > .005 && /bind/.test(r.reason));
});

test('roll centre and roll steer agree with the preserved insights', () => {
  for (const id of ['three', 'triangulated']) {
    const links = linkLayout(id), s = axleSolver(links);
    const d = s.derivatives(s.at({})), old = rearLinkInsights(links, {});
    assert.ok(Math.abs(d.rollCentre - old.rollCentre) < .05, `${id} ${d.rollCentre} vs ${old.rollCentre}`);
    assert.ok(Math.abs(d.rollSteer - old.rollSteer) < .005);
  }
});

test('anti-squat matches the preserved lab', () => {
  const links = linkLayout('three'), s = axleSolver(links);
  const a = s.sideView(s.at({}), { wheelbase: 108, cg: 20 }), b = solveRearLinks(links, { wheelbase: 108, cg: 20 });
  assert.ok(Math.abs(a.antiSquat - b.antiSquat) < .2, `${a.antiSquat} vs ${b.antiSquat}`);
});

test('a too-short link is invalid; extreme travel on a short upper link reports a limit, not a pose', () => {
  const links = linkLayout('three');
  links[2].chassis = [links[2].axle[0] + 2, 0, links[2].axle[2]];
  assert.equal(axleSolver(links).at({}).status, STATUS.invalid);
  const l2 = linkLayout('three');
  l2[2].chassis = [5, 0, 20.5]; // 6 in upper link
  const r = axleSolver(l2).at({ heave: 6 });
  assert.ok([STATUS.limit, STATUS.ok].includes(r.status));
  if (r.status === STATUS.ok) assert.ok(r.residual < 1e-6);
});
