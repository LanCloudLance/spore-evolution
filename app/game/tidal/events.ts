import type { World } from '../simulation.ts';
import { distance } from '../simulation.ts';
import { emittedTidalSignal } from './ecology.ts';
import { TIDAL_BIOMES } from './catalog.ts';
import type { TidalSignal, TidalEvent, TidalState } from './types.ts';
/** Only simulation time opens a tide. The first opening follows a visible warning. */
export function tidalWindow(w: World): boolean {
  const tick = w.ocean?.tidal?.tick ?? 0;
  return tick >= 90 * 120 && (tick / 120) % 90 < 30;
}
function phaseAt(tick: number): {
  active: TidalEvent | null;
  phase: TidalState['events']['phase'];
  start: number;
} {
  const seconds = tick / 120,
    cycle = Math.floor(seconds / 90),
    p = seconds % 90,
    base = cycle * 90;
  if (p < 30)
    return {
      active: cycle === 0 ? null : 'spring-tide',
      phase: cycle === 0 ? 'idle' : 'active',
      start: base,
    };
  if (p < 38)
    return { active: 'food-shift', phase: 'warning', start: base + 30 };
  if (p < 48)
    return { active: 'food-shift', phase: 'active', start: base + 38 };
  if (p < 55)
    return { active: 'food-shift', phase: 'recover', start: base + 48 };
  if (p < 63)
    return { active: 'hunter-visit', phase: 'warning', start: base + 55 };
  if (p < 73)
    return { active: 'hunter-visit', phase: 'active', start: base + 63 };
  if (p < 82)
    return { active: 'hunter-visit', phase: 'recover', start: base + 73 };
  return { active: 'spring-tide', phase: 'warning', start: base + 82 };
}
const consumed = new WeakMap<World, number>();
export function stepTidalEvents(
  w: World,
  dt: number,
  signals: readonly TidalSignal[],
): void {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'running' ||
    w.ocean.morph ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return;
  dt = Math.min(dt, 0.05);
  const t = w.ocean.tidal,
    e = t.events,
    m = t.migration,
    phase = phaseAt(t.tick);
  const previous = e.active,
    previousPhase = e.phase;
  if (
    previous &&
    previousPhase === 'active' &&
    (phase.active !== previous || phase.phase !== 'active')
  ) {
    const id = `${previous}:${Math.floor((t.tick - 1) / (90 * 120))}`;
    e.completed = [
      ...e.completed.filter((id) => !id.startsWith(`${previous}:`)),
      id,
    ];
  }
  Object.assign(e, {
    active: phase.active,
    phase: phase.phase,
    seconds: t.tick / 120 - phase.start,
  });
  if (
    phase.phase === 'active' &&
    (previous !== phase.active || previousPhase !== 'active')
  )
    e.lastStrongTick = Math.round(phase.start * 120);
  if (e.active === 'food-shift' && e.phase === 'active') {
    const direction = Math.floor(t.tick / (90 * 120)) % 2 ? -1 : 1;
    // Existing particles flow toward a new hotspot; consumed stock still regrows normally.
    for (const f of t.foods)
      if (
        f.state === 'available' &&
        f.kind === 'plankton' &&
        f.biome === 'drift'
      ) {
        const goal = {
            x: TIDAL_BIOMES[2].x + direction * 180,
            y: TIDAL_BIOMES[2].y - 70,
          },
          d = distance(f, goal);
        if (d > 1) {
          f.x += ((goal.x - f.x) / d) * Math.min(d, 18 * dt);
          f.y += ((goal.y - f.y) / d) * Math.min(d, 18 * dt);
        }
      }
  }
  if (e.active === 'hunter-visit')
    t.regions.nursery.alert = Math.min(
      TIDAL_BIOMES[0].alertCap,
      t.regions.nursery.alert + dt * (e.phase === 'active' ? 0.2 : 0.02),
    );
  // A fresh adult departure owns its own travel evidence; historical visits remain in OceanState.visited.
  if (
    w.ocean.tier === 2 &&
    m.startedTick === null &&
    distance(w.player, TIDAL_BIOMES[0]) > 250
  ) {
    m.startedTick = t.tick;
    m.visited = [];
  }
  let last = consumed.get(w) ?? 0;
  for (const signal of signals) {
    if (
      !emittedTidalSignal(w, signal) ||
      signal.tick !== t.tick ||
      signal.seq <= last
    )
      continue;
    last = Math.max(last, signal.seq);
    if (
      m.startedTick === null ||
      signal.tick < m.startedTick ||
      signal.actorId !== 'player' ||
      signal.amount <= 0
    )
      continue;
    const kind =
      signal.kind === 'filter'
        ? 'filter'
        : signal.kind === 'reserve-use'
          ? 'reserve'
          : signal.kind === 'feed' &&
              t.actors.some((a) => a.id === signal.targetId && a.health <= 0)
            ? 'hunt'
            : null;
    if (kind) m.gains[kind] = Math.min(1e6, m.gains[kind] + signal.amount);
  }
  consumed.set(w, last);
}

/** River-mouth flow is physical: an ebb pushes outward, an open tide carries the body toward shelter. */
export function tidalEventFlow(
  w: World,
  point: { x: number; y: number },
  base: { x: number; y: number },
) {
  const home = TIDAL_BIOMES[3],
    d = distance(point, home);
  if (d <= 210 || d >= 620) return { ...base };
  const strength =
    Math.sin(((d - 210) / 410) * Math.PI) * (tidalWindow(w) ? 35 : -55);
  return {
    x: base.x + ((home.x - point.x) / d) * strength,
    y: base.y + ((home.y - point.y) / d) * strength,
  };
}
