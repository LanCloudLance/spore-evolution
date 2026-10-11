import { createOceanWorld } from '../../app/game/ocean.ts';
import { createTidalState } from '../../app/game/tidal/state.ts';
import { TIDAL_BIOMES, TIDAL_ORGANS } from '../../app/game/tidal/catalog.ts';
import type { BiomeId } from '../../app/game/tidal/types.ts';
import type { Organ } from '../../app/game/body-design.ts';

/** Artificial local fixture for individual mechanics, never evidence of a completed journey. */
export function tidalFixture(
  options: { mature?: boolean; organs?: Organ[]; at?: BiomeId } = {},
) {
  const w = createOceanWorld(23);
  w.mode = 'running';
  const o = w.ocean!;
  o.tidal = createTidalState(23);
  o.tidal.compat.mode = 'active';
  const biome = TIDAL_BIOMES.find((b) => b.id === (options.at ?? 'nursery'))!;
  w.player.x = biome.x;
  w.player.y = biome.y;
  if (options.mature) {
    w.form = 'fish';
    o.tier = 2;
    o.branch = 'bilateral';
    o.biomass = 65;
  }
  if (options.organs) {
    const occupied = new Set<string>();
    o.discovered = [...new Set(options.organs)];
    o.body.placements = options.organs.map((organ, i) => {
      const mounts = TIDAL_ORGANS.find((p) => p.id === organ)!.mounts;
      const anchor = mounts
        .flatMap((mount) => [0, -0.5, 0.5, -1, 1].map((t) => ({ mount, t })))
        .find((p) => !occupied.has(`${p.mount}:${p.t}`))!;
      occupied.add(`${anchor.mount}:${anchor.t}`);
      return {
        id: `fixture-${i}`,
        organ,
        ...anchor,
      };
    });
  }
  return w;
}
