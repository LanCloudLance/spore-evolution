import { learnFrom } from './lineage-learning.ts';
import { migrationCatch } from './ocean-migration.ts';
import { organTouches } from './body-geometry.ts';
import { organFaces, blockWithSpine, bodyEffects } from './body-design.ts';
import type { World } from './simulation.ts';
import { FORMS } from './forms.ts';
import { getStats, announce } from './simulation.ts';
import { OCEAN_ROCKS, OCEAN_MAP, OCEAN_NURSERY } from './ocean.ts';
import { face } from './motion.ts';
export type Swimmer = {
  id: number;
  x: number;
  y: number;
  home: { x: number; y: number };
  radius: number;
  baseRadius: number;
  angle: number;
  cooldown: number;
  fleeing: boolean;
  stun: number;
};
export type Meal = {
  x: number;
  y: number;
  radius: number;
  angle: number;
  elapsed: number;
  duration: number;
  eaterId: number | null;
};
export const canSwallow = (large: number, small: number) =>
  large >= small * 1.22;
export const growthScale = (w: World) =>
  1 + ((w.ocean?.biomass ?? 0) / 100) * 1.1;
export const bodyRadius = (w: World) => FORMS[w.form].radius * growthScale(w);
export const sizeRelation = (w: World, r: number) =>
  canSwallow(bodyRadius(w), r)
    ? 'prey'
    : canSwallow(r, bodyRadius(w))
      ? 'danger'
      : 'peer';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function seedShoal(random: () => number): Swimmer[] {
  const fish: Swimmer[] = [];
  for (let i = 0; i < 48; i++) {
    const radius =
      i < 10 ? [12, 15, 18][i % 3] : [12, 16, 21, 29, 38, 48][i % 6];
    let x = 0,
      y = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      const angle = random() * Math.PI * 2,
        r = 145 + random() * 210;
      x =
        i < 10 ? OCEAN_NURSERY.x + Math.cos(angle) * r : 120 + random() * 3160;
      y =
        i < 10 ? OCEAN_NURSERY.y + Math.sin(angle) * r : 120 + random() * 2060;
      if (
        !OCEAN_ROCKS.some(
          (rock) => dist({ x, y }, rock) < rock.radius + radius + 45,
        ) &&
        (radius < 24 || dist({ x, y }, OCEAN_NURSERY) > 410)
      )
        break;
    }
    fish.push({
      id: 100 + i,
      x,
      y,
      home: { x, y },
      radius,
      baseRadius: radius,
      angle: random() * Math.PI * 2,
      cooldown: 0,
      fleeing: false,
      stun: 0,
    });
  }
  return fish;
}
function constrain(f: { x: number; y: number }, r: number) {
  for (const rock of OCEAN_ROCKS) {
    const d = dist(f, rock),
      limit = rock.radius + r;
    if (d < limit) {
      const a = Math.atan2(f.y - rock.y, f.x - rock.x);
      f.x = rock.x + Math.cos(a) * limit;
      f.y = rock.y + Math.sin(a) * limit;
    }
  }
  f.x = Math.max(r + 10, Math.min(OCEAN_MAP.width - r - 10, f.x));
  f.y = Math.max(r + 10, Math.min(OCEAN_MAP.height - r - 10, f.y));
  if (r >= 24) {
    const d = dist(f, OCEAN_NURSERY),
      limit = OCEAN_NURSERY.radius + r + 12;
    if (d < limit) {
      const a = Math.atan2(f.y - OCEAN_NURSERY.y, f.x - OCEAN_NURSERY.x);
      f.x = OCEAN_NURSERY.x + Math.cos(a) * limit;
      f.y = OCEAN_NURSERY.y + Math.sin(a) * limit;
    }
  }
}
function meal(
  w: World,
  fish: { x: number; y: number; radius: number; angle: number },
  eaterId: number | null,
) {
  const o = w.ocean!;
  o.meals.push({
    x: fish.x,
    y: fish.y,
    radius: fish.radius,
    angle: fish.angle,
    elapsed: 0,
    duration: 0.34,
    eaterId,
  });
  if (o.meals.length > 24) o.meals.shift();
}
function feedPlayer(
  w: World,
  fish: { x: number; y: number; radius: number; angle: number },
) {
  const o = w.ocean!,
    gain = Math.max(2, Math.round(fish.radius / 5)),
    before = Math.floor(o.biomass / 25);
  meal(w, fish, null);
  o.eaten++;
  learnFrom(w, fish.radius >= 24 ? 'ocean:shell' : 'ocean:swift');
  migrationCatch(w, fish);
  o.dna = Math.min(999, o.dna + gain);
  o.biomass = Math.min(100, o.biomass + gain * 2);
  o.gulp = 0.38;
  w.food += gain;
  w.totalFood += gain;
  w.player.energy = Math.min(
    getStats(w.traits, w.form).maxEnergy,
    w.player.energy + gain * 7,
  );
  w.player.health = Math.min(100, w.player.health + 4);
  if (Math.floor(o.biomass / 25) > before)
    announce(w, '身体长大了！观察周围：之前危险的鱼，现在可能变成猎物。');
  else if (o.eaten === 1) announce(w, '吞下第一条小鱼！继续捕食，身体会变大。');
}
export function stepFoodChain(w: World, dt: number) {
  const o = w.ocean;
  if (!o || w.mode !== 'running' || o.morph || !Number.isFinite(dt) || dt <= 0)
    return;
  o.gulp = Math.max(0, o.gulp - dt);
  o.meals = o.meals.filter((m) => (m.elapsed += dt) < m.duration);
  const p = w.player,
    pr = bodyRadius(w),
    safe = dist(p, OCEAN_NURSERY) < OCEAN_NURSERY.radius;
  for (const f of o.shoal) {
    if (f.cooldown > 0) {
      f.cooldown = Math.max(0, f.cooldown - dt);
      if (f.cooldown === 0) {
        if (dist(p, f.home) < 420) {
          f.cooldown = 2;
          continue;
        }
        f.x = f.home.x;
        f.y = f.home.y;
        f.radius = f.baseRadius;
        f.stun = 0;
      }
      continue;
    }
    f.stun = Math.max(0, f.stun - dt);
    let threat: { x: number; y: number } | null = null,
      closest = 230;
    if (
      canSwallow(pr, f.radius) &&
      organFaces(w, f, 'jaw') &&
      dist(p, f) < closest
    ) {
      threat = p;
      closest = dist(p, f);
    }
    for (const e of w.predators) {
      if ((e.respawn ?? 0) > 0 || e.stun > 0) continue;
      const d = dist(e, f);
      if (canSwallow(e.radius ?? 36, f.radius) && d < closest) {
        threat = e;
        closest = d;
      }
    }
    for (const other of o.shoal) {
      if (other === f || other.cooldown > 0) continue;
      const d = dist(other, f);
      if (canSwallow(other.radius, f.radius) && d < closest) {
        threat = other;
        closest = d;
      }
    }
    f.fleeing = !!threat;
    let target = {
      x: f.home.x + Math.cos(w.time * 0.35 + f.id) * 100,
      y: f.home.y + Math.sin(w.time * 0.28 + f.id) * 90,
    };
    if (threat)
      target = { x: f.x + (f.x - threat.x), y: f.y + (f.y - threat.y) };
    else {
      const prey = o.shoal.find(
        (other) =>
          other !== f &&
          other.cooldown === 0 &&
          canSwallow(f.radius, other.radius) &&
          dist(f, other) < 165,
      );
      if (prey) target = prey;
      else if (f.baseRadius <= 21) {
        // Small peers school together, but immediately scatter when a threat appears.
        const peers = o.shoal.filter(
          (other) =>
            other !== f &&
            other.cooldown === 0 &&
            other.baseRadius <= 21 &&
            dist(f, other) < 180,
        );
        if (peers.length)
          target = {
            x:
              peers.reduce((n, other) => n + other.x, 0) / peers.length +
              Math.cos(w.time * 0.2) * 65,
            y:
              peers.reduce((n, other) => n + other.y, 0) / peers.length +
              Math.sin(w.time * 0.2) * 65,
          };
      } else if (!safe && canSwallow(f.radius, pr) && dist(f, p) < 200)
        target = p;
    }
    const a = Math.atan2(target.y - f.y, target.x - f.x);
    f.angle = face(f.angle, a, dt, 13);
    if (
      o.skillActive > 0 &&
      FORMS[w.form].branch === 'radial' &&
      dist(p, f) < pr + 115 &&
      canSwallow(pr, f.radius)
    )
      f.stun = 0.8;
    if (f.stun === 0) {
      const speed = f.fleeing ? 76 + f.radius * 0.7 : 40 + f.radius * 0.45;
      f.x += Math.cos(a) * speed * dt;
      f.y += Math.sin(a) * speed * dt;
      constrain(f, f.radius);
    }
    if (
      canSwallow(pr, f.radius) &&
      organTouches(
        { ...p, form: w.form, size: pr, body: o.body },
        { ...f, radius: f.radius * 0.3 },
        'jaw',
      )
    ) {
      feedPlayer(w, f);
      f.cooldown = 22;
      continue;
    }
    if (!safe && canSwallow(f.radius, pr)) blockWithSpine(w, f, f.radius);
    if (
      !safe &&
      canSwallow(f.radius, pr) &&
      dist(p, f) < (pr + f.radius) * 0.72 &&
      p.invulnerable === 0 &&
      f.stun === 0
    ) {
      p.health -=
        getStats(w.traits, w.form).damage * bodyEffects(o.body).damage;
      p.invulnerable = 1.8;
      f.stun = 1;
      announce(w, '这条鱼比你大！先吞小鱼长大，再回来。');
      if (p.health <= 0) return;
    }
  }
  // Other fish also hunt: the player shares a living food chain.
  for (const f of o.shoal) {
    if (f.cooldown > 0 || f.stun > 0) continue;
    for (const other of o.shoal) {
      if (
        other === f ||
        other.cooldown > 0 ||
        !canSwallow(f.radius, other.radius)
      )
        continue;
      if (dist(f, other) < f.radius * 0.78) {
        meal(w, other, f.id);
        other.cooldown = 22;
        f.radius = Math.min(f.baseRadius * 1.15, f.radius + 0.3);
        break;
      }
    }
  }
  for (const e of w.predators) {
    if ((e.respawn ?? 0) > 0) {
      e.respawn = Math.max(0, e.respawn! - dt);
      if (e.respawn === 0) {
        if (dist(p, e.home) < 500) {
          e.respawn = 2;
          continue;
        }
        e.x = e.home.x;
        e.y = e.home.y;
        e.stun = 0;
      }
      continue;
    }
    const radius = e.radius ?? 36;
    if (
      canSwallow(bodyRadius(w), radius) &&
      organTouches(
        { ...p, form: w.form, size: pr, body: o.body },
        { ...e, radius: radius * 0.3 },
        'jaw',
      )
    ) {
      feedPlayer(w, { ...e, radius });
      e.respawn = 30;
      e.alert = false;
      e.bite = 0;
      continue;
    }
    if (e.stun > 0) continue;
    for (const f of o.shoal) {
      if (f.cooldown > 0 || !canSwallow(radius, f.radius)) continue;
      if (dist(e, f) < radius * 0.8) {
        meal(w, f, e.id);
        f.cooldown = 22;
        break;
      }
    }
  }
}
