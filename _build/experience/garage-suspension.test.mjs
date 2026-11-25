import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../../experience/catalog-data.mjs';
import { browseIds, vehicles } from '../../experience/vehicles.mjs';
import { findVehicles } from '../../experience/catalog.mjs';
import { layouts, linkLayout, solveRearLinks } from '../../experience/rear-links.mjs';
import { cleanSetup, newSetup, resolve, straightLine, tractiveLimit, driveForce, tractionReadout, usableSetup } from '../../experience/models.mjs';
import { example, getGarage, getActive, removeFromGarage, useConfig, saveToGarage, shareFragment, readFragment } from '../../experience/configuration.mjs';

const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('every catalog reference has a browse identity and old links still keep their IDs', () => {
  assert.equal(Object.keys(catalog).length, 50);
  assert.equal(browseIds.length, 52);
  assert.ok(browseIds.includes('firebird'));
  assert.equal(browseIds.filter(id => vehicles[id].ref === vehicles.firebird.ref).length, 1);
  assert.ok(findVehicles({query:'Civic Type R',layout:'FF',make:'Honda'}).length);
  assert.deepEqual(findVehicles({query:'Civic Type R',layout:'AWD'}), []);
  assert.ok(findVehicles({generation:'Fox body'}).length);
  assert.ok(findVehicles({category:'Pickup / truck'}).length);
});

test('a blank garage car remains editable and can never run an invented estimate', () => {
  const draft = newSetup('custom');
  assert.ok(usableSetup(draft));
  assert.equal(resolve(draft).weight, null);
  assert.ok(straightLine(resolve(draft)).issue);
  const donor = resolve(newSetup('camaro'));
  const keys = ['weight','front','wheelbase','hp','hpRpm','torque','torqueRpm','redline','gears','finalDrive','diameter','drivetrain','transmission'];
  draft.base = Object.fromEntries(keys.map(key => [key,donor[key]]));
  assert.ok(cleanSetup(draft));
  assert.ok(straightLine(resolve(draft)).finish.t);
});

test('engine and automatic choices remain independent and round trip in an editable comparison', () => {
  const state = example();
  state.a.components = {engine:'ls1gto', transmission:'gm4l60'};
  state.aMode = 'after';
  const stored = readFragment(shareFragment(state)).state.a;
  const original = resolve(stored,false);
  const v = resolve(stored);
  assert.equal(original.transmission, 'manual');
  assert.notEqual(v.hp, original.hp);
  assert.equal(v.transmission, 'automatic');
  assert.deepEqual(v.gears, [3.06,1.63,1,.7]);
  assert.ok(straightLine(v).finish.t);
  const available = tractionReadout(v);
  assert.ok(available.demand > 0 && available.limit > 0 && available.mphInFirst > 0);
  assert.notEqual(driveForce(v,0,0,true), driveForce({...v, transmission:'manual'},0,0,true));
  delete stored.components.engine;
  assert.equal(resolve(stored).hp, original.hp);
  assert.equal(resolve(stored).transmission, 'automatic');
});

test('front, rear and ideal AWD traction use the correct dynamic load sign', () => {
  const v = resolve(newSetup('camaro'));
  const h = v.cg / v.wheelbase;
  near(tractiveLimit({...v, drivetrain:'FWD'}, 0), v.grip * v.frontLb / (1 + v.grip * h));
  near(tractiveLimit({...v, drivetrain:'RWD'}, 0), v.grip * v.rearLb / (1 - v.grip * h));
  near(tractiveLimit({...v, drivetrain:'AWD'}, 0), v.grip * v.weight);
});

test('garage stores variants independently from active and shared setups', () => {
  const memory = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{
    getItem: key => memory.get(key), setItem: (key,value) => memory.set(key,value),
  }});
  try {
    const setup = newSetup('camaro');
    saveToGarage(setup, 'before');
    setup.tune.finalDrive = 4.1;
    saveToGarage(setup, 'after');
    saveToGarage(setup, 'after');
    assert.equal(getGarage().length, 2);
    assert.equal(getGarage()[1].setup.tune.finalDrive, undefined);
    assert.equal(getActive(), null);
    useConfig(getGarage()[0].setup, 'after');
    readFragment(shareFragment(example()));
    removeFromGarage(getGarage()[0].key);
    assert.equal(getGarage().length, 1);
    assert.equal(getActive().setup.tune.finalDrive, 4.1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('reference launch geometry returns exact level poses and independently checked instant centers', () => {
  for (const id of Object.keys(layouts)) {
    const r = solveRearLinks(linkLayout(id), {wheelbase:108,cg:20});
    near(r.residual,0);
    assert.deepEqual(r.pose, [0,0,0,0]);
    assert.ok(Number.isFinite(r.antiSquat));
  }
  const r = solveRearLinks(linkLayout('three'), {wheelbase:108,cg:20});
  near(r.center[0], 86.6);
  near(r.center[1], 21.825);
  near(r.antiSquat, 100 * (21.825/86.6) * 108 / 20);
  assert.deepEqual(solveRearLinks(linkLayout('torque')).center, [40,16]);
});

test('articulation differentiates a redundant four-link from locating three-link and triangulated layouts', () => {
  const state = {heave:2,roll:8,wheelbase:108,cg:20};
  for (const id of ['three','triangulated','torque']) {
    const r = solveRearLinks(linkLayout(id), state);
    assert.equal(r.level, 'green');
    assert.ok(r.residual < 1e-5);
    assert.equal(r.antiSquat, null);
    assert.notEqual(r.pose[1], 0);
  }
  const parallel = solveRearLinks(linkLayout('parallel'), state);
  assert.equal(parallel.level, 'red');
  assert.ok(parallel.residual > .08);
});

test('moving a mounting point changes the geometry and rejects too-short links', () => {
  const state = {heave:1,wheelbase:108,cg:20};
  const links = linkLayout('three');
  const r = solveRearLinks(links, state);
  links[2].chassis[2] += 2;
  assert.notEqual(solveRearLinks(links, state).antiSquat, r.antiSquat);
  links[0].chassis = [...links[0].axle];
  assert.equal(solveRearLinks(links, state).level, 'red');
});
