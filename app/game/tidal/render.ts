import { lateralRipples } from './abilities';
import { hasOrgan } from '../body-layout';
import type { World } from '../simulation';
import { tidalEventFlow } from './events';
import { drawTidalMigration } from '../migration-render';
import { getView } from '../camera';
import { drawDepth, drawFeedback } from '../atmosphere';
import { bodyRadius, growthScale } from '../food-chain';
import { FORMS } from '../forms';
import { evolutionFrame } from '../evolution-presentation';
import { drawBody, drawReef } from '../ocean-render';
import { drawTidalHabitat } from './habitat-render';
import { tidalObstacles, tidalFlow } from './habitat';
import { drawTidalActor } from './species-render';
type C = CanvasRenderingContext2D;
export function renderTidal(
  c: C,
  w: World,
  width: number,
  height: number,
  dpr: number,
): void {
  const t = w.ocean!.tidal!,
    p = w.player,
    o = w.ocean!,
    v = getView(w, width, height);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#092938';
  c.fillRect(0, 0, width, height);
  const visualTime =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : w.time;
  drawDepth(c, v, visualTime, true);
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(v.zoom, v.zoom);
  c.translate(-v.cx, -v.cy);
  drawTidalHabitat(c, visualTime, p);
  drawTidalMigration(c, w);
  for (const r of tidalObstacles(t.tick)) drawReef(c, r);
  for (let i = 0; i < 160; i++) {
    const point = { x: (i * 317.3) % 3400, y: (i * 691.7) % 2300 };
    if (
      Math.abs(point.x - v.cx) > width / v.zoom ||
      Math.abs(point.y - v.cy) > height / v.zoom
    )
      continue;
    const flow = tidalEventFlow(w, point, tidalFlow(point, t.tick));
    c.beginPath();
    c.moveTo(point.x, point.y);
    c.lineTo(point.x + flow.x * 0.35, point.y + flow.y * 0.35 + 1);
    c.strokeStyle = '#b8e5e716';
    c.lineWidth = 1;
    c.stroke();
  }
  for (const f of t.foods)
    if (f.state !== 'consumed') {
      c.fillStyle =
        f.kind === 'plankton'
          ? '#d7eab1'
          : f.kind === 'algae'
            ? '#94c78d'
            : '#e5b599';
      c.beginPath();
      c.ellipse(
        f.x,
        f.y,
        f.kind === 'algae' ? 7 : 3,
        f.kind === 'algae' ? 5 : 3,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
      if (
        hasOrgan(o.body, 'glow') &&
        f.state === 'available' &&
        Math.hypot(f.x - p.x, f.y - p.y) < 165
      ) {
        c.beginPath();
        c.arc(f.x, f.y, 12, 0, Math.PI * 2);
        c.strokeStyle = '#d8f4b18c';
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
  for (const actor of [...t.actors].sort((a, b) => a.y - b.y)) {
    if (
      Math.abs(actor.x - v.cx) > width / v.zoom + 150 ||
      Math.abs(actor.y - v.cy) > height / v.zoom + 150
    )
      continue;
    drawTidalActor(c, actor, visualTime);
  }
  const a = t.abilities,
    radius = bodyRadius(w);
  if (a.filterOpen || a.shellSeconds > 0 || o.defenseFlash > 0) {
    c.beginPath();
    c.arc(p.x, p.y, radius + 16, 0, Math.PI * 2);
    c.strokeStyle = a.shellSeconds > 0 ? '#ffe5a7' : '#b8f4d1';
    c.lineWidth = a.shellSeconds > 0 ? 5 : 2;
    if (a.filterOpen) c.setLineDash([4, 7]);
    c.stroke();
    c.setLineDash([]);
  }
  if ((a.inkSeconds ?? 0) > 0) {
    c.beginPath();
    c.arc(p.x, p.y, 80, 0, Math.PI * 2);
    c.fillStyle = '#64527555';
    c.fill();
  }
  if (a.anchored) {
    c.beginPath();
    c.arc(p.x, p.y, radius + 10, 0, Math.PI * 2);
    c.strokeStyle = '#ead2b788';
    c.stroke();
  }
  if (a.reserveEnergy > 0) {
    c.beginPath();
    c.arc(
      p.x,
      p.y,
      radius + 23,
      -Math.PI / 2,
      -Math.PI / 2 + (Math.PI * 2 * a.reserveEnergy) / 40,
    );
    c.strokeStyle = '#e9c57e';
    c.lineWidth = 3;
    c.stroke();
  }
  for (const ripple of lateralRipples(w)) {
    c.beginPath();
    c.arc(ripple.x, ripple.y, 18, 0, Math.PI * 2);
    c.strokeStyle = '#b5dded66';
    c.lineWidth = 1;
    c.stroke();
  }
  if (o.gulp > 0) {
    c.beginPath();
    c.arc(
      p.x + Math.cos(p.angle) * radius,
      p.y + Math.sin(p.angle) * radius,
      8 + o.gulp * 30,
      0,
      Math.PI * 2,
    );
    c.strokeStyle = '#f5e9bc';
    c.lineWidth = 3;
    c.stroke();
  }
  const frame = evolutionFrame(w);
  if (o.morph && frame) {
    c.globalAlpha = frame.parentOpacity;
    drawBody(
      c,
      o.morph.from,
      p.x,
      p.y,
      FORMS[o.morph.from].radius * growthScale(w),
      p.angle,
      w.time,
      w.evolution?.before.traits,
      false,
      undefined,
      w.evolution?.before.body,
    );
    c.globalAlpha = frame.childOpacity;
  }
  drawBody(
    c,
    w.form,
    p.x,
    p.y,
    bodyRadius(w),
    p.angle,
    w.time,
    w.traits,
    false,
    undefined,
    frame?.body ?? o.body,
    undefined,
    1,
    undefined,
    frame?.formation,
  );
  c.globalAlpha = 1;
  if (p.invulnerable > 0) {
    c.strokeStyle = '#cbf6ed66';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, bodyRadius(w) + 12, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
  drawFeedback(c, w, v);
}
