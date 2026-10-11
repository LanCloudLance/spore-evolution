import type { Vec } from '../simulation.ts';
import type { Circle } from '../body-geometry.ts';
import { TIDAL_BIOMES } from './catalog.ts';
import type { BiomeId } from './types.ts';
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
/** The reef crack is 60 units wide; its western bypass remains open for a full adult. */
const rocks: readonly Circle[] = [
  { x: 840, y: 1450, radius: 80 },
  { x: 2230, y: 1230, radius: 90 },
  { x: 2230, y: 1470, radius: 90 },
  { x: 2500, y: 1620, radius: 105 },
  { x: 2710, y: 1000, radius: 92 },
  { x: 850, y: 420, radius: 76 },
];
export function biomeAt(point: Vec): BiomeId {
  return [...TIDAL_BIOMES].sort(
    (a, b) => distance(point, a) / a.radius - distance(point, b) / b.radius,
  )[0].id;
}
export function tidalObstacles(_tick: number): Circle[] {
  return rocks.map((r) => ({ ...r }));
}
export function tidalCover(point: Vec): number {
  if (distance(point, TIDAL_BIOMES[0]) < 360) return 1;
  if (rocks.some((r) => distance(point, r) < r.radius + 85)) return 0.7;
  if (distance(point, TIDAL_BIOMES[3]) < 150) return 0.8;
  return 0;
}
export function tidalFlow(point: Vec, tick: number): Vec {
  if (distance(point, TIDAL_BIOMES[0]) < 250) return { x: 0, y: 0 };
  const time = tick / 120,
    biome = biomeAt(point),
    cover = tidalCover(point);
  const drift =
    biome === 'drift'
      ? Math.max(0, 1 - distance(point, TIDAL_BIOMES[2]) / 650)
      : 0;
  const strength = 1 - cover * 0.8;
  return {
    x: (Math.sin(point.y / 360 + time * 0.12) * 9 + drift * 85) * strength,
    y:
      (Math.cos(point.x / 400) * 6 - drift * 22 + Math.sin(time * 0.22) * 5) *
      strength,
  };
}
export function nearestTidalSafePoint(point: Vec): Vec {
  const safe = [TIDAL_BIOMES[0], TIDAL_BIOMES[2], TIDAL_BIOMES[3]].sort(
    (a, b) => distance(point, a) - distance(point, b),
  )[0];
  return { x: safe.x, y: safe.y };
}

/** Tiny visibility graph around six reefs. NPCs use the broad route rather than wedging in a juvenile crack. */
const navigationGraphs = new Map<
  number,
  { points: Vec[]; links: { to: number; cost: number }[][] }
>();
function clearSegment(a: Vec, b: Vec, radius: number) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d2 = dx * dx + dy * dy;
  return !rocks.some((r) => {
    const f = d2
      ? Math.max(0, Math.min(1, ((r.x - a.x) * dx + (r.y - a.y) * dy) / d2))
      : 0;
    return (
      Math.hypot(a.x + f * dx - r.x, a.y + f * dy - r.y) <
      r.radius + radius - 1e-6
    );
  });
}
export function tidalWaypoint(from: Vec & { radius: number }, goal: Vec): Vec {
  const radius = from.radius * 0.8;
  if (clearSegment(from, goal, radius)) return goal;
  let graph = navigationGraphs.get(radius);
  if (!graph) {
    const points = rocks
      .flatMap((r) =>
        Array.from({ length: 8 }, (_, i) => ({
          x: r.x + Math.cos((i * Math.PI) / 4) * (r.radius + radius + 28),
          y: r.y + Math.sin((i * Math.PI) / 4) * (r.radius + radius + 28),
        })),
      )
      .filter(
        (p) => !rocks.some((r) => distance(p, r) < r.radius + radius + 2),
      );
    graph = {
      points,
      links: points.map((a) =>
        points.flatMap((b, to) =>
          a !== b && clearSegment(a, b, radius)
            ? [{ to, cost: distance(a, b) }]
            : [],
        ),
      ),
    };
    if (navigationGraphs.size >= 24)
      navigationGraphs.delete(navigationGraphs.keys().next().value!);
    navigationGraphs.set(radius, graph);
  }
  const { points, links } = graph,
    costs = points.map((p) =>
      clearSegment(from, p, radius) ? distance(from, p) : Infinity,
    ),
    first = points.map((_, i) => i),
    done = new Set<number>();
  let best = Infinity,
    next = goal;
  for (let step = 0; step < points.length; step++) {
    let index = -1,
      min = Infinity;
    for (let i = 0; i < points.length; i++)
      if (!done.has(i) && costs[i] < min) {
        min = costs[i];
        index = i;
      }
    if (index < 0 || min >= best) break;
    done.add(index);
    if (
      clearSegment(points[index], goal, radius) &&
      min + distance(points[index], goal) < best
    ) {
      best = min + distance(points[index], goal);
      next = points[first[index]];
    }
    for (const link of links[index])
      if (min + link.cost < costs[link.to]) {
        costs[link.to] = min + link.cost;
        first[link.to] =
          distance(from, points[first[index]]) < 4 ? link.to : first[index];
      }
  }
  return next;
}
