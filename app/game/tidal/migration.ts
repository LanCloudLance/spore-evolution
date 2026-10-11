import { oceanDnaCandidates, oceanDnaGuide } from '../ocean-dna.ts';
import { bodyRadius, canSwallow } from '../food-chain.ts';
import { hasOrgan } from '../body-layout.ts';
import type { World } from '../simulation.ts';
import { distance, announce, getStats } from '../simulation.ts';
import { createOceanWorld } from '../ocean.ts';
import { TIDAL_BIOMES } from './catalog.ts';
import { tidalLegacy } from './legacy.ts';
import { tidalWindow } from './events.ts';
import type { BiomeId, TidalSafeCheckpoint } from './types.ts';
export function tidalExitGate(w: World): string | null {
  const o = w.ocean,
    t = o?.tidal;
  if (!t || t.compat.mode !== 'active' || w.mode !== 'running' || o!.morph)
    return '继续海洋探索。';
  if (t.migration.refuge) return '育生点已经建立。';
  if (o!.tier !== 2) return '先孕育成熟的海洋身体。';
  if (t.migration.startedTick === null && t.compat.legacyStations === 0)
    return '从育生湾出发，沿途寻找补给。';
  const visits = new Set(t.migration.visited);
  if (t.compat.legacyStations >= 1) visits.add('drift');
  if (t.compat.legacyStations >= 2) visits.add('reef');
  const corridors: BiomeId[][] = [['reef', 'drift']];
  if (t.migration.gains.hunt > 0) corridors.push(['reef', 'vent']);
  if (t.migration.gains.filter > 0) corridors.push(['drift', 'kelp']);
  if (
    t.migration.gains.reserve > 0 ||
    (t.migration.gains.symbiosis ?? 0) > 0 ||
    t.actors.some((a) => a.trust >= 20 && a.health > 0)
  )
    corridors.push(['kelp', 'reef']);
  if (!corridors.some((path) => path.every((id) => visits.has(id))))
    return '经过两处生态生境：猎食走礁谷，滤食走藻林，结伴沿庇护迁行。';
  if (
    !Object.values(t.migration.gains).some((n) => n > 0) &&
    t.compat.legacyStations === 0
  )
    return '途中捕食、滤食或释放储能，完成一次真实补给。';
  if (w.food < 4) return '留下 4 份营养，作为育生点的补给。';
  if (!tidalWindow(w)) return '在回流中补给，等待下一次大潮。';
  if (distance(w.player, TIDAL_BIOMES[3]) > 210) return '随潮线前往东北河口。';
  return null;
}
export function settleTidalRefuge(w: World): boolean {
  if (tidalExitGate(w) !== null) return false;
  const t = w.ocean!.tidal!,
    m = t.migration;
  w.food -= 4;
  m.refuge = true;
  m.companions = t.actors
    .filter(
      (a) =>
        a.health > 0 &&
        a.species === 'ribbonfish' &&
        a.trust >= 20 &&
        distance(a, TIDAL_BIOMES[3]) < 190,
    )
    .map((a) => a.id);
  const ray = t.actors.find(
    (a) =>
      a.health > 0 && a.species === 'great-ray' && distance(a, w.player) < 180,
  );
  m.entry =
    ray &&
    Math.cos(Math.atan2(w.player.y - ray.y, w.player.x - ray.x) - ray.angle) <
      -0.2
      ? 'channel'
      : 'sheltered';
  w.tidalLegacy = tidalLegacy(w) ?? undefined;
  w.mode = 'won';
  w.reason = '你把生命带到了新的海岸';
  announce(w, '河口育生点建立！这段旅程的身体、补给方式与同行者将留给下一代。');
  return true;
}
export function saveTidalCheckpoint(w: World): void {
  const t = w.ocean?.tidal;
  if (
    !t ||
    t.compat.mode !== 'active' ||
    w.mode !== 'running' ||
    w.ocean!.morph ||
    w.player.health < 50 ||
    w.player.energy < 35
  )
    return;
  if (
    ![TIDAL_BIOMES[0], TIDAL_BIOMES[2], TIDAL_BIOMES[3]].some(
      (b) => distance(w.player, b) < 140,
    )
  )
    return;
  if (
    t.actors.some(
      (a) =>
        a.health > 0 && a.behavior === 'ambush' && distance(a, w.player) < 250,
    )
  )
    return;
  const copy = structuredClone(w),
    { safeCheckpoint: _checkpoint, ...tidal } = copy.ocean!.tidal!;
  t.safeCheckpoint = {
    ...copy,
    ocean: { ...copy.ocean!, tidal },
  } as TidalSafeCheckpoint;
}
export function retryTidal(w: World): World {
  const checkpoint = w.ocean?.tidal?.safeCheckpoint;
  if (!checkpoint)
    return createOceanWorld(
      w.ocean?.checkpoint.seed ?? w.seed,
      w.ocean?.checkpoint,
      'tidal',
    );
  const copy = structuredClone(checkpoint);
  const restored = {
    ...copy,
    ocean: {
      ...copy.ocean,
      tidal: {
        ...copy.ocean.tidal,
        safeCheckpoint: structuredClone(checkpoint),
      },
    },
  } as World;
  const o = restored.ocean!,
    t = o.tidal!;
  // Knowledge survives failure; resources and rewards do not move forward from the failed future.
  o.discovered = [...new Set([...o.discovered, ...w.ocean!.discovered])];
  t.journal.claimed = [...new Set([...t.journal.claimed, ...o.discovered])];
  t.journal.seen = [
    ...new Set([...t.journal.seen, ...w.ocean!.tidal!.journal.seen]),
  ];
  restored.mode = 'running';
  restored.reason = '';
  announce(restored, '回到最近育生点。发现的知识保留，补给与生态恢复到当时。');
  return restored;
}

