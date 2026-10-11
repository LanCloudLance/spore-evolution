import {
  biologicalRecord,
  branchBiological,
  type BiologicalRecord,
} from './biological-finale.ts';
import { createWorld } from './simulation.ts';
import type { TraitId } from './simulation.ts';
import { spaceFromCivilization, expeditionRecord } from './space.ts';
import type { SpaceState, ExpeditionRecord } from './space.ts';
import { pausedCampaign } from './campaign-save.ts';
import type { CampaignSnapshot } from './campaign-save.ts';
import { createGameStore } from './store.ts';
import type { ColonyState } from './colony.ts';
import { tribeFromColony } from './tribe.ts';
import type { TribeState } from './tribe.ts';
import { civilizationFromTribe } from './civilization.ts';
import type { CivilizationState } from './civilization.ts';
/** Keep the journey and chapter checkpoint alive while their UI is unmounted. */
export function createCampaignSession() {
  const journey = createGameStore();
  let colony: { checkpoint: ColonyState; current: ColonyState } | null = null;
  let tribe: { checkpoint: TribeState; current: TribeState } | null = null;
  let city: {
    checkpoint: CivilizationState;
    current: CivilizationState;
  } | null = null;
  let space: { checkpoint: SpaceState; current: SpaceState } | null = null;
  let records: ExpeditionRecord[] = [];
  let biologicalRecords: BiologicalRecord[] = [];
  return {
    journey,
    snapshot(active: CampaignSnapshot['active']): CampaignSnapshot {
      const currentJourney = structuredClone(journey.getWorld());
      if (!currentJourney.tidalLegacy) delete currentJourney.tidalLegacy;
      if (!currentJourney.dnaLineage) delete currentJourney.dnaLineage;
      if (!currentJourney.learning) delete currentJourney.learning;
      if (!currentJourney.pondLife) delete currentJourney.pondLife;
      return {
        journey: currentJourney,
        colony: colony ? structuredClone(colony) : null,
        tribe: tribe ? structuredClone(tribe) : null,
        city: city ? structuredClone(city) : null,
        space: space ? structuredClone(space) : null,
        records: structuredClone(records),
        biologicalRecords: structuredClone(biologicalRecords),
        active,
      };
    },
    restore(snapshot: CampaignSnapshot) {
      const restored = pausedCampaign(snapshot);
      Object.assign(journey.getWorld(), restored.journey, {
        freeLife: restored.journey.freeLife ?? false,
        learning: restored.journey.learning,
        dnaLineage: restored.journey.dnaLineage,
        pondLife: restored.journey.pondLife,
        tidalLegacy: restored.journey.tidalLegacy,
      });
      colony = restored.colony;
      tribe = restored.tribe ?? null;
      city = restored.city ?? null;
      space = restored.space ?? null;
      records = restored.records ?? [];
      biologicalRecords = restored.biologicalRecords ?? [];
      journey.publish();
      return restored.active;
    },
    updateColony(current: ColonyState) {
      if (colony)
        colony.current = {
          ...structuredClone(current),
          ...(colony.current.archiveId
            ? { archiveId: colony.current.archiveId }
            : {}),
        };
    },
    startColony(checkpoint: ColonyState) {
      tribe = null;
      city = null;
      space = null;
      colony = {
        checkpoint: structuredClone(checkpoint),
        current: structuredClone(checkpoint),
      };
    },
    leaveColony(current: ColonyState) {
      if (!colony) return;
      colony.current = {
        ...structuredClone(current),
        ...(colony.current.archiveId
          ? { archiveId: colony.current.archiveId }
          : {}),
      };
      if (colony.current.mode === 'running') colony.current.mode = 'paused';
    },
    getColony: () => (colony ? structuredClone(colony) : null),
    startTribe() {
      if (!colony || colony.current.mode !== 'won') return false;
      if (tribe) return true;
      const next = tribeFromColony(colony.current);
      if (!next) return false;
      tribe = { checkpoint: structuredClone(next), current: next };
      return true;
    },
    updateTribe(current: TribeState) {
      if (tribe) tribe.current = structuredClone(current);
    },
    leaveTribe(current: TribeState) {
      if (!tribe) return;
      tribe.current = structuredClone(current);
      if (tribe.current.mode === 'running') tribe.current.mode = 'paused';
    },
    getTribe: () => (tribe ? structuredClone(tribe) : null),
    startCity() {
      if (!tribe || tribe.current.mode !== 'won') return false;
      if (city) return true;
      const next = civilizationFromTribe(tribe.current);
      if (!next) return false;
      city = { checkpoint: structuredClone(next), current: next };
      return true;
    },
    updateCity(current: CivilizationState) {
      if (city) city.current = structuredClone(current);
    },
    leaveCity(current: CivilizationState) {
      if (!city) return;
      city.current = structuredClone(current);
      if (city.current.mode === 'running') city.current.mode = 'paused';
    },
    getCity: () => (city ? structuredClone(city) : null),
    startSpace() {
      if (!city || city.current.mode !== 'won') return false;
      if (space) return true;
      const next = spaceFromCivilization(city.current);
      if (!next) return false;
      space = { checkpoint: structuredClone(next), current: next };
      return true;
    },
    updateSpace(current: SpaceState) {
      if (space) space.current = structuredClone(current);
    },
    leaveSpace(current: SpaceState) {
      if (!space) return;
      space.current = structuredClone(current);
      if (space.current.mode === 'running') space.current.mode = 'paused';
    },
    getSpace: () => (space ? structuredClone(space) : null),
    getBiologicalRecords: () => structuredClone(biologicalRecords),
    finishBiological() {
      if (!colony || colony.current.archiveId) return false;
      const record = biologicalRecord(
        colony.current,
        Math.max(0, ...biologicalRecords.map((r) => r.id)) + 1,
      );
      if (!record) return false;
      biologicalRecords.push(record);
      biologicalRecords = biologicalRecords.slice(-12);
      colony.current.archiveId = record.id;
      return true;
    },
    branchBiological(
      id: number,
      generation: number,
      seed = Date.now() % 1000000,
    ) {
      const record = biologicalRecords.find((r) => r.id === id);
      if (!record) return false;
      const next = branchBiological(record, generation, seed);
      if (!next) return false;
      Object.assign(
        journey.getWorld(),
        {
          freeLife: false,
          evolution: null,
          dnaLineage: undefined,
          learning: undefined,
          pondLife: undefined,
          tidalLegacy: undefined,
        },
        next,
      );
      colony = null;
      tribe = null;
      city = null;
      space = null;
      journey.publish();
      return true;
    },
    getRecords: () => structuredClone(records),
    newJourney(trait?: TraitId, seed = Date.now() % 1000000) {
      if (!space || space.current.mode !== 'won') return false;
      const known = new Set([
        ...space.current.traits,
        ...space.current.history.flatMap((a) => a.traits),
      ]);
      if (trait && !known.has(trait)) return false;
      const record = expeditionRecord(
        space.current,
        Math.max(0, ...records.map((r) => r.id)) + 1,
      );
      if (!record) return false;
      records.push(record);
      Object.assign(journey.getWorld(), createWorld(seed));
      if (trait) journey.getWorld().traits = [trait];
      colony = null;
      tribe = null;
      city = null;
      space = null;
      journey.publish();
      return true;
    },
  };
}
