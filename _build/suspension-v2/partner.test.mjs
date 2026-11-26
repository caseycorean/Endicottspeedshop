import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerOf, liveLinks, defaultEnd, cleanState } from '../../experience/suspension-v2/model.mjs';
test('mirror twins: lower and upper pairs; centre upper and Panhard have none; mirroring is the default', () => {
  const l = liveLinks(defaultEnd('fourLinkParallel'));
  assert.equal(l[partnerOf(l, 0)].name, 'Right lower link');
  assert.equal(partnerOf(l, l.findIndex(x => x.group === 'lateral')), -1);
  assert.equal(partnerOf(liveLinks(defaultEnd('threeLink')), 2), -1);
  assert.equal(defaultEnd('threeLink').sym, true);
  assert.equal(cleanState({ rear: { arch: 'threeLink', sym: false } }).rear.sym, false);
});
