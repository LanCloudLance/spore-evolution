import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../app/game/simulation.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
import {
  pondRadius,
  stepPondLife,
  targetPondPrey,
  guidePondHunt,
} from '../app/game/pond-life.ts';
import { enterOcean } from '../app/game/ocean.ts';
import { enterShore } from '../app/game/shore.ts';
import { enterLand } from '../app/game/land.ts';
import {
  colonyFromLand,
  createColonyWorld,
  colonyInteract,
  COLONY_NEST,
  colonyCapacity,
  colonyRepairAmount,
} from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import {
  spaceFromCivilization,
  expeditionRecord,
  travelCost,
  spaceActivity,
} from '../app/game/space.ts';
import {
  runPond,
  runShore,
  runLand,
  runColony,
} from './helpers/campaign-route.ts';
import { runTidalRoute } from './helpers/tidal-route.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { runCity } from './helpers/city-route.ts';
import { runSpace } from './helpers/space-route.ts';
import { arrive } from './helpers/space-route.ts';
import { continueStageLife } from '../app/game/stage-life.ts';
import { takeLearnedSkillInput } from '../app/game/dash-input.ts';
const learning = await import('../app/game/lineage-learning.ts').catch(
  () => null,
);

void test('a quick learned-skill tap survives a frame without a simulation tick and is consumed once', () => {
  const held = new Set(['c']);
  assert.equal(takeLearnedSkillInput(held, false), false);
  assert.ok(held.has('c'));
  assert.equal(takeLearnedSkillInput(held, true), true);
  assert.equal(takeLearnedSkillInput(held, true), false);
});

void test('a clicked living prey stays targeted while it moves; contact earns DNA and ends pursuit', () => {
  const w = createWorld(23);
  w.mode = 'running';
  const prey = w.pondLife!.prey[0];
  const id = targetPondPrey(w, prey);
  assert.equal(id, prey.id);
  assert.equal(targetPondPrey(w, { x: 0, y: 0 }), null);
  assert.equal(targetPondPrey(w, w.pondLife!.prey[6]), null);
  for (let i = 0; i < 2400 && prey.cooldown === 0; i++) {
    const chase = guidePondHunt(w, id!);
    assert.ok(chase);
    assert.deepEqual(chase.target, { x: prey.x, y: prey.y });
    stepWorld(w, { ...chase.input, dash: false }, 1 / 120);
  }
  assert.ok(prey.cooldown > 0);
  assert.equal(w.learning!.entries[0].source, 'pond:dart');
  assert.equal(guidePondHunt(w, id!), null);
  w.mode = 'paused';
  assert.equal(targetPondPrey(w, w.pondLife!.prey[1]), null);
  assert.equal(guidePondHunt(w, 1), null);
});

void test('a shell cell really blocks swallowing during its defensive pulse before its DNA can be learned (behavior fixture)', () => {
  const w = createWorld(23);
  w.mode = 'running';
  const prey = w.pondLife!.prey[1];
  Object.assign(w.player, prey);
  w.time = 4;
  stepPondLife(w, 0.05);
  assert.equal(prey.cooldown, 0);
  assert.equal(w.learning, undefined);
  w.time = 6;
  Object.assign(w.player, prey);
  stepPondLife(w, 0.05);
  assert.ok(prey.cooldown > 0);
  assert.ok(learning!.knowsSkill(w, 'ward'));
});

