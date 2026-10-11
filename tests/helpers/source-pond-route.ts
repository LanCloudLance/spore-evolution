import assert from 'node:assert/strict';
import type { World } from '../../app/game/simulation.ts';
import { stepWorld, distance, NURSERY } from '../../app/game/simulation.ts';
import { guidePondHunt, guidePondVisit } from '../../app/game/pond-life.ts';
import { commitBiologicalEvolution } from '../../app/game/biological-evolution.ts';
import { runPond } from './campaign-route.ts';
export type PondWay = 'hunt' | 'garden' | 'companions';
/** Uses only movement, real eating/sharing/observation, and the public paid birth command. */
export function runSourcePond(w: World, way: PondWay) {
  const species =
    way === 'hunt' ? 'dart' : way === 'garden' ? 'feather' : 'shield';
  const body =
    way === 'hunt' ? 'stream' : way === 'garden' ? 'grazer' : 'bastion';
  const method =
    way === 'hunt' ? 'hunt' : way === 'garden' ? 'observe' : 'symbiosis';
  for (
    let frames = 0;
    frames < 14000 && w.mode === 'running' && w.generation < 3;
    frames++
  ) {
    const receipt = w.dnaLineage?.sources[species];
    const learned =
      (receipt?.units ?? 0) >= 2 && (receipt?.methods?.[method] ?? 0) > 0;
    if (learned && commitBiologicalEvolution(w, `pond:${body}`)) continue;
    if (w.evolution && w.evolution.elapsed < w.evolution.duration) {
      stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
      continue;
    }
    const supply =
      w.food < (way === 'companions' ? 9 : 8) || w.player.energy < 65;
    const food = w.foods
      .filter((f) => f.cooldown === 0)
      .sort((a, b) => {
        const score = (f: typeof a) =>
          distance(f, w.player) +
          w.predators.reduce(
            (s, p) => s + Math.max(0, 190 - distance(p, f)) * 2,
            0,
          );
        return score(a) - score(b);
      })[0];
    let target = learned ? NURSERY : (food ?? NURSERY);
    let input = { x: 0, y: 0, dash: false, interact: false };
    if (supply && food) target = food;
    else if (!learned) {
      const prey = w
        .pondLife!.prey.filter((p) => p.species === species && p.cooldown === 0)
        .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
      const guide =
        prey &&
        (way === 'hunt'
          ? guidePondHunt(w, prey.id)
          : guidePondVisit(w, prey.id));
      if (guide) {
        input = {
          ...input,
          ...guide.input,
          interact:
            way === 'companions' &&
            distance(prey, w.player) < 135 &&
            w.food >= 1 &&
            !w.pondLife!.gifts?.length,
        };
        stepWorld(w, input, 0.05);
        continue;
      }
    }
    const d = distance(target, w.player),
      angle = Math.atan2(target.y - w.player.y, target.x - w.player.x);
    input.x = d < 8 ? 0 : Math.cos(angle);
    input.y = d < 8 ? 0 : Math.sin(angle);
    input.dash =
      w.predators.some((p) => p.stun === 0 && distance(p, w.player) < 140) &&
      w.player.energy > 25;
    stepWorld(w, input, 0.05);
  }
  assert.equal(
    w.generation,
    3,
    `${way}: ${w.mode} ${w.reason}; food ${w.food}, e ${w.player.energy}; sources ${JSON.stringify(w.dnaLineage)}`,
  );
  assert.equal(w.dnaLineage?.body, body);
  assert.ok(w.dnaLineage!.sources[species]!.methods?.[method]);
  runPond(w);
  return w;
}
