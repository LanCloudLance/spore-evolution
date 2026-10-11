import { beginEvolution } from './evolution-experience.ts';
import {
  LAND_SPECIES,
  LAND_FEATURES,
  type LandFeature,
} from './land-catalog.ts';
import { reviseMicrobe, reproductionGate } from './simulation.ts';
import type { World } from './simulation.ts';
import { DNA_SOURCES, microbeCandidates } from './dna-evolution.ts';
import type { DnaSource, DnaMethod, MicrobeBody } from './dna-evolution.ts';
import { oceanDnaCandidates, commitOceanDna } from './ocean-dna.ts';
import type { OceanDnaBody } from './ocean-dna.ts';
import { shoreEvolutionGate, evolveShore } from './shore.ts';
import type { ShoreChoice } from './shore.ts';
import { landEvolutionGate, evolveLand } from './land.ts';
import type { LandChoice } from './land.ts';

export type BiologicalCandidate = {
  id: string;
  name: string;
  benefit: string;
  cost: string;
  available: boolean;
  gate: string;
  sources: string[];
  action: string;
  resource: string;
  sourceIds: DnaSource[];
};
type Path = {
  name: string;
  benefit: string;
  cost: string;
  action: string;
  needs: DnaSource[];
  method?: DnaMethod;
};
const SHORE_PATHS: Record<ShoreChoice, Path> = {
  crawler: {
    name: '撑足爬行体',
    benefit: '宽足稳步穿越湿沙',
    cost: '游水速度较慢',
    action: 'J 撑地跃进',
    needs: ['shore:support'],
  },
  skipper: {
    name: '跃行弹尾体',
    benefit: '弹尾在水陆之间短跃',
    cost: '离水活动耗能较高',
    action: 'J 弹尾跃进',
    needs: ['shore:support', 'sea:silver-dart', 'sea:thinwing'],
  },
  reservoir: {
    name: '储水远行体',
    benefit: '储水组织增加离水续航',
    cost: '更重的身体需要补给',
    action: '向远处潮池迁行',
    needs: ['shore:moisture', 'sea:ribbonfish'],
  },
  skin: {
    name: '保湿栖岸体',
    benefit: '皮膜减缓失水，可庇护沿岸',
    cost: '仍需水源恢复湿润',
    action: '沿庇护处行走',
    needs: ['shore:moisture', 'shore:friend', 'shore:shellbed', 'shore:shade'],
  },
};
const LAND_PATHS: Record<LandChoice, Path> = {
  strider: {
    name: '长足巡行兽',
    benefit: '巡行、呼唤和结伴',
    cost: '没有扑击的爆发力',
    action: 'J 呼唤邻居',
    needs: LAND_SPECIES.filter(
      (s) => !['hunt', 'ambush', 'charge'].includes(s.behavior),
    ).map((s) => `land:${s.id}` as DnaSource),
  },
  stalker: {
    name: '伏地扑猎兽',
    benefit: '低伏潜行，蓄力扑击',
    cost: '猎物会警觉，扑击消耗能量',
    action: '潜行 → J 扑猎',
    needs: [
      'land:fern',
      'land:grazer',
      'land:hunter',
      'land:dusk-stalker',
      'dart',
      'sea:silver-dart',
      'sea:brush-ray',
    ],
    method: 'hunt',
  },
  crest: {
    name: '群居鸣冠兽',
    benefit: '呼唤更容易建立信任',
    cost: '分享仍需要支付食物',
    action: 'J 呼唤 / K 分享',
    needs: ['land:fern', 'land:grazer'],
    method: 'symbiosis',
  },
  plates: {
    name: '厚甲守护兽',
    benefit: '肩甲保护身体与同行者',
    cost: '体型更宽，转向慢',
    action: '抵御猎手，守住栖地',
    needs: [
      'land:grazer',
      'land:hunter',
      'shield',
      'sea:moss-crab',
      'sea:shellsnail',
    ],
  },
};
function sourceReady(w: World, id: DnaSource, method?: DnaMethod) {
  const receipt = w.dnaLineage?.sources[id];
  return (
    !!receipt &&
    receipt.units >= 2 &&
    (!method ||
      (receipt.methods?.[method] ?? 0) > 0 ||
      (!receipt.methods && receipt.method === method))
  );
}
/** Source eligibility is separate from immediate birth safety and nutrition. */
export function nextGenerationCandidates(w: World): BiologicalCandidate[] {
  const view = ['paused', 'evolving'].includes(w.mode)
    ? { ...w, mode: 'running' as const }
    : w;
  if (w.habitat === 'pond')
    return microbeCandidates(w).map((c) => ({
      id: `pond:${c.id}`,
      name: c.name,
      benefit: c.benefit,
      cost: c.cost,
      available: c.available,
      gate: c.requirement || reproductionGate(view),
      sources: Object.keys(c.needs).map(
        (id) => DNA_SOURCES[id as DnaSource].name,
      ),
      sourceIds: Object.keys(c.needs) as DnaSource[],
      action:
        c.id === 'ram'
          ? '空格 冲刺撞开大敌'
          : c.id === 'grazer'
            ? '展开摄食冠'
            : '移动、摄食与回巢',
      resource: '本代营养',
    }));
  if (w.habitat === 'ocean')
    return oceanDnaCandidates(view).map((c) => ({
      id: `ocean:${c.id}`,
      name: c.name,
      benefit: c.benefit,
      cost: c.cost,
      available: c.available,
      gate: c.gate || '',
      sources: c.needs.flatMap((n) =>
        n.sources.map((id) => DNA_SOURCES[id].name),
      ),
      sourceIds: c.needs.flatMap((n) => n.sources),
      action:
        c.slots[1] === 'filter'
          ? 'L 展开滤食'
          : c.slots[1] === 'shell'
            ? 'L 缩壳'
            : 'J 疾游 / 侧线观察',
      resource: `${c.costDna} 生长能量`,
    }));
  const paths = w.habitat === 'shore' ? SHORE_PATHS : LAND_PATHS;
  const forms = Object.entries(paths).map(([id, path]) => {
    // Old saves retain discoveries but never receive invented source receipts.
    const legacy =
      !Object.keys(w.dnaLineage?.sources ?? {}).some((source) =>
        source.startsWith(`${w.habitat}:`),
      ) &&
      (w.habitat === 'shore'
        ? w.shore?.discovered.includes(
            ['crawler', 'skipper'].includes(id) ? 'support' : 'moisture',
          )
        : (w.land?.discovered.length ?? 0) >=
          (['crest', 'plates'].includes(id) ? 2 : 1));
    const available =
      !!legacy ||
      path.needs.some((source) => sourceReady(w, source, path.method)) ||
      (id === 'stalker' &&
        (sourceReady(w, 'land:dusk-stalker') || sourceReady(w, 'land:hunter')));
    const tierGate =
      w.habitat === 'shore'
        ? w.shore?.tier === 0 && ['reservoir', 'skin'].includes(id)
          ? '先孕育能够撑地的附肢。'
          : w.shore?.tier === 1 && ['crawler', 'skipper'].includes(id)
            ? '这一代先试验保存水分的组织。'
            : ''
        : w.land?.tier === 0 && ['crest', 'plates'].includes(id)
          ? '先孕育陆地身体。'
          : ['crest', 'plates'].includes(id) &&
              (w.land?.discovered.length ?? 0) < 2
            ? '观察两种陆地生物。'
            : '';
    return {
      id: `${w.habitat}:${id}`,
      ...path,
      available,
      sources: path.needs.map((source) => DNA_SOURCES[source].name),
      sourceIds: path.needs,
      gate: !available
        ? id === 'stalker'
          ? '观察真正的猎手，或实际吃下猎物。'
          : `寻找${path.needs.map((source) => DNA_SOURCES[source].name).join(' / ')}${path.method === 'symbiosis' ? '，让它加入同行' : ''}`
        : tierGate ||
          (w.habitat === 'shore'
            ? shoreEvolutionGate(view)
            : landEvolutionGate(view)),
      resource: `${w.habitat === 'shore' ? (w.shore?.tier === 0 ? 8 : 12) : 10} 营养`,
    };
  });
  if (w.habitat !== 'land' || !w.land) return forms;
  const structures = Object.entries(LAND_FEATURES).map(([id, feature]) => {
    const providers = LAND_SPECIES.filter((s) => s.feature === id);
    const available =
      providers.some((s) => sourceReady(w, `land:${s.id}`)) ||
      (id === 'roots' && sourceReady(w, 'land:garden'));
    return {
      id: `landpart:${id}`,
      ...feature,
      sources: providers.map((s) => s.name),
      sourceIds: providers.map((s) => `land:${s.id}` as DnaSource),
      available,
      resource: '10 营养',
      cost:
        feature.cost +
        (w.land!.features?.length === 3 &&
        !w.land!.features.includes(id as LandFeature)
          ? '；替换最早遗传的组织，最多保留3种'
          : ''),
      gate: !available
        ? `寻找${providers.map((s) => s.name).join(' / ')}，观察、捕食或结伴`
        : w.land!.features?.includes(id as LandFeature)
          ? '这一组织已遗传。'
          : w.land!.tier === 0
            ? '先孕育陆地身体。'
            : landEvolutionGate(view),
    };
  });
  return [...forms, ...structures];
}

