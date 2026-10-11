type C = CanvasRenderingContext2D;
export type Terrain = 'pond' | 'ocean' | 'shore' | 'land';
let atlas: HTMLImageElement | undefined;
const quarters: Record<Terrain, [number, number]> = {
  pond: [0, 0],
  ocean: [1, 0],
  shore: [0, 1],
  land: [1, 1],
};
/** Floor only: live water, rocks and bodies continue to follow simulation coordinates. */
export function drawTerrain(
  c: C,
  habitat: Terrain,
  width: number,
  height: number,
) {
  if (!atlas && typeof Image !== 'undefined') {
    atlas = new Image();
    atlas.src = '/assets/life-terrain-atlas.png?art=1';
  }
  c.fillStyle = {
    pond: '#246a73',
    ocean: '#317e8c',
    shore: '#c7c394',
    land: '#8aa886',
  }[habitat];
  c.fillRect(0, 0, width, height);
  if (!atlas?.complete || !atlas.naturalWidth) return;
  const [x, y] = quarters[habitat],
    sw = atlas.naturalWidth / 2,
    sh = atlas.naturalHeight / 2;
  c.drawImage(
    atlas,
    x * sw + 1,
    y * sh + 1,
    sw - 2,
    sh - 2,
    0,
    0,
    width,
    height,
  );
  // Floor detail is quieter than living actors; decoration is never an interaction cue.
  if (habitat === 'ocean') {
    c.fillStyle = '#69b8bd40';
    c.fillRect(0, 0, width, height);
  }
}
export function pigment(color: string, light: number) {
  const hex = color.replace('#', '').slice(0, 6);
  if (!/^[a-f0-9]{6}$/i.test(hex)) return color;
  const channels = [0, 2, 4].map((i) => {
    const n = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(light > 0 ? n + (255 - n) * light : n * (1 + light));
  });
  return `rgb(${channels.join(',')})`;
}
/** Opaque tissue with a consistent light direction; never changes body dimensions. */
export function tissue(c: C, color: string, radius = 24) {
  const g = c.createLinearGradient(
    -radius * 0.3,
    -radius,
    radius * 0.3,
    radius,
  );
  g.addColorStop(0, pigment(color, 0.55));
  g.addColorStop(0.36, color);
  g.addColorStop(1, pigment(color, -0.38));
  return g;
}
export function livingEye(c: C, x: number, y: number, r = 5, hunter = false) {
  c.beginPath();
  c.ellipse(x, y, r * 1.12, r, 0, 0, Math.PI * 2);
  c.fillStyle = '#fff8db';
  c.fill();
  c.lineWidth = r * 0.22;
  c.strokeStyle = '#254a49';
  c.stroke();
  c.beginPath();
  c.ellipse(
    x + r * 0.22,
    y,
    hunter ? r * 0.28 : r * 0.48,
    r * 0.65,
    0,
    0,
    Math.PI * 2,
  );
  c.fillStyle = '#193744';
  c.fill();
  c.beginPath();
  c.arc(x + r * 0.38, y - r * 0.28, r * 0.2, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
}
/** Irregular bank lies outside the actual circular wet area, keeping the safe boundary honest. */
export function poolBank(c: C, x: number, y: number, r: number, seed: number) {
  c.save();
  c.translate(x, y);
  c.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i * Math.PI * 2) / 72;
    const reach =
      r +
      9 +
      (Math.sin(a * 5 + seed) + 1) * 5 +
      (Math.cos(a * 3 - seed) + 1) * 4;
    if (i) c.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
    else c.moveTo(Math.cos(a) * reach, Math.sin(a) * reach);
  }
  c.closePath();
  c.fillStyle = '#5c8e7966';
  c.fill();
  c.strokeStyle = '#d7ddb77a';
  c.lineWidth = 2;
  c.stroke();
  c.restore();
}
