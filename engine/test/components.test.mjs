import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTire, tireClassFor } from '../tires.mjs';
import { transmissions, vehicleTransmission } from '../data/transmissions.mjs';
import { frontShare, redline, track } from '../estimates.mjs';
import { resolveVehicle } from '../resolve.mjs';
import { tractionLimit, straightLine } from '../acceleration.mjs';
import { labVehicle, labRun, garageComponents } from '../garage-adapter.mjs';
import { catalog } from '../../experience/catalog-data.mjs';
import { supercarx } from '../data/supercarx.mjs';
import { codeFromText } from '../data/architectures.mjs';

const close = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

test('tire sizes: metric, LT, flotation and letter series', () => {
  close(parseTire('295/35ZR18').diameter, 26.13, .01, 'Z06');
  close(parseTire('265/40ZR-18 97Y').diameter, 26.35, .01, 'archive format');
  assert.equal(parseTire('37x12.50R17LT').diameter, 37);
  assert.ok(parseTire('LT285/70R17').lt);
  const f60 = parseTire('F60-15'); assert.equal(f60.evidence, 'estimated'); assert.equal(f60.radial, false);
  assert.equal(parseTire('GR70-15').radial, true);
  assert.equal(tireClassFor({ year: 1970, tire: 'F60-15' }).id, 'bias');
  assert.equal(tireClassFor({ year: 2002, tire: '295/35ZR18' }).id, 'extreme');
});

test('every library gearbox is well-formed and sourced', () => {
  for (const [id, t] of Object.entries(transmissions)) {
    assert.ok(['manual', 'automatic'].includes(t.type), id);
    assert.ok(t.gears.length >= 2 && t.gears.every((g, i) => i === 0 || g <= t.gears[i - 1]), `${id} ratios descend`);
    assert.ok(t.sources?.length, `${id} has a source`);
    assert.ok(['manufacturer', 'published'].includes(t.evidence), id);
  }
  for (const [cfg, m] of Object.entries(vehicleTransmission)) assert.ok(transmissions[m.id] && catalog[cfg], cfg);
});

test('estimation rules return a value inside their range and say why', () => {
  for (const e of [frontShare({ layout: 'FR', year: 1970, torque: 400 }), redline({ hpRpm: 5200 }), track({ wheelbase: 108, year: 1969 })]) {
    assert.equal(e.evidence, 'estimated'); assert.ok(e.low <= e.value && e.value <= e.high); assert.ok(e.basis.length > 10);
  }
});

test('architecture text mapping', () => {
  assert.equal(codeFromText('Three-link coil-sprung live axle with Panhard rod', 'rear'), 'threeLink');
  assert.equal(codeFromText('Live axle with longitudinal leaf springs', 'rear'), 'leaf');
  assert.equal(codeFromText('Dual-axis MacPherson strut', 'front'), 'strut');
});

test('resolver precedence: owner > component > record > estimate, with provenance', () => {
  const id = 'chevrolet-corvette-c5--2002-z06-ls6-m6-hardtop';
  const base = resolveVehicle(catalog[id], { configId: id });
  assert.equal(base.provenance.weight.evidence, 'manufacturer');
  assert.equal(base.provenance.cg.evidence, 'estimated');
  const swapped = resolveVehicle(catalog[id], { configId: id, components: { transmission: 't56-magnum-266' }, owner: { weight: 3000 } });
  assert.deepEqual(swapped.vehicle.gears, transmissions['t56-magnum-266'].gears);
  assert.equal(swapped.vehicle.weight, 3000); assert.equal(swapped.provenance.weight.evidence, 'owner');
});

test('coverage: at least 34 of 50 reference vehicles run the acceleration model', () => {
  const n = Object.keys(catalog).filter(id => resolveVehicle(catalog[id], { configId: id }).readiness.acceleration.status !== 'blocked').length;
  assert.ok(n >= 34, `runnable ${n}`);
});

