import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { stepWorld } from '../app/game/simulation.ts';
import {
  ingestOceanDna,
  inheritedDnaOrgans,
} from '../app/game/dna-evolution.ts';
import {
  applyTidalCommand,
  availableTidalActions,
} from '../app/game/tidal/abilities.ts';
import { TIDAL_ORGANS } from '../app/game/tidal/catalog.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
void test('twelve ocean structures have real providers; warm spring sources open anchoring, glow and ink', () => {
  const w = createOceanWorld(23);
  stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(TIDAL_ORGANS.length, 12);
  ingestOceanDna(w, 'vent-tube', 'symbiosis');
  ingestOceanDna(w, 'siphon-jelly', 'symbiosis');
  const organs = inheritedDnaOrgans(w);
  assert.ok(organs.includes('anchor'));
  assert.ok(organs.includes('glow'));
  assert.ok(organs.includes('ink'));
});
void test('ink uses a paid, bounded real action; anchoring toggles without creating food or ancestor receipts', () => {
  const w = createOceanWorld(23);
  stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  w.ocean!.body.placements = [
    { id: 'mouth', organ: 'jaw', mount: 'front', t: 0 },
    { id: 'ink', organ: 'ink', mount: 'belly', t: 0 },
    { id: 'anchor', organ: 'anchor', mount: 'tail', t: 0 },
  ];
  w.ocean!.discovered.push('ink', 'anchor');
  w.ocean!.tidal!.abilities.slots = ['ink', 'anchor'];
  assert.ok(availableTidalActions(w).includes('ink'));
  const energy = w.player.energy,
    food = w.food;
  applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(w.player.energy, energy - 16);
  assert.equal(w.ocean!.tidal!.abilities.inkSeconds, 2);
  applyTidalCommand(w, { id: 2, kind: 'slot0' });
  assert.equal(w.player.energy, energy - 16);
  applyTidalCommand(w, { id: 3, kind: 'slot1' });
  assert.equal(w.ocean!.tidal!.abilities.anchored, true);
  assert.equal(w.food, food);
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
