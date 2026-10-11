import type { World } from '../simulation.ts';
import { distance } from '../simulation.ts';
export type TidalAudioScene = 'explore' | 'danger' | 'migration' | 'evolution';
export function tidalSoundScene(w: World): TidalAudioScene {
  if (w.ocean?.morph) return 'evolution';
  if (
    w.ocean?.tidal?.actors.some(
      (a) =>
        a.health > 0 && a.behavior === 'ambush' && distance(a, w.player) < 250,
    )
  )
    return 'danger';
  if (w.ocean?.tier === 2 && w.ocean.tidal?.migration.startedTick !== null)
    return 'migration';
  return 'explore';
}
