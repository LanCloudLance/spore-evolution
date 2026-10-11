import { createWorld } from './simulation.ts';
/** Canvas mutates the live simulation; React reads a stable immutable snapshot. */
export function createGameStore() {
  const world = createWorld(23);
  let snapshot = structuredClone(world);
  const listeners = new Set<() => void>();
  return {
    getWorld: () => world,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => snapshot,
    publish: () => {
      snapshot = structuredClone(world);
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
