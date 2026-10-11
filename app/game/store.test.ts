import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameStore } from './store.ts';
void test('render snapshots stay immutable while the live game advances', () => {
  const store = createGameStore();
  const previous = store.getSnapshot();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications++;
  });
  store.getWorld().player.energy = 55;
  assert.equal(previous.player.energy, 80);
  store.publish();
  assert.equal(store.getSnapshot().player.energy, 55);
  assert.equal(notifications, 1);
  assert.equal(previous.player.energy, 80);
  unsubscribe();
  store.publish();
  assert.equal(notifications, 1);
});
