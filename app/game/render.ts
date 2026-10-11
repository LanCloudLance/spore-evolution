import { pondRadius, POND_PREY, pondDefending, pondJetting } from './pond-life';
import { drawOrganism } from './organism-render';
export { drawOrganism } from './organism-render';
import { renderLand } from './land-render';
import { renderShore } from './shore-render';
import { cachedGlow, drawDepth, drawFeedback } from './atmosphere';
import { renderOcean } from './ocean-render';
import { getView } from './camera';
import {
  MAP,
  NURSERY,
  HAVEN,
  SUNLIGHT,
  CURRENT,
  waterFlow,
  distance,
} from './simulation';
import type { World, Vec } from './simulation';

export function pointerVector(
  world: World,
  width: number,
  height: number,
  x: number,
  y: number,
): Vec {
  const v = getView(world, width, height);
  const px = (world.player.x - v.cx) * v.zoom + width / 2,
    py = (world.player.y - v.cy) * v.zoom + height / 2;
  const d = Math.hypot(x - px, y - py);
  const strength = Math.min(1, Math.max(0, (d - 10) / 75));
  return {
    x: ((x - px) / Math.max(1, d)) * strength,
    y: ((y - py) / Math.max(1, d)) * strength,
  };
}
const glow = cachedGlow;
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}
const motes = Array.from({ length: 230 }, (_, i) => ({
  x: ((((Math.sin(i * 127.1) * 43758.5453) % 1) + 1) % 1) * MAP.width,
  y: ((((Math.sin(i * 311.7) * 29345.221) % 1) + 1) % 1) * MAP.height,
  r: i % 5 === 0 ? 3 : 1.2,
}));

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  ambient: number,
  dpr = 1,
) {
  if (world.habitat === 'land') {
    renderLand(ctx, world, width, height, dpr);
    return;
  }
  if (world.habitat === 'shore') {
    renderShore(ctx, world, width, height, dpr);
    return;
  }
  if (world.habitat === 'ocean') {
    renderOcean(ctx, world, width, height, dpr);
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#071b23');
  bg.addColorStop(0.5, '#0b2b32');
  bg.addColorStop(1, '#101e30');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const v = getView(world, width, height),
    t = world.mode === 'ready' ? ambient : world.time;
  drawDepth(ctx, v, t, false);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(v.zoom, v.zoom);
  ctx.translate(-v.cx, -v.cy);
  glow(ctx, NURSERY.x, NURSERY.y, 700, '#1b655b35');
  glow(ctx, SUNLIGHT.x, SUNLIGHT.y, 620, '#59916230');
  glow(ctx, CURRENT.x, CURRENT.y, 540, '#4f508d32');
  glow(ctx, HAVEN.x, HAVEN.y, 350, '#65907535');
  // Water currents are both scenery and directional information for movement.
  for (const m of motes) {
    const flow = waterFlow(m, t),
      x = m.x + Math.sin(t * 0.12 + m.y) * 12,
      y = m.y + Math.cos(t * 0.1 + m.x) * 12;
    ctx.globalAlpha = 0.18 + (Math.sin(t * 0.8 + m.x) + 1) * 0.13;
    ctx.fillStyle = '#bbdfd6';
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
    if (Math.hypot(flow.x, flow.y) > 12) {
      ctx.strokeStyle = '#a6b6de';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + flow.x * 0.4, y + flow.y * 0.4);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 13; i++) {
    const a = i * 2.399,
      r = SUNLIGHT.radius * (0.3 + i / 20),
      x = SUNLIGHT.x + Math.cos(a) * r,
      y = SUNLIGHT.y + Math.sin(a) * r;
    glow(ctx, x, y, 38, '#9cc07a19');
    for (let j = 0; j < 6; j++)
      ellipse(
        ctx,
        x + Math.cos(j * 1.05 + t * 0.05) * 17,
        y + Math.sin(j * 1.05 + t * 0.05) * 17,
        9,
        6,
        '#62967915',
        '#a4c27c16',
      );
  }
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 12]);
  ctx.strokeStyle = '#9bccb82a';
  ctx.beginPath();
  ctx.arc(NURSERY.x, NURSERY.y, NURSERY.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (world.mode !== 'ready') {
    zoneLabel(ctx, NURSERY, '育生水域', '#97d5b7');
    zoneLabel(ctx, SUNLIGHT, '浅光藻场', '#d1dd9c');
    zoneLabel(ctx, CURRENT, '回流水道', '#bdbade');
    ctx.strokeStyle =
      world.generation >= 3 && !world.freeLife ? '#cde79999' : '#aac4aa33';
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(HAVEN.x, HAVEN.y, HAVEN.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    zoneLabel(
      ctx,
      HAVEN,
      world.generation >= 3 && !world.freeLife
        ? '新栖息地 · 抵达即可定居'
        : '新栖息地 · 第三代开启',
      '#d9e9b1',
    );
  }
  for (const food of world.foods) {
    if (food.cooldown > 0) continue;
    const pulse = 1 + Math.sin(t * 2 + food.id) * 0.12;
    glow(ctx, food.x, food.y, 21, food.rich ? '#b1d66c1a' : '#60ebad1a');
    ctx.save();
    ctx.translate(food.x, food.y);
    ctx.rotate(food.id + t * 0.15);
    ctx.scale(pulse, pulse);
    ellipse(
      ctx,
      0,
      0,
      food.rich ? 7 : 5.5,
      food.rich ? 4.5 : 4,
      food.rich ? '#c3de8ab3' : '#8bd2a8bb',
      food.rich ? '#d5eeac' : '#b0eac6',
    );
    ellipse(ctx, -1, -0.5, 1.5, 1.3, '#f1ffddaa');
    ctx.restore();
  }
  for (const enemy of world.predators) {
    if ((enemy.respawn ?? 0) > 0) continue;
    if (enemy.alert) {
      ctx.strokeStyle = '#e6a16b24';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 8]);
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 90 + Math.sin(t * 4) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawOrganism(
      ctx,
      enemy.x,
      enemy.y,
      29 + (enemy.id % 3) * 3,
      enemy.angle,
      t,
      [],
      true,
      enemy.alert,
    );
    if (enemy.stun > 0) {
      ctx.fillStyle = '#efd3a7';
      ctx.font = '18px sans-serif';
      ctx.fillText('· · ·', enemy.x - 12, enemy.y - 45);
    }
  }
  for (const g of world.pondLife?.gifts ?? []) {
    if (g.life <= 0) continue;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 8 + Math.sin(t * 5), 0, Math.PI * 2);
    ctx.fillStyle = '#efd293';
    ctx.fill();
    ctx.strokeStyle = '#fdf0c5';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const prey of world.pondLife?.prey ?? []) {
    if (prey.cooldown > 0) continue;
    const d = POND_PREY[prey.species];
    drawOrganism(ctx, prey.x, prey.y, prey.radius, prey.angle, t, [d.trait]);
    if (pondDefending(prey, t) || pondJetting(prey, t)) {
      ctx.beginPath();
      ctx.arc(prey.x, prey.y, prey.radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = pondDefending(prey, t) ? 2 : 1;
      ctx.stroke();
    }
    if (distance(prey, world.player) < 180 && world.mode !== 'ready') {
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = d.color;
      ctx.fillText(
        (prey.trust ?? 0) > 0
          ? '赠食回应 · 暂时信任你'
          : (prey.observation ?? 0) > 0 &&
              prey.studiedGeneration !== world.generation
            ? `观察 ${Math.round((prey.observation ?? 0) * 50)}%`
            : d.skill + ' DNA',
        prey.x,
        prey.y - prey.radius - 10,
      );
    }
  }
  const p = world.player;
  if (p.dashing) {
    for (let i = 1; i < 6; i++) {
      ctx.globalAlpha = (1 - i / 6) * 0.17;
      ellipse(
        ctx,
        p.x - Math.cos(p.angle) * i * 12,
        p.y - Math.sin(p.angle) * i * 12,
        18,
        12,
        '#b5efd2',
      );
    }
    ctx.globalAlpha = 1;
  }
  if (p.invulnerable > 0) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 22);
  drawOrganism(
    ctx,
    p.x,
    p.y,
    pondRadius(world),
    p.angle,
    t,
    world.traits,
    false,
    false,
    {},
    world.dnaLineage?.body,
  );
  ctx.globalAlpha = 1;
  if (world.mode === 'ready') {
    ctx.strokeStyle = '#c0dec93b';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = '#c7f1d57a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 40, -0.8, 0.8);
    ctx.stroke();
    if (world.age < 12) {
      ctx.fillStyle = '#e0eddf';
      ctx.textAlign = 'center';
      ctx.font = '13px sans-serif';
      ctx.fillText('你的生命', p.x, p.y + 56);
    }
  }
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.min(1, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#c2d8cd33';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, MAP.width - 16, MAP.height - 16);
  ctx.restore();
  // Offscreen destination indicator remains in the unobscured play area.
  if (world.mode === 'running') {
    const target = world.generation >= 3 && !world.freeLife ? HAVEN : NURSERY;
    const needsGuide =
      (world.generation >= 3 && !world.freeLife) || world.food >= 8;
    const screenX = (target.x - v.cx) * v.zoom + width / 2,
      screenY = (target.y - v.cy) * v.zoom + height / 2;
    if (
      needsGuide &&
      distance(p, target) > target.radius &&
      (screenX < 60 ||
        screenX > width - 330 ||
        screenY < 70 ||
        screenY > height - 80)
    ) {
      const a = Math.atan2(target.y - p.y, target.x - p.x),
        cx = width / 2 - (width > 950 ? 110 : 0),
        cy = height / 2;
      const len = Math.min(width * 0.3, height * 0.35),
        x = cx + Math.cos(a) * len,
        y = cy + Math.sin(a) * len;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#d9ecae';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#d9ecae';
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillText(
        world.generation >= 3 && !world.freeLife ? '新栖息地' : '返回育生水域',
        x,
        y + 24,
      );
    }
  }
  if (world.mode !== 'ready') drawFeedback(ctx, world, v);
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    height * 0.2,
    width * 0.5,
    height * 0.45,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, '#030e18aa');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
function zoneLabel(
  ctx: CanvasRenderingContext2D,
  p: Vec & { radius: number },
  label: string,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, p.x, p.y - p.radius - 22);
  ctx.globalAlpha = 1;
}
