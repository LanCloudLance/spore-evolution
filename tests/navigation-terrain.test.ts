import test from 'node:test';
import assert from 'node:assert/strict';
import { guideNavigation } from '../app/game/navigation.ts';
import { createLandWorld, LAND_ROCKS } from '../app/game/land.ts';
import { stepWorld, distance } from '../app/game/simulation.ts';
import { worldBodyPose, trunkCircles } from '../app/game/body-geometry.ts';
void test('click navigation goes around a real rock with a wide body rather than timing out against it', () => {
  const w = createLandWorld(71);
  w.form = 'strider';
  w.land!.body.length = 1.6;
  w.land!.body.width = 1.3;
  w.land!.creatures = [];
  w.foods = [];
  Object.assign(w.player, { x: 570, y: 960, energy: 175 });
  const n = {
    target: { x: 1050, y: 960 },
    last: { x: 570, y: 960 },
    stalled: 0,
  };
  const clearance = Math.max(
    ...trunkCircles(worldBodyPose(w)).map(
      (c) => distance(c, w.player) + c.radius,
    ),
  );
  let travel = 0;
  for (let i = 0; i < 1500 && distance(w.player, n.target) > 18; i++) {
    const input = guideNavigation(n, w.player, 1 / 60, {
      obstacles: LAND_ROCKS,
      clearance,
    });
    assert.ok(input, 'navigation stopped at the rock');
    const before = { x: w.player.x, y: w.player.y };
    stepWorld(w, { ...input, dash: false }, 1 / 60);
    travel += distance(before, w.player);
  }
  assert.ok(distance(w.player, n.target) <= 18);
  assert.ok(travel > 500, 'route should go around the obstacle');
  assert.equal(w.mode, 'running');
});
