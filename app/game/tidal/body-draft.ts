import type { BodyDesign, Organ } from '../body-design.ts';
import { listOrgans, validateLayout } from '../body-layout.ts';
import type { Mount } from '../body-layout.ts';
/** All editing is on detached drafts; game resources are only changed by commitBody. */
export function bodyDraft(body: BodyDesign): BodyDesign {
  return { ...structuredClone(body), placements: listOrgans(body) };
}
function nextId(body: BodyDesign) {
  let n = 1;
  while (listOrgans(body).some((p) => p.id === `edit-${n}`)) n++;
  return `edit-${n}`;
}
export function placeDraftOrgan(
  body: BodyDesign,
  organ: Organ,
  mount: Mount,
  t: number,
): BodyDesign {
  const next = bodyDraft(body);
  const occupied = next.placements!.find((p) => p.mount === mount && p.t === t);
  if (occupied) occupied.organ = organ;
  else next.placements!.push({ id: nextId(next), organ, mount, t });
  return validateLayout(next) ? bodyDraft(body) : next;
}
export function moveDraftOrgan(
  body: BodyDesign,
  id: string,
  mount: Mount,
  t: number,
): BodyDesign {
  const next = bodyDraft(body),
    part = next.placements!.find((p) => p.id === id);
  if (!part) return next;
  part.mount = mount;
  part.t = t;
  return validateLayout(next) ? bodyDraft(body) : next;
}
export function mirrorDraftOrgan(body: BodyDesign, id: string): BodyDesign {
  const part = listOrgans(body).find((p) => p.id === id);
  if (!part || !['left', 'right'].includes(part.mount)) return bodyDraft(body);
  const mount = part.mount === 'left' ? 'right' : 'left';
  if (listOrgans(body).some((p) => p.mount === mount && p.t === part.t))
    return bodyDraft(body);
  return placeDraftOrgan(body, part.organ, mount, part.t);
}
