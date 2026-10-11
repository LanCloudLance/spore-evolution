import {
  ingestPondDna,
  POND_DNA_SOURCES as DNA_SOURCES,
} from './dna-evolution.ts';
import type { World, Vec } from './simulation.ts';
import {
  distance,
  announce,
  NURSERY,
  SUNLIGHT,
  MAP,
  getStats,
} from './simulation.ts';
import { biologicalBonus, learnFrom } from './lineage-learning.ts';
import { separateNeighbors } from './readability.ts';
export type PondPrey = Vec & {
  id: number;
  species: 'dart' | 'shield' | 'feather';
  radius: number;
  angle: number;
  home: Vec;
  cooldown: number;
  trust?: number;
  observation?: number;
  studiedGeneration?: number;
};
export type PondLife = {
  biomass: number;
  prey: PondPrey[];
  gifts?: (Vec & { preyId: number; life: number })[];
  pressure?: Partial<Record<PondPrey['species'], number>>;
};
export const POND_PREY = {
  dart: {
    name: '流鞭微生物',
    trait: 'flagellum',
    color: '#8de3ef',
    skill: '脉冲推进',
  },
  shield: {
    name: '甲泡微生物',
    trait: 'shell',
    color: '#d4bdfa',
    skill: '护体脉冲',
  },
  feather: {
    name: '绒羽微生物',
    trait: 'cilia',
    color: '#96efbc',
    skill: '摄食展开',
  },
} as const;
export function createPondLife(seed: number): PondLife {
  return {
    biomass: 0,
    prey: Array.from({ length: 9 }, (_, id) => {
      const species = (['dart', 'shield', 'feather'] as const)[id % 3],
        center = id < 3 ? NURSERY : id < 6 ? SUNLIGHT : { x: 1850, y: 620 };
      const angle = id < 3 ? id * 2.1 + 0.15 : id * 2.399 + (seed % 11) * 0.1,
        r = id < 3 ? 125 + id * 15 : 90 + id * 12;
      const home = {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      };
      return {
        ...home,
        id,
        species,
        radius: species === 'dart' ? 10 : species === 'shield' ? 16 : 13,
        angle,
        home,
        cooldown: 0,
      };
    }),
  };
}
export const pondDefending = (p: PondPrey, time: number) =>
  p.species === 'shield' && (time + p.id) % 5 < 1.2;
export const pondJetting = (p: PondPrey, time: number) =>
  p.species === 'dart' && (time + p.id) % 5 < 0.5;
