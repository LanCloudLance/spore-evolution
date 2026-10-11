import type { World } from './simulation.ts';
import { MIGRATION_STATIONS, MIGRATION_HOME } from './ocean-migration.ts';
import { bodyRadius } from './food-chain.ts';
import type { View } from './camera.ts';

/** World coordinates: the shells remain the same size when the animal grows. */
export function drawOceanLandmarks(c: CanvasRenderingContext2D) {
  c.save();
  for (const [x, y] of [
    [620, 1630],
    [1490, 850],
    [2530, 760],
    [3030, 520],
  ]) {
    c.translate(x, y);
    c.strokeStyle = '#c6d9bc80';
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < 120; i++) {
      const a = i * 0.12,
        r = 2 + i * 0.24;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.stroke();
    c.translate(-x, -y);
  }
  c.restore();
}

export function drawMigration(c: CanvasRenderingContext2D, w: World, v: View) {
  const o = w.ocean!;
  if (o.tier < 1) return;
  const m = o.migration,
    t = w.time;
  c.save();
  // A distant silhouette has no collider and never inflicts damage.
  const passage = ((m?.elapsed ?? w.age) % 48) / 48;
  const gx = 1550 + passage * 1700,
    gy = 170 + Math.sin(passage * Math.PI) * 190;
  c.save();
  c.translate(gx, gy);
  c.rotate(-0.12);
  c.globalAlpha = 0.19 * Math.sin(passage * Math.PI);
  c.fillStyle = '#78adca';
  c.beginPath();
  c.ellipse(0, 0, 310, 86, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-240, 0);
  c.lineTo(-400, -110);
  c.quadraticCurveTo(-360, 0, -400, 110);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(40, 35);
  c.lineTo(-80, 180);
  c.lineTo(-80, 45);
  c.fill();
  c.restore();
  // Flowing ribbons and small silhouettes forecast the seasonal migration.
  const path = [{ x: 700, y: 1300 }, ...MIGRATION_STATIONS, MIGRATION_HOME];
  for (let leg = 0; leg < path.length - 1; leg++) {
    const a = path[leg],
      b = path[leg + 1];
    c.strokeStyle = '#7bd2e521';
    c.lineWidth = 34;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const f = (i / 12 + t * 0.015) % 1;
      const x = a.x + (b.x - a.x) * f,
        y = a.y + (b.y - a.y) * f + Math.sin(i * 13 + t) * 22;
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      c.fillStyle = '#97bfd735';
      c.beginPath();
      c.ellipse(0, 0, 8, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  if (o.tier === 2)
    for (let i = 0; i < MIGRATION_STATIONS.length; i++) {
      const site = MIGRATION_STATIONS[i],
        done = (m?.station ?? 0) > i,
        active = (m?.station ?? 0) === i;
      const g = c.createRadialGradient(
        site.x,
        site.y,
        5,
        site.x,
        site.y,
        site.radius,
      );
      g.addColorStop(0, done ? '#b8e8ab16' : '#9bdaef36');
      g.addColorStop(1, '#7ecbf000');
      c.fillStyle = g;
      c.beginPath();
      c.arc(site.x, site.y, site.radius, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = done ? '#a1ddb877' : '#9fdded66';
      c.lineWidth = 2 / v.zoom;
      c.setLineDash([6, 12]);
      c.stroke();
      c.setLineDash([]);
      c.font = `${14 / v.zoom}px sans-serif`;
      c.textAlign = 'center';
      c.fillStyle = '#c5f5ec';
      c.fillText(
        `${done ? '✓' : i + 1} ${site.name}`,
        site.x,
        site.y - site.radius - 18 / v.zoom,
      );
      if (active && m?.route === 'filter') {
        for (let j = 0; j < 60 * (1 - m.progress / 7); j++) {
          const a = j * 2.4 + t * 0.2,
            r = Math.sqrt(((j * 19) % 60) / 60) * site.radius * 0.8;
          c.fillStyle = '#d6f4b9b0';
          c.beginPath();
          c.arc(
            site.x + Math.cos(a) * r,
            site.y + Math.sin(a) * r,
            2.5,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      }
    }
  if (m?.expanded) {
    const p = w.player,
      r = bodyRadius(w) + 50;
    c.strokeStyle = '#c5eef2aa';
    c.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = t * 0.08 + (i * Math.PI) / 6;
      c.beginPath();
      c.moveTo(p.x + Math.cos(a) * r * 0.4, p.y + Math.sin(a) * r * 0.4);
      c.quadraticCurveTo(
        p.x + Math.cos(a + 0.3) * r * 0.8,
        p.y + Math.sin(a + 0.3) * r * 0.8,
        p.x + Math.cos(a) * r,
        p.y + Math.sin(a) * r,
      );
      c.stroke();
    }
    c.lineWidth = 4;
    c.beginPath();
    c.arc(
      p.x,
      p.y,
      r + 9,
      -Math.PI / 2,
      -Math.PI / 2 + (Math.PI * 2 * m.progress) / 6,
    );
    c.stroke();
  }
  c.restore();
}

/** Active tidal migration draws actual event time and earned refuge, never the old selected-route stations. */
export function drawTidalMigration(c: CanvasRenderingContext2D, w: World) {
  const t = w.ocean!.tidal!,
    e = t.events,
    home = { x: 3060, y: 390 };
  c.save();
  const open = t.tick >= 90 * 120 && (t.tick / 120) % 90 < 30;
  c.lineWidth = 4;
  c.strokeStyle = t.migration.refuge
    ? '#cde5a5'
    : open
      ? '#c6ece5aa'
      : '#adbcba44';
  c.beginPath();
  c.ellipse(home.x, home.y, 210, 145, 0, 0, Math.PI * 2);
  c.stroke();
  if (t.migration.refuge) {
    c.fillStyle = '#aacb9b';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.ellipse(
        home.x + Math.cos(a) * 35,
        home.y + Math.sin(a) * 24,
        20,
        8,
        a,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  if (e.active && e.phase !== 'recover') {
    const point =
      e.active === 'spring-tide'
        ? home
        : e.active === 'food-shift'
          ? { x: 1550, y: 700 }
          : { x: 810, y: 1770 };
    const warning = e.phase === 'warning';
    c.strokeStyle = warning ? '#e8d59a77' : '#bddfda77';
    c.setLineDash(warning ? [12, 10] : []);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(point.x, point.y, warning ? 175 : 150, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = warning ? '#efe2b8' : '#d5ede2';
    c.font = '14px sans-serif';
    c.textAlign = 'center';
    const name =
      e.active === 'spring-tide'
        ? '大潮'
        : e.active === 'food-shift'
          ? '食物带转向'
          : '猎手来访';
    c.fillText(
      `${name}${warning ? ` · ${Math.max(0, Math.ceil(8 - e.seconds))}秒后` : ' · 正在发生'}`,
      point.x,
      point.y - 190,
    );
  }
  c.restore();
}
