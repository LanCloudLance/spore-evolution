import { announce, distance } from './simulation.ts';
import type { World, Vec } from './simulation.ts';
import type { LandCreature } from './land.ts';
import { face } from './motion.ts';
export function commandCompanions(w: World) {
  const s = w.land;
  if (!s || w.mode !== 'running' || s.morph) return false;
  const friends = s.creatures.filter((c) => c.joined);
  if (!friends.length) {
    announce(w, '先呼唤或分享食物结伴，再按 L 请伙伴帮忙。');
    return false;
  }
  if (friends.some((c) => c.task !== 'follow')) {
    for (const c of friends) {
      c.task = c.carrying ? 'return' : 'follow';
      c.targetFood = null;
      c.reaction = 1.8;
    }
    announce(w, '伙伴回应了呼唤，正在回到你身边。');
    return true;
  }
  const reserved = new Set<number>();
  let sent = 0;
  for (const c of friends) {
    const food = w.foods
      .filter(
        (f) =>
          f.cooldown === 0 &&
          !reserved.has(f.id) &&
          distance(f, w.player) < 520 &&
          !s.creatures.some(
            (h) =>
              h.species === 'hunter' &&
              h.respawn <= 0 &&
              distance(h.home, f) < 280,
          ),
      )
      .sort((a, b) => distance(a, c) - distance(b, c))[0];
    if (!food) continue;
    reserved.add(food.id);
    c.targetFood = food.id;
    c.task = 'forage';
    c.reaction = 1.8;
    sent++;
  }
  announce(
    w,
    sent
      ? `${sent} 位伙伴回应了你！它们会找果实，带回来交给你。`
      : '附近暂时没有安全的果实，换片地方再试试。',
  );
  return sent > 0;
}
export function stepCompanionTask(
  w: World,
  c: LandCreature,
  dt: number,
  speed: number,
  maxEnergy: number,
  constrain: (p: Vec, r: number) => void,
) {
  if (c.task === 'follow') return false;
  const food =
    c.task === 'forage'
      ? w.foods.find((f) => f.id === c.targetFood)
      : undefined;
  if (c.task === 'forage' && (!food || food.cooldown > 0)) {
    c.task = 'return';
    c.targetFood = null;
  }
  const target = c.task === 'forage' && food ? food : w.player;
  const d = distance(c, target);
  if (c.task === 'forage' && food && d < 26) {
    food.cooldown = 32;
    c.carrying = 1;
    c.task = 'return';
    c.targetFood = null;
    c.reaction = 1;
    return true;
  }
  if (c.task === 'return' && d < 80) {
    if (c.carrying) {
      w.food += c.carrying;
      w.totalFood += c.carrying;
      w.player.energy = Math.min(maxEnergy, w.player.energy + 6);
      announce(w, '伙伴把果实带回来了！+1 食物。');
    }
    c.carrying = 0;
    c.task = 'follow';
    c.reaction = 2;
    return true;
  }
  const desired = Math.atan2(target.y - c.y, target.x - c.x);
  let heading = desired,
    best = Infinity;
  for (let i = 0; i <= 12; i++)
    for (const side of i ? [1, -1] : [1]) {
      const angle = desired + (side * i * Math.PI) / 12;
      let clear = true;
      for (const reach of [28, 56, 90]) {
        const probe = {
            x: c.x + Math.cos(angle) * Math.min(reach, d),
            y: c.y + Math.sin(angle) * Math.min(reach, d),
          },
          before = { ...probe };
        constrain(probe, 27);
        if (distance(probe, before) > 1) {
          clear = false;
          break;
        }
      }
      const turn = Math.abs(
        Math.atan2(Math.sin(angle - c.angle), Math.cos(angle - c.angle)),
      );
      const score = (i * Math.PI) / 12 + turn * 0.4;
      if (clear && score < best) {
        best = score;
        heading = angle;
      }
    }
  c.angle = face(c.angle, heading, dt, 9);
  c.x += Math.cos(c.angle) * Math.min(205, speed * 1.15) * dt;
  c.y += Math.sin(c.angle) * Math.min(205, speed * 1.15) * dt;
  constrain(c, 27);
  return true;
}
