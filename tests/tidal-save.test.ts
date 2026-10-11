import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { upgradeCampaign } from '../app/game/save-upgrade.ts';
import { validTidalState } from '../app/game/tidal/save-guards.ts';
import { createTidalState } from '../app/game/tidal/state.ts';
import { FORMS } from '../app/game/forms.ts';
import { enterShore } from '../app/game/shore.ts';
import {
  decodeSave,
  encodeSave,
  writeCampaignSave,
  readCampaignSave,
  SAVE_KEY,
  BACKUP_KEY,
  MIGRATION_BACKUP_KEY,
} from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';

// Frozen bytes were captured from the real legacy factories while v4 was current.
const raw = readFileSync(
  new URL('./fixtures/campaign-v4.json', import.meta.url),
  'utf8',
);
const legacy = () => JSON.parse(raw);
const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

void test('upgrade preserves completed ocean and active later chapters, ancestors, checkpoints and archive', () => {
  const old = legacy(),
    snapshot = structuredClone(old);
  const c = upgradeCampaign(old)!;
  assert.ok(c);
  assert.equal(c.active, 'space');
  assert.deepEqual(old, snapshot);
  assert.equal(c.journey.mode, 'won');
  assert.equal(c.journey.ocean!.tidal!.compat.mode, 'completed-legacy');
  assert.equal(c.journey.player.x, old.campaign.journey.player.x);
  assert.equal(
    c.journey.ocean!.body.appearance!.base,
    FORMS[old.campaign.journey.form as keyof typeof FORMS].color,
  );
  assert.equal(
    c.journey.history[0].body!.appearance!.base,
    FORMS[old.campaign.journey.history[0].form as keyof typeof FORMS].color,
  );
  assert.notEqual(
    c.journey.history[0].body!.appearance!.base,
    c.journey.ocean!.body.appearance!.base,
    'parent retains its own palette',
  );
  for (const phase of ['colony', 'tribe', 'city', 'space'] as const) {
    for (const slot of ['current', 'checkpoint'] as const) {
      assert.ok(c[phase]![slot].body.appearance);
      assert.deepEqual(
        c[phase]![slot].body.organs,
        old.campaign[phase][slot].body.organs,
      );
      assert.equal(
        c[phase]![slot].generation,
        old.campaign[phase][slot].generation,
      );
      assert.equal(c[phase]![slot].mode, old.campaign[phase][slot].mode);
    }
  }
  assert.ok(c.records![0].body.appearance);
  assert.ok(c.journey.evolution!.before.body!.appearance);
  assert.ok(
    enterShore(c.journey),
    'completed legacy ocean can still use its exit',
  );
});

void test('mid-migration keeps earned legs without discovery evidence or gameplay rewards', () => {
  const old = legacy();
  old.campaign.active = 'journey';
  const w = old.campaign.journey;
  w.mode = 'running';
  w.ocean.migration = {
    route: 'hunt',
    station: 1,
    progress: 1,
    expanded: false,
    elapsed: 13,
    arrived: false,
    legs: ['hunt'],
  };
  const c = upgradeCampaign(old)!;
  const t = c.journey.ocean!.tidal!;
  assert.equal(t.compat.mode, 'pending');
  assert.equal(t.compat.legacyStations, 1);
  assert.deepEqual(t.compat.legacyLegs, ['hunt']);
  assert.deepEqual(t.journal, { seen: [], evidence: {}, claimed: [] });
  assert.deepEqual(c.journey.ocean!.discovered, w.ocean.discovered);
  assert.equal(c.journey.ocean!.dna, w.ocean.dna);
  assert.equal(c.journey.ocean!.biomass, w.ocean.biomass);
  assert.deepEqual(c.journey.ocean!.migration, w.ocean.migration);
  assert.deepEqual(t.foods, []);
  assert.deepEqual(t.actors, []);
});

void test('future version and failed backup write preserve original bytes; raw migration backup is never rotated', () => {
  const store = memory(),
    campaign = createCampaignSession().snapshot('journey');
  store.setItem(SAVE_KEY, '{"version":6}');
  assert.equal(decodeSave(store.getItem(SAVE_KEY)).kind, 'unsupported');
  assert.equal(writeCampaignSave(store, campaign), false);
  assert.equal(store.getItem(SAVE_KEY), '{"version":6}');
  store.setItem(SAVE_KEY, raw);
  const failed = {
    getItem: store.getItem,
    setItem: (k: string, v: string) => {
      if (k === MIGRATION_BACKUP_KEY) throw Error('quota');
      store.setItem(k, v);
    },
  };
  assert.equal(writeCampaignSave(failed, campaign), false);
  assert.equal(store.getItem(SAVE_KEY), raw);
  assert.equal(writeCampaignSave(store, campaign, 1), true);
  assert.equal(store.getItem(MIGRATION_BACKUP_KEY), raw);
  const another = legacy();
  another.savedAt = 999;
  store.setItem(SAVE_KEY, JSON.stringify(another));
  assert.equal(writeCampaignSave(store, campaign, 2), true);
  assert.equal(store.getItem(MIGRATION_BACKUP_KEY), raw);
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)!).version, 5);
});

