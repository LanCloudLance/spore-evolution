'use client';
import { LAND_FEATURES } from './land-catalog';
import { activeLandFeature, landFeatureGate } from './land-features';
import { EvolutionStudio } from './EvolutionStudio';
import { LandDroughtUI } from './LandDroughtUI';
import type { DroughtCommand } from './LandDroughtUI';
import type { BodyDesign } from './body-design';
import { huntingStats, inLandCover } from './land-hunt';
import { useState } from 'react';
import { ArrowUpRight, Footprints } from 'lucide-react';
import type { World } from './simulation';
import { BodyPortrait } from './OceanUI';
import {
  LAND_AREAS,
  LAND_MAP,
  LAND_NESTS,
  landEvolutionGate,
  landFriends,
  landInteraction,
  landStats,
  landTarget,
  seedActionGate,
  LAND_SEED,
  seedPlot,
  landSettlementWays,
  LAND_WAY_NAMES,
} from './land';
import type { LandChoice, LandFocus } from './land';
const choices: Record<
  LandChoice,
  { name: string; description: string; benefit: string; cost: string }
> = {
  strider: {
    name: '长足巡行兽',
    description: '长足把躯干抬高，轻巧地跨过落叶。头部的呼唤让邻居注意到你。',
    benefit: '移动更快 · J 呼唤增加信任、驱离猎手',
    cost: '不能扑猎，需要靠果实补充食物',
  },
  stalker: {
    name: '伏地扑猎兽',
    description: '低伏的躯干、强壮后肢与长尾，让身体像弹簧一样向前扑出。',
    benefit: 'Shift 潜行 · J 实际扑击 · 吃下猎物后成长',
    cost: '持续耗能更高；扑击不能转向，猎物会察觉并逃跑',
  },
  crest: {
    name: '共鸣冠',
    description: '头部长出一片共鸣结构，更少的食物就能与邻居熟悉起来。',
    benefit: '分享成本 2 → 1 · 长足呼唤范围 220 → 300',
    cost: '不提高防御，遇到猎手仍需保持距离',
  },
  plates: {
    name: '护肩骨板',
    description: '躯干两侧形成重叠的保护骨板，保护容易受到攻击的部位。',
    benefit: '接触伤害降低 40% · 与原有防御叠加',
    cost: '移动速度降低 12%',
  },
};
export function LandHUD({
  world: w,
  onLocate,
  onEvolve,
  onSkill,
  onInteract,
  onCommand,
  onFeature,
  onSeed,
  onDrought,
  onFocus,
  onSettlement,
}: {
  world: World;
  onLocate: () => void;
  onEvolve: () => void;
  onSkill: () => void;
  onInteract: () => void;
  onCommand: () => void;
  onFeature: () => void;
  onSeed: (action: 'eat' | 'plant' | 'water') => void;
  onDrought: (action: DroughtCommand) => void;
  onFocus: (focus: LandFocus, destination?: number) => void;
  onSettlement: () => void;
}) {
  const s = w.land!,
    target = landTarget(w),
    interaction = landInteraction(w),
    friends = landFriends(w),
    st = landStats(w);
  const phase = !s.nests.length ? 1 : !s.tier ? 2 : 3;
  return (
    <aside className="mission-panel glass-panel shore-mission land-mission">
      <div className="panel-eyebrow">
        古蕨林 · 陆地生物 <span>0{phase} / 03</span>
      </div>
      <h2>
        {phase === 1
          ? '从一个巢穴开始'
          : phase === 2
            ? '生长出新的可能'
            : '在林地找到位置'}
      </h2>
      <details className="hud-details">
        <summary>本章说明</summary>
        <p>
          {phase === 1
            ? '果实是能量，也是筑巢的储备。先在树根下建一个可以回来的家。'
            : phase === 2
              ? '到蕨叶聚落观察邻居，带食物回巢，让下一代拥有真正适合陆地的身体。'
              : w.form === 'strider'
                ? '可结伴、种植、探索水源或捕猎。找到生存办法后，带12食物建立新家；也可以一直留在林地。'
                : '先捕食小型蕨尾兽，吃下猎物变强，再挑战果角兽。猎手可能抢食，进退时留意领地。'}
        </p>
        {w.tidalLegacy && (
          <p>
            滤食、缩壳、抓握和释放储能是水中动作；陆地保留身体结构与纹样，靠新的足与器官活动。
          </p>
        )}
      </details>
      <div className="shore-target land-next-step">
        <small>现在做什么</small>
        <strong>{target.label}</strong>
        <button className="locate-button" onClick={onLocate}>
          ◎ 跟随目标 · WASD 接管
        </button>
      </div>
      {s.tier > 0 && (
        <details className="land-life-choices hud-details">
          <summary>这次想做什么 · 随时可以改变</summary>
          <div className="land-focus-choices">
            {(
              [
                ['wander', '自由探索'],
                ['companions', '结伴同行'],
                ['hunt', '伏击捕猎'],
                ['garden', '经营果丛'],
                ['settle', '寻找新家'],
              ] as const
            ).map(([focus, name]) => (
              <button
                key={focus}
                aria-pressed={s.focus === focus}
                disabled={
                  w.mode !== 'running' ||
                  !!s.morph ||
                  (focus === 'hunt' && w.form !== 'stalker') ||
                  (focus === 'garden' && s.seedPod?.stage === 'eaten')
                }
                onClick={() => onFocus(focus)}
              >
                {name}
                {focus === 'hunt' && w.form !== 'stalker'
                  ? ' · 需低伏身体'
                  : ''}
              </button>
            ))}
          </div>
          <div className="land-destinations">
            {LAND_AREAS.map((area, i) => (
              <button
                key={area.name}
                disabled={w.mode !== 'running' || !!s.morph}
                onClick={() => onFocus('wander', i)}
              >
                {s.visited.includes(area.name) ? '✓ ' : '◇ '}
                {area.name}
              </button>
            ))}
          </div>
          <small>方向标记供你参考；食源、伙伴和巢穴会保留。</small>
        </details>
      )}
      {s.nests.includes(2) && (
        <button
          className="land-settlement-entry"
          disabled={w.mode !== 'running' || !!s.morph}
          onClick={onSettlement}
        >
          家园已建立 · 开始族群生活 ↗
        </button>
      )}
      <LandDroughtUI world={w} onAction={onDrought} />
      {s.seedPod && s.seedPod.stage !== 'unseen' && (
        <section className="land-discovery" aria-label="月露荚发现">
          <strong>✧ 月露荚 · 稀有发现</strong>
          {s.seedPod.stage === 'seen' && (
            <p>蕨影驿巢以东有一枚发光种荚。靠近按 K 拾取，再决定它的用途。</p>
          )}
          {s.seedPod.stage === 'carried' && (
            <>
              <p>
                吃下立即获得6食物；种植需2食物，再浇灌3次。成熟果丛能再生，也能把种苗带入族群。
              </p>
              <button
                onClick={() => onSeed('eat')}
                disabled={!!seedActionGate(w, 'eat')}
              >
                吃下月露荚 · +6 食物
              </button>
              <button
                onClick={() => onSeed('plant')}
                disabled={!!seedActionGate(w, 'plant')}
              >
                在巢旁种下 · 2 食物
              </button>
              {seedActionGate(w, 'plant') && (
                <small>{seedActionGate(w, 'plant')}</small>
              )}
            </>
          )}
          {s.seedPod.stage === 'eaten' && (
            <p>已作为旅途补给 · 这枚种荚不能再种植。</p>
          )}
          {s.seedPod.stage === 'planted' && (
            <>
              <p>
                {LAND_NESTS[s.seedPod.nest ?? 0].name} ·{' '}
                {s.seedPod.waters === 3
                  ? '果丛成熟，4处果实约16秒再生。成熟种苗将随你进入族群。'
                  : `浇灌 ${s.seedPod.waters}/3 · 每次付出15湿润度；需靠近幼苗。`}
              </p>
              {s.seedPod.waters < 3 && (
                <>
                  <button
                    onClick={() => onSeed('water')}
                    disabled={!!seedActionGate(w, 'water')}
                  >
                    浇灌幼苗 · 15 湿润度
                  </button>
                  {seedActionGate(w, 'water') && (
                    <small>{seedActionGate(w, 'water')}</small>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}
      {w.form === 'stalker' && (
        <div className="hunt-status">
          <strong>
            {huntingStats(w).name} · 扑击 {huntingStats(w).damage}
          </strong>
          <span>
            {s.sneaking
              ? inLandCover(w.player)
                ? '蕨丛隐蔽 · 很难被发现'
                : '伏低潜行 · 更慢、更安静'
              : '按住 Shift 伏低，靠近后瞄准按 J'}
          </span>
          <small>
            吃下猎物 {Math.min(s.nutrition, huntingStats(w).next)}/
            {huntingStats(w).next} ·{' '}
            {huntingStats(w).level < 2
              ? '成长会提升体型和扑击力量'
              : '可以挑战岩背猎手'}{' '}
            · 被抢食 {s.stolen}
          </small>
        </div>
      )}
      <div className="land-stores">
        <div>
          <strong>{w.food}</strong>
          <span>随身食物</span>
        </div>
        <div>
          <strong>{friends}</strong>
          <span>同行伙伴</span>
        </div>
        <div>
          <strong>{s.hunts}</strong>
          <span>成功捕猎</span>
        </div>
      </div>
      <details className="land-milestones">
        <summary>章节进度 · 地图与伙伴</summary>
        <div className="ocean-objectives">
          <div className={s.nests.length ? 'done' : ''}>
            <span>树根巢穴 · 6 食物</span>
            <strong>{s.nests.length ? '✓' : 'K 建立'}</strong>
          </div>
          <div className={s.tier ? 'done' : ''}>
            <span>观察后回巢孕育新身体</span>
            <strong>{s.tier ? '✓' : `${s.discovered.length ? 1 : 0}/1`}</strong>
          </div>
          <div className={s.visited.length >= 2 ? 'done' : ''}>
            <span>蕨叶聚落 / 日光果甸</span>
            <strong>{s.visited.length} / 6 · 定居需要 2</strong>
          </div>
          <div className={landSettlementWays(w).length ? 'done' : ''}>
            <span>
              {landSettlementWays(w)
                .map((way) => LAND_WAY_NAMES[way])
                .join('、') || '结伴 / 捕猎 / 果丛 / 水源迁移'}
            </span>
            <strong>
              {landSettlementWays(w).length
                ? '✓'
                : w.form === 'strider'
                  ? `${friends}/2`
                  : '任选'}
            </strong>
          </div>
          <div className={w.food >= 12 ? 'done' : ''}>
            <span>溪畔新家储备</span>
            <strong>{Math.min(12, w.food)}/12</strong>
          </div>
        </div>
        <div
          className="shore-map land-map"
          aria-label="陆地地图：树根巢、蕨叶聚落、日光果甸和溪畔新家"
        >
          <svg viewBox="0 0 290 195" aria-hidden="true">
            <path
              d="M45 145 L106 62 L130 93 L201 132 L247 50"
              stroke="#cbdd9960"
              strokeDasharray="4 5"
              fill="none"
            />
            {(s.seedPod?.stage === 'seen' || seedPlot(w)) && (
              <circle
                cx={(seedPlot(w) ?? LAND_SEED).x / 10}
                cy={(seedPlot(w) ?? LAND_SEED).y / 10}
                r="3"
                fill={s.seedPod?.stage === 'seen' ? '#f1dbac' : '#accda8'}
              />
            )}
          </svg>
          {[...LAND_NESTS, ...LAND_AREAS].map((n, i) => (
            <span
              key={n.name}
              className={
                (i < 3 ? s.nests.includes(i) : s.visited.includes(n.name))
                  ? 'reached'
                  : ''
              }
              style={{
                left: `${(n.x / LAND_MAP.width) * 100}%`,
                top: `${(n.y / LAND_MAP.height) * 100}%`,
              }}
            >
              <i />
              {n.name}
            </span>
          ))}
          <b
            style={{
              left: `${(w.player.x / LAND_MAP.width) * 100}%`,
              top: `${(w.player.y / LAND_MAP.height) * 100}%`,
            }}
          />
        </div>
      </details>
      <div className="shore-actions">
        <button
          onClick={onSkill}
          disabled={
            w.mode !== 'running' ||
            !!s.morph ||
            s.skillCooldown > 0 ||
            w.player.energy < 12
          }
        >
          <kbd>J</kbd>
          <span>
            {w.form === 'strider'
              ? '友善呼唤'
              : w.form === 'stalker'
                ? '蓄力扑猎'
                : '近身啃咬'}
            <small>
              {s.skillCooldown > 0
                ? `${Math.ceil(s.skillCooldown)} 秒后恢复`
                : w.form === 'strider'
                  ? '12 能量 · 靠近邻居，信任达到 3 即同行'
                  : '12 能量 · 固定方向扑出，接触才命中'}
            </small>
          </span>
        </button>
        <button
          onClick={onInteract}
          disabled={w.mode !== 'running' || !!s.morph}
        >
          <kbd>K</kbd>
          <span>
            {interaction.label}
            <small>{interaction.hint}</small>
          </span>
        </button>
      </div>
      {s.activeFeature &&
        (activeLandFeature(s.activeFeature) ? (
          <button
            className="companion-command"
            onClick={onFeature}
            disabled={!!landFeatureGate(w)}
          >
            <kbd>I</kbd> {LAND_FEATURES[s.activeFeature].name}
            <small>
              {landFeatureGate(w) ?? LAND_FEATURES[s.activeFeature].action}
            </small>
          </button>
        ) : (
          <p className="field-note">
            {LAND_FEATURES[s.activeFeature].name} ·{' '}
            {LAND_FEATURES[s.activeFeature].action}
          </p>
        ))}
      {friends > 0 && (
        <button
          className="companion-command"
          onClick={onCommand}
          disabled={w.mode !== 'running' || !!s.morph}
        >
          <kbd>L</kbd>{' '}
          {s.creatures.some((c) => c.joined && c.task !== 'follow')
            ? '召回伙伴'
            : '请伙伴寻找果实'}
          <small>找到后会叼回身边 · 再按可召回</small>
        </button>
      )}
      {
        <button
          className={`evolve-button ${!landEvolutionGate(w) ? 'available' : ''}`}
          onClick={onEvolve}
        >
          <Footprints size={16} />
          {s.tier ? '孕育与调整下一代' : '孕育陆地新身体'} <kbd>O</kbd>
        </button>
      }
      <div className="shore-companions">
        湿润 {Math.ceil(s.moisture)}/{st.maxMoisture} ·{' '}
        {s.organ ? choices[s.organ].name : '继承登陆适应'} · 巢穴内可休息
      </div>
    </aside>
  );
}
export function LandEvolution({
  world: w,
  onChoose,
}: {
  world: World;
  onChoose: (choice: LandChoice, body: BodyDesign) => void;
}) {
  const s = w.land!,
    options: LandChoice[] =
      s.tier === 0
        ? ['strider', 'stalker']
        : [
            w.form === 'stalker' ? 'stalker' : 'strider',
            w.form === 'stalker' ? 'strider' : 'stalker',
            ...(s.discovered.length >= 2 ? (['crest', 'plates'] as const) : []),
          ];
  const [selected, setSelected] = useState<LandChoice>(options[0]);
  const [draft, setDraft] = useState(() => structuredClone(s.body));
  return (
    <div className="shore-evolution">
      <div className="shore-discovery">
        <Footprints size={22} />
        <p>
          {s.tier === 0
            ? '同一片林地，有不同的生存办法。新的附肢、躯干和头部会一起改变。'
            : '后代可以延续并塑形，也可以改变行动方式；已有器官与家园保留。观察第二种邻居还能发现新器官。'}
        </p>
      </div>
      <div className="body-choice-grid">
        {options.map((id) => (
          <button
            key={id}
            className={`body-choice ${selected === id ? 'selected' : ''}`}
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
          >
            <BodyPortrait
              form={id === 'strider' || id === 'stalker' ? id : w.form}
              adaptation={s.protection ?? undefined}
              body={s.body}
              traits={w.traits}
              landOrgan={
                id === 'crest' || id === 'plates' ? id : (s.organ ?? undefined)
              }
              large
            />
            <h3>
              {s.tier > 0 && id === w.form
                ? `延续${choices[id].name}`
                : choices[id].name}
            </h3>
            <p>{choices[id].description}</p>
            <strong className="shore-benefit">{choices[id].benefit}</strong>
            <small>取舍 · {choices[id].cost}</small>
          </button>
        ))}
      </div>
      <EvolutionStudio
        world={w}
        choice={selected}
        body={draft}
        onChange={setDraft}
      />
      <button
        className="primary-button ocean-birth"
        onClick={() => onChoose(selected, draft)}
      >
        10 食物 · 孕育第 {w.generation + 1} 代 <ArrowUpRight size={18} />
      </button>
      <p className="science-note">
        这是虚构的多代适应实验。长足和扑猎各有用途；觅食、身体成长与种群演化并不是同一件事。
      </p>
    </div>
  );
}
