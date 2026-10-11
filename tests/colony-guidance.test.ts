import test from 'node:test';
import assert from 'node:assert/strict';
import * as colony from '../app/game/colony.ts';
import { distance } from '../app/game/simulation.ts';

void test('colony guidance finds actual wood and returns a full load to deposit without awarding resources on selection', () => {
  const guide = (
    colony as unknown as {
      colonyJourneyTarget?: (s: colony.ColonyState) => {
        point: { x: number; y: number };
        label: string;
      };
    }
  ).colonyJourneyTarget;
  assert.ok(guide);
  const s = colony.createColonyWorld();
  s.mode = 'running';
  s.members = [];
  const travel = (point: { x: number; y: number }) => {
    for (let i = 0; i < 500 && distance(point, s.player) > 10; i++) {
      const d = distance(point, s.player);
      colony.stepColony(
        s,
        {
          x: (point.x - s.player.x) / d,
          y: (point.y - s.player.y) / d,
          interact: false,
        },
        0.05,
      );
    }
  };
  for (let i = 0; i < colony.colonyCapacity(s); i++) {
    const goal = guide(s);
    assert.ok(
      s.patches.some(
        (p) => p === goal.point && p.kind === 'wood' && p.cooldown === 0,
      ),
    );
    assert.equal(s.wood, 0);
    travel(goal.point);
    colony.stepColony(s, { x: 0, y: 0, interact: true }, 0.05);
    assert.equal(s.player.load, i + 1);
  }
  const home = guide(s);
  assert.deepEqual(home.point, colony.COLONY_NEST);
  travel(home.point);
  colony.stepColony(s, { x: 0, y: 0, interact: true }, 0.05);
  assert.equal(s.wood, colony.colonyCapacity(s));
  assert.equal(s.player.load, 0);
});
