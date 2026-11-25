import { reference } from './reference.mjs';

const field = (value, title, url, evidence = 'published') => [value, evidence, title, url];
const estimate = (value, note) => [value, 'estimated', note];
const cdCamaro = 'https://www.caranddriver.com/reviews/a69819422/1991-chevrolet-camaro-z28-archive-test/';
const camaroData = 'https://www.teufert.net/camaro/1991.htm';
const fieroBook = 'https://fieroinfo.com/manuals/Fiero_by_Gary_Witzenburg.pdf';
const fieroManual = 'https://www.boomtastic.com/files/01%20Service%20Manuals%2C%20Guides%2C%20and%20Tips/Owners%20Manuals/1988/1988%20Fiero%20Owners%20Manual.pdf';
const fieroCatalog = 'https://www.automobile-catalog.com/car/1988/2850740/pontiac_fiero_gt.html';
const foxBook = 'https://fliphtml5.com/zfxcf/kmgt/The_Complete_Book_of_Ford_Mustang_Every_Model_Since_1964_%C2%BD/169/';
const foxChassis = n => field(n, 'Mike Mueller, 1993 LX V8 coupe (civilian reference)', foxBook);
const camaroTest = (n, evidence = 'independent_test') => field(n, 'Car and Driver, 1991 Camaro Z28 test', cdCamaro, evidence);
const fieroSpecs = n => field(n, 'Gary Witzenburg, Fiero, 1988 specifications', fieroBook);

export const fields = {
  weight: 'Vehicle weight (lb)', front: 'Static front share (%)', wheelbase: 'Wheelbase (in)',
  frontTrack: 'Front track (in)', rearTrack: 'Rear track (in)', cg: 'CG height (in)',
  hp: 'Peak power (hp)', hpRpm: 'Peak power RPM', torque: 'Peak torque (lb-ft)',
  torqueRpm: 'Peak torque RPM', redline: 'Shift / redline RPM', gears: 'Gear ratios',
  finalDrive: 'Final drive', tire: 'Rear tire size', diameter: 'Rear tire diameter (in)',
  grip: 'Launch grip coefficient', cda: 'Drag area (ft²)', frontSpring: 'Front spring (lb/in)',
  rearSpring: 'Rear spring (lb/in)', frontMotion: 'Front motion ratio', rearMotion: 'Rear motion ratio',
  frontUnsprung: 'Front unsprung (lb/corner)', rearUnsprung: 'Rear unsprung (lb/corner)',
  tireRate: 'Tire vertical rate (lb/in)', test60: 'Published 0–60 (s)',
  testEt: 'Published quarter mile (s)', testTrap: 'Published trap (mph)',
};

const supplements = {
  firebird: {
    front: estimate(0.58, 'A scenario value informed by the historical Formula. The W72 Trans Am test car has no verified axle split.'),
    diameter: estimate(27, 'Nominal approximation for the test’s GR70-15.'),
    redline: estimate(5000, 'Illustrative shift ceiling; exact test shift points are unavailable.'),
    cda: estimate(9, 'Illustrative drag area, independent of the Formula’s archive estimate.'),
    frontMotion: estimate(.55, 'Illustrative second-gen control-arm spring installation.'),
  },
  mustang: {
    weight: foxChassis(3035), wheelbase: foxChassis(100.5), frontTrack: foxChassis(56.6), rearTrack: foxChassis(57),
    front: estimate(.57, 'Illustrative Fox front share.'),
    diameter: estimate(24.7, 'Representative Fox V8 tire; SSP test fitment unknown.'),
    gears: estimate([3.35, 1.99, 1.33, 1, .68], 'Representative late Fox T5 ratios; SSP equipment unverified.'),
    finalDrive: estimate(3.08, 'Scenario axle ratio; verify the actual axle tag.'),
    cda: estimate(8, 'Illustrative drag area.'),
  },
  camaro: {
    weight: camaroTest(3329), wheelbase: camaroTest(101, 'published'),
    hp: camaroTest(230, 'published'), hpRpm: camaroTest(4400, 'published'),
    torque: field(300, 'Teufert 1991 Camaro data, LB9 manual', camaroData),
    torqueRpm: field(3200, 'Teufert 1991 Camaro data, LB9 manual', camaroData),
    tire: camaroTest('245/50ZR16', 'published'), test60: camaroTest(6.4),
    testEt: camaroTest(14.9), testTrap: camaroTest(93),
    front: estimate(.56, 'Illustrative third-gen front share.'),
    gears: estimate([2.95, 1.94, 1.34, 1, .63], 'Representative GM T5 gearing; tested gearbox ratios unconfirmed.'),
    finalDrive: estimate(3.45, 'Representative performance axle; exact test ratio unverified.'),
  },
  fiero: {
    weight: field(2791, 'Automobile Catalog, 1988 GT five-speed', fieroCatalog),
    wheelbase: fieroSpecs(93.4), frontTrack: fieroSpecs(57.8), rearTrack: fieroSpecs(58.7),
    hp: fieroSpecs(135), hpRpm: fieroSpecs(4500), torque: fieroSpecs(165), torqueRpm: fieroSpecs(3600),
    gears: field([3.5, 2.05, 1.38, .94, .72], '1988 Pontiac Fiero owner’s manual, GT five-speed', fieroManual, 'manufacturer'),
    finalDrive: field(3.61, '1988 Pontiac Fiero owner’s manual, GT five-speed', fieroManual, 'manufacturer'),
    tire: field('215/60R15', '1988 Pontiac ordering guide, GT', 'https://reloaded.fiero.de/images/ordering.pdf', 'manufacturer'),
    front: estimate(.44, 'Illustrative front load for a mid-engine GT.'),
  },
  corvette: { cda: estimate(7, 'Illustrative drag area.') },
  miata: { front: estimate(.51, 'Illustrative NA Miata front share.'), diameter: estimate(23.1, 'Representative NA tire diameter.'), redline: estimate(7000, 'Illustrative shift ceiling.') },
  gto: { front: estimate(.55, 'Illustrative US GTO front share.'), cda: estimate(8, 'Illustrative drag area.') },
};

