import type { SpaceState } from './space.ts';
import { STARS } from './space.ts';
export function flightPresentation(s: SpaceState, reduced = false) {
  const f = s.flight,
    a = STARS[f?.from ?? s.location],
    b = STARS[f?.to ?? s.location];
  const progress = f ? Math.max(0, Math.min(1, f.elapsed / f.duration)) : 0;
  const t = reduced ? 0 : progress;
  return {
    progress,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - 180 * t * (1 - t) - 58,
    angle: f
      ? (Math.atan2(b.y - a.y - 180 + 360 * t, b.x - a.x) * 180) / Math.PI + 90
      : 0,
    path: `M${a.x} ${a.y - 58} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 148} ${b.x} ${b.y - 58}`,
  };
}
