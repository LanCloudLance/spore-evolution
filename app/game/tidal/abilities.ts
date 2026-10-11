import { biologicalBonus } from '../lineage-learning.ts';
import type { World, Vec } from '../simulation.ts';
import { getStats, distance, announce } from '../simulation.ts';
import { hasOrgan } from '../body-layout.ts';
import { bodyEffects } from '../body-design.ts';
import { organTouches, worldBodyPose } from '../body-geometry.ts';
import { settleTidalRefuge, tidalExitGate } from './migration.ts';
import { TIDAL_BIOMES } from './catalog.ts';
import { FORMS } from '../forms.ts';
import {
  shareTidalNutrition,
  takeTidalFood,
  consumeTidalFood,
  releaseTidalFood,
  catchTidalActor,
  repelTidalActor,
  tidalSignal,
  emittedTidalSignal,
} from './ecology.ts';
import type { TidalAction, TidalCommand, TidalSignal } from './types.ts';
const ready = (w: World) =>
  !!w.ocean?.tidal && w.mode === 'running' && !w.ocean.morph;
export const tidalFiltering = (w: World) =>
  !!w.ocean?.tidal &&
  ((w.ocean.tidal.abilities.filterOpen &&
    (hasOrgan(w.ocean.body, 'filter') || w.ocean.branch === 'radial')) ||
    (w.ocean.branch === 'radial' && w.ocean.skillActive > 0));
