import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShoreWorld,
  SHORE_SHELL_BEDS,
  SHORE_POOLS,
  shoreTide,
  shellBedReady,
  interactShore,
  stepShore,
  evolveShore,
  shoreEvolutionGate,
  wetAt,
  retryShore,
  shoreFieldHint,
} from '../app/game/shore.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
const idle = { x: 0, y: 0, dash: false };
void test('tidal feeding is bounded by the actual water window and charges each bed once per tide', () => {
  const w = createShoreWorld();
  w.foods = [];
  const bed = SHORE_SHELL_BEDS[0];
  Object.assign(w.player, { x: bed.x, y: bed.y });
  w.time = 17.5;
  assert.equal(wetAt(w, bed), true);
  assert.equal(shoreTide(w).exposed, false);
  assert.equal(interactShore(w), false);
  w.time = 52.5;
  assert.equal(wetAt(w, bed), false);
  assert.equal(shoreTide(w).exposed, true);
  assert.equal(interactShore(w), true);
  assert.equal(w.food, 4);
  assert.equal(w.totalFood, 4);
  assert.equal(interactShore(w), false);
  assert.equal(w.food, 4);
  w.time = 122.5;
  assert.equal(shellBedReady(w, bed.id), true);
  w.mode = 'paused';
  assert.equal(interactShore(w), false);
  w.mode = 'running';
  assert.equal(interactShore(w), true);
  assert.equal(w.food, 8);
  assert.equal(w.totalFood, 8);
  w.player.x = 460;
  assert.equal(interactShore(w), false);
});
void test('a safe dry excursion unlocks moisture research without visiting the specimen, preserving evolution costs', () => {
  const w = createShoreWorld();
  w.form = 'crawler';
  w.shore!.tier = 1;
  w.shore!.creatures = [];
  w.foods = [];
  Object.assign(w.player, { x: 715, y: 1440 });
  for (let i = 0; i < 165; i++) stepShore(w, idle, 0.05);
  assert.equal(w.shore!.discovered.includes('moisture'), false);
  assert.match(shoreFieldHint(w)!, /现在回潮池/);
  // Return with movement rather than forcing the discovered flag.
  for (let i = 0; i < 40; i++) stepShore(w, { x: -1, y: 0, dash: false }, 0.05);
  assert.equal(wetAt(w, w.player), true);
  assert.ok(w.shore!.discovered.includes('moisture'));
  assert.equal(w.shore!.fieldNotes!.safeReturns, 1);
  assert.equal(w.shore!.observation.moisture, undefined);
  assert.match(shoreEvolutionGate(w), /食物/);
  w.food = 12;
  assert.match(shoreEvolutionGate(w), /蕨影潮池/);
  w.shore!.visited.push(SHORE_POOLS[2].name);
  w.player.energy = 100;
  for (let i = 0; i < 70; i++) stepShore(w, idle, 0.05);
  assert.equal(shoreEvolutionGate(w), '');
  assert.ok(evolveShore(w, 'skin'));
  assert.equal(w.shore!.protection, 'skin');
  assert.equal(w.food, 0);
});
void test('short outings, fish bodies and paused time do not fabricate a completed field study', () => {
  const w = createShoreWorld();
  w.foods = [];
  w.shore!.creatures = [];
  Object.assign(w.player, { x: 715, y: 1440 });
  for (let i = 0; i < 165; i++) stepShore(w, idle, 0.05);
  assert.equal(w.shore!.fieldNotes!.drySeconds, 0);
  w.form = 'crawler';
  w.shore!.tier = 1;
  for (let i = 0; i < 80; i++) stepShore(w, idle, 0.05);
  w.mode = 'paused';
  const before = structuredClone(w);
  for (let i = 0; i < 200; i++) stepShore(w, idle, 0.05);
  assert.deepEqual(w, before);
  w.mode = 'running';
  Object.assign(w.player, { x: 460, y: 1440 });
  stepShore(w, idle, 0.05);
  assert.equal(w.shore!.fieldNotes!.drySeconds, 0);
  assert.equal(w.shore!.discovered.includes('moisture'), false);
});
void test('field notes persist without refreshing shell rewards; old saves remain valid and retries start fresh', () => {
  const w = createShoreWorld();
  w.time = 52.5;
  Object.assign(w.player, SHORE_SHELL_BEDS[0]);
  assert.ok(interactShore(w));
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const decoded = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(decoded.kind, 'ok');
  if (decoded.kind !== 'ok') return;
  const restored = decoded.save.campaign.journey;
  assert.equal(shellBedReady(restored, 'landing'), false);
  assert.deepEqual(restored.shore!.fieldNotes, w.shore!.fieldNotes);
  delete session.journey.getWorld().shore!.fieldNotes;
  assert.equal(decodeSave(encodeSave(session.snapshot('journey'))).kind, 'ok');
  assert.deepEqual(retryShore(w).shore!.fieldNotes, {
    drySeconds: 0,
    safeReturns: 0,
    harvestCycles: {},
  });
});
