import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listOrgans,
  hasOrgan,
  organAnchor,
  validateLayout,
  editCost,
} from '../app/game/body-layout.ts';
import { freshBody, bodyEffects, organFaces } from '../app/game/body-design.ts';
import type { BodyDesign } from '../app/game/body-design.ts';
import {
  organZones,
  trunkCircles,
  organTouches,
} from '../app/game/body-geometry.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { evolutionFrame } from '../app/game/evolution-presentation.ts';
import { beginEvolution } from '../app/game/evolution-experience.ts';

const placed = (): BodyDesign => ({
  length: 1,
  width: 1,
  organs: { front: 'jaw' },
  placements: [{ id: 'mouth', organ: 'jaw', mount: 'tail', t: 0 }],
});
const pose = (body: BodyDesign) => ({
  x: 200,
  y: 300,
  size: 36,
  angle: 0,
  form: 'fish' as const,
  body,
});

void test('legacy mouths retain exact four contact anchors, including rotation and scaling', () => {
  const expected = [
    { x: 235, y: 300 },
    { x: 200, y: 265 },
    { x: 200, y: 335 },
    { x: 165, y: 300 },
  ];
  for (const [i, mount] of (
    ['front', 'left', 'right', 'tail'] as const
  ).entries()) {
    const b: BodyDesign = { length: 1, width: 1, organs: { [mount]: 'jaw' } };
    const part = listOrgans(b)[0];
    assert.deepEqual(organAnchor(pose(b), part), expected[i]);
    assert.ok(organTouches(pose(b), { ...expected[i], radius: 1 }, 'jaw'));
  }
  const b: BodyDesign = { length: 1.5, width: 0.8, organs: { front: 'spine' } };
  const anchor = organAnchor(
    { ...pose(b), angle: Math.PI / 2 },
    listOrgans(b)[0],
  );
  assert.ok(Math.abs(anchor.x - 200) < 1e-8);
  assert.equal(anchor.y, 373.5);
});

void test('placements are authoritative for mouths, side fins and effects; stale slots never participate', () => {
  const b = placed();
  assert.equal(hasOrgan(b, 'jaw'), true);
  assert.equal(organZones(pose(b), 'jaw')[0].x, 165);
  assert.equal(
    organTouches(pose(b), { x: 235, y: 300, radius: 1 }, 'jaw'),
    false,
  );
  b.organs = { front: 'filter', tail: 'fin' };
  assert.equal(hasOrgan(b, 'filter'), false);
  assert.equal(bodyEffects(b).pickup, 0);
  assert.equal(bodyEffects(b).speed, 1);
  const w = createOceanWorld();
  w.ocean!.body = b;
  assert.equal(
    organFaces(w, { x: w.player.x + 100, y: w.player.y }, 'jaw'),
    false,
  );
  assert.equal(
    organFaces(w, { x: w.player.x - 100, y: w.player.y }, 'jaw'),
    true,
  );
  b.placements = [];
  assert.equal(listOrgans(b).length, 0);
});

void test('layout rejects nonfinite coordinates, duplicate IDs or anchors and illegal installations', () => {
  const b = placed();
  assert.equal(validateLayout(b), null);
  for (const t of [NaN, Infinity, 1.01, -1.01]) {
    assert.ok(
      validateLayout({ ...b, placements: [{ ...b.placements![0], t }] }),
    );
  }
  for (const organ of ['fin', 'shell', 'reserve', 'lateral'] as const) {
    assert.ok(
      validateLayout({
        ...b,
        placements: [{ id: 'x', organ, mount: 'front', t: 0 }],
      }),
    );
  }
  assert.ok(
    validateLayout({
      ...b,
      placements: [b.placements![0], { ...b.placements![0], mount: 'left' }],
    }),
  );
  assert.ok(
    validateLayout({
      ...b,
      placements: [b.placements![0], { ...b.placements![0], id: 'other' }],
    }),
  );
  assert.ok(
    validateLayout({
      ...b,
      appearance: { base: 'url(bad)', accent: '#aabbcc', pattern: 'spots' },
    }),
  );
  assert.equal(
    validateLayout({
      ...b,
      appearance: { base: '#AabbCc', accent: '#001122', pattern: 'bands' },
    }),
    null,
  );
  assert.equal(
    validateLayout({ length: 1, width: 1, organs: { front: 'fin' } }),
    null,
    'old legal four-slot anatomy is grandfathered',
  );
});

void test('installation costs cannot refund removed organs and ornaments never expand the trunk', () => {
  const b = placed();
  const after = {
    ...b,
    placements: [
      ...b.placements!,
      { id: 's', organ: 'shell' as const, mount: 'back' as const, t: 0 },
    ],
  };
  assert.equal(editCost(b, after), 16);
  assert.equal(editCost(after, b), 8);
  assert.equal(editCost(freshBody(), freshBody()), 8);
  assert.deepEqual(trunkCircles(pose(b)), trunkCircles(pose(after)));
  const snapshot = structuredClone(after);
  listOrgans(after)[0].t = 0.8;
  assert.deepEqual(after, snapshot, 'accessor returns detached placements');
});

void test('evolution forms a new anchored organ at its real location without changing the stored body', () => {
  const w = createOceanWorld();
  w.ocean!.body = placed();
  w.history.push({
    generation: w.generation,
    form: w.form,
    habitat: w.habitat,
    traits: [],
    food: 0,
    seconds: 0,
    body: structuredClone(w.ocean!.body),
  });
  beginEvolution(w, 'anatomy');
  w.ocean!.body.placements!.push({
    id: 'shell',
    organ: 'shell',
    mount: 'back',
    t: 0.2,
  });
  const before = structuredClone(w);
  const frame = evolutionFrame(w)!;
  assert.equal(frame.formation.placements.mouth, 1);
  assert.equal(frame.formation.placements.shell, 0);
  assert.deepEqual(frame.body!.placements, w.ocean!.body.placements);
  assert.deepEqual(w, before);
  assert.equal(evolutionFrame(w, true)!.formation.placements.shell, 1);
});
