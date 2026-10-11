import { pondRadius } from './pond-life.ts';
import type { BodyDesign, Organ } from './body-design.ts';
import { listOrgans, organAnchor } from './body-layout.ts';
import type { BodyForm } from './forms.ts';
import { FORMS } from './forms.ts';
import type { World } from './simulation.ts';

type Point = { x: number; y: number };
export type Circle = Point & { radius: number };
export type BodyPose = Point & {
  angle: number;
  form: BodyForm;
  size: number;
  body?: BodyDesign;
};
export function worldBodyPose(w: World): BodyPose {
  let growth = 1;
  if (w.ocean) growth += w.ocean.biomass * 0.011;
  if (w.shore) {
    const s = w.shore;
    // Arrival retains the ocean adult's size. New land anatomy then changes the
    // chapter's scale gradually during the existing protected transformation.
    const mix =
      s.tier === 0
        ? 0
        : s.morph
          ? Math.min(1, s.morph.elapsed / s.morph.duration)
          : 1;
    growth = 1 + s.biomass * (0.011 * (1 - mix) + 0.004 * mix);
  }
  if (w.land) {
    const level =
      (w.land.nutrition ?? 0) >= 4 ? 2 : (w.land.nutrition ?? 0) >= 2 ? 1 : 0;
    growth =
      (1 + Math.min(70, w.land.biomass) * 0.002) *
      (w.form === 'stalker' ? 1 + level * 0.14 : 1);
  }
  return {
    ...w.player,
    form: w.form,
    size: w.habitat === 'pond' ? pondRadius(w) : FORMS[w.form].radius * growth,
    body: w.land?.body ?? w.shore?.body ?? w.ocean?.body,
  };
}
// Local units match drawBody's 36-unit templates. Soft tails, legs and tentacles
// are deliberately excluded. Capsules approximate the load-bearing silhouette.
const profiles: Record<BodyForm, [number, number, number]> = {
  microbe: [0, 34, 34],
  colony: [0, 36, 30],
  radial: [0, 27, 27],
  bilateral: [-10, 29, 15],
  jelly: [12, 28, 34],
  fish: [1, 40, 20],
  crawler: [-5, 34, 18],
  skipper: [-5, 34, 18],
  strider: [4, 43, 15],
  stalker: [3, 49, 23],
};
function transform(p: BodyPose, x: number, y: number): Point {
  const k = p.size / 36;
  x *= k * (p.body?.length ?? 1);
  y *= k * (p.body?.width ?? 1);
  return {
    x: p.x + x * Math.cos(p.angle) - y * Math.sin(p.angle),
    y: p.y + x * Math.sin(p.angle) + y * Math.cos(p.angle),
  };
}
export function trunkCircles(p: BodyPose): Circle[] {
  const [offset, rx, ry] = profiles[p.form];
  const x = (rx * (p.body?.length ?? 1) * p.size) / 36;
  const y = (ry * (p.body?.width ?? 1) * p.size) / 36;
  const r = Math.min(x, y),
    span = Math.abs(x - y);
  const center = transform(p, offset, 0),
    a = p.angle + (x < y ? Math.PI / 2 : 0);
  const count = span === 0 ? 1 : Math.max(3, Math.ceil((span * 2) / r) + 1);
  return Array.from({ length: count }, (_, i) => {
    const d = count === 1 ? 0 : -span + (2 * span * i) / (count - 1);
    return {
      x: center.x + Math.cos(a) * d,
      y: center.y + Math.sin(a) * d,
      radius: r,
    };
  });
}
export function organZones(p: BodyPose, organ: Organ): Circle[] {
  return (p.body ? listOrgans(p.body) : [])
    .filter((part) => part.organ === organ)
    .map((part) => {
      return {
        ...organAnchor(p, part),
        radius:
          (p.size / 36) *
          (organ === 'spine' ? 12 : organ === 'filter' ? 22 : 12) *
          Math.min(p.body!.length, p.body!.width),
      };
    });
}
export const circlesTouch = (a: Circle, b: Circle) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius;
export const trunkTouches = (p: BodyPose, target: Circle) =>
  trunkCircles(p).some((c) => circlesTouch(c, target));
export const organTouches = (p: BodyPose, target: Circle, organ: Organ) =>
  organZones(p, organ).some((c) => circlesTouch(c, target));

/** Resolve position only: tangential velocity survives, so walls allow sliding. */
export function constrainBody(
  p: BodyPose,
  rocks: Circle[],
  map: { width: number; height: number },
): Point {
  const q = { ...p };
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const rock of rocks) {
      for (const c of trunkCircles(q)) {
        const dx = c.x - rock.x,
          dy = c.y - rock.y,
          d = Math.hypot(dx, dy);
        const overlap = c.radius + rock.radius - d;
        if (overlap > 0.001) {
          q.x += (d > 0 ? dx / d : Math.cos(q.angle)) * overlap;
          q.y += (d > 0 ? dy / d : Math.sin(q.angle)) * overlap;
          changed = true;
          break;
        }
      }
    }
    const bounds = trunkCircles(q);
    const left = Math.min(...bounds.map((c) => c.x - c.radius)),
      right = Math.max(...bounds.map((c) => c.x + c.radius));
    const top = Math.min(...bounds.map((c) => c.y - c.radius)),
      bottom = Math.max(...bounds.map((c) => c.y + c.radius));
    const bx = Math.max(0, -left) - Math.max(0, right - map.width),
      by = Math.max(0, -top) - Math.max(0, bottom - map.height);
    q.x += bx;
    q.y += by;
    changed ||= Math.abs(bx) + Math.abs(by) > 0.001;
    if (!changed) break;
  }
  return { x: q.x, y: q.y };
}

export function drawBodyGeometry(c: CanvasRenderingContext2D, p: BodyPose) {
  c.save();
  c.lineWidth = 1.5;
  for (const [color, zones] of [
    ['#70f0bc', trunkCircles(p)],
    ['#ffca77', organZones(p, 'jaw')],
    ['#ed89ff', organZones(p, 'spine')],
    ['#84dcff', organZones(p, 'filter')],
  ] as const) {
    c.strokeStyle = color;
    for (const z of zones) {
      c.beginPath();
      c.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.restore();
}
