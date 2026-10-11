import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../app/game/simulation.ts';
import * as pond from '../app/game/pond-life.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
function receipt(w: ReturnType<typeof createWorld>) {
  return w.dnaLineage?.sources.feather;
}
const idle = { x: 0, y: 0, dash: false };
function scene() {
  const w = createWorld(23);
  w.mode = 'running';
  w.foods = [];
  w.predators = [];
  const p = w.pondLife!.prey[2];
  Object.assign(w.player, { x: p.x - 110, y: p.y });
  return w;
}
void test('paid pond sharing records symbiosis only when the named recipient really reaches its gift', () => {
  const w = scene();
  w.food = 3;
  assert.equal(typeof pond.sharePondNutrition, 'function');
  assert.ok(pond.sharePondNutrition(w));
  assert.equal(w.food, 2);
  assert.equal(receipt(w), undefined);
  for (let i = 0; i < 120; i++) stepWorld(w, idle, 0.05);
  assert.ok(receipt(w)?.methods?.symbiosis);
  assert.equal(w.food, 2);
  assert.equal(w.pondLife!.prey[2].cooldown, 0);
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('actual sustained pond observation earns a source once per life; menus and paused time cannot complete it', () => {
  const w = scene();
  w.mode = 'paused';
  for (let i = 0; i < 60; i++) stepWorld(w, idle, 0.05);
  assert.equal(receipt(w), undefined);
  w.mode = 'running';
  for (let i = 0; i < 60; i++) stepWorld(w, idle, 0.05);
  assert.ok(receipt(w)?.methods?.observe);
  const meals = receipt(w)!.meals;
  for (let i = 0; i < 60; i++) stepWorld(w, idle, 0.05);
  assert.equal(receipt(w)!.meals, meals);
});
