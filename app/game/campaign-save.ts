import type { SpaceState, ExpeditionRecord } from './space.ts';
import type { World } from './simulation.ts';
import type { ColonyState } from './colony.ts';
import { upgradeCampaign } from './save-upgrade.ts';
import type { TribeState } from './tribe.ts';
import type { CivilizationState } from './civilization.ts';
export type CampaignSnapshot = {
  biologicalRecords?: import('./biological-finale.ts').BiologicalRecord[];
  journey: World;
  colony: { checkpoint: ColonyState; current: ColonyState } | null;
  tribe?: { checkpoint: TribeState; current: TribeState } | null;
  city?: { checkpoint: CivilizationState; current: CivilizationState } | null;
  space?: { checkpoint: SpaceState; current: SpaceState } | null;
  records?: ExpeditionRecord[];
  active: 'journey' | 'colony' | 'tribe' | 'city' | 'space';
};
export type SaveEnvelope = {
  version: 5;
  savedAt: number;
  campaign: CampaignSnapshot;
};
export const SAVE_KEY = 'spore.campaign.v1',
  BACKUP_KEY = 'spore.campaign.backup.v1';
export const MIGRATION_BACKUP_KEY = 'spore.campaign.pre-v5';
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ReadSave =
  | { kind: 'ok' | 'recovered'; save: SaveEnvelope }
  | { kind: 'empty' | 'invalid' | 'unsupported' | 'unavailable' };
export function decodeSave(raw: string | null): ReadSave {
  if (raw === null) return { kind: 'empty' };
  try {
    if (raw.length > 2_000_000) return { kind: 'invalid' };
    const v: unknown = JSON.parse(raw, (key, value: unknown) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('Invalid save key');
      return value;
    });
    if (!v || typeof v !== 'object' || !('version' in v))
      return { kind: 'invalid' };
    if (![1, 2, 3, 4, 5].includes(v.version as number))
      return { kind: 'unsupported' };
    const c = upgradeCampaign(v);
    if (!c) return { kind: 'invalid' };
    // Keep the original storage key, but upgrade the envelope so older clients
    // cannot silently overwrite newly introduced chapters.
    return {
      kind: 'ok',
      save: {
        savedAt: (v as SaveEnvelope).savedAt,
        version: 5,
        campaign: c,
      },
    };
  } catch {
    return { kind: 'invalid' };
  }
}
export function encodeSave(campaign: CampaignSnapshot, now = Date.now()) {
  const raw = JSON.stringify({ version: 5, savedAt: now, campaign });
  if (decodeSave(raw).kind !== 'ok') throw new Error('当前进度不能安全保存');
  return raw;
}
export function readCampaignSave(storage: SaveStorage): ReadSave {
  try {
    const primary = decodeSave(storage.getItem(SAVE_KEY));
    // A future format must not be silently replaced by an older backup.
    if (primary.kind === 'ok' || primary.kind === 'unsupported') return primary;
    const backup = decodeSave(storage.getItem(BACKUP_KEY));
    return backup.kind === 'ok'
      ? { kind: 'recovered', save: backup.save }
      : primary;
  } catch {
    return { kind: 'unavailable' };
  }
}
export function writeCampaignSave(
  storage: SaveStorage,
  campaign: CampaignSnapshot,
  now = Date.now(),
) {
  try {
    const raw = encodeSave(campaign, now),
      previous = storage.getItem(SAVE_KEY);
    if (decodeSave(previous).kind === 'unsupported') return false;
    const previousResult = decodeSave(previous);
    const backup =
      previousResult.kind === 'ok' ? null : storage.getItem(BACKUP_KEY);
    const original =
      previousResult.kind === 'ok'
        ? previous
        : decodeSave(backup).kind === 'ok'
          ? backup
          : null;
    if (
      original &&
      JSON.parse(original).version < 5 &&
      storage.getItem(MIGRATION_BACKUP_KEY) === null
    ) {
      storage.setItem(MIGRATION_BACKUP_KEY, original);
      // A nonthrowing storage shim can still fail to retain bytes. Do not proceed.
      if (storage.getItem(MIGRATION_BACKUP_KEY) !== original) return false;
    }
    if (previous && decodeSave(previous).kind === 'ok')
      storage.setItem(BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
export function pausedCampaign(source: CampaignSnapshot): CampaignSnapshot {
  const copy = structuredClone(source);
  copy.journey.evolution ??= null;
  if (['running', 'evolving'].includes(copy.journey.mode))
    copy.journey.mode = 'paused';
  if (copy.colony?.current.mode === 'running')
    copy.colony.current.mode = 'paused';
  if (copy.tribe?.current.mode === 'running')
    copy.tribe.current.mode = 'paused';
  if (copy.city?.current.mode === 'running') copy.city.current.mode = 'paused';
  if (copy.space?.current.mode === 'running')
    copy.space.current.mode = 'paused';
  return copy;
}