export function tidalMovement(w: World) {
  const a = w.ocean!.tidal!.abilities;
  return {
    speed: a.anchored
      ? 0.25
      : a.shellSeconds > 0
        ? 0.25
        : tidalFiltering(w)
          ? 0.38
          : a.carriedId
            ? 0.85
            : 1,
    turn: a.reserveEnergy >= 40 ? 0.85 : 1,
    dash: a.shellSeconds === 0,
  };
}
export function availableTidalActions(w: World): TidalAction[] {
  const body = w.ocean!.body;
  return [
    'form-skill',
    ...(hasOrgan(body, 'filter') || w.ocean!.branch === 'radial'
      ? ['filter']
      : []),
    ...(['shell', 'grasp', 'reserve', 'ink', 'anchor'] as const).filter(
      (organ) => hasOrgan(body, organ),
    ),
  ] as TidalAction[];
}
export function setTidalSlots(
  w: World,
  slots: [TidalAction | null, TidalAction | null],
): boolean {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'paused' ||
    w.ocean.morph ||
    !Array.isArray(slots) ||
    slots.length !== 2 ||
    slots.some((a) => a !== null && !availableTidalActions(w).includes(a)) ||
    (slots[0] !== null && slots[0] === slots[1])
  )
    return false;
  w.ocean.tidal.abilities.slots = [...slots];
  return true;
}
function trialUsed(w: World) {
  if (
    w.evolution &&
    ['body-test', 'ocean-skill'].includes(w.evolution.trial) &&
    w.evolution.elapsed >= w.evolution.duration
  )
    w.evolution.used = true;
}
function graspableFoods(w: World) {
  return w.ocean!.tidal!.foods.filter(
    (f) =>
      f.state === 'available' &&
      f.owner === null &&
      (!f.reservedFor || f.reservedFor === 'player') &&
      distance(f, w.player) <= 65 + biologicalBonus(w).pickup,
  );
}
/** Shared by buttons and the command resolver, so displayed conditions are real. */
export function tidalActionGate(
  w: World,
  action: TidalAction | null,
): string | null {
  if (!ready(w)) return '暂停或蜕变中，继续探索后使用。';
  if (!action || !availableTidalActions(w).includes(action))
    return '先在下一代面板装备这个身体能力。';
  const a = w.ocean!.tidal!.abilities;
  if (action !== 'shell' && a.shellSeconds > 0)
    return `缩壳保护中 · 等 ${Math.ceil(a.shellSeconds)} 秒。`;
  const cooldown =
    action === 'form-skill'
      ? w.ocean!.skillCooldown
      : action === 'shell'
        ? a.shellCooldown
        : action === 'ink'
          ? (a.inkCooldown ?? 0)
          : action === 'reserve'
            ? a.reserveCooldown
            : 0;
  if (cooldown > 0) return `恢复中 · 等 ${Math.ceil(cooldown)} 秒。`;
  const energy =
    action === 'form-skill'
      ? 14
      : action === 'shell'
        ? 10
        : action === 'ink'
          ? 16
          : 0;
  if (w.player.energy < energy) return `需要 ${energy} 能量 · 先觅食恢复。`;
  if (action === 'reserve') {
    if (a.reserveEnergy <= 0) return '还没有储能 · 吃饱后继续摄食储存。';
    if (w.player.energy >= getStats(w.traits, w.form).maxEnergy)
      return '能量已满，暂时不需要释放储能。';
  }
  if (action === 'grasp' && !a.carriedId && graspableFoods(w).length === 0)
    return '靠近一件可搬运的食物再抓取。';
  return null;
}
export function applyTidalCommand(
  w: World,
  command: TidalCommand,
): TidalSignal[] {
  if (
    !ready(w) ||
    !Number.isSafeInteger(command.id) ||
    command.id <= w.ocean!.tidal!.abilities.lastCommandId ||
    !['slot0', 'slot1', 'interact'].includes(command.kind)
  )
    return [];
  const o = w.ocean!,
    a = o.tidal!.abilities,
    p = w.player;
  a.lastCommandId = command.id;
  if (command.kind === 'interact') {
    if (o.tier === 2 && distance(p, TIDAL_BIOMES[3]) <= 210) {
      if (!settleTidalRefuge(w)) announce(w, tidalExitGate(w) ?? '');
      return [];
    }

    const neighbor = o.tidal!.actors.find(
      (n) =>
        n.health > 0 && n.species === 'ribbonfish' && distance(n, p) <= 100,
    );
    if (neighbor && a.carriedId) {
      const id = a.carriedId;
      if (releaseTidalFood(w, id, 'player', neighbor))
        return [tidalSignal(w, 'drop', 'player', id, neighbor)];
    }
    if (!shareTidalNutrition(w))
      announce(
        w,
        w.food < 1
          ? '共生需要1份营养，先觅食。'
          : '靠近织扇虫、壳螺等伙伴分享，等待它实际进食。',
      );
    return [];
  }
  const action = a.slots[command.kind === 'slot0' ? 0 : 1];
  if (!action || !availableTidalActions(w).includes(action)) return [];
  const blocked = tidalActionGate(w, action);
  if (blocked) {
    announce(w, blocked);
    return [];
  }
  if (action === 'shell') {
    if (a.shellCooldown > 0 || p.energy < 10) return [];
    a.shellSeconds = 2.5;
    a.shellCooldown = 5;
    a.filterOpen = false;
    p.dashing = false;
    o.skillActive = 0;
    trialUsed(w);
    return [tidalSignal(w, 'defend', 'player', null, p)];
  }
  if (a.shellSeconds > 0) return [];
  if (action === 'form-skill') {
    if (o.skillCooldown > 0 || p.energy < 14) return [];
    p.energy -= 14;
    o.skillCooldown = 8;
    o.skillActive = w.form === 'colony' ? 2.5 : 1.5;
    p.invulnerable = o.skillActive;
    trialUsed(w);
    announce(w, `${FORMS[w.form].skill}！`);
    return [];
  }
  if (action === 'filter') {
    a.filterOpen = !a.filterOpen;
    if (a.filterOpen) trialUsed(w);
    return [];
  }
  if (action === 'grasp') {
    if (a.carriedId) {
      const id = a.carriedId,
        point = {
          x: Math.max(8, Math.min(3392, p.x + Math.cos(p.angle) * 110)),
          y: Math.max(8, Math.min(2292, p.y + Math.sin(p.angle) * 110)),
        };
      return releaseTidalFood(w, id, 'player', point)
        ? [tidalSignal(w, 'drop', 'player', id, point)]
        : [];
    }
    const item = graspableFoods(w).sort(
      (x, y) => distance(x, p) - distance(y, p),
    )[0];
    if (item && takeTidalFood(w, item.id, 'player')) {
      trialUsed(w);
      return [tidalSignal(w, 'carry', 'player', item.id, item)];
    }
    return [];
  }
  if (action === 'anchor') {
    a.anchored = !a.anchored;
    trialUsed(w);
    announce(
      w,
      a.anchored ? '触须锚定 · 水流减弱，移动很慢。' : '收回锚须，恢复游动。',
    );
    return [];
  }
  if (action === 'ink' && (a.inkCooldown ?? 0) === 0 && p.energy >= 16) {
    p.energy -= 16;
    a.inkCooldown = 8;
    a.inkSeconds = 2;
    for (const actor of o.tidal!.actors)
      if (actor.health > 0 && distance(actor, p) < 150)
        repelTidalActor(w, actor.id, 1.5);
    trialUsed(w);
    announce(w, '墨云展开 · 近身生物短暂退开，抓紧离开危险。');
    return [];
  }
  if (action === 'reserve' && a.reserveCooldown === 0) {
    const released = Math.min(
      20,
      a.reserveEnergy,
      Math.max(0, getStats(w.traits, w.form).maxEnergy - p.energy),
    );
    if (released <= 0) return [];
    trialUsed(w);
    a.reserveEnergy -= released;
    p.energy += released;
    a.reserveCooldown = 4;
    return [tidalSignal(w, 'reserve-use', 'player', null, p, released)];
  }
  return [];
}
function eat(w: World, energy: number, nutrition: number) {
  const o = w.ocean!,
    p = w.player,
    a = o.tidal!.abilities,
    max = getStats(w.traits, w.form).maxEnergy;
  const overflow = Math.max(0, p.energy + energy - max);
  p.energy = Math.min(max, p.energy + energy);
  if (hasOrgan(o.body, 'reserve'))
    a.reserveEnergy = Math.min(40, a.reserveEnergy + overflow);
  w.food += nutrition;
  w.totalFood += nutrition;
  o.dna = Math.min(999, o.dna + nutrition);
  o.biomass = Math.min(100, o.biomass + nutrition * 1.5);
  o.gulp = 0.16;
}
export function resolveTidalDamage(w: World, signals: readonly TidalSignal[]) {
  if (!ready(w)) return;
  for (const s of signals) {
    if (
      !emittedTidalSignal(w, s) ||
      s.kind !== 'defend' ||
      s.targetId !== 'player' ||
      s.amount <= 0 ||
      w.player.invulnerable > 0
    )
      continue;
    const attacker = w.ocean!.tidal!.actors.find((a) => a.id === s.actorId);
    if (!attacker) continue;
    if (
      organTouches(
        worldBodyPose(w),
        { ...attacker, radius: attacker.radius * 0.8 },
        'spine',
      )
    ) {
      w.ocean!.blocks++;
      w.ocean!.defenseFlash = 0.9;
      repelTidalActor(w, attacker.id, 2);
      w.player.invulnerable = 0.6;
    } else {
      const damage =
        s.amount *
        (getStats(w.traits, w.form).damage / 26) *
        bodyEffects(w.ocean!.body).damage *
        (w.ocean!.tidal!.abilities.shellSeconds > 0 ? 0.3 : 1);
      w.player.health = Math.max(0, w.player.health - damage);
      w.player.invulnerable = 1.2;
    }
  }
}
const motions = new WeakMap<
  World,
  { previous: Map<string, Vec>; moving: Vec[] }