void test('the same pond predator can hurt a small body, flee a larger body and be swallowed only after real contact (geometry fixture)', () => {
  const small = createWorld(23);
  small.mode = 'running';
  small.foods = [];
  small.predators = small.predators.slice(0, 1);
  Object.assign(small.player, { x: 900, y: 900 });
  Object.assign(small.predators[0], {
    x: 930,
    y: 900,
    home: { x: 930, y: 900 },
  });
  stepWorld(small, { x: 0, y: 0, dash: false }, 0.05);
  assert.ok(small.player.health < 100);
  assert.equal(small.predators[0].respawn ?? 0, 0);
  const big = createWorld(23);
  big.mode = 'running';
  big.foods = [];
  big.generation = 2;
  big.pondLife!.biomass = 100;
  big.predators = big.predators.slice(0, 1);
  Object.assign(big.player, { x: 900, y: 900 });
  Object.assign(big.predators[0], { x: 970, y: 900, home: { x: 970, y: 900 } });
  assert.ok(pondRadius(big) > pondRadius(small));
  stepWorld(big, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(big.predators[0].alert, false);
  assert.ok(
    big.predators[0].x > 970,
    'smaller predators must flee instead of chasing the larger player',
  );
  Object.assign(big.predators[0], { x: 900, y: 900 });
  stepWorld(big, { x: 0, y: 0, dash: false }, 0.05);
  assert.ok(big.predators[0].respawn! > 0);
  assert.equal(big.food, 2);
  assert.equal(big.player.health, 100);
});

void test('earned pond DNA and later practiced techniques survive a normal eight-stage journey, checkpoints, save and expedition', () => {
  assert.ok(learning);
  const w = createWorld(23);
  w.mode = 'running';
  const prey = w.pondLife!.prey[0];
  for (let i = 0; i < 2400 && prey.cooldown === 0; i++) {
    const dx = prey.x - w.player.x,
      dy = prey.y - w.player.y,
      d = Math.hypot(dx, dy);
    stepWorld(
      w,
      { x: dx / Math.max(1, d), y: dy / Math.max(1, d), dash: false },
      1 / 120,
    );
  }
  assert.ok(learning!.selectLearnedSkill(w, 'jet', 'pond'));
  runPond(w);
  assert.ok(
    w.history.some((a) =>
      a.learning?.entries.some((e) => e.source === 'pond:dart'),
    ),
  );
  assert.ok(enterOcean(w));
  assert.ok(w.ocean!.checkpoint.learning!.learned.includes('jet'));
  runTidalRoute(w, 'hunt');
  assert.ok(enterShore(w));
  runShore(w);
  assert.ok(enterLand(w));
  runLand(w);
  const colony = colonyFromLand(w)!;
  colony.mode = 'running';
  runColony(colony);
  assert.ok(learning!.knowsSkill(colony, 'nurture'));
  const tribe = tribeFromColony(colony)!;
  runTribe(tribe);
  assert.ok(learning!.knowsSkill(tribe, 'weaving'));
  assert.ok(learning!.selectLearnedSkill(tribe, 'weaving', 'tribe'));
  const city = civilizationFromTribe(tribe)!;
  runCity(city, 'wind');
  assert.ok(learning!.knowsSkill(city, 'logistics'));
  const space = spaceFromCivilization(city)!;
  runSpace(space);
  assert.ok(learning!.knowsSkill(space, 'navigator'));
  assert.ok(learning!.knowsSkill(space, 'survey'));
  assert.ok(space.learning!.learned.includes('jet'));
  const receipt = expeditionRecord(space, 1)!;
  assert.deepEqual(receipt.learning, learning!.inheritedLearning(space));
  receipt.learning!.entries.pop();
  assert.notDeepEqual(receipt.learning!.entries, space.learning!.entries);
  const snapshot = {
    journey: w,
    colony: { checkpoint: colony, current: colony },
    tribe: { checkpoint: tribe, current: tribe },
    city: { checkpoint: city, current: city },
    space: { checkpoint: space, current: space },
    active: 'space' as const,
  };
  assert.equal(decodeSave(encodeSave(snapshot)).kind, 'ok');
  const baseline = travelCost(space, 'echo');
  assert.ok(learning!.selectLearnedSkill(space, 'navigator', 'space'));
  assert.equal(travelCost(space, 'echo'), Math.max(1, baseline - 1));
  assert.ok(continueStageLife(space));
  arrive(space, 'ember');
  assert.ok(learning!.selectLearnedSkill(space, 'survey', 'space'));
  assert.ok(spaceActivity(space, 'water'));
  assert.equal(space.activity!.remaining, 3.5);
});

void test('learned care changes real feeding while still paying food, and equipment can be exchanged without farming credits (effect fixture)', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  s.shelter = true;
  s.food = 10;
  s.growth = 60;
  Object.assign(s.player, COLONY_NEST);
  assert.ok(learning!.learnFrom(s, 'colony:care'));
  const plain = structuredClone(s);
  assert.ok(learning!.selectLearnedSkill(s, 'nurture', 'colony'));
  assert.ok(colonyInteract(plain));
  assert.ok(colonyInteract(s));
  assert.equal(s.food, plain.food);
  assert.equal(s.growth, plain.growth + 5);
  const credits = s.learning!.credits;
  assert.ok(learning!.selectLearnedSkill(s, null, 'colony'));
  assert.ok(learning!.selectLearnedSkill(s, 'nurture', 'colony'));
  assert.equal(s.learning!.credits, credits);
  assert.equal(learning!.learnFrom(s, 'colony:care'), false);
  assert.equal(s.learning!.credits, credits);
  assert.ok(learning!.learnFrom(s, 'tribe:basket'));
  assert.ok(learning!.selectLearnedSkill(s, 'weaving', 'colony'));
  assert.equal(colonyCapacity(s), 4);
  s.player.load = 4;
  s.player.carrying = 'food';
  const w = createWorld();
  assert.equal(
    decodeSave(
      encodeSave({
        journey: w,
        colony: { checkpoint: s, current: s },
        active: 'colony',
      }),
    ).kind,
    'ok',
  );
  assert.ok(learning!.learnFrom(s, 'tribe:hammer'));
  assert.ok(learning!.selectLearnedSkill(s, 'masonry', 'colony'));
  assert.equal(colonyRepairAmount(s), colonyRepairAmount(plain) + 4);
});

