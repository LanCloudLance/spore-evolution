import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { commitBody, validateDesign } from '../app/game/body-design.ts';
import {
  bodyDraft,
  placeDraftOrgan,
  moveDraftOrgan,
  mirrorDraftOrgan,
} from '../app/game/tidal/body-draft.ts';
import { setTidalSlots } from '../app/game/tidal/abilities.ts';
import { listOrgans } from '../app/game/body-layout.ts';
import {
  skipEvolution,
  evolutionTrialTarget,
} from '../app/game/evolution-experience.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
void test('draft editing, moving and symmetry are detached, lawful and cancelable', () => {
  const w = tidalFixture({ organs: ['jaw', 'fin'] });
  const before = structuredClone(w);
  let draft = bodyDraft(w.ocean!.body);
  const fin = listOrgans(draft).find((p) => p.organ === 'fin')!;
  draft = moveDraftOrgan(draft, fin.id, 'right', 0.5);
  draft = mirrorDraftOrgan(draft, fin.id);
  assert.equal(listOrgans(draft).filter((p) => p.organ === 'fin').length, 2);
  assert.equal(
    new Set(listOrgans(draft).map((p) => `${p.mount}:${p.t}`)).size,
    3,
  );
  const twice = mirrorDraftOrgan(draft, fin.id);
  assert.deepEqual(twice, draft);
  assert.deepEqual(moveDraftOrgan(draft, fin.id, 'front', 0), draft);
  assert.deepEqual(w, before);
});
void test('new ocean pays only positive organ cost difference and records one inherited generation', () => {
  const w = tidalFixture({ organs: ['jaw', 'fin', 'shell'] });
  w.ocean!.dna = 100;
  const old = structuredClone(w.ocean!.body),
    draft = bodyDraft(old);
  draft.placements = draft.placements!.filter((p) => p.organ !== 'shell');
  assert.ok(commitBody(w, draft));
  assert.equal(w.ocean!.dna, 92);
  assert.deepEqual(w.history.at(-1)!.body, old);
  assert.equal(w.evolution!.duration, 4.2);
  const generation = w.generation;
  assert.equal(commitBody(w, draft), false);
  assert.equal(w.ocean!.dna, 92);
  assert.ok(skipEvolution(w));
  stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 120);
  assert.equal(commitBody(w, draft), false);
  assert.equal(w.generation, generation);
  const readd = placeDraftOrgan(bodyDraft(w.ocean!.body), 'shell', 'back', 0);
  assert.ok(commitBody(w, readd));
  assert.equal(w.ocean!.dna, 76);
});
void test('canonical equality ignores order, IDs and stale slots, but still rejects unknown and mouthless bodies', () => {
  const w = tidalFixture({ organs: ['jaw', 'fin'] });
  w.ocean!.dna = 100;
  const draft = bodyDraft(w.ocean!.body);
  draft.placements!.reverse();
  draft.placements!.forEach((p) => (p.id += 'renamed'));
  draft.organs = { tail: 'spine' };
  assert.match(validateDesign(w, draft), /调整/);
  assert.equal(commitBody(w, draft), false);
  assert.match(
    validateDesign(
      w,
      placeDraftOrgan(bodyDraft(w.ocean!.body), 'shell', 'back', 0),
    ),
    /发现/,
  );
  const empty = bodyDraft(w.ocean!.body);
  empty.placements = [];
  assert.match(validateDesign(w, empty), /摄食|捕食/);
  w.ocean!.branch = 'radial';
  empty.length = 1.1;
  assert.equal(
    validateDesign(w, empty),
    '',
    'radial intrinsic feeding remains usable',
  );
});
void test('ability configuration requires pause, installed actions and no duplicate slots', () => {
  const w = tidalFixture({ organs: ['jaw', 'shell', 'grasp'] });
  assert.equal(setTidalSlots(w, ['shell', 'grasp']), false);
  w.mode = 'paused';
  assert.equal(setTidalSlots(w, ['shell', 'grasp']), true);
  assert.equal(setTidalSlots(w, ['filter', null]), false);
  assert.equal(setTidalSlots(w, ['shell', 'shell']), false);
  assert.deepEqual(w.ocean!.tidal!.abilities.slots, ['shell', 'grasp']);
});
void test('public ocean edit provides an existing real practice target, reload and skip never rebirth or refund', () => {
  const w = createOceanWorld(23);
  w.mode = 'paused';
  const draft = bodyDraft(w.ocean!.body);
  draft.length = 1.1;
  const foodCount = w.ocean!.tidal!.foods.length;
  assert.ok(commitBody(w, draft));
  const dna = w.ocean!.dna,
    generation = w.generation;
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const decoded = decodeSave(encodeSave(session.snapshot('journey')));
  if (decoded.kind !== 'ok') throw Error(decoded.kind);
  const read = decoded.save.campaign.journey;
  assert.ok(skipEvolution(read));
  stepWorld(read, { x: 0, y: 0, dash: false }, 1 / 120);
  assert.equal(read.generation, generation);
  assert.equal(read.ocean!.dna, dna);
  assert.equal(read.ocean!.tidal!.foods.length, foodCount);
  const target = evolutionTrialTarget(read);
  assert.ok(target);
  assert.ok(
    Math.hypot(target.x - read.player.x, target.y - read.player.y) < 120,
  );
  assert.equal(read.evolution!.complete, false);
  assert.equal(read.totalFood, w.totalFood);
});

void test('body and future ability slots commit atomically; invalid configuration leaves resources untouched', () => {
  const w = tidalFixture({ organs: ['jaw', 'shell'] });
  w.mode = 'paused';
  w.ocean!.dna = 100;
  const draft = bodyDraft(w.ocean!.body);
  draft.length = 1.2;
  const before = structuredClone(w);
  assert.equal(commitBody(w, draft, ['filter', null]), false);
  assert.deepEqual(w, before);
  assert.ok(commitBody(w, draft, ['shell', 'form-skill']));
  assert.deepEqual(w.ocean!.tidal!.abilities.slots, ['shell', 'form-skill']);
});
