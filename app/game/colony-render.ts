import { drawLandFeatures } from './land-features';
import { drawPlayerFocus } from './readability';
import { drawTerrain } from './life-art';
import type { ColonyState } from './colony';
import {
  COLONY_MAP,
  COLONY_NEST,
  ROLE_NAMES,
  colonyGuards,
  colonyInteraction,
} from './colony';
import type { ColonyCue } from './colony-feedback';
import { drawBody } from './ocean-render';
import { distance } from './simulation';
export function colonyView(width: number, height: number) {
  const scale = Math.min(width / COLONY_MAP.width, height / COLONY_MAP.height);
  return {
    scale,
    x: (width - COLONY_MAP.width * scale) / 2,
    y: (height - COLONY_MAP.height * scale) / 2,
  };
}
export function renderColony(
  c: CanvasRenderingContext2D,
  s: ColonyState,
  width: number,
  height: number,
  dpr: number,
  destination: { x: number; y: number } | null = null,
  cues: ColonyCue[] = [],
  reduced = false,
) {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#132e2a';
  c.fillRect(0, 0, width, height);
  const v = colonyView(width, height),
    t = reduced ? 0 : s.time;
  c.translate(v.x, v.y);
  c.scale(v.scale, v.scale);
  c.lineCap = 'round';
  const oval = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string | CanvasGradient,
    angle = 0,
  ) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color: string,
    w = 2,
  ) => {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = w;
    c.stroke();
  };
  const label = (
    x: number,
    y: number,
    text: string,
    color = '#f2ebc9',
    size = 14,
  ) => {
    c.font = `${size}px sans-serif`;
    c.textAlign = 'center';
    c.lineWidth = 4;
    c.strokeStyle = '#17382ade';
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  };
  const leaf = (
    x: number,
    y: number,
    size: number,
    angle: number,
    color: string,
  ) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(-size, 0);
    c.bezierCurveTo(-size / 2, -size * 0.7, size * 0.65, -size * 0.5, size, 0);
    c.bezierCurveTo(size * 0.3, size * 0.5, -size * 0.5, size * 0.5, -size, 0);
    c.fillStyle = color;
    c.fill();
    line(-size * 0.7, 0, size * 0.8, 0, '#dce6a428', 1);
    c.restore();
  };
  const fruit = (x: number, y: number, r = 6) => {
    oval(x + 2, y + 3, r, r, '#193e354f');
    oval(x, y, r, r, '#e7c67f');
    oval(x - 2, y - 2, r * 0.32, r * 0.32, '#fff2b6');
  };
  const twig = (x: number, y: number, angle: number, size = 22) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    line(-size, 2, size, 2, '#132c3055', 7);
    line(-size, 0, size, 0, '#b59260', 5);
    line(-size, -1, size, -1, '#e0c195', 1.4);
    line(1, 0, 8, -9, '#bc9b71', 3);
    c.restore();
  };
  const storm = s.storm !== null && s.mode !== 'won',
    focus = colonyInteraction(s),
    guards = colonyGuards(s);
  const ground = c.createRadialGradient(490, 360, 30, 570, 410, 700);
  ground.addColorStop(0, storm ? '#788678' : '#a7a173');
  ground.addColorStop(0.55, storm ? '#405f55' : '#647e56');
  ground.addColorStop(1, '#173e35');
  c.fillStyle = ground;
  c.fillRect(0, 0, 1120, 760);
  drawTerrain(c, 'land', 1120, 760);
  if (storm) {
    c.fillStyle = '#1d42543d';
    c.fillRect(0, 0, 1120, 760);
  }
  // Worn gathering paths and bank shadows keep the clearing connected and readable.
  for (const patch of s.patches) {
    c.beginPath();
    c.moveTo(570, 430);
    c.quadraticCurveTo(
      (patch.x + 570) / 2 + 18,
      (patch.y + 430) / 2 + 24,
      patch.x,
      patch.y,
    );
    c.strokeStyle = '#dfc98e12';
    c.lineWidth = 35;
    c.stroke();
    c.strokeStyle = '#d7c99113';
    c.lineWidth = 13;
    c.stroke();
  }
  for (let i = 0; i < 170; i++) {
    const x = (i * 137.3) % 1120,
      y = (i * 83.7) % 760;
    oval(x, y, 3 + (i % 4), 1.5, '#1d483020', i);
    if (i % 3 === 0) line(x, y, x + 3, y - 7, '#dce0aa20', 1);
  }
  c.beginPath();
  c.moveTo(980, -50);
  c.bezierCurveTo(740, 180, 1110, 500, 870, 820);
  c.strokeStyle = '#10383269';
  c.lineWidth = 103;
  c.stroke();
  c.strokeStyle = '#a4a67866';
  c.lineWidth = 83;
  c.stroke();
  c.strokeStyle = storm ? '#3a6976' : '#327f82';
  c.lineWidth = 62;
  c.stroke();
  c.strokeStyle = '#8bc9ba55';
  c.lineWidth = 4;
  c.stroke();
  for (let i = 0; i < 15; i++) {
    const y = i * 61 - 28,
      u = (y + 50) / 870,
      x =
        980 * (1 - u) ** 3 +
        3 * 740 * (1 - u) ** 2 * u +
        3 * 1110 * (1 - u) * u * u +
        870 * u ** 3;
    c.beginPath();
    c.ellipse(
      x + Math.sin(i) * 15,
      y + ((t * 12) % 32),
      8 + (i % 7),
      2,
      0,
      0,
      Math.PI,
    );
    c.strokeStyle = '#b7e7cd3a';
    c.lineWidth = 1;
    c.stroke();
  }
  // Fern edges frame the play space; no decorative trunks become hidden collision obstacles.
  for (let i = 0; i < 44; i++) {
    const side = i % 4,
      q = Math.floor(i / 4),
      x = side === 0 ? 18 : side === 1 ? 1098 : q * 112 + 25,
      y = side === 2 ? 8 : side === 3 ? 753 : q * 79 + 10;
    oval(x + 8, y + 14, 45, 24, '#12382f65');
    for (let j = 0; j < 5; j++) {
      const a = j * 1.3 + i * 0.7 + Math.sin(t * 0.5 + i) * 0.025;
      leaf(
        x + Math.cos(a) * 23,
        y + Math.sin(a) * 20,
        31,
        a,
        j % 2 ? '#426b48' : '#335c43',
      );
      leaf(x + Math.cos(a) * 37, y + Math.sin(a) * 32, 19, a, '#648456');
    }
  }
  if (!storm) {
    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(240 + i * 180, -30);
      c.lineTo(425 + i * 160, 650);
      c.lineTo(560 + i * 170, 650);
      c.lineTo(280 + i * 180, -30);
      c.fillStyle = '#f7e3a307';
      c.fill();
    }
    c.restore();
  }
  // Carry routes express current work, not an invented resource transfer.
  for (const m of s.members) {
    const target = m.carrying
      ? COLONY_NEST
      : s.patches.find((p) => p.id === m.target && p.cooldown === 0);
    if (target) {
      c.setLineDash([2, 10]);
      line(
        m.x,
        m.y,
        target.x,
        target.y,
        m.carrying ? '#ffe2a23b' : '#d8ead021',
        1.5,
      );
      c.setLineDash([]);
    }
  }
  for (const p of s.patches) {
    const inherited = p.id === 12 && s.seedLegacy === 'grown',
      near = distance(p, s.player) < 105,
      progress = 1 - p.cooldown / 14;
    oval(p.x + 5, p.y + 17, 40, 17, '#173b304f');
    if (p.kind === 'food') {
      line(p.x, p.y + 17, p.x, p.y - 21, '#8b8260', 4);
      for (let i = 0; i < 7; i++)
        leaf(
          p.x + Math.cos(i * 2.4) * 18,
          p.y + Math.sin(i * 2.4) * 14,
          23,
          i * 2.4,
          inherited
            ? i % 2
              ? '#91bda1'
              : '#6a9f89'
            : i % 2
              ? '#719f5b'
              : '#547f4d',
        );
      if (inherited) {
        oval(p.x, p.y, 45, 32, '#b7e7c712');
        label(p.x, p.y - 45, '✧ 月露种苗', '#c8efda', 13);
      }
      if (p.cooldown === 0)
        for (let i = 0; i < 4; i++)
          fruit(p.x - 17 + i * 11, p.y + (i % 2 ? 6 : -8));
      else
        for (let i = 0; i < 3; i++)
          oval(
            p.x - 12 + i * 12,
            p.y - 3,
            2 + Math.max(0, progress) * 3,
            2 + Math.max(0, progress) * 3,
            '#a6b578',
          );
    } else {
      for (let i = 0; i < 3; i++)
        twig(
          p.x - 14 + i * 14,
          p.y + (i % 2) * 7,
          -0.85 + i * 0.15,
          p.cooldown ? 10 : 21,
        );
    }
    if (near) {
      if (focus.target === p) {
        c.beginPath();
        c.ellipse(p.x, p.y + 12, 47, 28, 0, 0, Math.PI * 2);
        c.strokeStyle = focus.ready ? '#fff0ad' : '#c4d4b26b';
        c.lineWidth = 2;
        c.stroke();
      }
      label(
        p.x,
        p.y + 54,
        p.cooldown > 0
          ? `${Math.ceil(p.cooldown)}秒后再生`
          : p.kind === 'food'
            ? '果实 · K'
            : '树枝 · K',
        p.cooldown ? '#bdcda8' : '#fff0c5',
      );
    }
  }
  // The nest has material piles, woven strands and a roof that unfolds after the real build action.
  oval(575, 436, 126, 57, '#17383055');
  oval(570, 425, 100, 63, '#8c896252');
  oval(570, 424, 76, 44, '#263e2e');
  for (let i = 0; i < 20; i++) {
    c.beginPath();
    c.ellipse(
      570 + Math.sin(i * 3) * 3,
      426 + Math.cos(i) * 4,
      72 + (i % 4) * 2,
      38 + (i % 5),
      Math.sin(i) * 0.06,
      0,
      Math.PI * 2,
    );
    c.strokeStyle = i % 3 ? '#a39062' : '#d1bb7e';
    c.lineWidth = 1.7;
    c.stroke();
  }
  for (let i = 0; i < Math.min(s.wood, 10); i++)
    twig(482 + (i % 4) * 8, 471 - Math.floor(i / 4) * 6, -0.1, 19);
  for (let i = 0; i < Math.min(s.food, 12); i++)
    fruit(644 + (i % 4) * 9, 470 - Math.floor(i / 4) * 9, 4.5);
  const birth = cues.findLast((e) => e.kind === 'build'),
    build = reduced || !birth ? 1 : Math.min(1, (s.time - birth.at) / 2.2);
  if (s.shelter) {
    const wobble = storm ? Math.sin(t * 7) * (100 - s.integrity) * 0.025 : 0;
    for (const side of [-1, 1]) {
      line(570 + side * 76, 438, 570 + wobble, 329, '#534d35', 8);
      line(570 + side * 76, 435, 570 + wobble, 329, '#ccae75', 4);
    }
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < 7; i++) {
        if ((row * 7 + i) / 28 > build) continue;
        const x = 499 + i * 23 + row * 2 + wobble,
          y = 378 - row * 13 + Math.abs(i - 3) * 4;
        leaf(x + 3, y + 5, 24, -0.5 + row * 0.12, '#264738');
        leaf(
          x,
          y,
          24,
          -0.5 + row * 0.12,
          (i + row) % 2 ? '#85a46a' : '#638b59',
        );
      }
    if (s.integrity < 65) {
      line(546, 349, 556, 370, '#203d30', 5);
      line(556, 370, 542, 388, '#203d30', 5);
    }
    if (s.integrity < 35) {
      line(601, 359, 590, 383, '#203d30', 6);
    }
  }
  label(570, 296, s.shelter ? '溪畔育幼棚' : '溪畔新家', '#f8ebbf', 17);
  if (focus.target === COLONY_NEST && distance(s.player, COLONY_NEST) < 85) {
    c.beginPath();
    c.ellipse(570, 431, 106, 65, 0, 0, Math.PI * 2);
    c.strokeStyle = '#f4df965f';
    c.lineWidth = 2;
    c.stroke();
  }
  if (s.growth < 100) {
    const feed = cues.findLast((e) => e.kind === 'growth'),
      bounce =
        !reduced && feed
          ? Math.sin(Math.min(1, (s.time - feed.at) / 0.8) * Math.PI) * 8
          : 0;
    drawBody(
      c,
      s.form,
      580,
      430 - bounce,
      11 + s.growth * 0.15,
      Math.sin(t) * 0.3,
      t * 0.4,
      s.traits,
      false,
      undefined,
      s.body,
      s.organ,
      1,
      s.adaptation,
    );
    if (!feed || s.time - feed.at >= 3)
      label(
        570,
        520,
        s.shelter ? `幼崽 · ${s.growth}%` : '先为幼崽搭一片屋顶',
        '#e5e1b2',
      );
  }
  for (const m of s.members) {
    const guarding = guards.includes(m);
    if (guarding) {
      c.beginPath();
      c.arc(m.x, m.y, 36, m.angle - 0.8, m.angle + 1.8);
      c.strokeStyle = storm ? '#b8e6d6aa' : '#b8e6d645';
      c.lineWidth = 3;
      c.stroke();
    }
    oval(m.x + 5, m.y + 12, 26, 12, '#132f315e');
    drawBody(
      c,
      m.form,
      m.x,
      m.y,
      24,
      m.angle,
      t,
      m.newborn ? s.traits : [],
      false,
      m.newborn ? '#e4d89a' : '#c9dfad',
      m.body ?? (m.newborn ? s.body : undefined),
      m.newborn ? s.organ : undefined,
      1,
      m.newborn ? s.adaptation : undefined,
    );
    drawLandFeatures(
      c,
      m,
      24,
      m.features ?? (m.newborn ? (s.features ?? []) : []),
      t,
    );
    const name = m.newborn ? '新成员' : String(m.id + 1),
      role = guarding ? '护巢' : m.carrying ? '带回' : ROLE_NAMES[m.role];
    label(
      m.x,
      m.y - 48,
      `${name} · ${role}`,
      m.role === 'guard' ? '#bce8d9' : '#e2edca',
      12,
    );
    if (m.carrying) {
      const x = m.x + Math.cos(m.angle) * 32,
        y = m.y + Math.sin(m.angle) * 32;
      if (m.carrying === 'food') fruit(x, y, 6);
      else twig(x, y, m.angle + 0.4, 13);
    }
  }
  if (destination && s.mode === 'running') {
    c.beginPath();
    c.arc(destination.x, destination.y, 15, 0, Math.PI * 2);
    c.strokeStyle = '#f2edb8aa';
    c.lineWidth = 2;
    c.stroke();
    oval(destination.x, destination.y, 3, 3, '#fff3b9');
  }
  const p = s.player;
  oval(p.x + 5, p.y + 13, 32, 14, '#122f3366');
  drawBody(
    c,
    s.form,
    p.x,
    p.y,
    30,
    p.angle,
    t,
    s.traits,
    false,
    undefined,
    s.body,
    s.organ,
    1,
    s.adaptation,
  );
  drawLandFeatures(c, p, 30, s.features ?? [], t);
  drawPlayerFocus(c, p.x, p.y, 42, p.angle);
  label(p.x, p.y - 61, '你', '#fff7c9', 14);
  for (let i = 0; i < p.load; i++) {
    const x = p.x + Math.cos(p.angle) * 39 + Math.sin(p.angle) * (i - 1) * 9,
      y = p.y + Math.sin(p.angle) * 39 - Math.cos(p.angle) * (i - 1) * 9;
    if (p.carrying === 'food') fruit(x, y, 5);
    else twig(x, y, p.angle + 0.3, 14);
  }
  if (p.load)
    label(
      p.x,
      p.y + 68,
      `${p.carrying === 'food' ? '果实' : '树枝'} ${p.load}/3`,
      '#ffe2a2',
      13,
    );
  if (storm) {
    c.fillStyle = '#15324b38';
    c.fillRect(0, 0, 1120, 760);
    for (let i = 0; i < 85; i++) {
      const x = ((i * 109 + t * 95) % 1170) - 25,
        y = ((i * 61 + t * 470) % 820) - 30;
      line(x, y, x - 12, y + 30, '#d4eeee55', 1.2);
    }
    // The shelter's arc counts only members actually present, matching the simulation.
    c.beginPath();
    c.ellipse(570, 416, 131, 112, 0, Math.PI * 0.95, Math.PI * 2.05);
    c.strokeStyle = guards.length ? '#b5e5d688' : '#d9ab7877';
    c.lineWidth = 2 + guards.length;
    c.stroke();
    label(
      570,
      560,
      `到位守护 ${guards.length} · 屋顶 ${Math.ceil(s.integrity)}%`,
      s.integrity < 35 ? '#ffd0a9' : '#d6efdf',
    );
  } else
    for (let i = 0; i < 20; i++)
      oval(
        (i * 97.1 + t * 4) % 1120,
        60 + ((i * 59.9) % 640) + Math.sin(t + i) * 8,
        1.5,
        1.5,
        '#fff2b755',
      );
  for (const cue of cues) {
    const age = s.time - cue.at;
    if (age < 0 || age > 3) continue;
    c.save();
    c.globalAlpha = reduced ? 1 : Math.min(1, (3 - age) * 1.7);
    if (!reduced) {
      c.beginPath();
      c.arc(cue.x, cue.y, 15 + age * 22, 0, Math.PI * 2);
      c.strokeStyle = cue.kind === 'repair' ? '#b9e6d87a' : '#f9dfa554';
      c.lineWidth = 2;
      c.stroke();
    }
    label(
      cue.x,
      cue.y - 40 - (reduced ? 0 : Math.min(age, 1) * 20),
      cue.text,
      cue.kind === 'repair' ? '#c9f5df' : '#ffedac',
      16,
    );
    c.restore();
  }
}
