// Suspension V2 page model: presets solve, state validation, share links, vehicle → architecture only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { architectures, cleanState, defaults, encodeState, decodeState, vehicleChoice, planarSolver, liveSolver, defaultEnd, chassisDims, STATUS } from '../../experience/suspension-v2/model.mjs';
import { planarSvg, liveSvg, illustrationSvg, chartSvg } from '../../experience/suspension-v2/draw.mjs';
import { vehicleArchitectures } from '../../experience/suspension-v2/vehicle-architectures.mjs';

globalThis.btoa ??= s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob ??= s => Buffer.from(s, 'base64').toString('binary');

test('every modelled architecture solves across ±3 in from its generic example', () => {
  for (const end of ['front', 'rear']) for (const [code, a] of Object.entries(architectures[end])) {
    if (a.model === 'planar') { const c = planarSolver(defaultEnd(code), end); for (const t of [-3, 0, 3]) assert.equal(c.at(t).status, STATUS.ok, `${end} ${code} ${t}`); }
    if (a.model === 'live') { const s = liveSolver(defaultEnd(code), end); for (const h of [-3, 0, 3]) assert.ok(s.at({ heave: h }).pose, `${code} ${h}`); }
  }
});

test('state: bad values fall back, good edits survive a share link', () => {
  assert.deepEqual(cleanState({ front: { arch: 'nope' } }).front.arch, 'sla');
  assert.equal(cleanState({ front: { arch: 'sla', travel: 99 } }).front.travel, 0);
  assert.equal(Object.keys(cleanState({ front: { arch: 'sla', pts: { upperOuter: [999, 1] } } }).front.pts).length, 0);
  const s = defaults(); s.front.pts.upperOuter = [28, 19]; s.front.travel = -.1; s.tab = 'rear'; s.rear = defaultEnd('fourLinkTriangulated'); s.rear.pts['0.chassis'] = [30, -22, 14];
  const back = decodeState(encodeState(s));
  assert.deepEqual(back.front.pts.upperOuter, [28, 19]);
  assert.equal(back.front.travel, -.1);
  assert.deepEqual(back.rear.pts['0.chassis'], [30, -22, 14]);
});

test('a vehicle selects an architecture and dimensions only, never hardpoints', () => {
  const fb = vehicleArchitectures.find(v => /1977 Firebird/.test(v[1]));
  const v = vehicleChoice(fb[0]);
  assert.equal(v.front, 'sla');
  assert.equal(v.rear, 'leaf');
  assert.ok(!('points' in v) && !('pts' in v));
  const s = defaults(); s.vehicle = fb[0];
  assert.match(chassisDims(s).source, /Firebird/);
});

test('drawings render for every architecture and label reference lines', () => {
  for (const end of ['front', 'rear']) for (const [code, a] of Object.entries(architectures[end])) {
    let svg;
    if (a.model === 'planar') svg = planarSvg({ kind: a.kind, end, result: planarSolver(defaultEnd(code), end).at(1), base: planarSolver(defaultEnd(code), end).at(0), radius: a.preset.tireRadius });
    else if (a.model === 'live') { const s = liveSolver(defaultEnd(code), end); svg = ['top', 'side', 'rear'].map(view => liveSvg({ view, links: [], result: s.at({ heave: 1 }), base: s.at({}) })).join(''); }
    else svg = illustrationSvg(code);
    assert.match(svg, /<svg/);
    assert.ok(!/NaN/.test(svg), `${end} ${code} has NaN`);
    if (a.model) assert.match(svg, /Reference:/);
  }
  assert.match(chartSvg({ title: 'Camber', unit: '°', rows: [{ t: -1, y: 1 }, { t: 1, y: -1 }], reach: { lo: -2, hi: 4 } }), /cannot reach/);
});