/** One actionable goal, chosen from live edible stock and earned migration facts. */
export function tidalGuidance(w: World): {
  point: { x: number; y: number };
  label: string;
  kind: 'main' | 'trial' | 'optional';
  actorId?: string;
  intent?: 'hunt' | 'visit';
} | null {
  const o = w.ocean,
    t = o?.tidal;
  if (!o || !t || t.compat.mode !== 'active') return null;
  const food = t.foods
    .filter(
      (f) =>
        f.state === 'available' &&
        !f.reservedFor &&
        (hasOrgan(o.body, 'jaw') || f.kind === 'plankton'),
    )
    .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
  const supply = (trial = false) => ({
    point: food ? { x: food.x, y: food.y } : { x: 460, y: 1770 },
    label: food
      ? trial
        ? w.evolution?.trial === 'ocean-skill' && !w.evolution.used
          ? 'J 身体能力 · 游动试用新身体'
          : '试用新身体 · 吃下一份补给'
        : '寻找补给'
      : '回育生湾恢复补给',
    kind: trial ? ('trial' as const) : ('main' as const),
  });
  if (w.player.energy < 45) return supply();
  if (
    w.evolution &&
    w.evolution.habitat === w.habitat &&
    w.evolution.generation === w.generation &&
    !w.evolution.complete &&
    !w.evolution.dismissed &&
    !o.morph
  )
    return supply(true);
  if (o.tier < 2) {
    const chosen =
      oceanDnaCandidates(w).find((c) => c.available) ??
      oceanDnaCandidates(w)[w.dnaLineage?.body === 'grazer' ? 2 : 0];
    if (!chosen.available) {
      if (w.food < 1) return supply();
      const guide = oceanDnaGuide(w, chosen.id);
      if (guide)
        return {
          point: guide.point,
          actorId: guide.actorId,
          intent: guide.intent,
          label: `${guide.intent === 'visit' ? 'K 分享营养' : '追猎摄食'} · ${guide.name}`,
          kind: 'main',
        };
    }
    const stats = getStats(w.traits, w.form);
    const returnEnergy = Math.min(
      stats.maxEnergy - 5,
      35 +
        (distance(w.player, TIDAL_BIOMES[0]) / Math.max(1, stats.speed)) *
          stats.metabolism *
          1.3 +
        5,
    );
    if (o.dna < chosen.costDna || w.player.energy < returnEnergy)
      return supply();
    return {
      point: { x: 460, y: 1770 },
      label: '回育生湾 · O 选择下一代',
      kind: 'main',
    };
  }
  if (t.migration.startedTick === null && !t.compat.legacyStations) {
    const first = TIDAL_BIOMES.find(
      (b) =>
        b.id ===
        (w.dnaLineage?.oceanBody === 'silverflow'
          ? 'reef'
          : w.dnaLineage?.oceanBody === 'shellrunner'
            ? 'kelp'
            : 'drift'),
    )!;
    return {
      point: first,
      label: `离开育生湾 · 向${first.name}出发`,
      kind: 'main',
    };
  }
  const visited = new Set(t.migration.visited);
  if (t.compat.legacyStations >= 1) visited.add('drift');
  if (t.compat.legacyStations >= 2) visited.add('reef');
  const corridor: BiomeId[] =
    visited.has('drift') && visited.has('reef')
      ? []
      : w.dnaLineage?.oceanBody === 'fancrest'
        ? ['drift', 'kelp']
        : t.actors.some((a) => a.trust >= 20 && a.health > 0) ||
            t.migration.gains.reserve > t.migration.gains.hunt
          ? ['kelp', 'reef']
          : w.dnaLineage?.oceanBody
            ? ['reef', 'vent']
            : ['drift', 'reef'];
  for (const id of corridor)
    if (!visited.has(id)) {
      const b = TIDAL_BIOMES.find((b) => b.id === id)!;
      return {
        point: { x: b.x, y: b.y },
        label: `经过${b.name}`,
        kind: 'main',
      };
    }
  if (w.food < 4) return supply();
  if (
    !Object.values(t.migration.gains).some((n) => n > 0) &&
    !t.compat.legacyStations
  ) {
    if (t.abilities.reserveEnergy > 0)
      return {
        point: { x: w.player.x, y: w.player.y },
        label: '释放储能 · 完成途中补给',
        kind: 'main',
      };
    if (hasOrgan(o.body, 'jaw') && !t.abilities.filterOpen) {
      const prey = t.actors
        .filter(
          (a) =>
            a.health > 0 &&
            canSwallow(bodyRadius(w), a.radius) &&
            !['defend', 'follow'].includes(a.behavior),
        )
        .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
      return {
        point: prey ? { x: prey.x, y: prey.y } : { x: 460, y: 1770 },
        ...(prey ? { actorId: prey.id, intent: 'hunt' as const } : {}),
        label: prey
          ? '追猎小型生物 · 朝向猎物使用身体能力'
          : '回育生湾等待小型猎物恢复',
        kind: 'main',
      };
    }
    return { ...supply(), label: '开启滤食 · 途中吃下浮游补给' };
  }
  return {
    point: { x: 3060, y: 390 },
    label: tidalWindow(w)
      ? '前往河口 · K 建立育生点'
      : '前往河口 · 恢复体力，等候大潮',
    kind: 'main',
  };
}
