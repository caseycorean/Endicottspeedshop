// Fact normalization shared by the knowledge build and its tests: label/unit → quantity key, unit quantity, definition.
// ---- fact normalization: label/unit → canonical quantity key, unit-system quantity and definition (basis) ----
const RULES = [
  // Engine-speed labels first: "Peak torque rpm max" must never be read as a torque value (B1, 26 Nov).
  [/^power peak|peak power rpm/i, 'powerRpm', null], [/^torque peak|peak torque rpm/i, 'torqueRpm', null],
  [/rated power|^power$|peak power/i, 'power', 'power'], [/rated torque|peak torque/i, 'torque', 'torque'], [/redline|maximum engine speed/i, 'redline', null],
  [/^displacement/i, 'displacement', null],
  [/static weight on front|front share/i, 'front', null],
  [/as tested weight|test weight/i, 'weight', 'weight', 'as tested'], [/curb weight|kerb weight/i, 'weight', 'weight', 'curb'],
  [/shipping weight/i, 'weight', 'weight', 'shipping'], [/dry weight/i, 'weight', 'weight', 'dry'],
  [/regulation minimum|unballasted/i, 'weight', 'weight', 'regulation'], [/manufacturer weight|published weight|^weight$/i, 'weight', 'weight', 'published'],
  [/^wheelbase$/i, 'wheelbase', 'length'], [/^front track/i, 'frontTrack', 'length'], [/^rear track/i, 'rearTrack', 'length'],
  [/^length/i, 'length', 'length'], [/^width/i, 'width', 'length'], [/^height/i, 'height', 'length'],
  [/final drive/i, 'finalDrive', null], [/gear ratios/i, 'gears', null], [/^transmission$/i, 'transmission', null],
  [/front tire size|tire size front/i, 'tireFront', null], [/rear tire size|tire size rear|factory tire size/i, 'tireRear', null],
  [/drag coefficient|\(cd\)/i, 'cd', null], [/drag area|cda/i, 'cda', null], [/frontal area/i, 'frontalArea', null],
  [/0–60 mph|zero to 60/i, 't60', null], [/quarter-mile time/i, 'et', null], [/quarter-mile trap/i, 'trap', 'speed'],
  [/top speed/i, 'topSpeed', 'speed'], [/^front suspension/i, 'suspFront', null], [/^rear suspension/i, 'suspRear', null],
  [/spring rate/i, 'spring', 'rate'], [/fuel (tank )?capacity/i, 'fuel', null],
];
export const TO_CANON = { kW: 1 / 0.745699872, PS: 0.98632, bhp: 1, hp: 1, 'N·m': 0.737562149, 'lbs-ft': 1, 'lb-ft': 1, kg: 2.20462262, lb: 1,
  mm: 1 / 25.4, in: 1, mph: 1, 'km/h': 1 / 1.609344 };
export function classify(label, unit = '', note = '') {
  let hit = RULES.find(([re]) => re.test(label));
  // A value in rpm is an engine speed, whatever the label says.
  if (hit && unit === 'rpm' && (hit[1] === 'power' || hit[1] === 'torque')) hit = [null, hit[1] + 'Rpm', null];
  if (!hit) return { key: null };
  const [, key, quantity, basis] = hit;
  const out = { key, quantity };
  if (basis) out.basis = basis;
  if (key === 'power' || key === 'torque') {
    const text = `${label} ${note}`;
    out.standard = /gross/i.test(text) ? 'gross' : unit === 'PS' ? 'PS (DIN)' : unit === 'kW' ? 'kW' : unit === 'bhp' ? 'bhp' : /sae net|net/i.test(text) ? 'SAE net' : 'as published';
    if (/estimate/i.test(label)) out.standard = 'estimate';
  }
  return out;
}
