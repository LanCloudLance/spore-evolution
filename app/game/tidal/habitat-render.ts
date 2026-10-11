import { TIDAL_BIOMES } from './catalog';
type C = CanvasRenderingContext2D;
/** World landmarks have the same centers and passages as collision and flow. */
export function drawTidalHabitat(
  c: C,
  time: number,
  player?: { x: number; y: number },
) {
  for (const b of TIDAL_BIOMES) {
    const gradient = c.createRadialGradient(
      b.x,
      b.y,
      20,
      b.x,
      b.y,
      b.radius * 1.4,
    );
    gradient.addColorStop(0, `${b.color}27`);
    gradient.addColorStop(1, `${b.color}00`);
    c.fillStyle = gradient;
    c.beginPath();
    c.arc(b.x, b.y, b.radius * 1.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `${b.color}c0`;
    c.font = '15px sans-serif';
    c.textAlign = 'center';
    c.fillText(b.name, b.x, b.y - b.radius - 20);
  }
  // Kelp blades and warm-vent plumes visibly identify the two new ecological corridors.
  for (let i = 0; i < 25; i++) {
    const angle = i * 2.399,
      radius = Math.sqrt(i / 25) * 260;
    const x = 700 + Math.cos(angle) * radius,
      y = 730 + Math.sin(angle) * radius;
    c.beginPath();
    c.moveTo(x, y + 65);
    c.bezierCurveTo(
      x - 26,
      y + 18,
      x + Math.sin(time + i) * 22,
      y - 40,
      x + Math.sin(time * 0.8 + i) * 16,
      y - 110,
    );
    c.strokeStyle = '#76b88b62';
    c.lineWidth = 7;
    c.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = 2850 + Math.cos(i * 2.4) * 185,
      y = 2050 + Math.sin(i * 2.4) * 135;
    c.beginPath();
    c.ellipse(x, y, 20, 12, 0, 0, Math.PI * 2);
    c.fillStyle = '#93877488';
    c.fill();
    c.beginPath();
    c.moveTo(x, y - 6);
    c.bezierCurveTo(
      x + 12,
      y - 30,
      x - 12,
      y - 60,
      x + Math.sin(time * 0.7 + i) * 15,
      y - 90,
    );
    c.strokeStyle = '#dcbb9638';
    c.lineWidth = 11;
    c.stroke();
  }
  for (let i = 0; i < 42; i++) {
    const a = i * 2.399,
      r = Math.sqrt((i + 0.5) / 42) * 330,
      x = 460 + Math.cos(a) * r,
      y = 1770 + Math.sin(a) * r;
    c.beginPath();
    c.moveTo(x, y + 18);
    c.quadraticCurveTo(
      x + Math.sin(time * 1.3 + i) * 12,
      y - 10,
      x + Math.sin(time + i) * 8,
      y - 34,
    );
    c.strokeStyle =
      player && Math.hypot(x - player.x, y - player.y) < 85
        ? '#79c6a518'
        : i % 2
          ? '#79c6a54a'
          : '#42978370';
    c.lineWidth = 4;
    c.stroke();
  }
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#82bba613';
  c.lineWidth = 180;
  c.beginPath();
  c.moveTo(1940, 1680);
  c.quadraticCurveTo(1810, 1350, 1940, 1010);
  c.stroke();
  c.strokeStyle = '#e2d5ad24';
  c.lineWidth = 30;
  c.beginPath();
  c.moveTo(2120, 1350);
  c.lineTo(2350, 1350);
  c.stroke();
  const tide = 0.5 + 0.5 * Math.sin((time * Math.PI * 2) / 90);
  c.lineWidth = 14;
  c.strokeStyle = '#ccdbc841';
  c.beginPath();
  c.ellipse(3060, 390, 195 + tide * 25, 130, 0, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = '#ebdfb957';
  c.beginPath();
  c.arc(3060, 390, 80, -0.4, Math.PI * 1.7);
  c.stroke();
  c.restore();
}
