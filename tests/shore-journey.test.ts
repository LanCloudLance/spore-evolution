import { createOceanWorld } from './helpers/legacy-ocean.ts';

import { enterShore } from '../app/game/shore.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShoreWorld,
  SHORE_POOLS,
  SHORE_ROCKS,
  shoreTarget,
  nearestPool,
  shoreEvolutionGate,
  evolveShore,
  wetAt,
} from '../app/game/shore.ts';
import { distance, stepWorld } from '../app/game/simulation.ts';
for (const entry of ['standalone', 'inherited'] as const)
  for (const locomotion of ['crawler', 'skipper'] as const)
    for (const protection of ['reservoir', 'skin'] as const) {
      void test(`${entry} ${locomotion} with ${protection} can cross the shore through real movement and complete both births`, () => {
        const w =
          entry === 'standalone' ? createShoreWorld(23) : createOceanWorld(71);
        if (entry === 'inherited') {
          w.mode = 'won';
          w.form = 'jelly';
          w.generation = 7;
          w.traits = ['shell', 'flagellum', 'spikes'];
          w.ocean!.body.length = 1.3;
          w.ocean!.body.width = 1.2;
          w.ocean!.body.organs.tail = 'spine';
          w.ocean!.biomass = 80;
          assert.ok(enterShore(w));
        }
        let frames = 0;
        while (w.mode === 'running' && frames < 12000) {
          if (!shoreEvolutionGate(w))
            assert.ok(
              evolveShore(w, w.shore!.tier === 0 ? locomotion : protection),
            );
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
              .filter(
                (f) => f.cooldown === 0 && distance(f, pool) < pool.radius + 30,
              )
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
          const danger = s.creatures.some(
            (c) => c.alert && distance(c, p) < 130,
          );
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
        assert.equal(
          w.mode,
          'won',
          `${w.reason}; tier ${w.shore!.tier}; pos ${w.player.x},${w.player.y}; wet ${w.shore!.moisture}; food ${w.food}; discovered ${w.shore!.discovered.join(',')}; target ${shoreTarget(w).label}`,
        );
        assert.equal(w.form, locomotion);
        assert.equal(w.shore!.protection, protection);
        assert.equal(w.history.length, 3);
        assert.ok(w.shore!.visited.includes(SHORE_POOLS[4].name));
        const before = structuredClone(w);
        stepWorld(w, { x: 1, y: 0, dash: true }, 0.05);
        assert.deepEqual(w, before);
      });
    }
