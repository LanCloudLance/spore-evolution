import { learnFrom } from '../lineage-learning.ts';
import { ingestBiologicalDna } from '../dna-evolution.ts';
import type { World, Vec } from '../simulation.ts';
import { distance, announce } from '../simulation.ts';
import type { TidalSignal } from './types.ts';
import { TIDAL_ORGANS } from './catalog.ts';
import { tidalObstacles } from './habitat.ts';
import { emittedTidalSignal } from './ecology.ts';
export function tidalSight(from: Vec, to: Vec): boolean {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = dx * dx + dy * dy;
  return !tidalObstacles(0).some((r) => {
    const fraction = length
      ? Math.max(
          0,
          Math.min(1, ((r.x - from.x) * dx + (r.y - from.y) * dy) / length),
        )
      : 0;
    return (
      distance(r, { x: from.x + fraction * dx, y: from.y + fraction * dy }) <
      r.radius
    );
  });
}
export function observeTidalSignals(
  w: World,
  signals: readonly TidalSignal[],
): void {
  if (!w.ocean?.tidal || w.mode !== 'running' || w.ocean.morph) return;
  const o = w.ocean,
    t = o.tidal!;
  for (const actor of t.actors)
    if (
      actor.health > 0 &&
      distance(actor, w.player) <= 180 &&
      tidalSight(w.player, actor) &&
      !t.journal.seen.includes(actor.species)
    )
      t.journal.seen.push(actor.species);
  for (const signal of signals) {
    if (
      !emittedTidalSignal(w, signal) ||
      signal.tick !== t.tick ||
      signal.actorId === 'player' ||
      distance(w.player, signal.point) > 180 ||
      !tidalSight(w.player, signal.point)
    )
      continue;
    const actor = t.actors.find((a) => a.id === signal.actorId);
    if (!actor) continue;
    if (
      signal.kind === 'shoal-avoid' &&
      Math.hypot(w.player.vx, w.player.vy) > 35
    )
      continue;
    const organs = TIDAL_ORGANS.filter(
      (organ) =>
        organ.source?.species === actor.species &&
        organ.source.signal === signal.kind,
    );
    // One witnessed action may reveal several structures, but is one source event.
    if (organs.some((organ) => !t.journal.claimed.includes(organ.id)))
      ingestBiologicalDna(w, `sea:${actor.species}`, 'observe');
    for (const organ of organs) {
      learnFrom(
        w,
        ['shell', 'spine'].includes(organ.id)
          ? 'ocean:armor-observe'
          : organ.id === 'filter'
            ? 'ocean:filter'
            : organ.id === 'lateral'
              ? 'ocean:swim-observe'
              : organ.id === 'reserve'
                ? 'ocean:reserve-observe'
                : 'ocean:carry-observe',
      );
      if (t.journal.claimed.includes(organ.id)) continue;
      t.journal.evidence[organ.id] = signal.seq;
      t.journal.claimed.push(organ.id);
      if (o.discovered.includes(organ.id)) continue;
      o.discovered.push(organ.id);
      o.dna = Math.min(999, o.dna + 16);
      announce(w, `观察到${organ.name}的作用 · 回育生湾试装`);
    }
  }
}
