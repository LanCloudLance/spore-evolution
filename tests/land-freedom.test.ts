import test from 'node:test';
import assert from 'node:assert/strict';
import * as land from '../app/game/land.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';

// Boundary fixtures isolate requirements; continuous routes are tested separately.
function ready() {
  const w = land.createLandWorld(71);
  w.land!.tier = 1;
  w.land!.nests = [0];
  w.land!.discovered = ['fern'];
  w.land!.visited = ['蕨叶聚落', '日光草甸'];
  w.form = 'strider';
  w.food = 25;
  w.foods = [];
  return w;
}
void test('a tended garden can settle without companions or kills, but unharvested seedlings cannot', () => {
  const w = ready();
  w.land!.seedPod = { stage: 'planted', nest: 0, waters: 3, cooldown: 0 };
  Object.assign(w.player, land.LAND_NESTS[2]);
  assert.equal(land.interactLand(w), false);
  w.land!.groveHarvests = [1000, 1001];
  assert.equal(land.interactLand(w), true);
  assert.equal(w.mode, 'won');
  assert.equal(w.food, 13);
  assert.equal(land.landFriends(w), 0);
  assert.equal(w.land!.hunts, 0);
  assert.deepEqual(colonyFromLand(w)!.history.at(-1)!.landWays, ['garden']);
});
void test('garden records come only from distinct mature fruit pickups and survive restoration', () => {
  const w = ready();
  w.land!.seedPod = { stage: 'planted', nest: 0, waters: 3, cooldown: 0 };
  w.land!.creatures = [];
  w.foods = [1000, 1001].map((id) => ({
    id,
    x: w.player.x,
    y: w.player.y,
    rich: false,
    cooldown: 0,
  }));
  stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 60);
  assert.deepEqual(w.land!.groveHarvests, [1000, 1001]);
  w.foods.forEach((f) => (f.cooldown = 0));
  stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 60);
  assert.deepEqual(w.land!.groveHarvests, [1000, 1001]);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const loaded = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(loaded.kind, 'ok');
  if (loaded.kind === 'ok')
    assert.deepEqual(
      loaded.save.campaign.journey.land!.groveHarvests,
      [1000, 1001],
    );
});
void test('exploration focus selects an actual destination without awarding progress or changing anatomy', () => {
  assert.equal(
    typeof land.chooseLandFocus,
    'function',
    'land has no player-selected direction',
  );
  const w = ready(),
    before = structuredClone(w);
  assert.ok(land.chooseLandFocus(w, 'wander', 1));
  const goal = land.landTarget(w);
  assert.equal(goal.action, 'explore');
  assert.deepEqual(goal.point, land.LAND_AREAS[1]);
  assert.equal(w.food, before.food);
  assert.deepEqual(w.land!.body, before.land!.body);
  assert.deepEqual(w.land!.visited, before.land!.visited);
  w.mode = 'paused';
  assert.equal(land.chooseLandFocus(w, 'garden'), false);
});
void test('returning to a settled land keeps the world alive without recharging a nest or losing chapter entry', () => {
  assert.equal(
    typeof land.continueLandLife,
    'function',
    'settlement stops the world',
  );
  const w = ready();
  w.land!.hunts = 3;
  Object.assign(w.player, land.LAND_NESTS[2]);
  assert.ok(land.interactLand(w));
  const food = w.food,
    gen = w.generation,
    body = structuredClone(w.land!.body);
  assert.ok(land.continueLandLife(w));
  assert.equal(w.mode, 'running');
  const time = w.time;
  stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 60);
  assert.ok(w.time > time);
  assert.equal(w.food, food);
  assert.equal(w.generation, gen);
  assert.deepEqual(w.land!.body, body);
  assert.equal(land.continueLandLife(w), false);
  assert.ok(land.revisitLandSettlement(w));
  assert.equal(w.food, food);
  assert.ok(colonyFromLand(w));
  assert.equal(w.history.filter((a) => a.generation === gen).length, 1);
});
void test('unsettled or dead life cannot forge chapter entry; arbitrary focus and harvest data are rejected', () => {
  assert.equal(typeof land.revisitLandSettlement, 'function');
  const w = ready();
  assert.equal(land.revisitLandSettlement(w), false);
  w.land!.nests.push(2);
  w.mode = 'dead';
  assert.equal(land.revisitLandSettlement(w), false);
  const session = createCampaignSession();
  const save = session.snapshot('journey');
  Object.assign(save.journey, w, { mode: 'paused' });
  save.journey.land!.focus = 'future' as never;
  assert.throws(() => encodeSave(save));
  delete save.journey.land!.focus;
  save.journey.land!.groveHarvests = [1000, 1000];
  assert.throws(() => encodeSave(save));
});
void test('later land generations can change locomotion while retaining their garden, nest and existing organ, with one birth cost', () => {
  const w = ready();
  w.land!.tier = 2;
  w.land!.organ = 'plates';
  w.land!.discovered = ['fern', 'grazer'];
  w.land!.seedPod = { stage: 'planted', nest: 0, waters: 3, cooldown: 0 };
  w.land!.groveHarvests = [1000, 1001];
  w.food = 40;
  w.land!.creatures = [];
  const gen = w.generation,
    body = structuredClone(w.land!.body);
  assert.equal(land.landEvolutionGate(w), '');
  assert.ok(land.evolveLand(w, 'stalker'));
  assert.equal(w.generation, gen + 1);
  assert.equal(w.food, 30);
  assert.equal(w.form, 'stalker');
  assert.equal(w.land!.organ, 'plates');
  assert.equal(w.land!.tier, 2);
  assert.deepEqual(w.land!.body, body);
  assert.deepEqual(w.land!.nests, [0]);
  assert.deepEqual(w.land!.groveHarvests, [1000, 1001]);
  assert.equal(land.evolveLand(w, 'strider'), false);
  assert.equal(w.food, 30);
  stepWorld(w, { x: 0, y: 0, dash: false }, w.evolution!.duration + 0.1);
  assert.ok(land.evolveLand(w, 'strider'));
  assert.equal(w.generation, gen + 2);
  assert.equal(w.food, 20);
  assert.equal(w.history.at(-1)!.form, 'stalker');
  assert.equal(w.land!.organ, 'plates');
  assert.equal(w.land!.seedPod.waters, 3);
});
void test('revising a body does not bypass the separate observation requirement for new organs', () => {
  const w = ready();
  assert.equal(land.landEvolutionGate(w), '');
  assert.equal(land.evolveLand(w, 'plates'), false);
  assert.equal(w.food, 25);
  assert.ok(land.evolveLand(w, 'stalker'));
  assert.equal(w.food, 15);
});
