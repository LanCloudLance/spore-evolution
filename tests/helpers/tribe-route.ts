import assert from 'node:assert/strict';
import type { TribeState, Material, Tool } from '../../app/game/tribe.ts';
import {
  TRIBE_HOME,
  TRIBE_COUNCIL,
  TOOL_COST,
  CAMP_COST,
  tribeInteract,
  stepTribe,
  craftTribeTool,
  neighborAction,
  setTribeRole,
  startTribeStorm,
} from '../../app/game/tribe.ts';
import { distance } from '../../app/game/simulation.ts';
export function walkTribe(s: TribeState, target: { x: number; y: number }) {
  for (
    let i = 0;
    i < 2000 && distance(s.player, target) > 15 && s.mode === 'running';
    i++
  ) {
    const dx = target.x - s.player.x,
      dy = target.y - s.player.y,
      d = Math.hypot(dx, dy);
    stepTribe(s, { x: dx / d, y: dy / d }, 0.05);
  }
  assert.ok(
    distance(s.player, target) <= 15,
    `could not reach ${target.x},${target.y}: ${s.notice}`,
  );
}
export function collectTribe(s: TribeState, kind: Material, count: number) {
  if (s.player.load) {
    walkTribe(s, TRIBE_HOME);
    tribeInteract(s);
  }
  for (let i = 0; s.stores[kind] < count && i < 100; i++) {
    const patch = s.patches
      .filter((p) => p.kind === kind && p.cooldown === 0)
      .sort((a, b) => distance(s.player, a) - distance(s.player, b))[0];
    if (!patch) {
      stepTribe(s, { x: 0, y: 0 }, 1);
      continue;
    }
    walkTribe(s, patch);
    assert.ok(tribeInteract(s), s.notice);
    walkTribe(s, TRIBE_HOME);
    assert.ok(tribeInteract(s), s.notice);
  }
  assert.ok(s.stores[kind] >= count, `could not gather ${kind} ${count}`);
}
export function runTribe(
  s: TribeState,
  tool: Tool = 'basket',
  diplomacy: 'trade' | 'help' = 'trade',
) {
  assert.equal(s.mode, 'ready');
  s.mode = 'running';
  for (const [kind, count] of Object.entries(TOOL_COST[tool]))
    collectTribe(s, kind as Material, count);
  walkTribe(s, TRIBE_HOME);
  assert.ok(craftTribeTool(s, tool), s.notice);
  const costs =
    diplomacy === 'trade'
      ? { food: 8, wood: 8 }
      : { wood: 7, stone: 2, fiber: 2 };
  for (const [kind, count] of Object.entries(costs))
    collectTribe(s, kind as Material, count);
  for (const n of s.neighbors) {
    walkTribe(s, n);
    assert.ok(tribeInteract(s), s.notice);
    assert.ok(neighborAction(s, n.id, diplomacy), s.notice);
    if (diplomacy === 'trade')
      assert.ok(neighborAction(s, n.id, diplomacy), s.notice);
  }
  for (const [kind, count] of Object.entries(CAMP_COST))
    collectTribe(s, kind as Material, count);
  walkTribe(s, TRIBE_COUNCIL);
  assert.ok(tribeInteract(s), s.notice);
  collectTribe(s, 'wood', 9);
  collectTribe(s, 'stone', 6);
  for (const m of s.members) assert.ok(setTribeRole(s, m.id, 'escort'));
  walkTribe(s, TRIBE_COUNCIL);
  assert.ok(startTribeStorm(s));
  for (const b of s.banks) {
    walkTribe(s, b);
    assert.ok(tribeInteract(s), s.notice);
    for (let i = 0; i < 200 && b.work < 6; i++)
      stepTribe(s, { x: 0, y: 0 }, 0.05);
    assert.equal(b.work, 6);
  }
  walkTribe(s, TRIBE_COUNCIL);
  for (
    let i = 0;
    i < 400 &&
    s.neighbors.some((n) => distance(n.builder, TRIBE_COUNCIL) > 100);
    i++
  )
    stepTribe(s, { x: 0, y: 0 }, 0.05);
  assert.ok(tribeInteract(s), s.notice);
  assert.equal(s.mode, 'won');
}
