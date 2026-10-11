import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeDash,
  pressDash,
  TAP_DASH_SECONDS,
} from '../app/game/dash-input.ts';
import { createWorld, stepWorld } from '../app/game/simulation.ts';

void test('a released tap gives a visible burst, pays energy, then returns to ordinary swimming', () => {
  const walking = createWorld(17),
    tapping = createWorld(17);
  for (const world of [walking, tapping]) {
    world.mode = 'running';
    world.foods = [];
    world.predators = [];
  }
  const input = { remaining: 0 };
  pressDash(input);
  let burstFrames = 0;
  for (let i = 0; i < 120; i++) {
    const dash = consumeDash(input, 1 / 120, false, true);
    if (dash) burstFrames++;
    stepWorld(tapping, { x: 1, y: 0, dash }, 1 / 120);
    stepWorld(walking, { x: 1, y: 0, dash: false }, 1 / 120);
  }
  assert.ok(Math.abs(burstFrames / 120 - TAP_DASH_SECONDS) < 0.01);
  assert.ok(tapping.player.x > walking.player.x + 35);
  assert.ok(tapping.player.energy < walking.player.energy - 1.5);
  assert.equal(tapping.player.dashing, false);
});

void test('held input continues after the tap, while pause or birth cancels any buffered burst', () => {
  const input = { remaining: 0 };
  pressDash(input);
  for (let i = 0; i < 120; i++)
    assert.equal(consumeDash(input, 1 / 60, true, true), true);
  assert.equal(consumeDash(input, 1 / 60, false, true), false);
  pressDash(input);
  assert.equal(consumeDash(input, 0, true, false), false);
  assert.equal(input.remaining, 0);
  assert.equal(consumeDash(input, 1 / 60, false, true), false);
});
