// ESS consolidated vehicle knowledge — one record per published configuration.
//
// Joins, without duplicating any database:
//   • Work's publication facts (reference_pages.py → published.json): what each page may say, with source and evidence
//   • the shared engineering resolver (engine/ + experience/vehicles.mjs Lab registry): the exact model inputs the Lab
//     uses, with per-input provenance (manufacturer / published / road test / archive / calculated / ESS estimate)
//   • the Supercar X archive (engine/archive.mjs): extra archive facts, offered only in the private review build
//     until the owner approves archive publication scope
// Writes:
//   _build/knowledge/vehicle-knowledge.json   canonical record set (contract: _build/knowledge/CONTRACT.md)
//   vehicles/data/index.json                  public library index (key specs, routes, Lab ids) for comparisons
//   vehicles/data/<route-slug>.json           public record per page (same shape as the page's embedded data)
// Usage: node _build/knowledge/knowledge.mjs <published.json> [--private]
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { archiveCatalog } from '../../engine/archive.mjs';
import { supercarxSuspension } from '../../engine/data/supercarx-suspension.mjs';
import { vehicles } from '../../experience/vehicles.mjs';
import { parseTire } from '../../engine/tires.mjs';
import { newSetup, resolve, straightLine } from '../../experience/models.mjs';

export const SCHEMA = 'ess.vehicle-knowledge.v1';
const [, , publishedPath, ...flags] = process.argv;
const privateBuild = flags.includes('--private');
const root = new URL('../../', import.meta.url);
const published = JSON.parse(readFileSync(publishedPath, 'utf8'));

import { classify, TO_CANON } from './classify.mjs';
const canonValue = (value, unit) => typeof value === 'number' && TO_CANON[unit] ? value * TO_CANON[unit] : typeof value === 'number' && (!unit || ['ratio', 'fraction', '%', 's', 'rpm', 'L', 'ft^2', 'dimensionless'].includes(unit)) ? value : null;

const evidenceClass = e => ({ manufacturer: 'manufacturer', independent_test: 'road test', published: 'published', calculated: 'calculated',
  historical: 'archive', estimated: 'estimate' })[e] ?? 'published';

// ---- records ----
const ARCHIVE_FACTS = { weight: ['weight', 'Archive curb weight', 'lb', 'curb'], front: ['weight', 'Static weight on front axle', 'fraction'],
  wheelbase: ['dimensions', 'Wheelbase', 'in'], frontTrack: ['dimensions', 'Front track', 'in'], rearTrack: ['dimensions', 'Rear track', 'in'],
  hp: ['engine', 'Rated power', 'hp'], hpRpm: ['engine', 'Power peak', 'rpm'], torque: ['engine', 'Rated torque', 'lb-ft'],
  torqueRpm: ['engine', 'Torque peak', 'rpm'], redline: ['engine', 'Redline', 'rpm'], gears: ['transmission', 'Gear ratios', 'ratio'],
  finalDrive: ['transmission', 'Final drive ratio', 'ratio'], frontTire: ['tires', 'Front tire size', ''], tire: ['tires', 'Rear tire size', ''],
  test60: ['performance', '0–60 mph', 's'], testEt: ['performance', 'Quarter-mile time', 's'], testTrap: ['performance', 'Quarter-mile trap speed', 'mph'] };

function factRows(entry) {
  const rows = [];
  for (const [group, list] of Object.entries(entry.groups)) for (const f of list) {
    const src = entry.sources[f.source] ?? {};
    rows.push({ group, label: f.label, value: f.value, unit: f.unit ?? '', note: f.note ?? '', evidence: evidenceClass(f.evidence),
      ...classify(f.label, f.unit ?? '', f.note ?? ''), source: { url: src.url, publisher: src.publisher, title: src.title }, publish: 'public' });
  }
  return rows;
}

// Archive facts the page does not already carry (same quantity and definition). Review build only.
function archiveExtras(id, rows) {
  const a = archiveCatalog[id]; if (!a) return [];
  const have = new Set(rows.map(r => r.key + '|' + (r.basis ?? '')));
  const out = [];
  for (const [k, [value, evidence, url, note]] of Object.entries(a.record.fields)) {
    const def = ARCHIVE_FACTS[k]; if (!def) continue;
    const [group, label, unit, basis] = def;
    const c = classify(label, unit, note);
    if (have.has(c.key + '|' + (basis ?? c.basis ?? '')) || (c.key !== 'weight' && [...have].some(h => h.startsWith(c.key + '|')))) continue;
    out.push({ group, label, value, unit, note: evidence === 'historical' ? 'As published by Supercar X (2004–08); not re-verified.' : note,
      evidence: evidence === 'historical' ? 'archive' : evidenceClass(evidence), ...c, ...(basis ? { basis } : {}),
      source: { url: evidence === 'historical' ? a.record.archive.capture : url, publisher: evidence === 'historical' ? 'Supercar X (Wayback Machine capture)' : 'Manufacturer' },
      publish: 'review' });
  }
  const [front, rear] = supercarxSuspension[a.record.archive.title] ?? [];
  for (const [key, label, text] of [['suspFront', 'Front suspension', front], ['suspRear', 'Rear suspension', rear]])
    if (text && text !== 'No Info' && !have.has(key + '|')) out.push({ group: 'suspension', label, value: text, unit: '', note: 'Supercar X description.', evidence: 'archive', key,
      source: { url: a.record.archive.capture, publisher: 'Supercar X (Wayback Machine capture)' }, publish: 'review' });
  return out;
}

