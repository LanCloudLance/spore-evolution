import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  stepWorld,
  reproduce,
  distance,
  NURSERY,
  HAVEN,
} from '../app/game/simulation.ts';

void test('a foraging player can reproduce twice and reach the haven through real movement', () => {
  const w = createWorld(23);
  w.mode = 'running';
  let frames = 0,
    waypoint = 0;
  const route = [{ x: 380, y: 160 }, { x: 2120, y: 160 }, HAVEN];
  while (w.mode === 'running' && frames < 60 * 420) {
    const needFood =
      w.generation < 3
        ? w.food < 8 || w.player.energy < 55
        : w.player.energy < 35;
    let target = { x: NURSERY.x, y: NURSERY.y };
    if (needFood) {
      const food = w.foods
        .filter((f) => f.cooldown === 0)
        .sort((a, b) => {
          const score = (f: typeof a) =>
            distance(w.player, f) +
            w.predators.reduce(
              (sum, p) => sum + Math.max(0, 200 - distance(p, f)) * 2,
              0,
            );
          return score(a) - score(b);
        })[0];
      if (food) target = food;
    } else if (w.generation === 3) {
      if (
        distance(w.player, route[waypoint]) < 45 &&
        waypoint < route.length - 1
      )
        waypoint++;
      target = route[waypoint];
    }
    if (
      w.generation < 3 &&
      w.food >= 8 &&
      w.player.energy >= 50 &&
      distance(w.player, NURSERY) < NURSERY.radius - 15
    ) {
      assert.ok(reproduce(w, w.generation === 1 ? 'flagellum' : 'shell'));
    }
    const dx = target.x - w.player.x,
      dy = target.y - w.player.y,
      d = Math.max(1, Math.hypot(dx, dy));
    const danger = w.predators.some(
      (p) => distance(w.player, p) < 145 && p.stun === 0,
    );
    stepWorld(
      w,
      { x: dx / d, y: dy / d, dash: danger && w.player.energy > 20 },
      1 / 60,
    );
    frames++;
  }
  assert.equal(
    w.mode,
    'won',
    `Ended ${w.mode}, ${w.reason}, generation ${w.generation}, energy ${w.player.energy}, food ${w.food}, at ${w.player.x},${w.player.y}`,
  );
  assert.equal(w.history.length, 3);
  assert.ok(w.totalFood >= 16);
  assert.deepEqual(w.traits, ['flagellum', 'shell']);
});
