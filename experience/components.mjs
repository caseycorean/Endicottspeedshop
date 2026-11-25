import { stock } from './vehicles.mjs';

const gmAuto = 'https://news.chevrolet.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/1999-Chevrolet-Camaro.pdf';
const fourthGen = 'chevrolet-camaro-4th-gen--2002-ss-ls1-m6-coupe';
const tkx = 'https://tremec.com/wp-content/uploads/2023/05/TKX-Parts-Manual_04.05.2021-1.pdf';
const engineKeys = ['hp','hpRpm','torque','torqueRpm','redline'];
const engine = (source, name) => ({
  name, values: Object.fromEntries(engineKeys.map(key => [key, stock(source)[key]])),
  note: 'Donor engine ratings from ESS vehicle references. Shift ceiling and modeled torque shape remain editable.',
});
export const components = {
  engine: {
    ls1gto: engine('gto', 'Pontiac GTO LS1 · 350 hp'),
    ls6c5: engine('corvette', 'C5 Corvette Z06 LS6'),
  },
  transmission: {
    t56ss: {name:'T56 · 2002 Camaro SS V8', values:{gears:stock(fourthGen).gears, transmission:'manual'},
      note:'GM published V8 six-speed ratios in the Chevrolet Heritage Archive. Installation mass remains vehicle-specific.'},
    tkx287: {name:'TREMEC TKX · 2.87 first / 0.68 fifth', values:{gears:[2.87,1.89,1.28,1,.68], transmission:'manual'}, url:tkx,
      note:'TCET17805 GM ratio set. Installation mass and compatibility need vehicle-specific measurements.'},
    tkx327: {name:'TREMEC TKX · 3.27 first / 0.72 fifth', values:{gears:[3.27,1.98,1.34,1,.72], transmission:'manual'}, url:tkx,
      note:'TCET18083 GM ratio set. Numerically higher first gear increases wheel torque until grip limits it.'},
    gm4l60: {name:'GM 4L60E · 1999 Camaro V8 automatic', values:{gears:[3.06,1.63,1,.70], transmission:'automatic'}, url:gmAuto,
      note:'GM published the gear ratios. The strip uses an illustrative coupling, converter multiplication and shift delay, not a measured converter or shift map.'},
  },
};

export function componentOverrides(setup) {
  return Object.assign({}, ...Object.entries(setup.components ?? {}).map(([kind, id]) => components[kind]?.[id]?.values));
}
