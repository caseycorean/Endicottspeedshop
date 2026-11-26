// Reconcile Claude's archive resolver (PR #15, engine/archive.mjs) with Work's expanded reference (47501c2).
// Reads only existing inputs; writes _build/knowledge/reconciliation.csv and prints a summary JSON.
// Run after `python3 -B _build/build.py` (which writes the Work coverage ledger).
import { readFileSync, writeFileSync } from 'node:fs';
import { archiveCatalog } from '../../engine/archive.mjs';
import { catalog } from '../../experience/catalog-data.mjs';

const here = new URL('./', import.meta.url);
const read = p => readFileSync(new URL(p, here), 'utf8');
const json = p => JSON.parse(read(p));

function csvRows(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const coverage = csvRows(read('../vehicle-reference-coverage.csv'));
const reviewed = { ...json('../reference-oem.json'), ...json('../reference-reviewed.json') };
const editorial = json('../reference-editorial.json');
const workData = json('../vehicle-reference-data.json');

// Work fact labels → archive record keys, for conflict detection on the same quantity.
const LABEL_KEY = [
  [/^(rated|archive rated|sae net|net) ?power|^power$|horsepower/i, 'hp'], [/torque$|rated torque/i, 'torque'],
  [/curb weight|as tested weight|test weight|shipping weight|^weight/i, 'weight'], [/^wheelbase/i, 'wheelbase'],
  [/^front track/i, 'frontTrack'], [/^rear track/i, 'rearTrack'], [/final drive|axle ratio/i, 'finalDrive'],
  [/redline|maximum engine speed/i, 'redline'],
];
const keyFor = label => /extension|change|increase|share|peak$/i.test(label) ? null : LABEL_KEY.find(([re]) => re.test(label))?.[1];
// Convert to the archive's units (hp, lb-ft, lb, in) before comparing.
const TO_ARCHIVE = { kW: 1.34102, PS: 0.98632, bhp: 1, hp: 1, 'N·m': 0.737562, Nm: 0.737562, kg: 2.20462, mm: 1 / 25.4, lb: 1, 'lb-ft': 1, in: 1, ratio: 1, rpm: 1, '': 1 };
const basisOf = label => /as tested|test/i.test(label) ? 'as tested' : /shipping/i.test(label) ? 'shipping' : /curb/i.test(label) ? 'curb' : '';

const rows = [];
const summary = { archive: {}, curated: {}, conflicts: 0, archiveOnlyFacts: 0, workOnlyFacts: 0 };
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

for (const c of coverage) {
  if (c.collection === 'archive') {
    const a = archiveCatalog[c.id];
    const rec = a?.record.fields ?? {};
    const review = reviewed[c.id];
    const conflicts = [], workKeys = new Set();
    for (const facts of Object.values(review?.fields ?? {})) for (const [label, value, unit] of facts) {
      const key = keyFor(label); if (!key || typeof value !== 'number') continue;
      workKeys.add(key);
      const archived = rec[key]?.[0], k = TO_ARCHIVE[unit ?? ''];
      if (k == null) continue;
      const same = value * k;
      // 0.6% tolerance absorbs rounding in unit conversion and source rounding (e.g. 2730 mm vs 107.5 in).
      if (typeof archived === 'number' && Math.abs(archived - same) / Math.max(Math.abs(same), 1e-9) > 0.006)
        conflicts.push(`${key}: Work ${value}${unit ? ' ' + unit : ''}${basisOf(label) ? ' (' + basisOf(label) + ')' : ''} vs archive ${archived}`);
    }
    const archiveKeys = Object.keys(rec).filter(k => rec[k]?.[0] != null);
    const archiveOnly = archiveKeys.filter(k => !workKeys.has(k));
    summary.conflicts += conflicts.length; summary.archiveOnlyFacts += c.disposition === 'candidate' ? archiveOnly.length : 0;
    bump(summary.archive, `${c.disposition}/${a?.mergedInto ? 'merged' : a?.tier}`);
    rows.push({ collection: 'archive', id: c.id, title: c.title, work_disposition: c.disposition, work_route: c.route,
      work_facts: c.sourced_facts, work_lab: c.handoff.includes('Lab') ? 'yes' : 'no', claude_tier: a?.mergedInto ? 'merged' : a?.tier,
      claude_runs: (a?.runs ?? []).join(' '), claude_model_inputs: archiveKeys.length,
      archive_facts_not_in_work_page: archiveOnly.join(' '), work_independent_source: review?.url ?? '',
      conflicts: conflicts.join('; '), integration: c.disposition !== 'candidate' ? (c.disposition === 'merged' ? 'route to curated page' : 'held: ' + c.reason.split(' — ')[0])
        : a?.tier === 'simulation-ready' ? 'connect page to Lab (sx id)' : a?.tier === 'partial' ? 'connect tools that run; list missing' : 'specification only' });
  } else {
    const cat = catalog[c.id];
    const rec = workData.records.find(r => r.config_id === c.id);
    const groups = ['mass', 'geometry', 'tires_wheels', 'suspension', 'brakes', 'powertrain', 'aero', 'performance_validation', 'capacities', 'chassis'];
    const recordFacts = groups.reduce((n, g) => n + Object.values(rec?.[g] ?? {}).filter(f => f && typeof f === 'object' && f.value != null).length, 0);
    const modelInputs = Object.keys(cat?.fields ?? {}).length;
    const decision = editorial.curated[c.id];
    bump(summary.curated, decision ? 'work-reviewed-replacement' : 'shared');
    summary.workOnlyFacts += Math.max(0, +c.sourced_facts - modelInputs);
    rows.push({ collection: 'curated', id: c.id, title: c.title, work_disposition: c.disposition, work_route: c.route,
      work_facts: c.sourced_facts, work_lab: c.handoff.includes('Lab') ? 'yes' : 'no', claude_tier: cat ? 'curated' : 'missing',
      claude_runs: '', claude_model_inputs: modelInputs, archive_facts_not_in_work_page: '', work_independent_source: decision?.url ?? '',
      conflicts: '', integration: decision ? 'Work replaced facts with reviewed narrow source; Lab link withheld until runtime row verified'
        : c.handoff.includes('Lab') ? 'already connected' : `record has ${recordFacts} sourced fields; model inputs incomplete` });
  }
}
const head = Object.keys(rows[0]);
const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
writeFileSync(new URL('reconciliation.csv', here), [head.join(','), ...rows.map(r => head.map(k => esc(r[k])).join(','))].join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, ...summary,
  conflictRows: rows.filter(r => r.conflicts).map(r => `${r.id}: ${r.conflicts}`) }, null, 1));
