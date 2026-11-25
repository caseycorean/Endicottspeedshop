import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tireLoads, ride, applyItems, axleWeights, springForFrequency } from '../loads.mjs';
import * as lab from '../../experience/models.mjs';
import { vehicleIds } from '../../experience/vehicles.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const root = new URL('../../', import.meta.url);

// Pull the arithmetic out of a calculator page so this test fails if the page's formulas ever drift.
function calculatorFormula(page, from, to) {
  const html = readFileSync(new URL(page, root), 'utf8');
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, `formula block not found in ${page}`);
  return html.slice(a, b);
}

test('tire loads: library = Load Transfer Calculator page = Vehicle Lab, all seven cars', () => {
  const block = calculatorFormula('tools/load-transfer/index.html', 'var W=v.w', "var st=");
  // Page variables: sx = +1 braking; dirn right → load to the left tires. c = {lf, rf, lr, rr}.
  const page = new Function('v', 'mode', '$', block.replace(/\$\('lm'\)\.value/g, 'mode') + '; return c;');
  for (const id of vehicleIds) {
    const v = { ...lab.resolve(lab.newSetup(id), false) };
    for (const [ax, ay] of [[0, 0], [.6, 0], [0, .9], [.4, .8]]) {
      const ours = tireLoads(v, ax, ay);
      const theirs = lab.tireLoads(v, ax, ay);
      ours.tires.forEach((x, i) => close(x, theirs.tires[i], 1e-9, `${id} Vehicle Lab tire ${i}`));
      const c = page({ w: v.weight, fp: v.front * 100, wb: v.wheelbase, h: v.cg, ax, ay, tf: v.frontTrack, tr: v.rearTrack,
        kf: 60, zf: 2, zr: 12 }, 'b', () => ({ value: 'r' }));
      [c.lf, c.rf, c.lr, c.rr].forEach((x, i) => close(x, ours.tires[i], 1e-9, `${id} calculator tire ${i}`));
    }
  }
});

test('ride frequency: library = Spring Rate page = Vehicle Lab (spring angle 0)', () => {
  const block = calculatorFormula('tools/spring-rate/index.html', "var k=v['s'+e]", "res[e]=");
  const page = new Function('v', 'e', 'cw', 'un', 'kt', block + '; return {wr:wr, rr:rr, ws:ws};');
  for (const id of vehicleIds) {
    const v = lab.resolve(lab.newSetup(id), false);
    for (const axle of ['front', 'rear']) {
      const e = axle[0];
      const ours = ride({ cornerLb: v[axle + 'Lb'] / 2, unsprung: v[axle + 'Unsprung'], spring: v[axle + 'Spring'],
        motion: v[axle + 'Motion'], tireRate: v.tireRate });
      const theirs = lab.ride(v, axle);
      close(ours.hz, theirs.hz, 1e-12, `${id} ${axle} vs Vehicle Lab`);
      const pg = page({ ['s' + e]: v[axle + 'Spring'], ['m' + e]: v[axle + 'Motion'], ['a' + e]: 0 }, e,
        { [e]: v[axle + 'Lb'] / 2 }, { [e]: v[axle + 'Unsprung'] }, v.tireRate);
      close(ours.rate, pg.rr, 1e-9, `${id} ${axle} vs calculator`);
    }
  }
  // spring angle: page and library agree at 20°
  const a = ride({ cornerLb: 900, unsprung: 90, spring: 400, motion: .6, angleDeg: 20, tireRate: 1400 });
  const pg = page({ sf: 400, mf: .6, af: 20 }, 'f', { f: 900 }, { f: 90 }, 1400);
  close(a.rate, pg.rr, 1e-9, 'angled spring');
  close(springForFrequency({ cornerLb: 900, unsprung: 90, motion: .6, angleDeg: 20, tireRate: 1400, hz: a.hz }), 400, 1e-6, 'inverse');
});

test('item moves: library = Vehicle Lab resolve()', () => {
  for (const id of vehicleIds) {
    const setup = { ...lab.newSetup(id), parts: [
      { label: 'a', oldWeight: 31, oldX: -16, newWeight: 11, newX: -16 },
      { label: 'b', oldWeight: 40, oldX: 18, newWeight: 40, newX: 90 }] };
    const theirs = lab.resolve(setup);
    const ours = applyItems(axleWeights(lab.resolve(lab.newSetup(id), false)), setup.parts);
    close(ours.weight, theirs.weight, 1e-9, id); close(ours.front, theirs.front, 1e-12, id);
  }
});
