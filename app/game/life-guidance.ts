import type { World } from './simulation.ts';
import { distance, NURSERY } from './simulation.ts';
import type { Navigation } from './navigation.ts';
import { nextGenerationCandidates } from './biological-evolution.ts';
import { oceanDnaGuide } from './ocean-dna.ts';
import type { OceanDnaBody } from './ocean-dna.ts';
import { OCEAN_NURSERY } from './ocean.ts';
import { SHORE_SPECIMENS, SHORE_POOLS } from './shore.ts';
import { LAND_NESTS, LAND_ROCKS, SPECIES_NAMES } from './land.ts';
import { isLandPredator } from './land-catalog.ts';
import { DNA_SOURCES } from './dna-evolution.ts';
import { organZones, worldBodyPose } from './body-geometry.ts';
import { journeyTarget } from './world-guidance.ts';
export type LifeDestination = Omit<Navigation, 'last' | 'stalled' | 'path'>;
export function journeyDestination(w: World): LifeDestination {
  return {
    ...currentJourneyDestination(w),
    ...(w.land ? { avoidDanger: true } : {}),
  };
}
export function landJourneyObstacles(w: World) {
  return [
    ...LAND_ROCKS,
    ...(w.land?.creatures ?? [])
      .filter(
        (c) =>
          isLandPredator(c.species) &&
          !c.joined &&
          !c.friendship &&
          c.respawn <= 0,
      )
      .flatMap((c) => [
        { ...c.home, radius: c.species === 'hunter' ? 290 : 145 },
        { x: c.x, y: c.y, radius: 90 },
      ]),
  ];
}
function currentJourneyDestination(w: World): LifeDestination {
  const goal = journeyTarget(w);
  if ('actorId' in goal && goal.actorId)
    return {
      target: { ...goal.point },
      oceanActorId: goal.actorId,
      oceanIntent: goal.intent ?? 'hunt',
    };
  const food = w.ocean?.tidal?.foods.find(
    (f) =>
      f.state === 'available' && !f.reservedFor && distance(f, goal.point) < 1,
  );
  if (food)
    return preciseTidalFood(w, food.id) ?? { target: { ...goal.point } };
  const creature = w.land?.creatures.find(
    (c) => c.respawn <= 0 && !c.joined && distance(c, goal.point) < 1,
  );
  if (creature)
    return {
      target: { ...goal.point },
      landCreatureId: creature.id,
      arrivalRadius: isLandPredator(creature.species) ? 155 : 90,
    };
  return {
    target: { ...goal.point },
    ...(!w.land &&
    !w.ocean &&
    w.foods.some((f) => f.cooldown === 0 && distance(f, goal.point) < 1)
      ? { arrivalRadius: 5 }
      : {}),
  };
}
/** Choose a real provider of the selected recipe. This only guides travel, never grants a receipt. */
export function biologicalSourceGuide(
  w: World,
  id?: string,
  intent: 'hunt' | 'visit' = 'visit',
): { destination: LifeDestination; hint: string } | null {
  const candidate = id
    ? nextGenerationCandidates(w).find((c) => c.id === id)
    : null;
  if (id && !candidate) return null;
  if (w.habitat === 'ocean') {
    const guide = id
      ? oceanDnaGuide(w, id.split(':')[1] as OceanDnaBody)
      : null;
    if (guide?.intent === 'visit' && w.food < 1) {
      const food = w.ocean?.tidal?.foods
        .filter((f) => f.state === 'available' && !f.reservedFor)
        .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
      const destination = food && preciseTidalFood(w, food.id);
      if (destination)
        return { destination, hint: '先补给1份营养，再寻找来源、按 K 与伙伴分享。' };
    }
    return guide
      ? {
          destination: {
            target: guide.point,
            oceanActorId: guide.actorId,
            oceanIntent: guide.intent,
          },
          hint:
            guide.intent === 'visit'
              ? `靠近${guide.name}，按 K 分享营养，等待它吃下。`
              : `追猎${guide.name}，实际吃下才能获得来源。`,
        }
      : { destination: { target: OCEAN_NURSERY }, hint: '返回育生湾。' };
  }
  if (w.habitat === 'shore') {
    const specimen = SHORE_SPECIMENS.find(
      (s) =>
        s.id ===
        (['shore:skin', 'shore:reservoir'].includes(id ?? '')
          ? 'moisture'
          : 'support'),
    );
    const pool = [...SHORE_POOLS].sort(
      (a, b) => distance(a, w.player) - distance(b, w.player),
    )[0];
    return {
      destination: { target: id && specimen ? specimen : pool },
      hint: id ? '接近生物，停下来观察两秒。' : '返回潮池补水。',
    };
  }
  if (w.habitat === 'land' && w.land) {
    if (!id) {
      const nest =
        LAND_NESTS.filter((_, i) => w.land!.nests.includes(i)).sort(
          (a, b) => distance(a, w.player) - distance(b, w.player),
        )[0] ?? LAND_NESTS[0];
      return { destination: { target: nest }, hint: '返回自己的巢穴。' };
    }
    const c = w.land.creatures
      .filter(
        (c) =>
          !c.joined &&
          c.respawn <= 0 &&
          c.shoreOrigin == null &&
          candidate!.sourceIds.includes(`land:${c.species}`) &&
          (id !== 'land:stalker' || isLandPredator(c.species)),
      )
      .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
    if (!c) return null;
    return {
      destination: {
        target: { x: c.x, y: c.y },
        landCreatureId: c.id,
        arrivalRadius: isLandPredator(c.species) ? 155 : 140,
      },
      hint: `接近${SPECIES_NAMES[c.species]}并观察两秒${id === 'land:crest' ? '，再按 K 支付食物邀请同行' : ''}。WASD 可接管。`,
    };
  }
  if (!id) return { destination: { target: NURSERY }, hint: '返回育生水域。' };
  const p = w.pondLife?.prey
    .filter((p) => p.cooldown === 0 && candidate!.sourceIds.includes(p.species))
    .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
  return p
    ? {
        destination: {
          target: { x: p.x, y: p.y },
          preyId: p.id,
          pondIntent: intent,
        },
        hint:
          intent === 'hunt'
            ? `追猎${DNA_SOURCES[p.species].name}。`
            : `靠近${DNA_SOURCES[p.species].name}观察，或按 K 分享1营养，等待它吃下。`,
      }
    : null;
}
export function refreshLandSource(w: World, n: Navigation) {
  const c = w.land?.creatures.find(
    (c) => c.id === n.landCreatureId && !c.joined && c.respawn <= 0,
  );
  if (!c) return false;
  if (distance(c, n.target) > 25) n.path = undefined;
  n.target = { x: c.x, y: c.y };
  return true;
}
/** Place the trunk so its real mouth, rather than the body's center, reaches a food. */
export function preciseTidalFood(
  w: World,
  id: string,
  heading?: number,
): LifeDestination | null {
  const f = w.ocean?.tidal?.foods.find(
    (f) => f.id === id && f.state === 'available' && !f.reservedFor,
  );
  if (!f) return null;
  const angle = heading ?? Math.atan2(f.y - w.player.y, f.x - w.player.x);
  const mouth = organZones({ ...worldBodyPose(w), angle }, 'jaw')[0];
  return {
    target: mouth
      ? { x: f.x - (mouth.x - w.player.x), y: f.y - (mouth.y - w.player.y) }
      : { x: f.x, y: f.y },
    arrivalRadius: 5,
    foodId: id,
    foodHeading: angle,
  };
}
