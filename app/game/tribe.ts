import { inheritedDna } from './dna-evolution.ts';
import {
  inheritedLearning,
  learnFrom,
  learningBonus,
} from './lineage-learning.ts';
import type { ColonyState } from './colony.ts';
import type { Vec } from './simulation.ts';
import { distance } from './simulation.ts';
export type Material = 'food' | 'wood' | 'stone' | 'fiber';
export type Tool = 'basket' | 'hammer';
export type TribeRole = 'food' | 'wood' | 'stone' | 'escort';
export type TribeMember = Omit<
  ColonyState['members'][number],
  'role' | 'carrying' | 'target'
> & {
  role: TribeRole;
  carrying: Material | null;
  load: number;
  target: number | null;
};
export type TribeState = Pick<
  ColonyState,
  | 'tidalLegacy'
  | 'form'
  | 'body'
  | 'learning'
  | 'dnaLineage'
  | 'traits'
  | 'organ'
  | 'adaptation'
  | 'adaptations'
  | 'generation'
  | 'history'
  | 'standalone'
  | 'mode'
> & {
  freeLife?: boolean;
  organization?: 'network' | 'workshop';
  time: number;
  player: Vec & { angle: number; carrying: Material | null; load: number };
  members: TribeMember[];
  stores: Record<Material, number>;
  tools: Tool[];
  patches: (Vec & { id: number; kind: Material; cooldown: number })[];
  neighbors: (Vec & {
    id: 'moss' | 'reed';
    met: boolean;
    trades: number;
    helped: boolean;
    trust: number;
    builder: Vec;
  })[];
  banks: (Vec & { id: number; paid: boolean; work: number })[];
  camp: boolean;
  storm: number | null;
  integrity: number;
  notice: string;
  choices: string[];
};
export const TRIBE_MAP = { width: 1200, height: 800 };
export const TRIBE_HOME = { x: 215, y: 505 };
export const TRIBE_COUNCIL = { x: 625, y: 405 };
export const MATERIAL_NAMES: Record<Material, string> = {
  food: '果实',
  wood: '树枝',
  stone: '石料',
  fiber: '纤维',
};
export const TRIBE_ROLES: Record<TribeRole, string> = {
  food: '采果',
  wood: '拾枝',
  stone: '采石',
  escort: '随行建造',
};
export const TOOL_NAMES: Record<Tool, string> = {
  basket: '编篮',
  hammer: '石锤',
};
export const TOOL_COST: Record<Tool, Partial<Record<Material, number>>> = {
  basket: { wood: 4, fiber: 3 },
  hammer: { wood: 3, stone: 4 },
};
export const CAMP_COST = { wood: 8, stone: 6, fiber: 4 };
export const WORKSHOP_CAMP_COST = { wood: 12, stone: 10, fiber: 6 };
export function chooseTribeOrganization(
  s: TribeState,
  organization: 'network' | 'workshop',
) {
  if (
    s.mode !== 'running' ||
    s.camp ||
    !['network', 'workshop'].includes(organization)
  )
    return false;
  s.organization = organization;
  s.notice =
    organization === 'workshop'
      ? '以本族工具与工程建家：两类工具和更多本地材料；仍可自选拜访邻居。'
      : '以贸易或互助联系两处邻居，共同建立营地。';
  return true;
}
export const tribeCampCost = (s: TribeState) =>
  s.organization === 'workshop' ? WORKSHOP_CAMP_COST : CAMP_COST;
export const tribeFoundationReady = (s: TribeState) =>
  s.organization === 'workshop'
    ? s.tools.includes('basket') && s.tools.includes('hammer')
    : s.tools.length > 0 && tribeAllies(s) >= 2;
