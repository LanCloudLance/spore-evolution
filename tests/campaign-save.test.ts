import { createOceanWorld, enterOcean } from './helpers/legacy-ocean.ts';
import { runSpace } from './helpers/space-route.ts';
import { completeJourney } from '../app/game/space.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { createWorld, stepWorld } from '../app/game/simulation.ts';

import { createShoreWorld, enterShore } from '../app/game/shore.ts';
import { createLandWorld, enterLand } from '../app/game/land.ts';
import {
  createColonyWorld,
  colonyFromLand,
  stepColony,
} from '../app/game/colony.ts';
import {
  decodeSave,
  encodeSave,
  readCampaignSave,
  writeCampaignSave,
  pausedCampaign,
  SAVE_KEY,
  BACKUP_KEY,
} from '../app/game/campaign-save.ts';
import {
  runPond,
  runOcean,
  runShore,
  runLand,
  runColony,
} from './helpers/campaign-route.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { runCity } from './helpers/city-route.ts';
type MutableEnvelope = {
  campaign: {
    journey: Record<string, unknown> & { player: Record<string, unknown> };
    active: unknown;
  };
};
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    data,
  };
};
void test('all five live chapter formats round-trip, including anatomy, tasks, nested checkpoints and transient effects', () => {
  for (const w of [
    createWorld(),
    createOceanWorld(),
    createShoreWorld(),
    createLandWorld(),
  ]) {
    const session = createCampaignSession();
    Object.assign(session.journey.getWorld(), w);
    session.journey.getWorld().mode = 'running';
    stepWorld(session.journey.getWorld(), { x: 1, y: 0.2, dash: false }, 0.3);
    const c = createColonyWorld();
    c.mode = 'running';
    stepColony(c, { x: 1, y: 0 }, 3);
    session.startColony(c);
    const snapshot = session.snapshot(
        w.habitat === 'land' ? 'colony' : 'journey',
      ),
      decoded = decodeSave(encodeSave(snapshot, 123));
    assert.equal(decoded.kind, 'ok');
    if (decoded.kind !== 'ok') return;
    const again = createCampaignSession();
    assert.equal(again.restore(decoded.save.campaign), snapshot.active);
    assert.deepEqual(
      again.snapshot(snapshot.active),
      JSON.parse(JSON.stringify(pausedCampaign(snapshot))),
    );
  }
});
void test('invalid shape, invalid enum, broken branch, future versions and oversized inputs are rejected without throwing', () => {
  const snapshot = createCampaignSession().snapshot('journey');
  for (const alter of [
    (v: MutableEnvelope) => {
      v.campaign.journey.player.x = null;
    },
    (v: MutableEnvelope) => {
      v.campaign.journey.form = 'missing';
    },
    (v: MutableEnvelope) => {
      v.campaign.journey.foods = [{}];
    },
    (v: MutableEnvelope) => {
      v.campaign.journey.habitat = 'land';
    },
    (v: MutableEnvelope) => {
      v.campaign.active = 'colony';
    },
  ]) {
    const v = JSON.parse(encodeSave(snapshot));
    alter(v);
    assert.equal(decodeSave(JSON.stringify(v)).kind, 'invalid');
  }
  assert.equal(decodeSave('{bad').kind, 'invalid');
  assert.equal(decodeSave('x'.repeat(2_000_001)).kind, 'invalid');
  assert.equal(decodeSave('{"version":6}').kind, 'unsupported');
});
void test('backup recovers corruption without replacing a future-format save; failed storage writes preserve prior progress', () => {
  const store = memory(),
    s = createCampaignSession();
  s.journey.getWorld().food = 10;
  assert.ok(writeCampaignSave(store, s.snapshot('journey'), 1));
  s.journey.getWorld().food = 20;
  assert.ok(writeCampaignSave(store, s.snapshot('journey'), 2));
  store.setItem(SAVE_KEY, 'broken');
  const recovered = readCampaignSave(store);
  assert.equal(recovered.kind, 'recovered');
  if (recovered.kind === 'recovered')
    assert.equal(recovered.save.campaign.journey.food, 10);
  assert.ok(writeCampaignSave(store, s.snapshot('journey'), 3));
  assert.equal(decodeSave(store.getItem(BACKUP_KEY)).kind, 'ok');
  store.setItem(SAVE_KEY, '{"version":99}');
  assert.equal(readCampaignSave(store).kind, 'unsupported');
  assert.equal(writeCampaignSave(store, s.snapshot('journey')), false);
  assert.equal(store.getItem(SAVE_KEY), '{"version":99}');
  assert.equal(
    writeCampaignSave(
      {
        getItem: store.getItem,
        setItem: () => {
          throw Error('quota');
        },
      },
      s.snapshot('journey'),
    ),
    false,
  );
  assert.equal(
    readCampaignSave({
      getItem: () => {
        throw Error('denied');
      },
      setItem: () => {},
    }).kind,
    'unavailable',
  );
});
void test('one life completes eight chapters with a fresh session restore at every chapter boundary', () => {
  let session = createCampaignSession();
  session.journey.getWorld().mode = 'running';
  runPond(session.journey.getWorld());
  const restore = () => {
    const before = session.snapshot('journey'),
      next = createCampaignSession();
    const parsed = decodeSave(encodeSave(before));
    assert.equal(parsed.kind, 'ok');
    if (parsed.kind !== 'ok') throw Error(parsed.kind);
    next.restore(parsed.save.campaign);
    assert.deepEqual(
      next.journey.getWorld().history,
      JSON.parse(JSON.stringify(before.journey.history)),
    );
    session = next;
  };
  restore();
  assert.ok(enterOcean(session.journey.getWorld()));
  runOcean(session.journey.getWorld(), 'radial');
  restore();
  assert.ok(enterShore(session.journey.getWorld()));
  runShore(session.journey.getWorld(), 'skipper', 'skin');
  restore();
  assert.ok(enterLand(session.journey.getWorld()));
  runLand(session.journey.getWorld());
  restore();
  const colony = colonyFromLand(session.journey.getWorld())!;
  colony.mode = 'running';
  session.startColony(colony);
  const persisted = decodeSave(encodeSave(session.snapshot('colony')));
  assert.equal(persisted.kind, 'ok');
  if (persisted.kind !== 'ok') return;
  const next = createCampaignSession();
  assert.equal(next.restore(persisted.save.campaign), 'colony');
  const c = next.getColony()!.current;
  assert.equal(c.mode, 'paused');
  c.mode = 'running';
  runColony(c);
  assert.equal(c.mode, 'won');
  assert.deepEqual(
    c.history.map((a) => a.generation),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  next.updateColony(c);
  assert.ok(next.startTribe());
  const saved = decodeSave(encodeSave(next.snapshot('tribe')));
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') return;
  const final = createCampaignSession();
  assert.equal(final.restore(saved.save.campaign), 'tribe');
  const t = final.getTribe()!.current;
  runTribe(t, 'hammer', 'help');
  final.updateTribe(t);
  assert.deepEqual(t.choices, ['tool:hammer', 'moss:help', 'reed:help']);
  assert.deepEqual(t.history, c.history);
  const won = decodeSave(encodeSave(final.snapshot('tribe')));
  assert.equal(won.kind, 'ok');
  if (won.kind === 'ok') {
    final.restore(won.save.campaign);
    assert.equal(final.getTribe()!.current.mode, 'won');
  }
  assert.ok(final.startCity());
  const citySave = decodeSave(encodeSave(final.snapshot('city')));
  assert.equal(citySave.kind, 'ok');
  if (citySave.kind !== 'ok') return;
  const citySession = createCampaignSession();
  assert.equal(citySession.restore(citySave.save.campaign), 'city');
  const city = citySession.getCity()!.current;
  runCity(city, 'fuel');
  citySession.updateCity(city);
  assert.deepEqual(city.history, t.history);
  assert.ok(city.choices.includes('energy:fuel'));
  const completed = decodeSave(encodeSave(citySession.snapshot('city')));
  assert.equal(completed.kind, 'ok');
  if (completed.kind === 'ok') {
    citySession.restore(completed.save.campaign);
    assert.equal(citySession.getCity()!.current.mode, 'won');
  }
  assert.ok(citySession.startSpace());
  const spaceSave = decodeSave(encodeSave(citySession.snapshot('space')));
  assert.equal(spaceSave.kind, 'ok');
  if (spaceSave.kind !== 'ok') return;
  const spaceSession = createCampaignSession();
  assert.equal(spaceSession.restore(spaceSave.save.campaign), 'space');
  const space = spaceSession.getSpace()!.current;
  runSpace(space, 'ember', 'wetland', 'sail', true);
  spaceSession.updateSpace(space);
  assert.ok(completeJourney(space));
  assert.deepEqual(space.history, t.history);
  const spaceWon = decodeSave(encodeSave(spaceSession.snapshot('space')));
  assert.equal(spaceWon.kind, 'ok');
  if (spaceWon.kind === 'ok') spaceSession.restore(spaceWon.save.campaign);
  assert.equal(spaceSession.getSpace()!.current.mode, 'won');
  assert.ok(spaceSession.newJourney(undefined, 23));
  const archive = decodeSave(encodeSave(spaceSession.snapshot('journey')));
  assert.equal(archive.kind, 'ok');
  if (archive.kind === 'ok') spaceSession.restore(archive.save.campaign);
  assert.equal(spaceSession.getRecords().length, 1);
  assert.ok(completeJourney(spaceSession.getRecords()[0]));
  assert.equal(spaceSession.journey.getWorld().generation, 1);
  assert.deepEqual(spaceSession.journey.getWorld().history, []);
  assert.equal(spaceSession.getSpace(), null);
});
