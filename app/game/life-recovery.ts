import type { World } from './simulation.ts';
import { createWorld, announce } from './simulation.ts';
import { createOceanWorld, retryOcean } from './ocean.ts';
import { createShoreWorld } from './shore.ts';
import { createLandWorld } from './land.ts';
import { inheritedDna } from './dna-evolution.ts';
import { inheritedLearning } from './lineage-learning.ts';
import { adaptationsOf } from './life-adaptations.ts';
/** Recovery and chapter reset deliberately have different costs and inheritance. */
export function recoverLife(
  w: World,
  practice = false,
  resetChapter = false,
): World {
  if (w.habitat === 'ocean')
    return resetChapter
      ? createOceanWorld(w.seed, practice ? undefined : w.ocean?.checkpoint)
      : recoverOceanBody(w);
  if (w.habitat === 'shore')
    return resetChapter
      ? createShoreWorld(w.seed, w.shore?.checkpoint)
      : recoverShoreBody(w);
  if (w.habitat === 'land')
    return resetChapter
      ? createLandWorld(w.seed, w.land?.checkpoint)
      : recoverLandBody(w);
  const next = createWorld(w.seed);
  next.mode = 'running';
  if (!resetChapter) {
    next.generation = w.generation;
    next.history = structuredClone(w.history);
    next.traits = [...w.traits];
    next.dnaLineage = inheritedDna(w);
    next.learning = inheritedLearning(w);
    next.time = w.time;
    next.totalFood = w.totalFood;
    announce(next, '身体和已发现的祖源保留 · 从育生水域重新收集补给。');
  }
  return next;
}

function recoverOceanBody(w: World) {
  const next = retryOcean(w),
    current = w.ocean,
    restored = next.ocean;
  if (!current || !restored) return next;
  // Safe ecology and supplies may roll back; paid anatomy and actual knowledge cannot.
  next.generation = w.generation;
  next.form = w.form;
  next.history = structuredClone(w.history);
  next.traits = [...w.traits];
  next.dnaLineage = inheritedDna(w);
  next.learning = inheritedLearning(w);
  next.time = w.time;
  next.totalFood = w.totalFood;
  next.age = 0;
  next.evolution = null;
  restored.body = structuredClone(current.body);
  restored.tier = current.tier;
  restored.branch = current.branch;
  restored.morph = null;
  restored.skillActive = 0;
  restored.visited = [...current.visited];
  restored.discovered = [
    ...new Set([...restored.discovered, ...current.discovered]),
  ];
  // Do not refund birth costs from an older snapshot or carry newly gained expendable DNA forward.
  restored.dna = Math.min(restored.dna, current.dna);
  if (restored.tidal && current.tidal) {
    restored.tidal.journal.seen = [
      ...new Set([
        ...restored.tidal.journal.seen,
        ...current.tidal.journal.seen,
      ]),
    ];
    restored.tidal.journal.claimed = [
      ...new Set([...restored.tidal.journal.claimed, ...restored.discovered]),
    ];
    const a = restored.tidal.abilities;
    const carried = restored.tidal.foods.find((f) => f.id === a.carriedId);
    if (carried) {
      carried.state = 'available';
      carried.owner = null;
      carried.x = next.player.x;
      carried.y = next.player.y;
    }
    a.slots = [...current.tidal.abilities.slots];
    a.carriedId = null;
    a.filterOpen = false;
    a.shellSeconds = 0;
    a.reserveEnergy = 0;
    a.inkSeconds = 0;
    a.anchored = false;
  }
  announce(next, '已付费身体与祖源保留 · 补给和生态回到最近育生点。');
  return next;
}

function recoverShoreBody(w: World) {
  const s = w.shore;
  if (!s) return createShoreWorld(w.seed);
  const next = createShoreWorld(s.checkpoint.seed, {
    ...s.checkpoint,
    generation: w.generation,
    time: w.time,
    totalFood: w.totalFood,
    history: structuredClone(w.history),
    traits: [...w.traits],
    form: w.form,
    body: structuredClone(s.body),
    biomass: 0,
    dnaLineage: inheritedDna(w),
    learning: inheritedLearning(w),
    startingTier: s.tier,
    protection: s.protection,
    adaptations: adaptationsOf(s),
  });
  next.food = 0;
  next.shore!.discovered = [...s.discovered];
  return next;
}

function recoverLandBody(w: World) {
  const s = w.land;
  if (!s) return createLandWorld(w.seed);
  const next = createLandWorld(s.checkpoint.seed, {
    ...s.checkpoint,
    generation: w.generation,
    time: w.time,
    totalFood: w.totalFood,
    history: structuredClone(w.history),
    traits: [...w.traits],
    form: w.form,
    body: structuredClone(s.body),
    biomass: 0,
    dnaLineage: inheritedDna(w),
    learning: inheritedLearning(w),
    startingTier: s.tier,
    organ: s.organ,
    features: s.features ? [...s.features] : undefined,
    protection: s.protection,
    adaptations: s.adaptations ? [...s.adaptations] : undefined,
  });
  next.food = 0;
  next.land!.discovered = [...s.discovered];
  next.land!.focus = s.focus;
  return next;
}
