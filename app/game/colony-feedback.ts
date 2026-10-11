import type { ColonyState } from './colony.ts';
import { COLONY_NEST, ROLE_NAMES } from './colony.ts';

export type ColonyCue = {
  x: number;
  y: number;
  at: number;
  kind: 'food' | 'wood' | 'build' | 'growth' | 'repair' | 'role';
  text: string;
};
export function colonySnapshot(s: ColonyState) {
  return {
    time: s.time,
    shelter: s.shelter,
    growth: s.growth,
    integrity: s.integrity,
    delivered: s.delivered,
    load: s.player.load,
    members: s.members.map((m) => ({
      id: m.id,
      carrying: m.carrying,
      role: m.role,
    })),
  };
}
export function colonyCues(
  before: ReturnType<typeof colonySnapshot>,
  s: ColonyState,
): ColonyCue[] {
  if (s.time < before.time || s.mode === 'ready') return [];
  const cues: ColonyCue[] = [];
  const emit = (
    kind: ColonyCue['kind'],
    text: string,
    x = COLONY_NEST.x,
    y = COLONY_NEST.y,
  ) => cues.push({ kind, text, x, y, at: s.time });
  if (s.shelter && !before.shelter) emit('build', '育幼棚落成');
  if (s.growth > before.growth)
    emit(
      'growth',
      s.growth === 100
        ? '新成员加入了！'
        : `成长 +${s.growth - before.growth}%`,
      COLONY_NEST.x,
      COLONY_NEST.y + 160,
    );
  if (s.integrity > before.integrity + 0.1)
    emit('repair', '屋顶加固', COLONY_NEST.x, COLONY_NEST.y - 110);
  if (s.delivered > before.delivered)
    emit(
      'food',
      `储备 +${s.delivered - before.delivered}`,
      COLONY_NEST.x - 140,
      COLONY_NEST.y + 130,
    );
  if (s.player.load > before.load && s.player.carrying)
    emit(
      s.player.carrying === 'wood' ? 'wood' : 'food',
      '+1',
      s.player.x,
      s.player.y,
    );
  for (const m of s.members) {
    const old = before.members.find((v) => v.id === m.id);
    if (!old) continue;
    if (m.carrying && !old.carrying)
      emit(m.carrying === 'wood' ? 'wood' : 'food', '采到了', m.x, m.y);
    if (old.role !== m.role) emit('role', `去${ROLE_NAMES[m.role]}`, m.x, m.y);
  }
  return cues;
}
