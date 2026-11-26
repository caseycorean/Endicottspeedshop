import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).pathname;
const strip = s => s.replace(/^import .*$/mg, '').replace(/^export /mg, '');
const loads = 'const longitudinalTransfer = (weight, cg, wheelbase, ax) => weight * cg * ax / wheelbase;\nconst LOAD_SENSITIVITY = 0.15;\n';
const engine = loads + strip(readFileSync(root + 'engine/braking.mjs', 'utf8'));
const { records } = JSON.parse(readFileSync(root + '_build/knowledge/vehicle-knowledge.json'));
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const cars = [];
for (const r of records) {
  const tests = r.facts.filter(f => /^Braking (60|70|100)–0 mph$/.test(f.label) && Number.isFinite(f.value))
    .map(f => ({ mph: +f.label.match(/(\d+)–0/)[1], ft: f.value, pub: f.source?.publisher }));
  if (!tests.length) continue;
  const i = Object.fromEntries(Object.entries(r.model?.inputs ?? {}).map(([k, x]) => [k, val(x)]));
  if (!i.weight) continue;
  cars.push({ id: r.id, title: r.title, weight: i.weight, front: i.front, cg: i.cg, wheelbase: i.wheelbase, grip: i.grip, cda: i.cda, diameter: i.diameter, tests });
}
cars.sort((a, b) => a.title.localeCompare(b.title));
const tpl = readFileSync(process.argv[2], 'utf8');
writeFileSync(process.argv[3], tpl.replace('/*ENGINE*/', engine).replace('/*CARS*/', JSON.stringify(cars)));
console.log(cars.length, 'cars');
