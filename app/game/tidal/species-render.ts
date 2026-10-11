import type { TidalActor } from './types';
import { TIDAL_SPECIES } from './catalog';
import { tissue, livingEye } from '../life-art';
type C = CanvasRenderingContext2D;
const oval = (c: C, x: number, y: number, rx: number, ry: number) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
};
export function drawTidalActor(c: C, a: TidalActor, time: number): void {
  if (a.health <= 0) return;
  const definition = TIDAL_SPECIES.find((s) => s.id === a.species)!;
  c.save();
  c.translate(a.x, a.y);
  c.rotate(a.angle);
  c.scale(a.radius, a.radius);
  c.lineWidth = 0.06;
  c.strokeStyle = '#375c68';
  const skin = tissue(c, definition.color, 0.8);
  c.fillStyle = skin;
  c.shadowColor = '#021a29';
  c.shadowBlur = 0;
  c.shadowOffsetY = 3;
  const swing =
      Math.sin(time * (a.behavior === 'flee' ? 9 : 4) + a.id.length) *
      (a.behavior === 'digest' ? 0.025 : 0.15),
    closed = a.behavior === 'defend',
    rest = a.behavior === 'digest';
  switch (a.species) {
    case 'glass-minnow':
      c.globalAlpha = 0.72;
      oval(c, 0, 0, 1.1, 0.3);
      oval(c, -0.95, swing, 0.32, 0.5);
      break;
    case 'pipe-seahorse':
      oval(c, 0.25, -0.35, 0.35, 0.7);
      oval(c, 0.7, -0.75, 0.5, 0.18);
      c.beginPath();
      c.moveTo(0, 0.25);
      c.bezierCurveTo(-1, 1.6, -1.4, -0.3, -0.3, 0.45);
      c.stroke();
      break;
    case 'burrow-crab':
      oval(c, -0.15, 0, 0.85, 0.7);
      for (const side of [-1, 1]) {
        oval(c, 0.8, side * 0.6, closed ? 0.4 : 0.55, 0.28);
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(-0.3 - i * 0.2, side * 0.35);
          c.lineTo(-0.6 - i * 0.25, side * (0.95 + swing));
          c.stroke();
        }
      }
      break;
    case 'siphon-jelly':
      oval(c, 0, 0, 0.8, 0.65);
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.moveTo(-0.5, i * 0.15);
        c.quadraticCurveTo(-1.2, i * 0.2 + swing, -1.8, i * 0.22);
        c.stroke();
      }
      break;
    case 'brush-ray':
      c.beginPath();
      c.moveTo(1, 0);
      c.quadraticCurveTo(0, -1.3 - swing, -0.6, -0.2);
      c.lineTo(-1.7, swing);
      c.lineTo(-0.6, 0.2);
      c.quadraticCurveTo(0, 1.3 + swing, 1, 0);
      c.fill();
      c.stroke();
      break;
    case 'vent-tube':
      oval(c, -0.4, 0, 0.7, 0.28);
      for (let i = -4; i <= 4; i++) {
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(rest ? 0.4 : 1.1, i * 0.16);
        c.stroke();
      }
      break;
    case 'silver-dart':
      oval(c, 0, 0, 1, 0.42);
      c.beginPath();
      c.moveTo(-0.6, 0);
      c.lineTo(-1.3, -0.45 + swing);
      c.lineTo(-1.3, 0.45 + swing);
      c.closePath();
      c.fill();
      break;
    case 'thinwing':
      oval(c, 0, 0, 0.9, 0.35);
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(-0.7, side * (rest ? 0.4 : 1.3), 0.65, side * 0.25);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    case 'fanworm':
      oval(c, -0.3, 0, 0.6, 0.28);
      for (let j = -4; j <= 4; j++) {
        c.beginPath();
        c.moveTo(0.1, 0);
        c.quadraticCurveTo(0.6, j * 0.15, rest ? 0.4 : 1.2, j * 0.2);
        c.stroke();
      }
      break;
    case 'thornpuffer':
      oval(c, 0, 0, 0.8, 0.7);
      for (let j = -2; j <= 2; j++) {
        c.beginPath();
        c.moveTo(-0.45, j * 0.2);
        c.lineTo(-1.25, j * 0.25);
        c.lineTo(-0.55, j * 0.2 + 0.08);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    case 'shellsnail':
      oval(c, 0, 0, 0.9, closed ? 0.8 : 0.65);
      c.beginPath();
      for (let j = 0; j < 40; j++) {
        const theta = j * 0.3,
          r = j * 0.015;
        const x = Math.cos(theta) * r,
          y = Math.sin(theta) * r;
        if (j) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
      if (!closed) oval(c, 0.75, 0, 0.45, 0.2);
      break;
    case 'sand-eel':
      c.beginPath();
      c.moveTo(1, 0);
      c.bezierCurveTo(0.3, -0.55, -0.5, 0.6, -1.6, swing);
      c.quadraticCurveTo(-0.4, -0.2, 1, 0);
      c.fill();
      c.stroke();
      break;
    case 'scavenger-shrimp':
      oval(c, 0, 0, 0.75, 0.3);
      for (let j = -2; j <= 2; j++) {
        c.beginPath();
        c.moveTo(j * 0.22, 0.12);
        c.lineTo(j * 0.22 - 0.2, 0.6 + swing);
        c.moveTo(0.6, 0);
        c.lineTo(1.3, j * 0.18);
        c.stroke();
      }
      break;
    case 'moss-crab':
      oval(c, 0, 0, 0.7, 0.55);
      for (const side of [-1, 1]) {
        for (let j = -2; j <= 2; j++) {
          c.beginPath();
          c.moveTo(j * 0.2, side * 0.35);
          c.lineTo(j * 0.25 - 0.15, side * (0.85 + swing));
          c.stroke();
        }
        oval(c, 0.65, side * 0.55, 0.3, 0.2);
      }
      break;
    case 'ribbonfish':
      oval(c, 0.15, 0, 0.75, 0.35);
      c.beginPath();
      c.moveTo(-0.35, 0);
      c.bezierCurveTo(-0.8, -0.6 + swing, -1.1, 0.6, -1.6, swing);
      c.lineWidth = 0.25;
      c.stroke();
      c.lineWidth = 0.06;
      break;
    case 'lantern-drifter': {
      const r = closed ? 0.55 : 1;
      oval(c, 0, 0, 0.65 * r, 0.9 * r);
      for (let j = -2; j <= 2; j++) {
        c.beginPath();
        c.moveTo(-0.2, j * 0.12);
        c.quadraticCurveTo(-1, j * 0.18 + swing, -1.2, j * 0.16);
        c.stroke();
      }
      break;
    }
    case 'crested-hunter':
      oval(c, 0, 0, 1, 0.48);
      c.beginPath();
      c.moveTo(0.5, -0.3);
      c.lineTo(-0.2, -1);
      c.lineTo(-0.45, -0.25);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-0.6, 0);
      c.lineTo(-1.3, -0.5 + swing);
      c.lineTo(-1.3, 0.5 + swing);
      c.closePath();
      c.fill();
      break;
    case 'great-ray':
      c.beginPath();
      c.moveTo(1, 0);
      c.quadraticCurveTo(-0.2, -1.15 - swing, -1, 0);
      c.quadraticCurveTo(-0.2, 1.15 + swing, 1, 0);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-0.8, 0);
      c.quadraticCurveTo(-1.3, swing, -1.8, 0);
      c.stroke();
      break;
  }
  c.shadowOffsetY = 0;
  livingEye(c, 0.48, -0.18, 0.13, a.species === 'crested-hunter');
  if (a.species === 'great-ray' || a.species === 'moss-crab')
    livingEye(c, 0.48, 0.18, 0.13);
  if (a.behavior === 'ambush' && a.phaseSeconds < 0.6) {
    c.strokeStyle = '#ffd092';
    c.lineWidth = 0.08;
    c.beginPath();
    c.arc(
      0,
      0,
      1.3,
      -Math.PI / 2,
      -Math.PI / 2 + (Math.PI * 2 * a.phaseSeconds) / 0.6,
    );
    c.stroke();
  }
  if (a.carryingId) {
    c.fillStyle = '#bae18f';
    oval(c, 0.8, 0.25, 0.2, 0.2);
  }
  c.restore();
}
