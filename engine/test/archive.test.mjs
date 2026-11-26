import { archiveCorrections } from '../data/archive-corrections.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveCatalog, archiveVehicles, validGears } from '../archive.mjs';
import { labVehicle, searchVehicles, vehicleCoverage } from '../garage-adapter.mjs';
import { straightLine } from '../acceleration.mjs';
import { supercarx } from '../data/supercarx.mjs';
import { codeFromText } from '../data/architectures.mjs';

test('all 75 archive pages are selectable once; exact matches merge into curated records', () => {
  const all = Object.values(archiveCatalog);
  assert.equal(all.length, 75);
  assert.equal(new Set(all.map(x => x.id)).size, 75);
  assert.equal(all.filter(x => x.mergedInto).length, 5);
  assert.equal(archiveVehicles.length, 70);
  const c = vehicleCoverage();
  assert.equal(c.simulationReady + c.partial + c.reference, 70);
  assert.ok(c.simulationReady >= 55, `simulation-ready ${c.simulationReady}`);
});

test('every archive vehicle resolves with historical provenance pointing at its capture', () => {
  for (const x of archiveVehicles) {
    const r = labVehicle(x.id);
    assert.ok(r, x.id);
    // Manufacturer-sourced corrections (engine/data/archive-corrections.mjs) replace an archive value with its own source.
    if (archiveCorrections[x.id]?.weight) assert.equal(r.provenance.weight.evidence, 'manufacturer', x.id);
    else {
      assert.equal(r.provenance.weight.evidence, 'historical', x.id);
      assert.match(r.provenance.weight.source, /^https:\/\/web\.archive\.org\//, x.id);
    }
    assert.equal(r.archive.tier, x.tier);
  }
});

test('single-ratio gear fragments are not treated as gearboxes', () => {
  const cougar = supercarx.find(r => /Cougar Eliminator/.test(r.title));
  assert.equal(validGears(cougar), null);
  assert.deepEqual(archiveCatalog['sx-1970-mercury-cougar-eliminator'].missing.acceleration, ['gears']);
  assert.equal(archiveCatalog['sx-1970-mercury-cougar-eliminator'].tier, 'partial');
});

test('Ferrari 575M is searchable and runs; the 575 GTC race car stays a reference page', () => {
  const hits = searchVehicles('ferrari 575');
  assert.deepEqual(hits.map(h => h.tier), ['simulation-ready', 'historical-reference']);
  const r = labVehicle(hits[0].id);
  assert.equal(r.readiness.acceleration.missing.length, 0);
  const et = straightLine(r.vehicle).magazine.et;
  assert.ok(Math.abs(et - 12.6) < .4, `575M ET ${et}`);
  assert.match(archiveCatalog['sx-2005-ferrari-575-gtc'].why, /Competition/);
});

test('search lists curated vehicles before archive ones', () => {
  const hits = searchVehicles('firebird');
  assert.equal(hits[0].source, 'curated');
  assert.ok(hits.slice(1).every(h => h.source === 'archive') && hits.length >= 5);
});

test('archive suspension wording maps to architecture codes', () => {
  assert.equal(codeFromText('ind; 1 trailing link and 2 lateral links per side; coil springs', 'rear'), 'irsMultilink');
  assert.equal(codeFromText('ind; upper and lower A- arms; coil springs; tube shocks', 'rear'), 'irsControlArm');
  assert.equal(codeFromText('rigid axle; 3 trailing links and panhard rod; coil springs', 'rear'), 'threeLink');
  assert.equal(codeFromText('ind; semi-trialing arms, 1 toe-control link per side', 'rear'), 'semiTrailing');
  assert.equal(codeFromText('rigid axle; coil springs; tube shocks; sway bar', 'rear'), null); // ambiguous: not guessed
  assert.equal(codeFromText('ind; unequal length upper and lower A- arms; coil-over springs', 'front'), 'sla');
});

// Hold-out: archive road tests were not used to set the model's tire-grip defaults (except the 1990s ZR rule, see README).
test('acceleration v2 against the archive road tests (hold-out)', () => {
  const et = [], s60 = [];
  for (const x of Object.values(archiveCatalog)) {
    if (x.tier !== 'simulation-ready') continue;
    const f = x.record.fields, v = labVehicle(x.id).vehicle, m = straightLine(v).magazine;
    if (f.testEt && m.et) et.push(m.et - f.testEt[0]);
    if (f.test60 && m.zeroTo60) s60.push(m.zeroTo60 - f.test60[0]);
  }
  const mae = a => a.reduce((s, e) => s + Math.abs(e), 0) / a.length, mean = a => a.reduce((s, e) => s + e, 0) / a.length;
  assert.ok(et.length >= 55, `n=${et.length}`);
  assert.ok(mae(et) <= .32, `ET MAE ${mae(et).toFixed(3)}`);
  assert.ok(Math.abs(mean(et)) <= .2, `ET bias ${mean(et).toFixed(3)}`);
  assert.ok(mae(s60) <= .32, `0-60 MAE ${mae(s60).toFixed(3)}`);
});