>();
export function lateralRipples(w: World): Vec[] {
  if (!w.ocean?.tidal || !hasOrgan(w.ocean.body, 'lateral')) return [];
  const radius = Math.hypot(w.player.vx, w.player.vy) > 100 ? 75 : 150;
  return (motions.get(w)?.moving ?? [])
    .filter((p) => distance(p, w.player) <= radius)
    .map((p) => ({ ...p }));
}
export function stepTidalAbilities(w: World, dt: number): TidalSignal[] {
  if (!ready(w) || !Number.isFinite(dt) || dt <= 0) return [];
  dt = Math.min(dt, 0.05);
  const o = w.ocean!,
    t = o.tidal!,
    a = t.abilities,
    signals: TidalSignal[] = [];
  const tracked = motions.get(w),
    moving = t.actors
      .filter(
        (n) =>
          n.health > 0 &&
          tracked?.previous.has(n.id) &&
          distance(n, tracked.previous.get(n.id)!) > 0.01,
      )
      .map((n) => ({ x: n.x, y: n.y }));
  motions.set(w, {
    previous: new Map(t.actors.map((n) => [n.id, { x: n.x, y: n.y }])),
    moving,
  });
  const closed = a.shellSeconds > 0;
  a.inkCooldown = Math.max(0, (a.inkCooldown ?? 0) - dt);
  a.inkSeconds = Math.max(0, (a.inkSeconds ?? 0) - dt);
  a.shellSeconds = Math.max(0, a.shellSeconds - dt);
  a.shellCooldown = Math.max(0, a.shellCooldown - dt);
  a.reserveCooldown = Math.max(0, a.reserveCooldown - dt);
  o.gulp = Math.max(0, o.gulp - dt);
  o.defenseFlash = Math.max(0, o.defenseFlash - dt);
  if (closed) {
    w.player.energy = Math.max(0, w.player.energy - 4 * dt);
    if (w.player.energy === 0) a.shellSeconds = 0;
    return signals;
  }
  if (a.carriedId) {
    const f = t.foods.find((f) => f.id === a.carriedId);
    if (f) {
      f.x = w.player.x + Math.cos(w.player.angle) * 35;
      f.y = w.player.y + Math.sin(w.player.angle) * 35;
    }
    return signals;
  }
  if (o.gulp > 0) return signals;
  if (hasOrgan(o.body, 'jaw') && !tidalFiltering(w))
    for (const prey of t.actors) {
      const gain = catchTidalActor(w, prey.id);
      if (gain > 0) {
        o.eaten++;
        eat(w, gain * 7, gain);
        signals.push(tidalSignal(w, 'feed', 'player', prey.id, prey, gain));
        return signals;
      }
    }
  for (const f of t.foods) {
    if (f.state !== 'available') continue;
    const filtering = tidalFiltering(w) && f.kind === 'plankton';
    const contact = filtering
      ? hasOrgan(o.body, 'filter')
        ? organTouches(
            worldBodyPose(w),
            { ...f, radius: 4 + biologicalBonus(w).pickup },
            'filter',
          )
        : distance(w.player, f) <
          worldBodyPose(w).size + 60 + biologicalBonus(w).pickup
      : organTouches(
          worldBodyPose(w),
          { ...f, radius: 4 + biologicalBonus(w).pickup },
          'jaw',
        );
    if (contact && takeTidalFood(w, f.id, 'player')) {
      const energy = consumeTidalFood(w, f.id, 'player');
      eat(w, energy, 1);
      if (filtering) trialUsed(w);
      signals.push(
        tidalSignal(w, filtering ? 'filter' : 'feed', 'player', f.id, f, 1),
      );
      return signals;
    }
  }
  return signals;
}
