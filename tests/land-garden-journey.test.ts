import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, move, tick } from './helpers/land-life-route.ts';
import {
  LAND_SEED,
  LAND_NESTS,
  LAND_AREAS,
  seedPlot,
  interactLand,
  applyLandSeed,
  chooseLandFocus,
  landTarget,
  landSettlementWays,
  landFriends,
  continueLandLife,
  revisitLandSettlement,
} from '../app/game/land.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
for (const seed of [71, 101])
  void test(`a new gardener life seed ${seed} settles through cultivation, freely explores after settlement, then enters colony with that history`, () => {
    let w = prepare(seed);
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
    assert.equal(landFriends(w), 0);
    assert.equal(w.land!.hunts, 0);
    move(w, LAND_AREAS[1], 200);
    assert.ok(
      LAND_AREAS.slice(0, 2).every((a) => w.land!.visited.includes(a.name)),
    );
    assert.ok(chooseLandFocus(w, 'settle'));
    for (let i = 0; i < 5000 && w.mode === 'running'; i++) {
      const goal = landTarget(w);
      tick(w, goal.point, goal.action === 'forage' ? 20 : 65);
      if (goal.action === 'settle') interactLand(w);
    }
    assert.equal(w.mode, 'won');
    assert.ok(continueLandLife(w));
    const session = createCampaignSession();
    Object.assign(session.journey.getWorld(), w);
    const loaded = decodeSave(encodeSave(session.snapshot('journey')));
    assert.equal(loaded.kind, 'ok');
    if (loaded.kind === 'ok') {
      const restored = createCampaignSession();
      restored.restore(loaded.save.campaign);
      w = restored.journey.getWorld();
      assert.equal(w.land!.focus, 'wander');
      w.mode = 'running';
    }
    assert.ok(chooseLandFocus(w, 'wander', 0));
    const before = { x: w.player.x, y: w.player.y };
    for (let i = 0; i < 10; i++) tick(w, landTarget(w).point);
    assert.ok(Math.hypot(w.player.x - before.x, w.player.y - before.y) > 20);
    assert.equal(w.mode, 'running');
    assert.equal(w.land!.hunts, 0);
    assert.equal(landFriends(w), 0);
    assert.ok(revisitLandSettlement(w));
    const colony = colonyFromLand(w)!;
    assert.equal(colony.seedLegacy, 'grown');
    assert.ok(colony.history.some((a) => a.landWays?.includes('garden')));
    assert.equal(
      colony.history.filter((a) => a.generation === w.generation).length,
      1,
    );
  });
