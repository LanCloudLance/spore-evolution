'use client';
import { drawLandFeatures } from './land-features';
import type { LandFeature } from './land-catalog';
import type { MicrobeBody } from './dna-evolution';
import { canFilter, canHunt, migrationAvailable } from './ocean-migration';
import type { MigrationRoute } from './ocean-migration';
import type { BodyDesign } from './body-design';
import { discoveryHint, bodyEditGate } from './body-design';
import { hasOrgan } from './body-layout';
import { memo, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Dna, GitBranch } from 'lucide-react';
import type { BodyForm } from './forms';
import { FORMS, nextForms } from './forms';
import type { World, TraitId } from './simulation';
import { TRAITS, distance, getStats } from './simulation';
import {
  OCEAN_MAP,
  OCEAN_ZONES,
  OCEAN_NURSERY,
  oceanEvolutionGate,
  oceanTarget,
} from './ocean';
import { drawBody } from './ocean-render';
import { drawOrganism } from './render';
import { growthScale } from './food-chain';
import { Progress } from '@/components/ui/progress';
export const BodyPortrait = memo(
  function BodyPortrait({
    form,
    traits = [],
    large = false,
    body,
    landOrgan,
    landFeatures,
    adaptation,
    microbeBody = 'ancestor',
  }: {
    microbeBody?: MicrobeBody;
    form: BodyForm;
    traits?: TraitId[];
    large?: boolean;
    body?: BodyDesign;
    landOrgan?: 'crest' | 'plates';
    landFeatures?: LandFeature[];
    adaptation?: 'reservoir' | 'skin';
  }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      const c = ref.current?.getContext('2d');
      if (!c) return;
      c.clearRect(0, 0, 240, 140);
      if (form === 'microbe') {
        drawOrganism(
          c,
          120,
          70,
          large ? 43 : 35,
          -0.12,
          0,
          traits,
          false,
          false,
          {},
          microbeBody,
        );
        return;
      }
      drawBody(
        c,
        form,
        form === 'jelly' ? 151 : 131,
        70,
        form === 'strider' || form === 'stalker'
          ? (large ? 30 : 27) /
              Math.max(1, (body?.legs ?? 1) * (body?.width ?? 1))
          : large
            ? 43
            : 34,
        -0.12,
        1,
        traits,
        false,
        undefined,
        body,
        landOrgan,
        1,
        adaptation,
      );
      if (landFeatures?.length)
        drawLandFeatures(
          c,
          { x: 131, y: 70, angle: -0.12 },
          large ? 30 : 27,
          landFeatures,
          0,
        );
    }, [
      form,
      traits,
      large,
      body,
      landOrgan,
      adaptation,
      microbeBody,
      landFeatures,
    ]);
    return (
      <canvas
        ref={ref}
        width={240}
        height={140}
        className="body-portrait"
        aria-label={FORMS[form].name}
      />
    );
  },
  (a, b) =>
    a.microbeBody === b.microbeBody &&
    a.form === b.form &&
    a.landOrgan === b.landOrgan &&
    (a.landFeatures ?? []).join(',') === (b.landFeatures ?? []).join(',') &&
    a.adaptation === b.adaptation &&
    a.large === b.large &&
    JSON.stringify(a.body) === JSON.stringify(b.body) &&
    (a.traits ?? []).join(',') === (b.traits ?? []).join(','),
);
export function OceanHUD({
  world: w,
  onEvolve,
  onFamily,
  onSkill,
  onEdit,
  onLocate,
  onMigration,
  onInteract,
}: {
  world: World;
  onEvolve: () => void;
  onFamily: () => void;
  onSkill: () => void;
  onEdit: () => void;
  onLocate: () => void;
  onMigration: (route: MigrationRoute) => void;
  onInteract: () => void;
}) {
  const o = w.ocean!,
    f = FORMS[w.form],
    target = oceanTarget(w);
  const gate = oceanEvolutionGate(w);
  const need = o.tier === 0 ? 10 : o.tier === 1 ? 14 : 8;
  const safe = distance(w.player, OCEAN_NURSERY) <= OCEAN_NURSERY.radius;
  const zones = o.tier === 0 ? ['透光浮游区'] : ['洋流走廊', '珊瑚礁缘'];
  return (
    <aside className="mission-panel glass-panel ocean-mission focused-mission">
      <div className="panel-eyebrow">
        海洋 · {o.tier + 1}/3 <span>{f.name}</span>
      </div>
      <div className="primary-objective">
        <small>现在做什么</small>
        <h2>{target.label}</h2>
        <button onClick={onLocate}>◎ 定位目标</button>
      </div>
      <div className="quick-progress">
        <span>
          摄食{' '}
          <b>
            {Math.min(w.food, need)}/{need}
          </b>
        </span>
        <span>
          体型 <b>{growthScale(w).toFixed(1)}×</b>
        </span>
      </div>
      <Progress
        value={Math.min(100, (w.food / need) * 100)}
        aria-label="本代摄食进度"
      />
      <button
        className="ocean-skill"
        onClick={onSkill}
        disabled={
          w.mode !== 'running' ||
          !!o.morph ||
          o.skillCooldown > 0 ||
          w.player.energy < 14
        }
      >
        <kbd>J</kbd>
        <span>
          {f.skill}
          <small>
            {o.skillCooldown > 0
              ? `${Math.ceil(o.skillCooldown)} 秒后恢复`
              : '14 能量'}
          </small>
        </span>
      </button>
      {
        <button
          onClick={onEvolve}
          className={`evolve-button ${!gate ? 'available' : ''}`}
        >
          <Dna size={17} />
          孕育新身体<kbd>O</kbd>
        </button>
      }
      {migrationAvailable(w) && (
        <div className="migration-controls" aria-label="海洋大迁移路线">
          <div className="migration-route-buttons">
            <button
              aria-pressed={o.migration?.route === 'hunt'}
              disabled={!canHunt(w) || (o.migration?.station ?? 0) >= 2}
              onClick={() => onMigration('hunt')}
            >
              追随鱼群{!canHunt(w) ? ' · 需要捕食口' : ''}
            </button>
            <button
              aria-pressed={o.migration?.route === 'filter'}
              disabled={!canFilter(w) || (o.migration?.station ?? 0) >= 2}
              onClick={() => onMigration('filter')}
            >
              沿暖流滤食{!canFilter(w) ? ' · 需要滤食结构' : ''}
            </button>
          </div>
          {o.migration?.route === 'filter' && o.migration.station < 2 && (
            <button className="ocean-skill" onClick={onInteract}>
              <kbd>K</kbd>
              {o.migration.expanded
                ? '收拢滤食结构 · 恢复游速'
                : '展开滤食结构 · 稳住身体'}
            </button>
          )}
          {o.migration?.route && (
            <small>
              迁移水道 {Math.min(2, o.migration.station)}/2 ·{' '}
              {o.migration.station < 2 ? '途中可以改变方法' : '前往新海岸'}
            </small>
          )}
        </div>
      )}
      <details className="hud-details">
        <summary>进化条件与地图</summary>
        <div className="ocean-objectives">
          <div>
            <span>摄食</span>
            <strong>
              {Math.min(w.food, need)}/{need}
            </strong>
          </div>
          {o.tier < 2 && (
            <>
              <div>
                <span>能量</span>
                <strong>≥ {o.tier === 0 ? 65 : 75}</strong>
              </div>
              {zones.map((z) => (
                <div key={z}>
                  <span>{z}</span>
                  <strong>{o.visited.includes(z) ? '✓' : '待探索'}</strong>
                </div>
              ))}
              <div>
                <span>回育生地</span>
                <strong>{safe ? '✓' : '待返回'}</strong>
              </div>
            </>
          )}
        </div>
        <div
          className="ocean-map"
          aria-label="海洋地图，育生地在西南，浮游区在北方，礁缘在东部，栖息地在东北"
        >
          {OCEAN_ZONES.map((z, i) => (
            <span
              key={z.name}
              title={z.name}
              className={`ocean-map-zone zone-${i}`}
              style={{
                left: `${(z.x / OCEAN_MAP.width) * 100}%`,
                top: `${(z.y / OCEAN_MAP.height) * 100}%`,
                color: z.color,
              }}
            >
              <i />
              {['育生地', '浮游区', '礁缘', '洋流', '远海'][i]}
            </span>
          ))}
          <span
            className="map-player"
            style={{
              left: `${(w.player.x / OCEAN_MAP.width) * 100}%`,
              top: `${(w.player.y / OCEAN_MAP.height) * 100}%`,
            }}
          />
          <span className="map-north">N ↑</span>
        </div>
      </details>
      <details className="hud-details">
        <summary>可选 · 身体改造（{o.dna} DNA）</summary>
        <div className="discovery-card">
          <p>{discoveryHint(w)}</p>
          <button
            onClick={onEdit}
            className="evolve-button"
            disabled={!!bodyEditGate(w)}
          >
            {safe ? '改造下一代的身体' : '回育生地改造身体'}
          </button>
          <small>
            发现器官 {o.discovered.length}/4 · 长刺防御 {o.blocks} 次
          </small>
        </div>
      </details>
      <details className="hud-details">
        <summary>身体与生存方式</summary>
        <BodyPortrait form={w.form} traits={w.traits} body={o.body} />
        <p>
          {f.movement} ·{' '}
          {hasOrgan(o.body, 'jaw')
            ? '嘴朝向小鱼才能吞食'
            : '滤食口适合收集浮游食物'}
        </p>
        <button className="text-button" onClick={onFamily}>
          <GitBranch size={15} />
          查看形态树
        </button>
        <div className="trait-tags">
          {w.traits.map((id) => (
            <span key={id}>{TRAITS.find((t) => t.id === id)?.name}</span>
          ))}
        </div>
      </details>
    </aside>
  );
}
export function OceanEvolution({
  world: w,
  onChoose,
}: {
  world: World;
  onChoose: (form: BodyForm, trait?: TraitId) => void;
}) {
  const choices = nextForms(w.form);
  const [selected, setSelected] = useState<BodyForm>(choices[0]);
  const [trait, setTrait] = useState<TraitId | null>(null);
  const f = FORMS[selected],
    stats = getStats(w.traits, selected);
  return (
    <div className="ocean-evolution">
      <div className="ocean-step-label">01 / 选择身体结构</div>
      <div className="body-choice-grid">
        {choices.map((id) => (
          <button
            key={id}
            aria-pressed={selected === id}
            className={`body-choice ${selected === id ? 'selected' : ''}`}
            onClick={() => setSelected(id)}
          >
            <BodyPortrait form={id} large />
            <span className="body-choice-kicker">
              {FORMS[id].branch === 'radial'
                ? 'RADIALLY SYMMETRIC'
                : 'BILATERALLY SYMMETRIC'}
            </span>
            <h3>{FORMS[id].name}</h3>
            <p>{FORMS[id].description}</p>
            <small>{FORMS[id].skillHint}</small>
            {id === 'radial' || id === 'bilateral' ? (
              <div className="branch-future">
                可选方向 → {FORMS[id === 'radial' ? 'jelly' : 'fish'].name}
              </div>
            ) : null}
          </button>
        ))}
      </div>
      <div className="body-tradeoff">
        <span>
          游速 <strong>{Math.round(stats.speed)}</strong>
        </span>
        <span>
          摄食范围 <strong>{stats.pickup}</strong>
        </span>
        <span>
          能量上限 <strong>{stats.maxEnergy}</strong>
        </span>
        <span>{f.movement}</span>
      </div>
      <div className="ocean-step-label">02 / 保留特征，或增加一项新结构</div>
      <div className="ocean-trait-grid">
        <button
          className={!trait ? 'selected' : ''}
          aria-pressed={!trait}
          onClick={() => setTrait(null)}
        >
          <strong>保留当前特征</strong>
          <span>身体形态可以改变，已有器官与遗产保留</span>
        </button>
        {TRAITS.filter((t) => !w.traits.includes(t.id)).map((t) => (
          <button
            key={t.id}
            className={trait === t.id ? 'selected' : ''}
            aria-pressed={trait === t.id}
            onClick={() => setTrait(t.id)}
          >
            <strong>{t.name}</strong>
            <span>{t.benefit}</span>
            <small>代价 · {t.cost}</small>
          </button>
        ))}
      </div>
      <button
        className="primary-button ocean-birth"
        onClick={() => {
          onChoose(selected, trait ?? undefined);
        }}
      >
        孕育第 {w.generation + 1} 代 · {f.name}
        <ArrowUpRight size={18} />
      </button>
      <p className="science-note">
        身体形态是游戏中的演化分支，并非真实物种的固定祖先链。真实演化发生在种群的许多代之间；水母型和鱼型各自适应不同的生存方式。
      </p>
    </div>
  );
}
export function EvolutionTree({ world: w }: { world: World }) {
  const reached = new Set([
    ...w.history.map((a) => a.form ?? 'microbe'),
    w.form,
  ]);
  return (
    <div className="evolution-tree">
      {w.land && (
        <div className="shore-lineage">
          <span>登陆身体 · {FORMS[w.land.checkpoint.form].short}</span>
          <i>→</i>
          <strong>{FORMS[w.form].short}</strong>
          <i>→</i>
          <span>
            {w.land.organ === 'crest'
              ? '共鸣冠'
              : w.land.organ === 'plates'
                ? '护肩骨板'
                : '巢穴与同行伙伴'}
          </span>
        </div>
      )}
      {w.shore && (
        <div className="shore-lineage">
          <span>海洋身体 · {FORMS[w.shore.checkpoint.form].short}</span>
          <i>→</i>
          <strong>
            {w.shore.tier === 0 ? '潮间带初探' : FORMS[w.form].short}
          </strong>
          <i>→</i>
          <span>
            {w.shore.protection === 'reservoir'
              ? '储水囊'
              : w.shore.protection === 'skin'
                ? '保湿皮膜'
                : '更长的离水活动'}
          </span>
        </div>
      )}

      <div className="tree-origin">
        <span className={reached.has('microbe') ? 'reached' : ''}>
          微生物 · 池塘
        </span>
        <i>↓</i>
        <span className={reached.has('colony') ? 'reached' : ''}>
          多细胞群体 · 海洋
        </span>
      </div>
      <div className="tree-branches">
        {(['radial', 'bilateral'] as const).map((first, i) => (
          <div className="tree-branch" key={first}>
            {([first, i === 0 ? 'jelly' : 'fish'] as BodyForm[]).map((id) => (
              <div
                key={id}
                className={`tree-node ${reached.has(id) ? 'reached' : ''} ${w.form === id ? 'current' : ''}`}
              >
                <BodyPortrait form={id} />
                <strong>{FORMS[id].name}</strong>
                <small>
                  {w.form === id
                    ? '当前形态'
                    : reached.has(id)
                      ? '已走过的形态'
                      : '未选择的可能'}
                </small>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="science-note">
        同一片海洋，不同的身体方案。
        {w.ocean?.checkpoint.standalone
          ? '本次从海洋开始，未生成池塘祖先。'
          : ''}{' '}
        图中连线表示游戏分支，不代表真实物种的亲缘关系。
      </p>
    </div>
  );
}
