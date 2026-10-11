import { inheritedDna } from './dna-evolution.ts';
import {
  inheritedLearning,
  learnFrom,
  learningBonus,
} from './lineage-learning.ts';
import type { TribeState } from './tribe.ts';
import { tribeFoundationReady } from './tribe.ts';
import type { Vec } from './simulation.ts';
import { distance } from './simulation.ts';
export type CityResource =
  | 'food'
  | 'wood'
  | 'stone'
  | 'fiber'
  | 'ore'
  | 'energy'
  | 'parts';
export type CityNodeId =
  | 'camp'
  | 'grove'
  | 'farm'
  | 'quarry'
  | 'power'
  | 'workshop'
  | 'relay'
  | 'port';
export type EnergyChoice = 'wind' | 'fuel';
export type CityRoute = {
  from: CityNodeId;
  to: CityNodeId;
  resource: CityResource;
  safe: boolean;
};
export type CityNode = Vec & {
  id: CityNodeId;
  built: boolean;
  stock: Record<CityResource, number>;
  clock: number;
};
export type CityCourier = Vec & {
  id: string;
  form: TribeState['form'];
  newborn: boolean;
  route: CityRoute | null;
  cargo: CityResource | null;
  load: number;
  destination: CityNodeId | null;
  path: Vec[];
  angle: number;
  blocked: boolean;
};
export type CivilizationState = Pick<
  TribeState,
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
  | 'choices'
> & {
  freeLife?: boolean;
  time: number;
  nodes: CityNode[];
  couriers: CityCourier[];
  energy: EnergyChoice | null;
  capacity: number;
  speed: number;
  crisis: number | null;
  bridgeFixed: boolean;
  notice: string;
  produced: number;
  delivered: number;
  launched: boolean;
};
export const CITY_MAP = { width: 1200, height: 800 };
export const CITY_NAMES: Record<CityNodeId, string> = {
  camp: '中央营地',
  grove: '木石采集地',
  farm: '梯田',
  quarry: '矿场',
  power: '能源站',
  workshop: '工坊',
  relay: '河桥维修站',
  port: '远航港',
};
export const CITY_RESOURCES: Record<CityResource, string> = {
  food: '食物',
  wood: '木材',
  stone: '石料',
  fiber: '纤维',
  ore: '矿石',
  energy: '能量',
  parts: '零件',
};
export const CITY_COST: Record<
  Exclude<CityNodeId, 'camp' | 'grove'>,
  Partial<Record<CityResource, number>>
> = {
  farm: { wood: 4, stone: 2 },
  quarry: { wood: 4, stone: 3 },
  power: { wood: 5, stone: 3 },
  workshop: { wood: 4, stone: 4 },
  relay: { wood: 4, stone: 3 },
  port: { wood: 8, parts: 6 },
};
export const BRIDGE_COST = { parts: 3, energy: 2 };
export const VOYAGE_COST = { food: 8, energy: 6, parts: 6 };
export const cityStock = (): Record<CityResource, number> => ({
  food: 0,
  wood: 0,
  stone: 0,
  fiber: 0,
  ore: 0,
  energy: 0,
  parts: 0,
});
export const cityNode = (s: CivilizationState, id: CityNodeId) =>
  s.nodes.find((n) => n.id === id)!;
export const cityCapacity = (s: CivilizationState) =>
  s.capacity + (learningBonus(s, 'weaving', 'city') ? 1 : 0);
