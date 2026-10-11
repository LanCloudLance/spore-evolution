import type { Organ } from '../body-design.ts';
import type { World, Vec } from '../simulation.ts';

export type BiomeId =
  | 'nursery'
  | 'reef'
  | 'drift'
  | 'estuary'
  | 'kelp'
  | 'vent';
export type SpeciesId =
  | 'silver-dart'
  | 'thinwing'
  | 'fanworm'
  | 'thornpuffer'
  | 'shellsnail'
  | 'sand-eel'
  | 'scavenger-shrimp'
  | 'moss-crab'
  | 'ribbonfish'
  | 'lantern-drifter'
  | 'crested-hunter'
  | 'great-ray'
  | 'glass-minnow'
  | 'pipe-seahorse'
  | 'burrow-crab'
  | 'siphon-jelly'
  | 'brush-ray'
  | 'vent-tube';
export type Behavior =
  | 'forage'
  | 'flee'
  | 'defend'
  | 'ambush'
  | 'digest'
  | 'home'
  | 'carry'
  | 'follow';
export type SignalKind =
  | 'feed'
  | 'filter'
  | 'defend'
  | 'carry'
  | 'drop'
  | 'flee'
  | 'shoal-avoid'
  | 'ribbon-leg'
  | 'reserve-use'
  | 'companion-arrive';
export type FoodKind = 'plankton' | 'algae' | 'scrap';
export type TidalAction =
  | 'form-skill'
  | 'filter'
  | 'shell'
  | 'grasp'
  | 'reserve'
  | 'ink'
  | 'anchor';
export type TidalCommand = { id: number; kind: 'slot0' | 'slot1' | 'interact' };
export type TidalActor = Vec & {
  id: string;
  species: SpeciesId;
  homeBiome: BiomeId;
  radius: number;
  angle: number;
  hunger: number;
  health: number;
  behavior: Behavior;
  targetId: string | null;
  phaseSeconds: number;
  respawnSeconds: number;
  trust: number;
  carryingId: string | null;
};
export type TidalFood = Vec & {
  offeredBy?: string;
  reservedFor?: string;
  id: string;
  kind: FoodKind;
  energy: number;
  biome: BiomeId;
  owner: string | null;
  state: 'available' | 'carried' | 'consumed';
  regrowSeconds: number;
};
export type TidalSignal = {
  seq: number;
  tick: number;
  kind: SignalKind;
  actorId: string | null;
  targetId: string | null;
  point: Vec;
  amount: number;
};
export type TidalEvent = 'food-shift' | 'hunter-visit' | 'spring-tide';
export type TidalLegacy = {
  id: string;
  refuge: true;
  companions: string[];
  diet: ('hunt' | 'filter' | 'reserve' | 'symbiosis')[];
  entry: 'sheltered' | 'channel';
  generation: number;
};
export type TidalState = {
  version: 1;
  rng: number;
  tick: number;
  nextSeq: number;
  nextEntityId: number;
  regions: Record<
    BiomeId,
    {
      harvestPressure?: number;
      bond?: number;
      foodStock: number;
      alert: number;
      recoverySeconds: number;
      populations: Partial<Record<SpeciesId, number>>;
    }
  >;
  actors: TidalActor[];
  foods: TidalFood[];
  abilities: {
    inkCooldown?: number;
    inkSeconds?: number;
    anchored?: boolean;
    slots: [TidalAction | null, TidalAction | null];
    shellSeconds: number;
    shellCooldown: number;
    reserveEnergy: number;
    reserveCooldown: number;
    filterOpen: boolean;
    carriedId: string | null;
    lastCommandId: number;
  };
  journal: {
    seen: SpeciesId[];
    evidence: Partial<Record<Organ, number>>;
    claimed: Organ[];
  };
  events: {
    active: TidalEvent | null;
    phase: 'idle' | 'warning' | 'active' | 'recover';
    seconds: number;
    lastStrongTick: number;
    completed: string[];
  };
  migration: {
    startedTick: number | null;
    visited: BiomeId[];
    gains: {
      hunt: number;
      filter: number;
      reserve: number;
      symbiosis?: number;
    };
    refuge: boolean;
    companions: string[];
    entry: 'sheltered' | 'channel';
  };
  compat: {
    mode: 'new' | 'pending' | 'active' | 'completed-legacy';
    legacyStations: 0 | 1 | 2;
    legacyLegs: ('hunt' | 'filter')[];
  };
  safeCheckpoint: TidalSafeCheckpoint | null;
};
export type TidalSafeCheckpoint = Omit<World, 'ocean'> & {
  ocean: Omit<NonNullable<World['ocean']>, 'tidal'> & {
    tidal: Omit<TidalState, 'safeCheckpoint'>;
  };
};

/** Bounded ecology, with room for player-funded symbiosis gifts. */
export const TIDAL_FOOD_LIMIT = 144;
