import test from 'node:test';
import assert from 'node:assert/strict';
import { createColonyWorld } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import {
  civilizationFromTribe,
  cityNode,
  cityProduction,
  stepCivilization,
  assignCityRoute,
  type CityEvent,
} from '../app/game/civilization.ts';
import { citySupplyRoutes } from '../app/game/city-guidance.ts';
// Isolated rule fixtures, not evidence of browser progression.
function fresh() {
  const colony = createColonyWorld();
  Object.assign(colony, {
    mode: 'won',
    growth: 100,
    shelter: true,
    integrity: 100,
  });
  const tribe = tribeFromColony(colony)!;
  Object.assign(tribe, { mode: 'won', camp: true });
  tribe.banks.forEach((b) => (b.work = 6));
  tribe.neighbors.forEach((n) => (n.trust = 2));
  const s = civilizationFromTribe(tribe)!;
  s.mode = 'running';
  return s;
}
void test('production indicators use the same inputs, timing and weather rate as real output events', () => {
  const s = fresh();
  const workshop = cityNode(s, 'workshop');
  workshop.built = true;
  assert.deepEqual(cityProduction(s, 'workshop')!.missing, [
    '2 矿石',
    '1 能量',
  ]);
  const events: CityEvent[] = [];
  stepCivilization(s, 5, (e) => events.push(e));
  assert.equal(
    events.some((e) => e.node === 'workshop'),
    false,
  );
  assert.equal(workshop.stock.parts, 0);
  workshop.stock.ore = 2;
  workshop.stock.energy = 1;
  assert.deepEqual(cityProduction(s, 'workshop')!.missing, []);
  stepCivilization(s, 0.01, (e) => events.push(e));
  assert.equal(workshop.stock.parts, 1);
  assert.equal(workshop.stock.ore, 0);
  assert.equal(workshop.stock.energy, 0);
  assert.equal(events.filter((e) => e.node === 'workshop').length, 1);
  const power = cityNode(s, 'power');
  power.built = true;
  s.energy = 'wind';
  s.crisis = 100;
  assert.equal(cityProduction(s, 'power')!.speed, 0.25);
  assert.match(cityProduction(s, 'power')!.label, /12.0秒/);
  stepCivilization(s, 11.9, (e) => events.push(e));
  assert.equal(power.stock.energy, 0);
  stepCivilization(s, 0.1, (e) => events.push(e));
  assert.equal(power.stock.energy, 2);
  s.mode = 'paused';
  const frozen = structuredClone(s),
    count = events.length;
  stepCivilization(s, 30, (e) => events.push(e));
  assert.equal(events.length, count);
  assert.deepEqual(s, frozen);
});
void test('supply shortcuts honor built facilities and old cargo; delivery feedback is emitted once on arrival', () => {
  const s = fresh();
  assert.deepEqual(
    citySupplyRoutes(s, 'camp').map((r) => r.resource),
    ['wood', 'stone'],
  );
  assert.deepEqual(citySupplyRoutes(s, 'port'), []);
  const p = s.couriers[0],
    workshop = cityNode(s, 'workshop');
  workshop.built = true;
  cityNode(s, 'power').built = true;
  cityNode(s, 'quarry').built = true;
  assert.deepEqual(
    citySupplyRoutes(s, 'workshop').map((r) => r.resource),
    ['ore', 'energy'],
  );
  Object.assign(p, {
    x: 400,
    y: 400,
    cargo: 'wood',
    load: 2,
    destination: 'camp',
    path: [],
  });
  s.crisis = 100;
  const route = citySupplyRoutes(s, 'workshop')[0];
  assert.equal(route.safe, true);
  const stock = cityNode(s, 'camp').stock.wood;
  assert.ok(assignCityRoute(s, p.id, route));
  assert.equal(p.destination, 'camp');
  assert.equal(p.cargo, 'wood');
  assert.equal(cityNode(s, 'camp').stock.wood, stock);
  const copy = structuredClone(s),
    events: CityEvent[] = [];
  stepCivilization(s, 2, (e) => events.push(e));
  stepCivilization(copy, 2);
  assert.deepEqual(
    s,
    copy,
    'presentation observer cannot change transport outcomes',
  );
  assert.equal(cityNode(s, 'camp').stock.wood, stock + 2);
  assert.equal(
    events.filter((e) => e.kind === 'deliver' && e.node === 'camp').length,
    1,
  );
  stepCivilization(s, 0.5, (e) => events.push(e));
  assert.equal(
    events.filter((e) => e.kind === 'deliver' && e.node === 'camp').length,
    1,
  );
});
