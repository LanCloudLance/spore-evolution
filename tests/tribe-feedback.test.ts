import test from 'node:test';
import assert from 'node:assert/strict';
import { createColonyWorld } from '../app/game/colony.ts';
import {
  tribeFromColony,
  tribeInteract,
  craftTribeTool,
  tribePrompt,
  tribeBuilders,
  stepTribe,
  TRIBE_HOME,
} from '../app/game/tribe.ts';
import { tribeSnapshot, tribeCues } from '../app/game/tribe-feedback.ts';

// Boundary fixtures isolate UI/simulation agreement; these are not playthrough evidence.
function fresh() {
  const c = createColonyWorld();
  Object.assign(c, { mode: 'won', growth: 100, shelter: true, integrity: 100 });
  const s = tribeFromColony(c)!;
  s.mode = 'running';
  return s;
}
void test('tribe feedback follows committed gathering, delivery and tool transactions without mutating progress', () => {
  const s = fresh();
  s.members = [];
  const fiber = s.patches.find((p) => p.kind === 'fiber')!;
  Object.assign(s.player, { x: fiber.x, y: fiber.y });
  let before = tribeSnapshot(s);
  assert.ok(tribeInteract(s));
  assert.equal(tribeCues(before, s)[0].text, '+2 纤维');
  before = tribeSnapshot(s);
  assert.equal(tribeInteract(s), false);
  assert.deepEqual(tribeCues(before, s), []);
  Object.assign(s.player, TRIBE_HOME);
  assert.match(tribePrompt(s).label, /存放2份纤维/);
  assert.ok(tribeInteract(s));
  assert.equal(tribeCues(before, s)[0].text, '入库 +2 纤维');
  s.stores.wood = 4;
  s.stores.fiber = 3;
  before = tribeSnapshot(s);
  assert.ok(craftTribeTool(s, 'basket'));
  assert.deepEqual(
    tribeCues(before, s).map((c) => c.kind),
    ['tool'],
  );
  const saved = structuredClone(s);
  tribeCues(before, s);
  assert.deepEqual(s, saved);
  before = tribeSnapshot(s);
  assert.equal(craftTribeTool(s, 'basket'), false);
  assert.deepEqual(tribeCues(before, s), []);
  s.mode = 'paused';
  assert.deepEqual(tribeCues(tribeSnapshot(s), structuredClone(s)), []);
  assert.deepEqual(tribeCues({ ...before, time: s.time + 1 }, s), []);
});
void test('construction prompt and speed count only empty-handed escorts who actually arrive', () => {
  const s = fresh();
  s.storm = 60;
  const bank = s.banks[0];
  bank.paid = true;
  Object.assign(s.player, { x: bank.x, y: bank.y });
  for (const m of s.members)
    Object.assign(m, {
      x: bank.x + 20,
      y: bank.y,
      carrying: null,
      load: 0,
      role: 'escort',
    });
  const m = s.members[0];
  assert.ok(m);
  m.carrying = 'wood';
  m.load = 1;
  assert.equal(tribeBuilders(s, bank).length, s.members.length - 1);
  assert.match(
    tribePrompt(s).hint,
    new RegExp(`到位帮手${s.members.length - 1}`),
  );
  const helpers = tribeBuilders(s, bank).length;
  stepTribe(s, { x: 0, y: 0 }, 0.01);
  assert.ok(Math.abs(bank.work - 0.01 * (1 + helpers * 0.8)) < 1e-8);
  m.carrying = null;
  m.x = 0;
  assert.equal(tribeBuilders(s, bank).includes(m), false);
  s.tools.push('hammer');
  assert.match(tribePrompt(s).hint, /石锤已生效/);
  const work = bank.work;
  stepTribe(s, { x: 0, y: 0 }, 0.01);
  assert.ok(Math.abs(bank.work - work - 0.01 * (2 + helpers * 0.8)) < 1e-8);
  Object.assign(s.player, TRIBE_HOME);
  const stopped = bank.work;
  stepTribe(s, { x: 0, y: 0 }, 0.01);
  assert.equal(bank.work, stopped);
});
