import { stepWorld } from '../app/game/simulation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { tidalLegacy } from '../app/game/tidal/legacy.ts';
import { settleTidalRefuge } from '../app/game/tidal/migration.ts';
import {
  enterShore,
  createShoreWorld,
  retryShore,
  SHORE_POOLS,
} from '../app/game/shore.ts';
import { enterLand, retryLand, evolveLand } from '../app/game/land.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import { spaceFromCivilization, expeditionRecord } from '../app/game/space.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
/** Isolated chapter-transfer fixture. It does not claim a played migration or campaign. */
function refuge() {
  const w = tidalFixture({
      mature: true,
      at: 'estuary',
      organs: ['jaw', 'shell', 'fin'],
    }),
    t = w.ocean!.tidal!;
  w.ocean!.body.appearance = {
    base: '#417e72',
    accent: '#cfedb3',
    pattern: 'bands',
  };
  t.compat.legacyStations = 2;
  t.compat.legacyLegs = ['hunt', 'filter'];
  t.tick = 90 * 120;
  w.food = 4;
  t.actors = [
    {
      id: 'actual-arrival',
      species: 'ribbonfish',
      homeBiome: 'drift',
      x: 3000,
      y: 390,
      radius: 21,
      angle: 0,
      hunger: 20,
      health: 100,
      behavior: 'follow',
      targetId: 'player',
      phaseSeconds: 0,
      respawnSeconds: 0,
      carryingId: null,
      trust: 20,
    },
  ];
  assert.ok(settleTidalRefuge(w));
  return w;
}
void test('only paid river refuge yields detached legacy facts; independent entry never manufactures ancestors', () => {
  const unfinished = tidalFixture({ mature: true, at: 'estuary' });
  assert.equal(tidalLegacy(unfinished), null);
  const w = refuge(),
    first = tidalLegacy(w)!;
  assert.ok(first.refuge);
  assert.deepEqual(first.companions, ['actual-arrival']);
  const second = tidalLegacy(w)!;
  first.companions.push('fake');
  assert.deepEqual(second.companions, ['actual-arrival']);
  const alone = createShoreWorld();
  assert.equal(alone.tidalLegacy, undefined);
  assert.equal(alone.shore!.tidalResidents, undefined);
  assert.deepEqual(alone.history, []);
});
void test('natural chapter transition carries anatomy palette refuge and origin-identified water residents, without making land companions', () => {
  const w = refuge(),
    body = structuredClone(w.ocean!.body),
    legacy = tidalLegacy(w)!;
  assert.ok(enterShore(w));
  assert.deepEqual(w.shore!.body, body);
  assert.deepEqual(w.tidalLegacy, legacy);
  assert.deepEqual(w.shore!.checkpoint.tidalLegacy, legacy);
  assert.deepEqual(
    w.shore!.tidalResidents!.map((r) => r.originId),
    legacy.companions,
  );
  assert.ok(
    w.shore!.tidalResidents!.every(
      (r) => Math.hypot(r.x - SHORE_POOLS[0].x, r.y - SHORE_POOLS[0].y) < 150,
    ),
  );
  assert.ok(
    w.history.some((a) => a.habitat === 'ocean' && a.tidalLegacy?.refuge),
  );
  w.mode = 'won';
  assert.ok(enterLand(w));
  assert.deepEqual(w.land!.body, body);
  assert.deepEqual(w.tidalLegacy, legacy);
  assert.deepEqual(w.land!.checkpoint.shoreCompanions, []);
});
void test('shore and land retries and v5 save readback preserve detached inherited structures', () => {
  const w = refuge();
  enterShore(w);
  const original = structuredClone(w.shore!.body),
    legacy = tidalLegacy(w)!;
  const retry = retryShore(w);
  assert.deepEqual(retry.shore!.body, original);
  assert.deepEqual(retry.tidalLegacy, legacy);
  retry.tidalLegacy!.companions.push('test-mutant');
  assert.deepEqual(w.tidalLegacy!.companions, legacy.companions);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const decoded = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(decoded.kind, 'ok');
  w.mode = 'won';
  enterLand(w);
  const land = retryLand(w);
  assert.deepEqual(land.land!.body, original);
  assert.deepEqual(land.tidalLegacy, legacy);
});
void test('land proportion editing preserves authoritative water placements IDs and appearance even when a draft omits them', () => {
  const w = refuge();
  enterShore(w);
  w.mode = 'won';
  enterLand(w);
  const before = structuredClone(w.land!.body);
  w.food = 10;
  w.land!.discovered = ['fern'];
  w.land!.nests = [0];
  const draft = structuredClone(before);
  draft.length = 1.2;
  delete draft.appearance;
  draft.placements!.forEach((p) => (p.id += 'renamed'));
  assert.ok(evolveLand(w, 'strider', draft));
  assert.deepEqual(w.land!.body.placements, before.placements);
  assert.deepEqual(w.land!.body.appearance, before.appearance);
});
void test('social chapter constructors and final archive clone the river facts without promoting water residents into workers', () => {
  const w = refuge();
  enterShore(w);
  w.mode = 'won';
  enterLand(w);
  w.mode = 'won';
  const colony = colonyFromLand(w)!;
  const legacy = structuredClone(w.tidalLegacy!);
  assert.deepEqual(colony.tidalLegacy, legacy);
  Object.assign(colony, { mode: 'won', growth: 100, shelter: true });
  const tribe = tribeFromColony(colony)!;
  assert.deepEqual(tribe.tidalLegacy, legacy);
  tribe.mode = 'won';
  tribe.camp = true;
  tribe.banks.forEach((b) => (b.work = 6));
  tribe.neighbors.forEach((n) => (n.trust = 2));
  const city = civilizationFromTribe(tribe)!;
  assert.deepEqual(city.tidalLegacy, legacy);
  Object.assign(city, { mode: 'won', launched: true, bridgeFixed: true });
  const space = spaceFromCivilization(city)!;
  assert.deepEqual(space.tidalLegacy, legacy);
  space.mode = 'won';
  space.outpost = {
    planet: 'tide',
    habitat: 'wetland',
    stability: 100,
    trial: 30,
    growth: 100,
    foodClock: 0,
    settings: { water: 2, light: 2, heat: 1 },
  };
  const archive = expeditionRecord(space, 1)!;
  assert.deepEqual(archive.tidalLegacy, legacy);
  archive.tidalLegacy!.companions.push('test-mutant');
  archive.body.appearance!.base = '#000000';
  assert.deepEqual(space.tidalLegacy, legacy);
  assert.notEqual(space.body.appearance!.base, '#000000');
  assert.deepEqual(colony.tidalLegacy, legacy);
});

void test('water residents swim only in their inherited tide pool and unknown source IDs are rejected on load', () => {
  const w = refuge();
  enterShore(w);
  const before = structuredClone(w.shore!.tidalResidents);
  w.mode = 'paused';
  stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.deepEqual(w.shore!.tidalResidents, before);
  w.mode = 'running';
  for (let i = 0; i < 120; i++)
    stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 120);
  assert.notDeepEqual(w.shore!.tidalResidents, before);
  assert.ok(
    w.shore!.tidalResidents!.every(
      (r) => Math.hypot(r.x - SHORE_POOLS[0].x, r.y - SHORE_POOLS[0].y) < 150,
    ),
  );
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const snapshot = session.snapshot('journey');
  const raw = JSON.parse(encodeSave(snapshot));
  snapshot.journey.shore!.tidalResidents![0].originId = 'unearned-fish';
  assert.throws(() => encodeSave(snapshot), /安全保存/);
  raw.campaign.journey.shore.tidalResidents[0].originId = 'unearned-fish';
  assert.notEqual(decodeSave(JSON.stringify(raw)).kind, 'ok');
});
