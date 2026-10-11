import assert from 'node:assert/strict';
import { cityCapacity } from '../../app/game/civilization.ts';
import type {
  CivilizationState,
  CityNodeId,
  CityResource,
  EnergyChoice,
} from '../../app/game/civilization.ts';
import {
  cityNode,
  cityHas,
  CITY_COST,
  buildCityNode,
  assignCityRoute,
  stepCivilization,
  startCityCrisis,
  repairCityBridge,
  launchCityVoyage,
  BRIDGE_COST,
  VOYAGE_COST,
} from '../../app/game/civilization.ts';
export function untilCity(
  s: CivilizationState,
  predicate: () => boolean,
  max = 500,
) {
  for (let i = 0; i < max * 20 && !predicate() && s.mode === 'running'; i++)
    stepCivilization(s, 0.05);
  assert.ok(predicate(), `city stalled: ${s.notice}`);
}
export function sendCity(
  s: CivilizationState,
  from: CityNodeId,
  to: CityNodeId,
  resource: CityResource,
  count: number,
  id = s.couriers[0].id,
  safe = false,
) {
  assert.ok(assignCityRoute(s, id, { from, to, resource, safe }));
  untilCity(s, () => cityNode(s, to).stock[resource] >= count);
  assert.ok(assignCityRoute(s, id, null));
  untilCity(s, () => !s.couriers.find((c) => c.id === id)!.cargo);
}
export function prepareCity(
  s: CivilizationState,
  energy: EnergyChoice = 'wind',
) {
  assert.equal(s.mode, 'ready');
  s.mode = 'running';
  for (const id of ['farm', 'quarry', 'power', 'workshop', 'relay'] as const) {
    const cost = CITY_COST[id];
    for (const [r, n] of Object.entries(cost))
      if (cityNode(s, 'camp').stock[r as CityResource] < n)
        sendCity(s, 'grove', 'camp', r as CityResource, n);
    assert.ok(buildCityNode(s, id, energy));
  }
  if (energy === 'fuel') {
    assert.ok(
      assignCityRoute(s, s.couriers[0].id, {
        from: 'farm',
        to: 'power',
        resource: 'food',
        safe: false,
      }),
    );
    untilCity(s, () => cityNode(s, 'power').stock.energy >= 80);
    assert.ok(assignCityRoute(s, s.couriers[0].id, null));
    untilCity(s, () => !s.couriers[0].cargo);
  }
  // Stock inputs through real trips, so even a one-member lineage can finish by rotating jobs.
  const actualCapacity = cityCapacity(s);
  const partsBudget = [
    CITY_COST.port.parts!,
    BRIDGE_COST.parts!,
    VOYAGE_COST.parts!,
  ].reduce((sum, n) => sum + Math.ceil(n / actualCapacity) * actualCapacity, 0);
  sendCity(s, 'quarry', 'workshop', 'ore', Math.max(40, partsBudget * 2));
  sendCity(s, 'power', 'workshop', 'energy', Math.max(24, partsBudget));
  sendCity(s, 'workshop', 'camp', 'parts', 6);
  if (cityNode(s, 'camp').stock.wood < 8)
    sendCity(s, 'grove', 'camp', 'wood', 8);
  assert.ok(buildCityNode(s, 'port'));
  untilCity(s, () => cityNode(s, 'workshop').stock.parts >= 10);
  untilCity(s, () => cityNode(s, 'power').stock.energy >= 10);
}
export function runCity(s: CivilizationState, energy: EnergyChoice = 'wind') {
  prepareCity(s, energy);
  const before = structuredClone(s.history);
  assert.ok(startCityCrisis(s));
  sendCity(s, 'workshop', 'relay', 'parts', 3, s.couriers[0].id, true);
  sendCity(s, 'power', 'relay', 'energy', 2, s.couriers[0].id, true);
  assert.ok(cityHas(cityNode(s, 'relay').stock, BRIDGE_COST));
  assert.ok(repairCityBridge(s));
  sendCity(s, 'farm', 'port', 'food', 8);
  sendCity(s, 'power', 'port', 'energy', 6);
  sendCity(s, 'workshop', 'port', 'parts', 6);
  assert.ok(cityHas(cityNode(s, 'port').stock, VOYAGE_COST));
  assert.ok(launchCityVoyage(s));
  assert.equal(s.mode, 'won');
  assert.deepEqual(s.history, before);
}
