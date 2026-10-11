import { TIDAL_BIOMES } from './catalog.ts';
import type { TidalState } from './types.ts';

export function createTidalState(seed: number): TidalState {
  return {
    version: 1,
    rng: seed >>> 0,
    tick: 0,
    nextSeq: 1,
    nextEntityId: 1,
    regions: Object.fromEntries(
      TIDAL_BIOMES.map((b) => [
        b.id,
        { foodStock: b.foodCap, alert: 0, recoverySeconds: 0, populations: {} },
      ]),
    ) as TidalState['regions'],
    actors: [],
    foods: [],
    abilities: {
      slots: ['form-skill', null],
      shellSeconds: 0,
      shellCooldown: 0,
      reserveEnergy: 0,
      reserveCooldown: 0,
      filterOpen: false,
      carriedId: null,
      lastCommandId: 0,
    },
    journal: { seen: [], evidence: {}, claimed: [] },
    events: {
      active: null,
      phase: 'idle',
      seconds: 0,
      lastStrongTick: 0,
      completed: [],
    },
    migration: {
      startedTick: null,
      visited: [],
      gains: { hunt: 0, filter: 0, reserve: 0 },
      refuge: false,
      companions: [],
      entry: 'sheltered',
    },
    compat: { mode: 'new', legacyStations: 0, legacyLegs: [] },
    safeCheckpoint: null,
  };
}
