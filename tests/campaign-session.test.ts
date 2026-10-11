import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { createColonyWorld, stepColony } from '../app/game/colony.ts';
void test('chapter UI return retains the actual journey store and frozen colony progress', () => {
  const session = createCampaignSession(),
    world = session.journey.getWorld();
  world.food = 31;
  world.generation = 4;
  session.journey.publish();
  const entry = createColonyWorld();
  session.startColony(entry);
  const current = session.getColony()!.current;
  current.mode = 'running';
  stepColony(current, { x: 1, y: 0 }, 10);
  const position = { ...current.player },
    food = current.food;
  session.leaveColony(current);
  current.player.x = 1;
  const resumed = session.getColony()!;
  assert.equal(session.journey.getWorld(), world);
  assert.equal(session.journey.getSnapshot().food, 31);
  assert.equal(world.generation, 4);
  assert.equal(resumed.current.mode, 'paused');
  assert.deepEqual(resumed.current.player, position);
  assert.equal(resumed.current.food, food);
  assert.deepEqual(resumed.checkpoint, entry);
  stepColony(resumed.current, { x: 1, y: 0 }, 20);
  assert.deepEqual(resumed.current.player, position);
  resumed.checkpoint.food = 99;
  assert.equal(session.getColony()!.checkpoint.food, 2);
});
void test('new chapter entry replaces only the explicitly selected colony slot; completed and failed runs keep their outcomes', () => {
  const session = createCampaignSession();
  assert.equal(session.getColony(), null);
  session.leaveColony(createColonyWorld());
  assert.equal(session.getColony(), null);
  for (const mode of ['won', 'lost'] as const) {
    const s = createColonyWorld();
    s.mode = mode;
    session.startColony(s);
    session.leaveColony(s);
    assert.equal(session.getColony()!.current.mode, mode);
  }
  const fresh = createColonyWorld();
  session.startColony(fresh);
  assert.equal(session.getColony()!.current.mode, 'ready');
  assert.equal(session.getColony()!.current.time, 0);
});
