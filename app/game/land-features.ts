import type { World, Vec } from './simulation.ts';
import { announce, distance } from './simulation.ts';
import { type LandFeature, isLandPredator } from './land-catalog.ts';
import { landWet, droughtDry } from './land-drought.ts';
import { strikePrey, inLandCover } from './land-hunt.ts';
export const hasLandFeature = (w: World, id: LandFeature) =>
  !!w.land?.features?.includes(id);
export const inFeatureShelter = (w: World) =>
  !!w.land?.camps?.some((c) => c.life > 0 && distance(c, w.player) < 90);
export function landFeatureGate(w: World): string | null {
  const s = w.land,
    id = s?.activeFeature;
  if (!s || !id || !hasLandFeature(w, id))
    return '先在下一代面板选择一种身体动作。';
  if (w.mode !== 'running' || s.morph || w.player.health <= 0)
    return '暂停或蜕变中，继续探索后使用。';
  if (!activeLandFeature(id)) return '这项结构会自动发挥作用，无需按 I。';
  if ((s.featureCooldown ?? 0) > 0)
    return `身体动作恢复中 · 等 ${Math.ceil(s.featureCooldown!)} 秒。`;
  if (id === 'cache')
    return !s.cachedFood && w.food < 3
      ? '储食需要 3 营养 · 先采集食物。'
      : null;
  if (id === 'burrow') {
    if (landWet(w, w.player)) return '湿地不能掘穴 · 移到干燥地面。';
    if (inFeatureShelter(w)) return '这里已有穴巢 · 移到别处再掘穴。';
    if ((s.camps?.length ?? 0) >= 3)
      return '已有 3 处穴巢 · 等一处消失后再筑。';
  }
  const cost = id === 'scent' ? 8 : 16;
  return w.player.energy < cost ? `需要 ${cost} 能量 · 先觅食恢复。` : null;
}
export function activateLandFeature(w: World) {
  const s = w.land,
    id = s?.activeFeature;
  // Frozen worlds must stay byte-for-byte unchanged, including notices.
  if (w.mode !== 'running' || s?.morph || w.player.health <= 0) return false;
  const blocked = landFeatureGate(w);
  if (blocked) {
    announce(w, blocked);
    return false;
  }
  if (!s || !id) return false;
  if (id === 'cache') {
    if (s.cachedFood) {
      s.cachedFood = 0;
      w.food += 3;
      announce(w, '取回亲手储存的3营养，补给没有增加。');
    } else {
      w.food -= 3;
      s.cachedFood = 3;
      announce(w, '储食袋装入3营养 · 再按 I 取回。');
    }
    s.featureCooldown = 2;
    return true;
  }
  const cost = id === 'scent' ? 8 : 16;
  w.player.energy -= cost;
  s.featureCooldown = 6;
  s.featureActive = 2;
  if (id === 'burrow') {
    (s.camps ??= []).push({ x: w.player.x, y: w.player.y, life: 180 });
    announce(w, '掘出短期穴巢 · 阴影减缓失水，水分不会凭空增加。');
  } else if (id === 'sift') {
    s.sifting = !s.sifting;
    announce(
      w,
      s.sifting
        ? '展开湿地摄食须 · 水边采食更广，移动变慢。'
        : '收拢摄食须，可以继续迁行。',
    );
  } else if (id === 'alarm' || id === 'horns') {
    for (const c of s.creatures)
      if (
        !c.joined &&
        c.respawn <= 0 &&
        isLandPredator(c.species) &&
        distance(c, w.player) < (id === 'alarm' ? 240 : 115) &&
        (id === 'alarm' ||
          Math.cos(
            Math.atan2(c.y - w.player.y, c.x - w.player.x) - w.player.angle,
          ) >= 0.5)
      ) {
        c.stun = 3;
        c.reaction = 1.5;
        if (id === 'horns') strikePrey(w, c, 45);
      }
    announce(
      w,
      id === 'alarm' ? '鸣声传开，近身威胁短暂退开。' : '长角击退面前的威胁。',
    );
  } else
    announce(
      w,
      id === 'scent'
        ? '气味指向残肉 · 金色轨迹会短暂显示。'
        : id === 'leap'
          ? '后足蓄力跃进！岩石仍会挡住身体。'
          : '侧膜展开，沿风滑行！',
    );
  return true;
}
export function stepLandFeatures(w: World, dt: number) {
  const s = w.land;
  if (!s || w.mode !== 'running' || s.morph) return;
  s.featureCooldown = Math.max(0, (s.featureCooldown ?? 0) - dt);
  s.featureActive = Math.max(0, (s.featureActive ?? 0) - dt);
  for (const c of s.camps ?? []) c.life -= dt;
  if (s.camps) s.camps = s.camps.filter((c) => c.life > 0);
  if (hasLandFeature(w, 'roots') && Math.hypot(w.player.vx, w.player.vy) < 25)
    for (const f of w.foods)
      if (distance(f, w.player) < 150)
        f.cooldown = Math.max(0, f.cooldown - dt * 0.8);
  if (
    hasLandFeature(w, 'dew') &&
    !droughtDry(w) &&
    (landWet(w, w.player) || inLandCover(w.player)) &&
    Math.hypot(w.player.vx, w.player.vy) < 25
  )
    s.moisture = Math.min(
      s.adaptations?.includes('reservoir') || s.protection === 'reservoir'
        ? 150
        : 100,
      s.moisture + dt * 2,
    );
  if (s.features?.length) s.features = [...new Set(s.features)].slice(0, 3);
}
export function landFeatureSpeed(w: World) {
  const s = w.land;
  return !s
    ? 1
    : s.sifting
      ? 0.55
      : (s.featureActive ?? 0) > 0 &&
          ['leap', 'glide'].includes(s.activeFeature ?? '')
        ? 1.65
        : 1;
}
export const activeLandFeature = (id: LandFeature) =>
  [
    'leap',
    'burrow',
    'glide',
    'cache',
    'alarm',
    'sift',
    'scent',
    'horns',
  ].includes(id);
