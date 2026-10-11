import { isLandPredator, landSpecies } from './land-catalog.ts';
import { drawLandFeatures } from './land-features.ts';
import {
  LAND_COVER,
  inLandCover,
  creatureHealth,
  creatureRadius,
  huntingStats,
} from './land-hunt';
import type { World, Vec } from './simulation';
import { distance } from './simulation';
import { getView } from './camera';
import { drawBody } from './ocean-render';
import {
  LAND_MAP,
  LAND_AREAS,
  LAND_NESTS,
  LAND_PONDS,
  LAND_ROCKS,
  SPECIES_NAMES,
  landRadius,
  landTarget,
  LAND_SEED,
  seedPlot,
} from './land';
import { FORMS } from './forms';
import { drawTerrain, poolBank } from './life-art';
import { droughtDry, landPoolRadius } from './land-drought';
type C = CanvasRenderingContext2D;
function circle(
  c: C,
  x: number,
  y: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function label(c: C, x: number, y: number, text: string, color = '#e6ecc8') {
  c.font = '13px sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 4;
  c.strokeStyle = '#203123ee';
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}
export function renderLand(
  c: C,
  w: World,
  width: number,
  height: number,
  dpr = 1,
) {
  const s = w.land!,
    p = w.player,
    t = w.time,
    v = getView(w, width, height);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, height);
  c.fillStyle = '#24362b';
  c.fillRect(0, 0, width, height);
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(v.zoom, v.zoom);
  c.translate(-v.cx + (s.impact > 0 ? Math.sin(t * 81) * 3 : 0), -v.cy);
  const visible = (q: Vec, r = 100) =>
    Math.abs(q.x - v.cx) < width / v.zoom / 2 + r &&
    Math.abs(q.y - v.cy) < height / v.zoom / 2 + r;
  drawTerrain(c, 'land', LAND_MAP.width, LAND_MAP.height);
  if (droughtDry(w)) {
    c.fillStyle = '#c49a5630';
    c.fillRect(0, 0, LAND_MAP.width, LAND_MAP.height);
  }
  for (const area of LAND_AREAS) {
    if (!visible(area, area.radius)) continue;
    const g = c.createRadialGradient(
      area.x,
      area.y,
      0,
      area.x,
      area.y,
      area.radius,
    );
    g.addColorStop(0, area.species === 'grazer' ? '#ecbe5a36' : '#a8dba626');
    g.addColorStop(1, '#d4de9b00');
    circle(c, area.x, area.y, area.radius, g);
    label(
      c,
      area.x,
      area.y - area.radius + 40,
      area.name,
      area.species === 'grazer' ? '#ffe5aa' : '#ceebaf',
    );
  }
  for (const [index, pool] of LAND_PONDS.entries()) {
    if (!visible(pool, 130)) continue;
    poolBank(c, pool.x, pool.y, pool.radius, pool.x * 0.01);
    const waterRadius = landPoolRadius(w, index);
    if (waterRadius < pool.radius)
      circle(c, pool.x, pool.y, pool.radius, '#af9f70');
    const g = c.createRadialGradient(
      pool.x - 20,
      pool.y - 20,
      3,
      pool.x,
      pool.y,
      waterRadius,
    );
    g.addColorStop(0, '#2b7180');
    g.addColorStop(0.86, '#529996');
    g.addColorStop(1, '#a2ba82');
    circle(c, pool.x, pool.y, waterRadius, g, '#c2d8a5');
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(
        pool.x,
        pool.y,
        (0.35 + i * 0.2) * waterRadius + Math.sin(t + i) * 3,
        (0.24 + i * 0.15) * waterRadius,
        0,
        -1,
        0.9,
      );
      c.strokeStyle = '#e4fff044';
      c.lineWidth = 1;
      c.stroke();
    }
    if (s.drought && droughtDry(w))
      label(
        c,
        pool.x,
        pool.y - pool.radius - 15,
        index === 2 ? '常流泉眼 · 补水' : '浅水退缩 · 靠近水面',
        '#f4dba5',
      );
    if (
      s.drought?.strategy === 'migration' &&
      s.drought.stops >= (index === 1 ? 1 : 2) &&
      index > 0
    ) {
      for (let i = 0; i < 3; i++) {
        circle(
          c,
          pool.x + pool.radius + 25 + i * 15,
          pool.y + (i % 2) * 12,
          4,
          '#f4d994',
        );
      }
    }
  }
  const drought = s.drought;
  if (drought?.built && drought.nest != null) {
    const home = LAND_NESTS[drought.nest];
    if (visible(home, 170)) {
      c.save();
      c.translate(home.x, home.y);
      circle(c, 0, 0, 115, '#243b3938');
      c.beginPath();
      c.moveTo(-90, 45);
      c.quadraticCurveTo(-115, -70, 0, -90);
      c.quadraticCurveTo(115, -70, 90, 45);
      c.lineTo(55, 45);
      c.quadraticCurveTo(60, -28, 0, -35);
      c.quadraticCurveTo(-60, -28, -55, 45);
      c.closePath();
      c.fillStyle = '#75996b';
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = '#d3d5a0';
      c.stroke();
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * 25, -70 + Math.abs(i) * 12);
        c.lineTo(i * 35, 20);
        c.strokeStyle = '#456f55';
        c.lineWidth = 3;
        c.stroke();
      }
      c.restore();
      label(
        c,
        home.x,
        home.y + 155,
        `保湿窝 · ${drought.collected}/3补给`,
        '#f2dc9d',
      );
    }
  }
  if (drought?.watered) {
    const garden = seedPlot(w);
    if (garden && visible(garden, 180)) {
      circle(c, garden.x, garden.y, 100, '#96be6330', '#d8d79e');
      label(
        c,
        garden.x,
        garden.y + 125,
        `保水果丛 · 采收${drought.harvests.length}/2`,
        '#d8e8a3',
      );
    }
  }
  const seed = s.seedPod,
    plot = seedPlot(w);
  if (
    visible(LAND_SEED, 120) &&
    (!seed || ['unseen', 'seen'].includes(seed.stage))
  ) {
    circle(
      c,
      LAND_SEED.x,
      LAND_SEED.y,
      55 + Math.sin(t * 1.8) * 4,
      '#eedaa414',
      '#e5d9b244',
    );
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      circle(
        c,
        LAND_SEED.x + Math.cos(a) * 15,
        LAND_SEED.y + Math.sin(a) * 15,
        11,
        '#829e7b',
      );
    }
    circle(c, LAND_SEED.x, LAND_SEED.y, 14, '#ead697', '#fff0ba');
    label(c, LAND_SEED.x, LAND_SEED.y - 72, '✧ 月露荚 · K 拾取', '#fbe8b5');
  }
  if (plot && visible(plot, 150) && seed) {
    circle(c, plot.x, plot.y, 72, '#547b4833', '#bfd99e44');
    const height = 15 + seed.waters * 15;
    c.beginPath();
    c.moveTo(plot.x, plot.y + 12);
    c.lineTo(plot.x, plot.y - height);
    c.strokeStyle = '#a5c882';
    c.lineWidth = 5;
    c.stroke();
    for (let i = 0; i < 2 + seed.waters * 3; i++) {
      const a = i * 2.4;
      circle(
        c,
        plot.x + Math.cos(a) * (12 + seed.waters * 8),
        plot.y - height / 2 + Math.sin(a) * 22,
        9 + seed.waters * 2,
        '#688d62',
        '#bfda97',
      );
    }
    if (distance(w.player, plot) > 190)
      label(
        c,
        plot.x,
        plot.y - height - 28,
        seed.waters === 3
          ? '月露果丛 · 伙伴也能采集'
          : `月露幼苗 · 浇灌 ${seed.waters}/3`,
        '#e8e7b3',
      );
  }
  for (const patch of LAND_COVER) {
    if (!visible(patch, patch.radius)) continue;
    circle(c, patch.x, patch.y, patch.radius, '#66894226', '#a1be6d33');
    for (let j = 0; j < 38; j++) {
      const a = j * 2.399,
        r = Math.sqrt((j + 1) / 38) * patch.radius,
        x = patch.x + Math.cos(a) * r,
        y = patch.y + Math.sin(a) * r;
      c.beginPath();
      c.moveTo(x - 7, y + 10);
      c.quadraticCurveTo(x - 14, y - 13, x - 5 + Math.sin(t + j) * 2, y - 23);
      c.moveTo(x, y + 10);
      c.quadraticCurveTo(x + 14, y - 9, x + 8 + Math.sin(t + j) * 2, y - 18);
      c.strokeStyle = '#a2bd7580';
      c.lineWidth = 2;
      c.stroke();
    }
    if (w.form === 'stalker')
      label(
        c,
        patch.x,
        patch.y - patch.radius - 12,
        '蕨丛 · 伏低时更难被察觉',
        '#d0e1a6',
      );
  }
  for (const rock of LAND_ROCKS) {
    if (!visible(rock)) continue;
    circle(c, rock.x + 8, rock.y + 10, rock.radius, '#20302777');
    circle(c, rock.x, rock.y, rock.radius, '#79846a', '#b4b89b');
    circle(c, rock.x - 15, rock.y - 20, rock.radius * 0.5, '#b9b79733');
  }
  for (let i = 0; i < LAND_NESTS.length; i++) {
    const n = LAND_NESTS[i];
    if (!visible(n, n.radius + 40)) continue;
    const built = s.nests.includes(i);
    c.lineWidth = 1;
    c.setLineDash(built ? [] : [7, 9]);
    circle(
      c,
      n.x,
      n.y,
      n.radius,
      built ? '#a9dcab12' : '#f5d69908',
      built ? '#b4e8b466' : '#edda9955',
    );
    c.setLineDash([]);
    circle(c, n.x + 3, n.y + 8, 66, '#20302466');
    for (let j = 0; j < 24; j++) {
      const a = j * 2.399;
      c.beginPath();
      c.ellipse(
        n.x + Math.cos(a) * 9,
        n.y + Math.sin(a) * 8,
        55 + (j % 3) * 4,
        43 + (j % 4) * 3,
        a,
        0,
        Math.PI * 1.6,
      );
      c.strokeStyle = j % 2 ? '#bdac79' : '#78684b';
      c.lineWidth = 3;
      c.stroke();
    }
    circle(c, n.x, n.y, 37, '#303e2a');
    if (built)
      for (let j = 0; j < 3; j++)
        drawBody(
          c,
          w.form,
          n.x + (j - 1) * 23,
          n.y + Math.sin(j + t) * 6,
          9,
          -0.6 + j * 0.6,
          t,
          [],
          false,
          '#e1deb0',
        );
    else {
      c.font = '26px sans-serif';
      c.fillStyle = '#e9d5a1';
      c.textAlign = 'center';
      c.fillText('◇', n.x, n.y + 8);
    }
    if (distance(w.player, n) > 120)
      label(c, n.x, n.y - 85, n.name, built ? '#d5efb6' : '#f3d997');
    label(
      c,
      n.x,
      n.y + 96,
      built
        ? '已建巢 · 停下来恢复'
        : 'K 筑巢 · ' + (i === 2 ? '12' : '6') + ' 食物',
    );
  }
  for (const f of w.foods)
    if (f.cooldown <= 0 && visible(f, 15)) {
      c.save();
      c.translate(f.x, f.y + Math.sin(t * 2 + f.id) * 1.7);
      circle(c, 0, 3, 9, '#263e2a55');
      circle(
        c,
        0,
        0,
        f.rich ? 6 : 4,
        f.rich ? '#edc978' : '#c3dc8a',
        '#e9ecc1',
      );
      c.beginPath();
      c.ellipse(4, -5, 5, 2, -0.6, 0, Math.PI * 2);
      c.fillStyle = '#99bb70';
      c.fill();
      c.restore();
    }
  for (const m of s.meat) {
    if (m.life <= 0 || !visible(m, 50)) continue;
    circle(c, m.x, m.y, 23, '#e6bc5428', '#f4db9a');
    for (let j = 0; j < 3; j++)
      circle(
        c,
        m.x + (j - 1) * 9,
        m.y + Math.sin(j) * 4,
        7,
        '#ecc38e',
        '#ffebbe',
      );
    if (m.eating > 0) {
      c.beginPath();
      c.arc(
        m.x,
        m.y,
        29,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * m.eating) / 0.8,
      );
      c.lineWidth = 3;
      c.strokeStyle = '#f8e6a1';
      c.stroke();
    }
    label(c, m.x, m.y - 32, `食物 +${m.value} · 停下进食`, '#ffe0a0');
  }
  for (const camp of s.camps ?? []) {
    circle(c, camp.x, camp.y, 90, '#1c342722', '#9fc69d66');
    label(c, camp.x, camp.y - 93, '穴巢 · 保湿阴影', '#cae4a8');
  }
  for (const a of s.creatures) {
    if (a.respawn > 0 || !visible(a, 100)) continue;
    const danger = isLandPredator(a.species) && !a.joined && !a.friendship,
      size = creatureRadius(a),
      col = a.joined
        ? '#a5e8c6'
        : danger
          ? '#d2a076'
          : a.species === 'fern'
            ? '#bfd797'
            : landSpecies(a.species).color;
    circle(c, a.x + 2, a.y + 7, size, '#1c31284d');
    if (danger) {
      c.setLineDash([5, 10]);
      circle(c, a.home.x, a.home.y, a.species === 'hunter' ? 290 : 145, '#d98d4c05', '#eeb07b66');
      c.setLineDash([]);
    }
    drawBody(
      c,
      a.shoreOrigin != null
        ? 'skipper'
        : danger
          ? 'stalker'
          : landSpecies(a.species).form,
      a.x,
      a.y - (a.reaction > 0 ? Math.abs(Math.sin(a.reaction * 7)) * 9 : 0),
      size,
      a.angle,
      t,
      [],
      false,
      a.flash > 0 ? '#ffedb9' : col,
    );
    if (!['fern', 'grazer', 'hunter'].includes(a.species))
      drawLandFeatures(c, a, size, [landSpecies(a.species).feature], t);
    if (a.joined) {
      circle(c, a.x, a.y, 46, '#b4edcb08', '#b4edcb66');
      label(
        c,
        a.x,
        a.y - size - 37,
        a.task === 'forage'
          ? '✦ 寻果中'
          : a.task === 'return'
            ? a.carrying
              ? '♥ 给你带回果实！'
              : '♥ 回来了'
            : a.shoreOrigin != null
              ? '♥ 潮池旅伴'
              : '♥ 同行伙伴',
        '#b8f4d6',
      );
      if (a.carrying) {
        circle(
          c,
          a.x + Math.cos(a.angle) * 35,
          a.y + Math.sin(a.angle) * 35,
          8,
          '#f2c376',
          '#fff0b7',
        );
      }
      if (a.reaction > 0)
        circle(
          c,
          a.x,
          a.y,
          48 + (2 - a.reaction) * 14,
          '#b4edcb08',
          '#b4edcb55',
        );
    } else {
      label(
        c,
        a.x,
        a.y - size - 37,
        (danger ? '▲ ' : '◇ ') + SPECIES_NAMES[a.species],
        danger ? '#f9ca9e' : '#e3e8b9',
      );
      if (!danger && w.form === 'stalker') {
        c.fillStyle = '#203328';
        c.fillRect(a.x - 28, a.y + size + 22, 56, 5);
        c.fillStyle = a.suspicion > 0.6 ? '#f0a069' : '#dfcf86';
        c.fillRect(a.x - 28, a.y + size + 22, 56 * a.suspicion, 5);
        label(
          c,
          a.x,
          a.y + size + 46,
          a.alert
            ? a.escape <= 0
              ? '逃跑后疲惫'
              : '受惊逃跑'
            : a.suspicion > 0.2
              ? '正在察觉你'
              : a.species === 'grazer'
                ? '中型猎物 · 更结实'
                : '小型猎物 · 可伏击',
          '#efdeb0',
        );
      }
      if (!danger && w.form !== 'stalker')
        label(
          c,
          a.x,
          a.y + size + 33,
          '♥'.repeat(a.friendship) + '♡'.repeat(3 - a.friendship),
          '#c7ecd0',
        );
    }
    if (a.health < creatureHealth(a) && !a.joined) {
      c.fillStyle = '#253529';
      c.fillRect(a.x - 24, a.y - size - 25, 48, 4);
      c.fillStyle = '#e6c185';
      c.fillRect(
        a.x - 24,
        a.y - size - 25,
        (48 * a.health) / creatureHealth(a),
        4,
      );
    }
    if (!danger && a.shoreOrigin == null && !s.discovered.includes(a.species)) {
      c.beginPath();
      c.arc(
        a.x,
        a.y,
        size + 20,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * (s.observation[a.species] ?? 0)) / 2,
      );
      c.lineWidth = 2;
      c.strokeStyle = '#f5dfa0';
      c.stroke();
      if (distance(a, p) < 210)
        label(c, a.x, a.y + size + 54, '靠近观察 · 2 秒', '#f5dfa0');
    }
  }
  const size = landRadius(w),
    gait = t * (Math.hypot(p.vx, p.vy) > 10 ? 1 : 0.08);
  if (w.form === 'stalker') {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    if (s.pounce) {
      c.beginPath();
      c.moveTo(-15, 0);
      c.lineTo(-115, 0);
      c.strokeStyle = '#f3d99b80';
      c.lineWidth = 13;
      c.lineCap = 'round';
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(48, -18);
      c.lineTo(215, 0);
      c.lineTo(48, 18);
      c.strokeStyle = s.sneaking ? '#d8eab877' : '#f3d99b55';
      c.lineWidth = 1;
      c.setLineDash([5, 8]);
      c.stroke();
    }
    c.restore();
  }
  circle(c, p.x + 5, p.y + 12, size, '#17261e70');
  c.globalAlpha = s.sneaking
    ? 0.65
    : p.invulnerable > 0
      ? 0.75 + Math.sin(t * 30) * 0.2
      : 1;
  const birth = s.morph;
  if (birth) {
    const f = Math.min(1, birth.elapsed / birth.duration),
      grow = Math.max(0, Math.min(1, (f - 0.22) / 0.5));
    c.globalAlpha = Math.max(0, 1 - f / 0.3);
    drawBody(
      c,
      birth.from,
      p.x,
      p.y,
      size,
      p.angle,
      gait,
      w.traits,
      false,
      undefined,
      birth.fromBody ?? s.body,
      undefined,
      1,
      s.protection ?? undefined,
    );
    c.globalAlpha = 1;
    const cocoon = Math.sin(Math.PI * f);
    circle(c, p.x, p.y, size * (1.4 + cocoon * 0.55), '#d4edb51c', '#e6f4c780');
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16 + t * 0.6,
        r = size * (0.9 + cocoon * 0.9) + (f > 0.7 ? (f - 0.7) * 220 : 0);
      c.globalAlpha = cocoon;
      circle(
        c,
        p.x + Math.cos(a) * r,
        p.y + Math.sin(a) * r,
        2 + (i % 4),
        '#efffbf',
      );
    }
    c.globalAlpha = Math.min(1, grow * 2);
    drawBody(
      c,
      w.form,
      p.x,
      p.y,
      size * (0.55 + 0.45 * grow),
      p.angle,
      gait,
      w.traits,
      false,
      undefined,
      s.body,
      s.organ ?? undefined,
      grow,
      s.protection ?? undefined,
    );
  } else {
    drawBody(
      c,
      w.form,
      p.x,
      p.y,
      size,
      p.angle,
      gait,
      w.traits,
      false,
      undefined,
      s.body,
      s.organ ?? undefined,
      1,
      s.protection ?? undefined,
    );
  }
  c.globalAlpha = 1;
  drawLandFeatures(c, p, size, s.features ?? [], t);
  if (s.activeFeature === 'scent' && (s.featureActive ?? 0) > 0)
    for (const m of s.meat) {
      c.setLineDash([4, 8]);
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(m.x, m.y);
      c.strokeStyle = '#ebd89188';
      c.stroke();
      c.setLineDash([]);
    }
  if (s.skillActive > 0) {
    const call = w.form === 'strider';
    c.lineWidth = 3;
    circle(
      c,
      p.x,
      p.y,
      call ? 70 + (1 - s.skillActive) * 180 : size + 23,
      '#e6edb908',
      call ? '#e9eab28c' : '#f3d39aa0',
    );
  }
  label(
    c,
    p.x,
    p.y - size - 55,
    '你 · ' +
      (w.form === 'stalker'
        ? s.sneaking
          ? inLandCover(p)
            ? '蕨丛隐蔽'
            : '伏低潜行'
          : huntingStats(w).name
        : FORMS[w.form].short),
    '#f4f1ce',
  );
  for (const b of w.particles)
    if (visible(b, 10)) {
      c.globalAlpha = Math.min(1, b.life * 2);
      circle(c, b.x, b.y, 3, b.color);
    }
  c.globalAlpha = 1;
  // Drifting spores and light flecks add depth without obscuring collisions or food.
  for (let i = 0; i < 22; i++) {
    const x = (i * 433 + t * 8) % LAND_MAP.width,
      y = (i * 233 + Math.sin(t * 0.3 + i) * 30) % LAND_MAP.height;
    if (visible({ x, y }, 20)) {
      c.globalAlpha = 0.3;
      circle(c, x, y, 2, '#f3efb1');
    }
  }
  c.globalAlpha = 1;
  const target = landTarget(w),
    d = distance(target.point, p);
  if (visible(target.point, 50) && target.action !== 'wait') {
    c.lineWidth = 2;
    c.setLineDash([4, 5]);
    circle(
      c,
      target.point.x,
      target.point.y,
      target.action === 'forage' ? 18 : 65,
      '#f5dda008',
      '#f5dda0b0',
    );
    c.setLineDash([]);
  }
  if (d > 170) {
    const a = Math.atan2(target.point.y - p.y, target.point.x - p.x),
      x = p.x + Math.cos(a) * 115,
      y = p.y + Math.sin(a) * 115;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(12, 0);
    c.lineTo(-6, -7);
    c.lineTo(-3, 0);
    c.lineTo(-6, 7);
    c.closePath();
    c.fillStyle = '#f5dda0';
    c.fill();
    c.restore();
  }
  c.restore();
  const vignette = c.createRadialGradient(
    width * 0.48,
    height * 0.5,
    height * 0.2,
    width * 0.48,
    height * 0.5,
    width * 0.72,
  );
  vignette.addColorStop(0, '#102a1c00');
  vignette.addColorStop(1, '#0d271d99');
  c.fillStyle = vignette;
  c.fillRect(0, 0, width, height);
}
