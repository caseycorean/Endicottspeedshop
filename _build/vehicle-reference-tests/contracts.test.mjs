import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFragment } from '../../experience/configuration.mjs';
import { validateFeedback } from '../../experience/feedback-data.mjs';
import { eventParameters } from '../../experience/measurement.mjs';
import { receive } from '../feedback/receiver.mjs';

const runtime = JSON.parse(execFileSync('node', ['_build/reference-inputs.mjs'], {encoding:'utf8'}));
test('all 53 curated references round-trip exact builds, comparison lanes and tool routes', () => {
  assert.equal(Object.keys(runtime.fixtures).length, 53);
  for (const [id, f] of Object.entries(runtime.fixtures)) {
    for (const [name, view] of Object.entries({build:'build', strip:'compare', oval:'compare', tools:'tools', performance:'performance', suspension:'suspension'})) {
      const result = readFragment(f[name]);
      assert.equal(result.view, view, id + '/' + name);
      assert.equal(result.state.a.id, id);
      assert.equal(result.state.b.id, f.b);
      assert.notEqual(result.state.a.id, result.state.b.id);
      if (name === 'strip' || name === 'oval') assert.equal(result.state.event, name);
    }
  }
  const ssp = Object.entries(runtime.fixtures).find(([id]) => id.includes('ssp'))[1];
  assert.match(ssp.label, /SSP/);
  assert.equal(runtime.history.length, 75);
});
test('measurement rejects arbitrary data and preserves valid enums only', () => {
  const params = eventParameters({capability:'oval', outcome:'saved', vehicle:'Owner Truck', page_location:'http://site/#custom', other:'private'});
  assert.deepEqual(params, {capability:'oval',outcome:'saved'});
  assert.deepEqual(eventParameters({capability:'My Custom Acme',outcome:42,entrance:'spammed'}), {});
});
test('feedback forbids serialized configurations, query fragments and unexpected fields', () => {
  const ok = {kind:'correction',note:'Take a closer look at the tire sizing.',website:'',page:'/vehicles/a-b-c/'};
  assert.deepEqual(validateFeedback(ok), {kind:ok.kind,note:ok.note,page:ok.page});
  assert.equal(validateFeedback({...ok,page:'/experience/#v2/build/x'}), null);
  assert.equal(validateFeedback({...ok,note:'Our setup is #v2/build/asdf'}), null);
  assert.equal(validateFeedback({...ok,website:'foo'}), null);
  assert.equal(validateFeedback({...ok,rawSetup:{name:'Owner Truck'}}), null);
  assert.equal(validateFeedback({...ok,page:'/vehicles/sx-historic-only/'}), null);
});
test('receiver enforces origin, rate and size, sends a literal private issue, and reports transport failure', async () => {
  const env = {SITE_ORIGIN:'https://test.example',LIMIT:{limit:async () => ({success:true})},
    GITHUB_TOKEN:'example-test-token', FEEDBACK_REPO:'my-org/private-queue'};
  const make = (value, headers = {}) => new Request('https://test.example/api/feedback', {
    method:'POST', headers:{'Origin':'https://test.example','Content-Type':'application/json',
      'CF-Connecting-IP':'127.0.0.1',...headers}, body:JSON.stringify(value),
  });
  const entry = {kind:'suggestion',note:'literal ```js @bot <img src=x> must stay in the code block',website:''};
  let count = 0;
  const mock = async (url, req) => {
    count++;
    assert.equal(url, 'https://api.github.com/repos/my-org/private-queue/issues');
    assert.equal(req.redirect, 'error');
    const body = JSON.parse(req.body);
    assert.deepEqual(body.labels,['visitor-feedback']);
    const literal = body.body.split('\n\n```json\n')[1].split('\n```')[0];
    assert.equal(JSON.parse(literal).note, entry.note);
    assert.ok(!literal.includes('`'));
    return new Response(null,{status:201});
  };
  assert.equal((await receive(make(entry),env,mock)).status,204);
  assert.equal((await receive(make(entry, {Origin:'https://other.example'}),env,mock)).status,403);
  assert.equal((await receive(make(entry),{...env,LIMIT:{limit:async()=>({success:false})}},mock)).status,429);
  assert.equal((await receive(make({...entry,note:'x'.repeat(7000)}),env,mock)).status,400);
  assert.equal((await receive(make(entry),env,async()=>new Response(null,{status:401}))).status,503);
  assert.equal(count,1);
});
