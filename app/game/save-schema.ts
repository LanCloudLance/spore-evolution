import {
  LAND_SPECIES,
  LAND_FEATURES,
  validLandFeatures,
} from './land-catalog.ts';
import { DNA_SOURCES, validDnaLineage } from './dna-evolution.ts';
import { validLearning } from './lineage-learning.ts';
import { validPondLife } from './pond-life.ts';
import { validAdaptations } from './life-adaptations.ts';
import { FORMS } from './forms.ts';
import { TRAITS } from './simulation.ts';
import { validateLayout } from './body-layout.ts';
import type { BodyDesign } from './body-design.ts';
import { validTidalState, validTidalLegacy } from './tidal/save-guards.ts';
import { validLandDrought, validLandLegacy } from './land-drought.ts';
type Guard = (v: unknown) => boolean;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const num: Guard = (v) =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12;
const nonnegative: Guard = (v) => num(v) && (v as number) >= 0;
const integer: Guard = (v) => nonnegative(v) && Number.isInteger(v);
const text: Guard = (v) => typeof v === 'string' && v.length < 10000;
const bool: Guard = (v) => typeof v === 'boolean';
const one =
  (...values: unknown[]): Guard =>
  (v) =>
    values.includes(v);
const optional =
  (g: Guard): Guard =>
  (v) =>
    v === undefined || g(v);
const nullable =
  (g: Guard): Guard =>
  (v) =>
    v === null || g(v);
const list =
  (g: Guard, max = 2048): Guard =>
  (v) =>
    Array.isArray(v) && v.length <= max && v.every(g);
const shape =
  (schema: Record<string, Guard>): Guard =>
  (v) =>
    object(v) && Object.entries(schema).every(([key, g]) => g(v[key]));
const dictionary =
  (g: Guard, allowed?: string[]): Guard =>
  (v) =>
    object(v) &&
    Object.entries(v).every(
      ([key, value]) => (!allowed || allowed.includes(key)) && g(value),
    );
const numbers = (names: string) =>
  Object.fromEntries(names.split(' ').map((key) => [key, num]));
