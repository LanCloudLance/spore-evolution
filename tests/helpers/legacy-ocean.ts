import {
  createOceanWorld as createOcean,
  enterOcean as enter,
} from '../../app/game/ocean.ts';
import type { OceanCheckpoint } from '../../app/game/forms.ts';
import type { World } from '../../app/game/simulation.ts';
/** Historical rule regression only. New campaign acceptance uses the public tidal default. */
export const createOceanWorld = (seed = 23, checkpoint?: OceanCheckpoint) =>
  createOcean(seed, checkpoint, 'legacy');
export const enterOcean = (w: World) => enter(w, 'legacy');
