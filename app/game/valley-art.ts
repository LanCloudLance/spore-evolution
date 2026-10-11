import type { Material } from './tribe';
type C = CanvasRenderingContext2D;
export function valleyLeaf(
  c: C,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(-size, 0);
  c.bezierCurveTo(-size * 0.4, -size * 0.65, size * 0.65, -size * 0.5, size, 0);
  c.bezierCurveTo(size * 0.25, size * 0.45, -size * 0.6, size * 0.4, -size, 0);
  c.fillStyle = color;
  c.fill();
  c.beginPath();
  c.moveTo(-size * 0.7, 0);
  c.lineTo(size * 0.8, 0);
  c.strokeStyle = '#e8e6b938';
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}
export function valleyCargo(
  c: C,
  kind: Material,
  x: number,
  y: number,
  scale = 1,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.lineCap = 'round';
  if (kind === 'food') {
    c.beginPath();
    c.arc(0, 0, 6, 0, Math.PI * 2);
    c.fillStyle = '#efca7e';
    c.fill();
    c.beginPath();
    c.arc(-2, -2, 2, 0, Math.PI * 2);
    c.fillStyle = '#fff0b5';
    c.fill();
  }
  if (kind === 'wood') {
    c.beginPath();
    c.moveTo(-10, 8);
    c.lineTo(9, -7);
    c.strokeStyle = '#b89669';
    c.lineWidth = 5;
    c.stroke();
    c.beginPath();
    c.moveTo(-10, 7);
    c.lineTo(8, -8);
    c.strokeStyle = '#e5cf9c';
    c.lineWidth = 1;
    c.stroke();
  }
  if (kind === 'stone') {
    c.beginPath();
    c.moveTo(-8, 5);
    c.lineTo(-6, -6);
    c.lineTo(2, -10);
    c.lineTo(9, -2);
    c.lineTo(7, 6);
    c.closePath();
    c.fillStyle = '#9eafa9';
    c.fill();
    c.beginPath();
    c.moveTo(-6, -6);
    c.lineTo(2, -10);
    c.lineTo(1, 4);
    c.lineTo(-8, 5);
    c.fillStyle = '#d0d9c5';
    c.fill();
  }
  if (kind === 'fiber') {
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-6 + i * 4, 9);
      c.lineTo(-9 + i * 6, -9);
      c.strokeStyle = '#c6d195';
      c.lineWidth = 2;
      c.stroke();
    }
    c.fillStyle = '#a9865f';
    c.fillRect(-6, 0, 13, 3);
  }
  c.restore();
}
export function valleyEdges(c: C, time: number) {
  for (let i = 0; i < 38; i++) {
    const side = i % 4,
      q = Math.floor(i / 4),
      x = side === 0 ? 12 : side === 1 ? 1189 : q * 127 + 15,
      y = side === 2 ? 8 : side === 3 ? 795 : q * 90 + 5;
    for (let j = 0; j < 4; j++) {
      const a = j * 1.8 + i + Math.sin(time * 0.4 + i) * 0.025;
      valleyLeaf(
        c,
        x + Math.cos(a) * 24,
        y + Math.sin(a) * 23,
        33,
        a,
        j % 2 ? '#618658' : '#365c45',
      );
    }
  }
}
