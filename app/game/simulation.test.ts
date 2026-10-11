import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  stepWorld,
  reproduce,
  reproductionGate,
  getStats,
  NURSERY,
  HAVEN,
} from './simulation.ts';

const idle = { x: 0, y: 0, dash: false };
function running() {
  const w = createWorld(17);
  w.mode = 'running';
  w.predators = [];
  w.foods = [];
  return w;
}
function tick(
  w: ReturnType<typeof createWorld>,
  seconds: number,
  input = idle,
) {
  for (let i = 0; i < seconds * 60; i++) stepWorld(w, input, 1 / 60);
}

void test('paused simulation preserves energy, position and time', () => {
  const w = running();
  w.mode = 'paused';
  const before = structuredClone(w);
  tick(w, 2, { x: 1, y: 0, dash: true });
  assert.deepEqual(w, before);
});
void test('food is consumed once, then unavailable until regrown', () => {
  const w = running();
  w.player.energy = 40;
  w.foods = [{ id: 1, x: w.player.x, y: w.player.y, cooldown: 0, rich: false }];
  tick(w, 0.1);
  assert.equal(w.food, 1);
  assert.ok(w.player.energy > 48);
  tick(w, 0.1);
  assert.equal(w.food, 1);
});
void test('dashing moves farther and spends more energy than ordinary swimming', () => {
  const a = running(),
    b = running();
  tick(a, 1, { x: 1, y: 0, dash: false });
  tick(b, 1, { x: 1, y: 0, dash: true });
  assert.ok(b.player.x > a.player.x + 70);
  assert.ok(b.player.energy < a.player.energy - 3);
});
void test('reproduction refuses insufficient nutrition and unsafe locations', () => {
  const w = running();
  assert.notEqual(reproductionGate(w), '');
  assert.equal(reproduce(w, 'shell'), false);
  w.food = 8;
  w.player.x = 1300;
  assert.equal(reproduce(w, 'shell'), false);
  assert.equal(w.generation, 1);
});
void test('reproduction preserves traits and records the actual parent before resetting food', () => {
  const w = running();
  w.food = 8;
  assert.equal(reproductionGate(w), '');
  assert.equal(reproduce(w, 'shell'), true);
  assert.equal(w.generation, 2);
  assert.equal(w.food, 0);
  assert.deepEqual(w.history[0].traits, []);
  assert.equal(w.history[0].food, 8);
  assert.deepEqual(w.traits, ['shell']);
  assert.equal(reproduce(w, 'flagellum'), false);
  tick(w, w.evolution!.duration + 0.1);
  w.food = 8;
  w.player.energy = 80;
  assert.equal(reproduce(w, 'flagellum'), true);
  assert.equal(w.generation, 3);
  assert.deepEqual(w.history[1].traits, ['shell']);
  assert.deepEqual(w.traits, ['shell', 'flagellum']);
  assert.equal(reproduce(w, 'spikes'), false);
});
void test('traits change actual survival tradeoffs', () => {
  const base = getStats([]),
    shell = getStats(['shell']),
    tail = getStats(['flagellum']);
  assert.ok(shell.damage < base.damage);
  assert.ok(shell.speed < base.speed);
  assert.ok(tail.speed > base.speed);
  assert.ok(tail.metabolism > base.metabolism);
  assert.equal(getStats(['vacuole']).maxEnergy, 145);
});
void test('only a living third generation can settle, and the ending stays frozen', () => {
  const w = running();
  w.player.x = HAVEN.x;
  w.player.y = HAVEN.y;
  tick(w, 0.1);
  assert.equal(w.mode, 'running');
  w.generation = 3;
  tick(w, 0.1);
  assert.equal(w.mode, 'won');
  const before = structuredClone(w);
  tick(w, 2);
  assert.deepEqual(w, before);
  const dead = running();
  dead.generation = 3;
  dead.player.x = HAVEN.x;
  dead.player.y = HAVEN.y;
  dead.player.health = 0;
  tick(dead, 0.1);
  assert.equal(dead.mode, 'dead');
});
void test('movement remains inside map boundaries and energy cannot become negative', () => {
  const w = running();
  w.player.x = 21;
  w.player.energy = 0.001;
  tick(w, 1, { x: -1, y: 0, dash: true });
  assert.ok(w.player.x >= 20);
  assert.ok(w.player.energy >= 0);
});
void test('all seeded worlds provide food and keep initial predators outside the nursery', () => {
  for (const seed of [1, 4, 9, 32]) {
    const w = createWorld(seed);
    assert.ok(w.foods.length >= 60);
    assert.ok(w.predators.length >= 5);
    assert.ok(
      w.predators.every(
        (p) =>
          Math.hypot(p.x - NURSERY.x, p.y - NURSERY.y) > NURSERY.radius + 80,
      ),
    );
  }
});
