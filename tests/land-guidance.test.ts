import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld, landTarget, LAND_NESTS } from '../app/game/land.ts';
void test('hungry start points at an available fruit instead of the empty nest', () => {
  const w = createLandWorld(37),
    target = landTarget(w);
  assert.ok(
    w.foods.some(
      (f) =>
        f.cooldown === 0 && f.x === target.point.x && f.y === target.point.y,
    ),
  );
  assert.match(target.label, /6/);
});
void test('strider guidance finds an actual unbonded neighbor before the meadow', () => {
  const w = createLandWorld(37);
  w.land!.nests = [0];
  w.land!.tier = 1;
  w.form = 'strider';
  w.land!.discovered = ['fern'];
  w.land!.visited = ['蕨叶聚落'];
  w.food = 12;
  const target = landTarget(w);
  assert.ok(
    w.land!.creatures.some(
      (c) =>
        !c.joined &&
        c.species !== 'hunter' &&
        c.x === target.point.x &&
        c.y === target.point.y,
    ),
  );
  assert.match(target.label, /结伴|呼唤|信任/);
});
void test('enough food guides directly to the actual nest interaction', () => {
  const w = createLandWorld();
  w.food = 6;
  assert.deepEqual(landTarget(w).point, LAND_NESTS[0]);
});
void test('normal hunting guidance chooses a safe meal over a fern beside a newly added ambusher', () => {
  const w = createLandWorld(37);
  w.form = 'stalker';
  w.land!.tier = 1;
  w.land!.nests = [0];
  w.land!.discovered = ['fern'];
  w.land!.focus = 'hunt';
  const fern = w.land!.creatures.find((c) => c.species === 'fern')!;
  const ambusher = w.land!.creatures.find((c) => c.species === 'dusk-stalker')!;
  Object.assign(fern, { x: w.player.x + 80, y: w.player.y });
  Object.assign(ambusher, { x: fern.x + 15, y: fern.y });
  ambusher.home = { x: ambusher.x, y: ambusher.y };
  const target = landTarget(w);
  assert.notEqual(target.point, fern);
  assert.notEqual(target.point, ambusher);
});
void test('initial hunting guidance leaves space for the pounce landing outside a hunter territory', () => {
  const w = createLandWorld(41);
  w.form = 'stalker';
  w.land!.tier = 1;
  w.land!.nests = [0];
  w.land!.discovered = ['fern'];
  w.land!.focus = 'hunt';
  const fern = w.land!.creatures.find((c) => c.species === 'fern')!;
  const hunter = w.land!.creatures.find((c) => c.species === 'hunter')!;
  Object.assign(fern, { x: w.player.x + 100, y: w.player.y });
  Object.assign(hunter, { x: fern.x + 310, y: fern.y });
  hunter.home = { x: hunter.x, y: hunter.y };
  assert.notEqual(landTarget(w).point, fern);
});
