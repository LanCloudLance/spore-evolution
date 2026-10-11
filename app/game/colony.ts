import { landSpecies, type LandFeature } from './land-catalog.ts';
import type { DnaSource } from './dna-evolution.ts';
import { inheritedDna } from './dna-evolution.ts';
import {
  inheritedLearning,
  learnFrom,
  learningBonus,
} from './lineage-learning.ts';
import { adaptationsOf } from './life-adaptations.ts';
import { rememberGeneration } from './lineage.ts';
import type { World, Vec, Ancestor, TraitId } from './simulation.ts';
import { distance } from './simulation.ts';
import type { BodyForm } from './forms.ts';
import type { BodyDesign } from './body-design.ts';
import { droughtLegacy } from './land-drought.ts';
import { landSettlementWays } from './land.ts';
export type ColonyRole = 'food' | 'wood' | 'guard';
export type ColonyMember = Vec & {
  id: number;
  body?: BodyDesign;
  features?: LandFeature[];
  source?: DnaSource;
  form: BodyForm;
  angle: number;
  role: ColonyRole;
  carrying: ColonyRole | null;
  target: number | null;
  newborn: boolean;
};
export type ColonyState = {
  archiveId?: number;
  features?: LandFeature[];
  learning?: import('./lineage-learning.ts').LearningState;
  dnaLineage?: import('./dna-evolution.ts').DnaLineage;
  adaptations?: import('./life-adaptations.ts').Adaptation[];
  freeLife?: boolean;
  tidalLegacy?: World['tidalLegacy'];
  seedLegacy?: 'eaten' | 'grown';
  form: BodyForm;
  body: BodyDesign;
  traits: TraitId[];
  organ: 'crest' | 'plates' | undefined;
  adaptation?: 'reservoir' | 'skin';
  generation: number;
  history: Ancestor[];
  standalone: boolean;
  mode: 'ready' | 'running' | 'paused' | 'won' | 'lost';
  time: number;
  player: Vec & { angle: number; carrying: ColonyRole | null; load: number };
  members: ColonyMember[];
  patches: (Vec & { id: number; kind: 'wood' | 'food'; cooldown: number })[];
  food: number;
  wood: number;
  shelter: boolean;
  integrity: number;
  growth: number;
  feedCooldown: number;
  repairCooldown: number;
  storm: number | null;
  weatherClock: number;
  notice: string;
  delivered: number;
};
export const COLONY_MAP = { width: 1120, height: 760 };
export const COLONY_NEST = { x: 570, y: 410 };
export const ROLE_NAMES: Record<ColonyRole, string> = {
  food: '采果',
  wood: '拾枝',
  guard: '守巢',
};
export function createColonyWorld(): ColonyState {
  const patches: ColonyState['patches'] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    patches.push({
      id: i,
      x: 570 + Math.cos(a) * (i % 2 ? 370 : 290),
      y: 390 + Math.sin(a) * 250,
      kind: i % 2 ? 'wood' : 'food',
      cooldown: 0,
    });
  }
  return {
    form: 'strider',
    body: { length: 1, width: 1, organs: {} },
    traits: [],
    organ: undefined,
    generation: 1,
    history: [],
    standalone: true,
    mode: 'ready',
    time: 0,
    player: { x: 540, y: 475, angle: -Math.PI / 2, carrying: null, load: 0 },
    members: [0, 1].map((id) => ({
      id,
      form: 'strider',
      x: 480 + id * 95,
      y: 420,
      angle: 0,
      role: id ? 'wood' : 'food',
      carrying: null,
      target: null,
      newborn: false,
    })),
    patches,
    food: 2,
    wood: 0,
    shelter: false,
    integrity: 100,
    growth: 0,
    feedCooldown: 0,
    repairCooldown: 0,
    storm: null,
    weatherClock: 0,
    notice: '先给成员分工，再一起收集 8 树枝和 4 果实。',
    delivered: 0,
  };
}
export function colonyFromLand(w: World): ColonyState | null {
  if (w.habitat !== 'land' || w.mode !== 'won' || !w.land) return null;
  const s = createColonyWorld();
  const legacy = droughtLegacy(w);
  if (w.tidalLegacy) s.tidalLegacy = structuredClone(w.tidalLegacy);
  s.learning = inheritedLearning(w);
  s.dnaLineage = inheritedDna(w);
  s.form = w.form;
  s.features = [...(w.land.features ?? [])];
  s.body = structuredClone(w.land.body);
  s.traits = [...w.traits];
  s.organ = w.land.organ ?? undefined;
  s.adaptation = w.land.protection ?? undefined;
  s.adaptations = adaptationsOf(w.land);
  s.generation = w.generation;
  s.history = structuredClone(w.history);
  rememberGeneration(s.history, {
    generation: w.generation,
    form: w.form,
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    body: structuredClone(w.land.body),
    food: w.food,
    seconds: w.age,
    landOrgan: w.land.organ ?? undefined,
    landFeatures: [...(w.land.features ?? [])],
    habitat: 'land',
    landWays: landSettlementWays(w),
    ...(legacy ? { landLegacy: legacy } : {}),
    ...(w.tidalLegacy ? { tidalLegacy: structuredClone(w.tidalLegacy) } : {}),
    adaptation: w.land.protection ?? undefined,
    adaptations: adaptationsOf(w.land),
  });
  s.standalone = w.land.checkpoint.standalone;
  s.food = w.food;
  if (legacy) {
    s.food += legacy.supplies;
    s.notice =
      legacy.strategy === 'refuge'
        ? `保湿窝的${legacy.supplies}份储备已搬入新巢。筑窝经验让暴雨修补每次多恢复10稳固度。`
        : legacy.strategy === 'grove'
          ? `守护果丛时留下的${legacy.supplies}份储备已搬入新巢，种苗随你继续生长。`
          : '水源迁移的足迹指向近巢食场，伙伴的采果路线更短了。';
    if (legacy.strategy === 'migration') {
      const foodPatch = s.patches.find((p) => p.kind === 'food');
      if (foodPatch) {
        foodPatch.x = COLONY_NEST.x + 140;
        foodPatch.y = COLONY_NEST.y + 55;
      }
    }
  }
  const seed = w.land.seedPod;
  if (seed?.stage === 'eaten') s.seedLegacy = 'eaten';
  if (seed?.stage === 'planted' && seed.waters === 3) {
    s.seedLegacy = 'grown';
    s.patches.push({
      id: 12,
      kind: 'food',
      x: COLONY_NEST.x + 165,
      y: COLONY_NEST.y - 90,
      cooldown: 0,
    });
    s.notice += ' 你照料的月露种苗在新巢旁扎根了，伙伴也能采集。';
  }
  s.members = w.land.creatures
    .filter((c) => c.joined)
    .map((c, i) => ({
      id: i,
      features: c.shoreOrigin == null ? [landSpecies(c.species).feature] : [],
      source: c.shoreOrigin == null ? `land:${c.species}` : 'shore:friend',
      form: c.shoreOrigin != null ? 'skipper' : landSpecies(c.species).form,
      x: 500 + i * 36,
      y: 440,
      angle: 0,
      role: i % 2 ? 'wood' : 'food',
      carrying: c.carrying ? 'food' : null,
      target: null,
      newborn: false,
    }));
  return s;
}
export function setColonyRole(s: ColonyState, id: number, role: ColonyRole) {
  if (s.mode !== 'running' || !['food', 'wood', 'guard'].includes(role))
    return false;
  const m = s.members.find((m) => m.id === id);
  if (!m) return false;
  m.role = role;
  m.target = null;
  s.notice = `${m.newborn ? '长大的幼崽' : '成员 ' + (id + 1)}回应了你，开始${ROLE_NAMES[role]}。`;
  return true;
}
export function colonyGoal(s: ColonyState) {
  if (s.freeLife && s.mode === 'running')
    return '家园继续运转：采集、搬运、分工，准备好后自选走向工具社会。';
  if (s.mode === 'won')
    return '生物篇完成 · 保存族群成果，培育另一条支系或继续家园生活。';
  if (!s.shelter) return '收集 8 树枝 + 4 果实，回巢按 K 搭育幼棚';
  if (s.growth < 100) return '回巢按 K 喂幼崽 · 每次 2 果实，共喂 5 次';
  if (s.storm === null) return '储备食物和树枝，安排守巢成员，再迎接暴雨';
  return '坚持到雨停 · 每 8 秒消耗 1 食物，回巢按 K 修棚';
}
export function colonyGuards(s: ColonyState) {
  return s.members.filter(
    (m) => m.role === 'guard' && !m.carrying && distance(m, COLONY_NEST) < 100,
  );
}
export function colonyMemberTraits(m: ColonyMember) {
  const traits: string[] = [];
  if (m.features?.some((id) => ['leap', 'glide'].includes(id)))
    traits.push('长足 / 侧膜 · 搬运更快');
  if (m.features?.includes('cache')) traits.push('储食袋 · 满载不减速');
  if (m.features?.includes('roots')) traits.push('根须 · 照料附近食源');
  if (
    m.features?.some((id) => ['burrow', 'herd', 'alarm', 'thorns'].includes(id))
  )
    traits.push('守护结构 · 护巢更稳');
  return traits;
}
export const colonyCapacity = (s: ColonyState) =>
  3 +
  (s.features?.includes('cache') ? 1 : 0) +
  (learningBonus(s, 'weaving', 'colony') ? 1 : 0);
