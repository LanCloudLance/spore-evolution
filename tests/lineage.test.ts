import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

import { enterShore } from '../app/game/shore.ts';
import { familyTimeline } from '../app/game/lineage.ts';

void test('a habitat transition displays one current generation and retains its earlier habitat receipt', () => {
  const w = createOceanWorld(42);
  w.generation = 7;
  w.form = 'fish';
  w.mode = 'won';
  w.age = 12;
  w.food = 24;
  w.history = [
    {
      generation: 6,
      form: 'bilateral',
      habitat: 'ocean',
      traits: [],
      food: 62,
      seconds: 20,
    },
    {
      generation: 7,
      form: 'fish',
      habitat: 'ocean',
      traits: [],
      food: 24,
      seconds: 12,
    },
  ];
  assert.equal(familyTimeline(w).at(-1)!.status, '已抵达新栖息地');
  assert.ok(enterShore(w));
  const originalHistory = structuredClone(w.history);
  const rows = familyTimeline(w);
  assert.deepEqual(
    rows.map((r) => r.ancestor.generation),
    [6, 7],
  );
  assert.equal(rows[0].status, '已留下后代');
  assert.equal(rows[1].status, '当前生命');
  assert.equal(rows[1].ancestor.food, 0);
  assert.equal(rows[1].ancestor.seconds, 12);
  assert.equal(rows[1].previousHabitat?.food, 24);
  assert.equal(rows[1].previousHabitat?.habitat, 'ocean');
  assert.deepEqual(w.history, originalHistory);
  w.mode = 'dead';
  assert.equal(familyTimeline(w).at(-1)!.status, '探索已结束');
});
