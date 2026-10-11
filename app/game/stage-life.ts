/** A milestone is earned once. Staying keeps the real simulation and its costs. */
export type StageLife = {
  mode: string;
  freeLife?: boolean;
  player?: { x: number; y: number; health?: number };
};
export function continueStageLife(s: StageLife): boolean {
  if (
    s.mode !== 'won' ||
    (s.player?.health !== undefined && s.player.health <= 0)
  )
    return false;
  s.freeLife = true;
  s.mode = 'running';
  return true;
}
export function reviewStageLife(s: StageLife): boolean {
  if (
    !s.freeLife ||
    !['running', 'paused'].includes(s.mode) ||
    (s.player?.health !== undefined && s.player.health <= 0)
  )
    return false;
  s.mode = 'won';
  return true;
}
