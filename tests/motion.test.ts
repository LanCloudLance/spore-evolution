import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepOcean } from '../app/game/ocean.ts';
void test('reversing input responds immediately rather than swimming through a half circle', () => {
  const w = createOceanWorld(23);
  w.player.angle = 0;
  const x = w.player.x;
  for (let i = 0; i < 12; i++)
    stepOcean(w, { x: -1, y: 0, dash: false }, 1 / 120);
  assert.ok(w.player.x < x - 3, 'left input must move left within 100 ms');
});
void test('releasing movement decelerates briefly instead of stopping abruptly', () => {
  const w = createOceanWorld(23);
  for (let i = 0; i < 60; i++)
    stepOcean(w, { x: 1, y: 0, dash: false }, 1 / 120);
  const x = w.player.x;
  stepOcean(w, { x: 0, y: 0, dash: false }, 1 / 120);
  assert.ok(w.player.x > x);
});

import { glide } from '../app/game/motion.ts';
import { getView, updateCamera } from '../app/game/camera.ts';
void test('acceleration and stopping travel equally at 30 and 144 simulation updates per second', () => {
  const run = (hz: number) => {
    const p = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < hz; i++) glide(p, 120, 0, 1 / hz, true);
    for (let i = 0; i < hz; i++) glide(p, 0, 0, 1 / hz, false);
    return p;
  };
  const a = run(30),
    b = run(144);
  assert.ok(Math.abs(a.x - b.x) < 0.000001);
  assert.ok(a.vx < 0.000001);
});
void test('camera eases toward movement and freezes while paused', () => {
  const w = createOceanWorld(23);
  updateCamera(w, 1200, 800, 1 / 60);
  const a = { ...getView(w, 1200, 800) };
  w.player.x += 100;
  updateCamera(w, 1200, 800, 1 / 60);
  const b = { ...getView(w, 1200, 800) };
  assert.ok(b.cx > a.cx && b.cx < a.cx + 100);
  w.mode = 'paused';
  updateCamera(w, 1200, 800, 1 / 60);
  assert.deepEqual(getView(w, 1200, 800), b);
});
