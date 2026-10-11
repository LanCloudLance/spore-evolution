import { LAND_SPECIES } from './land-catalog.ts';
import type { LandSpecies } from './land-catalog.ts';
import { TIDAL_SPECIES } from './tidal/catalog.ts';
import type { SpeciesId } from './tidal/types.ts';
import type { Organ } from './body-design.ts';
import type { TraitId, World } from './simulation.ts';
export type DnaSource =
  | 'dart'
  | 'shield'
  | 'feather'
  | 'hunter'
  | `sea:${SpeciesId}`
  | 'shore:support'
  | 'shore:moisture'
  | 'shore:shellbed'
  | 'shore:friend'
  | 'shore:shade'
  | `land:${LandSpecies}`
  | 'land:garden';
export type DnaMethod = 'hunt' | 'symbiosis' | 'observe' | 'practice';
export type OceanDnaBody = 'silverflow' | 'shellrunner' | 'fancrest';
export const OCEAN_DNA_REQUIREMENTS: Record<
  OceanDnaBody,
  { sources: DnaSource[]; units: number }[]
> = {
  silverflow: [
    {
      sources: ['sea:silver-dart', 'sea:thinwing', 'sea:glass-minnow'],
      units: 2,
    },
  ],
  shellrunner: [
    {
      sources: ['sea:silver-dart', 'sea:thinwing', 'sea:glass-minnow'],
      units: 2,
    },
    {
      sources: ['shield', 'sea:shellsnail', 'sea:moss-crab', 'sea:burrow-crab'],
      units: 2,
    },
  ],
  fancrest: [
    {
      sources: [
        'feather',
        'sea:fanworm',
        'sea:lantern-drifter',
        'sea:siphon-jelly',
        'sea:vent-tube',
      ],
      units: 2,
    },
  ],
};
export type MicrobeBody = 'ancestor' | 'stream' | 'bastion' | 'grazer' | 'ram';
export type DnaLineage = {
  body: MicrobeBody;
  oceanBody?: OceanDnaBody;
  sources: Partial<
    Record<
      DnaSource,
      {
        method?: DnaMethod;
        methods?: Partial<Record<DnaMethod, number>>;
        units: number;
        meals: number;
        generation: number;
        generationMeals: number;
      }
    >
  >;
};
type Bearer = { dnaLineage?: DnaLineage };
export const POND_DNA_SOURCES: Record<
  'dart' | 'shield' | 'feather' | 'hunter',
  { name: string; direction: string; color: string }
