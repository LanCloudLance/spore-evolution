import {
  SHORE_POOLS,
  SHORE_ROCKS,
  shoreTarget,
  nearestPool,
  shoreEvolutionGate,
  wetAt,
  interactShore,
} from '../../app/game/shore.ts';
import { stepWorld, distance } from '../../app/game/simulation.ts';
import type { World } from '../../app/game/simulation.ts';
import {
  nextGenerationCandidates,
  commitBiologicalEvolution,
} from '../../app/game/biological-evolution.ts';
import assert from 'node:assert/strict';
export function runSourceShore(
  w: World,
  route: 'shelter' | 'cycles' | 'remote',
) {
  const locomotion = route === 'remote' ? 'skipper' : 'crawler',
    protection = route === 'remote' ? 'reservoir' : 'skin';
  let frames = 0;
  while (w.mode === 'running' && frames < 12000) {
    if (!shoreEvolutionGate(w)) {
      const candidate = `shore:${w.shore!.tier === 0 ? locomotion : protection}`;
      if (
        nextGenerationCandidates(w).find((c) => c.id === candidate)?.gate === ''
      )
        assert.ok(commitBiologicalEvolution(w, candidate));
    }
    const s = w.shore!,
      p = w.player,
      need =
        s.tier === 0
          ? 8
          : s.tier === 1
            ? route === 'shelter' && !w.dnaLineage?.sources['shore:shade']
              ? 15
              : 12
            : 8;
    let target = shoreTarget(w).point;
    if (s.tier === 1 && !s.morph) {
      const dry = {
        x: SHORE_POOLS[0].x + SHORE_POOLS[0].radius + 65,
        y: SHORE_POOLS[0].y + 100,
      };
      if (route === 'shelter' && !w.dnaLineage?.sources['shore:shade']) {
        target = dry;
        if (distance(p, dry) < 15 && w.food >= 15) interactShore(w);
      } else if (route === 'cycles' && (s.fieldNotes?.safeReturns ?? 0) < 2) {
        target = (s.fieldNotes?.drySeconds ?? 0) >= 8 ? SHORE_POOLS[0] : dry;
      }
    }
    if (wetAt(w, p) && s.moisture < 90) {
      stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
      frames++;
      continue;
    }
    if (
      w.food < (s.shelters?.length ? (s.tier === 1 ? 12 : need) : need) ||
      p.energy < 55
    ) {
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
  assert.equal(
    w.mode,
    'won',
    `${w.reason}; tier ${w.shore!.tier}; pos ${w.player.x},${w.player.y}; wet ${w.shore!.moisture}; food ${w.food}; discovered ${w.shore!.discovered.join(',')}; target ${shoreTarget(w).label}`,
  );

  assert.equal(w.shore!.protection, protection);
  return w;
}
