import type { Vec } from './simulation.ts';

/** NPC spacing only. Callers exclude feeding, attacks and player contacts before any movement. */
export function separateNeighbors<
  T extends Vec & { id: string | number; radius?: number },
>(
  bodies: T[],
  dt: number,
  eligible: (id: T['id']) => boolean,
  radius: (b: T) => number = (b) => b.radius ?? 25,
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const shifts = bodies.map(() => ({ x: 0, y: 0 })),
    allowed = bodies.map((b) => eligible(b.id));
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      if (!allowed[i] || !allowed[j]) continue;
      const a = bodies[i],
        b = bodies[j],
        d = Math.hypot(a.x - b.x, a.y - b.y),
        gap = (radius(a) + radius(b)) * 0.9;
      if (d >= gap) continue;
      const angle =
        d > 0
          ? Math.atan2(a.y - b.y, a.x - b.x)
          : String(a.id) < String(b.id)
            ? 0
            : Math.PI;
      const amount = (gap - d) * 0.12,
        dx = Math.cos(angle) * amount,
        dy = Math.sin(angle) * amount;
      shifts[i].x += dx;
      shifts[i].y += dy;
      shifts[j].x -= dx;
      shifts[j].y -= dy;
    }
  for (let i = 0; i < bodies.length; i++) {
    const v = shifts[i],
      d = Math.hypot(v.x, v.y),
      scale = d ? Math.min(1, (8 * Math.min(dt, 0.05)) / d) : 0;
    bodies[i].x += v.x * scale;
    bodies[i].y += v.y * scale;
  }
}

/** Unique trailing slots; keep every companion distinct even after the third joins. */
export function companionSlot(
  player: Vec & { angle: number },
  index: number,
): Vec {
  const row = Math.floor(index / 2),
    side = index % 2 ? 1 : -1;
  const back = 100 + row * 78,
    spread = 58 + row * 12;
  return {
    x:
      player.x -
      Math.cos(player.angle) * back -
      Math.sin(player.angle) * spread * side,
    y:
      player.y -
      Math.sin(player.angle) * back +
      Math.cos(player.angle) * spread * side,
  };
}

/** Screen-space outline and facing arrow remain readable through overlapping bodies. */
export function drawPlayerFocus(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
) {
  c.save();
  c.translate(x, y);
  c.beginPath();
  c.arc(0, 0, radius, 0, Math.PI * 2);
  c.strokeStyle = '#102a33';
  c.lineWidth = 5;
  c.stroke();
  c.strokeStyle = '#ecffe4';
  c.lineWidth = 1.7;
  c.stroke();
  c.rotate(angle);
  c.beginPath();
  c.moveTo(radius + 12, 0);
  c.lineTo(radius + 2, -6);
  c.lineTo(radius + 2, 6);
  c.closePath();
  c.fillStyle = '#ecffe4';
  c.strokeStyle = '#102a33';
  c.lineWidth = 3;
  c.stroke();
  c.fill();
  c.restore();
}