void test('paid shelter building and storm repair offer separate practical colony learning paths (interaction fixture)', () => {
  const s = createColonyWorld();
  s.mode = 'running';
  Object.assign(s.player, COLONY_NEST);
  assert.equal(colonyInteract(s), false);
  assert.equal(s.learning, undefined);
  s.wood = 8;
  s.food = 4;
  assert.ok(colonyInteract(s));
  assert.equal(s.wood, 0);
  assert.equal(s.food, 0);
  assert.equal(s.learning!.entries[0].source, 'colony:shelter');
  assert.ok(learning!.selectLearnedSkill(s, 'weaving', 'colony'));
  assert.equal(colonyCapacity(s), 4);
  s.storm = 10;
  s.integrity = 50;
  assert.equal(colonyInteract(s), false);
  assert.equal(s.learning!.entries.length, 1);
  s.wood = 1;
  assert.ok(colonyInteract(s));
  assert.equal(s.wood, 0);
  assert.equal(s.learning!.entries[1].source, 'colony:repair');
  assert.ok(learning!.selectLearnedSkill(s, 'masonry', 'colony'));
  assert.equal(colonyRepairAmount(s), 24);
});

void test('a real moving pond cell can be swallowed once, grant its DNA ability, and power a paid cooldown action', () => {
  assert.ok(learning, 'the lineage ability system is missing');
  const w = createWorld(23);
  w.mode = 'running';
  const prey = w.pondLife!.prey[0];
  for (let i = 0; i < 2400 && prey.cooldown === 0; i++) {
    const dx = prey.x - w.player.x,
      dy = prey.y - w.player.y,
      d = Math.hypot(dx, dy);
    stepWorld(
      w,
      { x: dx / Math.max(1, d), y: dy / Math.max(1, d), dash: false },
      1 / 120,
    );
  }
  assert.ok(prey.cooldown > 0, 'the prey was not actually caught');
  assert.ok(w.food >= 2);
  assert.equal(w.learning!.entries[0].source, 'pond:dart');
  assert.equal(w.learning!.credits, 2);
  assert.ok(learning!.selectLearnedSkill(w, 'jet', 'pond'));
  assert.equal(w.learning!.credits, 1);
  const energy = w.player.energy;
  stepWorld(w, { x: 1, y: 0, dash: false, learnedSkill: true }, 1 / 120);
  assert.ok(w.player.energy < energy - 10);
  assert.ok(w.learning!.active > 0);
  const cooldown = w.learning!.cooldown,
    paid = w.player.energy;
  stepWorld(w, { x: 1, y: 0, dash: false, learnedSkill: true }, 1 / 120);
  assert.ok(w.player.energy > paid - 1, 'cooldown must not charge twice');
  assert.ok(w.learning!.cooldown < cooldown);
  const before = structuredClone(w.learning);
  assert.equal(learning!.selectLearnedSkill(w, 'ward', 'pond'), false);
  assert.deepEqual(w.learning, before);
  const decoded = decodeSave(
    encodeSave({ journey: w, colony: null, active: 'journey' }),
  );
  assert.equal(decoded.kind, 'ok');
  if (decoded.kind === 'ok')
    assert.deepEqual(decoded.save.campaign.journey.learning, w.learning);
});

void test('unearned discoveries and malformed learning saves do not become inherited abilities', () => {
  assert.ok(learning);
  const w = createWorld();
  assert.equal(learning!.selectLearnedSkill(w, 'jet', 'pond'), false);
  for (const value of [
    { entries: [], credits: 99, equipped: null, cooldown: 0, active: 0 },
    { entries: [], credits: 0, equipped: 'jet', cooldown: 0, active: 0 },
    {
      entries: [{ source: 'fake', time: 0, generation: 1 }],
      credits: 2,
      equipped: null,
      cooldown: 0,
      active: 0,
    },
  ]) {
    const raw = JSON.parse(
      encodeSave({ journey: w, colony: null, active: 'journey' }),
    );
    raw.campaign.journey.learning = value;
    assert.equal(decodeSave(JSON.stringify(raw)).kind, 'invalid');
  }
});
