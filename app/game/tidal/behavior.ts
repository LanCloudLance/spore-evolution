import type { World, Vec } from '../simulation.ts';
import { distance } from '../simulation.ts';
import { bodyRadius, canSwallow } from '../food-chain.ts';
import { hasOrgan } from '../body-layout.ts';
import { face } from '../motion.ts';
import { TIDAL_BIOMES, TIDAL_SPECIES } from './catalog.ts';
import { biomeAt, tidalFlow, tidalCover } from './habitat.ts';
import type { TidalActor, SignalKind } from './types.ts';

export type Intent = {
  point: Vec;
  speed: number;
  food?: string;
  carry?: string;
  prey?: string;
  evidence?: SignalKind;
};
export function tidalIntent(w: World, a: TidalActor, dt: number): Intent {
  const t = w.ocean!.tidal!,
    d = TIDAL_SPECIES.find((s) => s.id === a.species)!;
  const home = TIDAL_BIOMES.find((b) => b.id === a.homeBiome)!;
  const stay = { point: { x: a.x, y: a.y }, speed: 0 };
  const predators = t.actors.filter(
    (other) =>
      other !== a &&
      other.health > 0 &&
      canSwallow(other.radius, a.radius) &&
      TIDAL_SPECIES.find((s) => s.id === other.species)!.diet.includes(
        'prey',
      ) &&
      distance(a, other) < 170,
  );
  const shared = t.foods.some(
    (f) => f.reservedFor === a.id && f.state !== 'consumed',
  );
  const playerThreat =
    !shared &&
    !(a.trust >= 20) &&
    hasOrgan(w.ocean!.body, 'jaw') &&
    canSwallow(bodyRadius(w), a.radius) &&
    distance(a, w.player) <
      150 +
        (hasOrgan(w.ocean!.body, 'glow') ? 35 : 0) +
        (t.regions[a.homeBiome]?.harvestPressure ?? 0) * 12;
  const threat = playerThreat
    ? w.player
    : predators.sort((x, y) => distance(a, x) - distance(a, y))[0];
  if (
    threat &&
    d.trait !== 'anchor' &&
    a.species !== 'great-ray' &&
    !d.diet.includes('prey')
  ) {
    if (
      a.species === 'thornpuffer' ||
      a.species === 'shellsnail' ||
      d.trait === 'armor'
    ) {
      a.behavior = 'defend';
      a.phaseSeconds = 2.5;
      a.angle = face(
        a.angle,
        Math.atan2(threat.y - a.y, threat.x - a.x) +
          (a.species === 'thornpuffer' ? Math.PI : 0),
        dt,
        30,
      );
      a.targetId = 'id' in threat ? String(threat.id) : 'player';
      return stay;
    }
    const entered = a.behavior !== 'flee';
    a.behavior = 'flee';
    a.targetId = 'id' in threat ? String(threat.id) : 'player';
    // Schools part; individuals use their own offset instead of collapsing to one point.
    const angle = Math.atan2(a.y - threat.y, a.x - threat.x);
    return {
      point: { x: a.x + Math.cos(angle) * 180, y: a.y + Math.sin(angle) * 180 },
      speed: d.speed,
      evidence: entered
        ? (a.species === 'silver-dart' || d.trait === 'school') &&
          !playerThreat &&
          tidalCover(threat) > 0.5
          ? 'shoal-avoid'
          : 'flee'
        : undefined,
    };
  }
  if (a.behavior === 'digest' && a.phaseSeconds > 0) {
    a.phaseSeconds = Math.max(0, a.phaseSeconds - dt);
    a.targetId = null;
    return stay;
  }
  if (a.species === 'great-ray' && distance(a, w.player) < 150) {
    a.behavior = 'home';
    a.targetId = null;
    return {
      point: {
        x: a.x + (a.x - w.player.x) * 2,
        y: a.y + (a.y - w.player.y) * 2,
      },
      speed: d.speed,
    };
  }
  if (a.species === 'lantern-drifter') {
    const flow = tidalFlow(a, t.tick);
    if (Math.hypot(flow.x, flow.y) > 60) {
      a.behavior = 'defend';
      a.phaseSeconds = 1;
      return {
        point: { x: a.x + flow.x, y: a.y + flow.y },
        speed: Math.hypot(flow.x, flow.y) * 0.15,
      };
    }
  }
  if (
    !shared &&
    a.species === 'moss-crab' &&
    distance(w.player, home) < 190 &&
    distance(a, w.player) < 130
  ) {
    a.behavior = 'defend';
    a.phaseSeconds = 1;
    a.angle = face(
      a.angle,
      Math.atan2(w.player.y - a.y, w.player.x - a.x),
      dt,
      12,
    );
    t.regions[a.homeBiome].alert = Math.min(
      home.alertCap,
      t.regions[a.homeBiome].alert + dt * 0.15,
    );
    return stay;
  }
  if (a.carryingId) {
    a.behavior = 'carry';
    a.targetId = null;
    const destination =
      a.species === 'scavenger-shrimp' ? { x: 2290, y: 1350 } : home;
    return { point: destination, speed: d.speed * 0.85 };
  }
  if (a.species === 'ribbonfish' && a.targetId?.startsWith('way:')) {
    const destination = TIDAL_BIOMES.find((b) => b.id === a.targetId!.slice(4));
    if (!destination) {
      a.targetId = null;
      a.behavior = 'forage';
      return stay;
    }
    if (distance(a, destination) < 190) {
      a.targetId = null;
      a.behavior = 'forage';
      a.phaseSeconds = 0;
      return { ...stay, evidence: 'ribbon-leg' };
    }
    a.behavior = 'home';
    return { point: destination, speed: d.speed };
  }
  if (
    ['ribbonfish', 'pipe-seahorse'].includes(a.species) &&
    a.trust >= 20 &&
    distance(a, w.player) < 450
  ) {
    a.behavior = 'follow';
    a.targetId = 'player';
    return {
      point: {
        x: w.player.x - Math.cos(w.player.angle) * 100,
        y: w.player.y - Math.sin(w.player.angle) * 100,
      },
      speed: d.speed * 1.2,
    };
  }
  const bait = t.foods
    .filter(
      (f) =>
        f.state === 'available' &&
        f.offeredBy === 'player' &&
        d.diet.includes(f.kind) &&
        distance(a, f) < 360,
    )
    .sort((x, y) => distance(a, x) - distance(a, y))[0];
  if (bait && a.hunger > 20 && d.diet.includes('prey')) {
    a.behavior = 'forage';
    a.targetId = bait.id;
    return { point: bait, speed: d.speed, food: bait.id };
  }
  if (
    a.species === 'crested-hunter' &&
    t.events.active === 'hunter-visit' &&
    ['warning', 'active'].includes(t.events.phase) &&
    distance(a, { x: 810, y: 1770 }) > 90
  ) {
    a.behavior = 'home';
    a.targetId = null;
    return { point: { x: 810, y: 1770 }, speed: d.speed };
  }
  if (d.diet.includes('prey') && a.hunger > 25) {
    const prey = t.actors
      .filter(
        (p) =>
          p !== a &&
          p.health > 0 &&
          p.respawnSeconds === 0 &&
          canSwallow(a.radius, p.radius) &&
          p.species !== 'great-ray' &&
          distance(a, p) < 260,
      )
      .sort((x, y) => distance(a, x) - distance(a, y))[0];
    const player =
      distance(w.player, home) > 350 &&
      distance(a, w.player) < (hasOrgan(w.ocean!.body, 'glow') ? 270 : 220) &&
      canSwallow(a.radius, bodyRadius(w));
    const target = prey ?? (player ? w.player : null),
      id = prey?.id ?? 'player';
    if (target) {
      if (a.targetId !== id || a.behavior !== 'ambush') {
        a.targetId = id;
        a.phaseSeconds = 0;
      }
      a.behavior = 'ambush';
      a.phaseSeconds += dt;
      if (a.phaseSeconds < 0.6) {
        a.angle = face(
          a.angle,
          Math.atan2(target.y - a.y, target.x - a.x),
          dt,
          20,
        );
        return stay;
      }
      if (a.phaseSeconds > 1.6) {
        a.behavior = 'digest';
        a.phaseSeconds = 1;
        a.targetId = null;
        return stay;
      }
      return {
        point: {
          x: a.x + Math.cos(a.angle) * 100,
          y: a.y + Math.sin(a.angle) * 100,
        },
        speed:
          d.speed *
          (a.species === 'crested-hunter' || d.trait === 'ambush' ? 1.8 : 1.2),
        prey: id,
      };
    }
    a.targetId = null;
  }
  if (a.behavior === 'defend' && a.phaseSeconds > 0) {
    a.phaseSeconds = Math.max(0, a.phaseSeconds - dt);
    return stay;
  }
  const meal = t.foods
    .filter(
      (f) =>
        f.state === 'available' &&
        (!f.reservedFor || f.reservedFor === a.id) &&
        d.diet.includes(f.kind) &&
        distance(a, f) < 360,
    )
    .sort(
      (x, y) =>
        Number(y.reservedFor === a.id) - Number(x.reservedFor === a.id) ||
        distance(a, x) - distance(a, y),
    )[0];
  if (meal && (a.hunger > 20 || meal.reservedFor === a.id)) {
    a.behavior = 'forage';
    a.targetId = meal.id;
    return {
      point: meal,
      speed: d.speed,
      food: meal.id,
      carry:
        ['moss-crab', 'scavenger-shrimp', 'burrow-crab'].includes(a.species) &&
        meal.reservedFor !== a.id
          ? meal.id
          : undefined,
    };
  }
  a.targetId = null;
  a.behavior = 'home';
  a.phaseSeconds += dt;
  if (a.species === 'thinwing' && a.phaseSeconds >= 8) {
    a.behavior = 'digest';
    a.phaseSeconds = 4;
    return stay;
  }
  if (d.trait === 'anchor') return stay;
  if (d.trait === 'school') {
    const school = t.actors.filter(
      (other) => other !== a && other.species === a.species && other.health > 0,
    );
    if (school.length)
      return {
        point: {
          x:
            school.reduce((n, s) => n + s.x, 0) / school.length +
            Math.sin(w.time + Number(a.id.split(':')[1])) * 45,
          y:
            school.reduce((n, s) => n + s.y, 0) / school.length +
            Math.cos(w.time + Number(a.id.split(':')[1])) * 45,
        },
        speed: d.speed * 0.45,
      };
  }
  const region = biomeAt(a) === 'estuary' ? TIDAL_BIOMES[3] : home;
  return {
    point: {
      x: region.x + Math.cos(w.time * 0.15 + a.id.length) * 110,
      y: region.y + Math.sin(w.time * 0.11 + a.id.length) * 85,
    },
    speed: d.speed * 0.35,
  };
}
