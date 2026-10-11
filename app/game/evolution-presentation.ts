import { LAND_FEATURES, type LandFeature } from './land-catalog.ts';
import type { World, TraitId } from './simulation.ts';
import type { BodyDesign, Slot } from './body-design.ts';
import { SLOTS, ORGANS } from './body-design.ts';
import { listOrgans, MOUNT_NAMES } from './body-layout.ts';
import { FORMS } from './forms.ts';

export type BodyFormation = {
  limbs: number;
  organs: Partial<Record<Slot, number>>;
  placements: Record<string, number>;
  landOrgan: number;
  adaptation: number;
};
const blend = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (p: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
  return t * t * (3 - 2 * t);
};
/** Presentation only: never mutate the inherited body or change gameplay statistics. */
export function evolutionFrame(w: World, reduced = false) {
  const e = w.evolution;
  if (!e) return null;
  const p = reduced ? 1 : Math.max(0, Math.min(1, e.elapsed / e.duration));
  const target = w.land?.body ?? w.shore?.body ?? w.ocean?.body;
  const changedForm = (e.before.form ?? 'microbe') !== w.form;
  const body: BodyDesign | undefined = target
    ? {
        ...target,
        length: blend(
          e.before.body?.length ?? 1,
          target.length,
          ramp(p, 0.12, 0.44),
        ),
        width: blend(
          e.before.body?.width ?? 1,
          target.width,
          ramp(p, 0.12, 0.44),
        ),
        legs: blend(
          e.before.body?.legs ?? 1,
          target.legs ?? 1,
          ramp(p, 0.25, 0.7),
        ),
        organs: { ...target.organs },
        ...(target.placements
          ? { placements: structuredClone(target.placements) }
          : {}),
        ...(target.appearance ? { appearance: { ...target.appearance } } : {}),
      }
    : undefined;
  const organSlots: Partial<Record<Slot, number>> = {};
  const placementFormation: Record<string, number> = {};
  const beforeParts = e.before.body ? listOrgans(e.before.body) : [];
  for (const part of target ? listOrgans(target) : []) {
    placementFormation[part.id] = beforeParts.some(
      (p) =>
        p.id === part.id &&
        p.organ === part.organ &&
        p.mount === part.mount &&
        p.t === part.t,
    )
      ? 1
      : ramp(p, 0.4, 0.78);
  }
  for (const slot of SLOTS) {
    if (target?.placements) continue;
    const part = target
      ? listOrgans(target).find((p) => p.mount === slot)
      : undefined;
    if (part) organSlots[slot] = placementFormation[part.id];
  }
  const traits: Partial<Record<TraitId, number>> = {};
  for (const trait of w.traits)
    traits[trait] = e.before.traits.includes(trait) ? 1 : ramp(p, 0.3, 0.82);
  const adaptation = w.land?.protection ?? w.shore?.protection ?? undefined;
  return {
    progress: p,
    phase: p < 0.2 ? 0 : p < 0.78 ? 1 : 2,
    parentOpacity: 1 - ramp(p, 0.08, 0.24),
    childOpacity: ramp(p, 0.12, 0.28),
    body,
    traits,
    formation: {
      limbs: changedForm ? ramp(p, 0.2, 0.7) : 1,
      organs: organSlots,
      placements: placementFormation,
      landOrgan:
        e.before.landOrgan === (w.land?.organ ?? undefined)
          ? 1
          : ramp(p, 0.38, 0.8),
      adaptation: e.before.adaptation === adaptation ? 1 : ramp(p, 0.4, 0.85),
    } satisfies BodyFormation,
  };
}
export function evolutionStructure(w: World) {
  const e = w.evolution;
  if (!e) return { title: '', detail: '' };
  if (e.choice.startsWith('landpart:')) {
    const feature = LAND_FEATURES[e.choice.split(':')[1] as LandFeature];
    return {
      title: feature.name,
      detail: feature.benefit + ' · ' + feature.action,
    };
  }
  const structures: Record<string, { title: string; detail: string }> = {
    colony: {
      title: '原有细胞延续，后代开始协作',
      detail:
        '保留上一代的细胞轮廓和遗传特征，新的细胞逐步聚成能够协同游动的身体。',
    },
    radial: {
      title: '触臂向四周展开',
      detail: '身体周围都能接触食物，观察更宽的摄食范围。',
    },
    bilateral: {
      title: '头尾拉开，身体有了方向',
      detail: '前端朝向食物，尾部推动前进。',
    },
    jelly: {
      title: '伞体张开，触腕向后延伸',
      detail: '伞体收缩推动身体，触腕在身后展开。',
    },
    fish: {
      title: '胸鳍展开，尾鳍接力摆动',
      detail: '流线轮廓与尾鳍共同形成定向游动的身体。',
    },
    crawler: {
      title: '附肢伸长，足尖接触地面',
      detail: '前后附肢交替迈步，身体开始离开地面。',
    },
    skipper: {
      title: '短肢撑开，湿润足垫展开',
      detail: '宽足垫贴住地面，保留水陆往返的灵活性。',
    },
    strider: {
      title: '长足伸展，迈开更大的步子',
      detail: '细长附肢托起身体，尾部平衡前进的步伐。',
    },
    stalker: {
      title: '前肢变厚，身体伏低',
      detail: '强壮前肢与低矮轮廓形成蓄力扑出的身体。',
    },
    reservoir: {
      title: '储水囊鼓起，留下水分',
      detail: '观察躯干内的蓝色囊体；下一次离水能携带更多水分。',
    },
    skin: {
      title: '保湿皮膜逐渐包住躯干',
      detail: '绿色薄膜围住身体，减少离水时的水分散失。',
    },
    crest: {
      title: '头顶的共鸣冠舒展开来',
      detail: '新冠体帮助声音传得更远；靠近邻居试着呼唤。',
    },
    plates: {
      title: '肩侧骨板逐渐覆盖',
      detail: '两侧骨板抵挡冲撞；同时增加身体负担。',
    },
    flagellum: {
      title: '鞭毛向后延伸',
      detail: '更长的鞭毛推动游动，活动也消耗更多能量。',
    },
    shell: {
      title: '外壳围住柔软的身体',
      detail: '保护层逐渐闭合，身体游动会更慢。',
    },
    spikes: {
      title: '防御尖刺从边缘伸出',
      detail: '接触尖刺的捕食者会暂时眩晕。',
    },
    cilia: {
      title: '纤毛变得更密、更长',
      detail: '身体能触及更远的食物，维持纤毛也需要能量。',
    },
    vacuole: {
      title: '储能囊在体内成形',
      detail: '体内出现更大的储备空间，为远行积累能量。',
    },
    chloroplast: {
      title: '共生藻的绿色逐渐显现',
      detail: '去浅光区停下来，观察能量恢复。',
    },
  };
  if (e.choice === 'anatomy') {
    const body = w.land?.body ?? w.shore?.body ?? w.ocean?.body;
    const previous = e.before.body ? listOrgans(e.before.body) : [];
    const next = body ? listOrgans(body) : [];
    const changes = next
      .filter(
        (part) =>
          !previous.some(
            (p) =>
              p.organ === part.organ &&
              p.mount === part.mount &&
              p.t === part.t,
          ),
      )
      .map(
        (part) => `${MOUNT_NAMES[part.mount]}长出${ORGANS[part.organ].name}`,
      );
    for (const part of previous)
      if (
        !next.some(
          (p) =>
            p.organ === part.organ && p.mount === part.mount && p.t === part.t,
        )
      )
        changes.push(`${MOUNT_NAMES[part.mount]}收回器官`);
    return {
      title: '你设计的轮廓逐渐成形',
      detail:
        changes.join('，') || '身体比例逐渐改变；回到环境中比较移动与转向。',
    };
  }
  return (
    structures[e.choice] ??
    structures[w.form] ?? {
      title: FORMS[w.form].name,
      detail: '新的身体已经准备好，回到环境中试一试。',
    }
  );
}
