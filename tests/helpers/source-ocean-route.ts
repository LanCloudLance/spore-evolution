import assert from 'node:assert/strict';
import { stepWorld, distance, getStats } from '../../app/game/simulation.ts';
import type { World, Vec } from '../../app/game/simulation.ts';
import { commitBiologicalEvolution } from '../../app/game/biological-evolution.ts';
import {
  oceanDnaCandidates,
  oceanDnaGuide,
  guideOceanActor,
} from '../../app/game/ocean-dna.ts';
import type { OceanDnaBody } from '../../app/game/ocean-dna.ts';
import { guideNavigation } from '../../app/game/navigation.ts';
import type { Navigation } from '../../app/game/navigation.ts';
import { tidalObstacles } from '../../app/game/tidal/habitat.ts';
import { organZones, worldBodyPose } from '../../app/game/body-geometry.ts';
import { bodyRadius } from '../../app/game/food-chain.ts';
import { TIDAL_BIOMES } from '../../app/game/tidal/catalog.ts';
import { runTidalRoute } from './tidal-route.ts';

/** No reward, teleports, tier or source fixtures: input policy uses the same source guides and birth command as the UI. */
export function runSourceOcean(w: World, id: OceanDnaBody) {
  let n: Navigation | null = null,
    foodId = '',
    heading = 0,
    frames = 0;
  while (w.mode === 'running' && w.ocean!.tier < 2 && frames++ < 14000) {
    const o = w.ocean!,
      t = o.tidal!,
      p = w.player;
    if (commitBiologicalEvolution(w, `ocean:${id}`)) {
      n = null;
      continue;
    }
    if (o.morph) {
      stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
      continue;
    }
    const candidate = oceanDnaCandidates(w).find((c) => c.id === id)!;
    const nearest = t.foods
      .filter((f) => f.state === 'available' && !f.reservedFor)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    const guide = oceanDnaGuide(w, id);
    const neededEnergy = Math.min(
      getStats(w.traits, w.form).maxEnergy - 8,
      55 + distance(p, TIDAL_BIOMES[0]) / 110,
    );
    let target: Vec = candidate.available
      ? TIDAL_BIOMES[0]
      : (guide?.point ?? TIDAL_BIOMES[0]);
    const supply =
      p.energy < neededEnergy || w.food < 2 || o.dna < candidate.costDna;
    let input = {
      x: 0,
      y: 0,
      dash: false,
      tidalCommand: undefined as { id: number; kind: 'interact' } | undefined,
    };
    if (supply && nearest) {
      if (nearest.id !== foodId) {
        n = null;
        foodId = nearest.id;
        heading = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      }
      const mouth = organZones(
        { ...worldBodyPose(w), angle: heading },
        'jaw',
      )[0];
      target = mouth
        ? { x: nearest.x - (mouth.x - p.x), y: nearest.y - (mouth.y - p.y) }
        : nearest;
      const d = distance(p, target);
      if (d < 15)
        input = {
          ...input,
          x: Math.cos(heading) * 0.06,
          y: Math.sin(heading) * 0.06,
        };
    } else if (!candidate.available && guide) {
      const intent = id === 'shellrunner' ? 'visit' : guide.intent;
      const pursuit = guideOceanActor(w, guide.actorId, intent);
      if (pursuit) {
        input = { ...input, ...pursuit.input };
        if (intent === 'visit' && distance(p, guide.point) <= 175)
          input.tidalCommand = {
            id: t.abilities.lastCommandId + 1,
            kind: 'interact',
          };
        stepWorld(w, input, 0.05);
        continue;
      }
    }
    if (Math.hypot(input.x, input.y) === 0) {
      if (!n || distance(n.target, target) > 25)
        n = {
          arrivalRadius: supply ? 5 : 18,
          target: { ...target },
          last: { ...p },
          stalled: 0,
        };
      const moving = guideNavigation(n, p, 0.05, {
        obstacles: tidalObstacles(t.tick),
        clearance: bodyRadius(w) * o.body.width,
      });
      if (moving) input = { ...input, ...moving };
      else n = null;
    }
    stepWorld(w, input, 0.05);
  }
  assert.equal(
    w.ocean!.tier,
    2,
    `${id}: ${w.mode}; at ${w.player.x},${w.player.y}; ${oceanDnaCandidates(w).find((c) => c.id === id)?.gate}; sources ${JSON.stringify(w.dnaLineage)}; energy ${w.player.energy}`,
  );
  runTidalRoute(
    w,
    id === 'fancrest' ? 'filter' : 'hunt',
    id === 'shellrunner' ? 'symbiosis' : id === 'fancrest' ? 'filter' : 'hunt',
  );
}
