import { guideNavigation } from '../app/game/navigation.ts';
import { tidalObstacles } from '../app/game/tidal/habitat.ts';
import { trunkCircles } from '../app/game/body-geometry.ts';
import { distance } from '../app/game/simulation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OCEAN_NURSERY,
  createOceanWorld,
  enterOcean,
} from '../app/game/ocean.ts';
import { createWorld, stepWorld } from '../app/game/simulation.ts';
import {
  catchTidalActor,
  takeTidalFood,
  shareTidalNutrition,
  consumeTidalFood,
  stepTidalEcology,
  TIDAL_SHARE_RADIUS,
} from '../app/game/tidal/ecology.ts';
import {
  stepTidalAbilities,
  applyTidalCommand,
  tidalMovement,
} from '../app/game/tidal/abilities.ts';
import { worldBodyPose } from '../app/game/body-geometry.ts';
import { organAnchor, listOrgans, hasOrgan } from '../app/game/body-layout.ts';
import { bodyEffects, bodyBirthCost } from '../app/game/body-design.ts';
import { stepPondLife } from '../app/game/pond-life.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { runTidalRoute } from './helpers/tidal-route.ts';
import { enterShore } from '../app/game/shore.ts';
import { TIDAL_FOOD_LIMIT } from '../app/game/tidal/types.ts';
import type { SpeciesId } from '../app/game/tidal/types.ts';
const evolution = await import('../app/game/ocean-dna.ts').catch(() => null);
function mouthCatch(
  w: ReturnType<typeof createOceanWorld>,
  species: SpeciesId,
) {
  const actor = w.ocean!.tidal!.actors.find((a) => a.species === species)!;
  const mouth = organAnchor(
    worldBodyPose(w),
    listOrgans(w.ocean!.body).find((p) => p.organ === 'jaw')!,
  );
  Object.assign(actor, mouth, {
    health: 100,
    respawnSeconds: 0,
    behavior: 'forage',
    carryingId: null,
  });
  assert.ok(catchTidalActor(w, actor.id) > 0);
  return actor;
}
void test('ocean DNA is prey-specific, awarded once on actual mouth contact, and independent of nutrition (geometry fixture)', () => {
  const w = createOceanWorld(23),
    actor = mouthCatch(w, 'silver-dart');
  assert.equal(w.dnaLineage?.sources['sea:silver-dart']?.units, 2);
  assert.equal(catchTidalActor(w, actor.id), 0);
  assert.equal(w.dnaLineage!.sources['sea:silver-dart']!.meals, 1);
  assert.equal(w.dnaLineage!.sources.dart, undefined);
  assert.equal(
    w.food,
    0,
    'resource ingestion stays in the ecology ability loop',
  );
  mouthCatch(w, 'silver-dart');
  mouthCatch(w, 'silver-dart');
  assert.equal(w.dnaLineage!.sources['sea:silver-dart']!.units, 3);
});
void test('source-gated ocean births are atomic, charge actual anatomy costs and preserve parent and organs', () => {
  assert.ok(evolution);
  const w = createOceanWorld(23),
    before = structuredClone(w);
  assert.equal(evolution.commitOceanDna(w, 'silverflow'), false);
  assert.deepEqual(w, before);
  mouthCatch(w, 'silver-dart');
  const draft = evolution.oceanDnaDraft(w, 'silverflow')!;
  assert.ok(hasOrgan(draft, 'jaw'));
  assert.ok(hasOrgan(draft, 'fin'));
  assert.ok(hasOrgan(draft, 'lateral'));
  const cost = bodyBirthCost(w, draft),
    dna = w.ocean!.dna,
    body = structuredClone(w.ocean!.body);
  assert.ok(evolution.commitOceanDna(w, 'silverflow'));
  assert.equal(w.ocean!.dna, dna - cost);
  assert.deepEqual(w.history[0].body, body);
  assert.equal(w.history[0].dnaLineage!.oceanBody, undefined);
  assert.equal(w.dnaLineage!.oceanBody, 'silverflow');
  assert.ok(bodyEffects(w.ocean!.body).speed > bodyEffects(body).speed);
  assert.ok(bodyEffects(w.ocean!.body).turn < bodyEffects(body).turn);
  const low = createOceanWorld(23);
  mouthCatch(low, 'silver-dart');
  low.ocean!.dna = 0;
  const snapshot = structuredClone(low);
  assert.equal(evolution.commitOceanDna(low, 'silverflow'), false);
  assert.deepEqual(low, snapshot);
});
void test('paid sharing grants DNA only after the recipient actually eats; pause, stale commands and replay pay nothing', () => {
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const recipient = t.actors.find((a) => a.species === 'fanworm')!;
  Object.assign(recipient, {
    x: w.player.x + 92,
    y: w.player.y,
    behavior: 'forage',
    hunger: 70,
  });
  t.actors = [recipient];
  w.food = 1;
  const energy = w.player.energy;
  applyTidalCommand(w, { id: 1, kind: 'interact' });
  assert.equal(w.food, 0);
  assert.equal(w.player.energy, energy);
  assert.equal(w.dnaLineage, undefined);
  const gift = t.foods.find((f) => f.reservedFor === recipient.id)!;
  assert.ok(gift);
  assert.equal(
    consumeTidalFood(w, gift.id, recipient.id),
    0,
    'unowned food cannot be consumed remotely',
  );
  w.mode = 'paused';
  stepTidalEcology(w, 0.05);
  assert.equal(w.dnaLineage, undefined);
  w.mode = 'running';
  applyTidalCommand(w, { id: 1, kind: 'interact' });
  for (let i = 0; i < 360 && gift.state !== 'consumed'; i++) {
    stepTidalEcology(w, 1 / 120);
    stepTidalAbilities(w, 1 / 120);
  }
  assert.equal(gift.state, 'consumed');
  assert.equal(w.dnaLineage!.sources['sea:fanworm']!.units, 2);
  assert.equal(w.dnaLineage!.sources['sea:fanworm']!.method, 'symbiosis');
  assert.ok(w.ocean!.discovered.includes('filter'));
  assert.equal(consumeTidalFood(w, gift.id, recipient.id), 0);
  assert.equal(w.dnaLineage!.sources['sea:fanworm']!.meals, 1);
  assert.equal(w.food, 0, 'sharing may not feed the player back');
});
void test('ancestral armor combines with ocean propulsion; filtered anatomy really changes feeding and shell actions', () => {
  assert.ok(evolution);
  const w = createWorld(23);
  w.mode = 'running';
  w.time = 6;
  const p = w.pondLife!.prey[1];
  Object.assign(w.player, { x: p.x, y: p.y });
  stepPondLife(w, 0.01);
  w.generation = 3;
  w.mode = 'won';
  assert.ok(enterOcean(w));
  w.ocean!.morph = null;
  w.evolution = null;
  mouthCatch(w, 'silver-dart');
  assert.equal(
    evolution.oceanDnaCandidates(w).find((c) => c.id === 'shellrunner')!
      .available,
    true,
  );
  assert.ok(evolution.commitOceanDna(w, 'shellrunner'));
  w.ocean!.morph = null;
  w.evolution = null;
  assert.ok(hasOrgan(w.ocean!.body, 'shell'));
  applyTidalCommand(w, { id: 1, kind: 'slot1' });
  assert.ok(w.ocean!.tidal!.abilities.shellSeconds > 0);
  assert.equal(tidalMovement(w).dash, false);
  const filter = createOceanWorld(23);
  mouthCatch(filter, 'fanworm');
  assert.ok(evolution.commitOceanDna(filter, 'fancrest'));
  filter.ocean!.morph = null;
  filter.evolution = null;
  const actor = filter.ocean!.tidal!.actors.find(
    (a) => a.species === 'silver-dart',
  )!;
  const mouth = organAnchor(
    worldBodyPose(filter),
    listOrgans(filter.ocean!.body).find((p) => p.organ === 'jaw')!,
  );
  Object.assign(actor, mouth);
  applyTidalCommand(filter, { id: 1, kind: 'slot1' });
  stepTidalAbilities(filter, 0.01);
  assert.equal(actor.health, 100);
  assert.equal(tidalMovement(filter).speed, 0.38);
});
void test('clicked ocean prey stays targeted as it swims and earns DNA only after normal simulation contact', () => {
  assert.ok(evolution);
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const prey = t.actors
    .filter((a) => a.species === 'silver-dart')
    .sort(
      (a, b) =>
        Math.hypot(a.x - w.player.x, a.y - w.player.y) -
        Math.hypot(b.x - w.player.x, b.y - w.player.y),
    )[0];
  const id = evolution.targetOceanPrey(w, prey);
  assert.equal(id, prey.id);
  for (let i = 0; i < 3600 && prey.health > 0; i++) {
    const guide = evolution.guideOceanActor(w, id!, 'hunt');
    assert.ok(guide);
    stepWorld(w, { ...guide.input, dash: false }, 1 / 120);
  }
  assert.equal(prey.health, 0);
  assert.ok(w.dnaLineage!.sources['sea:silver-dart']!.units >= 2);
  assert.equal(evolution.guideOceanActor(w, id!, 'hunt'), null);
  const navigation = {
    target: { x: OCEAN_NURSERY.x, y: OCEAN_NURSERY.y },
    last: { x: w.player.x, y: w.player.y },
    stalled: 0,
  };
  for (let i = 0; i < 2400 && distance(w.player, OCEAN_NURSERY) > 30; i++) {
    const clearance = Math.max(
      ...trunkCircles(worldBodyPose(w)).map(
        (c) => distance(c, w.player) + c.radius,
      ),
    );
    const input = guideNavigation(navigation, w.player, 1 / 120, {
      obstacles: tidalObstacles(0),
      clearance,
    });
    assert.ok(
      input,
      'return guidance must keep swimming rather than getting stuck',
    );
    stepWorld(w, { ...input, dash: false }, 1 / 120);
  }
  assert.ok(distance(w.player, OCEAN_NURSERY) < OCEAN_NURSERY.radius);
  assert.ok(
    evolution.commitOceanDna(w, 'silverflow'),
    'actual hunting and swimming pay for the birth without fixture rewards',
  );
});
void test('a DNA-grown ocean body completes a real ocean route and survives shore migration and save reload', () => {
  assert.ok(evolution);
  const w = createOceanWorld(23);
  mouthCatch(w, 'silver-dart');
  assert.ok(evolution.commitOceanDna(w, 'silverflow'));
  runTidalRoute(w, 'hunt');
  assert.ok(enterShore(w));
  assert.equal(w.dnaLineage!.oceanBody, 'silverflow');
  assert.ok(w.history.some((a) => a.dnaLineage?.sources['sea:silver-dart']));
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const save = session.snapshot('journey');
  assert.equal(decodeSave(encodeSave(save)).kind, 'ok');
  const bad = JSON.parse(encodeSave(save));
  bad.campaign.journey.dnaLineage.oceanBody = 'unknown';
  assert.equal(decodeSave(JSON.stringify(bad)).kind, 'invalid');
});

