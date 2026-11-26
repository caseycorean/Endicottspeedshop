// Consolidated vehicle knowledge and specification page contracts. Run after `python3 -B _build/build.py`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readFragment } from '../../experience/configuration.mjs';
import { vehicles } from '../../experience/vehicles.mjs';
import { archiveHolds, archiveWithheld } from '../../engine/data/publication.mjs';
import { archiveCorrections } from '../../engine/data/archive-corrections.mjs';
import { labVehicle } from '../../engine/garage-adapter.mjs';
import { classify } from './classify.mjs';

const root = new URL('../../', import.meta.url);
const K = JSON.parse(readFileSync(new URL('_build/knowledge/vehicle-knowledge.json', root), 'utf8'));
const byId = Object.fromEntries(K.records.map(r => [r.id, r]));

test('one record per published configuration, unique routes, schema v1', () => {
  assert.equal(K.records.length, 116);
  assert.equal(new Set(K.records.map(r => r.route)).size, 116);
  for (const r of K.records) { assert.equal(r.schema, 'ess.vehicle-knowledge.v1'); assert.match(r.route, /^\/vehicles\/[a-z0-9-]+\/$/); }
});

test('every fact carries evidence and a source; review facts exist only in a private build', () => {
  for (const r of K.records) for (const f of r.facts) {
    assert.ok(['manufacturer', 'road test', 'published', 'archive', 'calculated', 'estimate'].includes(f.evidence), `${r.id} ${f.label}`);
    assert.ok(f.source?.url, `${r.id} ${f.label} source`);
    if (!K.private) assert.equal(f.publish, 'public', `${r.id} ${f.label}`);
  }
});

test('held and withheld archive configurations are neither published nor in the Lab', () => {
  for (const id of [...Object.keys(archiveHolds), ...Object.keys(archiveWithheld)]) {
    assert.ok(!byId[id], id); assert.ok(!vehicles[id], id);
  }
});

test('Lab links reproduce the exact configuration of the page', () => {
  let n = 0;
  for (const r of K.records) if (r.links.lab) {
    const { view, state } = readFragment(r.links.lab.build);
    assert.equal(view, 'build'); assert.equal(state.a.id, r.model.labId); n++;
  }
  assert.ok(n >= 100, `n=${n}`);
});

test('definitions are kept apart: weights by basis, power by rating standard', () => {
  assert.equal(classify('As tested weight', 'lb').basis, 'as tested');
  assert.equal(classify('Archive curb weight', 'lb').basis, 'curb');
  assert.equal(classify('Rated power (gross)', 'hp').standard, 'gross');
  assert.equal(classify('Rated power', 'PS').standard, 'PS (DIN)');
  const f40 = byId['sx-1991-ferrari-f40'];
  if (K.private) {
    const w = f40.conflicts.find(c => c.key === 'weight');
    assert.equal(w.kind, 'different definitions');
  }
});

test('F40 page: runs in the Lab, suggests the Enzo and a later Ferrari', () => {
  const f40 = byId['sx-1991-ferrari-f40'];
  assert.equal(f40.model.labId, 'sx-1991-ferrari-f40');
  assert.ok(f40.model.accelerationRuns);
  assert.ok(f40.compareWith.includes('2003-ferrari-enzo'));
  assert.ok(f40.compareWith.some(s => /2005-ferrari/.test(s)));
});

test('manufacturer corrections replace archive values but never peak rpm, and keep the archive value in the note', () => {
  for (const [id, keys] of Object.entries(archiveCorrections)) {
    assert.ok(!('hpRpm' in keys) && !('torqueRpm' in keys), id);
  }
  const gt = labVehicle('sx-2005-ford-gt');
  assert.equal(gt.vehicle.hp, 550); assert.equal(gt.provenance.hp.evidence, 'manufacturer');
  assert.ok(byId['sx-2005-ford-gt'].model.accelerationRuns);
});

test('static page answers without JavaScript: title, canonical, facts and embedded record', () => {
  const html = readFileSync(new URL('vehicles/1991-ferrari-f40/index.html', root), 'utf8');
  assert.match(html, /<h1>1991 Ferrari F40<\/h1>/);
  assert.match(html, /rel="canonical" href="[^"]*\/vehicles\/1991-ferrari-f40\/"/);
  assert.match(html, /478 hp/);
  const data = JSON.parse(html.match(/<script type="application\/json" id="ess-spec-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.id, 'sx-1991-ferrari-f40');
  assert.ok(existsSync(new URL('vehicles/data/index.json', root)));
});
