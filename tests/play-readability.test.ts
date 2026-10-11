import { createOceanWorld } from './helpers/legacy-ocean.ts';
import { MIGRATION_STATIONS } from '../app/game/ocean-migration.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { companionSlot } from '../app/game/readability.ts';
import { glide } from '../app/game/motion.ts';
import { oceanTarget, OCEAN_LIGHT, OCEAN_NURSERY, OCEAN_HAVEN } from '../app/game/ocean.ts';
import { createLandWorld } from '../app/game/land.ts';
import { createShoreWorld } from '../app/game/shore.ts';
import { stepWorld, distance } from '../app/game/simulation.ts';

void test('ocean guidance follows required food, exploration and birth rather than optional spine discovery', () => {
  const w = createOceanWorld();
  assert.ok(!w.ocean!.discovered.includes('spine'));
  assert.ok(w.foods.includes(oceanTarget(w).point as (typeof w.foods)[number]));
  w.food = 10;
  w.player.energy = 100;
  assert.deepEqual(oceanTarget(w).point, {
    ...OCEAN_LIGHT,
    name: '透光浮游区',
    color: '#e4e3a0',
  });
  w.ocean!.visited.push('透光浮游区');
  assert.deepEqual(oceanTarget(w).point, OCEAN_NURSERY);
  w.ocean!.tier = 2;
  w.food = 8;
  assert.deepEqual(oceanTarget(w).point, MIGRATION_STATIONS[0]);
  w.ocean!.migration!.station = 2;
  w.ocean!.migration!.route = 'hunt';
  assert.deepEqual(oceanTarget(w).point, OCEAN_HAVEN);
});
void test('four companions have separate trailing slots in every direction', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const p = { x: 500, y: 500, angle };
    const slots = Array.from({ length: 4 }, (_, i) => companionSlot(p, i));
    for (let i = 0; i < slots.length; i++) {
      assert.ok(distance(slots[i], p) > 100);
      for (let j = i + 1; j < slots.length; j++)
        assert.ok(distance(slots[i], slots[j]) > 70);
    }
  }
});

void test('actual shore and land followers separate after arriving at a stationary player', () => {
  for (const habitat of ['shore', 'land'] as const) {
    const w = habitat === 'shore' ? createShoreWorld() : createLandWorld();
    const actors =
      habitat === 'shore'
        ? w.shore!.creatures.filter((a) => a.role === 'ally')
        : w.land!.creatures.filter((a) => a.species !== 'hunter').slice(0, 4);
    for (const actor of actors) {
      actor.joined = true;
      actor.x = w.player.x - 65;
      actor.y = w.player.y;
    }
    for (let i = 0; i < 240; i++)
      stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 60);
    assert.equal(w.mode, 'running');
    assert.ok(actors.length >= 2);
    for (let i = 0; i < actors.length; i++)
      for (let j = i + 1; j < actors.length; j++)
        assert.ok(
          distance(actors[i], actors[j]) > 45,
          `${habitat}: followers must not occupy one slot`,
        );
  }
});
void test('land obeys analog slowing near a click target instead of moving at full speed', () => {
  const travel = (strength: number) => {
    const w = createLandWorld();
    const x = w.player.x;
    for (let i = 0; i < 24; i++)
      stepWorld(w, { x: strength, y: 0, dash: false }, 1 / 120);
    return w.player.x - x;
  };
  const full = travel(1),
    gentle = travel(0.25);
  assert.ok(full > 5);
  assert.ok(gentle > 0 && gentle < full * 0.4);
});
void test('direction reversal crosses zero within 30ms and release loses momentum within 75ms', () => {
  const p = { x: 0, y: 0, vx: 180, vy: 0 };
  glide(p, -180, 0, 0.03, true);
  assert.ok(p.vx < 0);
  p.vx = 180;
  glide(p, 0, 0, 0.075, false);
  assert.ok(p.vx < 10);
});