// Same quantity, different values: show both, never merge silently.
function conflicts(rows) {
  const by = {};
  for (const r of rows) if (r.key && ['power', 'torque', 'weight', 'wheelbase', 'frontTrack', 'rearTrack', 'finalDrive', 'redline', 't60', 'et', 'trap'].includes(r.key)) {
    const v = canonValue(r.value, r.unit); if (v == null) continue;
    (by[r.key] ??= []).push({ ...r, canonical: v });
  }
  const out = [];
  for (const [key, list] of Object.entries(by)) {
    if (list.length < 2) continue;
    const lo = Math.min(...list.map(x => x.canonical)), hi = Math.max(...list.map(x => x.canonical));
    if ((hi - lo) / hi < 0.006) continue;
    const bases = [...new Set(list.map(x => x.basis ?? x.standard ?? ''))];
    out.push({ key, kind: bases.length > 1 ? 'different definitions' : 'source disagreement',
      values: list.map(x => ({ label: x.label, value: x.value, unit: x.unit, basis: x.basis ?? x.standard ?? null, evidence: x.evidence, publisher: x.source.publisher })) });
  }
  return out;
}

const PREFER = ['manufacturer', 'published', 'road test', 'archive', 'calculated', 'estimate'];
function best(rows, key, filter = () => true) {
  const list = rows.filter(r => r.key === key && filter(r) && canonValue(r.value, r.unit) != null);
  list.sort((a, b) => PREFER.indexOf(a.evidence) - PREFER.indexOf(b.evidence) || (a.publish === 'public' ? -1 : 1));
  return list[0] ?? null;
}
function keySpecs(rows) {
  const k = {};
  const take = (name, key, f) => { const r = best(rows, key, f); if (r) k[name] = { value: canonValue(r.value, r.unit), sourceValue: r.value, sourceUnit: r.unit,
    label: r.label, evidence: r.evidence, basis: r.basis ?? r.standard ?? null, publish: r.publish }; };
  take('power', 'power', r => r.standard !== 'estimate'); take('torque', 'torque'); take('powerRpm', 'powerRpm');
  take('weight', 'weight', r => r.basis === 'curb'); if (!k.weight) take('weight', 'weight', r => r.basis !== 'regulation'); if (!k.weight) take('weight', 'weight');
  take('front', 'front'); take('wheelbase', 'wheelbase'); take('frontTrack', 'frontTrack'); take('rearTrack', 'rearTrack');
  take('length', 'length'); take('width', 'width'); take('height', 'height'); take('finalDrive', 'finalDrive');
  take('t60', 't60'); take('et', 'et'); take('trap', 'trap'); take('cd', 'cd'); take('redline', 'redline');
  if (k.front && k.front.value > 1) k.front.value /= 100;
  for (const key of ['tireFront', 'tireRear', 'transmission', 'gears', 'suspFront', 'suspRear']) {
    const r = rows.filter(x => x.key === key).sort((a, b) => PREFER.indexOf(a.evidence) - PREFER.indexOf(b.evidence))[0];
    if (r) k[key] = { value: r.value, label: r.label, evidence: r.evidence, publish: r.publish };
  }
  if (k.power && k.weight) k.weightPerHp = { value: k.weight.value / k.power.value, derived: true };
  return k;
}

// Exact inputs the Lab model uses for this configuration (same registry the Lab and shared links read).
function modelInputs(labId) {
  const v = labId && vehicles[labId]; if (!v) return null;
  const inputs = {};
  for (const [key, [value, evidence, title, url, note]] of Object.entries(v.data)) {
    if (value == null) continue;
    inputs[key] = { value, evidence: evidenceClass(evidence === 'owner' ? 'published' : evidence), basis: [title, note].filter(Boolean).join(' — ').slice(0, 280) || null, url: url ?? null };
  }
  return inputs;
}

