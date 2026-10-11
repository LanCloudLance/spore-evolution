import { landSpecies } from './land-catalog.ts';
import { noteLandHunt, landArea } from './land-ecology.ts';
import { ingestBiologicalDna } from './dna-evolution.ts';
import { learnFrom } from './lineage-learning.ts';
import { worldBodyPose } from './body-geometry.ts';
import type { World, Vec } from './simulation.ts';
import { announce, distance } from './simulation.ts';
import type { LandCreature } from './land.ts';
export type Meat = Vec & {
  id: number;
  value: number;
  life: number;
  eating: number;
  species: LandCreature['species'];
};
export const LAND_COVER = [
  { x: 980, y: 780, radius: 165 },
  { x: 1880, y: 1500, radius: 170 },
  { x: 2210, y: 1140, radius: 145 },
];
export const inLandCover = (p: Vec) =>
  LAND_COVER.some((c) => distance(c, p) < c.radius);
export const creatureHealth = (c: LandCreature) =>
  landSpecies(c.species).health;
export const creatureRadius = (c: LandCreature) =>
  landSpecies(c.species).radius;
export function huntingStats(w: World) {
  const eaten = w.land?.nutrition ?? 0,
    level = eaten >= 4 ? 2 : eaten >= 2 ? 1 : 0;
  return {
    level,
    damage: 65 + level * 20,
    scale: 1 + level * 0.14,
    next: level === 0 ? 2 : 4,
    name: ['初生猎手', '强壮猎手', '成熟猎手'][level],
  };
}
export function strikePrey(w: World, c: LandCreature, damage: number) {
  const s = w.land!;
  if (c.joined || c.respawn > 0) return;
  const behavior = landSpecies(c.species).behavior;
  c.health -= damage * (behavior === 'armor' ? 0.5 : 1);
  if (
    behavior === 'spine' &&
    distance(c, w.player) < 130 &&
    w.player.invulnerable <= 0
  ) {
    w.player.health -= 8;
    w.player.invulnerable = 0.8;
  }
  c.flash = 0.3;
  c.friendship = 0;
  c.stun = 0.65;
  c.suspicion = 1;
  s.impact = 0.22;
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14;
    w.particles.push({
      x: c.x,
      y: c.y,
      vx: Math.cos(a) * 90,
      vy: Math.sin(a) * 90,
      life: 0.7,
      color: '#f6d191',
    });
  }
  if (c.health > 0) return;
  c.health = 0;
  noteLandHunt(w, c);
  c.respawn = 26 + (w.land?.ecology?.[landArea(c.home)] ?? 0) * 4;
  s.hunts++;
  s.meat.push({
    id: s.meatId++,
    x: c.x,
    y: c.y,
    value: landSpecies(c.species).food,
    life: 28,
    eating: 0,
    species: c.species,
  });
  announce(w, '捕获成功！靠近金色食物吃下它，补充体力并成长。');
}
export function sweepPounce(w: World, from: Vec, to: Vec) {
  const s = w.land!,
    attack = s.pounce;
  if (!attack || attack.hit) return;
  const body = worldBodyPose(w),
    reach = ((body.size * 39) / 36) * (body.body?.length ?? 1);
  const offset = {
    x: Math.cos(attack.angle) * reach,
    y: Math.sin(attack.angle) * reach,
  };
  from = { x: from.x + offset.x, y: from.y + offset.y };
  to = { x: to.x + offset.x, y: to.y + offset.y };
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = dx * dx + dy * dy;
  for (const c of s.creatures) {
    if (c.joined || c.respawn > 0) continue;
    const f = length
      ? Math.max(
          0,
          Math.min(1, ((c.x - from.x) * dx + (c.y - from.y) * dy) / length),
        )
      : 0;
    if (
      distance(c, { x: from.x + dx * f, y: from.y + dy * f }) <
      creatureRadius(c) + body.size / 3
    ) {
      attack.hit = true;
      strikePrey(w, c, huntingStats(w).damage * (attack.ambush ? 1.35 : 1));
      return;
    }
  }
}
export function eatMeat(
  w: World,
  dt: number,
  pickup: number,
  maxEnergy: number,
) {
  if (!w.land || w.mode !== 'running' || w.player.health <= 0) return;
  const s = w.land,
    before = huntingStats(w).level;
  for (const m of s.meat) {
    m.life -= dt;
    if (m.life <= 0) continue;
    if (
      distance(m, w.player) < pickup &&
      Math.hypot(w.player.vx, w.player.vy) < 55
    )
      m.eating += dt;
    else m.eating = 0;
    if (m.eating >= 0.8) {
      m.life = 0;
      w.food += m.value;
      w.totalFood += m.value;
      w.player.energy = Math.min(maxEnergy, w.player.energy + 28);
      s.nutrition++;
      ingestBiologicalDna(w, `land:${m.species}`, 'hunt');
      learnFrom(w, 'land:meal');
      s.biomass = Math.min(70, s.biomass + 5);
      if (huntingStats(w).level > before)
        announce(
          w,
          `${huntingStats(w).name} · 身体更强壮，扑击伤害提高！可以尝试更大的猎物。`,
        );
      else
        announce(
          w,
          `吃下猎物 · +${m.value} 食物 · 成长 ${s.nutrition}/${huntingStats(w).next}`,
        );
    }
  }
  s.meat = s.meat.filter((m) => m.life > 0);
}