export const landFeatureMetabolism = (ids: LandFeature[]) =>
  1 +
  ids.reduce(
    (cost, id) => cost + (['roots', 'glide'].includes(id) ? 0.12 : 0.03),
    0,
  );
export function drawLandFeatures(
  c: CanvasRenderingContext2D,
  p: Vec & { angle: number },
  radius: number,
  ids: LandFeature[],
  time: number,
) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.angle);
  c.strokeStyle = '#eff1b2';
  c.fillStyle = '#a6cb9488';
  c.lineWidth = 2;
  for (const [i, id] of ids.entries()) {
    c.save();
    const side = i % 2 ? 1 : -1;
    if (['thorns', 'horns', 'alarm'].includes(id)) {
      c.beginPath();
      c.moveTo(radius * 0.6, side * radius * 0.6);
      c.lineTo(radius * 1.6, side * radius * 0.7);
      c.lineTo(radius * 0.7, side * radius);
      c.closePath();
      c.fill();
      c.stroke();
    } else if (['glide', 'sift', 'dew'].includes(id)) {
      c.beginPath();
      c.ellipse(
        0,
        side * radius * 0.8,
        radius * 0.8,
        radius * 0.45 + Math.sin(time * 3) * 2,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.stroke();
    } else if (['leap', 'burrow', 'roots'].includes(id)) {
      c.beginPath();
      c.moveTo(-radius * 0.3, side * radius * 0.7);
      c.lineTo(-radius, side * radius * 1.35);
      c.lineTo(-radius * 0.5, side * radius * 1.5);
      c.stroke();
    } else {
      c.beginPath();
      c.ellipse(
        -radius * 0.5,
        side * radius * 0.65,
        radius * 0.35,
        radius * 0.35,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}
