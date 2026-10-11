import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createColonyWorld,
  colonyInteraction,
  colonyInteract,
  colonyGuards,
  setColonyRole,
  stepColony,
  COLONY_NEST,
} from '../app/game/colony.ts';
import { colonySnapshot, colonyCues } from '../app/game/colony-feedback.ts';
void test('context follows actual resource, carrying, nest, feeding and repair gates', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  s.members = [];
  Object.assign(s.player, COLONY_NEST);
  assert.equal(colonyInteraction(s).ready, false);
  assert.equal(colonyInteract(s), false);
  const patch = s.patches.find((p) => p.kind === 'wood')!;
  Object.assign(s.player, { x: patch.x, y: patch.y });
  assert.match(colonyInteraction(s).label, /采集树枝/);
  assert.ok(colonyInteraction(s).ready);
  assert.ok(colonyInteract(s));
  assert.equal(colonyInteraction(s).ready, false);
  const fruit = s.patches.find((p) => p.kind === 'food')!;
  Object.assign(s.player, { x: fruit.x, y: fruit.y });
  assert.equal(colonyInteraction(s).ready, false);
  assert.match(colonyInteraction(s).hint, /带回/);
  Object.assign(s.player, COLONY_NEST);
  assert.match(colonyInteraction(s).label, /存放1份树枝/);
  assert.ok(colonyInteract(s));
  s.wood = 8;
  s.food = 4;
  assert.ok(colonyInteraction(s).ready);
  assert.ok(colonyInteract(s));
  assert.match(colonyInteraction(s).label, /喂养/);
  assert.equal(colonyInteraction(s).ready, false);
  s.food = 2;
  assert.ok(colonyInteract(s));
  assert.equal(colonyInteraction(s).ready, false);
  assert.match(colonyInteraction(s).hint, /消化/);
  s.storm = 40;
  s.integrity = 50;
  s.wood = 1;
  assert.match(colonyInteraction(s).label, /加固/);
  assert.ok(colonyInteraction(s).ready);
  assert.ok(colonyInteract(s));
  assert.equal(colonyInteraction(s).ready, false);
});
void test('feedback reflects real transactions once and never creates progress on pause, reload or rewind', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  s.members = [];
  Object.assign(s.player, COLONY_NEST);
  s.wood = 8;
  s.food = 10;
  let before = colonySnapshot(s);
  assert.ok(colonyInteract(s));
  assert.deepEqual(
    colonyCues(before, s).map((e) => e.kind),
    ['build'],
  );
  before = colonySnapshot(s);
  assert.ok(colonyInteract(s));
  assert.equal(colonyCues(before, s)[0].text, '成长 +20%');
  before = colonySnapshot(s);
  assert.equal(colonyInteract(s), false);
  assert.deepEqual(colonyCues(before, s), []);
  s.mode = 'paused';
  const saved = structuredClone(s);
  assert.deepEqual(colonyCues(colonySnapshot(s), s), []);
  assert.deepEqual(s, saved);
  assert.deepEqual(colonyCues({ ...before, time: s.time + 1 }, s), []);
  assert.deepEqual(
    colonyCues(colonySnapshot(saved), structuredClone(saved)),
    [],
  );
});
void test('guard indication and storm damage count only members at the nest with empty hands', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  s.shelter = true;
  s.growth = 100;
  s.food = 20;
  s.storm = 40;
  for (const m of s.members) {
    setColonyRole(s, m.id, 'guard');
    Object.assign(m, { x: COLONY_NEST.x + 60, y: COLONY_NEST.y });
  }
  const m = s.members[0];
  m.carrying = 'wood';
  assert.equal(colonyGuards(s).length, s.members.length - 1);
  const before = s.integrity;
  stepColony(s, { x: 0, y: 0 }, 0.01);
  assert.ok(
    Math.abs(
      s.integrity - (before - 0.01 * (3.4 - (s.members.length - 1) * 0.7)),
    ) < 1e-7,
  );
  m.carrying = null;
  m.x = 20;
  m.y = 20;
  assert.equal(colonyGuards(s).includes(m), false);
  for (
    let i = 0;
    i < 1500 && !colonyGuards(s).includes(m) && s.mode === 'running';
    i++
  )
    stepColony(s, { x: 0, y: 0 }, 0.01);
  assert.ok(colonyGuards(s).includes(m));
});
