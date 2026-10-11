import {
  chooseMigration,
  migrationAvailable,
  MIGRATION_STATIONS,
} from '../../app/game/ocean-migration.ts';
import assert from 'node:assert/strict';
import {
  stepWorld,
  distance,
  reproduce,
  NURSERY,
  HAVEN,
} from '../../app/game/simulation.ts';
import type { World } from '../../app/game/simulation.ts';
import {
  evolveOcean,
  oceanEvolutionGate,
  oceanTarget,
  OCEAN_ROCKS,
} from '../../app/game/ocean.ts';
import {
  SHORE_ROCKS,
  shoreTarget,
  nearestPool,
  shoreEvolutionGate,
  evolveShore,
  wetAt,
} from '../../app/game/shore.ts';
import {
  landTarget,
  landEvolutionGate,
  evolveLand,
  LAND_ROCKS,
  landFriends,
} from '../../app/game/land.ts';
import { FORMS } from '../../app/game/forms.ts';
import {
  colonyInteract,
  setColonyRole,
  startColonyStorm,
  stepColony,
  COLONY_NEST,
} from '../../app/game/colony.ts';
import type { ColonyState, ColonyRole } from '../../app/game/colony.ts';
const won = (w: World) =>
  assert.equal(
    w.mode,
    'won',
    `${w.habitat}: ${w.reason}; gen ${w.generation}; food ${w.food}; energy ${w.player.energy}; at ${w.player.x},${w.player.y}`,
  );
