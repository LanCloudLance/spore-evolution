import { createCampaignSession } from './campaign-session.ts';
import { createOceanWorld } from './ocean.ts';
import type { SaveStorage } from './campaign-save.ts';
/** Keep practice, backups and format migration copies separate from the main journey. */
export function oceanPracticeStorage(storage: SaveStorage): SaveStorage {
  const key = (name: string) => `practice.ocean.${name}`;
  return {
    getItem: (name) => storage.getItem(key(name)),
    setItem: (name, value) => storage.setItem(key(name), value),
  };
}

export function createOceanPracticeSession() {
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), createOceanWorld(23));
  session.journey.getWorld().mode = 'paused';
  session.journey.publish();
  return session;
}
