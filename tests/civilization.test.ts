import test from 'node:test';
import assert from 'node:assert/strict';
import { createColonyWorld } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import {
  civilizationFromTribe,
  cityNode,
  buildCityNode,
  assignCityRoute,
  startCityCrisis,
  stepCivilization,
  repairCityBridge,
  launchCityVoyage,
} from '../app/game/civilization.ts';
import { runColony } from './helpers/campaign-route.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { prepareCity, untilCity, sendCity } from './helpers/city-route.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
const colony = createColonyWorld();
colony.mode = 'running';
runColony(colony);
const tribe = tribeFromColony(colony)!;
runTribe(tribe, 'basket', 'trade');
const fresh = () => civilizationFromTribe(tribe)!;
void test('civilization requires the earned tribe ending and carries bodies, people, stock and decisions without inventing a generation', () => {
  const notFinished = tribeFromColony(colony)!;
  assert.equal(civilizationFromTribe(notFinished), null);
  const s = fresh();
  assert.deepEqual(s.history, tribe.history);
  assert.deepEqual(s.body, tribe.body);
  assert.equal(s.generation, tribe.generation);
  assert.equal(s.couriers.length, tribe.members.length + 1);
  assert.equal(s.capacity, 4);
  assert.equal(cityNode(s, 'camp').stock.food, tribe.stores.food);
  assert.equal(s.energy, null);
  const session = createCampaignSession();
  assert.equal(session.startCity(), false);
  session.startColony(colony);
  session.startTribe();
  session.updateTribe(tribe);
  assert.ok(session.startCity());
  const c = session.getCity()!.current;
  c.mode = 'running';
  stepCivilization(c, 1);
  session.updateCity(c);
  assert.ok(session.startCity());
  assert.deepEqual(session.getCity()!.current, c);
  assert.equal(session.getCity()!.checkpoint.mode, 'ready');
});
void test('workshop and fuel production wait for actual input, construction charges once and launch cannot skip the crisis', () => {
  const s = fresh();
  s.mode = 'running';
  sendCity(s, 'grove', 'camp', 'wood', 9);
  sendCity(s, 'grove', 'camp', 'stone', 7);
  assert.ok(buildCityNode(s, 'workshop'));
  const after = { ...cityNode(s, 'camp').stock };
  assert.equal(buildCityNode(s, 'workshop'), false);
  assert.deepEqual(cityNode(s, 'camp').stock, after);
  assert.ok(buildCityNode(s, 'power', 'fuel'));
  stepCivilization(s, 30);
  assert.equal(cityNode(s, 'power').stock.energy, 0);
  assert.equal(cityNode(s, 'workshop').stock.parts, 0);
  assert.equal(launchCityVoyage(s), false);
  assert.equal(repairCityBridge(s), false);
});
void test('loading subtracts from the source and rerouting preserves the existing shipment until its original destination', () => {
  const s = fresh();
  prepareCity(s);
  sendCity(s, 'grove', 'camp', 'wood', 4);
  const p = s.couriers[0],
    camp = cityNode(s, 'camp'),
    relay = cityNode(s, 'relay');
  const before = camp.stock.wood + relay.stock.wood;
  assert.ok(
    assignCityRoute(s, p.id, {
      from: 'camp',
      to: 'relay',
      resource: 'wood',
      safe: false,
    }),
  );
  untilCity(s, () => p.cargo === 'wood');
  assert.equal(camp.stock.wood + relay.stock.wood + p.load, before);
  const shipment = p.load,
    destination = relay.stock.wood;
  assert.ok(
    assignCityRoute(s, p.id, {
      from: 'farm',
      to: 'port',
      resource: 'food',
      safe: false,
    }),
  );
  assert.equal(p.destination, 'relay');
  assert.equal(p.cargo, 'wood');
  untilCity(s, () => p.cargo === null);
  assert.equal(relay.stock.wood, destination + shipment);
  assert.equal(camp.stock.wood + relay.stock.wood, before);
});
void test('storm blocks direct transit; changing to the high route moves the same cargo and save recovery matches uninterrupted delivery', () => {
  const session = createCampaignSession();
  session.startColony(colony);
  session.startTribe();
  session.updateTribe(tribe);
  session.startCity();
  const s = session.getCity()!.current;
  prepareCity(s);
  assert.ok(startCityCrisis(s));
  const p = s.couriers[0];
  assert.ok(
    assignCityRoute(s, p.id, {
      from: 'power',
      to: 'workshop',
      resource: 'energy',
      safe: false,
    }),
  );
  untilCity(s, () => p.blocked);
  const held = { x: p.x, y: p.y, cargo: p.cargo, load: p.load };
  stepCivilization(s, 2);
  assert.deepEqual({ x: p.x, y: p.y, cargo: p.cargo, load: p.load }, held);
  assert.ok(assignCityRoute(s, p.id, { ...p.route!, safe: true }));
  stepCivilization(s, 2);
  assert.ok(p.x !== held.x || p.y !== held.y);
  assert.equal(p.load, held.load);
  session.updateCity(s);
  const parsed = decodeSave(encodeSave(session.snapshot('city')));
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind !== 'ok') return;
  const resumed = createCampaignSession();
  resumed.restore(parsed.save.campaign);
  const copy = resumed.getCity()!.current;
  assert.equal(copy.mode, 'paused');
  const frozen = structuredClone(copy);
  stepCivilization(copy, 5);
  assert.deepEqual(copy, frozen);
  copy.mode = 'running';
  stepCivilization(copy, 12);
  stepCivilization(s, 12);
  assert.deepEqual(copy, JSON.parse(JSON.stringify(s)));
});
void test('wind output changes during weather and failed chapters remain frozen with their retry checkpoint intact', () => {
  const s = fresh();
  prepareCity(s);
  const calm = structuredClone(s);
  startCityCrisis(s);
  const initial = cityNode(s, 'power').stock.energy;
  stepCivilization(s, 24);
  stepCivilization(calm, 24);
  assert.ok(
    cityNode(calm, 'power').stock.energy - initial >
      cityNode(s, 'power').stock.energy - initial,
  );
  stepCivilization(s, 121);
  assert.equal(s.mode, 'lost');
  const end = structuredClone(s);
  stepCivilization(s, 10);
  assert.deepEqual(s, end);
});
void test('v2 saves migrate without dropping earlier chapters and malformed city transport or node state is rejected', () => {
  const session = createCampaignSession();
  const old = JSON.parse(encodeSave(session.snapshot('journey')));
  old.version = 2;
  delete old.campaign.city;
  const migrated = decodeSave(JSON.stringify(old));
  assert.equal(migrated.kind, 'ok');
  if (migrated.kind === 'ok') {
    assert.equal(migrated.save.version, 5);
    assert.equal(migrated.save.campaign.city, null);
  }
  session.startColony(colony);
  session.startTribe();
  session.updateTribe(tribe);
  session.startCity();
  const bad = JSON.parse(encodeSave(session.snapshot('city')));
  bad.campaign.city.current.nodes.pop();
  assert.equal(decodeSave(JSON.stringify(bad)).kind, 'invalid');
  const cargo = JSON.parse(encodeSave(session.snapshot('city')));
  cargo.campaign.city.current.couriers[0].cargo = 'energy';
  cargo.campaign.city.current.couriers[0].destination = null;
  assert.equal(decodeSave(JSON.stringify(cargo)).kind, 'invalid');
});
