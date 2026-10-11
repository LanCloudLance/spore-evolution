/** Exact exponential velocity integration: responsive input with a short, frame-independent ease. */
export function glide(
  p: { x: number; y: number; vx: number; vy: number },
  x: number,
  y: number,
  dt: number,
  moving: boolean,
) {
  const tau = moving ? 0.035 : 0.025,
    k = Math.exp(-dt / tau);
  p.x += x * dt + (p.vx - x) * tau * (1 - k);
  p.y += y * dt + (p.vy - y) * tau * (1 - k);
  p.vx = x + (p.vx - x) * k;
  p.vy = y + (p.vy - y) * k;
}
export function face(angle: number, target: number, dt: number, rate = 16) {
  return (
    angle +
    Math.atan2(Math.sin(target - angle), Math.cos(target - angle)) *
      (1 - Math.exp(-rate * dt))
  );
}