> = {
  dart: { name: '流鞭微生物', direction: '推进', color: '#8de3ef' },
  shield: { name: '甲泡微生物', direction: '甲壳', color: '#d4bdfa' },
  feather: { name: '绒羽微生物', direction: '摄食', color: '#96efbc' },
  hunter: { name: '池塘捕食者', direction: '防御', color: '#ffce85' },
};
export const DNA_SOURCES = {
  ...POND_DNA_SOURCES,
  'shore:support': { name: '撑地潮虫', direction: '附肢', color: '#d4bdfa' },
  'shore:moisture': {
    name: '潮岸保湿经验',
    direction: '保湿',
    color: '#8de3ef',
  },
  'shore:shellbed': { name: '潮汐贝床', direction: '采食', color: '#96efbc' },
  'shore:shade': { name: '贝叶庇护经验', direction: '保湿', color: '#9fc986' },
  'shore:friend': { name: '潮岸同行者', direction: '协作', color: '#8de3ef' },
  ...Object.fromEntries(
    LAND_SPECIES.map((s) => [
      `land:${s.id}`,
      { name: s.name, direction: s.hint, color: s.color },
    ]),
  ),
  'land:fern': { name: '蕨尾兽', direction: '采食', color: '#96efbc' },
  'land:grazer': { name: '果角兽', direction: '协作', color: '#d4bdfa' },
  'land:hunter': { name: '岩背猎手', direction: '捕猎', color: '#ffce85' },
  'land:garden': { name: '培育果丛经验', direction: '庇护', color: '#96efbc' },
  ...Object.fromEntries(
    TIDAL_SPECIES.map((s) => [
      `sea:${s.id}`,
      {
        name: s.name,
        color: s.color,
        direction: ['silver-dart', 'thinwing'].includes(s.id)
          ? '推进'
          : ['shellsnail', 'moss-crab', 'thornpuffer'].includes(s.id)
            ? '防御'
            : ['fanworm', 'lantern-drifter'].includes(s.id)
              ? '摄食'
              : '适应',
      },
    ]),
  ),
} as Record<DnaSource, { name: string; direction: string; color: string }>;
export function inheritedDnaOrgans(s: Bearer): Organ[] {
  const total = (...ids: DnaSource[]) =>
    ids.reduce((n, id) => n + (s.dnaLineage?.sources[id]?.units ?? 0), 0);
  const organs: Organ[] = [];
  if (
    total('shield', 'sea:shellsnail', 'sea:moss-crab', 'sea:burrow-crab') >= 2
  )
    organs.push('shell');
  if (
    total(
      'feather',
      'sea:fanworm',
      'sea:lantern-drifter',
      'sea:siphon-jelly',
      'sea:vent-tube',
    ) >= 2
  )
    organs.push('filter');
  if (total('hunter', 'sea:thornpuffer') >= 2) organs.push('spine');
  if (total('sea:silver-dart', 'sea:thinwing', 'sea:glass-minnow') >= 2)
    organs.push('lateral');
  if (total('sea:moss-crab', 'sea:scavenger-shrimp') >= 2) organs.push('grasp');
  if (total('sea:ribbonfish', 'sea:pipe-seahorse') >= 2) organs.push('reserve');
  if (total('sea:great-ray', 'sea:brush-ray') >= 2) organs.push('sail');
  if (total('sea:siphon-jelly', 'sea:lantern-drifter') >= 2) organs.push('ink');
  if (total('sea:vent-tube', 'sea:lantern-drifter') >= 2) organs.push('glow');
  if (total('sea:vent-tube', 'sea:burrow-crab') >= 2) organs.push('anchor');
  return organs;
}
export function ingestOceanDna(
  w: World,
  species: SpeciesId,
  method: 'hunt' | 'symbiosis',
) {
  if (
    w.habitat !== 'ocean' ||
    !w.ocean ||
    w.mode !== 'running' ||
    w.player.health <= 0 ||
    !TIDAL_SPECIES.some((s) => s.id === species)
  )
    return 0;
  const gain = accumulateDna(w, `sea:${species}`, method);
  w.ocean.discovered = [
    ...new Set([...w.ocean.discovered, ...inheritedDnaOrgans(w)]),
  ];
  return gain;
}
export const MICROBE_BODIES: Record<
  MicrobeBody,
  {
    name: string;
    traits: TraitId[];
    needs: Partial<Record<DnaSource, number>>;
    benefit: string;
    cost: string;
    length: number;
    width: number;
  }
