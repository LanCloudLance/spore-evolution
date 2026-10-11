import type { ColonyState, ColonyMember } from './colony.ts';
import type { World, Ancestor } from './simulation.ts';
import { createWorld, announce } from './simulation.ts';
import { createOceanWorld } from './ocean.ts';
import { createShoreWorld } from './shore.ts';
import { createLandWorld } from './land.ts';
import { freshBody } from './body-design.ts';
import type { LandFeature } from './land-catalog.ts';
export type BiologicalRecord = {
  id: number;
  title: string;
  generation: number;
  seconds: number;
  history: Ancestor[];
  form: ColonyState['form'];
  body: ColonyState['body'];
  traits: ColonyState['traits'];
  dnaLineage?: ColonyState['dnaLineage'];
  features: LandFeature[];
  descendants: ColonyMember[];
  integrity: number;
  seedLegacy?: ColonyState['seedLegacy'];
};
export function biologicalRecord(
  s: ColonyState,
  id: number,
): BiologicalRecord | null {
  if (
    s.mode !== 'won' ||
    s.storm !== 0 ||
    !s.shelter ||
    s.integrity <= 0 ||
    s.growth !== 100 ||
    !s.members.some((m) => m.newborn) ||
    !Number.isSafeInteger(id) ||
    id < 1
  )
    return null;
  const methods = Object.values(s.dnaLineage?.sources ?? {}).reduce(
    (m, r) => {
      m.hunt += r?.methods?.hunt ?? 0;
      m.symbiosis += r?.methods?.symbiosis ?? 0;
      return m;
    },
    { hunt: 0, symbiosis: 0 },
  );
  return structuredClone({
    id,
    title:
      s.seedLegacy === 'grown'
        ? '育园谱系'
        : methods.symbiosis > methods.hunt
          ? '共生谱系'
          : methods.hunt > 0
            ? '巡猎谱系'
            : '迁行谱系',
    generation: s.generation,
    seconds: s.time,
    history: s.history.slice(-80),
    form: s.form,
    body: s.body,
    traits: s.traits,
    dnaLineage: s.dnaLineage,
    features: s.features ?? [],
    descendants: s.members,
    integrity: s.integrity,
    ...(s.seedLegacy ? { seedLegacy: s.seedLegacy } : {}),
  });
}
/** Fork from the selected historical receipt only. Resources, friends and future receipts stay in the archive. */
export function branchBiological(
  record: BiologicalRecord,
  generation: number,
  seed: number,
): World | null {
  const index = record.history.findIndex((a) => a.generation === generation),
    a = record.history[index];
  if (!a || !Number.isSafeInteger(seed) || seed < 0 || seed > 1000000)
    return null;
  const habitat =
    a.habitat ??
    (a.form === 'microbe'
      ? 'pond'
      : ['colony', 'bilateral', 'fish', 'radial', 'jelly'].includes(
            a.form ?? '',
          )
        ? 'ocean'
        : ['crawler', 'skipper'].includes(a.form ?? '')
          ? 'shore'
          : 'land');
  const cp = {
    seed,
    generation: a.generation + 1,
    time: 0,
    age: 0,
    totalFood: 0,
    history: structuredClone(record.history.slice(0, index + 1)),
    traits: [...a.traits],
    standalone: false,
    ...(a.dnaLineage ? { dnaLineage: structuredClone(a.dnaLineage) } : {}),
    ...(a.learning ? { learning: structuredClone(a.learning) } : {}),
  };
  let w: World;
  if (habitat === 'pond') {
    w = createWorld(seed);
    Object.assign(w, cp, { mode: 'running', form: 'microbe' });
  } else if (habitat === 'ocean') {
    const form = a.form as import('./forms.ts').OceanCheckpoint['startingForm'];
    w = createOceanWorld(seed, {
      ...cp,
      startingDna: 0,
      startingBody: structuredClone(a.body ?? freshBody()),
      startingForm: form ?? 'colony',
    });
  } else if (habitat === 'shore')
    w = createShoreWorld(seed, {
      ...cp,
      form: a.form ?? 'fish',
      body: structuredClone(a.body ?? freshBody()),
      biomass: 0,
      startingTier:
        a.adaptations?.length || a.adaptation
          ? 2
          : ['crawler', 'skipper'].includes(a.form ?? '')
            ? 1
            : 0,
      protection: a.adaptation ?? null,
      adaptations: a.adaptations
        ? [...a.adaptations]
        : a.adaptation
          ? [a.adaptation]
          : [],
    });
  else
    w = createLandWorld(seed, {
      ...cp,
      form: a.form ?? 'crawler',
      body: structuredClone(a.body ?? freshBody()),
      biomass: 0,
      startingTier: a.landOrgan
        ? 2
        : ['strider', 'stalker'].includes(a.form ?? '')
          ? 1
          : 0,
      organ: a.landOrgan ?? null,
      protection: a.adaptation ?? null,
      adaptations: a.adaptations ? [...a.adaptations] : undefined,
      features: a.landFeatures ? [...a.landFeatures] : undefined,
    });
  w.food = 0;
  w.totalFood = 0;
  w.age = 0;
  w.time = 0;
  w.mode = 'paused';
  announce(
    w,
    `从第${a.generation}代留下新支系 · 继承当时的身体与祖源，从空物资重新探索。`,
  );
  return w;
}
