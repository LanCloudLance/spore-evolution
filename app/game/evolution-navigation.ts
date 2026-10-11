import type { World } from './simulation.ts';
import type { Navigation } from './navigation.ts';
/** A menu action explicitly means playing, even when the menu was opened from a paused save. */
export function beginGuidedAction(
  w: World,
  destination: Omit<Navigation, 'last' | 'stalled' | 'path'>,
): Navigation | null {
  if (
    !['running', 'paused', 'evolving'].includes(w.mode) ||
    w.player.health <= 0 ||
    !Number.isFinite(destination.target.x) ||
    !Number.isFinite(destination.target.y)
  )
    return null;
  w.mode = 'running';
  return {
    ...structuredClone(destination),
    last: { x: w.player.x, y: w.player.y },
    stalled: 0,
  };
}
export function restorePanelMode(w: World, previous: World['mode']) {
  if (w.mode === 'paused' || w.mode === 'evolving')
    w.mode = previous === 'running' ? 'running' : 'paused';
}