export function colonyJourneyTarget(s: ColonyState) {
  const home = {
    point: COLONY_NEST,
    label: s.player.load
      ? '把物资带回巢穴 · K 存放'
      : !s.shelter
        ? '回巢搭起育幼棚 · K'
        : s.storm !== null
          ? '回巢加固屋顶 · K'
          : s.growth < 100
            ? '回巢喂养幼崽 · K'
            : '回巢准备迎接暴雨',
  };
  const kind = !s.shelter
    ? s.wood < 8
      ? 'wood'
      : s.food < 4
        ? 'food'
        : null
    : s.storm !== null
      ? s.wood < 1
        ? 'wood'
        : null
      : s.growth < 100
        ? s.food < 2
          ? 'food'
          : null
        : s.wood < 4
          ? 'wood'
          : s.food < 4
            ? 'food'
            : null;
  const need = !s.shelter
    ? kind === 'wood'
      ? 8 - s.wood
      : 4 - s.food
    : kind === 'wood'
      ? (s.storm !== null ? 1 : 4) - s.wood
      : (s.growth < 100 ? 2 : 4) - s.food;
  if (
    !kind ||
    s.player.load >= colonyCapacity(s) ||
    (s.player.load && (s.player.carrying !== kind || s.player.load >= need))
  )
    return home;
  const patch = s.patches
    .filter((p) => p.kind === kind && p.cooldown === 0)
    .sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
  return patch
    ? {
        point: patch,
        label: `${kind === 'wood' ? '拾枝' : '采果'} · 靠近后 K 采集`,
      }
    : home;
}
export function colonyRepairAmount(s: ColonyState) {
  return (
    (s.features?.includes('burrow') ? 4 : 0) +
    ([...s.history].reverse().find((a) => a.landLegacy)?.landLegacy
      ?.strategy === 'refuge'
      ? 30
      : 20) +
    (learningBonus(s, 'masonry', 'colony') ? 4 : 0)
  );
}
export function colonyInteraction(s: ColonyState) {
  if (s.mode === 'won')
    return {
      label: '家园已安顿',
      hint: '育幼与守护完成。可以回看家园，再从分工面板继续下一章。',
      ready: false,
      target: null,
    };
  const p = s.player;
  if (distance(p, COLONY_NEST) < 85) {
    if (p.load && p.carrying)
      return {
        label: `存放${p.load}份${p.carrying === 'food' ? '果实' : '树枝'}`,
        hint: '放入公共储备，伙伴也在把物资带回家。',
        ready: true,
        target: COLONY_NEST,
      };
    if (!s.shelter)
      return {
        label: '搭起育幼棚',
        hint: `需要8树枝和4果实 · 现有${s.wood}树枝、${s.food}果实`,
        ready: s.wood >= 8 && s.food >= 4,
        target: COLONY_NEST,
      };
    if (s.storm !== null)
      return {
        label: '加固屋顶',
        hint:
          s.repairCooldown > 0
            ? `等${Math.ceil(s.repairCooldown)}秒，让枝条固定`
            : s.integrity >= 100
              ? '屋顶完好，先储备材料或安排守巢。'
              : `1树枝 · 恢复${colonyRepairAmount(s)}%牢固度`,
        ready: s.wood >= 1 && s.integrity < 100 && s.repairCooldown <= 0,
        target: COLONY_NEST,
      };
    if (s.growth < 100)
      return {
        label: '喂养幼崽',
        hint:
          s.feedCooldown > 0
            ? `等${Math.ceil(s.feedCooldown)}秒，幼崽正在消化`
            : '2果实 · 成长20%',
        ready: s.food >= 2 && s.feedCooldown <= 0,
        target: COLONY_NEST,
      };
    return {
      label: '准备迎接暴雨',
      hint: '安排守巢成员，备好食物和修补树枝后，点击分工面板中的迎接暴雨。',
      ready: false,
      target: COLONY_NEST,
    };
  }
  const patch = s.patches
    .filter((f) => distance(p, f) < 60)
    .sort(
      (a, b) =>
        Number(a.cooldown > 0) - Number(b.cooldown > 0) ||
        distance(p, a) - distance(p, b),
    )[0];
  if (patch) {
    const name =
      patch.kind === 'wood'
        ? '树枝'
        : patch.id === 12 && s.seedLegacy === 'grown'
          ? '月露果实'
          : '果实';
    return {
      label: `采集${name}`,
      hint:
        p.load >= colonyCapacity(s) || (p.carrying && p.carrying !== patch.kind)
          ? '先把手里的物资带回巢穴。'
          : patch.cooldown > 0
            ? `还需${Math.ceil(patch.cooldown)}秒恢复，可以寻找另一处。`
            : `可再生资源 · 携带${p.load}/${colonyCapacity(s)}`,
      ready:
        patch.cooldown === 0 &&
        p.load < colonyCapacity(s) &&
        (!p.carrying || p.carrying === patch.kind),
      target: patch,
    };
  }
  return {
    label: p.load ? '带物资回巢' : '靠近果丛或落枝',
    hint: p.load
      ? '回到中央巢穴，按K存入公共储备。'
      : '金色果实补给幼崽，树枝搭棚并修补屋顶。',
    ready: false,
    target: p.load ? COLONY_NEST : null,
  };
}
export function colonyInteract(s: ColonyState) {
  if (s.mode !== 'running') return false;
  const p = s.player;
  if (distance(p, COLONY_NEST) < 85) {
    if (p.load && p.carrying) {
      s[p.carrying === 'wood' ? 'wood' : 'food'] += p.load;
      s.delivered += p.load;
      s.notice = `带回 ${p.load} 份${p.carrying === 'wood' ? '树枝' : '果实'}。`;
      p.load = 0;
      p.carrying = null;
      return true;
    }
    if (!s.shelter) {
      if (s.wood < 8 || s.food < 4) {
        s.notice = '育幼棚需要 8 树枝和 4 果实。';
        return false;
      }
      s.wood -= 8;
      s.food -= 4;
      s.shelter = true;
      const discovery = learnFrom(s, 'colony:shelter');
      s.notice = '枝条交织成屋顶！巢中的幼崽探出了头。';
      if (discovery) s.notice += ' 发现编织技艺，打开 DNA / 技艺学习。';
      return true;
    }
    if (s.storm !== null) {
      if (s.wood < 1 || s.integrity >= 100 || s.repairCooldown > 0) {
        s.notice = '修棚需要 1 树枝，完成后等待 2 秒。';
        return false;
      }
      s.wood--;
      s.integrity = Math.min(100, s.integrity + colonyRepairAmount(s));
      s.repairCooldown = 2;
      const discovery = learnFrom(s, 'colony:repair');
      s.notice = '你把新树枝压在迎风面，屋顶稳住了。';
      if (discovery) s.notice += ' 发现营造技艺，打开 DNA / 技艺学习。';
      return true;
    }
    if (s.growth < 100) {
      if (s.food < 2 || s.feedCooldown > 0) {
        s.notice = '喂养需要 2 果实，两次喂养间隔 3 秒。';
        return false;
      }
      s.food -= 2;
      s.growth = Math.min(
        100,
        s.growth + 20 + (learningBonus(s, 'nurture', 'colony') ? 5 : 0),
      );
      if (s.growth >= 60) learnFrom(s, 'colony:care');
      s.feedCooldown = 3;
      s.notice = '幼崽接住果实，身体长大了一点。';
      if (s.growth === 100) {
        s.members.push({
          id: Math.max(-1, ...s.members.map((m) => m.id)) + 1,
          x: 590,
          y: 420,
          angle: 0,
          role: 'guard',
          target: null,
          carrying: null,
          newborn: true,
          body: structuredClone(s.body),
          features: [...(s.features ?? [])],
          form: s.form,
        });
        s.notice = '幼崽长大了！现在也能采果、拾枝和守护家园。';
      }
      return true;
    }
    s.notice = '新成员已经长大。准备好后，点击“迎接暴雨”。';
    return false;
  }
  const patch = s.patches
    .filter((f) => f.cooldown === 0 && distance(p, f) < 60)
    .sort((a, b) => distance(p, a) - distance(p, b))[0];
  if (!patch) {
    s.notice = '靠近果丛或落枝按 K 采集，回巢按 K 放入储备。';
    return false;
  }
  if (
    p.load >= colonyCapacity(s) ||
    (p.carrying && p.carrying !== patch.kind)
  ) {
    s.notice = '先回巢放下手里的物资，再采集另一种。';
    return false;
  }
  patch.cooldown = 14;
  p.carrying = patch.kind;
  p.load++;
  s.notice = `采到${patch.kind === 'wood' ? '树枝' : '果实'} · 携带 ${p.load}/${colonyCapacity(s)}，回巢按 K 存放。`;
  return true;
}
export function startColonyStorm(s: ColonyState) {
  if (s.mode !== 'running' || !s.shelter || s.growth < 100 || s.storm !== null)
    return false;
  s.storm = 40;
  s.weatherClock = 0;
  s.notice = '风向变了！守巢者护住屋顶，其余成员仍可搜集物资。';
  return true;
}
export function stepColony(
  s: ColonyState,
  input: { x: number; y: number; interact?: boolean },
  dt: number,
) {
  if (s.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  // Fixed bounded substeps keep travel and weather costs identical across frame rates.
  if (dt > 1 / 30) {
    let remaining = dt;
    let first = true;
    while (remaining > 1e-8) {
      const step = Math.min(1 / 30, remaining);
      stepColony(s, { ...input, interact: first && input.interact }, step);
      remaining -= step;
      first = false;
    }
    return;
  }
  s.time += dt;
  s.feedCooldown = Math.max(0, s.feedCooldown - dt);
  s.repairCooldown = Math.max(0, s.repairCooldown - dt);
  for (const p of s.patches) p.cooldown = Math.max(0, p.cooldown - dt);
  const mag = Math.hypot(input.x, input.y);
  if (mag > 0.01) {
    const speed =
      (s.form === 'strider' ? 190 : 165) *
      (1 + ((s.body.legs ?? 1) - 1) * 0.25);
    s.player.x = Math.max(
      25,
      Math.min(1095, s.player.x + (input.x / Math.max(1, mag)) * speed * dt),
    );
    s.player.y = Math.max(
      25,
      Math.min(735, s.player.y + (input.y / Math.max(1, mag)) * speed * dt),
    );
    s.player.angle = Math.atan2(input.y, input.x);
  }
  if (input.interact) colonyInteract(s);
  const reserved = new Set<number>();
  for (const m of s.members) {
    if (m.features?.includes('roots'))
      for (const patch of s.patches)
        if (patch.kind === 'food' && distance(m, patch) < 130)
          patch.cooldown = Math.max(0, patch.cooldown - dt * 0.6);
    const slot = s.members.indexOf(m),
      angle =
        -Math.PI / 2 + (slot * Math.PI * 2) / Math.max(1, s.members.length);
    let target: Vec = m.carrying
      ? COLONY_NEST
      : {
          x: COLONY_NEST.x + Math.cos(angle) * 88,
          y: COLONY_NEST.y + Math.sin(angle) * 88,
        };
    if (!m.carrying && m.role !== 'guard') {
      let patch = s.patches.find(
        (p) =>
          p.id === m.target &&
          p.cooldown === 0 &&
          p.kind === m.role &&
          !reserved.has(p.id),
      );
      patch ??= s.patches
        .filter(
          (p) => p.cooldown === 0 && p.kind === m.role && !reserved.has(p.id),
        )
        .sort((a, b) => distance(m, a) - distance(m, b))[0];
      if (patch) {
        reserved.add(patch.id);
        m.target = patch.id;
        target = patch;
        if (distance(m, patch) < 22) {
          patch.cooldown = 14;
          m.carrying = patch.kind;
          m.target = null;
        }
      } else m.target = null;
    }
    if (m.carrying && distance(m, COLONY_NEST) < 45) {
      s[m.carrying === 'wood' ? 'wood' : 'food']++;
      s.delivered++;
      m.carrying = null;
    }
    if (m.role === 'guard' && !m.carrying)
      target = {
        x: COLONY_NEST.x + Math.cos(angle) * 88,
        y: COLONY_NEST.y + Math.sin(angle) * 88,
      };
    const d = distance(m, target);
    if (d > 12) {
      m.angle = Math.atan2(target.y - m.y, target.x - m.x);
      const speed = Math.min(
        d,
        130 *
          dt *
          (m.features?.some((id) => ['leap', 'glide'].includes(id))
            ? 1.25
            : 1) *
          (m.carrying && !m.features?.includes('cache') ? 0.85 : 1),
      );
      m.x += Math.cos(m.angle) * speed;
      m.y += Math.sin(m.angle) * speed;
    }
  }
  if (s.storm !== null && s.storm > 0) {
    const guards = colonyGuards(s).reduce(
      (value, m) =>
        value +
        1 +
        (m.features?.some((id) =>
          ['burrow', 'herd', 'alarm', 'thorns'].includes(id),
        )
          ? 0.25
          : 0),
      0,
    );
    s.integrity = Math.max(
      0,
      s.integrity -
        dt * (Math.max(0.8, 3.4 - guards * 0.7) + (s.food === 0 ? 1.5 : 0)),
    );
    s.weatherClock += dt;
    while (s.weatherClock >= 8 - 1e-8) {
      s.weatherClock = Math.max(0, s.weatherClock - 8);
      s.food = Math.max(0, s.food - 1);
    }
    s.storm = Math.max(0, s.storm - dt);
    if (s.integrity <= 0) {
      s.mode = 'lost';
      s.notice = '屋顶被风掀开了。重新安排守巢成员，多准备一些修补用的树枝。';
    } else if (s.storm <= 1e-8) {
      s.storm = 0;
      s.mode = 'won';
      s.notice = '雨停了。你们一起守住了第一个家。';
    }
  }
}