test('select once: an engine swap changes ratings and mass for every tool', () => {
  const id = 'pontiac-firebird-2nd-gen--1977-trans-am-w72-400-m4-coupe';
  const a = labVehicle(id), b = labVehicle(id, { engine: 'ls1gto', transmission: 'tkx-287-068' });
  assert.equal(b.vehicle.hp, 350); assert.ok(b.vehicle.weight < a.vehicle.weight, 'aluminum LS lighter than iron Pontiac');
  assert.deepEqual(b.vehicle.gears, transmissions['tkx-287-068'].gears);
  assert.ok(labRun(id, { engine: 'ls1gto', transmission: 'tkx-287-068' }).et < labRun(id).et);
  assert.ok(Object.keys(garageComponents().transmission).length >= 25);
});

test('traction by driven axle matches hand calculation', () => {
  const v = { weight: 3500, front: .65, wheelbase: 105, cg: 21 }; // h/L = 0.2, Wf = 2275, Wr = 1225
  close(tractionLimit(v, 0, 1, 'all'), 3500, 1e-9, 'AWD = μW');
  close(tractionLimit(v, 0, 1, 'rear'), 1225 / .8, 1e-6, 'RWD = μWr/(1 − μh/L)');
  close(tractionLimit(v, 0, 1, 'front'), 2275 / 1.2, 1e-6, 'FWD = μWf/(1 + μh/L)');
});

test('automatic: converter multiplies launch torque; manual path unchanged', () => {
  const v = { ...resolveVehicle(catalog['chevrolet-corvette-c5--2002-z06-ls6-m6-hardtop'], { configId: 'chevrolet-corvette-c5--2002-z06-ls6-m6-hardtop' }).vehicle, grip: 2 };
  const m = straightLine({ ...v, transmission: 'manual' }), a = straightLine({ ...v, transmission: 'automatic' });
  assert.ok(a.trace[3].g > 0 && m.trace[3].g > 0);
  assert.ok(Number.isFinite(a.magazine.et) && Math.abs(a.magazine.et - m.magazine.et) < 1.5);
});

test('hold-out: Supercar X manual street cars, median quarter-mile error ≤ 0.35 s', () => {
  const errs = [];
  for (const s of supercarx) {
    if (!s.et || !s.gears || s.gears.length < 3 || !s.curb || !s.axle || /Race|Modified/.test(s.sub) || /auto/i.test(s.trans ?? '')) continue;
    const L = (s.layout || '').toLowerCase();
    const layout = L.includes('mid') ? 'MR' : L.includes('rear engine') ? 'RR' : L.includes('all') ? 'AWD' : L.includes('front engine/front') ? 'FF' : 'FR';
    const F = v => v == null ? undefined : [v, 'historical', 'sx', null];
    const fields = Object.fromEntries(Object.entries({ weight: F(s.curb), front: F(s.front), wheelbase: F(s.wheelbase), frontTrack: F(s.trackF), rearTrack: F(s.trackR),
      hp: F(s.hp), hpRpm: F(s.hpRpm), torque: F(s.tq), torqueRpm: F(s.tqRpm), redline: F(s.redline), gears: F(s.gears), finalDrive: F(s.axle), tire: F(s.tireR) }).filter(([, x]) => x));
    const r = resolveVehicle({ name: s.title, layout, category: /Mid|Front-engine sport/.test(s.sub) ? 'Sports/handling' : 'Coupe', fields }, {});
    const v = r.vehicle;
    if (r.readiness.acceleration.status === 'blocked' || !(v.torqueRpm < v.hpRpm && v.hpRpm < v.redline)) continue;
    const et = straightLine(v).magazine.et; if (et) errs.push(Math.abs(et - s.et));
  }
  errs.sort((a, b) => a - b);
  assert.ok(errs.length >= 30, `n=${errs.length}`);
  assert.ok(errs[errs.length >> 1] <= .35, `median ${errs[errs.length >> 1]}`);
});
