// What the Performance page's tire picker shows, old rule vs fixed rule: typical-μ 0–60 / ET per tire class.
// Run: node _build/validation/tire-ladder.mjs
import { labVehicle } from '../../engine/garage-adapter.mjs';
import { straightLine } from '../../engine/acceleration.mjs';
import { frictionFor } from '../../engine/traction.mjs';
const ids = { 'GR86': 'toyota-gr86-zn8--2022-premium-2.4-m6-coupe', 'Ranger Raptor': 'ford-ranger-p703--2024-raptor-3.0-a10-supercrew-4wd',
  'Ram TRX': 'ram-1500-dt--2021-trx-6.2-a8-crew-cab-4wd', 'WRX': 'subaru-wrx-vb--2022-limited-2.4-m6-sedan', 'MX-5 ND': 'mazda-mx5-nd--2024-club-2.0-m6-soft-top' };
const ladder = ['allSeason', 'maxSummer', 'extremeSummer', 'dragRadial', 'slick'];
for (const [name, id] of Object.entries(ids)) {
  const v = labVehicle(id).vehicle;
  console.log(`\n${name}`);
  for (const tire of ladder) {
    const mu = frictionFor({ tire, surface: 'dryAsphalt' }).typical;
    const o = straightLine(v, { mu, legacyTraction: true, inertiaScale: false }).magazine, n = straightLine(v, { mu }).magazine;
    console.log(`  ${tire.padEnd(14)} μ ${mu.toFixed(2)}  old 0–60 ${o.zeroTo60.toFixed(2)} ET ${o.et.toFixed(2)}  |  fixed 0–60 ${n.zeroTo60.toFixed(2)} ET ${n.et.toFixed(2)}`);
  }
}