> = {
  ancestor: {
    name: '延续祖型',
    traits: [],
    needs: {},
    benefit: '自由组合已有结构',
    cost: '保持原有器官代价',
    length: 1,
    width: 1,
  },
  stream: {
    name: '流梭体',
    traits: ['flagellum'],
    needs: { dart: 2 },
    benefit: '身体拉长，游速进一步提升 12%',
    cost: '活动耗能额外增加 15%',
    length: 1.3,
    width: 0.75,
  },
  bastion: {
    name: '甲泡体',
    traits: ['shell', 'vacuole'],
    needs: { shield: 2 },
    benefit: '宽厚储能身体，碰撞伤害进一步减少 15%',
    cost: '游速额外降低 8%',
    length: 0.9,
    width: 1.3,
  },
  grazer: {
    name: '绒冠体',
    traits: ['cilia', 'chloroplast'],
    needs: { feather: 2 },
    benefit: '展开摄食冠，营养摄取范围再增加 24',
    cost: '维持身体额外耗能 10%',
    length: 1.1,
    width: 1.2,
  },
  ram: {
    name: '甲梭体',
    traits: ['flagellum', 'shell'],
    needs: { dart: 2, shield: 2 },
    benefit: '正面冲刺可击晕较大捕食者 2 秒',
    cost: '冲刺每秒额外耗能 4，不会直接吞食大敌',
    length: 1.2,
    width: 1.05,
  },
};
/** Call only when the player has actually swallowed a living pond animal. */
export function ingestPondDna(
  w: World,
  source: string,
  method: DnaMethod = 'hunt',
) {
  if (w.habitat !== 'pond' || w.mode !== 'running' || w.player.health <= 0)
    return 0;
  const id = source.replace(/^pond:/, '') as DnaSource;
  if (!source.startsWith('pond:') || !Object.hasOwn(POND_DNA_SOURCES, id))
    return 0;
  return accumulateDna(w, id, method);
}
export function ingestBiologicalDna(
  w: World,
  id: DnaSource,
  method: DnaMethod,
) {
  if (
    w.mode !== 'running' ||
    w.player.health <= 0 ||
    !Object.hasOwn(DNA_SOURCES, id) ||
    !['hunt', 'symbiosis', 'observe', 'practice'].includes(method) ||
    !id.startsWith(w.habitat === 'ocean' ? 'sea:' : `${w.habitat}:`)
  )
    return 0;
  return accumulateDna(w, id, method);
}
function accumulateDna(w: World, id: DnaSource, method: DnaMethod) {
  const lineage = (w.dnaLineage ??= { body: 'ancestor', sources: {} });
  const receipt = (lineage.sources[id] ??= {
    units: 0,
    meals: 0,
    generation: w.generation,
    generationMeals: 0,
  });
  if (receipt.meals >= 1000000) return 0;
  receipt.method = method;
  // Old receipts have no reconstructable history: count only new events.
  const methods = (receipt.methods ??= {});
  methods[method] = Math.min(1000000, (methods[method] ?? 0) + 1);
  if (receipt.generation !== w.generation) {
    receipt.generation = w.generation;
    receipt.generationMeals = 0;
  }
  const gain =
    receipt.generationMeals === 0 ? 2 : receipt.generationMeals === 1 ? 1 : 0;
  receipt.units = Math.min(3000, receipt.units + gain);
  receipt.meals = Math.min(1000000, receipt.meals + 1);
  receipt.generationMeals = Math.min(1000000, receipt.generationMeals + 1);
  return gain;
}
export function inheritedDna(s: Bearer) {
  return s.dnaLineage ? structuredClone(s.dnaLineage) : undefined;
}
export function microbeCandidates(s: Bearer) {
  return (Object.keys(MICROBE_BODIES) as MicrobeBody[]).map((id) => {
    const body = MICROBE_BODIES[id];
    const missing = Object.entries(body.needs).filter(
      ([source, units]) =>
        (s.dnaLineage?.sources[source as DnaSource]?.units ?? 0) < units!,
    );
    return {
      id,
      ...body,
      available: !missing.length,
      requirement: missing
        .map(
          ([source, units]) =>
            `${DNA_SOURCES[source as DnaSource].name} DNA ${s.dnaLineage?.sources[source as DnaSource]?.units ?? 0}/${units}`,
        )
        .join(' · '),
    };
  });
}
export function microbeEffects(
  s: Bearer,
  body = s.dnaLineage?.body ?? 'ancestor',
) {
  return {
    speed: body === 'stream' ? 1.12 : body === 'bastion' ? 0.92 : 1,
    metabolism: body === 'stream' ? 1.15 : body === 'grazer' ? 1.1 : 1,
    damage: body === 'bastion' ? 0.85 : 1,
    pickup: body === 'grazer' ? 24 : 0,
    dashCost: body === 'ram' ? 4 : 0,
  };
}
export function validDnaLineage(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as DnaLineage;
  if (
    !Object.hasOwn(MICROBE_BODIES, s.body) ||
    (s.oceanBody !== undefined &&
      !['silverflow', 'shellrunner', 'fancrest'].includes(s.oceanBody)) ||
    !s.sources ||
    typeof s.sources !== 'object' ||
    Array.isArray(s.sources)
  )
    return false;
  if (
    !Object.entries(s.sources).every(
      ([id, r]) =>
        Object.hasOwn(DNA_SOURCES, id) &&
        r &&
        (r.method === undefined ||
          ['hunt', 'symbiosis', 'observe', 'practice'].includes(r.method)) &&
        [r.units, r.meals, r.generation, r.generationMeals].every(
          Number.isSafeInteger,
        ) &&
        (r.methods === undefined || validMethods(r.methods, r.meals)) &&
        r.units >= 0 &&
        r.units <= 3000 &&
        r.meals >= 1 &&
        r.meals <= 1000000 &&
        r.units <= r.meals * 2 &&
        r.generation >= 1 &&
        r.generationMeals >= 1 &&
        r.generationMeals <= r.meals,
    )
  )
    return false;
  return (
    (microbeCandidates({ dnaLineage: s }).find((c) => c.id === s.body)
      ?.available ??
      false) &&
    (!s.oceanBody ||
      OCEAN_DNA_REQUIREMENTS[s.oceanBody].every(
        (n) =>
          n.sources.reduce((sum, id) => sum + (s.sources[id]?.units ?? 0), 0) >=
          n.units,
      ))
  );
}

function validMethods(v: unknown, meals: number): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.every(
      ([id, n]) =>
        ['hunt', 'symbiosis', 'observe', 'practice'].includes(id) &&
        Number.isSafeInteger(n) &&
        n > 0,
    ) && entries.reduce((n, [, count]) => n + (count as number), 0) <= meals
  );
}
