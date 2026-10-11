import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  stepWorld,
  reviseMicrobe,
  NURSERY,
} from '../app/game/simulation.ts';
import { stepPondLife, guidePondHunt } from '../app/game/pond-life.ts';
import { enterOcean } from '../app/game/ocean.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import {
  runPond,
  runShore,
  runLand,
  runColony,
} from './helpers/campaign-route.ts';
import { runTidalRoute } from './helpers/tidal-route.ts';
import { enterShore } from '../app/game/shore.ts';
import { enterLand } from '../app/game/land.ts';
import { colonyFromLand } from '../app/game/colony.ts';
const genes = await import('../app/game/dna-evolution.ts').catch(() => null);
const idle = { x: 0, y: 0, dash: false };
function catchFixture(w: ReturnType<typeof createWorld>, id: number) {
  const prey = w.pondLife!.prey[id];
  prey.cooldown = 0;
  w.time = 6;
  Object.assign(w.player, { x: prey.x, y: prey.y });
  stepPondLife(w, 0.01);
  assert.ok(prey.cooldown > 0);
}
void test('DNA comes from actual live-prey contact; nutrition and repeated-prey DNA are independent', () => {
  const w = createWorld(23);
  w.mode = 'running';
  const prey = w.pondLife!.prey[0];
  for (let i = 0; i < 2400 && prey.cooldown === 0; i++) {
    const chase = guidePondHunt(w, 0)!;
    stepWorld(w, { ...chase.input, dash: false }, 1 / 120);
  }
  assert.equal(w.dnaLineage?.sources.dart?.units, 2);
  const food = w.food;
  catchFixture(w, 0);
  assert.equal(w.dnaLineage!.sources.dart!.units, 3);
  catchFixture(w, 0);
  assert.equal(w.dnaLineage!.sources.dart!.units, 3);
  assert.equal(w.food, food + 4);
  assert.equal(w.dnaLineage!.sources.dart!.meals, 3);
});
void test('prey composition gates new body branches and rejected births leave food and ancestry untouched', () => {
  assert.ok(genes);
  const w = createWorld(23);
  w.mode = 'running';
  w.food = 8;
  w.player.energy = 80;
  const before = structuredClone(w);
  assert.equal(reviseMicrobe(w, ['flagellum', 'shell'], 'ram'), false);
  assert.deepEqual(w, before);
  catchFixture(w, 0);
  assert.equal(
    genes.microbeCandidates(w).find((c) => c.id === 'stream')!.available,
    true,
  );
  assert.equal(
    genes.microbeCandidates(w).find((c) => c.id === 'bastion')!.available,
    false,
  );
  catchFixture(w, 1);
  assert.equal(
    genes.microbeCandidates(w).find((c) => c.id === 'ram')!.available,
    true,
  );
  Object.assign(w.player, NURSERY);
  w.food = 8;
  assert.ok(reviseMicrobe(w, ['flagellum', 'shell'], 'ram'));
  assert.equal(w.dnaLineage!.body, 'ram');
  assert.equal(w.history[0].dnaLineage!.body, 'ancestor');
  assert.equal(w.history[0].dnaLineage!.sources.dart!.units, 2);
});
void test('body choices affect actual movement, foraging and charge contact with costs (geometry fixtures)', () => {
  assert.ok(genes);
  const make = (body: 'stream' | 'bastion' | 'grazer' | 'ram') => {
    const w = createWorld(23);
    w.mode = 'running';
    catchFixture(w, 0);
    catchFixture(w, 1);
    catchFixture(w, 2);
    w.food = 8;
    Object.assign(w.player, NURSERY);
    assert.ok(reviseMicrobe(w, genes.MICROBE_BODIES[body].traits, body));
    w.evolution = null;
    w.foods = [];
    w.pondLife!.prey.forEach((p) => (p.cooldown = 35));
    w.predators = [];
    return w;
  };
  const fast = make('stream'),
    armor = make('bastion');
  for (let i = 0; i < 60; i++) {
    stepWorld(fast, { x: 1, y: 0, dash: false }, 1 / 60);
    stepWorld(armor, { x: 1, y: 0, dash: false }, 1 / 60);
  }
  assert.ok(fast.player.x - NURSERY.x > (armor.player.x - NURSERY.x) * 1.5);
  assert.ok(fast.player.energy < armor.player.energy);
  const grazer = make('grazer');
  grazer.foods = [
    {
      id: 0,
      x: grazer.player.x + 68,
      y: grazer.player.y,
      cooldown: 0,
      rich: false,
    },
  ];
  stepWorld(grazer, idle, 0.01);
  assert.equal(grazer.food, 1);
  const ram = make('ram');
  const enemy = createWorld(23).predators[0];
  Object.assign(ram.player, { x: 900, y: 900, invulnerable: 0 });
  Object.assign(enemy, { x: 930, y: 900, home: { x: 930, y: 900 } });
  ram.predators = [enemy];
  stepWorld(ram, { x: 1, y: 0, dash: true }, 0.01);
  assert.ok(enemy.stun >= 2);
  assert.equal(ram.player.health, 100);
  assert.equal(enemy.respawn ?? 0, 0, 'a charge cannot grant ingestion DNA');
  assert.equal(ram.dnaLineage!.sources.hunter, undefined);
});
void test('DNA body and sources survive biological chapters, independent ancestor snapshots and save reload', () => {
  assert.ok(genes);
  const w = createWorld(23);
  w.mode = 'running';
  catchFixture(w, 0);
  const units = w.dnaLineage!.sources.dart!.units;
  runPond(w);
  assert.ok(enterOcean(w));
  assert.equal(w.dnaLineage!.sources.dart!.units, units);
  w.dnaLineage!.sources.dart!.units++;
  assert.equal(w.ocean!.checkpoint.dnaLineage!.sources.dart!.units, units);
  w.dnaLineage!.sources.dart!.units--;
  runTidalRoute(w, 'hunt');
  assert.ok(enterShore(w));
  runShore(w);
  assert.ok(enterLand(w));
  runLand(w);
  const colony = colonyFromLand(w)!;
  colony.mode = 'running';
  runColony(colony);
  assert.equal(colony.dnaLineage!.sources.dart!.units, units);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const save = session.snapshot('journey');
  const loaded = decodeSave(encodeSave(save));
  assert.equal(loaded.kind, 'ok');
  if (loaded.kind === 'ok') {
    session.restore(loaded.save.campaign);
    assert.equal(
      session.journey.getWorld().dnaLineage!.sources.dart!.units,
      units,
    );
  }
  const malformed = JSON.parse(encodeSave(save));
  malformed.campaign.journey.dnaLineage.sources.dart.units = -1;
  assert.equal(decodeSave(JSON.stringify(malformed)).kind, 'invalid');
  const legacy = structuredClone(save);
  delete legacy.journey.dnaLineage;
  session.restore(legacy);
  assert.equal(session.journey.getWorld().dnaLineage, undefined);
});