export function runPond(w: World) {
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
  won(w);
}
export function runOcean(
  w: World,
  branch: 'radial' | 'bilateral' = 'bilateral',
) {
  let frames = 0;
  while (w.mode === 'running' && frames < 12000) {
    const tier = w.ocean!.tier;
    if (!oceanEvolutionGate(w))
      assert.ok(
        evolveOcean(
          w,
          tier === 0 ? branch : branch === 'radial' ? 'jelly' : 'fish',
          tier === 0
            ? w.traits.includes('flagellum')
              ? 'vacuole'
              : 'flagellum'
            : w.traits.includes('shell')
              ? 'spikes'
              : 'shell',
        ),
      );
    if (migrationAvailable(w) && !w.ocean!.migration?.route)
      assert.ok(chooseMigration(w, branch === 'radial' ? 'filter' : 'hunt'));
    let target: { x: number; y: number } = oceanTarget(w).point;
    if (
      w.food < (tier === 0 ? 10 : tier === 1 ? 14 : 8) ||
      w.player.energy < (tier === 2 ? 35 : 85)
    ) {
      const foods = w.foods.filter((f) => f.cooldown === 0);
      const score = (f: { x: number; y: number }) =>
        distance(w.player, f) +
        w.predators.reduce(
          (sum, p) => sum + Math.max(0, 180 - distance(p, f)) * 2,
          0,
        );
      let best = Infinity;
      for (const f of foods) {
        const s = score(f);
        if (s < best) {
          best = s;
          target = f;
        }
      }
    }
    const p = w.player;
    let angle = Math.atan2(target.y - p.y, target.x - p.x);
    const desired = angle;
    let best = Infinity;
    // A short navigation look-ahead avoids solid reef circles, without teleporting.
    for (let i = -12; i <= 12; i++) {
      const a = desired + (i * Math.PI) / 24;
      const q = { x: p.x + Math.cos(a) * 110, y: p.y + Math.sin(a) * 110 };
      let score = distance(q, target) + Math.abs(i) * 1.5;
      for (const r of OCEAN_ROCKS)
        score +=
          Math.max(0, r.radius + FORMS[w.form].radius + 45 - distance(q, r)) *
          12;
      if (score < best) {
        best = score;
        angle = a;
      }
    }
    const danger = w.predators.some(
      (e) => distance(e, p) < 160 && e.stun === 0,
    );
    const m = w.ocean!.migration;
    const filtering =
      m?.route === 'filter' &&
      m.station < 2 &&
      distance(p, MIGRATION_STATIONS[m.station]) < 75;
    stepWorld(
      w,
      {
        interact: filtering && !m!.expanded,
        x: filtering ? 0 : Math.cos(angle),
        y: filtering ? 0 : Math.sin(angle),
        dash: danger && p.energy > 25,
        skill: danger,
      },
      0.05,
    );
    frames++;
  }
  assert.equal(
    w.mode,
    'won',
    `${w.mode}; ${w.reason}; time ${w.time}; hp ${w.player.health}; eaten ${w.ocean!.eaten}; mass ${w.ocean!.biomass}; pos ${w.player.x},${w.player.y}; migration ${JSON.stringify(w.ocean!.migration)}`,
  );
}
export function runShore(
  w: World,
  locomotion: 'crawler' | 'skipper' = 'crawler',
  protection: 'reservoir' | 'skin' = 'reservoir',
) {
  let frames = 0;
  while (w.mode === 'running' && frames < 12000) {
    if (w.shore!.tier < 2 && !shoreEvolutionGate(w))
      assert.ok(evolveShore(w, w.shore!.tier === 0 ? locomotion : protection));
    const s = w.shore!,
      p = w.player,
      need = s.tier === 0 ? 8 : s.tier === 1 ? 12 : 8;
    let target = shoreTarget(w).point;
    if (wetAt(w, p) && s.moisture < 90) {
      stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
      frames++;
      continue;
    }
    if (w.food < need || p.energy < 55) {
      const pool = nearestPool(w);
      const food = w.foods
        .filter((f) => f.cooldown === 0 && distance(f, pool) < pool.radius + 30)
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (food) target = food;
    }
    if (s.moisture < 32) target = nearestPool(w);
    const d = distance(p, target);
    let angle = Math.atan2(target.y - p.y, target.x - p.x);
    const desired = angle;
    let best = Infinity;
    for (let i = -12; i <= 12; i++) {
      const a = desired + (i * Math.PI) / 24,
        q = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 };
      let score = distance(q, target) + Math.abs(i) * 2;
      for (const rock of SHORE_ROCKS)
        score += Math.max(0, rock.radius + 80 - distance(q, rock)) * 12;
      for (const creature of s.creatures)
        if (creature.role === 'guardian')
          score += Math.max(0, 170 - distance(q, creature.home)) * 2;
      if (score < best) {
        best = score;
        angle = a;
      }
    }
    const danger = s.creatures.some((c) => c.alert && distance(c, p) < 130);
    stepWorld(
      w,
      {
        x: d < 12 ? 0 : Math.cos(angle),
        y: d < 12 ? 0 : Math.sin(angle),
        dash: danger && p.energy > 35,
        skill: danger,
      },
      0.05,
    );
    frames++;
  }
  won(w);
}
export function runLand(w: World) {
  const actions = new Set<string>();
  let frames = 0,
    travel = 0,
    friendsAtMeadow = -1;
  while (w.mode === 'running' && frames < 12000) {
    const goal = landTarget(w),
      p = w.player,
      s = w.land!;
    actions.add(goal.action);
    if (goal.action === 'evolve' && !landEvolutionGate(w))
      assert.ok(evolveLand(w, 'strider'));
    const d = distance(p, goal.point),
      close =
        d <
        (goal.action === 'forage'
          ? 20
          : goal.action === 'observe'
            ? 100
            : goal.action === 'befriend'
              ? 85
              : 65);
    const desired = Math.atan2(goal.point.y - p.y, goal.point.x - p.x);
    let angle = desired,
      best = Infinity;
    // Steer around the visible rocks and hunter territories; do not substitute goals.
    for (let i = -12; i <= 12; i++) {
      const a = desired + (i * Math.PI) / 24,
        q = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 };
      let score = distance(q, goal.point) + Math.abs(i) * 2;
      for (const r of LAND_ROCKS)
        score += Math.max(0, r.radius + 95 - distance(q, r)) * 12;
      for (const c of s.creatures)
        if (c.species === 'hunter' && c.respawn <= 0)
          score += Math.max(0, 250 - distance(q, c.home)) * 4;
      if (score < best) {
        best = score;
        angle = a;
      }
    }
    const before = { x: p.x, y: p.y };
    stepWorld(
      w,
      {
        x: close ? 0 : Math.cos(angle),
        y: close ? 0 : Math.sin(angle),
        dash: false,
        skill: goal.action === 'befriend' && d < 180,
        interact:
          close &&
          (goal.action === 'nest' ||
            goal.action === 'settle' ||
            (goal.action === 'befriend' && w.food >= 2)),
      },
      0.05,
    );
    travel += distance(before, p);
    frames++;
    if (friendsAtMeadow < 0 && s.visited.includes('日光果甸'))
      friendsAtMeadow = landFriends(w);
  }
  won(w);
}
const idle = { x: 0, y: 0 };
function move(s: ColonyState, target: { x: number; y: number }) {
  for (let i = 0; i < 1600 && distance(s.player, target) > 12; i++) {
    const x = target.x - s.player.x,
      y = target.y - s.player.y,
      d = Math.hypot(x, y);
    stepColony(s, { x: x / d, y: y / d }, 1 / 60);
  }
  assert.ok(distance(s.player, target) < 14);
}
function gather(s: ColonyState, kind: ColonyRole, needed: number) {
  for (
    let trip = 0;
    trip < 40 && s[kind === 'wood' ? 'wood' : 'food'] < needed;
    trip++
  ) {
    for (let i = 0; i < 3; i++) {
      let p = s.patches
        .filter((p) => p.kind === kind && p.cooldown === 0)
        .sort((a, b) => distance(s.player, a) - distance(s.player, b))[0];
      if (!p) {
        stepColony(s, idle, 14);
        p = s.patches.find((p) => p.kind === kind && p.cooldown === 0)!;
      }
      move(s, p);
      colonyInteract(s);
    }
    move(s, COLONY_NEST);
    colonyInteract(s);
  }
  assert.ok(s[kind === 'wood' ? 'wood' : 'food'] >= needed);
}
export function runColony(s: ColonyState) {
  gather(s, 'wood', 8);
  gather(s, 'food', 4);
  move(s, COLONY_NEST);
  assert.ok(colonyInteract(s));
  assert.ok(s.shelter);
  gather(s, 'food', 16);
  gather(s, 'wood', 5);
  move(s, COLONY_NEST);
  for (let i = 0; i < 5; i++) {
    assert.ok(colonyInteract(s));
    stepColony(s, idle, 3.1);
  }
  assert.equal(s.growth, 100);
  assert.equal(s.members.filter((m) => m.newborn).length, 1);
  for (const m of s.members) setColonyRole(s, m.id, 'guard');
  stepColony(s, idle, 5);
  assert.ok(startColonyStorm(s));
  for (let i = 0; i < 3000 && s.mode === 'running'; i++) {
    if (s.integrity < 70) colonyInteract(s);
    stepColony(s, idle, 1 / 60);
  }
  assert.equal(s.mode, 'won');
}
