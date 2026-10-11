import { inheritedDna } from './dna-evolution.ts';
import {
  inheritedLearning,
  learnFrom,
  learningBonus,
} from './lineage-learning.ts';
import type { CivilizationState } from './civilization.ts';
import { VOYAGE_COST } from './civilization.ts';
import type { Vec, TraitId } from './simulation.ts';
export type StarId = 'home' | 'beacon' | 'tide' | 'ember' | 'echo';
export type Survey = 'water' | 'air';
export type Habitat = 'wetland' | 'dome';
export type SpaceUpgrade = 'sail' | 'shield';
export type Ecology = { water: number; light: number; heat: number };
export type SpaceState = Pick<
  CivilizationState,
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
  crew: { id: string; form: CivilizationState['form']; newborn: boolean }[];
  location: StarId;
  fuel: number;
  food: number;
  parts: number;
  upgrade: SpaceUpgrade | null;
  flight: {
    from: StarId;
    to: StarId;
    elapsed: number;
    duration: number;
  } | null;
  activity: { kind: Survey | 'charge' | 'supply'; remaining: number } | null;
  surveys: { tide: Survey[]; ember: Survey[] };
  visited: StarId[];
  relic: boolean;
  outpost: {
    planet: 'tide' | 'ember';
    habitat: Habitat;
    settings: Ecology;
    trial: number | null;
    growth: number;
    stability: number;
    foodClock: number;
  } | null;
  notice: string;
};
export const STARS: Record<
  StarId,
  Vec & { name: string; description: string; color: string; radius: number }
