import { tidalWaypoint } from './tidal/habitat.ts';
import type { World, Vec } from './simulation.ts';
import { distance, announce } from './simulation.ts';
import {
  DNA_SOURCES,
  inheritedDnaOrgans,
  OCEAN_DNA_REQUIREMENTS,
} from './dna-evolution.ts';
import type { DnaSource } from './dna-evolution.ts';
import type { BodyDesign, Organ } from './body-design.ts';
import {
  bodyBirthCost,
  bodyEditGate,
  commitBody,
  validateDesign,
} from './body-design.ts';
import { bodyDraft, placeDraftOrgan } from './tidal/body-draft.ts';
import { hasOrgan, validateLayout } from './body-layout.ts';
import { canSwallow, bodyRadius } from './food-chain.ts';
import type { TidalAction } from './tidal/types.ts';
import { tidalFiltering } from './tidal/abilities.ts';
import { tidalSight } from './tidal/discovery.ts';
export type OceanDnaBody = 'silverflow' | 'shellrunner' | 'fancrest';
export const OCEAN_DNA_BODIES: Record<
  OceanDnaBody,
  {
    name: string;
    benefit: string;
    cost: string;
    length: number;
    width: number;
    needs: { sources: DnaSource[]; units: number }[];
    organs: {
      organ: Organ;
      mount: 'tail' | 'back' | 'front' | 'right';
      t: number;
    }[];
    slots: [TidalAction | null, TidalAction | null];
  }
