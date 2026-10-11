import { worldBodyPose, trunkCircles } from './body-geometry.ts';
import type { World } from './simulation';
export type View = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  zoom: number;
};
const views = new WeakMap<World, View & { key: string }>();
function target(w: World, width: number, height: number): View {
  const intro = w.mode === 'ready',
    ocean = w.habitat === 'ocean';
  const birth = w.land?.morph,
    focus = birth
      ? Math.sin(Math.PI * Math.min(1, birth.elapsed / birth.duration))
      : 0;
  let zoom =
    (intro
      ? 2.5
      : ocean
        ? Math.max(
            0.45,
            Math.min(1.4, (Math.min(width, height) / 720) * 1.15),
          ) /
          (1 + Math.max(0, (w.ocean?.biomass ?? 0) - 45) * 0.006)
        : Math.max(
            0.45,
            Math.min(
              w.habitat === 'pond' ? 1.4 : 1.15,
              Math.min(width, height) / (w.habitat === 'pond' ? 540 : 700),
            ),
          )) *
    (1 + focus * 0.85);
  if (!intro && (w.shore || w.land)) {
    const circles = trunkCircles({ ...worldBodyPose(w), angle: 0, x: 0, y: 0 });
    const length =
      Math.max(...circles.map((c) => c.x + c.radius)) -
      Math.min(...circles.map((c) => c.x - c.radius));
    zoom = Math.min(zoom, (Math.min(width, height) * 0.12) / length);
  }
  return {
    width,
    height,
    zoom,
    cx:
      w.player.x +
      (intro ? -width * 0.18 : width > 950 ? 110 * (1 - focus) : 0) / zoom,
    cy:
      w.player.y +
      (w.ocean?.tidal?.compat.mode === 'active' && width <= 950 && height > 500
        ? 65 / zoom
        : 0),
  };
}
export function getView(w: World, width: number, height: number) {
  const v = views.get(w);
  return v && v.width === width && v.height === height
    ? v
    : target(w, width, height);
}
export function updateCamera(
  w: World,
  width: number,
  height: number,
  dt: number,
) {
  const goal = target(w, width, height),
    key = `${w.habitat}:${w.generation}:${w.mode === 'ready'}`;
  const prev = views.get(w);
  if (
    !prev ||
    prev.key !== key ||
    prev.width !== width ||
    prev.height !== height
  ) {
    views.set(w, { ...goal, key });
    return;
  }
  if (w.mode !== 'running') return;
  const k = 1 - Math.exp(-Math.min(dt, 0.1) * 9);
  prev.cx += (goal.cx - prev.cx) * k;
  prev.cy += (goal.cy - prev.cy) * k;
  prev.zoom += (goal.zoom - prev.zoom) * k;
}
