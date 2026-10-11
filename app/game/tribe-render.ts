import { distance } from './simulation';
import { drawTerrain } from './life-art';
import { valleyLeaf, valleyCargo, valleyEdges } from './valley-art';
import type { TribeCue } from './tribe-feedback';
import type { TribeState } from './tribe';
import {
  TRIBE_MAP,
  TRIBE_HOME,
  TRIBE_COUNCIL,
  MATERIAL_NAMES,
  TRIBE_ROLES,
  tribeCapacity,
  tribeBuilders,
} from './tribe';
import { drawBody } from './ocean-render';
export function tribeView(width: number, height: number) {
  const scale = Math.min(width / TRIBE_MAP.width, height / TRIBE_MAP.height);
  return {
    scale,
    x: (width - TRIBE_MAP.width * scale) / 2,
    y: (height - TRIBE_MAP.height * scale) / 2,
  };
}
export function renderTribe(
  c: CanvasRenderingContext2D,
  s: TribeState,
  width: number,
  height: number,
  dpr: number,
  destination: { x: number; y: number } | null = null,
  cues: TribeCue[] = [],
  reduced = false,
) {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#14292a';
  c.fillRect(0, 0, width, height);
  const v = tribeView(width, height),
    t = reduced ? 0 : s.time;
  c.translate(v.x, v.y);
  c.scale(v.scale, v.scale);
  const circle = (x: number, y: number, r: number, color: string) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  };
  const label = (
    x: number,
    y: number,
    t: string,
    color = '#fff1cb',
    size = 17,
  ) => {
    c.font = `${size}px sans-serif`;
    c.textAlign = 'center';
    c.lineWidth = 4;
    c.strokeStyle = '#163b32de';
    c.strokeText(t, x, y);
    c.fillStyle = color;
    c.fillText(t, x, y);
  };
  const line = (
    a: number,
    b: number,
    x: number,
    y: number,
    color: string,
    w: number,
  ) => {
    c.beginPath();
    c.moveTo(a, b);
    c.lineTo(x, y);
    c.strokeStyle = color;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.stroke();
  };
  const flood = s.storm !== null && s.storm > 0;
  const ground = c.createLinearGradient(0, 0, 1200, 800);
  ground.addColorStop(0, '#415c4d');
  ground.addColorStop(0.5, '#a29863');
  ground.addColorStop(1, '#3a6659');
  c.fillStyle = ground;
  c.fillRect(0, 0, 1200, 800);
  drawTerrain(c, 'land', 1200, 800);
  if (flood) {
    c.fillStyle = '#24475533';
    c.fillRect(0, 0, 1200, 800);
  }
  for (let i = 0; i < 150; i++) {
    const x = (i * 137.3) % 1200,
      y = (i * 83.7) % 800;
    c.beginPath();
    c.ellipse(x, y, 2 + (i % 4), 1.5, i, 0, Math.PI * 2);
    c.fillStyle = '#24472b25';
    c.fill();
  }
  // Broad contour bands and a clear river separate the settlements without hiding routes.
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.ellipse(-15, 150, 165 + i * 25, 285 + i * 38, -0.3, 0, Math.PI * 2);
    c.strokeStyle = '#c9d2a516';
    c.lineWidth = 12;
    c.stroke();
  }
  c.beginPath();
  c.moveTo(710, -50);
  c.bezierCurveTo(855, 190, 638, 480, 750, 850);
  c.strokeStyle = '#b8c89f55';
  c.lineWidth = flood ? 133 : 101;
  c.stroke();
  c.strokeStyle = flood ? '#527e84' : '#387980';
  c.lineWidth = flood ? 99 : 72;
  c.stroke();
  c.strokeStyle = '#99d4c066';
  c.lineWidth = 3;
  c.stroke();
  for (let i = 0; i < 100; i++) {
    const x = (i * 137.7) % 1200,
      y = (i * 73.9) % 800;
    circle(x, y, 1 + (i % 3), i % 2 ? '#e4dd9b35' : '#173f3c33');
  }
  const path = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    active: boolean,
  ) => {
    c.setLineDash(active ? [] : [5, 14]);
    line(
      a.x,
      a.y,
      b.x,
      b.y,
      active ? '#dac69477' : '#e6d3aa44',
      active ? 12 : 3,
    );
    c.setLineDash([]);
  };
  valleyEdges(c, t);
  path(TRIBE_HOME, TRIBE_COUNCIL, s.camp);
  for (const n of s.neighbors) path(n, TRIBE_COUNCIL, n.trust >= 2);
  const tent = (x: number, y: number, color: string, scale = 1) => {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.fillStyle = '#183c3555';
    c.beginPath();
    c.ellipse(7, 21, 52, 19, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-47, 15);
    c.lineTo(0, -61);
    c.lineTo(50, 15);
    c.closePath();
    c.fillStyle = color;
    c.fill();
    c.beginPath();
    c.moveTo(-47, 15);
    c.lineTo(0, -61);
    c.lineTo(6, 15);
    c.fillStyle = '#fff3bf33';
    c.fill();
    c.beginPath();
    c.moveTo(-14, 15);
    c.lineTo(0, -12);
    c.lineTo(17, 15);
    c.fillStyle = '#26473b';
    c.fill();
    line(-48, 17, 0, -64, '#ead7a0', 3);
    line(0, -64, 50, 17, '#ead7a0', 3);
    c.restore();
  };
  for (const p of s.patches) {
    const ready = p.cooldown === 0,
      near = distance(p, s.player) < 100;
    c.beginPath();
    c.ellipse(p.x + 5, p.y + 16, 32, 13, 0, 0, Math.PI * 2);
    c.fillStyle = '#183f314a';
    c.fill();
    if (p.kind === 'food') {
      for (let i = 0; i < 6; i++)
        valleyLeaf(
          c,
          p.x + Math.cos(i * 2.4) * 13,
          p.y + Math.sin(i * 2.4) * 12,
          23,
          i * 2.4,
          i % 2 ? '#719d5d' : '#497647',
        );
      if (ready)
        for (let i = 0; i < 4; i++)
          valleyCargo(c, 'food', p.x - 15 + i * 10, p.y + (i % 2 ? 5 : -7));
    } else
      for (let i = 0; i < (ready ? 3 : 1); i++)
        valleyCargo(
          c,
          p.kind,
          p.x - 13 + i * 13,
          p.y + (i % 2) * 6,
          p.kind === 'fiber' ? 1.8 : 1.5,
        );
    if (near) {
      c.beginPath();
      c.ellipse(p.x, p.y + 9, 39, 24, 0, 0, Math.PI * 2);
      c.strokeStyle = ready ? '#f2df9c80' : '#d3daba44';
      c.lineWidth = 2;
      c.stroke();
      label(
        p.x,
        p.y + 46,
        ready
          ? `${MATERIAL_NAMES[p.kind]} · K`
          : `${Math.ceil(p.cooldown)}秒后恢复`,
        ready ? '#fff0c9' : '#c0cfb5',
        14,
      );
    }
  }
  for (const m of s.members) {
    const target = m.carrying
      ? TRIBE_HOME
      : m.role === 'escort'
        ? s.player
        : s.patches.find((p) => p.id === m.target && p.cooldown === 0);
    if (target) {
      c.setLineDash([2, 10]);
      line(
        m.x,
        m.y,
        target.x,
        target.y,
        m.carrying ? '#ffdd9e40' : '#dcdfb321',
        1.5,
      );
      c.setLineDash([]);
    }
  }
  circle(TRIBE_HOME.x, TRIBE_HOME.y, 72, '#edd29522');
  tent(190, 479, '#bbae70', 0.8);
  line(225, 523, 272, 523, '#6f5842', 14);
  line(230, 519, 227, 540, '#665440', 5);
  line(267, 519, 269, 540, '#665440', 5);
  label(215, 409, '工作台 · 存放 / 制作');
  for (const [i, kind] of (
    ['food', 'wood', 'stone', 'fiber'] as const
  ).entries())
    for (let j = 0; j < Math.min(5, s.stores[kind]); j++)
      valleyCargo(
        c,
        kind,
        152 + i * 36 + (j % 2) * 8,
        561 - Math.floor(j / 2) * 8,
        0.65,
      );
  circle(625, 405, 80, '#c3bf8733');
  for (let i = 0; i < 10; i++)
    circle(
      625 + Math.cos((i * Math.PI) / 5) * 70,
      405 + Math.sin((i * Math.PI) / 5) * 46,
      7,
      '#d8c793',
    );
  if (s.camp) {
    tent(598, 394, '#e0bf77', 0.8);
    tent(661, 432, '#9cae72', 0.65);
    circle(625, 422, 8, '#f1c471');
    circle(625, 420, 4, '#fff0b1');
  }
  label(625, 320, s.camp ? '共同营地' : '谷地圆环');
  for (const n of s.neighbors) {
    tent(n.x, n.y, n.id === 'moss' ? '#8eb6a0' : '#c6a077');
    tent(n.x + 52, n.y + 39, n.id === 'moss' ? '#6f9385' : '#ac895f', 0.55);
    label(n.x, n.y - 88, n.id === 'moss' ? '苔石聚落' : '芦湾聚落');
    label(
      n.x,
      n.y + 67,
      n.trust >= 2
        ? '盟友 · 道路已经连起'
        : n.met
          ? `信任 ${n.trust}/2`
          : '靠近按 K 拜访',
      n.trust >= 2 ? '#d9f4b4' : '#efe1c0',
      15,
    );
    if (n.helped)
      for (let i = 0; i < 4; i++) {
        if (n.id === 'moss')
          valleyCargo(c, 'stone', n.x - 48 - i * 17, n.y + 40, 1);
        else valleyLeaf(c, n.x - 32 + i * 19, n.y - 35, 17, -0.4, '#b4c58b');
      }
    if (s.camp) {
      const b = n.builder;
      if (distance(b, TRIBE_COUNCIL) > 100) {
        c.setLineDash([3, 9]);
        line(b.x, b.y, 625, 450, '#d4dfad44', 2);
        c.setLineDash([]);
      }
      drawBody(
        c,
        n.id === 'moss' ? 'crawler' : 'strider',
        b.x,
        b.y,
        19,
        Math.atan2(405 - b.y, 625 - b.x),
        t,
        [],
        false,
        n.id === 'moss' ? '#acd8c7' : '#e2c393',
      );
      label(b.x, b.y - 38, '邻居', '#fff1cb', 14);
    }
  }
  for (const b of s.banks) {
    const done = b.work >= 6,
      length = done ? 108 : 24 + b.work * 14;
    if (s.storm !== null) {
      circle(b.x, b.y, 48, done ? '#d1e6b822' : '#f4b46522');
      for (let i = 0; i < 5; i++)
        line(
          b.x - length / 2,
          b.y - 21 + i * 10,
          b.x + length / 2,
          b.y - 21 + i * 10,
          done ? '#d4c58d' : b.paid ? '#b6a16e' : '#61766c66',
          6,
        );
      if (!done) {
        if (b.paid && distance(s.player, b) < 60)
          label(
            b.x,
            b.y + 69,
            `到位帮手 ${tribeBuilders(s, b).length}${s.tools.includes('hammer') ? ' · 石锤' : ''}`,
            '#d7efc5',
            13,
          );
        line(b.x - 38, b.y + 38, b.x + 38, b.y + 38, '#284c49', 5);
        line(
          b.x - 38,
          b.y + 38,
          b.x - 38 + (b.work / 6) * 76,
          b.y + 38,
          '#f2d182',
          5,
        );
      }
      label(
        b.x,
        b.y - 57,
        done
          ? '河堤稳固'
          : `${b.id + 1} 号河堤 · ${b.paid ? '留在旁边建造' : 'K 投入材料'}`,
        done ? '#e2f2c8' : '#fff0cb',
        15,
      );
    }
  }
  const activeBank = s.banks.find(
    (b) =>
      b.paid && b.work < 6 && s.storm !== null && distance(s.player, b) < 60,
  );
  const helpers = activeBank ? tribeBuilders(s, activeBank) : [];
  const drawMember = (
    p: { x: number; y: number; angle: number },
    form: TribeState['form'],
    player: boolean,
    newborn = false,
  ) => {
    circle(p.x + 5, p.y + 10, player ? 26 : 19, '#203a3866');
    if (player) {
      c.beginPath();
      c.ellipse(p.x, p.y + 8, 34, 23, 0, 0, Math.PI * 2);
      c.strokeStyle = '#fff3b580';
      c.lineWidth = 2;
      c.stroke();
    }
    drawBody(
      c,
      form,
      p.x,
      p.y,
      player ? 28 : 22,
      p.angle,
      t,
      player || newborn ? s.traits : [],
      false,
      player ? undefined : '#d4e3ad',
      player || newborn ? s.body : undefined,
      player || newborn ? s.organ : undefined,
      1,
      player || newborn ? s.adaptation : undefined,
    );
    const working =
      !!activeBank &&
      (player || helpers.includes(p as TribeState['members'][number]));
    if (s.tools.includes('basket')) {
      c.fillStyle = '#bc8a4b';
      c.fillRect(p.x + 18, p.y + 7, 13, 12);
      line(p.x + 18, p.y + 10, p.x + 31, p.y + 10, '#ead49b', 2);
    }
    if (s.tools.includes('hammer')) {
      const lift = working ? Math.sin(t * 14) * 8 : 0;
      line(p.x + 22, p.y - 3, p.x + 35, p.y - 18 - lift, '#d3ad72', 4);
      valleyCargo(c, 'stone', p.x + 35, p.y - 18 - lift, 0.8);
    }
    if (working && !reduced) {
      for (let i = 0; i < 3; i++)
        circle(
          p.x + 24 + i * 7,
          p.y + 9 - ((t * 35 + i * 5) % 18),
          1.5,
          '#ffe8af99',
        );
    }
  };
  for (const m of s.members) {
    drawMember(m, m.form, false, m.newborn);
    if (m.role !== 'escort' || m.carrying || distance(m, s.player) > 100)
      label(
        m.x,
        m.y - 45,
        `${m.newborn ? '✦' : m.id + 1} ${TRIBE_ROLES[m.role]}`,
        '#edf0c7',
        13,
      );
    if (m.carrying)
      for (let i = 0; i < m.load; i++)
        valleyCargo(
          c,
          m.carrying,
          m.x + Math.cos(m.angle) * 30 + Math.sin(m.angle) * i * 8,
          m.y + Math.sin(m.angle) * 30 - Math.cos(m.angle) * i * 8,
          0.8,
        );
  }
  drawMember(s.player, s.form, true);
  if (s.player.carrying)
    for (let i = 0; i < s.player.load; i++)
      valleyCargo(
        c,
        s.player.carrying,
        s.player.x +
          Math.cos(s.player.angle) * 34 +
          Math.sin(s.player.angle) * (i - 1) * 7,
        s.player.y +
          Math.sin(s.player.angle) * 34 -
          Math.cos(s.player.angle) * (i - 1) * 7,
        0.7,
      );
  if (destination && s.mode === 'running') {
    c.setLineDash([4, 9]);
    line(s.player.x, s.player.y, destination.x, destination.y, '#fff0ad66', 2);
    c.setLineDash([]);
    c.beginPath();
    c.ellipse(destination.x, destination.y, 16, 9, 0, 0, Math.PI * 2);
    c.strokeStyle = '#fff0c4';
    c.lineWidth = 2;
    c.stroke();
  }
  label(s.player.x, s.player.y - 59, '你', '#fff4c3', 16);
  if (s.player.carrying)
    label(
      s.player.x,
      s.player.y + 55,
      `${MATERIAL_NAMES[s.player.carrying]} ${s.player.load}/${tribeCapacity(s)}`,
      '#fff4c3',
      16,
    );
  if (flood) {
    c.fillStyle = '#28495b28';
    c.fillRect(0, 0, 1200, 800);
    for (let i = 0; i < 60; i++) {
      const x = (i * 107 + t * 75) % 1200,
        y = (i * 71 + t * 330) % 800;
      line(x, y, x - 7, y + 18, '#d6eae53b', 1.2);
    }
  }
  const cueLabels: { x: number; y: number }[] = [];
  for (const cue of cues) {
    const age = s.time - cue.at;
    if (age < 0 || age > 2.6) continue;
    c.save();
    c.globalAlpha = reduced ? 1 : Math.min(1, (2.6 - age) * 2);
    if (!reduced) {
      c.beginPath();
      c.arc(cue.x, cue.y, 12 + age * 22, 0, Math.PI * 2);
      c.strokeStyle = '#f9e5b060';
      c.lineWidth = 2;
      c.stroke();
    }
    let cueY =
      cue.y +
      (cue.kind === 'camp' ? 100 : -88) -
      (reduced ? 0 : Math.min(age, 1) * 18);
    while (
      cueLabels.some(
        (p) => Math.abs(p.x - cue.x) < 130 && Math.abs(p.y - cueY) < 22,
      )
    )
      cueY -= 24;
    cueLabels.push({ x: cue.x, y: cueY });
    label(cue.x, cueY, cue.text, '#fff0b6', 15);
    c.restore();
  }
}
