import type { World } from '../simulation.ts';
import type { TidalLegacy } from './types.ts';
export function tidalLegacy(w: World): TidalLegacy | null {
  if (w.tidalLegacy) return structuredClone(w.tidalLegacy);
  const t = w.ocean?.tidal;
  if (!t?.migration.refuge) return null;
  return {
    id: `tidal:${w.seed}:${w.generation}`,
    refuge: true,
    companions: [...t.migration.companions],
    diet: [
      ...new Set([
        ...(['hunt', 'filter', 'reserve', 'symbiosis'] as const).filter(
          (k) => (t.migration.gains[k] ?? 0) > 0,
        ),
        ...t.compat.legacyLegs,
      ]),
    ],
    entry: t.migration.entry,
    generation: w.generation,
  };
}
