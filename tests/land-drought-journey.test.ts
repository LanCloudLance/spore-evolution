import test from 'node:test';
import assert from 'node:assert/strict';
import { distance } from '../app/game/simulation.ts';
import {
  LAND_NESTS,
  LAND_SEED,
  interactLand,
  seedPlot,
  applyLandSeed,
} from '../app/game/land.ts';
import {
  startLandDrought,
  chooseDroughtStrategy,
  droughtTarget,
  droughtInteraction,
} from '../app/game/land-drought.ts';
import { runLand, runColony } from './helpers/campaign-route.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import { spaceFromCivilization, expeditionRecord } from '../app/game/space.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { runCity } from './helpers/city-route.ts';
import { runSpace } from './helpers/space-route.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';

import { tick, move, prepare } from './helpers/land-life-route.ts';

for (const [route, seed] of [
  ['refuge', 23],
  ['grove', 71],
  ['migration', 101],
] as const)
  void test(`actual ${route} drought journey continues from a new land life through the space archive`, () => {
    let w = prepare(seed);
    if (route === 'grove') {
      move(w, LAND_SEED);
      assert.ok(interactLand(w));
      move(w, LAND_NESTS[0]);
      assert.ok(applyLandSeed(w, 'plant'));
      move(w, seedPlot(w)!);
      for (let i = 0; i < 3; i++) {
        assert.ok(applyLandSeed(w, 'water'));
        for (let j = 0; j < 122; j++) tick(w, w.player);
      }
    }
    assert.ok(startLandDrought(w));
    assert.ok(chooseDroughtStrategy(w, route));
    let frames = 0,
      saved = false;
    while (w.land!.drought!.phase !== 'resolved' && frames++ < 10000) {
      const target = droughtTarget(w)!;
      tick(w, target.point);
      const action = droughtInteraction(w);
      if (action?.ready && distance(w.player, action.point) < 90)
        interactLand(w);
      const d = w.land!.drought!;
      if (!saved && (d.built || d.watered || d.stops > 0)) {
        const session = createCampaignSession();
        Object.assign(session.journey.getWorld(), w);
        const decoded = decodeSave(encodeSave(session.snapshot('journey')));
        assert.equal(decoded.kind, 'ok');
        if (decoded.kind === 'ok') {
          assert.deepEqual(decoded.save.campaign.journey.land!.drought, d);
          const restored = createCampaignSession();
          assert.equal(restored.restore(decoded.save.campaign), 'journey');
          w = restored.journey.getWorld();
          assert.equal(w.mode, 'paused');
          // Resume the loaded game, as the Continue button does; no progress changes.
          w.mode = 'running';
        }
        saved = true;
      }
    }
    assert.equal(w.land!.drought!.phase, 'resolved');
    assert.ok(saved);
    runLand(w);
    const colony = colonyFromLand(w)!;
    assert.equal(colony.history.at(-1)!.landLegacy!.strategy, route);
    colony.mode = 'running';
    runColony(colony);
    const tribe = tribeFromColony(colony)!;
    runTribe(tribe);
    const city = civilizationFromTribe(tribe)!;
    runCity(city, 'wind');
    const space = spaceFromCivilization(city)!;
    runSpace(space);
    assert.ok(
      expeditionRecord(space, 1)!.history.some(
        (a) => a.landLegacy?.strategy === route,
      ),
    );
  });
