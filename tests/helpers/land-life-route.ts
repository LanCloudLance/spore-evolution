import assert from 'node:assert/strict';
import { distance, stepWorld } from '../../app/game/simulation.ts';
import type { World, Vec } from '../../app/game/simulation.ts';
import {
  createLandWorld,
  LAND_NESTS,
  LAND_ROCKS,
  landEvolutionGate,
  evolveLand,
  interactLand,
} from '../../app/game/land.ts';

// Commands and real movement only. No resources, coordinates or milestones are assigned.
export function tick(w: World, target: Vec, stop = 20) {
  const p = w.player,
    desired = Math.atan2(target.y - p.y, target.x - p.x);
  let angle = desired,
    best = Infinity;
  for (let i = -12; i <= 12; i++) {
    const a = desired + (i * Math.PI) / 24,
      q = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 };
    let score = distance(q, target) + Math.abs(i) * 2;
    for (const rock of LAND_ROCKS)
      score += Math.max(0, rock.radius + 95 - distance(q, rock)) * 12;
    for (const c of w.land!.creatures)
      if (c.species === 'hunter' && c.respawn <= 0)
        score += Math.max(0, 245 - distance(q, c.home)) * 4;
    if (score < best) {
      best = score;
      angle = a;
    }
  }
  const close = distance(p, target) < stop;
  stepWorld(
    w,
    {
      x: close ? 0 : Math.cos(angle),
      y: close ? 0 : Math.sin(angle),
      dash: false,
      skill:
        w.form === 'strider' &&
        w.land!.creatures.some(
          (c) => c.species === 'hunter' && distance(c, p) < 200,
        ),
    },
    0.05,
  );
  assert.equal(
    w.mode,
    'running',
    `${w.reason}; energy ${p.energy}; moisture ${w.land!.moisture}`,
  );
}
export function move(w: World, target: Vec, stop = 25) {
  for (let i = 0; i < 3000 && distance(w.player, target) > stop; i++)
    tick(w, target, stop);
  assert.ok(
    distance(w.player, target) <= stop + 2,
    `stuck heading to ${target.x},${target.y} at ${w.player.x},${w.player.y}`,
  );
}
export function forage(w: World, need: number) {
  for (let i = 0; i < 8000 && w.food < need; i++) {
    const score = (f: Vec) =>
      distance(f, w.player) +
      w.land!.creatures.reduce(
        (sum, c) =>
          sum +
          (c.species === 'hunter'
            ? Math.max(0, 300 - distance(f, c.home)) * 5
            : 0),
        0,
      );
    const f = [...w.foods]
      .filter((f) => f.cooldown === 0)
      .sort((a, b) => score(a) - score(b))[0];
    tick(w, f ?? LAND_NESTS[0]);
  }
  assert.ok(w.food >= need);
}
export function prepare(seed: number) {
  const w = createLandWorld(seed);
  forage(w, 6);
  move(w, LAND_NESTS[0]);
  assert.ok(interactLand(w));
  const fern = w.land!.creatures.find((c) => c.species === 'fern')!;
  for (let i = 0; i < 3000 && !w.land!.discovered.length; i++)
    tick(w, fern, 90);
  assert.ok(w.land!.discovered.length);
  forage(w, 10);
  move(w, LAND_NESTS[0]);
  while (landEvolutionGate(w) && w.player.energy < 45) tick(w, LAND_NESTS[0]);
  assert.ok(evolveLand(w, 'strider'));
  while (w.land!.morph) tick(w, w.player);
  forage(w, 20);
  return w;
}