export const BANK_COST = { wood: 3, stone: 2 };
export function tribeFromColony(c: ColonyState): TribeState | null {
  if (c.mode !== 'won' || c.growth !== 100 || !c.shelter || c.integrity <= 0)
    return null;
  const stores = { food: c.food, wood: c.wood, stone: 0, fiber: 0 };
  const materials: Material[] = ['food', 'wood', 'stone', 'fiber'];
  const positions = [
    [130, 220],
    [345, 330],
    [450, 145],
    [325, 680],
    [90, 630],
    [465, 565],
    [800, 110],
    [1050, 430],
    [815, 700],
    [1060, 130],
    [95, 95],
    [520, 700],
  ];
  return {
    ...(c.tidalLegacy ? { tidalLegacy: structuredClone(c.tidalLegacy) } : {}),
    form: c.form,
    body: structuredClone(c.body),
    ...(c.learning ? { learning: inheritedLearning(c) } : {}),
    ...(c.dnaLineage ? { dnaLineage: inheritedDna(c) } : {}),
    traits: [...c.traits],
    organ: c.organ,
    adaptation: c.adaptation,
    adaptations: [...(c.adaptations ?? (c.adaptation ? [c.adaptation] : []))],
    generation: c.generation,
    history: structuredClone(c.history),
    standalone: c.standalone,
    mode: 'ready',
    time: 0,
    stores,
    tools: [],
    player: {
      ...TRIBE_HOME,
      angle: -Math.PI / 2,
      carrying: c.player.carrying === 'guard' ? null : c.player.carrying,
      load: c.player.load,
    },
    members: c.members.map((m, i) => ({
      ...m,
      x: 170 + i * 30,
      y: 540,
      role: m.role === 'guard' ? 'escort' : m.role,
      carrying: m.carrying === 'guard' ? null : m.carrying,
      load: m.carrying && m.carrying !== 'guard' ? 1 : 0,
      target: null,
    })),
    patches: positions.map(([x, y], id) => ({
      x,
      y,
      id,
      kind: materials[id % 4],
      cooldown: 0,
    })),
    neighbors: [
      { id: 'moss' as const, x: 940, y: 220 },
      { id: 'reed' as const, x: 960, y: 650 },
    ].map((n) => ({
      ...n,
      met: false,
      trades: 0,
      helped: false,
      trust: 0,
      builder: { x: n.x, y: n.y },
    })),
    banks: [210, 405, 610].map((y, id) => ({
      id,
      x: 715,
      y,
      paid: false,
      work: 0,
    })),
    camp: false,
    storm: null,
    integrity: 100,
    choices: c.seedLegacy ? [`seed:${c.seedLegacy}`] : [],
    notice: `带来 ${c.members.length} 名真实成员、${c.food} 果实和 ${c.wood} 树枝。身体与谱系继续保留。`,
  };
}
export function tribeCapacity(s: TribeState) {
  return (
    (s.tools.includes('basket') ? 6 : s.tools.includes('hammer') ? 4 : 3) +
    (learningBonus(s, 'weaving', 'tribe') ? 2 : 0)
  );
}
export function costLabel(cost: Partial<Record<Material, number>>) {
  return Object.entries(cost)
    .map(([k, v]) => `${v} ${MATERIAL_NAMES[k as Material]}`)
    .join(' + ');
}
function pay(s: TribeState, cost: Partial<Record<Material, number>>) {
  if (Object.entries(cost).some(([k, v]) => s.stores[k as Material] < v))
    return false;
  for (const [k, v] of Object.entries(cost)) s.stores[k as Material] -= v;
  return true;
}
export function tribeAllies(s: TribeState) {
  return s.neighbors.filter((n) => n.trust >= 2).length;
}
export function tribeContext(s: TribeState) {
  if (distance(s.player, TRIBE_HOME) < 78) return 'home';
  if (distance(s.player, TRIBE_COUNCIL) < 67) return 'council';
  const n = s.neighbors.find((n) => distance(n, s.player) < 80);
  if (n) return n.id;
  const bank = s.banks.find((b) => distance(b, s.player) < 60);
  if (bank && s.storm !== null) return `bank-${bank.id}`;
  return 'wild';
}
export function tribeBuilders(s: TribeState, bank: Vec) {
  return s.members.filter(
    (m) => m.role === 'escort' && !m.carrying && distance(m, bank) < 100,
  );
}
export function tribePrompt(s: TribeState) {
  const context = tribeContext(s),
    p = s.player;
  if (s.mode === 'won')
    return {
      label: '山谷已连通',
      hint: '工具、盟友和真实成员将继续走向文明。',
    };
  if (context === 'home')
    return p.carrying && p.load
      ? {
          label: `存放${p.load}份${MATERIAL_NAMES[p.carrying]}`,
          hint: '放入公共储备，供制作、交换与建设使用。',
        }
      : {
          label: '在工作台制作工具',
          hint: '从分工面板选择编篮或石锤，材料先放入储备。',
        };
  if (context === 'moss' || context === 'reed') {
    const n = s.neighbors.find((n) => n.id === context)!;
    return {
      label: n.met
        ? '与邻居交谈'
        : '拜访' + (context === 'moss' ? '苔石' : '芦湾'),
      hint:
        n.trust >= 2
          ? '已经结盟，建好营地后邻居会派人前来。'
          : n.met
            ? '从面板选择交换或帮忙，两种方式都能结盟。'
            : '按K了解邻居，再决定怎样合作。',
    };
  }
  if (context === 'council')
    return {
      label: !s.camp
        ? '建立共同营地'
        : s.storm === null
          ? '准备防洪协作'
          : s.banks.every((b) => b.work >= 6)
            ? '见证营地落成'
            : '前往河堤',
      hint: !s.camp
        ? s.organization === 'workshop'
          ? `需要编篮、石锤与${costLabel(WORKSHOP_CAMP_COST)}`
          : `需要一件工具、两处盟友和${costLabel(CAMP_COST)}`
        : tribeGoal(s),
    };
  if (context.startsWith('bank-')) {
    const b = s.banks.find((b) => `bank-${b.id}` === context)!;
    return {
      label:
        b.work >= 6
          ? '这道河堤已稳固'
          : b.paid
            ? '留在这里一起建造'
            : `给${b.id + 1}号河堤投入材料`,
      hint:
        b.work >= 6
          ? '继续下一处，全部完成后回圆环。'
          : b.paid
            ? `到位帮手${tribeBuilders(s, b).length} · ${s.tools.includes('hammer') ? '石锤已生效' : '徒手建造'} · 离开会暂停施工`
            : `${costLabel(BANK_COST)} · 材料从公共储备取用`,
    };
  }
  const patch = s.patches
    .filter((f) => distance(f, p) < 57)
    .sort(
      (a, b) =>
        Number(a.cooldown > 0) - Number(b.cooldown > 0) ||
        distance(a, p) - distance(b, p),
    )[0];
  if (patch)
    return {
      label: `采集${MATERIAL_NAMES[patch.kind]}`,
      hint:
        p.load >= tribeCapacity(s) || (p.carrying && p.carrying !== patch.kind)
          ? '先回工作台放下手里的物资。'
          : patch.cooldown > 0
            ? `${Math.ceil(patch.cooldown)}秒后恢复，附近还有其他材料。`
            : `携带${p.load}/${tribeCapacity(s)} · ${s.tools.includes('hammer') && ['wood', 'stone'].includes(patch.kind) ? '石锤每次可采3份' : '每次可采2份'}`,
    };
  return {
    label: p.load ? '把物资带回工作台' : '靠近材料或聚落',
    hint: p.load
      ? `携带${p.load}/${tribeCapacity(s)} · 工作台在山谷西侧。`
      : '果实、树枝、石料、纤维各有用途，靠近按K。',
  };
}
export function tribeGoal(s: TribeState) {
  if (s.freeLife && s.mode === 'running')
    return '继续采集、制作工具、交换与安排成员，随时回看营地里程碑。';
  if (s.mode === 'won')
    return s.organization === 'workshop'
      ? '工坊聚落落成：本族工具、成员和防洪经验将延续到文明。'
      : '共同营地落成：两处邻居、三道河堤和你们的工具经验将延续到下一章。';
  if (!s.tools.length)
    return '到工作台制作第一件工具：编篮多搬物资，石锤加快建设。';
  if (s.organization === 'workshop' && !tribeFoundationReady(s))
    return '回工作台分别制作编篮与石锤，建立本族的搬运与建设能力。';
  if (s.organization !== 'workshop' && tribeAllies(s) < 2)
    return '拜访苔石与芦湾。各交换两次，或帮忙一次，获得两位盟友。';
  if (!s.camp) return `到谷地圆环建立营地 · ${costLabel(tribeCampCost(s))}`;
  if (s.storm === null)
    return '备好 9 树枝和 6 石料，安排随行建造成员，在圆环开启防洪协作。';
  if (s.banks.some((b) => b.work < 6))
    return '到三处河堤按 K 投入材料，留在旁边建造；随行成员和石锤会加快进度。';
  return '河水已退，回到谷地圆环按 K，迎接共同营地落成。';
}
export function craftTribeTool(s: TribeState, tool: Tool) {
  if (
    s.mode !== 'running' ||
    tribeContext(s) !== 'home' ||
    !['basket', 'hammer'].includes(tool)
  )
    return false;
  if (s.tools.includes(tool)) {
    s.notice = '这件工具已经学会，不会重复消耗材料。';
    return false;
  }
  if (!pay(s, TOOL_COST[tool])) {
    s.notice = `制作${TOOL_NAMES[tool]}需要 ${costLabel(TOOL_COST[tool])}。`;
    return false;
  }
  s.tools.push(tool);
  learnFrom(s, `tribe:${tool}`);
  s.choices.push(`tool:${tool}`);
  s.notice =
    tool === 'basket'
      ? '枝条与纤维编成篮子！现在可带 6 份物资，采果成员每趟也带得更多。'
      : '石头绑上了木柄！采石、拾枝更快，河堤建设速度翻倍。';
  return true;
}
export function setTribeRole(s: TribeState, id: number, role: TribeRole) {
  if (s.mode !== 'running' || !Object.keys(TRIBE_ROLES).includes(role))
    return false;
  const m = s.members.find((m) => m.id === id);
  if (!m) return false;
  m.role = role;
  m.target = null;
  s.notice = `${m.newborn ? '长大的幼崽' : `成员 ${id + 1}`}回应你，开始${TRIBE_ROLES[role]}。手里的物资会先送回工作台。`;
  return true;
}
export function neighborAction(
  s: TribeState,
  id: 'moss' | 'reed',
  action: 'trade' | 'help',
) {
  if (s.mode !== 'running' || tribeContext(s) !== id || !s.tools.length)
    return false;
  const n = s.neighbors.find((n) => n.id === id);
  if (!n?.met || n.trust >= 2) return false;
  if (!['trade', 'help'].includes(action)) return false;
  const cost =
    action === 'trade'
      ? id === 'moss'
        ? { food: 4 }
        : { wood: 4 }
      : id === 'moss'
        ? { wood: 3, stone: 2 }
        : { wood: 4, fiber: 2 };
  if (!pay(s, cost)) {
    s.notice = `这次${action === 'trade' ? '交换' : '帮忙'}需要 ${costLabel(cost)}。`;
    return false;
  }
  if (action === 'trade') {
    s.stores[id === 'moss' ? 'stone' : 'fiber'] += 4;
    n.trades++;
    n.trust++;
  } else {
    n.helped = true;
    n.trust = 2;
  }
  s.choices.push(`${id}:${action}`);
  s.notice =
    n.trust >= 2
      ? `${id === 'moss' ? '苔石' : '芦湾'}愿意与你共同生活！营地建好后，他们会派建造者前来。`
      : '交换完成！对方认识了你，再合作一次就能结盟。';
  return true;
}
export function startTribeStorm(s: TribeState) {
  if (
    s.mode !== 'running' ||
    !s.camp ||
    s.storm !== null ||
    tribeContext(s) !== 'council'
  )
    return false;
  s.storm = 60;
  s.notice =
    '上游涨水了！三道河堤各需要 3 树枝、2 石料。带上成员，分头把家园连起来。';
  return true;
}
export function tribeInteract(s: TribeState) {
  if (s.mode !== 'running') return false;
  const p = s.player,
    context = tribeContext(s);
  if (context === 'home') {
    if (p.carrying && p.load) {
      s.stores[p.carrying] += p.load;
      s.notice = `放下 ${p.load} 份${MATERIAL_NAMES[p.carrying]}，大家可以一起使用。`;
      p.carrying = null;
      p.load = 0;
      return true;
    }
    s.notice = '在工作台选择制作编篮或石锤；材料必须先放入储备。';
    return false;
  }
  if (context === 'moss' || context === 'reed') {
    const n = s.neighbors.find((n) => n.id === context)!;
    n.met = true;
    s.notice =
      n.id === 'moss'
        ? '苔石擅长打磨石料。他们愿用 4 石料换 4 果实，也希望有人帮忙铺路。'
        : '芦湾擅长编织。他们愿用 4 纤维换 4 树枝，也希望有人修好屋顶。';
    return true;
  }
  if (context === 'council') {
    if (!tribeFoundationReady(s)) {
      s.notice =
        s.organization === 'workshop'
          ? '工坊聚落需要编篮与石锤，分别用于搬运和建设。'
          : '先学会工具，并和两处邻居结盟，才能建立共同营地。';
      return false;
    }
    if (!s.camp) {
      if (!pay(s, tribeCampCost(s))) {
        s.notice = `营地需要 ${costLabel(tribeCampCost(s))}。`;
        return false;
      }
      s.camp = true;
      if (s.organization === 'workshop') {
        s.choices.push('society:workshop');
        s.notice =
          '本族工坊建起来了。准备河堤材料，安排成员随行建造，完成真实防洪工程。';
        return true;
      }
      s.notice =
        '两处邻居的建造者出发了！先准备防洪材料，再在这里开启协作挑战。';
      return true;
    }
    if (!s.freeLife && s.storm !== null && s.banks.every((b) => b.work >= 6)) {
      if (
        s.neighbors.some(
          (n) => n.trust >= 2 && distance(n.builder, TRIBE_COUNCIL) > 100,
        )
      ) {
        s.notice = '邻居的建造者正在走来，等他们一起见证营地落成。';
        return false;
      }
      s.mode = 'won';
      s.notice =
        '三道河堤连起了家园。新的道路、工具和朋友，让这个山谷成为共同的营地。';
      return true;
    }
    s.notice = tribeGoal(s);
    return false;
  }
  if (context.startsWith('bank-')) {
    const b = s.banks.find((b) => `bank-${b.id}` === context)!;
    if (b.work >= 6) {
      s.notice = '这道河堤已经稳固，去下一处吧。';
      return false;
    }
    if (!b.paid) {
      if (!pay(s, BANK_COST)) {
        s.notice = `加固河堤需要 ${costLabel(BANK_COST)}，请先把材料送回工作台。`;
        return false;
      }
      b.paid = true;
    }
    s.notice = '材料已经铺下，留在河堤旁建造。随行成员靠近后会一起帮忙。';
    return true;
  }
  const patch = s.patches
    .filter((a) => a.cooldown === 0 && distance(a, p) < 57)
    .sort((a, b) => distance(a, p) - distance(b, p))[0];
  if (!patch) {
    s.notice = '靠近资源按 K；点击地图前往，到工作台放下物资。';
    return false;
  }
  if (p.load >= tribeCapacity(s) || (p.carrying && p.carrying !== patch.kind)) {
    s.notice = '先回工作台放下手里的物资，再继续采集。';
    return false;
  }
  const amount = Math.min(
    tribeCapacity(s) - p.load,
    s.tools.includes('hammer') && ['wood', 'stone'].includes(patch.kind)
      ? 3
      : 2,
  );
  p.carrying = patch.kind;
  p.load += amount;
  patch.cooldown = 9;
  s.notice = `采到 ${amount} ${MATERIAL_NAMES[patch.kind]} · 携带 ${p.load}/${tribeCapacity(s)}，回工作台按 K 存放。`;
  return true;
}
function move(
  p: Vec & { angle?: number },
  target: Vec,
  speed: number,
  dt: number,
) {
  const d = distance(p, target);
  if (d < 8) return;
  const angle = Math.atan2(target.y - p.y, target.x - p.x),
    amount = Math.min(d, speed * dt);
  p.x += Math.cos(angle) * amount;
  p.y += Math.sin(angle) * amount;
  p.angle = angle;
}
export function stepTribe(
  s: TribeState,
  input: { x: number; y: number; interact?: boolean },
  dt: number,
) {
  if (s.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  if (dt > 1 / 30) {
    let left = dt,
      first = true;
    while (left > 1e-8 && s.mode === 'running') {
      const slice = Math.min(left, 1 / 30);
      stepTribe(s, { ...input, interact: first && input.interact }, slice);
      left -= slice;
      first = false;
    }
    return;
  }
  s.time += dt;
  for (const p of s.patches) p.cooldown = Math.max(0, p.cooldown - dt);
  const mag = Math.hypot(input.x, input.y);
  if (mag > 0.01) {
    const speed =
      (s.form === 'strider' ? 205 : 185) * (1 + ((s.body.legs ?? 1) - 1) * 0.2);
    s.player.x = Math.max(
      24,
      Math.min(1176, s.player.x + (input.x / Math.max(1, mag)) * speed * dt),
    );
    s.player.y = Math.max(
      24,
      Math.min(776, s.player.y + (input.y / Math.max(1, mag)) * speed * dt),
    );
    s.player.angle = Math.atan2(input.y, input.x);
  }
  if (input.interact) tribeInteract(s);
  const reserved = new Set<number>();
  for (const m of s.members) {
    let target: Vec = TRIBE_HOME;
    if (!m.carrying && m.role === 'escort')
      target = {
        x: s.player.x + Math.cos(m.id * 2.4) * 38,
        y: s.player.y + Math.sin(m.id * 2.4) * 38,
      };
    else if (!m.carrying) {
      const p = s.patches
        .filter(
          (p) => p.kind === m.role && p.cooldown === 0 && !reserved.has(p.id),
        )
        .sort((a, b) => distance(a, m) - distance(b, m))[0];
      if (p) {
        target = p;
        m.target = p.id;
        reserved.add(p.id);
        if (distance(m, p) < 24) {
          p.cooldown = 9;
          m.carrying = p.kind;
          m.load = s.tools.includes(p.kind === 'food' ? 'basket' : 'hammer')
            ? 2
            : 1;
          m.target = null;
        }
      }
    }
    if (m.carrying && distance(m, TRIBE_HOME) < 45) {
      s.stores[m.carrying] += m.load;
      m.carrying = null;
      m.load = 0;
    }
    move(m, target, m.role === 'escort' ? 200 : 145, dt);
  }
  if (s.camp)
    for (const n of s.neighbors.filter((n) => n.trust >= 2))
      move(
        n.builder,
        {
          x: TRIBE_COUNCIL.x + (n.id === 'moss' ? -55 : 55),
          y: TRIBE_COUNCIL.y + 45,
        },
        90,
        dt,
      );
  if (s.storm !== null && s.banks.some((b) => b.work < 6)) {
    for (const b of s.banks)
      if (b.paid && b.work < 6 && distance(s.player, b) < 60) {
        const helpers = tribeBuilders(s, b).length;
        b.work = Math.min(
          6,
          b.work +
            dt *
              ((s.tools.includes('hammer') ? 2 : 1) + helpers * 0.8) *
              (learningBonus(s, 'masonry', 'tribe') ? 1.3 : 1),
        );
        if (b.work >= 6)
          s.notice = '一道河堤合拢了！洪水的压力减轻，继续连接另外的家园。';
      }
    const finished = s.banks.filter((b) => b.work >= 6).length;
    if (finished === 3) {
      s.storm = 0;
      s.notice = '三道河堤都稳住了！回到谷地圆环按 K，让共同营地正式落成。';
    } else {
      s.storm = Math.max(0, s.storm - dt);
      s.integrity = Math.max(0, s.integrity - dt * (1.6 - finished * 0.45));
      if (s.storm <= 0 || s.integrity <= 0) {
        s.mode = 'lost';
        s.notice =
          '涨水漫过了还没合拢的河堤。下次多备材料，带随行成员或石锤一起建造。';
      }
    }
  }
}