/** All mutations occur on a detached next generation; rejection never charges the parent. */
export function commitBiologicalEvolution(w: World, id: string) {
  if (
    !['running', 'paused', 'evolving'].includes(w.mode) ||
    w.player.health <= 0
  )
    return false;
  const candidate = nextGenerationCandidates(w).find((c) => c.id === id);
  if (!candidate || candidate.gate) return false;
  const next = structuredClone(w);
  next.mode = 'running';
  const choice = id.split(':')[1];
  const committed =
    w.habitat === 'pond'
      ? reviseMicrobe(
          next,
          [
            ...new Set([
              ...microbeCandidates(w).find((c) => c.id === choice)!.traits,
              ...w.traits,
            ]),
          ].slice(0, Math.max(3, w.traits.length)),
          choice as MicrobeBody,
        )
      : w.habitat === 'ocean'
        ? commitOceanDna(next, choice as OceanDnaBody)
        : w.habitat === 'shore'
          ? evolveShore(next, choice as ShoreChoice)
          : evolveLand(
              next,
              id.startsWith('landpart:')
                ? next.form === 'stalker'
                  ? 'stalker'
                  : 'strider'
                : (choice as LandChoice),
            );
  if (!committed) return false;
  if (next.habitat === 'shore' && next.shore) {
    if (choice === 'crawler')
      Object.assign(next.shore.body, { length: 1.1, width: 1.2, legs: 1.1 });
    if (choice === 'skipper')
      Object.assign(next.shore.body, { length: 1.4, width: 0.85, legs: 0.9 });
  }
  if (next.habitat === 'land' && next.land) {
    if (choice === 'strider')
      Object.assign(next.land.body, { length: 1.2, legs: 1.3 });
    if (choice === 'stalker')
      Object.assign(next.land.body, { length: 1.4, legs: 0.8 });
  }
  if (id.startsWith('landpart:') && next.land) {
    next.land.features = [
      ...(next.land.features ?? []).filter((f) => f !== choice),
      choice as LandFeature,
    ].slice(-3);
    next.land.activeFeature = choice as LandFeature;
    next.land.featureActive = 0;
    next.land.featureCooldown = 0;
    if (!next.land.features.includes('sift')) next.land.sifting = false;
    if (!next.land.features.includes('cache') && next.land.cachedFood) {
      next.food += next.land.cachedFood;
      next.land.cachedFood = 0;
    }
    beginEvolution(next, id);
  }
  Object.assign(w, next);
  return true;
}
