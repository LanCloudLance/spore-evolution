import test from 'node:test';
import assert from 'node:assert/strict';
import * as controls from '../app/game/dash-input.ts';
import { createLandWorld, LAND_NESTS } from '../app/game/land.ts';
import { stepWorld } from '../app/game/simulation.ts';
void test('a restored notice shows the new controls without changing DNA names or saved text', () => {
  const saved =
    'DNA / 共生来源：按 F 分享，Q / R 技能，C 能力，G 动作，E 下一代。';
  assert.equal(
    controls.keyHints(saved),
    'DNA / 共生来源：按 K 分享，J / L 技能，U 能力，I 动作，O 下一代。',
  );
  assert.equal(
    saved,
    'DNA / 共生来源：按 F 分享，Q / R 技能，C 能力，G 动作，E 下一代。',
  );
});
void test('right-hand interaction can build while WASD remains held, including shifted and non-Latin keyboard labels', () => {
  assert.equal(typeof controls.gameKey, 'function');
  const held = new Set<string>();
  for (const event of [
    { key: 'D', code: 'KeyD' },
    { key: 'に', code: 'KeyK' },
  ]) {
    const key = controls.gameKey(event);
    if (key) held.add(key);
  }
  controls.takeActionInput(held, false);
  const w = createLandWorld(17);
  w.food = 12;
  w.foods = [];
  Object.assign(w.player, LAND_NESTS[0]);
  stepWorld(
    w,
    { x: 0, y: 0, dash: false, ...controls.takeActionInput(held, true) },
    1 / 120,
  );
  assert.equal(w.food, 6);
  assert.deepEqual(w.land!.nests, [0]);
  assert.deepEqual([...held], ['d']);
});
void test('right-hand actions are buffered once without triggering from old adjacent keys or browser shortcuts', () => {
  assert.equal(typeof controls.gameKey, 'function');
  const held = new Set<string>();
  for (const key of ['j', 'l', 'i', 'u']) {
    const action = controls.gameKey({ key, code: `Key${key.toUpperCase()}` });
    if (action) held.add(action);
  }
  controls.takeActionInput(held, false);
  assert.equal(controls.takeLearnedSkillInput(held, false), false);
  assert.deepEqual(controls.takeActionInput(held, true), {
    skill: true,
    interact: false,
    command: true,
    feature: true,
  });
  assert.equal(controls.takeLearnedSkillInput(held, true), true);
  assert.equal(controls.takeActionInput(held, true).skill, false);
  assert.equal(controls.takeLearnedSkillInput(held, true), false);
  for (const key of ['q', 'e', 'r', 'f', 'g', 'c'])
    assert.equal(
      controls.gameKey({ key, code: `Key${key.toUpperCase()}` }),
      null,
    );
  assert.equal(
    controls.gameKey({ key: 'k', code: 'KeyK', metaKey: true }),
    null,
  );
  assert.equal(
    controls.gameKey({ key: 'j', code: 'KeyJ', ctrlKey: true }),
    null,
  );
  assert.equal(
    controls.gameKey({ key: 'l', code: 'KeyL', altKey: true }),
    null,
  );
  assert.equal(controls.gameKey({ key: 'O', code: 'KeyO' }), 'e');
  assert.equal(
    controls.gameKey({ key: 'ArrowLeft', code: 'ArrowLeft' }),
    'arrowleft',
  );
  assert.equal(controls.gameKey({ key: ' ', code: 'Space' }), ' ');
});
void test('a short F tap survives a display frame without a simulation tick and builds exactly one nest', () => {
  assert.equal(
    typeof controls.takeActionInput,
    'function',
    'rendering can discard an unconsumed action',
  );
  const held = new Set(['f', 'd']);
  const w = createLandWorld(17);
  w.food = 12;
  w.foods = [];
  Object.assign(w.player, LAND_NESTS[0]);
  assert.deepEqual(controls.takeActionInput(held, false), {
    skill: false,
    interact: false,
    command: false,
    feature: false,
  });
  assert.ok(held.has('f'));
  stepWorld(
    w,
    { x: 0, y: 0, dash: false, ...controls.takeActionInput(held, true) },
    1 / 120,
  );
  assert.equal(w.food, 6);
  assert.deepEqual(w.land!.nests, [0]);
  assert.ok(held.has('d'));
  assert.equal(held.has('f'), false);
  stepWorld(
    w,
    { x: 0, y: 0, dash: false, ...controls.takeActionInput(held, true) },
    1 / 120,
  );
  assert.equal(w.food, 6);
});
void test('Q and R commands stay buffered until a real tick consumes them once', () => {
  assert.equal(typeof controls.takeActionInput, 'function');
  const held = new Set(['q', 'r', 'w']);
  for (let i = 0; i < 5; i++) controls.takeActionInput(held, false);
  assert.deepEqual(controls.takeActionInput(held, true), {
    skill: true,
    interact: false,
    command: true,
    feature: false,
  });
  assert.deepEqual(controls.takeActionInput(held, true), {
    skill: false,
    interact: false,
    command: false,
    feature: false,
  });
  assert.deepEqual([...held], ['w']);
});
void test('G anatomy action survives a short tap and is consumed exactly once without taking over R companions', () => {
  const held = new Set(['g', 'r', 'd']);
  controls.takeActionInput(held, false);
  assert.ok(held.has('g'));
  const input = controls.takeActionInput(held, true);
  assert.equal(input.feature, true);
  assert.equal(input.command, true);
  assert.equal(controls.takeActionInput(held, true).feature, false);
  assert.deepEqual([...held], ['d']);
});
