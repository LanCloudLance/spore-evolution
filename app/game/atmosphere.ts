import type { World } from './simulation';
import type { View } from './camera';
import { drawTerrain } from './life-art';
import { MAP } from './simulation';
type C = CanvasRenderingContext2D;
const glowSprites = new Map<string, HTMLCanvasElement>();
export function cachedGlow(
  c: C,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  let sprite = glowSprites.get(color);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 128;
    sprite.height = 128;
    const s = sprite.getContext('2d');
    if (!s) return;
    const g = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    s.fillStyle = g;
    s.fillRect(0, 0, 128, 128);
    glowSprites.set(color, sprite);
  }
  c.drawImage(sprite, x - r, y - r, r * 2, r * 2);
}
export function drawDepth(c: C, v: View, t: number, ocean: boolean) {
  const { width, height } = v;
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(v.zoom, v.zoom);
  c.translate(-v.cx, -v.cy);
  drawTerrain(
    c,
    ocean ? 'ocean' : 'pond',
    ocean ? 3400 : MAP.width,
    ocean ? 2300 : MAP.height,
  );
  c.restore();
  c.save();
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const x = width * (0.08 + i * 0.22) + Math.sin(t * 0.13 + i) * 30;
    const g = c.createLinearGradient(x, -50, x + height * 0.25, height);
    g.addColorStop(0, ocean ? '#56d9ff13' : '#b2edd910');
    g.addColorStop(1, 'transparent');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, -50);
    c.lineTo(x + 35 + i * 9, -50);
    c.lineTo(x + height * 0.4 + 110, height);
    c.lineTo(x + height * 0.3 - 45, height);
    c.fill();
  }
  c.restore();
}
type Wake = { x: number; y: number; life: number; r: number };
type FX = {
  wake: Wake[];
  time: number;
  food: number;
  health: number;
  flash: number;
  hit: number;
};
const effects = new WeakMap<World, FX>();
export function drawFeedback(c: C, w: World, v: View) {
  let fx = effects.get(w);
  if (!fx) {
    fx = {
      wake: [],
      time: w.time,
      food: w.totalFood,
      health: w.player.health,
      flash: 0,
      hit: 0,
    };
    effects.set(w, fx);
  }
  const dt = Math.max(0, Math.min(0.1, w.time - fx.time));
  fx.time = w.time;
  if (w.totalFood > fx.food) fx.flash = 0.55;
  if (w.player.health < fx.health - 1) fx.hit = 0.35;
  fx.food = w.totalFood;
  fx.health = w.player.health;
  if (dt > 0) {
    fx.flash = Math.max(0, fx.flash - dt);
    fx.hit = Math.max(0, fx.hit - dt);
    fx.wake = fx.wake.filter((p) => (p.life -= dt) > 0);
    if (Math.hypot(w.player.vx, w.player.vy) > 40) {
      fx.wake.push({
        x: w.player.x - Math.cos(w.player.angle) * 25,
        y: w.player.y - Math.sin(w.player.angle) * 25,
        life: w.player.dashing ? 0.65 : 0.4,
        r: w.player.dashing ? 7 : 3,
      });
      if (fx.wake.length > 55) fx.wake.shift();
    }
  }
  c.save();
  c.translate(v.width / 2, v.height / 2);
  c.scale(v.zoom, v.zoom);
  c.translate(-v.cx, -v.cy);
  c.globalCompositeOperation = 'screen';
  for (const p of fx.wake) {
    c.globalAlpha = p.life * 0.55;
    cachedGlow(c, p.x, p.y, p.r * 3, '#8af0df90');
  }
  c.globalAlpha = 1;
  if (fx.flash > 0) {
    const r = 30 + (1 - fx.flash / 0.55) * 65;
    c.strokeStyle = `rgba(164,255,211,${fx.flash})`;
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(w.player.x, w.player.y, r, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#d4ffe5';
    c.font = '13px sans-serif';
    c.textAlign = 'center';
    c.fillText(
      '+ 营养',
      w.player.x,
      w.player.y - 48 - (1 - fx.flash / 0.55) * 20,
    );
  }
  c.restore();
  // Foreground particles travel more than the distant seabed, giving swimming a depth cue.
  c.save();
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 26; i++) {
    const x =
        (((i * 313.7 - v.cx * 0.18 + Math.sin(w.time * 0.25 + i) * 10) %
          v.width) +
          v.width) %
        v.width,
      y =
        (((i * 127.1 - v.cy * 0.18 + w.time * 2) % v.height) + v.height) %
        v.height;
    c.globalAlpha = i % 4 === 0 ? 0.32 : 0.13;
    cachedGlow(c, x, y, i % 4 === 0 ? 5 : 2, '#c5f7ffb0');
  }
  c.restore();
  if (fx.hit > 0) {
    c.fillStyle = `rgba(227,113,86,${fx.hit * 0.22})`;
    c.fillRect(0, 0, v.width, v.height);
  }
}
