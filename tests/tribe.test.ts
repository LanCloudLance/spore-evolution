import test from 'node:test';
import assert from 'node:assert/strict';
import { createColonyWorld } from '../app/game/colony.ts';
import {
  tribeFromColony,
  craftTribeTool,
  tribeInteract,
  startTribeStorm,
  stepTribe,
  neighborAction,
  setTribeRole,
  tribeCapacity,
  TRIBE_HOME,
  TRIBE_COUNCIL,
} from '../app/game/tribe.ts';
import { runColony } from './helpers/campaign-route.ts';
import { collectTribe, walkTribe, runTribe } from './helpers/tribe-route.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
const colony = createColonyWorld();
colony.mode = 'running';
runColony(colony);
const fresh = () => {
  const s = tribeFromColony(colony)!;
  s.mode = 'running';
  return s;
};
void test('tribe entry is earned, copies the actual lineage and does not multiply an existing chapter', () => {
  assert.equal(tribeFromColony(createColonyWorld()), null);
  const session = createCampaignSession();
  assert.equal(session.startTribe(), false);
  session.startColony(colony);
  assert.ok(session.startTribe());
  const t = session.getTribe()!.current;
  t.mode = 'running';
  stepTribe(t, { x: 1, y: 0 }, 1);
  session.updateTribe(t);
  assert.ok(session.startTribe());
  assert.deepEqual(session.getTribe()!.current, t);
  assert.deepEqual(t.history, colony.history);
  assert.equal(t.standalone, true);
  session.leaveTribe(t);
  assert.equal(session.getTribe()!.current.mode, 'paused');
  assert.equal(session.getTribe()!.checkpoint.mode, 'ready');
});
void test('tool costs, reach, one-time crafting and diplomatic contact are enforced', () => {
  const s = fresh();
  assert.equal(craftTribeTool(s, 'basket'), false);
  collectTribe(s, 'fiber', 3);
  collectTribe(s, 'wood', 4);
  walkTribe(s, TRIBE_HOME);
  const before = { ...s.stores };
  assert.ok(craftTribeTool(s, 'basket'));
  assert.equal(s.stores.fiber, before.fiber - 3);
  assert.equal(s.stores.wood, before.wood - 4);
  assert.equal(tribeCapacity(s), 6);
  const after = { ...s.stores };
  assert.equal(craftTribeTool(s, 'basket'), false);
  assert.deepEqual(s.stores, after);
  assert.equal(neighborAction(s, 'moss', 'trade'), false);
  assert.equal(startTribeStorm(s), false);
  walkTribe(s, TRIBE_COUNCIL);
  assert.equal(tribeInteract(s), false);
  assert.equal(s.camp, false);
});
void test('construction needs paid material and actual proximity; timeout fails and pause freezes', () => {
  const s = tribeFromColony(colony)!;
  runTribe(s, 'hammer', 'help');
  // Isolate a weather boundary after the complete earned route; this fixture is not route evidence.
  s.mode = 'running';
  s.storm = 0.2;
  s.banks[0].work = 0;
  s.banks[0].paid = false;
  const stock = { ...s.stores };
  stepTribe(s, { x: 0, y: 0 }, 0.05);
  assert.equal(s.banks[0].work, 0);
  assert.deepEqual(s.stores, stock);
  s.banks[0].paid = true;
  stepTribe(s, { x: 0, y: 0 }, 0.05);
  assert.equal(
    s.banks[0].work,
    0,
    'paid construction must not progress while the player is at the distant council',
  );
  s.mode = 'paused';
  const paused = structuredClone(s);
  stepTribe(s, { x: 1, y: 0, interact: true }, 2);
  assert.deepEqual(s, paused);
  s.mode = 'running';
  stepTribe(s, { x: 0, y: 0 }, 1);
  assert.equal(s.mode, 'lost');
  const lost = structuredClone(s);
  stepTribe(s, { x: 1, y: 1 }, 1);
  assert.deepEqual(s, lost);
});
void test('an escort completes its carried delivery before joining and state survives a mid-chapter save', () => {
  const session = createCampaignSession();
  session.startColony(colony);
  session.startTribe();
  const t = session.getTribe()!.current;
  t.mode = 'running';
  assert.ok(setTribeRole(t, t.members[0].id, 'food'));
  for (let i = 0; i < 1000 && !t.members.some((m) => m.carrying); i++)
    stepTribe(t, { x: 0, y: 0 }, 0.05);
  const m = t.members.find((m) => m.carrying)!;
  assert.ok(m);
  const kind = m.carrying!,
    load = m.load,
    stored = t.stores[kind];
  assert.ok(setTribeRole(t, m.id, 'escort'));
  session.updateTribe(t);
  const parsed = decodeSave(encodeSave(session.snapshot('tribe')));
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind !== 'ok') return;
  const again = createCampaignSession();
  again.restore(parsed.save.campaign);
  const restored = again.getTribe()!.current;
  assert.equal(restored.mode, 'paused');
  assert.deepEqual(restored.members, t.members);
  restored.mode = 'running';
  const courier = restored.members.find((a) => a.id === m.id)!;
  for (let i = 0; i < 1000 && courier.carrying; i++)
    stepTribe(restored, { x: 0, y: 0 }, 0.05);
  assert.equal(courier.carrying, null);
  assert.ok(restored.stores[kind] >= stored + load);
  const old = JSON.parse(
    encodeSave(createCampaignSession().snapshot('journey')),
  );
  delete old.campaign.tribe;
  old.version = 1;
  const migrated = decodeSave(JSON.stringify(old));
  assert.equal(migrated.kind, 'ok');
  if (migrated.kind === 'ok') {
    assert.equal(migrated.save.version, 5);
    assert.equal(migrated.save.campaign.tribe, null);
  }
  const bad = JSON.parse(encodeSave(again.snapshot('tribe')));
  bad.campaign.tribe.current.banks = [];
  assert.equal(decodeSave(JSON.stringify(bad)).kind, 'invalid');
});
