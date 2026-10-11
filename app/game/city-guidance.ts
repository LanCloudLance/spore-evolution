import type {
  CivilizationState,
  CityNodeId,
  CityResource,
  CityRoute,
} from './civilization.ts';
import { cityNode } from './civilization.ts';

// These are real assignments to the existing courier system, not instant transfers.
export function citySupplyRoutes(
  s: CivilizationState,
  to: CityNodeId,
): CityRoute[] {
  const needs: Partial<Record<CityNodeId, CityResource[]>> = {
    camp: ['wood', 'stone', 'parts', 'food'],
    power: s.energy === 'fuel' ? ['food'] : [],
    workshop: ['ore', 'energy'],
    relay: ['parts', 'energy'],
    port: ['food', 'energy', 'parts'],
  };
  if (!cityNode(s, to).built) return [];
  const sources: Record<CityResource, CityNodeId> = {
    wood: 'grove',
    stone: 'grove',
    fiber: 'camp',
    food: 'farm',
    ore: 'quarry',
    energy: 'power',
    parts: 'workshop',
  };
  return (needs[to] ?? [])
    .filter((r) => cityNode(s, sources[r]).built)
    .map((resource) => ({
      from: sources[resource],
      to,
      resource,
      safe: s.crisis !== null && !s.bridgeFixed,
    }));
}
