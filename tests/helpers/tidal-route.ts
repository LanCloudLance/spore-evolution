import { TIDAL_SHARE_RADIUS } from '../../app/game/tidal/ecology.ts';
import { guideOceanActor } from '../../app/game/ocean-dna.ts';
import { commitBiologicalEvolution } from '../../app/game/biological-evolution.ts';
import assert from 'node:assert/strict';
import type { World, Vec } from '../../app/game/simulation.ts';
import { stepWorld, distance, getStats } from '../../app/game/simulation.ts';
import { evolveOcean, oceanEvolutionGate } from '../../app/game/ocean.ts';
import {
  tidalExitGate,
  tidalGuidance,
} from '../../app/game/tidal/migration.ts';
import { tidalWaypoint } from '../../app/game/tidal/habitat.ts';
import { bodyRadius } from '../../app/game/food-chain.ts';
import { organZones, worldBodyPose } from '../../app/game/body-geometry.ts';
import { hasOrgan } from '../../app/game/body-layout.ts';
import { commitBody, bodyBirthCost } from '../../app/game/body-design.ts';
import { bodyDraft, placeDraftOrgan } from '../../app/game/tidal/body-draft.ts';
import { setTidalSlots } from '../../app/game/tidal/abilities.ts';
import { TIDAL_BIOMES } from '../../app/game/tidal/catalog.ts';
/** Simulated player policy. Only normal inputs, public choices and paid edits mutate the world. */
export function runTidalRoute(
  w: World,
  style: 'hunt' | 'filter' | 'reserve',
  supplyMethod: 'hunt' | 'filter' | 'reserve' | 'symbiosis' = style,
): void {
  let frames = 0,
    command = 0,
    used = false;
  let foodId = '',
    foodHeading = 0;
  const radial = style !== 'hunt';
  while (w.mode === 'running' && frames < 30000) {
    const o = w.ocean!,
      t = o.tidal!,
      p = w.player;
    let action: 'slot0' | 'slot1' | 'interact' | undefined;
    if (!o.morph && o.tier < 2 && !oceanEvolutionGate(w)) {
      const trait = (['flagellum', 'shell', 'vacuole', 'spikes'] as const).find(
        (trait) => !w.traits.includes(trait),
      )!;
      assert.ok(
        evolveOcean(
          w,
          o.tier === 0
            ? radial
              ? 'radial'
              : 'bilateral'
            : radial
              ? 'jelly'
              : 'fish',
          trait,
        ),
      );
    }
    // Radial bodies can actually filter without a jaw. This is a paid anatomy birth, never a state injection.
    if (
      radial &&
      o.tier >= 1 &&
      hasOrgan(o.body, 'jaw') &&
      !o.morph &&
      distance(p, TIDAL_BIOMES[0]) < 230
    ) {
      const draft = bodyDraft(o.body);
      draft.placements = draft.placements!.filter(
        (part) => part.organ !== 'jaw',
      );
      if (o.dna >= bodyBirthCost(w, draft)) assert.ok(commitBody(w, draft));
    }
    if (
      radial &&
      o.tier >= 1 &&
      !o.morph &&
      t.abilities.slots[0] !== 'filter'
    ) {
      w.mode = 'paused';
      assert.ok(
        setTidalSlots(w, [
          'filter',
          hasOrgan(o.body, 'reserve') ? 'reserve' : 'form-skill',
        ]),
      );
      w.mode = 'running';
    }
    if (
      style === 'reserve' &&
      o.discovered.includes('reserve') &&
      !hasOrgan(o.body, 'reserve') &&
      !o.morph &&
      distance(p, TIDAL_BIOMES[0]) < 230
    ) {
      const draft = placeDraftOrgan(bodyDraft(o.body), 'reserve', 'belly', 0);
      if (o.dna >= bodyBirthCost(w, draft))
        assert.ok(commitBody(w, draft, ['filter', 'reserve']));
    }
    if (
      radial &&
      o.tier === 0 &&
      !o.morph &&
      w.evolution?.trial === 'ocean-skill' &&
      !w.evolution.used &&
      o.skillCooldown <= 0 &&
      p.energy > 40
    )
      action = 'slot0';
    else if (
      style === 'reserve' &&
      o.tier === 2 &&
      t.migration.startedTick !== null &&
      t.abilities.reserveEnergy > 0 &&
      p.energy < getStats(w.traits, w.form).maxEnergy - 10 &&
      !t.migration.gains.reserve
    )
      action = 'slot1';
    else if (
      style === 'hunt' &&
      !o.morph &&
      o.skillCooldown <= 0 &&
      p.energy > 40 &&
      (!used || (w.evolution && !w.evolution.used))
    ) {
      action = 'slot0';
      used = true;
    }
    if (!tidalExitGate(w)) action = 'interact';
    if (
      o.tier < 2 &&
      w.dnaLineage?.oceanBody &&
      commitBiologicalEvolution(w, `ocean:${w.dnaLineage.oceanBody}`)
    )
      continue;
    let target: Vec = tidalGuidance(w)?.point ?? TIDAL_BIOMES[0];
    if (
      o.tier < 2 &&
      !w.dnaLineage?.oceanBody &&
      w.food >= (o.tier === 0 ? 10 : 14)
    ) {
      const missing =
        o.tier === 0
          ? !o.visited.includes('透光浮游区')
            ? 'drift'
            : null
          : !o.visited.includes('珊瑚礁缘')
            ? 'reef'
            : !o.visited.includes('洋流走廊')
              ? 'drift'
              : null;
      target = missing
        ? TIDAL_BIOMES.find((b) => b.id === missing)!
        : TIDAL_BIOMES[0];
    }
    const returnEnergy =
      o.tier < 2
        ? Math.min(
            getStats(w.traits, w.form).maxEnergy - 5,
            (o.tier === 0 ? 65 : 75) +
              (distance(p, TIDAL_BIOMES[0]) /
                getStats(w.traits, w.form).speed) *
                getStats(w.traits, w.form).metabolism *
                1.3 +
              5,
          )
        : 55;
    const needFood =
      w.food < (o.tier === 0 ? 10 : o.tier === 1 ? 14 : 5) ||
      p.energy < returnEnergy;
    const foods = t.foods.filter(
      (f) => f.state === 'available' && (!radial || f.kind === 'plankton'),
    );
    const nearest = foods.sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (needFood && nearest) target = nearest;
    if (
      style === 'reserve' &&
      o.tier >= 1 &&
      !hasOrgan(o.body, 'reserve') &&
      !needFood
    ) {
      if (o.discovered.includes('reserve')) target = TIDAL_BIOMES[0];
      else {
        const ribbon = t.actors
          .filter((a) => a.species === 'ribbonfish' && a.health > 0)
          .sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (ribbon) {
          target = distance(p, ribbon) < 100 ? { x: p.x, y: p.y } : ribbon;
          if (distance(p, ribbon) < 115 && w.food > 0) action = 'interact';
        }
      }
    }
    if (
      style === 'hunt' &&
      o.tier === 2 &&
      t.migration.startedTick !== null &&
      !Object.values(t.migration.gains).some((n) => n > 0) &&
      !needFood
    ) {
      const prey = t.actors
        .filter(
          (a) =>
            a.health > 0 &&
            ['silver-dart', 'thinwing', 'sand-eel'].includes(a.species),
        )
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (prey) {
        target = prey;
        if (o.skillCooldown <= 0 && p.energy > 30) action = 'slot0';
      }
    }
    if (
      style === 'reserve' &&
      o.tier === 2 &&
      hasOrgan(o.body, 'reserve') &&
      !t.migration.gains.reserve &&
      t.abilities.reserveEnergy === 0 &&
      nearest
    )
      target = nearest;
    // Tide wait remains in a real shelter with replenishable food, not an empty sea.
    if (
      o.tier === 2 &&
      t.migration.visited.includes('reef') &&
      t.migration.visited.includes('drift') &&
      Object.values(t.migration.gains).some((n) => n > 0) &&
      distance(p, TIDAL_BIOMES[3]) < 150 &&
      tidalExitGate(w)?.includes('大潮')
    ) {
      target = p.energy < 85 && nearest ? nearest : TIDAL_BIOMES[3];
    }
    if (
      w.dnaLineage?.oceanBody === 'shellrunner' &&
      t.migration.startedTick !== null &&
      !t.migration.gains.symbiosis &&
      !needFood
    ) {
      const partner = t.actors
        .filter(
          (a) =>
            ['pipe-seahorse', 'ribbonfish'].includes(a.species) && a.health > 0,
        )
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      const approach = partner && guideOceanActor(w, partner.id, 'visit');
      if (approach) target = approach.target;
      if (partner && distance(p, partner) <= TIDAL_SHARE_RADIUS && w.food > 0)
        action = 'interact';
    }
    const targetedFood = t.foods.find(
      (f) => f.state === 'available' && f.x === target.x && f.y === target.y,
    );
    if (
      radial &&
      o.tier >= 1 &&
      !o.morph &&
      action !== 'slot1' &&
      action !== 'interact'
    ) {
      const feeding = !!targetedFood && distance(p, targetedFood) < 100;
      if (t.abilities.filterOpen !== feeding) action = 'slot0';
    }
    if (targetedFood && hasOrgan(o.body, 'jaw') && !t.abilities.filterOpen) {
      if (targetedFood.id !== foodId) {
        foodId = targetedFood.id;
        foodHeading = Math.atan2(target.y - p.y, target.x - p.x);
      }
      const mouth = organZones(
        { ...worldBodyPose(w), angle: foodHeading },
        'jaw',
      )[0];
      if (mouth)
        target = {
          x: target.x - (mouth.x - p.x),
          y: target.y - (mouth.y - p.y),
        };
    }
    const destination = tidalWaypoint(
        { ...p, radius: bodyRadius(w) * o.body.width },
        target,
      ),
      d = distance(p, destination),
      angle = Math.atan2(destination.y - p.y, destination.x - p.x);
    const feedingTurn =
      targetedFood &&
      hasOrgan(o.body, 'jaw') &&
      !t.abilities.filterOpen &&
      d < 15;
    stepWorld(
      w,
      {
        x: feedingTurn
          ? 0.06 * Math.cos(foodHeading)
          : d < 5
            ? 0
            : Math.cos(angle),
        y: feedingTurn
          ? 0.06 * Math.sin(foodHeading)
          : d < 5
            ? 0
            : Math.sin(angle),
        dash: false,
        ...(action ? { tidalCommand: { id: ++command, kind: action } } : {}),
      },
      0.05,
    );
    frames++;
  }
  assert.equal(
    w.mode,
    'won',
    `style ${style};seed ${w.seed};time ${w.time};tier ${w.ocean!.tier};food ${w.food};energy ${w.player.energy};at ${w.player.x},${w.player.y}; gate ${tidalExitGate(w)}; migration ${JSON.stringify(w.ocean!.tidal!.migration)};discovered ${w.ocean!.discovered.join(',')}; body ${JSON.stringify(w.ocean!.body)}; abilities ${JSON.stringify(w.ocean!.tidal!.abilities)}; max ${getStats(w.traits, w.form).maxEnergy}; reason ${w.reason}`,
  );
  assert.ok(
    (w.ocean!.tidal!.migration.gains[supplyMethod] ?? 0) > 0,
    `${supplyMethod} must be a real supply method`,
  );
  assert.ok(w.ocean!.tidal!.abilities.lastCommandId > 0);
}
