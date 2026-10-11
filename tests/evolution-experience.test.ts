import { createOceanWorld } from './helpers/legacy-ocean.ts';

import {
  commitBody,
  freshBody,
  blockWithSpine,
} from '../app/game/body-design.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, reproduce, stepWorld } from '../app/game/simulation.ts';
import { createLandWorld, interactLand, evolveLand } from '../app/game/land.ts';
import {
  revealing,
  skipEvolution,
  beginEvolution,
} from '../app/game/evolution-experience.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import {
  guideNavigation,
  captureNavigationTap,
  releaseNavigationTap,
} from '../app/game/navigation.ts';
const idle = { x: 0, y: 0, dash: false };
function tick(
  w: ReturnType<typeof createWorld>,
  seconds: number,
  input = idle,
) {
  for (let i = 0; i < seconds * 60; i++) stepWorld(w, input, 1 / 60);
}
void test('birth preserves the actual previous body, freezes pond ecology, pauses and skips without changing inheritance or food', () => {
  const w = createWorld(23);
  w.mode = 'running';
  w.food = 8;
  assert.ok(reproduce(w, 'flagellum'));
  assert.ok(revealing(w));
  assert.deepEqual(w.evolution!.before.traits, []);
  assert.equal(w.evolution!.choice, 'flagellum');
  const food = w.food,
    pos = { ...w.player };
  tick(w, 1, { x: 1, y: 0, dash: true });
  assert.deepEqual(w.player, pos);
  assert.equal(w.food, food);
  w.mode = 'paused';
  const snapshot = structuredClone(w);
  tick(w, 2);
  assert.deepEqual(w, snapshot);
  assert.equal(skipEvolution(w), false);
  w.mode = 'running';
  assert.ok(skipEvolution(w));
  assert.equal(revealing(w), false);
  assert.equal(w.generation, 2);
  assert.deepEqual(w.traits, ['flagellum']);
  assert.equal(w.food, 0);
  assert.equal(skipEvolution(w), false);
});
void test('moving alone cannot complete practice; actual subsequent feeding can', () => {
  const w = createWorld(23);
  w.mode = 'running';
  w.food = 8;
  reproduce(w, 'shell');
  skipEvolution(w);
  w.predators = [];
  w.foods = [];
  tick(w, 1.2, { x: 1, y: 0, dash: false });
  assert.ok(w.evolution!.distance >= 80);
  assert.equal(w.evolution!.complete, false);
  w.foods = [
    { id: 1, x: w.player.x, y: w.player.y, cooldown: 0, rich: false },
    { id: 2, x: w.player.x, y: w.player.y, cooldown: 0, rich: false },
  ];
  tick(w, 0.1);
  assert.equal(w.evolution!.complete, true);
  const total = w.totalFood;
  tick(w, 1);
  assert.equal(w.totalFood, total);
});
void test('a call must actually reach a neighbor; an empty skill press is not practice completion', () => {
  const w = createLandWorld(62);
  w.food = 40;
  interactLand(w);
  w.land!.discovered = ['fern'];
  assert.ok(evolveLand(w, 'strider'));
  const oldBody = structuredClone(w.evolution!.before.body);
  skipEvolution(w);
  tick(w, 0.05);
  w.land!.creatures = w.land!.creatures.filter((c) => c.species === 'fern');
  for (const c of w.land!.creatures) {
    c.x = 2000;
    c.y = 1800;
  }
  stepWorld(w, { ...idle, skill: true }, 1 / 60);
  assert.equal(w.evolution!.complete, false);
  const neighbor = w.land!.creatures[0];
  neighbor.x = w.player.x + 100;
  neighbor.y = w.player.y;
  w.land!.skillCooldown = 0;
  stepWorld(w, { ...idle, skill: true }, 1 / 60);
  assert.ok(neighbor.friendship > 0);
  assert.equal(w.evolution!.complete, true);
  assert.deepEqual(w.evolution!.before.body, oldBody);
});
void test('reveal and practice save independently of UI; old saves do not retain another live experience', () => {
  const a = createCampaignSession(),
    w = a.journey.getWorld();
  w.mode = 'running';
  w.food = 8;
  reproduce(w, 'cilia');
  tick(w, 0.7);
  const saved = decodeSave(encodeSave(a.snapshot('journey')));
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') return;
  const b = createCampaignSession();
  b.restore(saved.save.campaign);
  assert.equal(b.journey.getWorld().mode, 'paused');
  assert.deepEqual(b.journey.getWorld().evolution, w.evolution);
  const old = a.snapshot('journey');
  delete old.journey.evolution;
  b.restore(old);
  assert.equal(b.journey.getWorld().evolution, null);
});
void test('crest practice teaches social contact even on a hunting body; keyboard navigation stops at arrival or obstruction', () => {
  const w = createLandWorld();
  w.form = 'stalker';
  w.history.push({
    form: 'stalker',
    generation: 1,
    traits: [],
    food: 0,
    seconds: 0,
  });
  beginEvolution(w, 'crest');
  assert.equal(w.evolution!.trial, 'call');
  const n = { target: { x: 100, y: 0 }, last: { x: 0, y: 0 }, stalled: 0 };
  assert.deepEqual(guideNavigation(n, { x: 0, y: 0 }, 0.1), { x: 1, y: 0 });
  assert.equal(guideNavigation(n, { x: 90, y: 0 }, 0.1), null);
  const blocked = {
    target: { x: 100, y: 0 },
    last: { x: 0, y: 0 },
    stalled: 0,
  };
  for (let i = 0; i < 14; i++) guideNavigation(blocked, { x: 0, y: 0 }, 0.1);
  assert.equal(guideNavigation(blocked, { x: 0, y: 0 }, 0.1), null);
});

void test('a committed body gets its own truthful practice; a real spine block satisfies it once', () => {
  const w = createOceanWorld();
  w.ocean!.dna = 50;
  w.ocean!.discovered.push('spine');
  const draft = freshBody();
  draft.organs.tail = 'spine';
  assert.ok(commitBody(w, draft));
  assert.equal(w.evolution!.choice, 'anatomy');
  assert.equal(w.evolution!.trial, 'body-test');
  assert.deepEqual(w.evolution!.before.body, freshBody());
  skipEvolution(w);
  tick(w, 0.05);
  assert.equal(w.evolution!.complete, false);
  w.player.angle = 0;
  const enemy = { x: w.player.x - 40, y: w.player.y, stun: 0, bite: 0 };
  assert.ok(blockWithSpine(w, enemy, 40));
  tick(w, 0.05);
  assert.equal(w.evolution!.complete, true);
  assert.equal(w.ocean!.blocks, 1);
});

void test('a click keeps the world point seen on pointerdown even if camera and player move before release', () => {
  const view = { cx: 500, cy: 400, zoom: 2, width: 1000, height: 800 },
    screen = { x: 700, y: 450 };
  const tap = captureNavigationTap(view, screen, 100);
  view.cx += 70;
  view.cy -= 25;
  const nav = releaseNavigationTap(tap, screen, 200, { x: 540, y: 415 });
  assert.deepEqual(nav!.target, { x: 600, y: 425 });
  assert.deepEqual(nav!.last, { x: 540, y: 415 });
  assert.equal(
    releaseNavigationTap(tap, { x: 730, y: 450 }, 200, { x: 540, y: 415 }),
    null,
  );
  assert.equal(
    releaseNavigationTap(tap, screen, 400, { x: 540, y: 415 }),
    null,
  );
});
