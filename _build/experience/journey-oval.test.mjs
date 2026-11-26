// Claude sprint 26 Nov 2026: Next-experiment cards follow the active test (owner review, Compare on the oval).
import test from 'node:test';
import assert from 'node:assert/strict';
import { experiments, labJourneyHtml } from '../../experience/journey.mjs';
import { newSetup, resolve } from '../../experience/models.mjs';
import { ovalLap } from '../../experience/oval.mjs';

for (const id of ['firebird', 'mustang', 'corvette']) {
  test(`${id}: oval experiments are lap runs, never drag-strip ideas, and lowering the CG helps`, () => {
    const setup = newSetup(id);
    const { before, list } = experiments('lab-compare', setup, undefined, { event: 'oval' });
    assert.ok(list.length >= 2);
    assert.ok(Math.abs(before.et - ovalLap(resolve(setup, true)).lap) < 1e-9, 'before is the flying lap');
    assert.ok(!list.some(x => x.perf?.surface === 'preppedStrip'), 'no prepped-strip suggestion on the oval');
    for (const x of list) assert.ok(Math.abs(x.after.et - ovalLap(resolve(x.setup, true)).lap) < 1e-9, x.title);
    const cg = list.find(x => x.gen === 'cg');
    assert.ok(cg && cg.dEt < -.01, `CG −2 in lap change ${cg?.dEt}`);
    assert.match(cg.what, /outside tires/);
    for (let i = 1; i < list.length; i++) assert.ok((list[i - 1].dEt ?? 0) <= (list[i].dEt ?? 0), 'ranked by lap gain');
    const html = labJourneyHtml('lab-compare', setup, 'Car A', { event: 'oval' });
    assert.match(html, /Flying lap/);
    assert.doesNotMatch(html, /Quarter mile|prepped strip/i);
    assert.match(html, /data-lab-event="oval"/);
  });
}

test('strip experiments are unchanged: quarter-mile ranking with the launch ideas', () => {
  const setup = newSetup('firebird');
  const strip = experiments('lab-compare', setup);
  assert.ok(strip.list.every(x => x.before.lap === null));
  assert.match(labJourneyHtml('lab-compare', setup, 'Car A'), /Quarter mile/);
});
