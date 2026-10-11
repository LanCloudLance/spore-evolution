import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIDAL_BIOMES,
  TIDAL_SPECIES,
  TIDAL_ORGANS,
} from '../app/game/tidal/catalog.ts';
import { createTidalState } from '../app/game/tidal/state.ts';
import { validateLayout } from '../app/game/body-layout.ts';

void test('catalog has six connected habitats, eighteen distinct ecological roles and twelve installable organs', () => {
  assert.equal(TIDAL_BIOMES.length, 6);
  assert.equal(TIDAL_SPECIES.length, 18);
  assert.equal(TIDAL_ORGANS.length, 12);
  const biomes = new Set(TIDAL_BIOMES.map((b) => b.id));
  const species = new Set(TIDAL_SPECIES.map((s) => s.id));
  assert.equal(species.size, 18);
  assert.equal(new Set(TIDAL_SPECIES.map((s) => s.silhouette)).size, 18);
  for (const b of TIDAL_BIOMES) {
    assert.ok(b.neighbors.length > 0);
    assert.ok(b.foodCap > 0);
    for (const neighbor of b.neighbors) {
      assert.ok(biomes.has(neighbor));
      assert.ok(
        TIDAL_BIOMES.find((x) => x.id === neighbor)!.neighbors.includes(b.id),
      );
    }
  }
  const reached = new Set<string>();
  function visit(id: string) {
    if (reached.has(id)) return;
    reached.add(id);
    TIDAL_BIOMES.find((b) => b.id === id)!.neighbors.forEach(visit);
  }
  visit('nursery');
  assert.equal(reached.size, 6);
  for (const s of TIDAL_SPECIES) {
    assert.ok(biomes.has(s.biome));
    assert.ok(s.radius > 0);
    assert.ok(s.speed >= 0);
    assert.ok(s.diet.length > 0);
    assert.ok(s.behavior);
    assert.ok(s.mechanism);
  }
  for (const o of TIDAL_ORGANS) {
    assert.ok(o.cost > 0);
    assert.ok(o.mounts.length > 0);
    if (o.source) {
      assert.ok(species.has(o.source.species));
      assert.equal(
        TIDAL_SPECIES.find((s) => s.id === o.source!.species)!.evidence,
        o.source.signal,
      );
    }
    for (const mount of o.mounts) {
      assert.equal(
        validateLayout({
          length: 1,
          width: 1,
          organs: {},
          placements: [{ id: 'test', organ: o.id, mount, t: 0 }],
        }),
        null,
      );
    }
  }
});

void test('tidal initial state is deterministic, JSON-only and independent between worlds', () => {
  const a = createTidalState(23),
    b = createTidalState(23);
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.notDeepEqual(createTidalState(71), a);
  assert.deepEqual(a.actors, []);
  assert.deepEqual(a.foods, []);
  assert.deepEqual(a.abilities.slots, ['form-skill', null]);
  a.regions.reef.foodStock = 0;
  a.journal.claimed.push('shell');
  assert.ok(b.regions.reef.foodStock > 0);
  assert.deepEqual(b.journal.claimed, []);
  assert.equal(a.safeCheckpoint, null);
});
