import { tidalGuidance } from './tidal/migration.ts';
import { worldBodyPose } from './body-geometry.ts';
import type { World, Vec } from './simulation.ts';
import { HAVEN, NURSERY, distance } from './simulation.ts';
import { oceanTarget } from './ocean.ts';
import { shoreTarget } from './shore.ts';
import { landTarget } from './land.ts';
import { getView } from './camera.ts';
import { drawPlayerFocus } from './readability.ts';

export function journeyTarget(w: World): {
  point: Vec;
  label: string;
  actorId?: string;
  intent?: 'hunt' | 'visit';
} {
  if (w.land) return landTarget(w);
  if (w.shore) return shoreTarget(w);
  if (w.ocean) return tidalGuidance(w) ?? oceanTarget(w);
  if (w.generation >= 3) return { point: HAVEN, label: '前往新栖息地' };
  if (w.food < 8 || w.player.energy < 50) {
    const food = w.foods
      .filter(
        (f) =>
          f.cooldown === 0 && w.predators.every((p) => distance(p, f) > 220),
      )
      .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
    return { point: food ?? NURSERY, label: '先寻找食物' };
  }
  return { point: NURSERY, label: '回育生水域 · O 繁殖' };
}

export function drawJourneyFocus(
  c: CanvasRenderingContext2D,
  w: World,
  width: number,
  height: number,
  dpr: number,
  locating: boolean,
) {
  if (w.mode !== 'running' && w.mode !== 'paused') return;
  const v = getView(w, width, height),
    p = w.player;
  const screen = (q: { x: number; y: number }) => ({
    x: (q.x - v.cx) * v.zoom + width / 2,
    y: (q.y - v.cy) * v.zoom + height / 2,
  });
  const player = screen(p),
    size = worldBodyPose(w).size;
  c.save();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPlayerFocus(
    c,
    player.x,
    player.y,
    Math.max(23, size * v.zoom + 9),
    p.angle,
  );
  if (locating) {
    const target = screen(journeyTarget(w).point);
    // Keep the locator inside the play area, away from the right-hand mission panel.
    const right = width > 950 ? width - 335 : width - 32;
    const scale = Math.min(
      1,
      Math.max(0, (right - player.x) / Math.max(1, target.x - player.x)),
      Math.max(0, (player.x - 28) / Math.max(1, player.x - target.x)),
      Math.max(0, (height - 100 - player.y) / Math.max(1, target.y - player.y)),
      Math.max(0, (player.y - 110) / Math.max(1, player.y - target.y)),
    );
    const x = player.x + (target.x - player.x) * scale,
      y = player.y + (target.y - player.y) * scale;
    c.strokeStyle = '#ffe09a';
    c.lineWidth = 2;
    c.setLineDash([4, 8]);
    c.beginPath();
    c.moveTo(player.x, player.y);
    c.lineTo(x, y);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(x, y, 17, 0, Math.PI * 2);
    c.fillStyle = '#142e36e8';
    c.fill();
    c.stroke();
    c.font = 'bold 17px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#ffe09a';
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan2(target.y - player.y, target.x - player.x));
    c.beginPath();
    c.moveTo(9, 0);
    c.lineTo(-5, -6);
    c.lineTo(-5, 6);
    c.closePath();
    c.fill();
    c.restore();
    c.font = '13px sans-serif';
    c.lineWidth = 4;
    c.strokeStyle = '#142e36';
    const label = `${scale < 1 ? '目标方向' : '当前目标'} · ${Math.round(distance(p, journeyTarget(w).point))}`;
    c.strokeText(label, x, y + 37);
    c.fillText(label, x, y + 37);
  }
  c.restore();
}
