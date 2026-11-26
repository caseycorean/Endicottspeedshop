// Integrated candidate checks (Claude, 26 Nov 2026): engine-swap mass in the browser Lab, Candidate A shell on every page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { newSetup, resolve, engineSwapMass } from '../../experience/models.mjs';
import { swapMassLine } from '../../experience/drivetrain-view.mjs';

const root = new URL('../../', import.meta.url);
const withEngine = (id, engine, tune = {}) => ({ ...newSetup(id), components: { engine }, tune });

test('engine swap changes installed mass and balance when both engines are in the library', () => {
  const stock = resolve(newSetup('firebird'), false);
  const swapped = resolve(withEngine('firebird', 'ls1gto'));
  // Pontiac V8 (625 lb mid-range estimate) → aluminum LS (474 lb published): 151 lb lighter, all of it near the front axle.
  assert.equal(Math.round(stock.weight - swapped.weight), 151);
  assert.ok(swapped.front < stock.front, 'front share falls when a lighter engine goes in');
  assert.equal(swapped.evidence.weight, 'estimated');
  assert.equal(swapped.hp, 350, 'donor rating still applies');
  assert.match(swapMassLine(swapped), /−151 lb installed/);
});

test('engine swap keeps the stock mass, and says why, when it cannot be estimated', () => {
  const coyote = resolve(withEngine('camaro', 'coyote18'));
  assert.equal(coyote.weight, resolve(newSetup('camaro'), false).weight);
  assert.match(coyote.engineSwap.unchanged, /not in the component library/);
  const fiero = resolve(withEngine('fiero', 'ls1gto'));
  assert.match(fiero.engineSwap.unchanged, /mid- or rear-engine/);
  assert.match(swapMassLine(fiero), /unchanged/);
});

test('an owner-entered weight wins over the library swap estimate', () => {
  const v = resolve(withEngine('firebird', 'ls1gto', { weight: 3500 }));
  assert.equal(v.weight, 3500);
  assert.match(v.engineSwap.unchanged, /Your own weight/);
});

test('no engine selected → no swap note', () => {
  assert.equal(engineSwapMass(newSetup('camaro')), null);
  assert.equal(swapMassLine(resolve(newSetup('camaro'))), '');
});

test('every vehicle page uses the Candidate A guided template with the shared navigation', () => {
  const dir = new URL('vehicles/', root);
  const slugs = readdirSync(dir).filter(s => existsSync(new URL(`${s}/index.html`, dir)));
  assert.ok(slugs.length >= 116);
  for (const s of slugs) {
    const html = readFileSync(new URL(`${s}/index.html`, dir), 'utf8');
    if (!html.includes('id="ess-spec-data"')) continue; // library index and compare page
    assert.match(html, /class="page sg-page"/, s);
    assert.match(html, /logo-horizontal-tight\.png/, s);
    assert.match(html, />Vehicle Lab</, s);
    assert.doesNotMatch(html, /data-sg-hero/, `${s}: generic side-view drawing removed`);
  }
});

test('generated pages and the Lab carry the Candidate A skin', () => {
  for (const p of ['index.html', 'tools/index.html', 'articles/traction-circle/index.html', 'experience/index.html']) {
    const html = readFileSync(new URL(p, root), 'utf8');
    assert.match(html, /data-ess-skin="candidate-a"/, p);
    assert.match(html, /candidate-a\/ess-a-theme\.css/, p);
    assert.match(html, /logo-horizontal-tight\.png/, p);
  }
  assert.match(readFileSync(new URL('index.html', root), 'utf8'), /Your car\.<br><em>Your experiment\.<\/em>/);
  assert.match(readFileSync(new URL('experience/index.html', root), 'utf8'), /href="#performance" data-view="performance"/);
});
