import assert from 'node:assert/strict';
import type { World } from '../../app/game/simulation.ts';
import { distance, stepWorld } from '../../app/game/simulation.ts';
import {
  LAND_NESTS,
  LAND_AREAS,
  LAND_SEED,
  seedPlot,
  interactLand,
  applyLandSeed,
  chooseLandFocus,
  landTarget,
  landSettlementWays,
} from '../../app/game/land.ts';
import { commitBiologicalEvolution } from '../../app/game/biological-evolution.ts';
import { tick, move, forage } from './land-life-route.ts';
export function runSourceLand(w: World, way: 'hunt' | 'garden' | 'companions') {
  forage(w, 10);
  move(w, LAND_NESTS[0]);
  assert.ok(interactLand(w));
  const fern = w.land!.creatures.find((c) => c.species === 'fern')!;
  for (let i = 0; i < 3000 && !w.land!.discovered.includes('fern'); i++)
    tick(w, fern, 90);
  if (way === 'hunt') {
    const predator = w.land!.creatures.find(
      (c) => c.species === 'dusk-stalker',
    )!;
    for (
      let i = 0;
      i < 3000 && !w.dnaLineage?.sources['land:dusk-stalker'];
      i++
    )
      tick(w, predator, 155);
    assert.ok(w.dnaLineage?.sources['land:dusk-stalker']?.methods?.observe);
  }
  forage(w, 10);
  move(w, LAND_NESTS[0]);
  assert.ok(
    commitBiologicalEvolution(
      w,
      way === 'hunt' ? 'land:stalker' : 'land:strider',
    ),
  );
  while (w.land!.morph) tick(w, w.player);
  const feature =
    way === 'hunt' ? 'leap' : way === 'companions' ? 'alarm' : 'roots';
  if (feature !== 'roots') {
    const provider = w.land!.creatures.find(
      (c) => c.species === (feature === 'leap' ? 'reed-runner' : 'echo-finch'),
    )!;
    for (
      let i = 0;
      i < 2500 && !w.dnaLineage?.sources[`land:${provider.species}`];
      i++
    )
      tick(w, provider, 115);
  }
  forage(w, 20);
  move(w, LAND_NESTS[0]);
  assert.ok(commitBiologicalEvolution(w, `landpart:${feature}`));
  while (w.land!.morph) tick(w, w.player);
  if (feature !== 'roots')
    stepWorld(w, { x: 0, y: 0, dash: false, feature: true }, 0.05);
  if (way === 'garden') {
    assert.ok(chooseLandFocus(w, 'garden'));
    move(w, LAND_SEED);
    assert.ok(interactLand(w));
    move(w, LAND_NESTS[0]);
    assert.ok(applyLandSeed(w, 'plant'));
    move(w, seedPlot(w)!);
    for (let i = 0; i < 3; i++) {
      assert.ok(applyLandSeed(w, 'water'));
      for (let j = 0; j < 122; j++) tick(w, w.player);
    }
    for (let i = 0; i < 4000 && !landSettlementWays(w).includes('garden'); i++)
      tick(w, landTarget(w).point);
    assert.ok(landSettlementWays(w).includes('garden'));
    move(w, LAND_AREAS[1], 200);
    assert.ok(chooseLandFocus(w, 'settle'));
  }
  for (let i = 0; i < 16000 && w.mode === 'running'; i++) {
    const goal = landTarget(w),
      d = distance(w.player, goal.point);
    if (way === 'hunt' && goal.action === 'hunt') {
      const a = Math.atan2(
        goal.point.y - w.player.y,
        goal.point.x - w.player.x,
      );
      stepWorld(
        w,
        {
          x: d < 65 ? 0 : Math.cos(a),
          y: d < 65 ? 0 : Math.sin(a),
          dash: false,
          sneak: true,
          skill: d < 185 && Math.cos(a - w.player.angle) > 0.9,
        },
        0.05,
      );
    } else {
      tick(
        w,
        goal.point,
        goal.action === 'forage' ? 15 : goal.action === 'befriend' ? 85 : 65,
      );
      if (goal.action === 'befriend' && d < 170)
        stepWorld(
          w,
          {
            x: 0,
            y: 0,
            dash: false,
            skill: w.form === 'strider',
            interact: w.food >= 2,
          },
          0.05,
        );
    }
    if (['nest', 'settle'].includes(goal.action) && d < 100) interactLand(w);
  }
  assert.equal(
    w.mode,
    'won',
    `${way}: ${landTarget(w).label}; food ${w.food},energy ${w.player.energy},pos ${w.player.x},${w.player.y}`,
  );
  assert.ok(w.land!.features?.includes(feature));
  return w;
}