const vec = { x: num, y: num };
export function createSaveGuards(version: 4 | 5) {
  const tidalLegacy =
    version === 5
      ? optional(validTidalLegacy)
      : (v: unknown) => v === undefined;
  const form = one(...Object.keys(FORMS));
  const traits = list(one(...TRAITS.map((t) => t.id)), 6);
  const organ =
    version === 4
      ? one('jaw', 'fin', 'spine', 'filter')
      : one(
          'jaw',
          'fin',
          'spine',
          'filter',
          'shell',
          'grasp',
          'lateral',
          'reserve',
          'sail',
          'ink',
          'glow',
          'anchor',
        );
  const protection = one(null, 'skin', 'reservoir');
  const landOrgan = one('crest', 'plates');
  const bodyShape = shape({
    length: (v) => num(v) && (v as number) >= 0.8 && (v as number) <= 1.5,
    width: (v) => num(v) && (v as number) >= 0.7 && (v as number) <= 1.3,
    legs: optional(
      (v) => num(v) && (v as number) >= 0.75 && (v as number) <= 1.4,
    ),
    organs: dictionary(organ, ['front', 'left', 'right', 'tail']),
  });
  const body: Guard = (v) =>
    bodyShape(v) &&
    object(v) &&
    (version === 4
      ? v.placements === undefined && v.appearance === undefined
      : validateLayout(v as BodyDesign) === null);
  const ancestor = shape({
    landWays: optional(
      list(one('companions', 'hunt', 'garden', 'migration'), 4),
    ),
    landLegacy: optional(validLandLegacy),
    tidalLegacy,
    milestone: optional(text),
    generation: integer,
    form: optional(form),
    habitat: optional(one('pond', 'ocean', 'shore', 'land')),
    traits,
    food: nonnegative,
    seconds: nonnegative,
    body: optional(body),
    adaptation: optional(one('skin', 'reservoir')),
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    landOrgan: optional(landOrgan),
    landFeatures: optional(validLandFeatures),
  });
  const history = list(ancestor, 1000);
  const baseCheckpoint = {
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    tidalLegacy,
    seed: num,
    generation: integer,
    time: nonnegative,
    totalFood: nonnegative,
    history,
    traits,
    startingDna: optional((v) => nonnegative(v) && (v as number) <= 24),
    startingBody: optional(body),
    startingForm: optional(
      one('colony', 'bilateral', 'radial', 'fish', 'jelly'),
    ),
    standalone: bool,
  };
  const shoreCheckpoint = {
    ...baseCheckpoint,
    age: optional(nonnegative),
    form,
    body,
    biomass: nonnegative,
    startingTier: optional(one(0, 1, 2)),
    protection: optional(protection),
    adaptations: optional(validAdaptations),
  };
  const landCheckpoint = {
    ...shoreCheckpoint,
    protection,
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
  };
  const morph = shape({
    from: form,
    fromBody: optional(body),
    to: optional(form),
    elapsed: nonnegative,
    duration: (v) => num(v) && (v as number) > 0,
  });
  const commonStage = {
    body,
    biomass: nonnegative,
    tier: one(0, 1, 2),
    visited: list(text),
    skillCooldown: nonnegative,
    skillActive: nonnegative,
    morph: nullable(morph),
  };
  const migrationShape = shape({
    route: one(null, 'hunt', 'filter'),
    station: one(0, 1, 2),
    progress: (v) => nonnegative(v) && (v as number) <= 6,
    expanded: bool,
    elapsed: nonnegative,
    arrived: bool,
    legs: list(one('hunt', 'filter'), 2),
  });
  const validMigration: Guard = (v) => {
    if (!migrationShape(v) || !object(v)) return false;
    return (
      (v.legs as unknown[]).length === v.station &&
      (!v.arrived || v.station === 2) &&
      (!v.expanded || (v.route === 'filter' && (v.station as number) < 2)) &&
      (v.station !== 2 || v.progress === 0) &&
      (v.route !== null || (v.station === 0 && v.progress === 0 && !v.expanded))
    );
  };
  const ocean = shape({
    tidal: version === 5 ? optional(validTidalState) : (v) => v === undefined,
    migration: optional(validMigration),
    ...commonStage,
    checkpoint: shape(baseCheckpoint),
    ...numbers('dna blocks defenseFlash eaten gulp enteredAt'),
    discovered: list(organ, version === 4 ? 4 : 12),
    observation: dictionary(
      nonnegative,
      version === 4
        ? ['jaw', 'fin', 'spine', 'filter']
        : [
            'jaw',
            'fin',
            'spine',
            'filter',
            'shell',
            'grasp',
            'lateral',
            'reserve',
            'sail',
            'ink',
            'glow',
            'anchor',
          ],
    ),
    branch: one(null, 'radial', 'bilateral'),
    shoal: list(
      shape({
        ...vec,
        ...numbers('id radius baseRadius angle cooldown stun'),
        home: shape(vec),
        fleeing: bool,
      }),
    ),
    meals: list(
      shape({
        ...vec,
        ...numbers('radius angle elapsed duration'),
        eaterId: nullable(num),
      }),
    ),
  });
  const shoreShape = shape({
    tidalResidents:
      version === 5
        ? optional(
            (v) =>
              Array.isArray(v) &&
              v.length <= 32 &&
              new Set(v.map((r) => r?.originId)).size === v.length &&
              v.every(shape({ ...vec, originId: text, angle: num })),
          )
        : (v) => v === undefined,
    ...commonStage,
    checkpoint: shape(shoreCheckpoint),
    protection,
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    moisture: nonnegative,
    blocked: nonnegative,
    dryWarning: bool,
    shelters: optional(
      (v) =>
        Array.isArray(v) &&
        v.length <= 3 &&
        v.every(
          shape({
            ...vec,
            builtAt: nonnegative,
            life: (v) => nonnegative(v) && (v as number) <= 210,
          }),
        ),
    ),
    fieldNotes: optional(
      shape({
        shelterSeconds: optional((v) => nonnegative(v) && (v as number) <= 6),
        drySeconds: nonnegative,
        safeReturns: integer,
        harvestCycles: dictionary(integer, ['landing', 'fern']),
      }),
    ),
    discovered: list(text),
    observation: dictionary(nonnegative),
    creatures: list(
      shape({
        ...vec,
        id: integer,
        role: one('ally', 'rival', 'guardian'),
        home: shape(vec),
        angle: num,
        stun: nonnegative,
        joined: bool,
        alert: bool,
      }),
    ),
  });
  const shore: Guard = (v) =>
    shoreShape(v) &&
    object(v) &&
    (v.tidalResidents === undefined ||
      (object(v.checkpoint) &&
        object(v.checkpoint.tidalLegacy) &&
        Array.isArray(v.checkpoint.tidalLegacy.companions) &&
        Array.isArray(v.tidalResidents) &&
        v.tidalResidents.length ===
          v.checkpoint.tidalLegacy.companions.length &&
        v.tidalResidents.every(
          (r) =>
            object(r) &&
            v.checkpoint &&
            object(v.checkpoint) &&
            object(v.checkpoint.tidalLegacy) &&
            (v.checkpoint.tidalLegacy.companions as string[]).includes(
              r.originId as string,
            ),
        )));
  const species = one(...LAND_SPECIES.map((s) => s.id));
  const landShape = shape({
    focus: optional(one('wander', 'companions', 'hunt', 'garden', 'settle')),
    destination: optional(one(0, 1, 2, 3, 4, 5)),
    features: optional(validLandFeatures),
    activeFeature: optional(one(...Object.keys(LAND_FEATURES))),
    featureCooldown: optional(nonnegative),
    featureActive: optional(nonnegative),
    cachedFood: optional(one(0, 3)),
    sifting: optional(bool),
    camps: optional(
      list(
        shape({ ...vec, life: (v) => nonnegative(v) && (v as number) <= 180 }),
        3,
      ),
    ),
    ecology: optional(
      dictionary(
        (v) => nonnegative(v) && (v as number) <= 12,
        ['0', '1', '2', '3', '4', '5'],
      ),
    ),
    groveHarvests: optional(list(one(1000, 1001, 1002, 1003), 4)),
    drought: optional(validLandDrought),
    ...commonStage,
    checkpoint: shape({
      ...landCheckpoint,
      shoreCompanions: optional(list(integer, 100)),
      features: optional(validLandFeatures),
      startingTier: optional(one(0, 1, 2)),
      organ: optional(nullable(landOrgan)),
    }),
    protection,
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    organ: nullable(landOrgan),
    nests: list(one(0, 1, 2), 3),
    seedPod: optional(
      shape({
        stage: one('unseen', 'seen', 'carried', 'eaten', 'planted'),
        nest: nullable(one(0, 1, 2)),
        waters: one(0, 1, 2, 3),
        cooldown: nonnegative,
      }),
    ),
    discovered: list(species, 18),
    observation: dictionary(
      nonnegative,
      LAND_SPECIES.map((s) => s.id),
    ),
    sneaking: bool,
    ...numbers('moisture hunts impact nutrition meatId stolen'),
    pounce: nullable(
      shape({ angle: num, remaining: nonnegative, hit: bool, ambush: bool }),
    ),
    creatures: list(
      shape({
        ...vec,
        ...numbers(
          'id angle health friendship respawn stun trustCooldown flash carrying reaction suspicion escape',
        ),
        species,
        shoreOrigin: optional(integer),
        home: shape(vec),
        joined: bool,
        alert: bool,
        task: one('follow', 'forage', 'return'),
        targetFood: nullable(integer),
      }),
    ),
    meat: list(shape({ ...vec, ...numbers('id value life eating'), species })),
  });
  const land: Guard = (v) => {
    if (!landShape(v) || !object(v)) return false;
    if (
      Array.isArray(v.groveHarvests) &&
      (new Set(v.groveHarvests).size !== v.groveHarvests.length ||
        (v.groveHarvests.length > 0 &&
          (!object(v.seedPod) ||
            v.seedPod.stage !== 'planted' ||
            v.seedPod.waters !== 3)))
    )
      return false;
    if (
      v.activeFeature &&
      (!Array.isArray(v.features) || !v.features.includes(v.activeFeature))
    )
      return false;
    if (
      v.sifting &&
      (!Array.isArray(v.features) || !v.features.includes('sift'))
    )
      return false;
    if (!v.drought) return true;
    if (!validLandDrought(v.drought)) return false;
    const d = v.drought;
    return (
      (!d.built || (Array.isArray(v.nests) && v.nests.includes(d.nest))) &&
      (!d.watered ||
        (object(v.seedPod) &&
          v.seedPod.stage === 'planted' &&
          v.seedPod.waters === 3))
    );
  };
  const evolution = nullable(
    shape({
      before: ancestor,
      choice: text,
      generation: integer,
      habitat: one('pond', 'ocean', 'shore', 'land'),
      elapsed: nonnegative,
      duration: (v) => num(v) && (v as number) > 0,
      trial: one(
        'feature',
        'body-test',
        'feed',
        'ocean-skill',
        'shore-return',
        'call',
        'hunt',
        'guard',
      ),
      blocksStart: optional(nonnegative),
      foodStart: nonnegative,
      huntStart: nonnegative,
      nutritionStart: nonnegative,
      distance: nonnegative,
      used: bool,
      hitHealth: nullable(nonnegative),
      complete: bool,
      dismissed: bool,
    }),
  );
  const worldShape = shape({
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    pondLife: optional(validPondLife),
    freeLife: optional(bool),
    tidalLegacy,
    evolution: optional(evolution),
    habitat: one('pond', 'ocean', 'shore', 'land'),
    form,
    mode: one('ready', 'running', 'paused', 'evolving', 'dead', 'won'),
    seed: num,
    time: nonnegative,
    generation: integer,
    age: nonnegative,
    food: nonnegative,
    totalFood: nonnegative,
    traits,
    history,
    explored: list(text),
    reason: text,
    notice: text,
    noticeUntil: num,
    player: shape({
      ...vec,
      ...numbers('vx vy energy health angle invulnerable'),
      dashing: bool,
    }),
    foods: list(
      shape({ ...vec, id: integer, cooldown: nonnegative, rich: bool }),
    ),
    predators: list(
      shape({
        ...vec,
        id: integer,
        angle: num,
        alert: bool,
        stun: nonnegative,
        home: shape(vec),
        radius: optional(num),
        respawn: optional(num),
        bite: optional(num),
      }),
    ),
    particles: list(shape({ ...vec, ...numbers('vx vy life'), color: text })),
    ocean: nullable(ocean),
    shore: nullable(shore),
    land: nullable(land),
  });
  const validWorld: Guard = (v) =>
    worldShape(v) &&
    object(v) &&
    (['ocean', 'shore', 'land'] as const).every((stage) =>
      stage === v.habitat ? v[stage] !== null : v[stage] === null,
    ) &&
    (v.generation as number) >= 1;
  const role = one('food', 'wood', 'guard');
  const validColony: Guard = shape({
    archiveId: optional(integer),
    features: optional(validLandFeatures),
    freeLife: optional(bool),
    tidalLegacy,
    seedLegacy: optional(one('eaten', 'grown')),
    form,
    body,
    traits,
    organ: optional(landOrgan),
    adaptation: optional(one('skin', 'reservoir')),
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    generation: integer,
    history,
    standalone: bool,
    mode: one('ready', 'running', 'paused', 'won', 'lost'),
    time: nonnegative,
    player: shape({
      ...vec,
      angle: num,
      carrying: one(null, 'food', 'wood'),
      load: one(0, 1, 2, 3, 4),
    }),
    members: list(
      shape({
        ...vec,
        id: integer,
        form,
        angle: num,
        role,
        body: optional(body),
        features: optional(validLandFeatures),
        source: optional(
          (v) => typeof v === 'string' && Object.hasOwn(DNA_SOURCES, v),
        ),
        carrying: one(null, 'food', 'wood'),
        target: nullable(integer),
        newborn: bool,
      }),
    ),
    patches: list(
      shape({
        ...vec,
        id: integer,
        kind: one('food', 'wood'),
        cooldown: nonnegative,
      }),
    ),
    food: nonnegative,
    wood: nonnegative,
    shelter: bool,
    integrity: nonnegative,
    growth: (v) =>
      integer(v) &&
      (v as number) >= 0 &&
      (v as number) <= 100 &&
      (v as number) % 5 === 0,
    feedCooldown: nonnegative,
    repairCooldown: nonnegative,
    storm: nullable(nonnegative),
    weatherClock: nonnegative,
    notice: text,
    delivered: nonnegative,
  });
  const validColonySlot = nullable(
    shape({ checkpoint: validColony, current: validColony }),
  );
  const material = one('food', 'wood', 'stone', 'fiber');
  const tribe = shape({
    organization: optional(one('network', 'workshop')),
    freeLife: optional(bool),
    tidalLegacy,
    form,
    body,
    traits,
    organ: optional(landOrgan),
    adaptation: optional(one('skin', 'reservoir')),
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    generation: integer,
    history,
    standalone: bool,
    mode: one('ready', 'running', 'paused', 'won', 'lost'),
    time: nonnegative,
    player: shape({
      ...vec,
      angle: num,
      carrying: nullable(material),
      load: integer,
    }),
    members: list(
      shape({
        ...vec,
        id: integer,
        form,
        angle: num,
        role: one('food', 'wood', 'stone', 'escort'),
        carrying: nullable(material),
        load: integer,
        target: nullable(integer),
        newborn: bool,
      }),
    ),
    stores: shape({
      food: nonnegative,
      wood: nonnegative,
      stone: nonnegative,
      fiber: nonnegative,
    }),
    tools: list(one('basket', 'hammer'), 2),
    patches: list(
      shape({ ...vec, id: integer, kind: material, cooldown: nonnegative }),
    ),
    neighbors: (v) =>
      list(
        shape({
          ...vec,
          id: one('moss', 'reed'),
          met: bool,
          trades: one(0, 1, 2),
          helped: bool,
          trust: one(0, 1, 2),
          builder: shape(vec),
        }),
        2,
      )(v) &&
      Array.isArray(v) &&
      v.length === 2 &&
      new Set(v.map((n) => n.id)).size === 2,
    banks: (v) =>
      list(
        shape({
          ...vec,
          id: one(0, 1, 2),
          paid: bool,
          work: (v) => nonnegative(v) && (v as number) <= 6,
        }),
        3,
      )(v) &&
      Array.isArray(v) &&
      v.length === 3 &&
      new Set(v.map((b) => b.id)).size === 3,
    camp: bool,
    storm: nullable(nonnegative),
    integrity: nonnegative,
    notice: text,
    choices: list(text),
  });
  const validTribeSlot = optional(
    nullable(shape({ checkpoint: tribe, current: tribe })),
  );
  const cityId = one(
    'camp',
    'grove',
    'farm',
    'quarry',
    'power',
    'workshop',
    'relay',
    'port',
  );
  const cityResource = one(
    'food',
    'wood',
    'stone',
    'fiber',
    'ore',
    'energy',
    'parts',
  );
  const cityShape = shape({
    freeLife: optional(bool),
    tidalLegacy,
    form,
    body,
    traits,
    organ: optional(landOrgan),
    adaptation: optional(one('skin', 'reservoir')),
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    generation: integer,
    history,
    standalone: bool,
    mode: one('ready', 'running', 'paused', 'won', 'lost'),
    choices: list(text),
    time: nonnegative,
    nodes: list(
      shape({
        ...vec,
        id: cityId,
        built: bool,
        clock: nonnegative,
        stock: shape({
          food: nonnegative,
          wood: nonnegative,
          stone: nonnegative,
          fiber: nonnegative,
          ore: nonnegative,
          energy: nonnegative,
          parts: nonnegative,
        }),
      }),
      8,
    ),
    couriers: list(
      shape({
        ...vec,
        id: text,
        form,
        newborn: bool,
        route: nullable(
          shape({
            from: cityId,
            to: cityId,
            resource: cityResource,
            safe: bool,
          }),
        ),
        cargo: nullable(cityResource),
        load: integer,
        destination: nullable(cityId),
        path: list(shape(vec), 4),
        angle: num,
        blocked: bool,
      }),
      100,
    ),
    energy: one(null, 'wind', 'fuel'),
    capacity: integer,
    speed: nonnegative,
    crisis: nullable(nonnegative),
    bridgeFixed: bool,
    notice: text,
    produced: integer,
    delivered: integer,
    launched: bool,
  });
  const city: Guard = (v) =>
    cityShape(v) &&
    object(v) &&
    Array.isArray(v.nodes) &&
    v.nodes.length === 8 &&
    new Set(v.nodes.map((n) => n.id)).size === 8 &&
    v.nodes
      .filter((n) => n.id === 'camp' || n.id === 'grove')
      .every((n) => n.built) &&
    Array.isArray(v.couriers) &&
    v.couriers.length > 0 &&
    new Set(v.couriers.map((c) => c.id)).size === v.couriers.length &&
    v.couriers.every((c) => !c.cargo || c.destination !== null);
  const validCitySlot = optional(
    nullable(shape({ checkpoint: city, current: city })),
  );

  const star = one('home', 'beacon', 'tide', 'ember', 'echo'),
    planet = one('tide', 'ember'),
    habitat = one('wetland', 'dome'),
    survey = one('water', 'air');
  const percent: Guard = (v) => nonnegative(v) && (v as number) <= 100;
  const lineage = {
    tidalLegacy,
    form,
    body,
    traits,
    generation: integer,
    history,
    standalone: bool,
    choices: list(text),
  };
  const spaceShape = shape({
    freeLife: optional(bool),
    ...lineage,
    organ: optional(landOrgan),
    adaptation: optional(one('skin', 'reservoir')),
    learning: optional(validLearning),
    dnaLineage: optional(validDnaLineage),
    adaptations: optional(validAdaptations),
    mode: one('ready', 'running', 'paused', 'won', 'lost'),
    time: nonnegative,
    crew: list(shape({ id: text, form, newborn: bool }), 100),
    location: star,
    fuel: nonnegative,
    food: nonnegative,
    parts: nonnegative,
    upgrade: one(null, 'sail', 'shield'),
    flight: nullable(
      shape({
        from: star,
        to: star,
        elapsed: nonnegative,
        duration: (v) => num(v) && (v as number) > 0,
      }),
    ),
    activity: nullable(
      shape({
        kind: one('water', 'air', 'charge', 'supply'),
        remaining: nonnegative,
      }),
    ),
    surveys: shape({ tide: list(survey, 2), ember: list(survey, 2) }),
    visited: list(star, 5),
    relic: bool,
    outpost: nullable(
      shape({
        planet,
        habitat,
        settings: shape({
          water: one(0, 1, 2, 3),
          light: one(0, 1, 2, 3),
          heat: one(0, 1, 2, 3),
        }),
        trial: nullable((v) => nonnegative(v) && (v as number) <= 30),
        growth: percent,
        stability: percent,
        foodClock: nonnegative,
      }),
    ),
    notice: text,
  });
  const space: Guard = (v) =>
    spaceShape(v) &&
    object(v) &&
    Array.isArray(v.crew) &&
    v.crew.length > 0 &&
    new Set(v.crew.map((c) => c.id)).size === v.crew.length &&
    object(v.surveys) &&
    Array.isArray(v.surveys.tide) &&
    new Set(v.surveys.tide).size === v.surveys.tide.length &&
    Array.isArray(v.surveys.ember) &&
    new Set(v.surveys.ember).size === v.surveys.ember.length &&
    (!object(v.outpost) || (v.outpost.planet === v.location && !v.flight)) &&
    (v.mode !== 'won' ||
      (object(v.outpost) &&
        v.outpost.trial === 30 &&
        Number(v.outpost.growth) >= 100 &&
        Number(v.outpost.stability) >= 45));
  const validSpaceSlot = optional(
    nullable(shape({ checkpoint: space, current: space })),
  );
  const validExpeditions = optional(
    list(
      shape({
        ...lineage,
        organ: optional(landOrgan),
        adaptation: optional(one('skin', 'reservoir')),
        learning: optional(validLearning),
        dnaLineage: optional(validDnaLineage),
        adaptations: optional(validAdaptations),
        id: integer,
        planet,
        habitat,
        crew: integer,
        stability: percent,
      }),
    ),
  );

  const biologicalShape = shape({
    id: integer,
    title: text,
    generation: integer,
    seconds: nonnegative,
    history: list(ancestor, 80),
    form,
    body,
    traits,
    dnaLineage: optional(validDnaLineage),
    features: validLandFeatures,
    descendants: list(
      shape({
        ...vec,
        id: integer,
        form,
        angle: num,
        role,
        carrying: one(null, 'food', 'wood'),
        target: nullable(integer),
        newborn: bool,
        body: optional(body),
        features: optional(validLandFeatures),
        source: optional(
          (v) => typeof v === 'string' && Object.hasOwn(DNA_SOURCES, v),
        ),
      }),
      100,
    ),
    integrity: (v) => num(v) && (v as number) > 0 && (v as number) <= 100,
    seedLegacy: optional(one('eaten', 'grown')),
  });
  const validBiologicalRecords: Guard = (v) =>
    v === undefined ||
    (list(biologicalShape, 12)(v) &&
      Array.isArray(v) &&
      new Set(v.map((r) => r.id)).size === v.length &&
      v.every(
        (r) =>
          r.id > 0 &&
          r.descendants.some((m: { newborn: boolean }) => m.newborn),
      ));
  return {
    validBiologicalRecords,
    validWorld,
    validColony,
    validColonySlot,
    validTribeSlot,
    validCitySlot,
    validSpaceSlot,
    validExpeditions,
  };
}
export const {
  validWorld,
  validColony,
  validColonySlot,
  validTribeSlot,
  validCitySlot,
  validSpaceSlot,
  validExpeditions,
} = createSaveGuards(5);
