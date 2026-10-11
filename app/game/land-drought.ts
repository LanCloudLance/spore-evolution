import type { Vec, World } from './simulation.ts';
import { announce, distance } from './simulation.ts';
import { LAND_NESTS, LAND_PONDS, LAND_SEED, seedPlot } from './land.ts';

export type DroughtStrategy = 'grove' | 'refuge' | 'migration';
export type LandLegacy = { strategy: DroughtStrategy; supplies: number };
export type LandDrought = {
  phase: 'warning' | 'dry' | 'rain' | 'resolved';
  elapsed: number;
  strategy: DroughtStrategy | null;
  tracking: boolean;
  nest: number | null;
  built: boolean;
  watered: boolean;
  harvests: number[];
  collected: number;
  stops: number;
  supplies: number;
};
export const DROUGHT_NAMES: Record<DroughtStrategy, string> = {
  grove: '照料果丛',
  refuge: '修筑保湿窝',
  migration: '沿水源迁移',
};
export function startLandDrought(w: World) {
  const s = w.land;
  if (
    w.habitat !== 'land' ||
    !s ||
    w.mode !== 'running' ||
    s.morph ||
    !s.tier ||
    !s.nests.length ||
    s.drought
  )
    return false;
  s.drought = {
    phase: 'warning',
    elapsed: 0,
    strategy: null,
    tracking: true,
    nest: null,
    built: false,
    watered: false,
    harvests: [],
    collected: 0,
    stops: 0,
    supplies: 0,
  };
  announce(
    w,
    '风变热了。12秒后浅水退缩；溪畔泉眼仍有水。照料果丛、修窝或迁移都能应对。',
  );
  return true;
}
export function chooseDroughtStrategy(w: World, strategy: DroughtStrategy) {
  const d = w.land?.drought;
  if (
    !d ||
    !Object.hasOwn(DROUGHT_NAMES, strategy) ||
    w.mode !== 'running' ||
    w.land?.morph ||
    d.phase === 'resolved'
  )
    return false;
  if (d.built || d.watered || d.stops > 0) return false;
  if (strategy === 'grove' && w.land?.seedPod?.stage === 'eaten') return false;
  d.strategy = strategy;
  d.tracking = true;
  announce(
    w,
    `${DROUGHT_NAMES[strategy]}。跟随地面标记；投入材料前可以换办法。`,
  );
  return true;
}
export function droughtDry(w: World) {
  const d = w.land?.drought;
  return !!d && d.elapsed >= 12 && d.elapsed < 72;
}
export function landPoolRadius(w: World, index: number) {
  return LAND_PONDS[index].radius * (droughtDry(w) && index < 2 ? 0.46 : 1);
}
export function landWet(w: World, p: Vec) {
  return LAND_PONDS.some((pool, i) => distance(p, pool) < landPoolRadius(w, i));
}
export function droughtSheltered(w: World, p: Vec) {
  const d = w.land?.drought;
  return !!d?.built && d.nest != null && distance(p, LAND_NESTS[d.nest]) < 115;
}
export function stepLandDrought(w: World, dt: number) {
  const d = w.land?.drought;
  if (!d || w.mode !== 'running' || w.land?.morph) return;
  const before = d.phase;
  d.elapsed += dt;
  if (d.phase !== 'resolved')
    d.phase = d.elapsed < 12 ? 'warning' : d.elapsed < 72 ? 'dry' : 'rain';
  if (before === 'warning' && d.phase === 'dry')
    announce(
      w,
      '旱风吹过林地：浅水退缩，野果长得更慢。留意湿润度，泉眼仍然安全。',
    );
  if (before === 'dry' && d.phase === 'rain')
    announce(
      w,
      '雨回来了，水洼恢复。你仍可以继续照料果丛、储备食物或探索水源。',
    );
}
export function droughtHarvest(w: World, foodId: number) {
  const d = w.land?.drought;
  if (!d || d.phase === 'resolved') return;
  if (
    d.built &&
    d.nest != null &&
    distance(w.player, LAND_NESTS[d.nest]) > LAND_NESTS[d.nest].radius
  )
    d.collected = Math.min(3, d.collected + 1);
  if (
    d.watered &&
    foodId >= 1000 &&
    foodId < 1004 &&
    !d.harvests.includes(foodId)
  )
    d.harvests.push(foodId);
}
export function droughtFoodRate(w: World, foodId: number) {
  if (!droughtDry(w)) return 1;
  const d = w.land!.drought!;
  return d.watered && foodId >= 1000 && foodId < 1004 ? 1 : 0.35;
}
type DroughtInteraction = {
  point: Vec;
  label: string;
  hint: string;
  ready: boolean;
};
export function droughtInteraction(w: World): DroughtInteraction | null {
  const s = w.land,
    d = s?.drought;
  if (!s || !d || !d.tracking || !d.strategy || d.phase === 'resolved')
    return null;
  const readyToFinish = d.elapsed >= 12;
  if (d.strategy === 'migration') {
    const pool = LAND_PONDS[d.stops === 0 ? 1 : 2];
    return {
      point: pool,
      label: d.stops === 0 ? '在水源补给' : '抵达常流泉眼',
      hint: `${d.stops}/2 水源 · 每处消耗2食物${!readyToFinish && d.stops > 0 ? ' · 等旱风到来' : ''}`,
      ready: w.food >= 2 && (d.stops === 0 || readyToFinish),
    };
  }
  if (d.strategy === 'refuge') {
    const n =
      d.nest ??
      [...s.nests].sort(
        (a, b) =>
          distance(w.player, LAND_NESTS[a]) - distance(w.player, LAND_NESTS[b]),
      )[0];
    if (n == null) return null;
    if (!d.built)
      return {
        point: LAND_NESTS[n],
        label: '修筑保湿窝',
        hint: '6食物 · 遮阴减缓失水，不会自动补水',
        ready: w.food >= 6,
      };
    return {
      point: LAND_NESTS[n],
      label: '存入旱季补给',
      hint: `离窝采食 ${d.collected}/3 · 存入3食物${!readyToFinish ? ' · 等旱风到来' : ''}`,
      ready: d.collected >= 3 && w.food >= 3 && readyToFinish,
    };
  }
  const plot = seedPlot(w);
  if (!plot || s.seedPod?.waters !== 3) return null;
  if (!d.watered)
    return {
      point: plot,
      label: '为果丛覆土保水',
      hint: '25湿润度 + 存入4食物 · 保护果实再生',
      ready: s.moisture >= 30 && w.food >= 4,
    };
  return {
    point: plot,
    label: '收集果丛种苗',
    hint: `收获不同果实 ${d.harvests.length}/2${!readyToFinish ? ' · 等旱风到来' : ''}`,
    ready: d.harvests.length >= 2 && readyToFinish,
  };
}
export function performDroughtInteraction(w: World) {
  const s = w.land,
    d = s?.drought,
    action = droughtInteraction(w);
  if (
    !s ||
    !d ||
    !action ||
    w.mode !== 'running' ||
    s.morph ||
    distance(w.player, action.point) > 140 ||
    !action.ready
  )
    return false;
  if (d.strategy === 'migration') {
    w.food -= 2;
    d.stops++;
    if (d.stops < 2) {
      announce(w, '留下第一处水源足迹。补给消耗2食物；继续去东北泉眼。');
      return true;
    }
  } else if (d.strategy === 'refuge') {
    if (!d.built) {
      d.nest = LAND_NESTS.findIndex((n) => n === action.point);
      d.built = true;
      w.food -= 6;
      announce(
        w,
        '保湿窝建成了。离窝采食3份，再带回存入。窝里遮阴保水，水边可以补水。',
      );
      return true;
    }
    w.food -= 3;
    d.supplies = 3;
  } else if (!d.watered) {
    s.moisture -= 25;
    w.food -= 4;
    d.supplies = 4;
    d.watered = true;
    announce(
      w,
      '覆土护住根系。留下4食物作储备；亲自收获两处果实，再回到果丛旁。',
    );
    return true;
  }
  d.phase = 'resolved';
  d.tracking = false;
  announce(
    w,
    `${DROUGHT_NAMES[d.strategy!]}完成。林地会记住你的办法，经验与储备将随族群继续前行。`,
  );
  return true;
}
export function droughtLegacy(w: World): LandLegacy | undefined {
  const d = w.land?.drought;
  return d?.phase === 'resolved' && d.strategy
    ? { strategy: d.strategy, supplies: d.supplies }
    : undefined;
}
export function droughtTarget(
  w: World,
): { point: Vec; label: string; action: 'explore' | 'forage' } | null {
  const s = w.land,
    d = s?.drought;
  if (!s || !d?.tracking || !d.strategy || d.phase === 'resolved') return null;
  const forage = (label: string) => {
    const food = [...w.foods]
      .filter(
        (f) =>
          f.cooldown === 0 &&
          !(
            d.strategy === 'refuge' &&
            d.built &&
            d.collected < 3 &&
            d.nest != null &&
            distance(f, LAND_NESTS[d.nest]) <= LAND_NESTS[d.nest].radius
          ),
      )
      .sort((a, b) => distance(w.player, a) - distance(w.player, b))[0];
    return {
      point: food ?? LAND_PONDS[2],
      label: food ? label : '先到常流泉眼补水，等待食源恢复',
      action: 'forage' as const,
    };
  };
  if (d.strategy === 'grove' && s.seedPod?.waters !== 3) {
    const plot = seedPlot(w);
    if (plot)
      return {
        point: plot,
        action: 'explore',
        label: '回幼苗旁浇灌 · 在发现卡使用浇灌按钮',
      };
    if (s.seedPod?.stage === 'carried')
      return {
        point: LAND_NESTS[s.nests[0]],
        action: 'explore',
        label: '回巢种下月露荚 · 在发现卡使用种植按钮',
      };
    return {
      point: LAND_SEED,
      action: 'explore',
      label: '找到月露荚 · 靠近按K，带回巢穴种植',
    };
  }
  if (d.strategy === 'refuge' && d.built && d.collected < 3)
    return forage(`离窝采食 · 补给 ${d.collected}/3`);
  if (d.strategy === 'grove' && d.watered && d.harvests.length < 2) {
    const fruit = w.foods.find(
      (f) =>
        f.id >= 1000 &&
        f.id < 1004 &&
        !d.harvests.includes(f.id) &&
        f.cooldown === 0,
    );
    return {
      point: fruit ?? seedPlot(w)!,
      label: `采收不同果实 · ${d.harvests.length}/2`,
      action: 'forage',
    };
  }
  const action = droughtInteraction(w);
  if (!action) return null;
  const needed =
    d.strategy === 'migration'
      ? 2
      : d.strategy === 'refuge'
        ? d.built
          ? 3
          : 6
        : d.watered
          ? 0
          : 4;
  if (w.food < needed)
    return forage(`先采食 · ${action.label}还需 ${needed - w.food}食物`);
  if (d.strategy === 'grove' && !d.watered && s.moisture < 30)
    return {
      point: LAND_PONDS[2],
      label: '先到泉眼补水，再为果丛覆土',
      action: 'explore',
    };
  return {
    point: action.point,
    label: `${action.label} · 靠近按K`,
    action: 'explore',
  };
}
/** Optional UI tracking only; weather and paid investments continue independently. */
export function trackDrought(w: World, tracking: boolean) {
  const d = w.land?.drought;
  if (!d || w.mode !== 'running' || w.land?.morph || d.phase === 'resolved')
    return false;
  d.tracking = tracking;
  return true;
}
export function validLandLegacy(v: unknown): v is LandLegacy {
  if (!v || typeof v !== 'object') return false;
  const legacy = v as LandLegacy;
  return (
    Object.hasOwn(DROUGHT_NAMES, legacy.strategy) &&
    legacy.supplies ===
      (legacy.strategy === 'grove' ? 4 : legacy.strategy === 'refuge' ? 3 : 0)
  );
}
export function validLandDrought(v: unknown): v is LandDrought {
  if (!v || typeof v !== 'object') return false;
  const d = v as LandDrought;
  if (
    !['warning', 'dry', 'rain', 'resolved'].includes(d.phase) ||
    !Number.isFinite(d.elapsed) ||
    d.elapsed < 0 ||
    d.elapsed > 1e9 ||
    !(d.strategy === null || Object.hasOwn(DROUGHT_NAMES, d.strategy)) ||
    typeof d.tracking !== 'boolean' ||
    typeof d.built !== 'boolean' ||
    typeof d.watered !== 'boolean' ||
    !(d.nest === null || [0, 1, 2].includes(d.nest)) ||
    ![0, 1, 2, 3].includes(d.collected) ||
    ![0, 1, 2].includes(d.stops) ||
    ![0, 3, 4].includes(d.supplies) ||
    !Array.isArray(d.harvests) ||
    d.harvests.length > 4 ||
    new Set(d.harvests).size !== d.harvests.length ||
    !d.harvests.every((id) => [1000, 1001, 1002, 1003].includes(id))
  )
    return false;
  if (
    (d.phase === 'warning' && d.elapsed >= 12) ||
    (d.phase === 'dry' && (d.elapsed < 12 || d.elapsed >= 72)) ||
    (d.phase === 'rain' && d.elapsed < 72) ||
    (d.phase === 'resolved' && d.elapsed < 12)
  )
    return false;
  if (
    d.strategy !== 'refuge' &&
    (d.built || d.nest !== null || d.collected !== 0)
  )
    return false;
  if (d.strategy !== 'grove' && (d.watered || d.harvests.length !== 0))
    return false;
  if (d.strategy !== 'migration' && d.stops !== 0) return false;
  if (
    d.strategy === 'refuge' &&
    (d.built !== (d.nest !== null) || (!d.built && d.collected !== 0))
  )
    return false;
  if (!d.watered && d.harvests.length) return false;
  const resolved = d.phase === 'resolved';
  if (
    resolved &&
    (!d.strategy ||
      (d.strategy === 'refuge' && (!d.built || d.collected < 3)) ||
      (d.strategy === 'grove' && (!d.watered || d.harvests.length < 2)) ||
      (d.strategy === 'migration' && d.stops !== 2))
  )
    return false;
  if (!resolved && d.stops === 2) return false;
  return (
    d.supplies ===
    (d.strategy === 'grove' && d.watered
      ? 4
      : d.strategy === 'refuge' && resolved
        ? 3
        : 0)
  );
}
