import { inheritedDna } from './dna-evolution.ts';
import { inheritedLearning } from './lineage-learning.ts';
import { adaptationsOf } from './life-adaptations.ts';
import type { Ancestor, World } from './simulation.ts';
import { droughtLegacy } from './land-drought.ts';
import { landSettlementWays } from './land.ts';
/** A habitat transition does not create another generation. Keep its latest record. */
export function rememberGeneration(history: Ancestor[], record: Ancestor) {
  const previous = history.at(-1);
  if (previous?.generation === record.generation)
    history[history.length - 1] =
      previous.milestone && !record.milestone
        ? { ...record, milestone: previous.milestone }
        : record;
  else history.push(record);
}

/** Display a migrating life once, while retaining its previous habitat receipt. */
export function familyTimeline(w: World) {
  const saved = w.history.findLast((a) => a.generation === w.generation);
  const current: Ancestor = {
    ...(w.land?.nests.includes(2) ? { landWays: landSettlementWays(w) } : {}),
    ...(droughtLegacy(w) ? { landLegacy: droughtLegacy(w) } : {}),
    ...(w.tidalLegacy ? { tidalLegacy: structuredClone(w.tidalLegacy) } : {}),
    form: w.form,
    habitat: w.habitat,
    generation: w.generation,
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: w.traits,
    food: w.food,
    seconds: w.age,
    body: w.land?.body ?? w.shore?.body ?? w.ocean?.body,
    landOrgan: w.land?.organ ?? undefined,
    adaptation: w.land?.protection ?? w.shore?.protection ?? undefined,
    adaptations: adaptationsOf(w.land ?? w.shore ?? {}),
  };
  return [
    ...w.history
      .filter((a) => a.generation !== w.generation)
      .map((ancestor) => ({
        ancestor,
        status: '已留下后代',
        previousHabitat: undefined as Ancestor | undefined,
      })),
    {
      ancestor: w.mode === 'won' && saved ? saved : current,
      status:
        w.mode === 'won'
          ? '已抵达新栖息地'
          : w.mode === 'dead'
            ? '探索已结束'
            : '当前生命',
      previousHabitat:
        saved?.habitat && saved.habitat !== w.habitat ? saved : undefined,
    },
  ];
}