> = {
  silverflow: {
    name: '银流梭体',
    benefit: '尾鳍推进，侧线显出附近运动的水纹',
    cost: '长身体转弯慢；新增器官增加耗能',
    length: 1.5,
    width: 0.8,
    needs: OCEAN_DNA_REQUIREMENTS.silverflow,
    organs: [
      { organ: 'fin', mount: 'tail', t: 0 },
      { organ: 'lateral', mount: 'right', t: 0.5 },
    ],
    slots: ['form-skill', null],
  },
  shellrunner: {
    name: '甲鳍游体',
    benefit: '尾鳍远行，L缩壳抵御接触伤害',
    cost: '缩壳时很慢，不能冲刺或摄食；宽躯干耗能更高',
    length: 1.2,
    width: 1.3,
    needs: OCEAN_DNA_REQUIREMENTS.shellrunner,
    organs: [
      { organ: 'fin', mount: 'tail', t: 0 },
      { organ: 'shell', mount: 'back', t: 0 },
    ],
    slots: ['form-skill', 'shell'],
  },
  fancrest: {
    name: '扇冠浮游体',
    benefit: 'L展开滤食扇，收集浮游颗粒；关闭后可用嘴捕食',
    cost: '展开时移动缓慢，不能吞食活鱼；维持更多组织消耗能量',
    length: 0.9,
    width: 1.25,
    needs: OCEAN_DNA_REQUIREMENTS.fancrest,
    organs: [{ organ: 'filter', mount: 'front', t: 0.5 }],
    slots: ['form-skill', 'filter'],
  },
};
export function oceanDnaDraft(w: World, id: OceanDnaBody): BodyDesign | null {
  if (!w.ocean || !Object.hasOwn(OCEAN_DNA_BODIES, id)) return null;
  const form = OCEAN_DNA_BODIES[id];
  let draft = bodyDraft(w.ocean.body);
  draft.length = form.length;
  draft.width = form.width;
  for (const part of form.organs) {
    if (hasOrgan(draft, part.organ) && part.organ !== 'fin') continue;
    const offsets = [part.t, 0, 0.5, -0.5, 1, -1];
    const t = offsets.find(
      (t) =>
        !draft.placements!.some((p) => p.mount === part.mount && p.t === t),
    );
    if (
      part.organ === 'fin' &&
      draft.placements!.some((p) => p.organ === 'fin' && p.mount === 'tail')
    )
      continue;
    if (t === undefined || draft.placements!.length >= 8) return null;
    draft = placeDraftOrgan(draft, part.organ, part.mount, t);
  }
  return validateLayout(draft) ? null : draft;
}
export function oceanDnaCandidates(w: World) {
  return (Object.keys(OCEAN_DNA_BODIES) as OceanDnaBody[]).map((id) => {
    const form = OCEAN_DNA_BODIES[id];
    const missing = form.needs.filter(
      (need) =>
        need.sources.reduce(
          (n, s) => n + (w.dnaLineage?.sources[s]?.units ?? 0),
          0,
        ) < need.units,
    );
    const draft = oceanDnaDraft(w, id);
    const known = w.ocean
      ? {
          ...w,
          ocean: {
            ...w.ocean,
            branch:
              id === 'fancrest' ? ('radial' as const) : ('bilateral' as const),
            discovered: [
              ...new Set([...w.ocean.discovered, ...inheritedDnaOrgans(w)]),
            ],
          },
        }
      : w;
    const gate = missing.length
      ? missing
          .map(
            (n) =>
              `${n.sources.map((s) => DNA_SOURCES[s].name).join(' / ')} DNA ≥${n.units}`,
          )
          .join(' · ')
      : !draft
        ? '器官位置已满，先自行腾出位置。'
        : bodyEditGate(w) || validateDesign(known, draft, true);
    return {
      id,
      ...form,
      draft,
      available: missing.length === 0,
      gate,
      costDna: draft ? bodyBirthCost(w, draft) : 0,
    };
  });
}
export function commitOceanDna(w: World, id: OceanDnaBody) {
  if (!w.ocean || w.ocean.tidal?.compat.mode !== 'active') return false;
  const candidate = oceanDnaCandidates(w).find((c) => c.id === id);
  if (!candidate || candidate.gate || !candidate.draft) return false;
  // Validate on a detached copy so unavailable or unaffordable births leave the live world untouched.
  const next = structuredClone(w);
  next.ocean!.discovered = [
    ...new Set([...next.ocean!.discovered, ...inheritedDnaOrgans(next)]),
  ];
  if (!commitBody(next, candidate.draft, candidate.slots, true)) return false;
  const tier = Math.min(2, w.ocean.tier + 1) as 1 | 2;
  const branch = id === 'fancrest' ? 'radial' : 'bilateral';
  const form =
    branch === 'radial'
      ? tier === 1
        ? 'radial'
        : 'jelly'
      : tier === 1
        ? 'bilateral'
        : 'fish';
  next.form = form;
  next.ocean!.tier = tier;
  next.ocean!.branch = branch;
  if (next.ocean!.morph) {
    next.ocean!.morph.from = w.form;
    next.ocean!.morph.to = form;
  }
  next.dnaLineage ??= { body: 'ancestor', sources: {} };
  next.dnaLineage.oceanBody = id;
  if (next.evolution) next.evolution.choice = `ocean-dna:${id}`;
  announce(next, `${candidate.name}诞生 · ${candidate.benefit}`);
  Object.assign(w, next);
  return true;
}
export function targetOceanPrey(w: World, point: Vec): string | null {
  if (
    w.habitat !== 'ocean' ||
    w.mode !== 'running' ||
    !w.ocean?.tidal ||
    w.ocean.morph ||
    !hasOrgan(w.ocean.body, 'jaw') ||
    tidalFiltering(w)
  )
    return null;
  return (
    w.ocean.tidal.actors
      .filter(
        (a) =>
          a.health > 0 &&
          a.species !== 'great-ray' &&
          canSwallow(bodyRadius(w), a.radius) &&
          distance(a, w.player) <= 500 &&
          distance(a, point) <= a.radius + 12 &&
          tidalSight(w.player, a),
      )
      .sort((a, b) => distance(a, point) - distance(b, point))[0]?.id ?? null
  );
}
export function guideOceanActor(
  w: World,
  id: string,
  intent: 'hunt' | 'visit',
) {
  if (
    w.habitat !== 'ocean' ||
    w.mode !== 'running' ||
    !w.ocean?.tidal ||
    w.ocean.morph
  )
    return null;
  const actor = w.ocean.tidal.actors.find((a) => a.id === id && a.health > 0);
  if (!actor) return null;
  const d = distance(w.player, actor);
  if (
    intent === 'hunt' &&
    (!hasOrgan(w.ocean.body, 'jaw') ||
      tidalFiltering(w) ||
      !canSwallow(bodyRadius(w), actor.radius) ||
      actor.species === 'great-ray')
  )
    return null;
  const receipt = w.dnaLineage?.sources[`sea:${actor.species}`];
  if (
    intent === 'visit' &&
    (receipt?.method === 'symbiosis' ||
      (receipt?.methods?.symbiosis ?? 0) > 0) &&
    !w.ocean.tidal.foods.some(
      (f) => f.reservedFor === id && f.state !== 'consumed',
    )
  )
    return null;
  const strength =
    intent === 'visit' ? Math.min(1, Math.max(0, (d - 150) / 40)) : 1;
  const waypoint = tidalWaypoint(
    { ...w.player, radius: bodyRadius(w) * w.ocean.body.width },
    actor,
  );
  const span = distance(w.player, waypoint);
  return {
    target: { x: actor.x, y: actor.y },
    input: {
      x: (strength * (waypoint.x - w.player.x)) / Math.max(1, span),
      y: (strength * (waypoint.y - w.player.y)) / Math.max(1, span),
    },
  };
}

/** Guide to the first missing family, using actual living actors rather than spawning rewards. */
export function oceanDnaGuide(w: World, id: OceanDnaBody) {
  if (!w.ocean?.tidal || !Object.hasOwn(OCEAN_DNA_BODIES, id)) return null;
  const candidate = OCEAN_DNA_BODIES[id];
  const need =
    candidate.needs.find(
      (n) =>
        n.sources.reduce(
          (sum, s) => sum + (w.dnaLineage?.sources[s]?.units ?? 0),
          0,
        ) < n.units,
    ) ?? candidate.needs[0];
  const actors = w.ocean.tidal.actors
    .filter((a) => a.health > 0 && need.sources.includes(`sea:${a.species}`))
    .sort((a, b) => distance(a, w.player) - distance(b, w.player));
  const actor = actors[0];
  if (!actor) return null;
  const intent =
    id === 'shellrunner' ||
    [
      'fanworm',
      'shellsnail',
      'moss-crab',
      'ribbonfish',
      'lantern-drifter',
      'siphon-jelly',
      'vent-tube',
      'burrow-crab',
      'pipe-seahorse',
    ].includes(actor.species)
      ? 'visit'
      : 'hunt';
  return {
    actorId: actor.id,
    point: { x: actor.x, y: actor.y },
    intent: intent as 'visit' | 'hunt',
    name: DNA_SOURCES[`sea:${actor.species}`].name,
  };
}
