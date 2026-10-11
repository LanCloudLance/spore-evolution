import test from 'node:test';
import { createShoreWorld } from '../app/game/shore.ts';
import { enterLand } from '../app/game/land.ts';
import assert from 'node:assert/strict';
import {
  createLandWorld,
  LAND_NESTS,
  LAND_AREAS,
  LAND_ROCKS,
  landTarget,
  landEvolutionGate,
  evolveLand,
  interactLand,
  landFriends,
  nearbyLandCreature,
} from '../app/game/land.ts';
import { distance, stepWorld } from '../app/game/simulation.ts';
import type { Vec } from '../app/game/simulation.ts';
for (const inherited of [false, true])
  for (const form of ['strider', 'stalker'] as const)
    for (const organ of ['crest', 'plates'] as const) {
      void test(`${inherited ? 'inherited' : 'standalone'} real ${form} journey with ${organ}: forage, nest, both discoveries, two births and settlement`, () => {
        const w = inherited ? createShoreWorld(37) : createLandWorld(37);
        if (inherited) {
          w.mode = 'won';
          w.form = 'skipper';
          w.traits = ['shell', 'vacuole'];
          w.shore!.body.length = 1.3;
          w.shore!.body.width = 1.2;
          w.shore!.body.organs.tail = 'spine';
          w.shore!.biomass = 70;
          w.shore!.protection = 'reservoir';
          assert.ok(enterLand(w));
        }
        const s = w.land!;
        let frames = 0;
        while (w.mode === 'running' && frames < 14000) {
          // This route chooses an observed organ for its second birth. Body
          // revisions are now available earlier and after this route's two births.
          if (
            (s.tier === 0 || (s.tier === 1 && s.discovered.length >= 2)) &&
            !landEvolutionGate(w)
          )
            assert.ok(evolveLand(w, s.tier === 0 ? form : organ));
          let target: Vec = landTarget(w).point,
            skill = false,
            share = false;
          const need = !s.nests.length
            ? 6
            : !s.tier
              ? 10
              : s.tier === 1
                ? 22
                : 12;
          const nest = LAND_NESTS.find(
            (n, i) =>
              s.nests.includes(i) && distance(n, w.player) < n.radius - 20,
          );
          const forage = () =>
            w.foods
              .filter((f) => f.cooldown === 0)
              .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
          if (w.food < need || w.player.energy < 55) {
            target = forage() ?? target;
          } else if (s.tier === 1 && s.discovered.length >= 2)
            target = LAND_NESTS[s.nests[0]];
          else if (
            s.tier > 0 &&
            s.visited.length >= 2 &&
            (form === 'strider' ? landFriends(w) < 2 : s.hunts < 3)
          ) {
            const prey = s.creatures
              .filter(
                (c) => c.species !== 'hunter' && !c.joined && c.respawn <= 0,
              )
              .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
            if (prey) {
              target = prey;
              skill =
                distance(prey, w.player) < (form === 'strider' ? 180 : 145);
              share = form === 'strider' && !!nearbyLandCreature(w);
            }
          }
          if (nest && w.player.energy < 65) {
            stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
            frames++;
            continue;
          }
          if (
            distance(w.player, LAND_NESTS[0]) < 120 &&
            !s.nests.length &&
            w.food >= 6
          )
            assert.ok(interactLand(w));
          if (
            s.tier === 2 &&
            distance(w.player, LAND_NESTS[2]) < 120 &&
            s.visited.length >= 2 &&
            (landFriends(w) >= 2 || s.hunts >= 3) &&
            w.food >= 12
          ) {
            assert.ok(interactLand(w));
            break;
          }
          if (s.tier === 1 && s.visited.length < 2 && w.food >= need)
            target = LAND_AREAS.find((a) => !s.visited.includes(a.name))!;
          const desired = Math.atan2(
            target.y - w.player.y,
            target.x - w.player.x,
          );
          let angle = desired,
            best = Infinity;
          for (let i = -12; i <= 12; i++) {
            const a = desired + (i * Math.PI) / 24,
              q = {
                x: w.player.x + Math.cos(a) * 100,
                y: w.player.y + Math.sin(a) * 100,
              };
            let score = distance(q, target) + Math.abs(i) * 2;
            for (const r of LAND_ROCKS)
              score += Math.max(0, r.radius + 80 - distance(q, r)) * 12;
            for (const c of s.creatures)
              if (c.species === 'hunter')
                score += Math.max(0, 250 - distance(q, c.home)) * 4;
            if (score < best) {
              best = score;
              angle = a;
            }
          }
          const close = distance(target, w.player) < 55;
          stepWorld(
            w,
            {
              x: close ? 0 : Math.cos(angle),
              y: close ? 0 : Math.sin(angle),
              dash: false,
              skill,
              interact: share,
            },
            0.05,
          );
          frames++;
        }
        assert.equal(
          w.mode,
          'won',
          `${w.reason}; tier ${s.tier}; food ${w.food}; energy ${w.player.energy}; pos ${w.player.x},${w.player.y}; discoveries ${s.discovered.join(',')}; visits ${s.visited.join(',')}; hunts ${s.hunts}; friends ${landFriends(w)}; goal ${landTarget(w).label}`,
        );
        assert.equal(w.form, form);
        assert.equal(s.organ, organ);
        assert.equal(w.history.length, 3);
        assert.equal(s.nests.includes(2), true);
        if (form === 'strider') {
          assert.equal(s.hunts, 0);
          assert.ok(landFriends(w) >= 2);
        } else assert.ok(s.hunts >= 3);
        const before = structuredClone(w);
        stepWorld(
          w,
          { x: 1, y: 1, dash: true, interact: true, skill: true },
          1,
        );
        assert.deepEqual(w, before);
      });
    }