export const vehicleIds = ['firebird', 'mustang', 'camaro', 'fiero', 'corvette', 'miata', 'gto'];
const v1Extras = {
  camaro: { name: '1991 Camaro Z28', trim: 'Third-gen LB9 · 5-speed · C/D test car' },
  fiero: { name: '1988 Pontiac Fiero GT', trim: 'Mid-engine L44 V6 · 5-speed' },
};

function tireDiameter(size) {
  const match = size?.match(/^(\d{3})\/(\d{2})Z?R(\d{2})$/);
  return match ? Math.round((+match[3] + 2 * +match[1] * +match[2] / 2540) * 100) / 100 : null;
}

export const vehicles = Object.fromEntries(vehicleIds.map(id => {
  const meta = reference[id] ?? v1Extras[id];
  const data = { ...meta.published, ...supplements[id] };
  const track = estimate(60, 'Generic track-width placeholder for this prototype.');
  const fallback = {
    cg: estimate(20, 'Common starting point for comparisons. No matching measured CG height.'),
    frontTrack: track, rearTrack: track,
    redline: estimate(6000, 'Illustrative shift ceiling.'),
    grip: estimate(.9, 'Common dry-pavement scenario for comparisons; not a measured tire property.'),
    cda: estimate(7.5, 'Common illustrative drag area.'),
    frontSpring: estimate(350, 'Example spring; measure or enter your own.'),
    rearSpring: estimate(160, 'Example spring; measure or enter your own.'),
    frontMotion: estimate(.75, 'Example spring travel divided by wheel travel.'),
    rearMotion: estimate(1, 'Example spring travel divided by wheel travel.'),
    frontUnsprung: estimate(95, 'Illustrative per-corner unsprung weight.'),
    rearUnsprung: estimate(95, 'Illustrative per-corner unsprung weight.'),
    tireRate: estimate(1400, 'Generic street tire vertical rate.'),
  };
  if (!data.diameter) {
    const diameter = tireDiameter(data.tire?.[0]);
    data.diameter = diameter === null ? estimate(26, 'Generic rear tire diameter.') :
      [diameter, 'calculated', 'Nominal tire sidewall dimensions; loaded radius varies.', data.tire[3]];
  }
  return [id, { name: meta.name, trim: meta.trim, ref: meta.ref, data: { ...fallback, ...data } }];
}));

export function stock(id) {
  return Object.fromEntries(Object.entries(vehicles[id].data).map(([key, info]) => [key, info[0]]));
}

export const firebirdEvidence = [
  ['3,578 lb · 58% front', 'Historical Formula W72 reference. Configuration and original weight source remain unconfirmed.'],
  ['3,240 lb · 60.5% front', 'Historical modified / stripped Formula, owner truck-scale record.'],
  ['2,786 lb · 51% front', 'ESS corner scales, July 18. LS1/T5 installed. Nose, hood, radiator, exhaust, fuel and coolant absent.'],
  ['2,988 lb · 53.5% front', 'Study 9 finished dry projection. Full four-corner measurement is pending.'],
];