export function pondRadius(w: World) {
  return Math.min(
    42,
    22 + Math.max(0, w.generation - 1) * 2 + (w.pondLife?.biomass ?? 0) * 0.12,
  );
}
export function pondCanSwallow(w: World, radius: number) {
  return pondRadius(w) >= radius * 1.2;
}
/** A tap selects a real, currently living animal. It grants no catch or reward. */
export function targetPondPrey(w: World, target: Vec): number | null {
  if (w.habitat !== 'pond' || w.mode !== 'running') return null;
  const candidates = (w.pondLife?.prey ?? []).filter(
    (p) =>
      p.cooldown === 0 &&
      distance(w.player, p) <= 360 &&
      pondCanSwallow(w, p.radius) &&
      distance(p, target) <= p.radius + 10,
  );
  candidates.sort((a, b) => distance(a, target) - distance(b, target));
  return candidates[0]?.id ?? null;
}
/** Follow its current position until contact; predators, energy and terrain still apply. */
export function guidePondHunt(w: World, id: number) {
  if (w.habitat !== 'pond' || w.mode !== 'running') return null;
  const prey = w.pondLife?.prey.find((p) => p.id === id && p.cooldown === 0);
  if (!prey || !pondCanSwallow(w, prey.radius)) return null;
  const d = distance(w.player, prey);
  if (d > 360) return null;
  return {
    target: { x: prey.x, y: prey.y },
    input: {
      x: (prey.x - w.player.x) / Math.max(1, d),
      y: (prey.y - w.player.y) / Math.max(1, d),
    },
  };
}
export function sharePondNutrition(w: World) {
  if (
    w.habitat !== 'pond' ||
    w.mode !== 'running' ||
    w.player.health <= 0 ||
    w.food < 1
  )
    return false;
  const life = w.pondLife;
  if (!life || (life.gifts?.length ?? 0) >= 3) return false;
  const prey = [...life.prey]
    .filter(
      (p) =>
        p.cooldown === 0 &&
        (p.trust ?? 0) <= 0 &&
        distance(p, w.player) < 140 &&
        !life.gifts?.some((g) => g.preyId === p.id),
    )
    .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
  if (!prey) return false;
  w.food--;
  (life.gifts ??= []).push({
    preyId: prey.id,
    x: (w.player.x + prey.x) / 2,
    y: (w.player.y + prey.y) / 2,
    life: 10,
  });
  announce(w, `分享1营养给${DNA_SOURCES[prey.species].name}，等它实际吃下。`);
  return true;
}
export function guidePondVisit(w: World, id: number) {
  if (w.habitat !== 'pond' || w.mode !== 'running') return null;
  const p = w.pondLife?.prey.find((p) => p.id === id && p.cooldown === 0);
  if (!p) return null;
  const d = distance(p, w.player);
  return {
    target: { x: p.x, y: p.y },
    input: {
      x: d < 120 ? 0 : (p.x - w.player.x) / d,
      y: d < 120 ? 0 : (p.y - w.player.y) / d,
    },
  };
}
function eat(w: World, source: string, biomass: number) {
  w.pondLife!.biomass = Math.min(100, w.pondLife!.biomass + biomass);
  w.food += 2;
  w.totalFood += 2;
  w.player.energy = Math.min(
    getStats(w.traits).maxEnergy,
    w.player.energy + 18,
  );
  const unlocked = learnFrom(w, source);
  const dna = ingestPondDna(w, source);
  const direction =
    DNA_SOURCES[source.slice(5) as keyof typeof DNA_SOURCES].direction;
  announce(
    w,
    dna > 0
      ? `吞食成功 · ${direction}DNA +${dna} · 回育生水域可查看身体分化。`
      : unlocked
        ? '吞食成功 · 获得DNA线索！按 O 查看下一代与能力。'
        : '吞食成功 · 营养 +2；本代同种DNA已充分吸收，试试其他猎物。',
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    w.particles.push({
      ...w.player,
      vx: Math.cos(a) * 50,
      vy: Math.sin(a) * 50,
      life: 0.6,
      color: '#d8edac',
    });
  }
}
export function stepPondLife(w: World, dt: number) {
  if (
    w.mode !== 'running' ||
    w.habitat !== 'pond' ||
    w.player.health <= 0 ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return;
  const life = (w.pondLife ??= createPondLife(w.seed));
  for (const gift of life.gifts ?? []) gift.life -= dt;
  if (life.gifts) life.gifts = life.gifts.filter((g) => g.life > 0);
  if (life.pressure)
    for (const id of Object.keys(life.pressure) as PondPrey['species'][])
      life.pressure[id] = Math.max(0, (life.pressure[id] ?? 0) - dt * 0.015);
  for (const prey of life.prey) {
    prey.trust = Math.max(0, (prey.trust ?? 0) - dt);
    if (prey.cooldown > 0) {
      prey.cooldown = Math.max(0, prey.cooldown - dt);
      if (prey.cooldown === 0) Object.assign(prey, prey.home);
      continue;
    }
    const danger = w.predators.find(
      (e) => (e.respawn ?? 0) === 0 && distance(e, prey) < 95,
    );
    const defending = pondDefending(prey, w.time);
    if (danger && !defending && distance(danger, prey) < prey.radius + 18) {
      prey.cooldown = 35;
      continue;
    }
    const d = distance(w.player, prey);
    if (
      (prey.trust ?? 0) <= 0 &&
      !life.gifts?.some((g) => g.preyId === prey.id) &&
      pondCanSwallow(w, prey.radius) &&
      !defending &&
      d < pondRadius(w) + biologicalBonus(w).pickup - prey.radius * 0.25
    ) {
      const pressure = (life.pressure ??= {});
      pressure[prey.species] = Math.min(
        12,
        (pressure[prey.species] ?? 0) + 0.8,
      );
      prey.cooldown = 35 + (pressure[prey.species] ?? 0) * 3;
      eat(w, `pond:${prey.species}`, 12);
      continue;
    }
    if (prey.studiedGeneration !== w.generation) {
      prey.observation =
        d < 180 && !danger ? Math.min(2, (prey.observation ?? 0) + dt) : 0;
      if (prey.observation >= 2) {
        prey.studiedGeneration = w.generation;
        ingestPondDna(w, `pond:${prey.species}`, 'observe');
        learnFrom(w, `pond:${prey.species}`);
        announce(
          w,
          `观察${DNA_SOURCES[prey.species].name}的动作 · 后代可以继承这一来源。`,
        );
      }
    }
    const gift = life.gifts?.find((g) => g.preyId === prey.id);
    if (gift && distance(prey, gift) < 30) {
      gift.life = 0;
      prey.trust = 25;
      ingestPondDna(w, `pond:${prey.species}`, 'symbiosis');
      learnFrom(w, `pond:${prey.species}`);
      if (life.pressure)
        life.pressure[prey.species] = Math.max(
          0,
          (life.pressure[prey.species] ?? 0) - 0.6,
        );
      announce(
        w,
        `${DNA_SOURCES[prey.species].name}吃下了赠食 · 共生来源留下了，暂时不再害怕你。`,
      );
    }
    const flee = d < 90 && (prey.trust ?? 0) <= 0 && !gift ? w.player : danger;
    const food =
      prey.species === 'feather'
        ? w.foods.find((f) => f.cooldown === 0 && distance(f, prey) < 90)
        : undefined;
    if (food && distance(food, prey) < 35) food.cooldown = 24;
    const target = flee
      ? { x: prey.x + (prey.x - flee.x), y: prey.y + (prey.y - flee.y) }
      : gift?.life
        ? gift
        : (food ?? {
            x: prey.home.x + Math.cos(w.time * 0.4 + prey.id) * 32,
            y: prey.home.y + Math.sin(w.time * 0.3 + prey.id) * 32,
          });
    prey.angle = Math.atan2(target.y - prey.y, target.x - prey.x);
    const speed = defending
      ? 6
      : flee
        ? pondJetting(prey, w.time)
          ? 150
          : 44
        : 16;
    prey.x = Math.max(
      25,
      Math.min(MAP.width - 25, prey.x + Math.cos(prey.angle) * speed * dt),
    );
    prey.y = Math.max(
      25,
      Math.min(MAP.height - 25, prey.y + Math.sin(prey.angle) * speed * dt),
    );
  }
  const spacable = new Set(
    life.prey
      .filter(
        (p) =>
          p.cooldown === 0 &&
          distance(p, w.player) > pondRadius(w) + p.radius + 15 &&
          !life.gifts?.some((g) => g.preyId === p.id) &&
          !w.foods.some((f) => f.cooldown === 0 && distance(p, f) < 40),
      )
      .map((p) => p.id),
  );
  separateNeighbors(life.prey, dt, (id) => spacable.has(id));
  for (const enemy of w.predators)
    if (
      (enemy.respawn ?? 0) === 0 &&
      pondCanSwallow(w, 29 + (enemy.id % 3) * 3) &&
      distance(enemy, w.player) < pondRadius(w) - 8
    ) {
      enemy.respawn = 35;
      enemy.alert = false;
      eat(w, 'pond:hunter', 16);
    }
}
export function validPondLife(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const s = v as PondLife;
  return (
    Number.isFinite(s.biomass) &&
    s.biomass >= 0 &&
    s.biomass <= 100 &&
    Array.isArray(s.prey) &&
    s.prey.length === 9 &&
    s.prey.every(
      (p) =>
        p &&
        Number.isSafeInteger(p.id) &&
        p.id >= 0 &&
        p.id < 9 &&
        Object.hasOwn(POND_PREY, p.species) &&
        p.radius === { dart: 10, shield: 16, feather: 13 }[p.species] &&
        [p.x, p.y, p.home?.x, p.home?.y, p.angle, p.cooldown].every(
          Number.isFinite,
        ) &&
        p.cooldown >= 0 &&
        p.cooldown <= 71 &&
        [p.trust, p.observation, p.studiedGeneration].every(
          (v) => v === undefined || (Number.isFinite(v) && v >= 0),
        ) &&
        (p.trust === undefined || p.trust <= 25) &&
        (p.observation === undefined || p.observation <= 2),
    ) &&
    new Set(s.prey.map((p) => p.id)).size === 9 &&
    (s.gifts === undefined ||
      (Array.isArray(s.gifts) &&
        s.gifts.length <= 3 &&
        s.gifts.every(
          (g) =>
            g &&
            [g.x, g.y, g.life].every(Number.isFinite) &&
            g.life >= 0 &&
            g.life <= 10 &&
            s.prey.some((p) => p.id === g.preyId),
        ) &&
        new Set(s.gifts.map((g) => g.preyId)).size === s.gifts.length)) &&
    (s.pressure === undefined ||
      (!!s.pressure &&
        typeof s.pressure === 'object' &&
        !Array.isArray(s.pressure) &&
        Object.entries(s.pressure).every(
          ([id, v]) =>
            Object.hasOwn(POND_PREY, id) &&
            typeof v === 'number' &&
            Number.isFinite(v) &&
            v >= 0 &&
            v <= 12,
        )))
  );
}
