import { drawTidalActor } from './tidal/species-render';
import { worldBodyPose } from './body-geometry';
import type { World } from './simulation';
import { getView } from './camera';
import { drawBody } from './ocean-render';
import { cachedGlow } from './atmosphere';
import {
  SHORE_MAP,
  SHORE_POOLS,
  SHORE_ROCKS,
  SHORE_SPECIMENS,
  wetAt,
  poolRadius,
  shoreTarget,
  nearestPool,
  SHORE_SHELL_BEDS,
  shoreTide,
  shellBedReady,
  shoreFieldHint,
} from './shore';
import { freshBody } from './body-design';
import { drawTerrain, poolBank } from './life-art';
type C = CanvasRenderingContext2D;
const tracks = new WeakMap<
  World,
  {
    time: number;
    last: number;
    points: { x: number; y: number; angle: number; life: number }[];
  }
>();
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
function label(c: C, x: number, y: number, text: string, color = '#e7ecd2') {
  c.font = '13px sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 4;
  c.strokeStyle = '#17362bd9';
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}
export function renderShore(
  c: C,
  w: World,
  width: number,
  height: number,
  dpr = 1,
) {
  const s = w.shore!,
    p = w.player,
    t = w.time,
    v = getView(w, width, height);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, height);
  c.fillStyle = '#376d88';
  c.fillRect(0, 0, width, height);
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(v.zoom, v.zoom);
  c.translate(-v.cx, -v.cy);
  drawTerrain(c, 'shore', SHORE_MAP.width, SHORE_MAP.height);
  const visible = (q: { x: number; y: number }, r = 100) =>
    Math.abs(q.x - v.cx) < width / v.zoom / 2 + r &&
    Math.abs(q.y - v.cy) < height / v.zoom / 2 + r;
  const sea = c.createLinearGradient(0, 0, 310, 0);
  sea.addColorStop(0, '#376d88');
  sea.addColorStop(0.8, '#6ab8b7');
  sea.addColorStop(1, '#b8e0c9');
  c.fillStyle = sea;
  c.fillRect(-SHORE_MAP.width, 0, SHORE_MAP.width + 290, SHORE_MAP.height);
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    for (let y = 0; y <= SHORE_MAP.height; y += 15) {
      const x = 286 - i * 28 + Math.sin(y / 70 - t * 1.7 + i) * 5;
      if (y === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.strokeStyle = `rgba(215,246,221,${0.6 - i * 0.15})`;
    c.lineWidth = 2;
    c.stroke();
  }
  // Fine ground details are cached in the background; pools animate only their water surface.
  for (const pool of SHORE_POOLS) {
    if (!visible(pool, 250)) continue;
    const r = poolRadius(w, pool);
    poolBank(c, pool.x, pool.y, r, pool.x * 0.01);
    const water = c.createRadialGradient(
      pool.x - r * 0.2,
      pool.y - r * 0.22,
      10,
      pool.x,
      pool.y,
      r,
    );
    water.addColorStop(0, '#4f9eb2');
    water.addColorStop(0.65, '#64b9bf');
    water.addColorStop(0.92, '#86d0ce');
    water.addColorStop(1, '#b7e4d4');
    circle(c, pool.x, pool.y, r, water);
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(
        pool.x,
        pool.y,
        r * (0.3 + i * 0.17) + Math.sin(t * 1.2 + i) * 3,
        -1.8 + i * 0.7,
        0.4 + i * 0.7,
      );
      c.strokeStyle = '#c4f7e030';
      c.stroke();
    }
    label(
      c,
      pool.x,
      pool.y - r - 30,
      pool.name,
      pool === SHORE_POOLS[4] ? '#f5e0a7' : '#d2fff0',
    );
    if (pool === SHORE_POOLS[4]) {
      circle(c, pool.x, pool.y, 55, '#b3e2aa0c', '#d2eebc66');
      label(
        c,
        pool.x,
        pool.y + 5,
        s.tier === 2 ? '◇ 定居之地' : '◇ 更远的可能',
        '#f5e0a7',
      );
    }
  }
  const tide = shoreTide(w);
  for (const bed of SHORE_SHELL_BEDS) {
    if (!visible(bed, 130)) continue;
    const ready = shellBedReady(w, bed.id);
    circle(
      c,
      bed.x,
      bed.y,
      48,
      ready ? '#e9cc6640' : '#9cafb822',
      ready ? '#ffe4a6' : '#cadbd677',
    );
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4,
        r = i * 6;
      const x = bed.x + Math.cos(a) * r,
        y = bed.y + Math.sin(a) * r;
      c.beginPath();
      c.arc(x, y, 9, Math.PI, 2 * Math.PI);
      c.lineTo(x, y + 4);
      c.closePath();
      c.fillStyle = ready ? '#f4d38b' : '#8da9a5';
      c.fill();
      c.strokeStyle = '#4e6c5b';
      c.lineWidth = 1;
      c.stroke();
    }
    label(
      c,
      bed.x,
      bed.y - 65,
      `${bed.name} · ${ready ? 'K 采食 +4' : tide.exposed ? '等待下一次退潮' : '水下 · 退潮露出'}`,
      ready ? '#ffe5a2' : '#c7dfd9',
    );
  }
  for (const rock of SHORE_ROCKS) {
    if (!visible(rock, rock.radius + 30)) continue;
    circle(c, rock.x + 8, rock.y + 12, rock.radius, '#23332270');
    const stone = c.createLinearGradient(
      rock.x,
      rock.y - rock.radius,
      rock.x,
      rock.y + rock.radius,
    );
    stone.addColorStop(0, '#a3a183');
    stone.addColorStop(1, '#505c48');
    circle(c, rock.x, rock.y, rock.radius, stone, '#c0b79b');
    c.beginPath();
    c.moveTo(rock.x - rock.radius * 0.5, rock.y + rock.radius * 0.25);
    c.lineTo(rock.x, rock.y - rock.radius * 0.55);
    c.lineTo(rock.x + rock.radius * 0.55, rock.y - rock.radius * 0.1);
    c.strokeStyle = '#ced0ab88';
    c.lineWidth = 2;
    c.stroke();
  }
  for (const camp of s.shelters ?? []) {
    if (!visible(camp, 100)) continue;
    circle(c, camp.x, camp.y, 85, '#485f3633', '#bacc8577');
    c.beginPath();
    c.moveTo(camp.x - 48, camp.y + 12);
    c.quadraticCurveTo(camp.x - 12, camp.y - 65, camp.x + 48, camp.y + 12);
    c.lineTo(camp.x - 48, camp.y + 12);
    c.fillStyle = '#9cb378';
    c.fill();
    c.strokeStyle = '#425646';
    c.stroke();
    label(c, camp.x, camp.y + 45, '贝叶庇护', '#d6e9b4');
  }
  let trail = tracks.get(w);
  if (!trail) {
    trail = { time: t, last: t, points: [] };
    tracks.set(w, trail);
  }
  const dt = Math.max(0, Math.min(0.1, t - trail.time));
  trail.time = t;
  if (dt > 0) {
    trail.points = trail.points.filter((mark) => (mark.life -= dt) > 0);
    if (!wetAt(w, p) && Math.hypot(p.vx, p.vy) > 35 && t - trail.last > 0.14) {
      trail.points.push({ x: p.x, y: p.y, angle: p.angle, life: 3 });
      trail.last = t;
      if (trail.points.length > 30) trail.points.shift();
    }
  }
  for (const mark of trail.points) {
    c.save();
    c.translate(mark.x, mark.y);
    c.rotate(mark.angle);
    c.globalAlpha = mark.life * 0.11;
    circle(c, 0, -18, 4, '#17382c');
    circle(c, -9, 18, 4, '#17382c');
    c.restore();
  }
  for (const food of w.foods)
    if (food.cooldown === 0 && visible(food, 15)) {
      circle(c, food.x + 2, food.y + 3, 7, '#273c2755');
      circle(
        c,
        food.x,
        food.y,
        food.rich ? 6 : 4,
        food.rich ? '#edcd86' : '#c4e38c',
        '#f6efb5',
      );
      if (food.rich) {
        c.beginPath();
        c.moveTo(food.x - 4, food.y);
        c.lineTo(food.x + 4, food.y);
        c.strokeStyle = '#997a46';
        c.stroke();
      }
    }
  if (w.tidalLegacy) {
    c.fillStyle = '#d5e0b0';
    c.font = '14px sans-serif';
    c.textAlign = 'center';
    c.fillText(
      '河口育生点 · 这一支生命留下的家',
      SHORE_POOLS[0].x,
      SHORE_POOLS[0].y - 225,
    );
  }
  for (const resident of s.tidalResidents ?? [])
    drawTidalActor(
      c,
      {
        ...resident,
        id: resident.originId,
        species: 'ribbonfish',
        homeBiome: 'estuary',
        radius: 21,
        health: 100,
        hunger: 0,
        behavior: 'home',
        targetId: null,
        phaseSeconds: 0,
        respawnSeconds: 0,
        carryingId: null,
        trust: 20,
      },
      w.time,
    );
  for (const creature of s.creatures) {
    if (!visible(creature, 260)) continue;
    const guard = creature.role === 'guardian',
      ally = creature.role === 'ally';
    if (guard) {
      c.setLineDash([6, 10]);
      circle(
        c,
        creature.home.x,
        creature.home.y,
        230,
        creature.alert ? '#c1693318' : 'transparent',
        creature.alert ? '#efad6faa' : '#efcf8e66',
      );
      c.setLineDash([]);
    }
    c.globalAlpha = creature.stun > 0 ? 0.5 : 1;
    drawBody(
      c,
      guard ? 'crawler' : 'skipper',
      creature.x,
      creature.y,
      guard ? 30 : 24,
      creature.angle,
      t,
      [],
      false,
      guard ? '#dcb086' : ally ? '#a3e0d5' : '#ddd094',
    );
    c.globalAlpha = 1;
    label(
      c,
      creature.x,
      creature.y - 48,
      creature.joined
        ? '♥ 旅伴'
        : ally
          ? '♡ 同类 · K 分享食物'
          : guard
            ? '▲ 护巢者'
            : '◇ 觅食竞争者',
      guard ? '#ffd698' : '#d8f7e8',
    );
  }
  for (const specimen of SHORE_SPECIMENS) {
    if (!visible(specimen, 160)) continue;
    const found = s.discovered.includes(specimen.id),
      progress = s.observation[specimen.id] ?? 0;
    cachedGlow(c, specimen.x, specimen.y, 75, '#ffe1a245');
    drawBody(
      c,
      specimen.form,
      specimen.x,
      specimen.y,
      28,
      -0.3,
      t,
      [],
      false,
      '#f2d995',
      freshBody(),
    );
    c.beginPath();
    c.arc(
      specimen.x,
      specimen.y,
      54,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (found ? 1 : Math.max(0.025, progress / 2)),
    );
    c.lineWidth = 3;
    c.strokeStyle = '#f2df9f';
    c.stroke();
    label(
      c,
      specimen.x,
      specimen.y - 70,
      `${specimen.name} · ${found ? (progress >= 2 ? '已观察' : '已从实践发现结构') : '靠近观察 2 秒'}`,
      '#ffe7a8',
    );
  }
  const radius = worldBodyPose(w).size,
    wet = wetAt(w, p);
  c.save();
  c.translate(p.x + 4, p.y + 10);
  c.scale(1, 0.45);
  circle(c, 0, 0, radius * 1.3, '#172f3160');
  c.restore();
  if (s.skillActive > 0) cachedGlow(c, p.x, p.y, radius * 3, '#dafbd359');
  const gait = wet ? t * 0.7 : t * (Math.hypot(p.vx, p.vy) > 10 ? 1 : 0);
  if (s.morph) {
    const mix = Math.min(1, s.morph.elapsed / s.morph.duration);
    c.globalAlpha = 1 - mix;
    drawBody(
      c,
      s.morph.from,
      p.x,
      p.y,
      radius,
      p.angle,
      t,
      w.traits,
      false,
      undefined,
      s.body,
    );
    c.globalAlpha = mix;
  }
  drawBody(
    c,
    w.form,
    p.x,
    p.y,
    radius,
    p.angle,
    gait,
    w.traits,
    false,
    undefined,
    s.body,
    undefined,
    1,
    s.protection ?? undefined,
  );
  c.globalAlpha = 1;
  if (p.invulnerable > 0) {
    c.setLineDash([4, 5]);
    circle(c, p.x, p.y, radius + 18, 'transparent', '#f7efbc88');
    c.setLineDash([]);
  }
  if (s.moisture < 25 && !wet)
    label(c, p.x, p.y - radius - 24, '失水中 · 返回潮池', '#ffd49f');
  else if (shoreFieldHint(w) && (s.fieldNotes?.drySeconds ?? 0) >= 8)
    label(c, p.x, p.y - radius - 24, '保湿线索 · 回潮池完成观察', '#bcf9e2');
  else if (w.age < 9)
    label(
      c,
      p.x,
      p.y + radius + 30,
      wet
        ? '水中 · 正在补水'
        : s.tier === 0
          ? '身体仍习惯水中'
          : '附肢正在撑地',
    );
  const target = shoreTarget(w),
    a = Math.atan2(target.point.y - p.y, target.point.x - p.x);
  c.save();
  c.translate(
    p.x + Math.cos(a) * (radius + 64),
    p.y + Math.sin(a) * (radius + 64),
  );
  c.rotate(a);
  c.beginPath();
  c.moveTo(11, 0);
  c.lineTo(-8, -6);
  c.lineTo(-4, 0);
  c.lineTo(-8, 6);
  c.closePath();
  c.fillStyle = '#ffebac';
  c.fill();
  c.restore();
  if (!wet) {
    const water = nearestPool(w),
      a = Math.atan2(water.y - p.y, water.x - p.x);
    c.save();
    c.translate(
      p.x + Math.cos(a) * (radius + 38),
      p.y + Math.sin(a) * (radius + 38),
    );
    circle(c, 0, 0, 5, '#9aeee8', '#e7ffff');
    c.restore();
  }
  c.restore();
  if (s.moisture < 25 && !wet) {
    c.fillStyle = `rgba(183,102,45,${(25 - s.moisture) / 200})`;
    c.fillRect(0, 0, width, height);
  }
}
