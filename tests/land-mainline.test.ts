import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLandWorld,
  enterLand,
  landTarget,
  landEvolutionGate,
  evolveLand,
  LAND_ROCKS,
  landFriends,
} from '../app/game/land.ts';
import { createShoreWorld } from '../app/game/shore.ts';
import { stepWorld, distance } from '../app/game/simulation.ts';

// Only the initial inherited save is a fixture. After entering land, every resource,
// discovery, friendship and milestone must be earned through movement and actions.
for (const seed of [17, 37, 92])
  for (const inherited of [false, true]) {
    void test(`HUD-directed peaceful mainline seed ${seed}, ${inherited ? 'shore inheritance' : 'standalone'}, no optional organ`, () => {
      const w = inherited ? createShoreWorld(seed) : createLandWorld(seed);
      if (inherited) {
        w.mode = 'won';
        w.form = 'skipper';
        w.generation = 7;
        w.traits = ['shell', 'vacuole'];
        w.shore!.protection = 'reservoir';
        w.shore!.body.length = 1.3;
        w.shore!.body.width = 1.2;
        w.shore!.body.organs.tail = 'spine';
        w.shore!.biomass = 70;
        assert.ok(enterLand(w));
      }
      const entryGen = w.generation,
        entryBody = structuredClone(w.land!.body),
        actions = new Set<string>();
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
      assert.equal(
        w.mode,
        'won',
        `${w.reason}; ${landTarget(w).label}; position ${w.player.x},${w.player.y}; food ${w.food}; energy ${w.player.energy}; friends ${landFriends(w)}; time ${frames * 0.05}`,
      );
      assert.equal(w.land!.organ, null);
      assert.equal(w.land!.hunts, 0);
      assert.equal(w.land!.tier, 1);
      assert.equal(w.generation, entryGen + 1);
      assert.ok(landFriends(w) >= 2);
      assert.ok(friendsAtMeadow >= 2);
      assert.deepEqual(w.land!.body, entryBody);
      assert.ok(travel > 3500);
      for (const action of [
        'forage',
        'nest',
        'observe',
        'evolve',
        'befriend',
        'explore',
        'settle',
      ])
        assert.ok(actions.has(action), action);
    });
  }
