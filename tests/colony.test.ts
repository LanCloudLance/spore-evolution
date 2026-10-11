import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createColonyWorld,
  colonyFromLand,
  colonyInteract,
  setColonyRole,
  startColonyStorm,
  stepColony,
  COLONY_NEST,
} from '../app/game/colony.ts';
import type { ColonyState, ColonyRole } from '../app/game/colony.ts';
import { createLandWorld } from '../app/game/land.ts';
import { distance } from '../app/game/simulation.ts';
const idle = { x: 0, y: 0 };
function move(s: ColonyState, target: { x: number; y: number }) {
  for (let i = 0; i < 1600 && distance(s.player, target) > 12; i++) {
    const x = target.x - s.player.x,
      y = target.y - s.player.y,
      d = Math.hypot(x, y);
    stepColony(s, { x: x / d, y: y / d }, 1 / 60);
  }
  assert.ok(distance(s.player, target) < 14);
}
function gather(s: ColonyState, kind: ColonyRole, needed: number) {
  for (
    let trip = 0;
    trip < 40 && s[kind === 'wood' ? 'wood' : 'food'] < needed;
    trip++
  ) {
    for (let i = 0; i < 3; i++) {
      let p = s.patches
        .filter((p) => p.kind === kind && p.cooldown === 0)
        .sort((a, b) => distance(s.player, a) - distance(s.player, b))[0];
      if (!p) {
        stepColony(s, idle, 14);
        p = s.patches.find((p) => p.kind === kind && p.cooldown === 0)!;
      }
      move(s, p);
      colonyInteract(s);
    }
    move(s, COLONY_NEST);
    colonyInteract(s);
  }
  assert.ok(s[kind === 'wood' ? 'wood' : 'food'] >= needed);
}
void test('chapter transition is gated and preserves actual ancestry, body and companions; standalone invents no history', () => {
  const w = createLandWorld();
  assert.equal(colonyFromLand(w), null);
  w.mode = 'won';
  w.form = 'stalker';
  w.generation = 7;
  w.land!.body.legs = 1.4;
  w.land!.organ = 'plates';
  w.land!.creatures[0].joined = true;
  const s = colonyFromLand(w)!;
  assert.equal(s.standalone, true);
  assert.equal(s.form, 'stalker');
  assert.deepEqual(s.body, w.land!.body);
  assert.equal(s.organ, 'plates');
  assert.equal(s.generation, 7);
  assert.equal(s.members.length, 1);
  assert.equal(s.history.length, w.history.length + 1);
  s.body.legs = 0.8;
  assert.equal(w.land!.body.legs, 1.4);
  assert.deepEqual(createColonyWorld().history, []);
  assert.equal(createColonyWorld().standalone, true);
});
for (const friends of [false, true])
  for (const form of ['strider', 'stalker'] as const)
    void test(`${form} ${friends ? 'cooperative' : 'solo'} actual travel completes gathering, nursery, feeding and storm`, () => {
      const s = createColonyWorld();
      s.form = form;
      s.mode = 'running';
      s.food = 0;
      if (!friends) s.members = [];
      gather(s, 'wood', 8);
      gather(s, 'food', 4);
      move(s, COLONY_NEST);
      assert.ok(colonyInteract(s));
      assert.ok(s.shelter);
      gather(s, 'food', 16);
      gather(s, 'wood', 5);
      move(s, COLONY_NEST);
      for (let i = 0; i < 5; i++) {
        assert.ok(colonyInteract(s));
        stepColony(s, idle, 3.1);
      }
      assert.equal(s.growth, 100);
      assert.equal(s.members.filter((m) => m.newborn).length, 1);
      assert.equal(s.generation, 1);
      for (const m of s.members) setColonyRole(s, m.id, 'guard');
      stepColony(s, idle, 5);
      assert.ok(startColonyStorm(s));
      for (let i = 0; i < 3000 && s.mode === 'running'; i++) {
        if (s.integrity < 70) colonyInteract(s);
        stepColony(s, idle, 1 / 60);
      }
      assert.equal(s.mode, 'won');
      assert.ok(s.integrity > 0);
      assert.equal(s.storm, 0);
    });
