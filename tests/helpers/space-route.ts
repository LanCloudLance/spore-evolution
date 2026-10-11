import assert from 'node:assert/strict';
import type {
  SpaceState,
  StarId,
  Habitat,
  SpaceUpgrade,
} from '../../app/game/space.ts';
import {
  travelSpace,
  stepSpace,
  spaceActivity,
  upgradeSpace,
  recordSpaceRelic,
  buildOutpost,
  setEcology,
  startOutpostTrial,
  flareStrength,
  ECOLOGY_TARGETS,
} from '../../app/game/space.ts';
export function arrive(s: SpaceState, to: StarId) {
  assert.ok(travelSpace(s, to), s.notice);
  stepSpace(s, 12);
  assert.equal(s.location, to);
  assert.equal(s.flight, null);
}
export function scanPlanet(s: SpaceState) {
  for (const kind of ['water', 'air'] as const) {
    assert.ok(spaceActivity(s, kind));
    stepSpace(s, 5.1);
  }
}
export function prepareSpace(
  s: SpaceState,
  planet: 'tide' | 'ember' = 'tide',
  habitat: Habitat = 'wetland',
  upgrade: SpaceUpgrade = 'shield',
  relic = false,
) {
  assert.equal(s.mode, 'ready');
  s.mode = 'running';
  assert.ok(upgradeSpace(s, upgrade));
  arrive(s, 'beacon');
  assert.ok(spaceActivity(s, 'supply'));
  stepSpace(s, 4.1);
  assert.ok(spaceActivity(s, 'charge'));
  stepSpace(s, 4.1);
  if (relic) {
    arrive(s, 'echo');
    assert.ok(recordSpaceRelic(s));
  }
  arrive(s, planet);
  scanPlanet(s);
  assert.ok(buildOutpost(s, habitat), s.notice);
  for (const key of ['water', 'light', 'heat'] as const)
    assert.ok(setEcology(s, key, ECOLOGY_TARGETS[planet][key]));
}
export function finishSpace(s: SpaceState) {
  assert.ok(startOutpostTrial(s));
  for (let i = 0; i < 620 && s.mode === 'running'; i++) {
    assert.ok(
      setEcology(
        s,
        'heat',
        Math.max(0, ECOLOGY_TARGETS[s.outpost!.planet].heat - flareStrength(s)),
      ),
    );
    stepSpace(s, 0.05);
  }
  assert.equal(s.mode, 'won', s.notice);
}
export function runSpace(
  s: SpaceState,
  planet: 'tide' | 'ember' = 'tide',
  habitat: Habitat = 'wetland',
  upgrade: SpaceUpgrade = 'shield',
  relic = false,
) {
  const history = structuredClone(s.history);
  prepareSpace(s, planet, habitat, upgrade, relic);
  finishSpace(s);
  assert.deepEqual(s.history, history);
}
