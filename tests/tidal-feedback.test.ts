import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { createTidalControls } from '../app/game/tidal/input.ts';
import { tidalGuidance } from '../app/game/tidal/migration.ts';
import { tidalSoundScene } from '../app/game/tidal/audio-scene.ts';
import { stepWorld } from '../app/game/simulation.ts';
void test('one held key yields one persistent command; release allows another; stale queued actions are cleared by pause and cancellation', () => {
  const w = tidalFixture({ organs: ['filter'] }),
    c = createTidalControls();
  assert.ok(c.press(w, 'slot0'));
  assert.equal(c.press(w, 'slot0'), false);
  const first = c.take(w)!;
  assert.equal(first.id, 1);
  assert.equal(c.take(w), undefined);
  w.ocean!.tidal!.abilities.lastCommandId = first.id;
  c.release('slot0');
  assert.ok(c.press(w, 'slot0'));
  assert.equal(c.take(w)!.id, 2);
  c.tap(w, 'slot1');
  w.mode = 'paused';
  assert.equal(c.take(w), undefined);
  w.mode = 'running';
  assert.equal(c.take(w), undefined);
  c.tap(w, 'interact');
  c.clear();
  assert.equal(c.take(w), undefined);
  w.ocean!.tidal!.abilities.lastCommandId = 400;
  assert.ok(c.tap(w, 'slot0'));
  assert.equal(c.take(w)!.id, 401);
});
void test('the same control replay at thirty and sixty render frames produces the same fixed-step outcome', () => {
  function replay(fps: number) {
    const w = tidalFixture({ organs: ['filter'] }),
      c = createTidalControls();
    w.ocean!.tidal!.abilities.slots = ['filter', null];
    let accumulator = 0;
    c.press(w, 'slot0');
    for (let frame = 0; frame < fps * 2; frame++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-9 >= 1 / 120) {
        const command = c.take(w);
        stepWorld(
          w,
          {
            x: 1,
            y: 0,
            dash: false,
            ...(command ? { tidalCommand: command } : {}),
          },
          1 / 120,
        );
        accumulator -= 1 / 120;
      }
    }
    return w;
  }
  const a = replay(30),
    b = replay(60);
  assert.ok(Math.hypot(a.player.x - b.player.x, a.player.y - b.player.y) < 1);
  assert.equal(a.ocean!.tidal!.abilities.filterOpen, true);
  assert.equal(a.ocean!.tidal!.abilities.lastCommandId, 1);
  assert.equal(a.food, b.food);
  assert.ok(a.ocean!.tidal!.actors.length <= 48);
});
void test('guidance follows edible stock and actual trial progress, and remains recoverable when all visible food is spent', () => {
  const w = tidalFixture({ organs: ['filter'] }),
    t = w.ocean!.tidal!;
  t.foods = [
    {
      id: 'algae',
      kind: 'algae',
      x: w.player.x + 5,
      y: w.player.y,
      biome: 'nursery',
      state: 'available',
      owner: null,
      energy: 8,
      regrowSeconds: 0,
    },
    {
      id: 'real-plankton',
      kind: 'plankton',
      x: w.player.x + 100,
      y: w.player.y,
      biome: 'nursery',
      state: 'available',
      owner: null,
      energy: 8,
      regrowSeconds: 0,
    },
  ];
  assert.deepEqual(tidalGuidance(w)!.point, {
    x: t.foods[1].x,
    y: t.foods[1].y,
  });
  t.foods.forEach((f) => {
    f.state = 'consumed';
    f.regrowSeconds = 18;
  });
  const recovery = tidalGuidance(w)!;
  assert.ok(recovery.label.includes('补给') || recovery.label.includes('恢复'));
  assert.deepEqual(recovery.point, { x: 460, y: 1770 });
});
void test('scene music follows real birth, danger and migration state', () => {
  const w = tidalFixture();
  assert.equal(tidalSoundScene(w), 'explore');
  w.ocean!.morph = { from: w.form, to: w.form, elapsed: 1, duration: 4.2 };
  assert.equal(tidalSoundScene(w), 'evolution');
  w.ocean!.morph = null;
  w.ocean!.tidal!.actors = [
    {
      id: 'hunter',
      species: 'crested-hunter',
      homeBiome: 'reef',
      x: w.player.x + 100,
      y: w.player.y,
      radius: 44,
      angle: 0,
      hunger: 90,
      health: 100,
      behavior: 'ambush',
      targetId: 'player',
      phaseSeconds: 0.4,
      respawnSeconds: 0,
      carryingId: null,
      trust: 0,
    },
  ];
  assert.equal(tidalSoundScene(w), 'danger');
  w.ocean!.tidal!.actors = [];
  w.ocean!.tier = 2;
  w.ocean!.tidal!.migration.startedTick = 10;
  assert.equal(tidalSoundScene(w), 'migration');
});
void test('new command slots complete the real form practice without legacy skill input', async () => {
  const { evolveOcean } = await import('../app/game/ocean.ts');
  const { applyTidalCommand } = await import('../app/game/tidal/abilities.ts');
  const w = tidalFixture();
  w.food = 10;
  w.ocean!.visited.push('透光浮游区');
  assert.ok(evolveOcean(w, 'bilateral', 'flagellum'));
  for (let i = 0; i < 100; i++) stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.evolution!.used, false);
  applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(w.evolution!.used, true);
});
