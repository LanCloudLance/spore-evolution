import { MICROBE_BODIES } from './dna-evolution';
import type { MicrobeBody } from './dna-evolution';
import type { TraitId } from './simulation.ts';
import { cachedGlow } from './atmosphere';
import { tissue } from './life-art';
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
export function drawOrganism(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  time: number,
  traits: TraitId[] = [],
  predator = false,
  alert = false,
  formation: Partial<Record<TraitId, number>> = {},
  profile: MicrobeBody = 'ancestor',
) {
  const color = predator ? (alert ? '#ffd08a' : '#efb38b') : '#88dac0';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const shape = MICROBE_BODIES[profile];
  ctx.scale((size / 22) * shape.length, (size / 22) * shape.width);
  glow(ctx, 0, 0, predator ? 65 : 80, predator ? '#be733b19' : '#60eaca18');
  const ciliaGrowth = traits.includes('cilia') ? (formation.cilia ?? 1) : 0;
  const cilia = 16 + Math.round(12 * ciliaGrowth);
  ctx.strokeStyle = predator ? '#b97965bb' : '#d2f1cabb';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < cilia; i++) {
    const a = (i / cilia) * Math.PI * 2,
      c = Math.cos(a),
      s = Math.sin(a),
      wave = Math.sin(time * 5 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(c * 27, s * 18);
    ctx.quadraticCurveTo(
      c * 32 + wave,
      s * 23,
      c * (35 + 8 * ciliaGrowth) + wave,
      s * (25 + 8 * ciliaGrowth),
    );
    ctx.stroke();
  }
  const tailLength =
    48 + (traits.includes('flagellum') ? 34 * (formation.flagellum ?? 1) : 0);
  ctx.strokeStyle = predator ? '#eeb982' : '#b7efcf';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.bezierCurveTo(
    -35,
    Math.sin(time * 5) * 18,
    -tailLength,
    Math.cos(time * 5) * 20,
    -tailLength - 8,
    Math.sin(time * 5 + 1) * 11,
  );
  ctx.stroke();
  if (traits.includes('shell')) {
    ctx.save();
    ctx.globalAlpha *= formation.shell ?? 1;
    ellipse(
      ctx,
      0,
      0,
      28 + 7 * (formation.shell ?? 1),
      19 + 7 * (formation.shell ?? 1),
      '#c6b5f21c',
      '#d0bafa99',
    );
    ctx.restore();
  }
  if (traits.includes('spikes')) {
    ctx.fillStyle = '#f4ce93';
    ctx.strokeStyle = '#f7cb91';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.12) * 26, Math.sin(a - 0.12) * 20);
      ctx.lineTo(
        Math.cos(a) * (26 + 17 * (formation.spikes ?? 1)),
        Math.sin(a) * (20 + 14 * (formation.spikes ?? 1)),
      );
      ctx.lineTo(Math.cos(a + 0.12) * 26, Math.sin(a + 0.12) * 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  const body = tissue(ctx, color, 22);
  ctx.fillStyle = body;
  ctx.strokeStyle = predator ? '#8c5960' : '#397b77';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2,
      undulate = 1 + Math.sin(a * 4 + time * 2) * 0.035;
    const xx = Math.cos(a) * 28 * undulate,
      yy = Math.sin(a) * 19 * undulate;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, -9, -10, 7, 2.5, '#f2ffe99c');
  ellipse(
    ctx,
    1,
    -1,
    8,
    6,
    predator ? '#986744aa' : '#44776eaa',
    predator ? '#edc193aa' : '#bcf7deb3',
  );
  ellipse(ctx, 0, -2, 3.2, 2.8, predator ? '#ffe3b3' : '#c0f2c8');
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4 + time * 0.15;
    ellipse(
      ctx,
      Math.cos(a) * (12 + i * 0.6),
      Math.sin(a) * 11,
      2 + (i % 2),
      1.8,
      traits.includes('chloroplast') && (formation.chloroplast ?? 1) > i / 8
        ? '#b8e77c99'
        : predator
          ? '#f0cb9999'
          : '#b4e3bd99',
    );
  }
  if (traits.includes('vacuole'))
    ellipse(
      ctx,
      -13,
      4,
      7 * (formation.vacuole ?? 1),
      6 * (formation.vacuole ?? 1),
      '#dac79537',
      '#e2d19c8a',
    );
  ctx.restore();
}
