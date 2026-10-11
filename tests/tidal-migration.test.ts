import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { stepTidalEvents } from '../app/game/tidal/events.ts';
import {
  tidalExitGate,
  settleTidalRefuge,
  saveTidalCheckpoint,
  retryTidal,
} from '../app/game/tidal/migration.ts';
import {
  stepTidalAbilities,
  applyTidalCommand,
} from '../app/game/tidal/abilities.ts';
import { organZones, worldBodyPose } from '../app/game/body-geometry.ts';
import { tidalIntent } from '../app/game/tidal/behavior.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
void test('arrival alone, legacy selection and copied signals never earn a refuge', () => {
  const w = tidalFixture({ at: 'estuary' }),
    before = structuredClone(w);
  assert.ok(tidalExitGate(w));
  assert.equal(settleTidalRefuge(w), false);
  assert.deepEqual(w, before);
  w.ocean!.tier = 2;
  w.ocean!.tidal!.migration.startedTick = 0;
  w.ocean!.tidal!.migration.visited = ['reef', 'drift'];
  w.food = 4;
  w.ocean!.tidal!.tick = 90 * 120;
  assert.ok(tidalExitGate(w));
  assert.equal(settleTidalRefuge(w), false);
});
void test('actual hunt/filter/reserve supply and both regions allow one paid tidal refuge', () => {
  for (const route of ['hunt', 'filter', 'reserve'] as const) {
    const w = tidalFixture({
        mature: true,
        at: 'drift',
        organs:
          route === 'filter'
            ? ['filter']
            : route === 'reserve'
              ? ['jaw', 'reserve']
              : ['jaw'],
      }),
      o = w.ocean!,
      t = o.tidal!;
    t.migration.startedTick = 0;
    t.migration.visited = ['reef', 'drift'];
    t.tick = 90 * 120;
    w.food = 4;
    let signals;
    if (route === 'reserve') {
      t.abilities.slots = ['reserve', null];
      t.abilities.reserveEnergy = 12;
      w.player.energy = 50;
      signals = applyTidalCommand(w, { id: 1, kind: 'slot0' });
    } else {
      const anchor = organZones(
        worldBodyPose(w),
        route === 'filter' ? 'filter' : 'jaw',
      )[0];
      if (route === 'filter') {
        t.abilities.filterOpen = true;
        t.foods = [
          {
            id: 'meal',
            ...anchor,
            energy: 8,
            kind: 'plankton',
            biome: 'drift',
            state: 'available',
            owner: null,
            regrowSeconds: 0,
          },
        ];
      } else
        t.actors = [
          {
            id: 'prey',
            species: 'silver-dart',
            homeBiome: 'drift',
            ...anchor,
            radius: 12,
            angle: 0,
            hunger: 0,
            health: 100,
            behavior: 'home',
            targetId: null,
            phaseSeconds: 0,
            respawnSeconds: 0,
            carryingId: null,
            trust: 0,
          },
        ];
      signals = stepTidalAbilities(w, 0.05);
    }
    stepTidalEvents(w, 0.05, structuredClone(signals));
    assert.equal(t.migration.gains[route], 0);
    stepTidalEvents(w, 0.05, signals);
    assert.ok(t.migration.gains[route] > 0);
    const gains = structuredClone(t.migration.gains);
    stepTidalEvents(w, 0.05, signals);
    assert.deepEqual(t.migration.gains, gains);
    w.player.x = 3060;
    w.player.y = 390;
    assert.equal(tidalExitGate(w), null);
    const food = w.food;
    assert.ok(settleTidalRefuge(w));
    assert.equal(w.food, food - 4);
    assert.equal(w.mode, 'won');
    assert.ok(t.migration.refuge);
    const once = structuredClone(w);
    assert.equal(settleTidalRefuge(w), false);
    assert.deepEqual(w, once);
  }
});
void test('earned legacy stations retain qualification, but no legacy evidence becomes an observed reward', () => {
  const w = tidalFixture({ mature: true, at: 'estuary' }),
    t = w.ocean!.tidal!;
  t.compat.legacyStations = 2;
  t.compat.legacyLegs = ['hunt', 'filter'];
  t.tick = 90 * 120;
  w.food = 4;
  assert.equal(tidalExitGate(w), null);
  assert.ok(settleTidalRefuge(w));
  assert.deepEqual(t.journal.claimed, []);
  assert.deepEqual(t.migration.gains, { hunt: 0, filter: 0, reserve: 0 });
});
void test('safe retry restores exact resources ecology and command sequence, merging only observed knowledge', () => {
  const w = tidalFixture({ organs: ['jaw'] }),
    t = w.ocean!.tidal!;
  w.food = 7;
  w.ocean!.dna = 21;
  t.abilities.lastCommandId = 8;
  saveTidalCheckpoint(w);
  assert.ok(t.safeCheckpoint);
  assert.equal(
    Object.hasOwn(t.safeCheckpoint!.ocean.tidal, 'safeCheckpoint'),
    false,
  );
  const original = structuredClone(w);
  w.player.health = 0;
  w.mode = 'dead';
  w.food = 90;
  w.ocean!.dna = 300;
  w.ocean!.discovered.push('filter');
  t.journal.seen.push('fanworm');
  const retry = retryTidal(w);
  assert.equal(retry.food, 7);
  assert.equal(retry.ocean!.dna, 21);
  assert.equal(retry.ocean!.tidal!.abilities.lastCommandId, 8);
  assert.deepEqual(retry.ocean!.tidal!.foods, original.ocean!.tidal!.foods);
  assert.ok(retry.ocean!.discovered.includes('filter'));
  assert.ok(retry.ocean!.tidal!.journal.claimed.includes('filter'));
  assert.ok(retry.ocean!.tidal!.journal.seen.includes('fanworm'));
  retry.player.x += 10;
  assert.notEqual(retry.player.x, t.safeCheckpoint!.player.x);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), retry);
  const decoded = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(decoded.kind, 'ok');
});

