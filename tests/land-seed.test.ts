import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLandWorld,
  LAND_SEED,
  LAND_NESTS,
  GROVE_FOOD_ID,
  interactLand,
  stepLand,
  seedPlot,
  applyLandSeed,
} from '../app/game/land.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { colonyFromLand, colonyInteract } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { commandCompanions } from '../app/game/companions.ts';
const idle = { x: 0, y: 0, dash: false };
function picked() {
  const w = createLandWorld();
  w.foods = [];
  w.land!.creatures = [];
  Object.assign(w.player, LAND_SEED);
  assert.ok(interactLand(w));
  return w;
}
function planted() {
  const w = picked();
  w.food = 2;
  w.land!.nests.push(1);
  Object.assign(w.player, LAND_NESTS[1]);
  assert.ok(applyLandSeed(w, 'plant'));
  return w;
}
function wait(w: ReturnType<typeof createLandWorld>, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) stepLand(w, idle, 0.05);
}
void test('rare discovery requires proximity; picking and eating pay once and exclude planting', () => {
  const w = createLandWorld();
  w.foods = [];
  w.land!.creatures = [];
  assert.equal(w.land!.seedPod!.stage, 'unseen');
  assert.equal(applyLandSeed(w, 'eat'), false);
  Object.assign(w.player, { x: LAND_SEED.x - 200, y: LAND_SEED.y });
  stepLand(w, idle, 0.05);
  assert.equal(w.land!.seedPod!.stage, 'seen');
  assert.equal(interactLand(w), false);
  Object.assign(w.player, LAND_SEED);
  w.mode = 'paused';
  assert.equal(interactLand(w), false);
  w.mode = 'running';
  assert.ok(interactLand(w));
  assert.equal(interactLand(w), false);
  const food = w.food,
    total = w.totalFood;
  assert.ok(applyLandSeed(w, 'eat'));
  assert.equal(w.food, food + 6);
  assert.equal(w.totalFood, total + 6);
  assert.equal(applyLandSeed(w, 'eat'), false);
  assert.equal(applyLandSeed(w, 'plant'), false);
  assert.equal(w.food, food + 6);
});
void test('planting needs a built nest and resources; watering costs moisture and respects distance, pause and cooldown', () => {
  const w = picked();
  w.food = 2;
  assert.equal(applyLandSeed(w, 'plant'), false);
  Object.assign(w.player, LAND_NESTS[1]);
  assert.equal(applyLandSeed(w, 'plant'), false);
  w.land!.nests.push(1);
  w.food = 1;
  assert.equal(applyLandSeed(w, 'plant'), false);
  w.food = 2;
  assert.ok(applyLandSeed(w, 'plant'));
  assert.equal(w.food, 0);
  assert.equal(applyLandSeed(w, 'eat'), false);
  assert.equal(applyLandSeed(w, 'plant'), false);
  w.land!.moisture = 19;
  assert.equal(applyLandSeed(w, 'water'), false);
  w.land!.moisture = 20;
  w.mode = 'paused';
  assert.equal(applyLandSeed(w, 'water'), false);
  w.mode = 'running';
  Object.assign(w.player, LAND_SEED);
  assert.equal(applyLandSeed(w, 'water'), false);
  Object.assign(w.player, LAND_NESTS[1]);
  assert.ok(applyLandSeed(w, 'water'));
  assert.equal(w.land!.moisture, 5);
  assert.equal(w.land!.seedPod!.waters, 1);
  assert.equal(applyLandSeed(w, 'water'), false);
  assert.equal(w.foods.length, 0);
});
void test('three paced waterings grow four actual regenerating foods, without changing ordinary food timing', () => {
  const w = planted();
  for (let i = 0; i < 3; i++) {
    assert.ok(applyLandSeed(w, 'water'));
    if (i < 2) wait(w, 6.1);
  }
  assert.equal(w.foods.length, 4);
  assert.equal(applyLandSeed(w, 'water'), false);
  const plot = seedPlot(w)!;
  Object.assign(w.player, w.foods[0]);
  const before = w.food;
  stepLand(w, idle, 0.05);
  assert.ok(w.food > before);
  assert.equal(w.foods[0].cooldown, 32);
  Object.assign(w.player, { x: plot.x - 200, y: plot.y });
  w.foods.push({ id: 3, x: 80, y: 80, cooldown: 32, rich: false });
  wait(w, 16.1);
  assert.equal(w.foods[0].cooldown, 0);
  assert.ok(w.foods[4].cooldown > 15);
  assert.equal(w.foods.filter((f) => f.id >= GROVE_FOOD_ID).length, 4);
});
void test('mid-growth saves keep water count and cooldown; old saves work without the discovery field', () => {
  const w = planted();
  assert.ok(applyLandSeed(w, 'water'));
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const result = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  const restored = result.save.campaign.journey;
  assert.deepEqual(restored.land!.seedPod, w.land!.seedPod);
  restored.mode = 'running';
  assert.equal(applyLandSeed(restored, 'water'), false);
  wait(restored, 6.1);
  assert.ok(applyLandSeed(restored, 'water'));
  assert.equal(restored.land!.seedPod!.waters, 2);
  assert.equal(restored.foods.length, 0);
  delete session.journey.getWorld().land!.seedPod;
  assert.equal(decodeSave(encodeSave(session.snapshot('journey'))).kind, 'ok');
});
void test('a companion harvests grown fruit and delivers it physically; a mature save cannot grow a second reward', () => {
  const w = planted();
  for (let i = 0; i < 3; i++) {
    assert.ok(applyLandSeed(w, 'water'));
    if (i < 2) wait(w, 6.1);
  }
  const plot = seedPlot(w)!;
  Object.assign(w.player, { x: plot.x - 240, y: plot.y });
  const friend = createLandWorld().land!.creatures[0];
  Object.assign(friend, { x: w.player.x + 40, y: w.player.y, joined: true });
  w.land!.creatures = [friend];
  const food = w.food;
  assert.ok(commandCompanions(w));
  assert.ok(friend.targetFood! >= GROVE_FOOD_ID);
  let carried = false;
  for (let i = 0; i < 200; i++) {
    stepLand(w, idle, 0.05);
    carried ||= friend.carrying > 0;
  }
  assert.ok(carried);
  assert.equal(w.food, food + 1);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const result = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  const restored = result.save.campaign.journey;
  restored.mode = 'running';
  assert.equal(applyLandSeed(restored, 'water'), false);
  assert.deepEqual(restored.foods, w.foods);
  assert.equal(restored.food, w.food);
});
void test('only a mature grove brings a harvestable colony patch; either decision reaches the next chapter record', () => {
  for (const route of ['eaten', 'young', 'grown'] as const) {
    const w = route === 'eaten' ? picked() : planted();
    if (route === 'eaten') assert.ok(applyLandSeed(w, 'eat'));
    else
      for (let i = 0; i < (route === 'grown' ? 3 : 1); i++) {
        assert.ok(applyLandSeed(w, 'water'));
        wait(w, 6.1);
      }
    w.mode = 'won';
    const before = structuredClone(w);
    const c = colonyFromLand(w)!;
    assert.deepEqual(w, before);
    const grove = c.patches.find((p) => p.id === 12);
    assert.equal(!!grove, route === 'grown');
    assert.equal(c.seedLegacy, route === 'young' ? undefined : route);
    if (grove) {
      c.mode = 'running';
      Object.assign(c.player, grove);
      assert.ok(colonyInteract(c));
      assert.equal(c.player.carrying, 'food');
      assert.equal(c.player.load, 1);
      assert.ok(grove.cooldown > 0);
    }
    c.mode = 'won';
    c.shelter = true;
    c.growth = 100;
    const t = tribeFromColony(c)!;
    assert.equal(t.choices.includes('seed:' + route), route !== 'young');
  }
});