void test('assignment changes preserve goods in transit and credit only on delivery', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  const m = s.members[0];
  s.members = [m];
  const start = s.food;
  for (let i = 0; i < 900 && !m.carrying; i++) stepColony(s, idle, 1 / 60);
  assert.equal(m.carrying, 'food');
  assert.equal(s.food, start);
  assert.ok(setColonyRole(s, m.id, 'guard'));
  for (let i = 0; i < 900 && m.carrying; i++) stepColony(s, idle, 1 / 60);
  assert.equal(s.food, start + 1);
  assert.equal(m.carrying, null);
  assert.equal(m.role, 'guard');
});
void test('capacity, deposits, build, feeding and repairs respect resources and cooldowns', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  s.members = [];
  const p = s.patches[0];
  Object.assign(s.player, p);
  assert.ok(colonyInteract(s));
  assert.equal(colonyInteract(s), false);
  assert.equal(s.player.load, 1);
  s.player.load = 3;
  p.cooldown = 0;
  assert.equal(colonyInteract(s), false);
  Object.assign(s.player, COLONY_NEST);
  assert.ok(colonyInteract(s));
  assert.equal(s.food, 5);
  assert.equal(s.player.load, 0);
  assert.equal(colonyInteract(s), false);
  s.wood = 8;
  assert.ok(colonyInteract(s));
  assert.equal(s.food, 1);
  assert.equal(s.wood, 0);
  assert.equal(colonyInteract(s), false);
  s.food = 10;
  assert.ok(colonyInteract(s));
  assert.equal(colonyInteract(s), false);
  assert.equal(s.growth, 20);
  assert.equal(s.food, 8);
  s.growth = 100;
  assert.ok(startColonyStorm(s));
  assert.equal(startColonyStorm(s), false);
  s.integrity = 40;
  s.wood = 2;
  assert.ok(colonyInteract(s));
  assert.equal(colonyInteract(s), false);
  assert.equal(s.integrity, 60);
  assert.equal(s.wood, 1);
});
void test('pause freezes all state and disabled actions; unprepared storm fails and terminal state stays frozen', () => {
  const s = createColonyWorld();
  s.mode = 'paused';
  const before = structuredClone(s);
  stepColony(s, { x: 1, y: 1, interact: true }, 10);
  assert.equal(colonyInteract(s), false);
  assert.equal(setColonyRole(s, 0, 'guard'), false);
  assert.equal(startColonyStorm(s), false);
  assert.deepEqual(s, before);
  s.mode = 'running';
  s.shelter = true;
  s.growth = 100;
  s.members = [];
  s.food = 0;
  startColonyStorm(s);
  stepColony(s, idle, 40);
  assert.equal(s.mode, 'lost');
  const lost = structuredClone(s);
  stepColony(s, { x: 1, y: 0 }, 10);
  assert.deepEqual(s, lost);
});
void test('only guards physically at the nest protect it, with stable weather costs at 30 and 120 FPS', () => {
  const a = createColonyWorld();
  a.mode = 'running';
  a.shelter = true;
  a.growth = 100;
  a.food = 20;
  a.members[0].role = 'guard';
  a.members[1].role = 'guard';
  startColonyStorm(a);
  const b = structuredClone(a);
  for (let i = 0; i < 300; i++) stepColony(a, idle, 1 / 30);
  for (let i = 0; i < 1200; i++) stepColony(b, idle, 1 / 120);
  assert.ok(Math.abs(a.integrity - b.integrity) < 0.05);
  assert.equal(a.food, b.food);
  assert.equal(a.food, 19);
  const far = structuredClone(a);
  for (const m of far.members) {
    m.x = 20;
    m.y = 20;
  }
  const nearIntegrity = a.integrity,
    farIntegrity = far.integrity;
  stepColony(a, idle, 1 / 30);
  stepColony(far, idle, 1 / 30);
  assert.ok(farIntegrity - far.integrity > nearIntegrity - a.integrity);
});