void test('funded gifts preserve food ownership, survive save reload and obey the bounded food pool', () => {
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const recipient = t.actors.find((a) => a.species === 'fanworm')!;
  Object.assign(recipient, { x: w.player.x + 92, y: w.player.y, hunger: 70 });
  t.actors = [recipient];
  w.food = 2;
  assert.ok(shareTidalNutrition(w));
  const gift = t.foods.find((f) => f.reservedFor === recipient.id)!;
  assert.equal(takeTidalFood(w, gift.id, 'player'), null);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  assert.equal(decodeSave(encodeSave(session.snapshot('journey'))).kind, 'ok');
  const before = structuredClone(w);
  assert.equal(shareTidalNutrition(w), false);
  assert.deepEqual(w, before);
  const full = createOceanWorld(23),
    ft = full.ocean!.tidal!;
  const friend = ft.actors.find((a) => a.species === 'fanworm')!;
  Object.assign(friend, { x: full.player.x + 92, y: full.player.y });
  ft.actors = [friend];
  full.food = 1;
  while (ft.foods.length < TIDAL_FOOD_LIMIT)
    ft.foods.push({ ...ft.foods[0], id: `fixture:${ft.foods.length}` });
  const snapshot = structuredClone(full);
  assert.equal(shareTidalNutrition(full), false);
  assert.deepEqual(full, snapshot);
});
void test('a valid ocean-body name cannot be loaded without its earned source DNA', () => {
  assert.ok(evolution);
  const w = createOceanWorld(23);
  mouthCatch(w, 'silver-dart');
  assert.ok(evolution.commitOceanDna(w, 'silverflow'));
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const saved = JSON.parse(encodeSave(session.snapshot('journey')));
  saved.campaign.journey.dnaLineage.sources['sea:silver-dart'].units = 0;
  assert.equal(decodeSave(JSON.stringify(saved)).kind, 'invalid');
});
void test('a moving symbiosis partner stays within actual F reach without accidental hunting or invented DNA (approach fixture)', () => {
  assert.ok(evolution);
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const actor = t.actors.find((a) => a.species === 'fanworm')!;
  Object.assign(actor, { x: w.player.x + 95, y: w.player.y, hunger: 70 });
  t.actors = [actor];
  w.food = 1;
  for (let i = 0; i < 480; i++) {
    const guide = evolution.guideOceanActor(w, actor.id, 'visit');
    assert.ok(
      guide,
      'a close partner must remain followed rather than abandoned',
    );
    stepWorld(w, { ...guide.input, dash: false }, 1 / 120);
  }
  assert.ok(distance(w.player, actor) <= TIDAL_SHARE_RADIUS);
  assert.equal(structuredClone(w).dnaLineage, undefined);
  assert.equal(actor.health, 100);
  applyTidalCommand(w, { id: 1, kind: 'interact' });
  assert.equal(w.food, 0);
  for (let i = 0; i < 600 && !w.dnaLineage?.sources['sea:fanworm']; i++) {
    const guide = evolution.guideOceanActor(w, actor.id, 'visit');
    stepWorld(w, { ...(guide?.input ?? { x: 0, y: 0 }), dash: false }, 1 / 120);
  }
  assert.equal(w.dnaLineage!.sources['sea:fanworm']!.methods?.symbiosis, 1);
  assert.equal(w.dnaLineage!.sources['sea:fanworm']!.methods?.observe, 1);
  assert.equal(actor.health, 100);
  assert.equal(
    evolution.guideOceanActor(w, actor.id, 'visit'),
    null,
    'later observation must not restart an already completed paid sharing guide',
  );
});
void test('a satiated crab tastes a funded gift in place instead of requiring another hunger cycle or a hauling trip (feeding fixture)', () => {
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!,
    actor = t.actors.find((a) => a.species === 'moss-crab')!;
  Object.assign(actor, {
    x: w.player.x + 95,
    y: w.player.y,
    hunger: 0,
    behavior: 'forage',
    phaseSeconds: 0,
  });
  t.actors = [actor];
  w.food = 1;
  applyTidalCommand(w, { id: 1, kind: 'interact' });
  assert.equal(w.food, 0);
  assert.equal(structuredClone(w).dnaLineage, undefined);
  for (let i = 0; i < 60; i++) stepTidalEcology(w, 1 / 120);
  assert.equal(w.dnaLineage?.sources['sea:moss-crab']?.method, 'symbiosis');
  assert.equal(actor.health, 100);
});
