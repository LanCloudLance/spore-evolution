import type { CampaignSnapshot } from './campaign-save.ts';
import { createSaveGuards } from './save-schema.ts';
import { FORMS } from './forms.ts';
import type { BodyForm } from './forms.ts';
import { createTidalState } from './tidal/state.ts';
import type { BodyDesign } from './body-design.ts';

const guards = { 4: createSaveGuards(4), 5: createSaveGuards(5) };
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function validCampaign(
  c: unknown,
  version: 4 | 5,
): c is CampaignSnapshot {
  if (!object(c)) return false;
  const g = guards[version];
  return (
    ['journey', 'colony', 'tribe', 'city', 'space'].includes(
      c.active as string,
    ) &&
    g.validWorld(c.journey) &&
    g.validColonySlot(c.colony) &&
    g.validTribeSlot(c.tribe) &&
    g.validCitySlot(c.city) &&
    g.validSpaceSlot(c.space) &&
    g.validExpeditions(c.records) &&
    g.validBiologicalRecords(c.biologicalRecords) &&
    !(c.active === 'space' && (!c.space || !c.city || !c.tribe || !c.colony)) &&
    !(c.active === 'city' && (!c.city || !c.tribe || !c.colony)) &&
    !(c.active === 'tribe' && (!c.tribe || !c.colony)) &&
    !(c.active === 'colony' && !c.colony)
  );
}
/** Original schema first, detached upgrade second. No storage or simulated rewards. */
export function upgradeCampaign(envelope: unknown): CampaignSnapshot | null {
  if (
    !object(envelope) ||
    ![1, 2, 3, 4, 5].includes(envelope.version as number) ||
    !Number.isFinite(envelope.savedAt) ||
    !validCampaign(envelope.campaign, envelope.version === 5 ? 5 : 4)
  )
    return null;
  const c = structuredClone(envelope.campaign);
  c.tribe ??= null;
  c.city ??= null;
  c.space ??= null;
  c.records ??= [];
  if (envelope.version === 5) return c;
  // Each ancestor uses its own form/traits; never repaint the whole lineage as its adult.
  function visit(
    value: unknown,
    inheritedForm: BodyForm = 'microbe',
    inheritedTraits: unknown[] = [],
  ): void {
    if (Array.isArray(value)) {
      value.forEach((x) => visit(x, inheritedForm, inheritedTraits));
      return;
    }
    if (!object(value)) return;
    const form = Object.hasOwn(FORMS, String(value.form))
      ? (value.form as BodyForm)
      : inheritedForm;
    const traits = Array.isArray(value.traits) ? value.traits : inheritedTraits;
    for (const [key, child] of Object.entries(value)) {
      if (
        (key === 'body' || key === 'fromBody') &&
        object(child) &&
        object(child.organs)
      ) {
        const body = child as BodyDesign;
        const bodyForm =
          key === 'fromBody' && Object.hasOwn(FORMS, String(value.from))
            ? (value.from as BodyForm)
            : form;
        body.appearance = {
          base: FORMS[bodyForm].color,
          accent: traits.includes('chloroplast')
            ? '#9ce08f'
            : traits.includes('shell')
              ? '#d9c6f5'
              : '#d9ffee',
          pattern: traits.includes('spikes')
            ? 'spots'
            : traits.includes('cilia')
              ? 'bands'
              : 'plain',
        };
      } else visit(child, form, traits);
    }
  }
  visit(c);
  if (c.journey.ocean) {
    const o = c.journey.ocean,
      t = createTidalState(c.journey.seed);
    t.compat.mode = c.journey.mode === 'won' ? 'completed-legacy' : 'pending';
    t.compat.legacyStations = (o.migration?.station ?? 0) as 0 | 1 | 2;
    t.compat.legacyLegs = [...(o.migration?.legs ?? [])];
    o.tidal = t;
  }
  return validCampaign(c, 5) ? c : null;
}
