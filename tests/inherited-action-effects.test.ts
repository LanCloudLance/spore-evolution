import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld } from '../app/game/land.ts';
import { activateLandFeature } from '../app/game/land-features.ts';
import {
  createColonyWorld,
  stepColony,
  COLONY_NEST,
} from '../app/game/colony.ts';
import { tidalFixture } from './helpers/tidal-world.ts';
import { stepTidalEcology } from '../app/game/tidal/ecology.ts';
import { observeTidalSignals } from '../app/game/tidal/discovery.ts';
import { landEcologyGoal } from '../app/game/land-ecology.ts';
import { startLandDrought } from '../app/game/land-drought.ts';

void test('horns strike a nearby threat in front, leaving the rear threat untouched', () => {
  const w = createLandWorld(41);
  Object.assign(w.player, { x: 2400, y: 1400, angle: 0 });
  w.land!.features = ['horns'];
  w.land!.activeFeature = 'horns';
  const front = w.land!.creatures.find((c) => c.species === 'hunter')!;
  const rear = w.land!.creatures.find((c) => c.species === 'dusk-stalker')!;
  Object.assign(front, { x: 2460, y: 1400, health: 100, stun: 0 });
  Object.assign(rear, { x: 2340, y: 1400, health: 100, stun: 0 });
  w.land!.creatures = [front, rear];
  assert.ok(activateLandFeature(w));
  assert.ok(front.health < 100);
  assert.equal(rear.health, 100);
  assert.equal(rear.stun, 0);
});

void test('inherited legs change actual member travel without duplicating a gathered unit', () => {
  const base = createColonyWorld();
  base.mode = 'running';
  base.members = [base.members[0]];
  base.patches = [];
  Object.assign(base.members[0], {
    x: COLONY_NEST.x + 200,
    y: COLONY_NEST.y,
    carrying: 'food',
  });
  const runner = structuredClone(base);
  runner.members[0].features = ['leap'];
  stepColony(base, { x: 0, y: 0 }, 0.1);
  stepColony(runner, { x: 0, y: 0 }, 0.1);
  assert.ok(runner.members[0].x < base.members[0].x);
  for (let i = 0; i < 120; i++) stepColony(runner, { x: 0, y: 0 }, 1 / 30);
  assert.equal(runner.food, base.food + 1);
  assert.equal(runner.delivered, 1);
});

void test('rooted members tend a real nearby food patch; guard structures reduce actual storm damage and freeze on pause', () => {
  const base = createColonyWorld();
  base.mode = 'running';
  base.members = [base.members[0]];
  Object.assign(base.members[0], {
    x: COLONY_NEST.x + 88,
    y: COLONY_NEST.y,
    role: 'guard',
  });
  base.patches = [
    {
      id: 0,
      kind: 'food',
      x: base.members[0].x,
      y: base.members[0].y,
      cooldown: 10,
    },
  ];
  base.shelter = true;
  base.storm = 40;
  const adapted = structuredClone(base);
  adapted.members[0].features = ['roots', 'burrow'];
  stepColony(base, { x: 0, y: 0 }, 0.1);
  stepColony(adapted, { x: 0, y: 0 }, 0.1);
  assert.ok(adapted.patches[0].cooldown < base.patches[0].cooldown);
  assert.ok(adapted.integrity > base.integrity);
  assert.equal(adapted.food, base.food);
  adapted.mode = 'paused';
  const frozen = structuredClone(adapted);
  stepColony(adapted, { x: 0, y: 0 }, 1);
  assert.deepEqual(adapted, frozen);
});

void test('one witnessed vent-tube feeding reveals both real structures once', () => {
  const w = tidalFixture();
  w.ocean!.tidal!.actors = [
    {
      id: 'tube',
      species: 'vent-tube',
      homeBiome: 'vent',
      x: 625,
      y: 1770,
      radius: 22,
      angle: 0,
      hunger: 80,
      health: 100,
      behavior: 'forage',
      targetId: null,
      phaseSeconds: 0,
      respawnSeconds: 0,
      trust: 0,
      carryingId: null,
    },
  ];
  w.ocean!.tidal!.foods = [
    {
      id: 'particle',
      kind: 'plankton',
      x: 625,
      y: 1770,
      energy: 8,
      biome: 'nursery',
      owner: null,
      state: 'available',
      regrowSeconds: 0,
    },
  ];
  const signals = stepTidalEcology(w, 0.05);
  assert.ok(signals.some((s) => s.kind === 'filter'));
  observeTidalSignals(w, signals);
  assert.ok(w.ocean!.discovered.includes('glow'));
  assert.ok(w.ocean!.discovered.includes('anchor'));
  assert.equal(w.dnaLineage?.sources['sea:vent-tube']?.methods?.observe, 1);
  assert.equal(w.dnaLineage?.sources['sea:vent-tube']?.units, 2);
  const once = structuredClone(w);
  observeTidalSignals(w, signals);
  assert.deepEqual(w, once);
});

void test('shell grazers demonstrate their taught burrowing structure in dry weather', () => {
  const w = createLandWorld(41);
  const grazer = w.land!.creatures.find((c) => c.species === 'shell-grazer')!;
  Object.assign(grazer, {
    x: grazer.home.x + 120,
    y: grazer.home.y,
    alert: false,
  });
  w.land!.tier = 1;
  w.land!.nests = [0];
  assert.ok(startLandDrought(w));
  w.land!.drought!.elapsed = 20;
  w.land!.drought!.phase = 'dry';
  const goal = landEcologyGoal(w, grazer, 0.05)!;
  assert.deepEqual(goal.target, grazer.home);
});
