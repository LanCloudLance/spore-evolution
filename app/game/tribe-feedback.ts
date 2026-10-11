import type { TribeState } from './tribe.ts';
import {
  TRIBE_HOME,
  TRIBE_COUNCIL,
  MATERIAL_NAMES,
  TOOL_NAMES,
  TRIBE_ROLES,
} from './tribe.ts';
export type TribeCue = {
  x: number;
  y: number;
  at: number;
  text: string;
  kind: 'gather' | 'delivery' | 'tool' | 'friend' | 'camp' | 'bank' | 'role';
};
export function tribeSnapshot(s: TribeState) {
  return {
    time: s.time,
    load: s.player.load,
    carrying: s.player.carrying,
    tools: [...s.tools],
    camp: s.camp,
    members: s.members.map((m) => ({
      id: m.id,
      carrying: m.carrying,
      load: m.load,
      role: m.role,
    })),
    neighbors: s.neighbors.map((n) => ({
      id: n.id,
      met: n.met,
      trust: n.trust,
    })),
    banks: s.banks.map((b) => ({ id: b.id, paid: b.paid, work: b.work })),
  };
}
export function tribeCues(
  before: ReturnType<typeof tribeSnapshot>,
  s: TribeState,
): TribeCue[] {
  if (s.time < before.time || s.mode === 'ready') return [];
  const cues: TribeCue[] = [];
  const add = (
    kind: TribeCue['kind'],
    text: string,
    at: { x: number; y: number },
  ) => cues.push({ kind, text, x: at.x, y: at.y, at: s.time });
  if (s.player.load > before.load && s.player.carrying)
    add(
      'gather',
      `+${s.player.load - before.load} ${MATERIAL_NAMES[s.player.carrying]}`,
      s.player,
    );
  if (before.load && before.carrying && !s.player.load)
    add(
      'delivery',
      `入库 +${before.load} ${MATERIAL_NAMES[before.carrying]}`,
      TRIBE_HOME,
    );
  for (const tool of s.tools)
    if (!before.tools.includes(tool))
      add('tool', `${TOOL_NAMES[tool]}做好了`, {
        x: TRIBE_HOME.x,
        y: TRIBE_HOME.y - 55,
      });
  if (s.camp && !before.camp) add('camp', '建造者正沿路赶来', TRIBE_COUNCIL);
  for (const n of s.neighbors) {
    const old = before.neighbors.find((v) => v.id === n.id);
    if (old && n.trust > old.trust)
      add('friend', n.trust >= 2 ? '成为盟友' : '交换完成 · 信任+1', {
        x: n.x,
        y: n.y + 80,
      });
    else if (old && !old.met && n.met)
      add('friend', '第一次相遇', { x: n.x, y: n.y + 80 });
  }
  for (const b of s.banks) {
    const old = before.banks.find((v) => v.id === b.id);
    if (old && b.work >= 6 && old.work < 6) add('bank', '河堤合拢了', b);
    else if (old && !old.paid && b.paid) add('bank', '材料已铺下', b);
  }
  for (const m of s.members) {
    const old = before.members.find((v) => v.id === m.id);
    if (!old) continue;
    if (old.carrying && !m.carrying)
      add('delivery', `入库 +${old.load} ${MATERIAL_NAMES[old.carrying]}`, {
        x: TRIBE_HOME.x - 85,
        y: TRIBE_HOME.y + 60,
      });
    if (!old.carrying && m.carrying) add('gather', '采到了', m);
    if (old.role !== m.role) add('role', `去${TRIBE_ROLES[m.role]}`, m);
  }
  return cues;
}
