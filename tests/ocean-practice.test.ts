import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import {
  readCampaignSave,
  writeCampaignSave,
  SAVE_KEY,
  BACKUP_KEY,
} from '../app/game/campaign-save.ts';
const practice = await import('../app/game/ocean-practice.ts').catch(
  () => null,
);
void test('ocean practice saves, backup recovery and retries cannot overwrite or load the main campaign', () => {
  assert.ok(practice);
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const main = createCampaignSession();
  main.journey.getWorld().mode = 'running';
  assert.ok(writeCampaignSave(storage, main.snapshot('journey'), 1));
  const original = data.get(SAVE_KEY);
  const isolated = practice.oceanPracticeStorage(storage);
  assert.equal(readCampaignSave(isolated).kind, 'empty');
  const ocean = createCampaignSession();
  Object.assign(ocean.journey.getWorld(), createOceanWorld(23));
  assert.ok(writeCampaignSave(isolated, ocean.snapshot('journey'), 2));
  ocean.journey.getWorld().mode = 'paused';
  assert.ok(writeCampaignSave(isolated, ocean.snapshot('journey'), 3));
  assert.equal(data.get(SAVE_KEY), original);
  assert.equal(data.get(BACKUP_KEY), undefined);
  isolated.setItem(SAVE_KEY, 'broken');
  const recovered = readCampaignSave(isolated);
  assert.equal(recovered.kind, 'recovered');
  if (recovered.kind === 'recovered')
    assert.equal(recovered.save.campaign.journey.habitat, 'ocean');
  const loadedMain = readCampaignSave(storage);
  assert.equal(loadedMain.kind, 'ok');
  if (loadedMain.kind === 'ok')
    assert.equal(loadedMain.save.campaign.journey.habitat, 'pond');
});

void test('practice starts with a published paused ocean snapshot, including its server snapshot', () => {
  assert.ok(practice);
  const session = practice.createOceanPracticeSession();
  assert.equal(session.journey.getWorld().habitat, 'ocean');
  assert.equal(session.journey.getSnapshot().habitat, 'ocean');
  assert.equal(session.journey.getServerSnapshot().habitat, 'ocean');
  assert.equal(session.journey.getSnapshot().mode, 'paused');
});
