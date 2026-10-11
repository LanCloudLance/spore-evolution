import type { Vec } from './simulation.ts';
type Terrain = { obstacles: (Vec & { radius: number })[]; clearance: number };
export type Navigation = {
  avoidDanger?: boolean;
  arrivalRadius?: number;
  preyId?: number;
  pondIntent?: 'hunt' | 'visit';
  landCreatureId?: number;
  foodId?: string;
  foodHeading?: number;
  oceanActorId?: string;
  oceanIntent?: 'hunt' | 'visit';
  target: Vec;
  stalled: number;
  last: Vec;
  path?: Vec[];
};
/** A small visibility graph for the handful of solid circles; computed once per click. */
function terrainPath(start: Vec, target: Vec, terrain: Terrain): Vec[] | null {
  const circles = terrain.obstacles.map((o) => ({
    ...o,
    radius: o.radius + terrain.clearance + 6,
  }));
  for (const circle of circles) {
    const dx = target.x - circle.x,
      dy = target.y - circle.y,
      d = Math.hypot(dx, dy);
    if (d < circle.radius + 1) {
      const angle =
        d > 0
          ? Math.atan2(dy, dx)
          : Math.atan2(start.y - circle.y, start.x - circle.x);
      target.x = circle.x + Math.cos(angle) * (circle.radius + 2);
      target.y = circle.y + Math.sin(angle) * (circle.radius + 2);
    }
  }
  const clear = (a: Vec, b: Vec) =>
    circles.every((o) => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        l = dx * dx + dy * dy;
      const t = l
        ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.y - a.y) * dy) / l))
        : 0;
      const d = Math.hypot(a.x + dx * t - o.x, a.y + dy * t - o.y);
      // A body already near a rock can first move away from its conservative envelope.
      if (a === start && Math.hypot(a.x - o.x, a.y - o.y) < o.radius)
        return (
          (a.x - o.x) * dx + (a.y - o.y) * dy >= 0 &&
          Math.hypot(b.x - o.x, b.y - o.y) > o.radius
        );
      return d >= o.radius;
    });
  if (clear(start, target)) return [{ ...target }];
  const points = [
    start,
    target,
    ...circles.flatMap((o) =>
      Array.from({ length: 12 }, (_, i) => ({
        x: o.x + Math.cos((i * Math.PI) / 6) * (o.radius + 18),
        y: o.y + Math.sin((i * Math.PI) / 6) * (o.radius + 18),
      })),
    ),
  ];
  const cost = points.map(() => Infinity),
    parent = points.map(() => -1),
    visited = new Set<number>();
  cost[0] = 0;
  while (visited.size < points.length) {
    let current = -1;
    for (let i = 0; i < points.length; i++)
      if (!visited.has(i) && (current < 0 || cost[i] < cost[current]))
        current = i;
    if (current < 0 || !Number.isFinite(cost[current])) break;
    if (current === 1) {
      const path: Vec[] = [];
      for (let p = 1; p !== 0; p = parent[p]) path.unshift({ ...points[p] });
      return path;
    }
    visited.add(current);
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i) || !clear(points[current], points[i])) continue;
      const next =
        cost[current] +
        Math.hypot(
          points[i].x - points[current].x,
          points[i].y - points[current].y,
        );
      if (next < cost[i]) {
        cost[i] = next;
        parent[i] = current;
      }
    }
  }
  return null;
}
export function guideNavigation(
  n: Navigation,
  player: Vec,
  dt: number,
  terrain?: Terrain,
) {
  if (terrain && !n.path) {
    const path = terrainPath(player, n.target, terrain);
    if (!path) return null;
    n.path = path;
  }
  while (
    n.path &&
    n.path.length > 1 &&
    Math.hypot(n.path[0].x - player.x, n.path[0].y - player.y) < 18
  )
    n.path.shift();
  const target = n.path?.[0] ?? n.target;
  const d = Math.hypot(target.x - player.x, target.y - player.y);
  const arrival =
    n.path && n.path.length > 1
      ? 18
      : Number.isFinite(n.arrivalRadius)
        ? Math.max(1, Math.min(180, n.arrivalRadius!))
        : 18;
  if (d < arrival) return null;
  n.stalled =
    Math.hypot(player.x - n.last.x, player.y - n.last.y) < 0.2
      ? n.stalled + dt
      : 0;
  n.last = { x: player.x, y: player.y };
  if (n.stalled > 1.3) return null;
  const strength = Math.min(1, d / 65);
  return {
    x: ((target.x - player.x) / d) * strength,
    y: ((target.y - player.y) / d) * strength,
  };
}
export type NavigationTap = { target: Vec; screen: Vec; started: number };
export function captureNavigationTap(
  view: { cx: number; cy: number; zoom: number; width: number; height: number },
  screen: Vec,
  started: number,
): NavigationTap {
  return {
    target: {
      x: view.cx + (screen.x - view.width / 2) / view.zoom,
      y: view.cy + (screen.y - view.height / 2) / view.zoom,
    },
    screen: { ...screen },
    started,
  };
}
export function releaseNavigationTap(
  tap: NavigationTap,
  screen: Vec,
  now: number,
  player: Vec,
): Navigation | null {
  if (
    now - tap.started >= 280 ||
    Math.hypot(screen.x - tap.screen.x, screen.y - tap.screen.y) > 12
  )
    return null;
  return {
    target: { ...tap.target },
    last: { x: player.x, y: player.y },
    stalled: 0,
  };
}