void test('v5 validates new anatomy and state, refuses unknown IDs and contradictory ownership in current and checkpoint', () => {
  const c = upgradeCampaign(legacy())!;
  const w = c.journey;
  const t = w.ocean!.tidal!;
  t.compat.mode = 'active';
  w.ocean!.body.placements = [
    { id: 'j', organ: 'jaw', mount: 'tail', t: 0 },
    { id: 's', organ: 'shell', mount: 'back', t: 0.2 },
  ];
  w.ocean!.discovered.push('shell');
  assert.equal(decodeSave(encodeSave(c)).kind, 'ok');
  assert.equal(validTidalState(t), true);
  assert.equal(validTidalState(createTidalState(0xffffffff)), true);
  for (const mutate of [
    (x: typeof t) => {
      x.abilities.reserveEnergy = 41;
    },
    (x: typeof t) => {
      x.nextSeq = NaN;
    },
    (x: typeof t) => {
      x.journal.claimed = ['shell', 'shell'];
    },
    (x: typeof t) => {
      x.journal.claimed = ['unknown' as 'shell'];
    },
    (x: typeof t) => {
      x.migration.visited = ['unknown' as 'reef'];
    },
    (x: typeof t) => {
      x.safeCheckpoint = structuredClone(w) as NonNullable<
        typeof t.safeCheckpoint
      >;
    },
  ]) {
    const x = structuredClone(t);
    mutate(x);
    assert.equal(validTidalState(x), false);
  }
  const owned = createTidalState(23);
  owned.foods = [
    {
      id: 'food1',
      x: 1,
      y: 2,
      kind: 'algae',
      energy: 8,
      biome: 'nursery',
      state: 'carried',
      owner: 'player',
      regrowSeconds: 0,
    },
  ];
  assert.equal(
    validTidalState(owned),
    false,
    'unreferenced carried food is rejected',
  );
  owned.abilities.carriedId = 'food1';
  assert.equal(validTidalState(owned), true);
  owned.foods.push({ ...owned.foods[0], id: 'food2' });
  assert.equal(
    validTidalState(owned),
    false,
    'two foods cannot belong to one carrying slot',
  );
  const malformed = JSON.parse(encodeSave(c));
  malformed.campaign.journey.ocean.body.placements[0].t = 2;
  assert.equal(decodeSave(JSON.stringify(malformed)).kind, 'invalid');
  malformed.campaign.journey.ocean.body.placements[0].t = 0;
  malformed.campaign.space.checkpoint.body.appearance.base = 'invalid';
  assert.equal(decodeSave(JSON.stringify(malformed)).kind, 'invalid');
});

void test('original v4 schema is checked before upgrading and recovery leaves both raw sources unchanged', () => {
  const v = legacy();
  v.campaign.journey.ocean.discovered.push('shell');
  assert.equal(upgradeCampaign(v), null);
  const store = memory();
  store.setItem(SAVE_KEY, raw);
  const result = readCampaignSave(store);
  assert.equal(result.kind, 'ok');
  assert.equal(store.getItem(SAVE_KEY), raw);
  assert.equal(store.getItem(MIGRATION_BACKUP_KEY), null);
  const p = legacy();
  p.campaign.journey.player.x = null;
  assert.equal(upgradeCampaign(p), null);
  for (const version of [1, 2, 3, 4]) {
    const original = legacy();
    original.version = version;
    assert.ok(upgradeCampaign(original));
  }
});

void test('malformed optional anatomy is rejected by the pure upgrader without throwing', () => {
  const c = upgradeCampaign(legacy())!;
  for (const placements of [null, {}, 'tail', [null]]) {
    const envelope = JSON.parse(encodeSave(c));
    envelope.campaign.journey.ocean.body.placements = placements;
    assert.doesNotThrow(() => assert.equal(upgradeCampaign(envelope), null));
  }
  const envelope = JSON.parse(encodeSave(c));
  envelope.campaign.journey.ocean.body.appearance = null;
  assert.equal(upgradeCampaign(envelope), null);
});

void test('saving a recovered v4 backup first preserves those original bytes even with a corrupt primary', () => {
  const store = memory();
  store.setItem(SAVE_KEY, 'broken');
  store.setItem(BACKUP_KEY, raw);
  const read = readCampaignSave(store);
  assert.equal(read.kind, 'recovered');
  if (read.kind !== 'recovered') throw Error('recovery failed');
  assert.ok(writeCampaignSave(store, read.save.campaign));
  assert.equal(store.getItem(MIGRATION_BACKUP_KEY), raw);
});
