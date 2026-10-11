import { LAND_FEATURES } from './land-catalog.ts';
import { hasOrgan } from './body-layout.ts';
import type { Ancestor, Input, World, Vec } from './simulation.ts';
import { wetAt } from './shore.ts';
import { LAND_NESTS } from './land.ts';
export type EvolutionExperience = {
  before: Ancestor;
  choice: string;
  generation: number;
  habitat: World['habitat'];
  elapsed: number;
  duration: number;
  trial:
    | 'feature'
    | 'body-test'
    | 'feed'
    | 'ocean-skill'
    | 'shore-return'
    | 'call'
    | 'hunt'
    | 'guard';
  blocksStart: number;
  foodStart: number;
  huntStart: number;
  nutritionStart: number;
  distance: number;
  used: boolean;
  hitHealth: number | null;
  complete: boolean;
  dismissed: boolean;
};
export function beginEvolution(w: World, choice: string) {
  const before = w.history.at(-1);
  if (!before) return;
  const trial = choice.startsWith('landpart:')
    ? 'feature'
    : choice === 'anatomy'
      ? 'body-test'
      : w.habitat === 'pond'
        ? 'feed'
        : w.habitat === 'ocean'
          ? 'ocean-skill'
          : w.habitat === 'shore'
            ? 'shore-return'
            : choice === 'plates'
              ? 'guard'
              : choice !== 'crest' && w.form === 'stalker'
                ? 'hunt'
                : 'call';
  const morph = w.land?.morph ?? w.shore?.morph ?? w.ocean?.morph;
  const duration =
    w.habitat === 'ocean' && w.ocean?.tidal?.compat.mode === 'active'
      ? 4.2
      : Math.max(5.4, morph?.duration ?? 0);
  if (morph) morph.duration = duration;
  w.evolution = {
    before: structuredClone(before),
    choice,
    generation: w.generation,
    habitat: w.habitat,
    elapsed: 0,
    duration,
    trial,
    blocksStart: w.ocean?.blocks ?? 0,
    foodStart: w.totalFood,
    huntStart: w.land?.hunts ?? 0,
    nutritionStart: w.land?.nutrition ?? 0,
    distance: 0,
    used: false,
    hitHealth: null,
    complete: false,
    dismissed: false,
  };
}
export function revealing(w: World) {
  const e = w.evolution;
  return (
    !!e &&
    e.generation === w.generation &&
    e.habitat === w.habitat &&
    e.elapsed < e.duration
  );
}
export function skipEvolution(w: World) {
  if (w.mode !== 'running' || !revealing(w)) return false;
  w.evolution!.elapsed = w.evolution!.duration;
  const m = w.land?.morph ?? w.shore?.morph ?? w.ocean?.morph;
  if (m) m.elapsed = m.duration;
  return true;
}
export function evolutionObservation(w: World) {
  return {
    x: w.player.x,
    y: w.player.y,
    health: w.player.health,
    skill:
      w.land?.skillCooldown ??
      w.shore?.skillCooldown ??
      w.ocean?.skillCooldown ??
      0,
    feature: w.land?.featureCooldown ?? 0,
    trust: w.land?.creatures.reduce((n, c) => n + c.friendship, 0) ?? 0,
  };
}
export function advanceEvolution(
  w: World,
  input: Input,
  dt: number,
  before: ReturnType<typeof evolutionObservation>,
) {
  const e = w.evolution;
  if (
    !e ||
    e.generation !== w.generation ||
    e.habitat !== w.habitat ||
    w.mode !== 'running' ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return;
  if (e.elapsed < e.duration) {
    e.elapsed = Math.min(e.duration, e.elapsed + dt);
    return;
  }
  if (e.complete) return;
  const moved = Math.hypot(w.player.x - before.x, w.player.y - before.y);
  if (Math.hypot(input.x, input.y) > 0.05) e.distance += moved;
  switch (e.trial) {
    case 'feature':
      e.used ||=
        !!input.feature && (w.land?.featureCooldown ?? 0) > before.feature;
      e.complete = e.used || (e.distance > 100 && w.totalFood > e.foodStart);
      break;
    case 'body-test':
      e.complete =
        e.used ||
        w.totalFood > e.foodStart ||
        (w.ocean?.blocks ?? 0) > (e.blocksStart ?? 0);
      break;
    case 'feed':
      e.complete = w.totalFood - e.foodStart >= 2 && e.distance >= 80;
      break;
    case 'ocean-skill':
      if (input.skill && (w.ocean?.skillCooldown ?? 0) > before.skill)
        e.used = true;
      e.complete = e.used && w.totalFood > e.foodStart && e.distance >= 100;
      break;
    case 'shore-return':
      if (!wetAt(w, w.player) && e.distance >= 120) e.used = true;
      e.complete = e.used && wetAt(w, w.player);
      break;
    case 'call':
      e.complete =
        !!(input.skill || input.interact) &&
        (w.land?.creatures.reduce((n, c) => n + c.friendship, 0) ?? 0) >
          before.trust;
      break;
    case 'hunt':
      if ((w.land?.hunts ?? 0) > e.huntStart) e.used = true;
      e.complete = e.used && (w.land?.nutrition ?? 0) > e.nutritionStart;
      break;
    case 'guard':
      if (
        e.hitHealth === null &&
        (w.land?.impact ?? 0) > 0 &&
        w.player.health < before.health &&
        w.player.health > 0
      )
        e.hitHealth = w.player.health;
      e.complete =
        e.hitHealth !== null &&
        w.player.health >= e.hitHealth + 5 &&
        !!w.land?.nests.some(
          (i) =>
            Math.hypot(
              w.player.x - LAND_NESTS[i].x,
              w.player.y - LAND_NESTS[i].y,
            ) < LAND_NESTS[i].radius,
        );
      break;
  }
  if (e.complete) {
    w.notice = '新身体的第一次实践完成！继续探索，试着用它应对不同的环境。';
    w.noticeUntil = w.time + 6;
  }
}
export function evolutionTrialText(w: World) {
  const e = w.evolution;
  if (!e) return null;
  const texts = {
    feature: [
      '新组织的第一次实践',
      w.land?.activeFeature
        ? LAND_FEATURES[w.land.activeFeature].action
        : '走动、采食，观察新组织',
    ],
    'body-test': [
      '亲手设计，亲自验证',
      '让新嘴朝向食物摄食，或用安装长刺的方向挡住追击。',
    ],
    feed: ['用新的身体觅食', '游动并摄食 2 份，感受新特征带来的取舍。'],
    'ocean-skill': [
      '第一次运用新能力',
      '按 J 使用技能，再摄食并游动一段距离。',
    ],
    'shore-return': [
      '从潮池走出去，再回来',
      '离开水面探索，再返回潮池；观察湿润度和移动差别。',
    ],
    call: [
      '让邻居回应你',
      '靠近温和邻居，用 J 呼唤或 K 分享，让信任实际增加。',
    ],
    hunt: [
      '把扑猎变成一顿食物',
      '朝向小型猎物按 J 扑出，捕获后停在食物旁进食。',
    ],
    guard: ['骨板与恢复', '遭遇冲撞后回巢恢复 5 点生命，观察骨板的保护。'],
  } as const;
  const [title, hint] =
    e.trial === 'body-test' && w.ocean?.tidal?.compat.mode === 'active'
      ? [
          '试试你设计的身体',
          '附近有真实食物和无伤水流。对准颗粒摄食，或用配置的 J / L 能力拿起食物、缩壳、释放储能。',
        ]
      : texts[e.trial];
  const progress = e.complete
    ? '实践完成'
    : e.trial === 'feature'
      ? '按 I 使用动作，或带新身体移动并采食'
      : e.trial === 'body-test'
        ? w.ocean?.tidal?.compat.mode === 'active'
          ? '真实摄食或运用一次新能力'
          : '用新嘴摄食，或让长刺真正挡住追击'
        : e.trial === 'feed'
          ? `摄食 ${Math.min(2, w.totalFood - e.foodStart)}/2 · 游动 ${Math.min(80, Math.floor(e.distance))}/80`
          : e.trial === 'ocean-skill'
            ? `${e.used ? '技能已生效' : '等待使用 J'} · ${w.totalFood > e.foodStart ? '已经摄食' : '再摄食一次'}`
            : e.trial === 'shore-return'
              ? e.used
                ? '已经离水 · 返回潮池'
                : '沿岸离开潮池'
              : e.trial === 'hunt'
                ? e.used
                  ? '已经捕获 · 停下进食'
                  : '寻找小型猎物'
                : e.trial === 'guard'
                  ? e.hitHealth === null
                    ? '观察威胁与撤退路线'
                    : '退回巢穴恢复'
                  : '等待邻居回应';
  return { title, hint, progress };
}
export function evolutionTrialTarget(w: World): Vec | null {
  const e = w.evolution;
  if (!e || e.complete || e.dismissed || revealing(w)) return null;
  const nearest = (points: Vec[]) =>
    points.sort(
      (a, b) =>
        Math.hypot(a.x - w.player.x, a.y - w.player.y) -
        Math.hypot(b.x - w.player.x, b.y - w.player.y),
    )[0] ?? null;
  if (
    w.ocean?.tidal?.compat.mode === 'active' &&
    (e.trial === 'body-test' || e.trial === 'ocean-skill')
  )
    return nearest(
      w.ocean.tidal.foods.filter(
        (f) =>
          f.state === 'available' &&
          (hasOrgan(w.ocean!.body, 'jaw') || f.kind === 'plankton'),
      ),
    );
  if (
    e.trial === 'body-test' ||
    e.trial === 'feed' ||
    e.trial === 'ocean-skill'
  )
    return nearest(w.foods.filter((f) => f.cooldown <= 0));
  if (e.trial === 'call')
    return nearest(
      (w.land?.creatures ?? []).filter(
        (c) => !c.joined && c.species !== 'hunter' && c.respawn <= 0,
      ),
    );
  if (e.trial === 'hunt')
    return e.used
      ? nearest(w.land?.meat ?? [])
      : nearest(
          (w.land?.creatures ?? []).filter(
            (c) => !c.joined && c.species !== 'hunter' && c.respawn <= 0,
          ),
        );
  return null;
}
