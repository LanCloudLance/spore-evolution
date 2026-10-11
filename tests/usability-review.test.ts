import test from 'node:test';
import assert from 'node:assert/strict';
import * as abilities from '../app/game/tidal/abilities.ts';
import * as learning from '../app/game/lineage-learning.ts';
import * as controls from '../app/game/dash-input.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { createWorld, stepWorld } from '../app/game/simulation.ts';
import { createLandWorld } from '../app/game/land.ts';
import * as features from '../app/game/land-features.ts';

void test('tidal skill failures tell the player about energy and cooldown without changing resources', () => {
  assert.equal(typeof abilities.tidalActionGate, 'function');
  const w = createOceanWorld(27);
  w.mode = 'running';
  w.player.energy = 4;
  assert.match(abilities.tidalActionGate(w, 'form-skill')!, /14.*能量/);
  abilities.applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.match(w.notice, /14.*能量/);
  assert.equal(w.player.energy, 4);
  w.player.energy = 50;
  w.ocean!.skillCooldown = 2.2;
  assert.match(abilities.tidalActionGate(w, 'form-skill')!, /3.*秒/);
  abilities.applyTidalCommand(w, { id: 2, kind: 'slot0' });
  assert.match(w.notice, /3.*秒/);
  assert.equal(w.player.energy, 50);
});
void test('tidal toggles remain usable at low energy and blocked reserve or grasp explains its actual condition', () => {
  assert.equal(typeof abilities.tidalActionGate, 'function');
  const w = createOceanWorld(28);
  w.mode = 'running';
  w.ocean!.body.organs = { front: 'filter', left: 'reserve', right: 'grasp' };
  w.player.energy = 0;
  assert.equal(abilities.tidalActionGate(w, 'filter'), null);
  assert.match(abilities.tidalActionGate(w, 'reserve')!, /没有储能/);
  w.ocean!.tidal!.abilities.reserveEnergy = 20;
  assert.equal(abilities.tidalActionGate(w, 'reserve'), null);
  w.ocean!.tidal!.foods = [];
  assert.match(abilities.tidalActionGate(w, 'grasp')!, /靠近.*食物/);
  w.ocean!.tidal!.abilities.carriedId = 'test-carried';
  assert.equal(abilities.tidalActionGate(w, 'grasp'), null);
});
void test('learned skill readiness follows real learning, costs and cooldowns and gives keyboard feedback', () => {
  assert.equal(typeof learning.learnedSkillGate, 'function');
  const w = createWorld(29);
  w.mode = 'running';
  assert.match(learning.learnedSkillGate(w)!, /学会.*能力/);
  learning.learnFrom(w, 'pond:dart');
  learning.selectLearnedSkill(w, 'jet', 'pond');
  w.player.energy = 6;
  assert.match(learning.learnedSkillGate(w)!, /12.*能量/);
  stepWorld(w, { x: 0, y: 0, dash: false, learnedSkill: true }, 1 / 120);
  assert.match(w.notice, /12.*能量/);
  w.player.energy = 80;
  assert.equal(learning.learnedSkillGate(w), null);
  stepWorld(w, { x: 0, y: 0, dash: false, learnedSkill: true }, 1 / 120);
  assert.ok(w.learning!.active > 0);
  assert.match(learning.learnedSkillGate(w)!, /8.*秒/);
  const energy = w.player.energy;
  learning.stepLearning(w, true, 1 / 120);
  assert.equal(w.player.energy, energy);
  w.mode = 'paused';
  const paused = structuredClone(w);
  learning.stepLearning(w, true, 1 / 120);
  assert.deepEqual(w, paused);
});
void test('focus in buttons and settings stays with the interface while canvas input remains available', () => {
  assert.equal(typeof controls.blocksGameInput, 'function');
  const target = (tag: string) => ({
    isContentEditable: tag === 'editable',
    closest: (selector: string) => (selector.includes(tag) ? {} : null),
  });
  for (const tag of [
    'button',
    'summary',
    'input',
    'select',
    'textarea',
    'dialog',
    'editable',
  ])
    assert.equal(controls.blocksGameInput(target(tag)), true, tag);
  assert.equal(controls.blocksGameInput(target('canvas')), false);
  assert.equal(controls.blocksGameInput(null), false);
  assert.equal(controls.blocksGameInput(target('button'), 'w'), false);
  assert.equal(controls.blocksGameInput(target('button'), 'j'), false);
  assert.equal(controls.blocksGameInput(target('button'), ' '), true);
  assert.equal(controls.blocksGameInput(target('button'), 'arrowdown'), true);
  assert.equal(controls.blocksGameInput(target('input'), 'w'), true);
});
void test('land anatomy reports exact energy or nutrition needs and a paid cache can still be retrieved empty', () => {
  assert.equal(typeof features.landFeatureGate, 'function');
  const w = createLandWorld(30);
  w.mode = 'running';
  w.land!.features = ['leap', 'cache', 'scent'];
  w.land!.activeFeature = 'leap';
  w.player.energy = 10;
  assert.match(features.landFeatureGate(w)!, /16.*能量/);
  assert.equal(features.activateLandFeature(w), false);
  assert.match(w.notice, /16.*能量/);
  w.land!.activeFeature = 'scent';
  assert.equal(features.landFeatureGate(w), null);
  w.land!.activeFeature = 'cache';
  w.food = 0;
  assert.match(features.landFeatureGate(w)!, /3.*营养/);
  w.land!.cachedFood = 3;
  w.player.energy = 0;
  assert.equal(features.landFeatureGate(w), null);
  assert.equal(features.activateLandFeature(w), true);
  assert.equal(w.food, 3);
  assert.equal(w.player.energy, 0);
  assert.match(features.landFeatureGate(w)!, /2.*秒/);
});
void test('burrowing explains unsuitable ground and occupied shelters instead of a silent failed action', () => {
  assert.equal(typeof features.landFeatureGate, 'function');
  const w = createLandWorld(31);
  w.mode = 'running';
  w.land!.features = ['burrow'];
  w.land!.activeFeature = 'burrow';
  w.player.energy = 80;
  w.land!.camps = [{ x: w.player.x, y: w.player.y, life: 120 }];
  assert.match(features.landFeatureGate(w)!, /穴巢|湿地/);
  assert.equal(features.activateLandFeature(w), false);
  assert.match(w.notice, /穴巢|湿地/);
  assert.equal(w.player.energy, 80);
  assert.equal(w.land!.camps.length, 1);
});
void test('grasp skips food reserved for another animal and can pick the next eligible item', () => {
  const w = createOceanWorld(32);
  w.mode = 'running';
  w.ocean!.body.organs.front = 'grasp';
  w.ocean!.tidal!.abilities.slots = ['grasp', null];
  const reserved = {
    ...w.ocean!.tidal!.foods[0],
    id: 'reserved',
    x: w.player.x,
    y: w.player.y,
    state: 'available' as const,
    owner: null,
    reservedFor: 'neighbor',
  };
  w.ocean!.tidal!.foods = [reserved];
  assert.match(abilities.tidalActionGate(w, 'grasp')!, /靠近.*食物/);
  const available = {
    ...reserved,
    id: 'free',
    x: reserved.x + 20,
    reservedFor: undefined,
  };
  w.ocean!.tidal!.foods.push(available);
  assert.equal(abilities.tidalActionGate(w, 'grasp'), null);
  abilities.applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(w.ocean!.tidal!.abilities.carriedId, 'free');
  assert.equal(reserved.owner, null);
  assert.equal(reserved.reservedFor, 'neighbor');
  assert.equal(w.food, 0);
});
