import type { BodyDesign, Organ, Slot } from './body-design.ts';
import type { BodyPose } from './body-geometry.ts';

export type Mount = Slot | 'back' | 'belly';
export type OrganPlacement = {
  id: string;
  organ: Organ;
  mount: Mount;
  t: number;
};
export type BodyAppearance = {
  base: string;
  accent: string;
  pattern: 'plain' | 'bands' | 'spots';
};
export const ORGAN_COSTS: Record<Organ, number> = {
  jaw: 4,
  fin: 3,
  spine: 8,
  filter: 6,
  shell: 8,
  grasp: 6,
  lateral: 5,
  reserve: 7,
  sail: 7,
  ink: 8,
  glow: 5,
  anchor: 6,
};
export const ORGAN_MOUNTS: Record<Organ, readonly Mount[]> = {
  jaw: ['front', 'left', 'right', 'tail'],
  fin: ['left', 'right', 'tail'],
  spine: ['front', 'left', 'right', 'tail'],
  filter: ['front', 'left', 'right', 'tail'],
  shell: ['back', 'belly'],
  reserve: ['back', 'belly'],
  lateral: ['left', 'right'],
  grasp: ['front', 'left', 'right', 'belly'],
  sail: ['left', 'right', 'back'],
  ink: ['back', 'belly'],
  glow: ['front', 'left', 'right', 'back', 'belly'],
  anchor: ['tail', 'belly'],
};
export const MOUNT_NAMES: Record<Mount, string> = {
  front: '头部',
  left: '左侧',
  right: '右侧',
  tail: '尾部',
  back: '背部',
  belly: '腹部',
};
const oldSlots: Slot[] = ['front', 'left', 'right', 'tail'];
export const mountAngle = (mount: Mount) =>
  ({
    front: 0,
    left: -Math.PI / 2,
    right: Math.PI / 2,
    tail: Math.PI,
    back: -Math.PI / 2,
    belly: Math.PI / 2,
  })[mount];

/** Placements, even an empty array, take precedence over the legacy projection. */
export function listOrgans(body: BodyDesign): OrganPlacement[] {
  return body.placements
    ? body.placements.map((p) => ({ ...p }))
    : oldSlots.flatMap((mount) =>
        body.organs[mount]
          ? [{ id: `legacy-${mount}`, organ: body.organs[mount]!, mount, t: 0 }]
          : [],
      );
}
export const hasOrgan = (body: BodyDesign, organ: Organ) =>
  listOrgans(body).some((p) => p.organ === organ);

/** Local contact anchor, in the same 36-unit coordinates as the body renderer. */
export function localOrganAnchor(part: OrganPlacement) {
  const reach = part.organ === 'spine' ? 49 : part.organ === 'filter' ? 44 : 35;
  if (part.mount === 'back' || part.mount === 'belly')
    return { x: part.t * 24, y: part.mount === 'back' ? -8 : 8 };
  if (part.mount === 'front' || part.mount === 'tail')
    return { x: part.mount === 'front' ? reach : -reach, y: part.t * 16 };
  return { x: part.t * 27, y: part.mount === 'left' ? -reach : reach };
}
export function organAnchor(pose: BodyPose, part: OrganPlacement) {
  const local = localOrganAnchor(part),
    k = pose.size / 36;
  const x = local.x * k * (pose.body?.length ?? 1),
    y = local.y * k * (pose.body?.width ?? 1);
  return {
    x: pose.x + x * Math.cos(pose.angle) - y * Math.sin(pose.angle),
    y: pose.y + x * Math.sin(pose.angle) + y * Math.cos(pose.angle),
  };
}

export function validateLayout(body: BodyDesign): string | null {
  if (
    !Number.isFinite(body.length) ||
    !Number.isFinite(body.width) ||
    body.length < 0.8 ||
    body.length > 1.5 ||
    body.width < 0.7 ||
    body.width > 1.3
  )
    return '身体尺寸超出范围。';
  if (
    body.appearance !== undefined &&
    (!body.appearance ||
      typeof body.appearance !== 'object' ||
      !/^#[\da-f]{6}$/i.test(body.appearance.base) ||
      !/^#[\da-f]{6}$/i.test(body.appearance.accent) ||
      !['plain', 'bands', 'spots'].includes(body.appearance.pattern))
  )
    return '身体颜色或纹样无效。';
  if (body.placements === undefined) {
    return Object.entries(body.organs).some(
      ([slot, organ]) =>
        !oldSlots.includes(slot as Slot) || !Object.hasOwn(ORGAN_COSTS, organ!),
    )
      ? '旧身体布局无效。'
      : null;
  }
  if (!Array.isArray(body.placements)) return '器官布局无效。';
  if (body.placements.length > 8) return '最多安装八个器官。';
  const ids = new Set<string>(),
    anchors = new Set<string>();
  for (const p of body.placements) {
    if (
      !p ||
      typeof p.id !== 'string' ||
      !p.id.length ||
      p.id.length > 80 ||
      ids.has(p.id)
    )
      return '器官编号重复或无效。';
    if (
      !Number.isFinite(p.t) ||
      Math.abs(p.t) > 1 ||
      !ORGAN_MOUNTS[p.organ]?.includes(p.mount)
    )
      return '器官不能安装在这个位置。';
    const key = `${p.mount}:${p.t}`;
    if (anchors.has(key)) return '两个器官不能占用同一锚点。';
    ids.add(p.id);
    anchors.add(key);
  }
  return null;
}
export const installedCost = (body: BodyDesign) =>
  listOrgans(body).reduce((sum, p) => sum + ORGAN_COSTS[p.organ], 0);
export const editCost = (before: BodyDesign, after: BodyDesign) =>
  8 + Math.max(0, installedCost(after) - installedCost(before));
/** IDs are stable references, not an extra paid change. Ordering and stale slots have no meaning. */
export function layoutSignature(body: BodyDesign) {
  return JSON.stringify(
    listOrgans(body)
      .map(({ organ, mount, t }) => ({ organ, mount, t }))
      .sort(
        (a, b) =>
          a.mount.localeCompare(b.mount) ||
          a.t - b.t ||
          a.organ.localeCompare(b.organ),
      ),
  );
}