void test('a selected body remains inherited through later births and saves, and new generations replenish DNA yield', () => {
  assert.ok(genes);
  const w = createWorld(23);
  w.mode = 'running';
  catchFixture(w, 0);
  catchFixture(w, 0);
  catchFixture(w, 0);
  w.food = 8;
  Object.assign(w.player, NURSERY);
  assert.ok(reviseMicrobe(w, ['flagellum'], 'stream'));
  w.evolution = null;
  catchFixture(w, 0);
  assert.equal(w.dnaLineage!.sources.dart!.units, 5);
  w.food = 8;
  Object.assign(w.player, NURSERY);
  assert.ok(reviseMicrobe(w, ['flagellum', 'shell']));
  assert.equal(w.dnaLineage!.body, 'stream');
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  assert.equal(decodeSave(encodeSave(session.snapshot('journey'))).kind, 'ok');
  w.mode = 'won';
  assert.ok(enterOcean(w));
  assert.equal(w.dnaLineage!.body, 'stream');
  assert.equal(w.ocean!.body.length, 1.3);
  assert.equal(w.ocean!.body.width, 0.75);
});

void test('paused contact and an NPC meal award no player DNA or nutrition', () => {
  const w = createWorld(23),
    prey = w.pondLife!.prey[0];
  Object.assign(w.player, { x: prey.x, y: prey.y });
  w.mode = 'paused';
  stepPondLife(w, 0.01);
  assert.equal(w.dnaLineage, undefined);
  assert.equal(w.food, 0);
  w.mode = 'running';
  Object.assign(w.player, { x: 0, y: 0 });
  Object.assign(w.predators[0], { x: prey.x, y: prey.y });
  stepPondLife(w, 0.01);
  assert.ok(prey.cooldown > 0);
  assert.equal(w.dnaLineage, undefined);
  assert.equal(w.food, 0);
});

void test('a hybrid charge protects its leading face, but rear bites remain dangerous (geometry fixture)', () => {
  const w = createWorld(23);
  w.mode = 'running';
  catchFixture(w, 0);
  catchFixture(w, 1);
  w.food = 8;
  Object.assign(w.player, NURSERY);
  assert.ok(reviseMicrobe(w, ['flagellum', 'shell'], 'ram'));
  w.evolution = null;
  w.foods = [];
  w.pondLife!.prey.forEach((p) => (p.cooldown = 35));
  Object.assign(w.player, { x: 900, y: 900, angle: 0, invulnerable: 0 });
  const enemy = w.predators[0];
  Object.assign(enemy, { x: 870, y: 900, home: { x: 870, y: 900 } });
  w.predators = [enemy];
  stepWorld(w, { x: 1, y: 0, dash: true }, 0.01);
  assert.ok(w.player.health < 100);
});