const slugOf = route => route.replace(/^\/vehicles\//, '').replace(/\/$/, '');
const entries = published.filter(e => e.indexable);
const records = entries.map(e => {
  let rows = factRows(e);
  const isArchive = e.rid.startsWith('sx-');
  const extras = isArchive ? archiveExtras(e.rid, rows) : [];
  if (privateBuild) rows = rows.concat(extras);
  const labId = vehicles[e.rid] ? e.rid : null;
  // The Lab's own consistency checks decide whether the acceleration model runs (not the archive tier alone).
  const check = labId ? straightLine(resolve(newSetup(labId), false)) : null;
  const v = labId ? vehicles[labId] : null;
  const a = archiveCatalog[e.rid];
  const tires = Object.fromEntries(['tireFront', 'tireRear'].map(k => [k, rows.find(r => r.key === k)?.value]).filter(([, x]) => x)
    .map(([k, size]) => [k, { size, ...(parseTire(size) ?? {}) }]));
  return {
    schema: SCHEMA, id: e.rid, route: '/vehicles/' + e.path + '/', slug: e.path, title: e.title, variant: e.variant, kind: e.kind,
    identity: { year: v?.year ?? a?.record.year ?? (+(e.title.match(/^(19|20)\d{2}/)?.[0] ?? 0) || null), make: v?.make ?? e.title.replace(/^\d{4}\s+/, '').split(' ')[0],
      layout: v?.layout ?? a?.record.layout ?? null, category: v?.category ?? a?.record.category ?? null,
      archive: a ? { tier: a.tier, competition: a.record.archive.competition, modified: a.record.archive.modified, capture: a.record.archive.capture } : null },
    facts: rows, conflicts: conflicts(rows), key: keySpecs(rows), tires,
    review: { archiveFactsPending: extras.length },
    model: labId ? { labId, engine: 'ESS acceleration v2 (integration/ess-converged 9f4a292); launch presets not promoted (PR #18 QA-FAIL)',
      inputs: modelInputs(labId), readiness: e.fixture?.readiness ?? null, competition: !!a?.record.archive.competition,
      accelerationRuns: !check?.issue, accelerationIssue: check?.issue ?? null } : null,
    links: { compare: '/vehicles/compare/?a=' + e.path, lab: e.fixture ? Object.fromEntries(['build', 'performance', 'strip', 'tools', 'suspension']
      .map(k => [k, e.fixture[k]])) : null, defaultOpponent: e.fixture?.b ?? null },
  };
});

// Related configurations and comparison suggestions (internal links; same make first, then similar weight per hp).
const ppw = r => r.key.weightPerHp?.value;
for (const r of records) {
  const others = records.filter(o => o !== r);
  const sameMake = others.filter(o => o.identity.make === r.identity.make);
  const later = sameMake.filter(o => (o.identity.year ?? 0) > (r.identity.year ?? 0) && !o.identity.archive?.competition);
  const flagship = later.slice().sort((a, b) => (b.key.power?.value ?? 0) - (a.key.power?.value ?? 0))[0];
  const latest = later.filter(o => o !== flagship).sort((a, b) => (b.identity.year - a.identity.year) || ((ppw(a) ?? 99) - (ppw(b) ?? 99)))[0];
  const similar = ppw(r) ? others.filter(o => ppw(o) && o.identity.make !== r.identity.make && Math.abs(ppw(o) / ppw(r) - 1) < 0.15)
    .sort((a, b) => Math.abs(ppw(a) - ppw(r)) - Math.abs(ppw(b) - ppw(r))) : [];
  const pick = [flagship, latest, ...sameMake, ...similar].filter(Boolean);
  r.compareWith = [...new Set(pick.map(o => o.slug))].slice(0, 3);
  r.related = [...new Set([...sameMake.slice(0, 4), ...similar.slice(0, 4)].map(o => o.slug))].slice(0, 8)
    .map(s => { const o = records.find(x => x.slug === s); return { slug: s, title: o.title, route: o.route }; });
}

const out = new URL('vehicles/data/', root);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const publicRecord = r => ({ ...r, facts: r.facts.filter(f => privateBuild || f.publish === 'public') });
for (const r of records) writeFileSync(new URL(r.slug + '.json', out), JSON.stringify(publicRecord(r)));
writeFileSync(new URL('index.json', out), JSON.stringify({ schema: SCHEMA + '.index', count: records.length, vehicles: records.map(r => ({
  id: r.id, slug: r.slug, route: r.route, title: r.title, variant: r.variant, make: r.identity.make, year: r.identity.year, layout: r.identity.layout,
  labId: r.model?.labId ?? null, runs: !!(r.model && !r.model.competition && r.links.lab && r.model.accelerationRuns), key: r.key })) }));
writeFileSync(new URL('_build/knowledge/vehicle-knowledge.json', root), JSON.stringify({ schema: SCHEMA, private: privateBuild, records }, null, 1));
const n = (f) => records.reduce((s, r) => s + r.facts.filter(f).length, 0);
console.log(JSON.stringify({ records: records.length, publicFacts: n(f => f.publish === 'public'), reviewFacts: n(f => f.publish === 'review'),
  archivePending: records.reduce((s, r) => s + r.review.archiveFactsPending, 0), withModel: records.filter(r => r.model).length,
  withLab: records.filter(r => r.links.lab).length, accelerationRuns: records.filter(r => r.model?.accelerationRuns && !r.model.competition).length, conflicts: records.reduce((s, r) => s + r.conflicts.length, 0) }));
