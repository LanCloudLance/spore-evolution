import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShoreWorld,
  evolveShore,
  SHORE_POOLS,
} from '../app/game/shore.ts';
import { createWorld, reproduce } from '../app/game/simulation.ts';
import {
  evolutionFrame,
  evolutionStructure,
} from '../app/game/evolution-presentation.ts';
import { createLandWorld, interactLand, evolveLand } from '../app/game/land.ts';
import { skipEvolution } from '../app/game/evolution-experience.ts';

void test('structural reveal unfolds new limbs while preserving inherited organs and the saved body', () => {
  const w = createShoreWorld();
  w.food = 8;
  w.shore!.discovered = ['support'];
  w.shore!.body.organs.tail = 'spine';
  assert.ok(evolveShore(w, 'skipper'));
  assert.equal(w.shore!.morph!.duration, w.evolution!.duration);
  assert.equal(w.evolution!.duration, 5.4);
  const body = structuredClone(w.shore!.body);
  const before = structuredClone(w.evolution!.before);
  const start = evolutionFrame(w)!;
  assert.equal(start.formation.limbs, 0);
  assert.equal(start.formation.organs.tail, 1);
  assert.equal(start.parentOpacity, 1);
  assert.equal(start.childOpacity, 0);
  w.evolution!.elapsed = w.evolution!.duration * 0.5;
  const middle = evolutionFrame(w)!;
  assert.ok(middle.formation.limbs > 0 && middle.formation.limbs < 1);
  assert.match(evolutionStructure(w).title, /足垫/);
  const still = structuredClone(w);
  assert.equal(evolutionFrame(w, true)!.formation.limbs, 1);
  assert.equal(evolutionFrame(w, true)!.phase, 2);
  assert.deepEqual(
    w,
    still,
    'reduced motion does not advance the actual simulation',
  );
  assert.deepEqual(w.shore!.body, body);
  assert.deepEqual(w.evolution!.before, before);
  assert.ok(skipEvolution(w));
  assert.equal(evolutionFrame(w)!.formation.limbs, 1);
  assert.equal(w.shore!.morph!.elapsed, w.shore!.morph!.duration);
});
void test('a new skin forms over existing full-sized limbs rather than regrowing the whole animal', () => {
  const w = createShoreWorld();
  w.form = 'skipper';
  w.shore!.tier = 1;
  w.food = 12;
  w.shore!.visited.push(SHORE_POOLS[2].name);
  w.shore!.discovered = ['support', 'moisture'];
  assert.ok(evolveShore(w, 'skin'));
  const start = evolutionFrame(w)!;
  assert.equal(start.formation.limbs, 1);
  assert.equal(start.formation.adaptation, 0);
  w.evolution!.elapsed = w.evolution!.duration * 0.6;
  const mid = evolutionFrame(w)!;
  assert.ok(mid.formation.adaptation > 0 && mid.formation.adaptation < 1);
  assert.match(evolutionStructure(w).title, /皮膜/);
});
void test('new pond traits extend gradually and inherited traits stay fully visible', () => {
  const w = createWorld();
  w.mode = 'running';
  w.traits = ['shell'];
  w.food = 8;
  assert.ok(reproduce(w, 'flagellum'));
  assert.equal(evolutionFrame(w)!.traits.shell, 1);
  assert.equal(evolutionFrame(w)!.traits.flagellum, 0);
  w.evolution!.elapsed = w.evolution!.duration * 0.55;
  const f = evolutionFrame(w)!;
  assert.ok(f.traits.flagellum! > 0 && f.traits.flagellum! < 1);
  assert.equal(f.traits.shell, 1);
});
void test('land birth preserves an inherited adaptation while new limbs grow', () => {
  const w = createLandWorld();
  w.land!.protection = 'reservoir';
  w.food = 40;
  interactLand(w);
  w.land!.discovered = ['fern'];
  assert.ok(evolveLand(w, 'strider'));
  assert.equal(evolutionFrame(w)!.formation.adaptation, 1);
  assert.equal(evolutionFrame(w)!.formation.limbs, 0);
  const before = JSON.stringify(w);
  evolutionFrame(w);
  evolutionStructure(w);
  assert.equal(JSON.stringify(w), before);
});
