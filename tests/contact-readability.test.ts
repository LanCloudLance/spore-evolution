import test from 'node:test';
import assert from 'node:assert/strict';
import { distance } from '../app/game/simulation.ts';
import * as readability from '../app/game/readability.ts';
import { createLandWorld } from '../app/game/land.ts';
import { stepWorld } from '../app/game/simulation.ts';
void test('soft crowd spacing separates idle neighbors while leaving committed feeding and attacks intact', () => {
  const separate = (
    readability as unknown as {
      separateNeighbors?: (
        b: { id: string; x: number; y: number; radius: number }[],
        dt: number,
        eligible: (id: string) => boolean,
      ) => void;
    }
  ).separateNeighbors;
  assert.ok(separate);
  const a = { id: 'a', x: 100, y: 100, radius: 30 },
    b = { id: 'b', x: 100, y: 100, radius: 30 },
    contact = { id: 'feeding', x: 100, y: 100, radius: 40 };
  const before = { ...contact };
  separate([a, b, contact], 0.05, (id) => id !== 'feeding');
  assert.ok(distance(a, b) > 0);
  assert.ok(distance(a, { x: 100, y: 100 }) <= 1);
  assert.deepEqual(contact, before);
  const paused = structuredClone([a, b]);
  separate([a, b], 0, () => true);
  assert.deepEqual([a, b], paused);
});
void test('inherited shoulder thorns respond to actual contact from each land predator, not just the old hunter', () => {
  for (const species of ['hunter', 'dusk-stalker', 'ridge-ram'] as const) {
    const w = createLandWorld(41),
      c = w.land!.creatures.find((c) => c.species === species)!;
    Object.assign(w.player, { x: 2400, y: 1400, invulnerable: 0 });
    Object.assign(c, {
      x: 2400,
      y: 1400,
      home: { x: 2400, y: 1400 },
      health: 30,
    });
    w.land!.features = ['thorns'];
    w.land!.creatures = [c];
    w.foods = [];
    stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
    assert.ok(w.player.health < 100);
    assert.ok(c.health < 30, `${species} ignored the inherited defense`);
  }
});
