import type { World, Vec } from './simulation.ts';
import { distance } from './simulation.ts';
import type { LandCreature } from './land.ts';
import { LAND_AREAS, LAND_PONDS } from './land.ts';
import { landSpecies } from './land-catalog.ts';
import { droughtDry } from './land-drought.ts';
import { hasLandFeature } from './land-features.ts';
import { strikePrey } from './land-hunt.ts';
import { worldBodyPose, organTouches } from './body-geometry.ts';
export function landEcologyGoal(
  w: World,
  c: LandCreature,
  dt: number,
): { target: Vec; speed: number } | null {
  const meta = landSpecies(c.species),
    s = w.land!;
  if (['fern', 'grazer', 'hunter'].includes(c.species) || c.joined) return null;
  const d = distance(c, w.player),
    scared = c.alert,
    pressure = s.ecology?.[landArea(c.home)] ?? 0;
  if (['roots', 'garden'].includes(meta.behavior))
    for (const f of w.foods)
      if (distance(c, f) < 130)
        f.cooldown = Math.max(
          0,
          f.cooldown - dt * (meta.behavior === 'roots' ? 1.5 : 0.6),
        );
  if (meta.behavior === 'scavenge') {
    const meat = s.meat.find((m) => m.life > 0 && distance(m, c) < 280);
    if (meat) {
      if (distance(c, meat) < 30) meat.life = 0;
      return { target: meat, speed: 60 };
    }
  }
  if (meta.behavior === 'alarm' && d < 180 && w.form === 'stalker')
    for (const other of s.creatures)
      if (other !== c && !other.joined && distance(c, other) < 230) {
        other.suspicion = Math.max(0.8, other.suspicion);
        other.reaction = 1;
      }
  if (meta.behavior === 'pack') {
    const nearest = s.creatures
      .filter(
        (a) => a !== c && a.respawn <= 0 && !a.joined && distance(c, a) < 220,
      )
      .sort((a, b) => distance(c, a) - distance(c, b))[0];
    if (nearest && !scared)
      return {
        target: { x: nearest.x - 55, y: nearest.y + 60 },
        speed: distance(c, nearest) > 90 ? 65 : 0,
      };
  }
  if (
    (meta.behavior === 'burrow' || c.species === 'shell-grazer') &&
    droughtDry(w)
  )
    return { target: c.home, speed: 30 };
  if (meta.behavior === 'wet' || (meta.behavior === 'sift' && droughtDry(w))) {
    const pool = droughtDry(w)
      ? LAND_PONDS[2]
      : [...LAND_PONDS].sort((a, b) => distance(c, a) - distance(c, b))[0];
    return {
      target: {
        x: pool.x + Math.cos(w.time * 0.2 + c.id) * 35,
        y: pool.y + Math.sin(w.time * 0.2 + c.id) * 35,
      },
      speed: 50,
    };
  }
  if (meta.behavior === 'ambush' || meta.behavior === 'charge') {
    const threat =
      !c.friendship && d < (meta.behavior === 'ambush' ? 135 : 120);
    if (threat && w.player.invulnerable <= 0 && d < meta.radius + 38) {
      if (
        organTouches(worldBodyPose(w), { ...c, radius: meta.radius }, 'spine')
      )
        c.stun = 2;
      else {
        const company = s.creatures.some(
          (f) => f.joined && distance(f, w.player) < 190,
        );
        w.player.health -=
          (meta.behavior === 'charge' ? 14 : 10) *
          (s.organ === 'plates' ? 0.6 : 1) *
          (company ? (hasLandFeature(w, 'herd') ? 0.45 : 0.7) : 1);
        w.player.invulnerable = 1.3;
        c.stun = meta.behavior === 'charge' ? 2 : 0.5;
        s.impact = 0.2;
        if (hasLandFeature(w, 'thorns')) {
          strikePrey(w, c, 15);
          c.stun = 1.5;
        }
      }
    }
    return {
      target: threat ? w.player : c.home,
      speed: threat
        ? meta.behavior === 'charge'
          ? 200
          : 155
        : distance(c, c.home) > 25
          ? 40
          : 0,
    };
  }
  if (scared)
    return {
      target: { x: c.x + (c.x - w.player.x), y: c.y + (c.y - w.player.y) },
      speed:
        c.escape <= 0
          ? 55
          : meta.behavior === 'leap'
            ? 185
            : meta.behavior === 'glide'
              ? 170
              : 120,
    };
  if (meta.behavior === 'carry' && c.carrying) {
    if (distance(c, c.home) < 35) {
      c.carrying = 0;
      c.reaction = 2;
    }
    return { target: c.home, speed: 65 };
  }
  const food = w.foods.find(
    (f) => f.cooldown === 0 && distance(f, c.home) < 210,
  );
  if (food && distance(c, food) < 22) {
    food.cooldown = 32 + pressure * 3;
    if (meta.behavior === 'carry') c.carrying = 1;
  }
  if (meta.behavior === 'glide' && !food)
    return {
      target: {
        x: c.home.x + Math.sin(w.time * 0.25) * 120,
        y: c.home.y + Math.cos(w.time * 0.25) * 45,
      },
      speed: 80,
    };
  return {
    target: food ?? c.home,
    speed: food
      ? meta.behavior === 'armor'
        ? 22
        : meta.behavior === 'sift'
          ? 18
          : 35
      : distance(c, c.home) > 30
        ? 30
        : 0,
  };
}
export function landArea(p: Vec) {
  let nearest = 0,
    best = Infinity;
  for (let i = 0; i < LAND_AREAS.length; i++) {
    const d = distance(p, LAND_AREAS[i]);
    if (d < best) {
      nearest = i;
      best = d;
    }
  }
  return nearest;
}
export function noteLandHunt(w: World, c: LandCreature) {
  const e = (w.land!.ecology ??= {}),
    id = landArea(c.home);
  e[id] = Math.min(12, (e[id] ?? 0) + 1);
}
export function stepLandEcology(w: World, dt: number) {
  for (const k of Object.keys(w.land?.ecology ?? {})) {
    const e = w.land!.ecology!;
    e[Number(k)] = Math.max(0, (e[Number(k)] ?? 0) - dt * 0.018);
  }
}
