import type { World, Vec } from './simulation.ts';
import { announce, distance, getStats } from './simulation.ts';
import { hasOrgan } from './body-layout.ts';

export type MigrationRoute = 'hunt' | 'filter';
export type OceanMigration = {
  route: MigrationRoute | null;
  station: number;
  progress: number;
  expanded: boolean;
  elapsed: number;
  arrived: boolean;
  legs: MigrationRoute[];
};
export const freshMigration = (): OceanMigration => ({
  route: null,
  station: 0,
  progress: 0,
  expanded: false,
  elapsed: 0,
  arrived: false,
  legs: [],
});
export const MIGRATION_STATIONS = [
  { x: 1550, y: 700, radius: 170, name: '暖流汇口' },
  { x: 2250, y: 380, radius: 180, name: '蓝光水道' },
];
export const MIGRATION_HOME = { x: 3060, y: 390, radius: 210 };
export const migrationAvailable = (w: World) =>
  !!w.ocean && w.ocean.tier === 2 && !w.ocean.morph;
export const canFilter = (w: World) =>
  w.ocean?.branch === 'radial' ||
  (!!w.ocean && hasOrgan(w.ocean.body, 'filter'));
export const canHunt = (w: World) => !!w.ocean && hasOrgan(w.ocean.body, 'jaw');

export function chooseMigration(w: World, route: MigrationRoute) {
  if (w.ocean?.tidal?.compat.mode === 'active') return false;
  if (
    !migrationAvailable(w) ||
    w.mode !== 'running' ||
    (route === 'filter' ? !canFilter(w) : !canHunt(w))
  )
    return false;
  const m = (w.ocean!.migration ??= freshMigration());
  if (m.arrived || m.station >= 2 || m.route === route) return false;
  m.route = route;
  m.progress = 0;
  m.expanded = false;
  // These are ordinary live prey: they move, flee, can be stolen, and respawn.
  if (!w.ocean!.shoal.some((f) => f.id >= 400)) {
    for (let station = 0; station < 2; station++) {
      const site = MIGRATION_STATIONS[station];
      for (let i = 0; i < 8; i++) {
        const x = site.x - 60 + (i % 4) * 35,
          y = site.y - 45 + Math.floor(i / 4) * 65;
        w.ocean!.shoal.push({
          id: 400 + station * 10 + i,
          x,
          y,
          home: { x, y },
          radius: 12 + (i % 2) * 3,
          baseRadius: 12 + (i % 2) * 3,
          angle: -0.2,
          cooldown: 0,
          fleeing: false,
          stun: 0,
        });
      }
    }
  }
  announce(
    w,
    route === 'hunt'
      ? '鱼群出发了。到暖流里捕食，沿它们的路线前进。'
      : '暖流带来浮游生物。到蓝色光带按 K 展开滤食，收拢后继续前进。',
  );
  return true;
}

function finishStation(w: World) {
  const m = w.ocean!.migration!;
  m.legs.push(m.route!);
  m.station++;
  m.progress = 0;
  m.expanded = false;
  w.player.energy = Math.min(
    getStats(w.traits, w.form).maxEnergy,
    w.player.energy + 35,
  );
  if (m.route === 'filter') {
    w.food += 4;
    w.totalFood += 4;
    w.ocean!.biomass = Math.min(100, w.ocean!.biomass + 4);
    w.ocean!.dna = Math.min(999, w.ocean!.dna + 4);
  }
  announce(
    w,
    m.station === 2
      ? '越过了深水。前方是新的海岸，同行的生命正在靠近。'
      : '第一站留下了你的足迹。鱼群转向东北，跟上下一道蓝光。',
  );
}
export function migrationCatch(w: World, prey: Vec) {
  const m = w.ocean?.migration;
  if (!m || m.route !== 'hunt' || m.station >= 2 || !migrationAvailable(w))
    return;
  const site = MIGRATION_STATIONS[m.station];
  if (
    distance(prey, site) > site.radius + 100 ||
    distance(w.player, site) > site.radius + 100
  )
    return;
  m.progress++;
  if (m.progress >= 2) finishStation(w);
}
export function stepMigration(w: World, dt: number, interact: boolean) {
  if (w.ocean?.tidal?.compat.mode === 'active') return;
  if (!migrationAvailable(w) || w.mode !== 'running') return;
  const m = (w.ocean!.migration ??= freshMigration());
  m.elapsed += dt;
  if (interact && m.route === 'filter' && m.station < 2 && canFilter(w))
    m.expanded = !m.expanded;
  if (m.route !== 'filter' || !m.expanded || m.station >= 2) return;
  if (!canFilter(w)) {
    m.expanded = false;
    return;
  }
  const site = MIGRATION_STATIONS[m.station];
  // Staying in the nutrient field is the action; leaving pauses, never erases it.
  if (
    distance(w.player, site) < site.radius &&
    Math.hypot(w.player.vx, w.player.vy) < 65
  ) {
    m.progress = Math.min(6, m.progress + dt);
    w.player.energy = Math.min(
      getStats(w.traits, w.form).maxEnergy,
      w.player.energy + dt * 4,
    );
    if (m.progress >= 6) finishStation(w);
  }
}
export function migrationTarget(w: World) {
  const m = w.ocean?.migration;
  if (!m?.route)
    return {
      point: MIGRATION_STATIONS[0],
      label: '大迁移开始 · 选择如何沿暖流前行',
    };
  if (m.station >= 2)
    return { point: MIGRATION_HOME, label: '随迁徙鱼群抵达新海岸' };
  const site = MIGRATION_STATIONS[m.station];
  const near = distance(w.player, site) < site.radius + 100;
  if (m.route === 'hunt' && near) {
    const prey = w
      .ocean!.shoal.filter(
        (f) =>
          f.cooldown === 0 &&
          f.radius <= 18 &&
          distance(f, site) < site.radius + 100,
      )
      .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
    return {
      point: prey ?? site,
      label: `${site.name} · 嘴朝向小鱼捕食 ${Math.min(2, m.progress)}/2`,
    };
  }
  return {
    point: site,
    label:
      near && m.route === 'filter'
        ? `${m.expanded ? '停留在光带滤食' : '按 K 展开滤食'} · ${Math.floor(m.progress)}/6 秒`
        : `沿暖流前往${site.name} · ${m.station + 1}/2`,
  };
}
export function migrationLegacy(w: World) {
  const m = w.ocean?.migration;
  if (!m?.arrived) return undefined;
  return m.legs.every((r) => r === 'hunt')
    ? '追随鱼群越过深水'
    : m.legs.every((r) => r === 'filter')
      ? '依靠暖流滤食抵达海岸'
      : '沿暖流捕食与滤食，抵达海岸';
}
