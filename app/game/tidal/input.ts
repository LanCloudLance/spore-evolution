import type { World } from '../simulation.ts';
import type { TidalCommand } from './types.ts';
/** DOM-independent edge queue. Restored command ids stay monotonic. */
export function createTidalControls() {
  const held = new Set<TidalCommand['kind']>();
  const pending: TidalCommand[] = [];
  let seq = 0;
  const ready = (w: World) =>
    w.mode === 'running' && !!w.ocean?.tidal && !w.ocean.morph;
  const clear = () => {
    held.clear();
    pending.length = 0;
  };
  const tap = (w: World, kind: TidalCommand['kind']) => {
    if (!ready(w) || pending.length >= 4) return false;
    seq = Math.max(seq, w.ocean!.tidal!.abilities.lastCommandId) + 1;
    pending.push({ id: seq, kind });
    return true;
  };
  return {
    tap,
    clear,
    release: (kind: TidalCommand['kind']) => held.delete(kind),
    press(w: World, kind: TidalCommand['kind']) {
      if (held.has(kind) || !tap(w, kind)) return false;
      held.add(kind);
      return true;
    },
    take(w: World) {
      if (!ready(w)) {
        clear();
        return undefined;
      }
      return pending.shift();
    },
  };
}
