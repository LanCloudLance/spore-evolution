export const TAP_DASH_SECONDS = 0.55;

/** Space and arrows on a focused control belong to that control, not the world. */
export function blocksGameInput(
  target: {
    isContentEditable?: boolean;
    closest: (selector: string) => unknown;
  } | null,
  key?: string,
) {
  if (!target) return false;
  if (
    target.isContentEditable ||
    target.closest(
      'input,select,textarea,dialog,[role="dialog"],[data-game-settings]',
    )
  )
    return true;
  return (
    !!target.closest('button,summary,a,[role="button"]') &&
    (!key || key === ' ' || key.startsWith('arrow') || key === 'enter')
  );
}

export const ACTION_KEYS = {
  skill: 'J',
  interact: 'K',
  command: 'L',
  learnedSkill: 'U',
  feature: 'I',
  evolve: 'O',
} as const;
const actionCodes: Record<string, string> = {
  KeyJ: 'q',
  KeyK: 'f',
  KeyL: 'r',
  KeyU: 'c',
  KeyI: 'g',
  KeyO: 'e',
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  ArrowUp: 'arrowup',
  ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft',
  ArrowRight: 'arrowright',
  Space: ' ',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  Escape: 'escape',
  F2: 'f2',
};
/** Physical keys keep WASD and the right-hand action bank usable across keyboard layouts. */
export function gameKey(event: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.code) return actionCodes[event.code] ?? null;
  const key = event.key.toLowerCase();
  if (key === ' ') return ' ';
  return (
    actionCodes[key.length === 1 ? `Key${key.toUpperCase()}` : event.key] ??
    (key === 'shift' ? 'shift' : key === 'escape' ? 'escape' : null)
  );
}
/** Old saved notices may still contain the former key labels. Translate at display time. */
export function keyHints(text: string) {
  const labels: Record<string, string> = {
    Q: ACTION_KEYS.skill,
    F: ACTION_KEYS.interact,
    R: ACTION_KEYS.command,
    C: ACTION_KEYS.learnedSkill,
    G: ACTION_KEYS.feature,
    E: ACTION_KEYS.evolve,
  };
  return text.replace(
    /(?<![A-Za-z0-9_])([QFRCGE])(?=$|[^A-Za-z0-9_])/g,
    (key) => labels[key],
  );
}

export type DashInput = { remaining: number };

export function pressDash(input: DashInput) {
  input.remaining = TAP_DASH_SECONDS;
}

// A quick down/up pair must survive until simulation consumes it.
export function consumeDash(
  input: DashInput,
  dt: number,
  held: boolean,
  active: boolean,
) {
  if (!active) {
    input.remaining = 0;
    return false;
  }
  const dash = held || input.remaining > 0;
  input.remaining = Math.max(0, input.remaining - dt);
  return dash;
}
/** One-shot actions wait for a simulation tick, even on displays faster than 120Hz. */
export function takeActionInput(held: Set<string>, simulationReady: boolean) {
  const action = {
    skill: simulationReady && held.has('q'),
    interact: simulationReady && held.has('f'),
    command: simulationReady && held.has('r'),
    feature: simulationReady && held.has('g'),
  };
  if (simulationReady) for (const key of ['q', 'f', 'r', 'g']) held.delete(key);
  return action;
}

export function takeLearnedSkillInput(held: Set<string>, ready: boolean) {
  if (!ready || !held.has('c')) return false;
  held.delete('c');
  return true;
}
