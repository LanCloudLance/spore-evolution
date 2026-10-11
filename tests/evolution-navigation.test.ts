import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { guideNavigation } from '../app/game/navigation.ts';
const panels = await import('../app/game/evolution-navigation.ts').catch(
  () => null,
);
void test('precise food guidance continues past a ground-click stop so the real mouth can reach its target', () => {
  const player = { x: 0, y: 0 };
  const ground = { target: { x: 10, y: 0 }, last: { ...player }, stalled: 0 };
  assert.equal(guideNavigation(ground, player, 0.05), null);
  const precise = { ...structuredClone(ground), arrivalRadius: 5 };
  assert.ok(guideNavigation(precise, player, 0.05));
});

void test('choosing a source action from a paused or restored menu resumes before the first navigation frame', () => {
  assert.ok(panels);
  for (const mode of ['paused', 'running'] as const) {
    const w = createOceanWorld(23);
    w.mode = mode;
    const target = { x: w.player.x + 90, y: w.player.y };
    const n = panels.beginGuidedAction(w, { target });
    assert.ok(n);
    assert.equal(w.mode, 'running');
    const before = w.player.x;
    const input = guideNavigation(n, w.player, 1 / 120)!;
    stepWorld(w, { ...input, dash: false }, 1 / 120);
    assert.ok(w.player.x > before);
    assert.notEqual(
      n.target,
      target,
      'UI target snapshots cannot be mutated by pathfinding',
    );
  }
});
void test('closing a menu restores its prior pause state; a failed guided action cannot revive a dead body', () => {
  assert.ok(panels);
  const w = createOceanWorld(23);
  w.mode = 'paused';
  panels.restorePanelMode(w, 'paused');
  assert.equal(w.mode, 'paused');
  panels.restorePanelMode(w, 'running');
  assert.equal(w.mode, 'running');
  w.mode = 'dead';
  const before = structuredClone(w);
  assert.equal(panels.beginGuidedAction(w, { target: w.player }), null);
  panels.restorePanelMode(w, 'running');
  assert.deepEqual(w, before);
});
