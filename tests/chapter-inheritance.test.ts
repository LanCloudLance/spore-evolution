import { createOceanWorld, enterOcean } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, TRAITS } from '../app/game/simulation.ts';
import { retryOcean } from '../app/game/ocean.ts';
import { enterShore, retryShore } from '../app/game/shore.ts';
import { enterLand, retryLand } from '../app/game/land.ts';
import type { ColonyState } from '../app/game/colony.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import { spaceFromCivilization, expeditionRecord } from '../app/game/space.ts';
import {
  encodeSave,
  decodeSave,
  pausedCampaign,
} from '../app/game/campaign-save.ts';
import { revealing, skipEvolution } from '../app/game/evolution-experience.ts';

// Boundary fixtures deliberately isolate inheritance; continuous earned routes remain separate tests.
void test('pond cells become a protected visible birth with the real parent, all traits, retry and save continuity', () => {
  const w = createWorld(23);
  w.mode = 'won';
  w.generation = 3;
  w.age = 42;
  w.food = 12;
  w.traits = TRAITS.map((t) => t.id);
  const inherited = [...w.traits];
  assert.ok(enterOcean(w));
  assert.ok(revealing(w));
  assert.equal(w.evolution!.before.form, 'microbe');
  assert.equal(w.evolution!.before.generation, 3);
  assert.equal(w.evolution!.before.seconds, 42);
  assert.deepEqual(w.evolution!.before.traits, inherited);
  assert.deepEqual(w.traits, inherited);
  assert.equal(w.ocean!.morph!.from, 'microbe');
  assert.equal(w.ocean!.morph!.duration, w.evolution!.duration);
  const energy = w.player.energy,
    food = w.totalFood,
    health = w.player.health;
  for (let i = 0; i < 40; i++) stepWorld(w, { x: 1, y: 0, dash: true }, 0.05);
  assert.equal(w.player.energy, energy);
  assert.equal(w.player.health, health);
  assert.equal(w.totalFood, food);
  const saved = decodeSave(
    encodeSave({ journey: w, colony: null, active: 'journey' }),
  );
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') throw Error('save failed');
  const restored = pausedCampaign(saved.save.campaign).journey;
  const elapsed = restored.evolution!.elapsed;
  stepWorld(restored, { x: 1, y: 0, dash: true }, 0.05);
  assert.equal(restored.evolution!.elapsed, elapsed);
  assert.deepEqual(restored.evolution!.before.traits, inherited);
  restored.mode = 'running';
  assert.ok(skipEvolution(restored));
  assert.deepEqual(restored.traits, inherited);
  const retry = retryOcean(restored);
  assert.ok(revealing(retry));
  assert.deepEqual(retry.evolution!.before, w.evolution!.before);
  assert.equal(retry.generation, w.generation);
  assert.equal(retry.history.length, w.history.length);
  assert.equal(
    createOceanWorld().evolution,
    null,
    'independent entry cannot invent a parent',
  );
});

void test('non-default anatomy, adaptations and companions survive every later chapter boundary without aliases', () => {
  const w = createOceanWorld();
  w.form = 'jelly';
  w.mode = 'won';
  w.generation = 7;
  w.traits = ['flagellum', 'shell', 'vacuole'];
  const traits = [...w.traits];
  const body = {
    length: 1.4,
    width: 0.8,
    legs: 1.2,
    organs: { front: 'filter', left: 'spine', right: 'fin', tail: 'spine' },
  } as const;
  w.ocean!.body = structuredClone(body);
  assert.ok(enterShore(w));
  assert.equal(w.form, 'jelly');
  assert.deepEqual(w.shore!.body, body);
  assert.deepEqual(retryShore(w).shore!.body, body);
  assert.deepEqual(w.traits, traits);
  w.shore!.protection = 'reservoir';
  w.shore!.adaptations = ['reservoir', 'skin'];
  const friend = w.shore!.creatures.find((c) => c.role === 'ally')!;
  friend.joined = true;
  w.mode = 'won';
  assert.ok(enterLand(w));
  assert.equal(w.form, 'jelly');
  assert.deepEqual(w.land!.body, body);
  assert.equal(w.land!.protection, 'reservoir');
  assert.deepEqual(w.land!.adaptations, ['reservoir', 'skin']);
  assert.equal(w.land!.creatures.filter((c) => c.joined).length, 1);
  assert.equal(w.land!.creatures.find((c) => c.joined)!.shoreOrigin, friend.id);
  assert.deepEqual(retryLand(w).land!.body, body);
  w.form = 'stalker';
  w.land!.organ = 'plates';
  w.mode = 'won';
  const colony = colonyFromLand(w)!;
  const identity = (
    s: Pick<
      ColonyState,
      'form' | 'body' | 'traits' | 'adaptation' | 'adaptations' | 'generation'
    > & { organ?: ColonyState['organ'] },
  ) => ({
    form: s.form,
    body: s.body,
    traits: s.traits,
    organ: s.organ,
    adaptation: s.adaptation,
    adaptations: s.adaptations,
    generation: s.generation,
  });
  const expected = {
    form: 'stalker',
    body,
    traits,
    organ: 'plates',
    adaptation: 'reservoir',
    adaptations: ['reservoir', 'skin'],
    generation: 7,
  };
  assert.deepEqual(identity(colony), expected);
  assert.equal(colony.members[0].form, 'skipper');
  assert.notEqual(colony.body, w.land!.body);
  colony.mode = 'won';
  colony.growth = 100;
  colony.shelter = true;
  const tribe = tribeFromColony(colony)!;
  assert.deepEqual(identity(tribe), expected);
  tribe.mode = 'won';
  tribe.camp = true;
  tribe.banks.forEach((b) => (b.work = 6));
  tribe.neighbors.forEach((n) => (n.trust = 2));
  const city = civilizationFromTribe(tribe)!;
  assert.deepEqual(identity(city), expected);
  assert.deepEqual(
    city.couriers.map((c) => c.form),
    ['stalker', 'skipper'],
  );
  city.mode = 'won';
  city.launched = true;
  city.bridgeFixed = true;
  const space = spaceFromCivilization(city)!;
  assert.deepEqual(identity(space), expected);
  assert.deepEqual(
    space.crew.map((c) => c.form),
    ['stalker', 'skipper'],
  );
  const saved = decodeSave(
    encodeSave({
      journey: w,
      colony: { checkpoint: colony, current: colony },
      tribe: { checkpoint: tribe, current: tribe },
      city: { checkpoint: city, current: city },
      space: { checkpoint: space, current: space },
      active: 'space',
    }),
  );
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') throw Error('save failed');
  assert.deepEqual(saved.save.campaign.space!.current.adaptations, [
    'reservoir',
    'skin',
  ]);
  space.mode = 'won';
  space.outpost = {
    planet: 'tide',
    habitat: 'dome',
    settings: { water: 2, light: 1, heat: 1 },
    growth: 100,
    stability: 100,
    trial: 30,
    foodClock: 0,
  };
  const record = expeditionRecord(space, 1)!;
  assert.deepEqual(identity(record), expected);
  record.adaptations!.pop();
  assert.deepEqual(space.adaptations, ['reservoir', 'skin']);
  assert.deepEqual(colony.adaptations, ['reservoir', 'skin']);
  record.body.organs.tail = 'fin';
  assert.equal(space.body.organs.tail, 'spine');
  assert.equal(tribe.body.organs.tail, 'spine');
  assert.equal(colony.body.organs.tail, 'spine');
});