export function cityCostLabel(cost: Partial<Record<CityResource, number>>) {
  return Object.entries(cost)
    .map(([r, n]) => `${n} ${CITY_RESOURCES[r as CityResource]}`)
    .join(' + ');
}
export function cityHas(
  stock: Record<CityResource, number>,
  cost: Partial<Record<CityResource, number>>,
) {
  return Object.entries(cost).every(([r, n]) => stock[r as CityResource] >= n);
}
function pay(
  stock: Record<CityResource, number>,
  cost: Partial<Record<CityResource, number>>,
) {
  if (!cityHas(stock, cost)) return false;
  for (const [r, n] of Object.entries(cost)) stock[r as CityResource] -= n;
  return true;
}
export function civilizationFromTribe(t: TribeState): CivilizationState | null {
  if (
    t.mode !== 'won' ||
    !t.camp ||
    t.banks.some((b) => b.work < 6) ||
    (t.organization === 'workshop'
      ? !tribeFoundationReady(t)
      : t.neighbors.some((n) => n.trust < 2))
  )
    return null;
  const positions: { id: CityNodeId; x: number; y: number }[] = [
    { id: 'camp', x: 190, y: 430 },
    { id: 'grove', x: 470, y: 160 },
    { id: 'farm', x: 200, y: 165 },
    { id: 'quarry', x: 955, y: 170 },
    { id: 'power', x: 965, y: 640 },
    { id: 'workshop', x: 500, y: 410 },
    { id: 'relay', x: 815, y: 410 },
    { id: 'port', x: 240, y: 695 },
  ];
  const nodes = positions.map((n) => ({
    ...n,
    built: n.id === 'camp' || n.id === 'grove',
    stock: cityStock(),
    clock: 0,
  }));
  Object.assign(nodes[0].stock, t.stores);
  const people = [
    {
      id: 'leader',
      form: t.form,
      newborn: true,
      carrying: t.player.carrying,
      load: t.player.load,
    },
    ...t.members.map((m) => ({
      id: `member-${m.id}`,
      form: m.form,
      newborn: m.newborn,
      carrying: m.carrying,
      load: m.load,
    })),
  ];
  return {
    ...(t.tidalLegacy ? { tidalLegacy: structuredClone(t.tidalLegacy) } : {}),
    form: t.form,
    body: structuredClone(t.body),
    ...(t.learning ? { learning: inheritedLearning(t) } : {}),
    ...(t.dnaLineage ? { dnaLineage: inheritedDna(t) } : {}),
    traits: [...t.traits],
    organ: t.organ,
    adaptation: t.adaptation,
    adaptations: [...(t.adaptations ?? (t.adaptation ? [t.adaptation] : []))],
    generation: t.generation,
    history: structuredClone(t.history),
    standalone: t.standalone,
    choices: [...t.choices],
    mode: 'ready',
    time: 0,
    nodes,
    couriers: people.map((p, i) => ({
      id: p.id,
      form: p.form,
      newborn: p.newborn,
      x: 160 + i * 25,
      y: 470,
      route: null,
      cargo: p.carrying,
      load: p.load,
      destination: p.carrying ? 'camp' : null,
      path: p.carrying ? [{ x: 190, y: 430 }] : [],
      angle: 0,
      blocked: false,
    })),
    energy: null,
    capacity:
      (t.tools.includes('basket') ? 3 : 2) +
      (t.neighbors.find((n) => n.id === 'reed')!.trades >= 2 ? 1 : 0),
    speed: t.neighbors.find((n) => n.id === 'moss')!.helped ? 160 : 140,
    crisis: null,
    bridgeFixed: false,
    notice: `${t.members.length} 名成员与你组成运输队。工具和结盟经验延续：编篮或芦湾交换增加载量，苔石铺路提升车速。`,
    produced: 0,
    delivered: 0,
    launched: false,
  };
}
export function buildCityNode(
  s: CivilizationState,
  id: CityNodeId,
  energy?: EnergyChoice,
) {
  if (
    s.mode !== 'running' ||
    id === 'camp' ||
    id === 'grove' ||
    !Object.hasOwn(CITY_COST, id)
  )
    return false;
  const n = cityNode(s, id);
  if (n.built) return false;
  if (id === 'power' && !['wind', 'fuel'].includes(energy ?? '')) {
    s.notice = '先选择风能或燃料，两种能源有不同的供给需求。';
    return false;
  }
  if (!pay(cityNode(s, 'camp').stock, CITY_COST[id])) {
    s.notice = `建设${CITY_NAMES[id]}需要中央营地储备 ${cityCostLabel(CITY_COST[id])}。`;
    return false;
  }
  n.built = true;
  if (id === 'power') {
    s.energy = energy!;
    s.choices.push(`energy:${energy}`);
  }
  s.notice = `${CITY_NAMES[id]}建好了。物资留在生产地，需要运输队送往使用它的设施。`;
  return true;
}
const crosses = (from: Vec, to: Vec) => from.x < 710 !== to.x < 710;
function travelPath(s: CivilizationState, p: CityCourier, to: CityNodeId) {
  const target = cityNode(s, to),
    safe = p.route?.safe;
  p.destination = to;
  p.blocked = false;
  p.path =
    safe && crosses(p, target)
      ? [
          { x: p.x < 710 ? 660 : 760, y: 70 },
          { x: p.x < 710 ? 760 : 660, y: 70 },
          { x: target.x, y: target.y },
        ]
      : [{ x: target.x, y: target.y }];
}
export function assignCityRoute(
  s: CivilizationState,
  id: string,
  route: CityRoute | null,
) {
  if (!['running', 'paused'].includes(s.mode)) return false;
  const p = s.couriers.find((c) => c.id === id);
  if (!p) return false;
  if (
    route &&
    (!cityNode(s, route.from)?.built ||
      !cityNode(s, route.to)?.built ||
      route.from === route.to ||
      !Object.hasOwn(CITY_RESOURCES, route.resource))
  )
    return false;
  p.route = route ? { ...route } : null;
  // A reassigned courier still delivers the cargo already removed from its source.
  if (p.cargo && p.destination) travelPath(s, p, p.destination);
  else if (route) travelPath(s, p, route.from);
  else {
    p.path = [];
    p.destination = null;
    p.blocked = false;
  }
  s.notice = p.cargo
    ? '新任务已记下，先把车上物资送到原目的地。'
    : route
      ? `运输任务：${CITY_NAMES[route.from]} → ${CITY_NAMES[route.to]}，运送${CITY_RESOURCES[route.resource]}。`
      : '运输队停下待命。';
  return true;
}
export function organizeCityProduction(s: CivilizationState) {
  if (
    !['running', 'paused'].includes(s.mode) ||
    ['farm', 'quarry', 'power', 'workshop'].some(
      (id) => !cityNode(s, id as CityNodeId).built,
    )
  )
    return false;
  const routes: CityRoute[] = [
    { from: 'quarry', to: 'workshop', resource: 'ore', safe: false },
    { from: 'power', to: 'workshop', resource: 'energy', safe: false },
    { from: 'workshop', to: 'camp', resource: 'parts', safe: false },
    {
      from: 'farm',
      to: s.energy === 'fuel' ? 'power' : 'camp',
      resource: 'food',
      safe: false,
    },
  ];
  s.couriers.forEach((c, i) =>
    assignCityRoute(s, c.id, routes[i % routes.length]),
  );
  s.notice =
    '基础分工已安排：矿石与能量入厂，零件回营，食物运往需要它的地方。少于四队时需要轮换路线。';
  return true;
}
export function cityRecipe(s: CivilizationState, id: CityNodeId) {
  if (id === 'grove')
    return '每 3 秒可采集 2 木材、1 石料，运回营地就能补充建材';
  if (id === 'farm') return '每 2 秒生产 2 食物';
  if (id === 'quarry') return '每 2.5 秒生产 2 矿石';
  if (id === 'power')
    return s.energy === 'fuel'
      ? '每 3 秒：1 食物 → 3 能量'
      : '每 3 秒生产 2 能量；暴雨期间速度降至四分之一';
  if (id === 'workshop') return '每 3 秒：2 矿石 + 1 能量 → 1 零件';
  if (id === 'relay')
    return `断桥维修需送到这里：${cityCostLabel(BRIDGE_COST)}`;
  if (id === 'port') return `远航物资需送到这里：${cityCostLabel(VOYAGE_COST)}`;
  return '新设施的建材从这里扣除。把工坊零件送回来，才能建远航港。';
}
export function cityGoal(s: CivilizationState) {
  if (s.freeLife && s.mode === 'running')
    return '山谷继续运转：调整运输、生产和补给；准备好后再次打开远航入口。';
  if (s.mode === 'won')
    return '远航器已启程。带着真实谱系、工具、结盟与能源选择进入星海。';
  const missing = (['farm', 'quarry', 'power', 'workshop'] as const).filter(
    (id) => !cityNode(s, id).built,
  );
  if (missing.length)
    return `先建设${missing.map((id) => CITY_NAMES[id]).join('、')}，建立生产链。`;
  if (!cityNode(s, 'port').built)
    return '把矿石与能量运到工坊，再把 6 零件运回中央营地，建设远航港。';
  if (!cityNode(s, 'relay').built)
    return '建设河桥维修站，为供给危机准备一条备用路线。';
  if (s.crisis === null)
    return '备好运输路线，在远航港开启试航准备。暴雨会封住直达路，风能输出也会降低。';
  if (!s.bridgeFixed)
    return '将 3 零件和 2 能量送到河桥维修站；跨河运输改走高地，再修复断桥。';
  return '将 8 食物、6 能量、6 零件送到远航港，开启第一次远航。';
}
export function startCityCrisis(s: CivilizationState) {
  if (
    s.mode !== 'running' ||
    s.crisis !== null ||
    !cityNode(s, 'port').built ||
    !cityNode(s, 'relay').built
  )
    return false;
  s.crisis = 120;
  s.notice =
    '暴雨封住了跨河直达路！把跨河车辆改为高地绕行，运送维修零件与能量。';
  return true;
}
export function repairCityBridge(s: CivilizationState) {
  if (s.mode !== 'running' || s.crisis === null || s.bridgeFixed) return false;
  if (!pay(cityNode(s, 'relay').stock, BRIDGE_COST)) {
    s.notice = '维修材料必须由运输队送到河桥维修站，其他地方的储备不能代替。';
    return false;
  }
  s.bridgeFixed = true;
  s.crisis = 0;
  s.notice = '最后一段桥面接上了！直达路恢复通行，运输队可以为远航港集中物资。';
  return true;
}
export function launchCityVoyage(s: CivilizationState) {
  if (
    s.mode !== 'running' ||
    !s.bridgeFixed ||
    !cityNode(s, 'port').built ||
    s.launched
  )
    return false;
  if (!pay(cityNode(s, 'port').stock, VOYAGE_COST)) {
    s.notice = '先把远航物资送到港口。车上尚未交付的物资还不能装船。';
    return false;
  }
  s.launched = true;
  s.mode = 'won';
  s.notice =
    '运输队把最后一箱物资送上远航器。山谷的灯光连成一片，你们终于能够出发。';
  return true;
}
export type CityEvent = {
  at: number;
  node: CityNodeId;
  text: string;
  kind: 'produce' | 'deliver';
};
export function cityProduction(s: CivilizationState, id: CityNodeId) {
  const n = cityNode(s, id);
  if (!n.built) return null;
  let duration = 3;
  let inputs: Partial<Record<CityResource, number>> = {};
  let outputs: Partial<Record<CityResource, number>> = {};
  if (id === 'grove') outputs = { wood: 2, stone: 1 };
  else if (id === 'farm') {
    duration = 2;
    outputs = { food: 2 };
  } else if (id === 'quarry') {
    duration = 2.5;
    outputs = { ore: 2 };
  } else if (id === 'power') {
    if (s.energy === 'fuel') {
      inputs = { food: 1 };
      outputs = { energy: 3 };
    } else outputs = { energy: 2 };
  } else if (id === 'workshop') {
    inputs = { ore: 2, energy: 1 };
    outputs = { parts: 1 };
  } else return null;
  const speed =
    id === 'power' && s.energy === 'wind' && s.crisis !== null && !s.bridgeFixed
      ? 0.25
      : 1;
  const missing = Object.entries(inputs)
    .filter(([r, amount]) => n.stock[r as CityResource] < amount)
    .map(
      ([r, amount]) =>
        `${amount - n.stock[r as CityResource]} ${CITY_RESOURCES[r as CityResource]}`,
    );
  return {
    duration,
    speed,
    inputs,
    outputs,
    missing,
    progress: Math.min(1, n.clock / duration),
    label: missing.length
      ? `缺少 ${missing.join('、')}`
      : `${speed < 1 ? '风力减弱 · ' : ''}${Math.max(0, (duration - n.clock) / speed).toFixed(1)}秒后产出`,
  };
}
export function stepCivilization(
  s: CivilizationState,
  dt: number,
  onEvent?: (event: CityEvent) => void,
) {
  if (s.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  if (dt > 1 / 30) {
    let left = dt;
    while (left > 1e-8 && s.mode === 'running') {
      const slice = Math.min(left, 1 / 30);
      stepCivilization(s, slice, onEvent);
      left -= slice;
    }
    return;
  }
  s.time += dt;
  const crisis = s.crisis !== null && !s.bridgeFixed;
  for (const n of s.nodes) {
    const recipe = cityProduction(s, n.id);
    if (!recipe) continue;
    n.clock = Math.min(recipe.duration, n.clock + dt * recipe.speed);
    if (n.clock < recipe.duration - 1e-8 || !pay(n.stock, recipe.inputs))
      continue;
    for (const [r, amount] of Object.entries(recipe.outputs))
      n.stock[r as CityResource] += amount;
    if (n.id === 'workshop') s.produced++;
    n.clock = 0;
    onEvent?.({
      at: s.time,
      node: n.id,
      text: `产出 ${cityCostLabel(recipe.outputs)}`,
      kind: 'produce',
    });
  }
  for (const p of s.couriers) {
    const to = p.destination ? cityNode(s, p.destination) : null;
    p.blocked = !!(
      crisis &&
      !p.route?.safe &&
      to &&
      crosses(p, to) &&
      p.y > 100
    );
    if (p.blocked) continue;
    if (p.path.length) {
      const next = p.path[0],
        d = distance(p, next),
        amount = Math.min(
          d,
          s.speed * dt * (learningBonus(s, 'logistics', 'city') ? 1.2 : 1),
        );
      if (d > 0) {
        p.angle = Math.atan2(next.y - p.y, next.x - p.x);
        p.x += Math.cos(p.angle) * amount;
        p.y += Math.sin(p.angle) * amount;
      }
      if (d < 6) p.path.shift();
    }
    if (p.path.length) continue;
    if (p.destination && distance(p, cityNode(s, p.destination)) > 10) {
      travelPath(s, p, p.destination);
      continue;
    }
    if (p.cargo && p.destination) {
      cityNode(s, p.destination).stock[p.cargo] += p.load;
      s.delivered += p.load;
      learnFrom(s, 'city:delivery');
      onEvent?.({
        at: s.time,
        node: p.destination,
        text: `送达 ${p.load} ${CITY_RESOURCES[p.cargo]}`,
        kind: 'deliver',
      });
      p.cargo = null;
      p.load = 0;
    }
    const r = p.route;
    if (!r) {
      p.destination = null;
      continue;
    }
    if (distance(p, cityNode(s, r.from)) > 10) {
      travelPath(s, p, r.from);
      continue;
    }
    const stock = cityNode(s, r.from).stock,
      load = Math.min(cityCapacity(s), stock[r.resource]);
    if (load > 0) {
      stock[r.resource] -= load;
      p.cargo = r.resource;
      p.load = load;
      travelPath(s, p, r.to);
    }
  }
  if (crisis) {
    s.crisis = Math.max(0, s.crisis! - dt);
    if (s.crisis <= 0) {
      s.mode = 'lost';
      s.notice =
        '断桥让供给中断太久。下次先准备维修物资，再给跨河车辆安排高地路线。';
    }
  }
}
