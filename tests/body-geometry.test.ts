import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  constrainBody,
  trunkCircles,
  trunkTouches,
  organZones,
  organTouches,
  worldBodyPose,
} from '../app/game/body-geometry.ts';
import type { BodyPose } from '../app/game/body-geometry.ts';

import { enterShore } from '../app/game/shore.ts';
import { getView } from '../app/game/camera.ts';

const pose = (): BodyPose => ({
  x: 300,
  y: 300,
  angle: 0,
  form: 'fish',
  size: 36,
  body: { length: 1.5, width: 0.7, organs: { front: 'jaw', tail: 'spine' } },
});
void test('a narrow fish fits beside a wall and its rotated trunk blocks; fins and legs never enlarge solid geometry', () => {
  const p = pose(),
    map = { width: 900, height: 900 },
    wall = [{ x: 300, y: 350, radius: 30 }];
  assert.deepEqual(constrainBody(p, wall, map), { x: 300, y: 300 });
  const rotated = { ...p, angle: Math.PI / 2 };
  assert.ok(trunkTouches(rotated, wall[0]));
  const resolved = constrainBody(rotated, wall, map);
  assert.ok(
    !trunkTouches({ ...rotated, ...resolved }, { ...wall[0], radius: 29.99 }),
  );
  const decorative = {
    ...p,
    body: {
      ...p.body!,
      legs: 1.4,
      organs: { left: 'fin' as const, tail: 'fin' as const },
    },
  };
  assert.deepEqual(trunkCircles(p), trunkCircles(decorative));
});
void test('long jelly tentacles are not a solid disk; a glancing collision keeps tangential travel', () => {
  const p = {
    ...pose(),
    form: 'jelly' as const,
    body: { length: 1, width: 1, organs: {} },
  };
  assert.equal(trunkTouches(p, { x: 190, y: 300, radius: 10 }), false);
  const rock = { x: 380, y: 300, radius: 40 },
    map = { width: 900, height: 900 };
  const a = constrainBody({ ...p, x: 350, y: 320 }, [rock], map);
  const b = constrainBody({ ...p, x: 350, y: 340 }, [rock], map);
  assert.ok(b.y > a.y, 'movement along the rock remains possible');
});
void test('front, side and tail mouths use their rendered anchors, independent of facing cones', () => {
  for (const slot of ['front', 'left', 'right', 'tail'] as const) {
    const p = {
      ...pose(),
      angle: 0.7,
      body: { ...pose().body!, organs: { [slot]: 'jaw' as const } },
    };
    const mouth = organZones(p, 'jaw')[0];
    assert.ok(organTouches(p, { ...mouth, radius: 1 }, 'jaw'));
    assert.equal(
      organTouches(
        p,
        { x: p.x * 2 - mouth.x, y: p.y * 2 - mouth.y, radius: 1 },
        'jaw',
      ),
      false,
    );
    assert.equal(organTouches(p, { x: p.x, y: p.y, radius: 1 }, 'jaw'), false);
  }
});
void test('adult ocean trunk size and anatomy survive arrival on shore; camera scales presentation only', () => {
  const w = createOceanWorld();
  w.form = 'fish';
  w.ocean!.tier = 2;
  w.ocean!.biomass = 85;
  w.ocean!.body = pose().body!;
  w.mode = 'won';
  const before = worldBodyPose(w);
  assert.ok(enterShore(w));
  const after = worldBodyPose(w);
  assert.equal(after.size, before.size);
  assert.deepEqual(after.body, before.body);
  const snapshot = structuredClone(w);
  getView(w, 1280, 720);
  getView(w, 390, 844);
  assert.deepEqual(w, snapshot);
});
void test('ocean growth remains visible before the camera pulls back on both screen sizes', () => {
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
  ]) {
    const w = createOceanWorld();
    const start =
      (worldBodyPose(w).size * 2 * getView(w, width, height).zoom) /
      Math.min(width, height);
    w.form = 'fish';
    w.ocean!.biomass = 65;
    const adult =
      (((worldBodyPose(w).size * 80) / 36) * getView(w, width, height).zoom) /
      Math.min(width, height);
    assert.ok(start >= 0.07 && start <= 0.1);
    assert.ok(adult >= 0.12 && adult <= 0.19);
    assert.ok(adult > start * 1.5);
  }
});
