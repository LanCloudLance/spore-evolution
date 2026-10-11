import type { World, Vec } from './simulation.ts';
import { distance, announce } from './simulation.ts';
import { wetAt } from './shore.ts';
import { ingestBiologicalDna } from './dna-evolution.ts';
export type ShoreShelter = Vec & { builtAt: number; life: number };
export function shoreSheltered(w: World) {
  return !!w.shore?.shelters?.some(
    (s) => s.life > 0 && distance(s, w.player) < 85,
  );
}
export function buildShoreShelter(w: World) {
  const s = w.shore;
  if (
    w.habitat !== 'shore' ||
    !s ||
    w.mode !== 'running' ||
    s.morph ||
    s.tier === 0 ||
    w.player.health <= 0 ||
    wetAt(w, w.player) ||
    w.food < 3 ||
    shoreSheltered(w)
  )
    return false;
  const camps = (s.shelters ??= []);
  if (camps.length >= 3) {
    announce(w, '已留下三处庇护，等旧棚随潮汐消退后再搭建。');
    return false;
  }
  w.food -= 3;
  camps.push({ x: w.player.x, y: w.player.y, builtAt: w.time, life: 210 });
  announce(
    w,
    '搭起贝叶庇护 · 营养 -3。阴影减缓失水，观察身体与无遮蔽处的差别。',
  );
  return true;
}
export function stepShoreShelters(w: World, dt: number) {
  const s = w.shore;
  if (!s || w.mode !== 'running' || s.morph || !Number.isFinite(dt) || dt <= 0)
    return;
  for (const camp of s.shelters ?? []) camp.life = Math.max(0, camp.life - dt);
  if (s.shelters) s.shelters = s.shelters.filter((camp) => camp.life > 0);
  if (!shoreSheltered(w) || wetAt(w, w.player)) return;
  const notes = (s.fieldNotes ??= {
    drySeconds: 0,
    safeReturns: 0,
    harvestCycles: {},
  });
  const previous = notes.shelterSeconds ?? 0;
  notes.shelterSeconds = Math.min(6, previous + dt);
  if (previous < 6 && notes.shelterSeconds >= 6) {
    ingestBiologicalDna(w, 'shore:shade', 'practice');
    if (!s.discovered.includes('moisture')) s.discovered.push('moisture');
    announce(w, '庇护实验留下保湿线索 · 回潮池为下一代选择皮膜或储水组织。');
  }
}