> = {
  home: {
    x: 145,
    y: 485,
    name: '母星',
    description: '旅程的起点。港口可充能与补充食物。',
    color: '#99bda0',
    radius: 40,
  },
  beacon: {
    x: 360,
    y: 295,
    name: '灯塔站',
    description: '中途补给站。观察两个世界，再决定前往哪里。',
    color: '#d9cdb4',
    radius: 18,
  },
  tide: {
    x: 650,
    y: 170,
    name: '青潮星',
    description: '海湾与湿润气流，较温和的恒星活动。',
    color: '#78b8bb',
    radius: 52,
  },
  ember: {
    x: 885,
    y: 560,
    name: '熔光星',
    description: '温暖岩层与强烈耀斑，穹顶能提高耐受。',
    color: '#d29c70',
    radius: 47,
  },
  echo: {
    x: 1060,
    y: 285,
    name: '回声遗迹',
    description: '一段来自远方的信号，可以记录一项额外发现。',
    color: '#bba8d1',
    radius: 27,
  },
};
export const ECOLOGY_TARGETS: Record<'tide' | 'ember', Ecology> = {
  tide: { water: 2, light: 1, heat: 1 },
  ember: { water: 1, light: 2, heat: 2 },
};
export const ECOLOGY_NAMES: Record<keyof Ecology, string> = {
  water: '水分',
  light: '光照',
  heat: '温度',
};
export function spaceFromCivilization(c: CivilizationState): SpaceState | null {
  if (c.mode !== 'won' || !c.launched || !c.bridgeFixed) return null;
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
    choices: [...c.choices],
    mode: 'ready',
    time: 0,
    crew: c.couriers.map((p) => ({
      id: p.id,
      form: p.form,
      newborn: p.newborn,
    })),
    location: 'home',
    fuel: VOYAGE_COST.energy,
    food: VOYAGE_COST.food,
    parts: VOYAGE_COST.parts,
    upgrade: null,
    flight: null,
    activity: null,
    surveys: { tide: [], ember: [] },
    visited: ['home'],
    relic: false,
    outpost: null,
    notice:
      '港口已装载的 6 能量、8 食物和 6 零件进入远航器。仍留在城市的储备保存在上一章。',
  };
}
export function travelCost(s: SpaceState, to: StarId) {
  return Math.max(
    1,
    Math.ceil(
      Math.hypot(
        STARS[s.location].x - STARS[to].x,
        STARS[s.location].y - STARS[to].y,
      ) / 300,
    ) -
      (s.upgrade === 'sail' ? 1 : 0) -
      (learningBonus(s, 'navigator', 'space') ? 1 : 0),
  );
}
export function canSpaceAct(s: SpaceState) {
  return (
    s.mode === 'running' &&
    !s.flight &&
    !s.activity &&
    (s.outpost?.trial == null || (s.freeLife === true && s.outpost.trial >= 30))
  );
}
export function travelSpace(s: SpaceState, to: StarId) {
  if (
    !canSpaceAct(s) ||
    !Object.hasOwn(STARS, to) ||
    to === s.location ||
    (s.outpost && !s.freeLife)
  )
    return false;
  const fuel = travelCost(s, to);
  if (s.fuel < fuel || s.food < 1) {
    s.notice =
      '航行需要足够能量和 1 食物。在母星或灯塔站可补给，其他轨道可用食物展开太阳帆充能。';
    return false;
  }
  s.fuel -= fuel;
  s.food--;
  s.flight = { from: s.location, to, elapsed: 0, duration: 3 + fuel * 1.5 };
  s.notice = `航向${STARS[to].name}。燃料已经装入推进器，船员与生命样本正在同行。`;
  return true;
}
export function spaceActivity(
  s: SpaceState,
  kind: Survey | 'charge' | 'supply',
) {
  if (!canSpaceAct(s) || (s.outpost && !s.freeLife)) return false;
  if (kind === 'water' || kind === 'air') {
    if (!['tide', 'ember'].includes(s.location)) return false;
    const list = s.surveys[s.location as 'tide' | 'ember'];
    if (list.includes(kind)) return false;
    s.activity = {
      kind,
      remaining: learningBonus(s, 'survey', 'space') ? 3.5 : 5,
    };
    s.notice =
      kind === 'water'
        ? '探针正在寻找可用水分与基质。'
        : '正在测量光照、温度与恒星活动。';
    return true;
  }
  if (!['charge', 'supply'].includes(kind)) return false;
  const station = s.location === 'home' || s.location === 'beacon';
  if (kind === 'supply' && !station) return false;
  if (kind === 'charge' && !station) {
    if (s.food < 1) {
      s.notice = '缺少维持船员工作的食物。可从本章起点重试，重新规划补给。';
      return false;
    }
    s.food--;
  }
  s.activity = { kind, remaining: 4 };
  s.notice =
    kind === 'charge'
      ? '太阳帆正在展开，等待能量汇入。'
      : '补给舱正在对接，食物将进入船舱。';
  return true;
}
export function upgradeSpace(s: SpaceState, upgrade: SpaceUpgrade) {
  if (
    !canSpaceAct(s) ||
    s.upgrade ||
    !['sail', 'shield'].includes(upgrade) ||
    s.parts < 2
  )
    return false;
  s.parts -= 2;
  s.upgrade = upgrade;
  s.choices.push(`space:${upgrade}`);
  s.notice =
    upgrade === 'sail'
      ? '太阳帆展开！长途航行少耗 1 能量，充能量也增加。'
      : '生态屏障就位，耀斑造成的温度扰动减轻。';
  return true;
}
export function recordSpaceRelic(s: SpaceState) {
  if (!canSpaceAct(s) || s.location !== 'echo' || s.relic) return false;
  s.relic = true;
  s.choices.push('discovery:echo');
  s.notice =
    '你记录了遗迹中的回声。它没有给出唯一答案，却让这次旅程多了一项发现。';
  return true;
}
export function buildOutpost(s: SpaceState, habitat: Habitat) {
  if (
    !canSpaceAct(s) ||
    s.outpost ||
    !['tide', 'ember'].includes(s.location) ||
    !['wetland', 'dome'].includes(habitat)
  )
    return false;
  const planet = s.location as 'tide' | 'ember';
  if (s.surveys[planet].length !== 2) {
    s.notice = '先完成水分与气候两项扫描，再决定如何安放生命样本。';
    return false;
  }
  if (s.parts < 4 || s.food < 5) {
    s.notice =
      '前哨需要 4 零件和 2 食物，还需留下 3 食物供生态观察。先到补给站准备。';
    return false;
  }
  s.parts -= 4;
  s.food -= 2;
  s.outpost = {
    planet,
    habitat,
    settings: { water: 1, light: 1, heat: 1 },
    trial: null,
    growth: 0,
    stability: 100,
    foodClock: 0,
  };
  s.choices.push(`planet:${planet}`, `habitat:${habitat}`);
  s.notice =
    habitat === 'wetland'
      ? '浅水与基质连起了一片湿地。它更能容忍水分差异，但需要留意温度。'
      : '穹顶覆盖了生命舱。它更能容忍温度变化，仍需匹配水分和光照。';
  return true;
}
export function setEcology(s: SpaceState, key: keyof Ecology, value: number) {
  if (
    !['running', 'paused'].includes(s.mode) ||
    !s.outpost ||
    !Object.hasOwn(ECOLOGY_NAMES, key) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 3
  )
    return false;
  s.outpost.settings[key] = value;
  return true;
}
export function flareStrength(s: SpaceState) {
  const o = s.outpost;
  if (!o || o.trial === null || o.trial < 10 || o.trial >= 20) return 0;
  return Math.max(
    0,
    (o.planet === 'ember' ? 2 : 1) - (s.upgrade === 'shield' ? 1 : 0),
  );
}
export function ecologyReadings(s: SpaceState) {
  const o = s.outpost;
  if (!o) return [];
  const targets = ECOLOGY_TARGETS[o.planet];
  return (['water', 'light', 'heat'] as const).map((key) => {
    const tolerance =
      (key === 'water' && o.habitat === 'wetland') ||
      (key === 'heat' && o.habitat === 'dome')
        ? 1
        : 0;
    const actual = o.settings[key] + (key === 'heat' ? flareStrength(s) : 0);
    const difference = actual - targets[key];
    return {
      key,
      setting: o.settings[key],
      actual,
      target: targets[key],
      tolerance,
      offset:
        Math.sign(difference) * Math.max(0, Math.abs(difference) - tolerance),
    };
  });
}
function ecologyOffsets(s: SpaceState): Ecology {
  const offsets = { water: 0, light: 0, heat: 0 };
  for (const r of ecologyReadings(s)) offsets[r.key] = r.offset;
  return offsets;
}
export function ecologyError(s: SpaceState) {
  return Object.values(ecologyOffsets(s)).reduce(
    (sum, value) => sum + Math.abs(value),
    0,
  );
}
export function ecologyFeedback(s: SpaceState) {
  const offsets = ecologyOffsets(s);
  const changes = (['water', 'light', 'heat'] as const)
    .filter((key) => offsets[key] !== 0)
    .map((key) => `${offsets[key] > 0 ? '降低' : '提高'}${ECOLOGY_NAMES[key]}`);
  if (changes.length)
    return {
      label: '环境尚未匹配 · 查看调节建议',
      hint: `${changes.join('、')}，让环境回到前哨可承受的范围；观察生长和稳定度。`,
    };
  if (
    flareStrength(s) > 0 &&
    s.outpost?.habitat === 'dome' &&
    s.outpost.settings.heat + flareStrength(s) !==
      ECOLOGY_TARGETS[s.outpost.planet].heat
  )
    return {
      label: '穹顶正在缓冲耀斑温差',
      hint: '耀斑温差仍在穹顶耐受范围内，保持当前设定，继续观察。',
    };
  if (flareStrength(s) > 0)
    return {
      label: '耀斑温差已抵消 · 环境匹配',
      hint: '当前设定已抵消耀斑温差，继续观察；耀斑退去后重新检查温度。',
    };
  return {
    label: '环境匹配 · 生命正在生长',
    hint: '水分、光照与温度都在适应范围内，保持当前设定，继续观察。',
  };
}
export function startOutpostTrial(s: SpaceState) {
  if (!canSpaceAct(s) || !s.outpost || s.food < 3) return false;
  s.outpost.trial = 0;
  s.notice =
    '生命样本进入前哨。观察 30 秒生长：第 10 秒出现耀斑，第 20 秒退去，可随时暂停调整。';
  return true;
}
export function spaceGoal(s: SpaceState) {
  if (s.freeLife && s.mode === 'running')
    return s.flight
      ? `继续远征 · 前往${STARS[s.flight.to].name}`
      : '前哨已经留下，继续补给、扫描、拜访星系；随时回看这条生命的旅程。';
  if (s.mode === 'won')
    return '第一个外星生态前哨已经稳定。回看旅程，或保留记录开启另一条生命路线。';
  if (s.flight) return `正在前往${STARS[s.flight.to].name}`;
  if (s.activity) return '探针或补给舱正在工作。';
  if (s.outpost) {
    if (s.outpost.trial === null)
      return '按扫描结果调节水分、光照与温度，备好 3 食物，开始生态观察。';
    return ecologyFeedback(s).hint;
  }
  if (['tide', 'ember'].includes(s.location))
    return '完成水分和气候扫描，选择湿地或穹顶前哨。';
  return '选择青潮星或熔光星，扫描条件后建立生态前哨。灯塔站可以补给，遗迹提供额外发现。';
}
export function spaceCompletionNotice(s: SpaceState) {
  if (!s.outpost) return '';
  return `${STARS[s.outpost.planet].name}上的第一座生态前哨稳定下来。${completeJourney(s) ? '最初的微小生命' : '这个族群'}，如今拥有了一处遥远的新家。`;
}
export function stepSpace(s: SpaceState, dt: number) {
  if (s.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  if (dt > 1 / 30) {
    let left = dt;
    while (left > 1e-8 && s.mode === 'running') {
      const slice = Math.min(left, 1 / 30);
      stepSpace(s, slice);
      left -= slice;
    }
    return;
  }
  s.time += dt;
  if (
    s.food <= 0 &&
    !s.outpost &&
    !['home', 'beacon'].includes(s.location) &&
    !s.flight
  ) {
    s.mode = 'lost';
    s.notice =
      '食物耗尽，远航器发出了救援信号。从本章起点重试，沿途在灯塔站补给。';
    return;
  }
  if (s.flight) {
    s.flight.elapsed = Math.min(s.flight.duration, s.flight.elapsed + dt);
    if (s.flight.elapsed >= s.flight.duration - 1e-8) {
      s.location = s.flight.to;
      if (s.location === 'beacon') learnFrom(s, 'space:beacon');
      if (!s.visited.includes(s.location)) s.visited.push(s.location);
      s.flight = null;
      s.notice = `抵达${STARS[s.location].name}。${STARS[s.location].description}`;
    }
    return;
  }
  if (s.activity) {
    s.activity.remaining = Math.max(0, s.activity.remaining - dt);
    if (s.activity.remaining <= 1e-8) {
      const kind = s.activity.kind;
      if (kind === 'charge')
        s.fuel = Math.min(10, s.fuel + (s.upgrade === 'sail' ? 6 : 4));
      else if (kind === 'supply') s.food = Math.min(12, s.food + 6);
      else if (s.location === 'tide' || s.location === 'ember') {
        if (!s.surveys[s.location].includes(kind))
          s.surveys[s.location].push(kind);
        if (s.surveys[s.location].length === 2) learnFrom(s, 'space:survey');
      }
      s.activity = null;
      s.notice =
        kind === 'water' || kind === 'air'
          ? '扫描完成。环境读数已经记录，可以据此选择前哨。'
          : '补给已经抵达船舱。';
    }
    return;
  }
  const o = s.outpost;
  if (o && o.trial !== null && !(s.freeLife && o.trial >= 30)) {
    const error = ecologyError(s);
    o.growth = Math.min(100, o.growth + dt * (error === 0 ? 5 : 0.5));
    o.stability = Math.max(
      0,
      Math.min(100, o.stability + dt * (error === 0 ? 0.2 : -error * 3)),
    );
    o.foodClock += dt;
    if (o.foodClock >= 10 - 1e-8) {
      o.foodClock = Math.max(0, o.foodClock - 10);
      if (s.food > 0) s.food--;
      else o.stability = Math.max(0, o.stability - 20);
    }
    o.trial = Math.min(30, o.trial + dt);
    if (o.stability <= 0) {
      s.mode = 'lost';
      s.notice =
        '环境变化超过了前哨的承受范围。重新检查扫描读数，或换一种栖息地与屏障组合。';
    } else if (o.trial >= 30 - 1e-8) {
      o.trial = 30;
      if (o.growth >= 100 && o.stability >= 45) {
        s.mode = 'won';
        s.notice = spaceCompletionNotice(s);
      } else {
        s.mode = 'lost';
        s.notice =
          '前哨还没有形成稳定的生长循环。按扫描读数调整环境，并在耀斑出现时降低加热。';
      }
    }
  }
}
export type ExpeditionRecord = {
  learning?: SpaceState['learning'];
  dnaLineage?: SpaceState['dnaLineage'];
  adaptations?: SpaceState['adaptations'];
  tidalLegacy?: SpaceState['tidalLegacy'];
  organ?: SpaceState['organ'];
  adaptation?: SpaceState['adaptation'];
  id: number;
  planet: 'tide' | 'ember';
  habitat: Habitat;
  history: SpaceState['history'];
  choices: string[];
  form: SpaceState['form'];
  body: SpaceState['body'];
  traits: TraitId[];
  generation: number;
  standalone: boolean;
  crew: number;
  stability: number;
};
export function expeditionRecord(
  s: SpaceState,
  id: number,
): ExpeditionRecord | null {
  if (s.mode !== 'won' || !s.outpost) return null;
  return {
    id,
    ...(s.tidalLegacy ? { tidalLegacy: structuredClone(s.tidalLegacy) } : {}),
    organ: s.organ,
    adaptation: s.adaptation,
    adaptations: [...(s.adaptations ?? (s.adaptation ? [s.adaptation] : []))],
    planet: s.outpost.planet,
    habitat: s.outpost.habitat,
    history: structuredClone(s.history),
    choices: [...s.choices],
    form: s.form,
    body: structuredClone(s.body),
    ...(s.learning ? { learning: inheritedLearning(s) } : {}),
    ...(s.dnaLineage ? { dnaLineage: inheritedDna(s) } : {}),
    traits: [...s.traits],
    generation: s.generation,
    standalone: s.standalone,
    crew: s.crew.length,
    stability: s.outpost.stability,
  };
}
export function completeJourney(s: Pick<SpaceState, 'history' | 'standalone'>) {
  return (
    !s.standalone &&
    ['pond', 'ocean', 'shore', 'land'].every((h) =>
      s.history.some((a) => a.habitat === h),
    )
  );
}