void test('F spends four nutrients only once when the highest-priority estuary action is actually available', () => {
  const w = tidalFixture({ mature: true, at: 'estuary' }),
    t = w.ocean!.tidal!;
  t.compat.legacyStations = 2;
  t.compat.legacyLegs = ['hunt', 'filter'];
  w.food = 4;
  applyTidalCommand(w, { id: 1, kind: 'interact' });
  assert.equal(w.food, 4);
  assert.equal(t.migration.refuge, false);
  t.tick = 90 * 120;
  applyTidalCommand(w, { id: 2, kind: 'interact' });
  assert.equal(w.food, 0);
  assert.ok(t.migration.refuge);
  const once = structuredClone(w);
  applyTidalCommand(w, { id: 3, kind: 'interact' });
  assert.deepEqual(w, once);
});
void test('unsafe, paused and mid-birth positions cannot overwrite an earned checkpoint', () => {
  const w = tidalFixture();
  saveTidalCheckpoint(w);
  const original = structuredClone(w.ocean!.tidal!.safeCheckpoint);
  for (const mode of ['paused', 'dead', 'won'] as const) {
    w.mode = mode;
    saveTidalCheckpoint(w);
    assert.deepEqual(w.ocean!.tidal!.safeCheckpoint, original);
  }
  w.mode = 'running';
  w.player.x = 2300;
  w.player.y = 1430;
  saveTidalCheckpoint(w);
  assert.deepEqual(w.ocean!.tidal!.safeCheckpoint, original);
  w.player.x = 460;
  w.player.y = 1770;
  w.ocean!.morph = { from: w.form, to: w.form, elapsed: 0, duration: 4.2 };
  saveTidalCheckpoint(w);
  assert.deepEqual(w.ocean!.tidal!.safeCheckpoint, original);
});

void test('only trusted living ribbonfish that physically reached the estuary become companions, even with an inherited mouth', () => {
  const w = tidalFixture({ mature: true, at: 'estuary', organs: ['jaw'] }),
    t = w.ocean!.tidal!;
  t.compat.legacyStations = 2;
  t.compat.legacyLegs = ['hunt', 'filter'];
  t.tick = 90 * 120;
  w.food = 4;
  const neighbor = {
    id: 'arrived',
    species: 'ribbonfish' as const,
    homeBiome: 'drift' as const,
    x: 3000,
    y: 390,
    radius: 21,
    angle: 0,
    hunger: 20,
    health: 100,
    behavior: 'home' as const,
    targetId: null,
    phaseSeconds: 0,
    respawnSeconds: 0,
    carryingId: null,
    trust: 20,
  };
  t.actors = [
    neighbor,
    { ...neighbor, id: 'far', x: 1700 },
    { ...neighbor, id: 'dead', health: 0 },
    { ...neighbor, id: 'untrusted', trust: 0 },
  ];
  assert.equal(tidalIntent(w, neighbor, 0.05).prey, undefined);
  assert.equal(neighbor.behavior, 'follow');
  assert.ok(settleTidalRefuge(w));
  assert.deepEqual(t.migration.companions, ['arrived']);
});

void test('one old warm-current station and revisiting drift are still only one distinct midway habitat', () => {
  const w = tidalFixture({ mature: true, at: 'estuary' }),
    t = w.ocean!.tidal!;
  t.compat.legacyStations = 1;
  t.compat.legacyLegs = ['hunt'];
  t.migration.visited = ['drift'];
  t.tick = 90 * 120;
  w.food = 4;
  assert.match(tidalExitGate(w)!, /经过/);
  t.migration.visited.push('reef');
  assert.equal(tidalExitGate(w), null);
});
