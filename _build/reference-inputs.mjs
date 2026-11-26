// Serialize the existing Lab and archive APIs for the static page generator.
import { readFileSync } from 'node:fs';
import { archiveCatalog, archiveResolveOptions } from '../engine/archive.mjs';
import { example, shareFragment } from '../experience/configuration.mjs';
import { newSetup, resolve } from '../experience/models.mjs';
import { estimatedFor, missingFor, missingText, studies } from '../experience/readiness.mjs';
import { vehicles } from '../experience/vehicles.mjs';

const {records} = JSON.parse(readFileSync(new URL('./vehicle-reference-data.json', import.meta.url), 'utf8'));
const candidates = records.filter(r => Object.hasOwn(vehicles, r.config_id));
const balanceInputs = new Set();
const available = candidates.map(({config_id: id}) => {
  const value = resolve(newSetup(id), false);
  if (['frontTrack','rearTrack'].every(key => Number.isFinite(value[key]))) balanceInputs.add(id);
  const readiness = Object.fromEntries(Object.keys(studies).map(tool => [tool, {
    missing: missingText(missingFor(value, tool)), estimated: missingText(estimatedFor(value, tool))
  }]));
  return [id, readiness];
});
const readiness = Object.fromEntries(available);
const defaults = ['mazda-mx5-nd--2024-club-2.0-m6-soft-top', 'honda-civic-fl5--2023-type-r-k20c1-m6-hatch'];
const fixtures = Object.fromEntries(candidates.map(({config_id: id}) => {
  const b = defaults.find(other => id !== other);
  const variant = {...example(), a: newSetup(id), b: newSetup(b)};
  return [id, {
    b, readiness: readiness[id], balanceCalculator: balanceInputs.has(id), label: vehicles[id].name, trim: vehicles[id].trim,
    build: shareFragment(variant, 'build'), strip: shareFragment({...variant, event:'strip'}, 'compare'),
    oval: shareFragment({...variant, event:'oval'}, 'compare'), tools: shareFragment(variant, 'tools'),
    performance: shareFragment(variant, 'performance'), suspension: shareFragment(variant, 'suspension'),
  }];
}));
const history = Object.values(archiveCatalog).map(({id, name, record, mergedInto, tier, missing, runs}) => {
  const {typeFront, typeRear} = archiveResolveOptions(id);
  return {id, name, record, mergedInto, tier, missing, runs, typeFront, typeRear};
});
console.log(JSON.stringify({fixtures, history}));
