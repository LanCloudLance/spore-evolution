'use client';
import { shoreSheltered } from './shore-shelter';
import { adaptationsOf } from './life-adaptations';
import { useState } from 'react';
import { Footprints, Droplets, ArrowUpRight } from 'lucide-react';
import type { World } from './simulation';
import { BodyPortrait } from './OceanUI';
import {
  SHORE_POOLS,
  SHORE_SHELL_BEDS,
  SHORE_MAP,
  wetAt,
  shoreStats,
  shoreEvolutionGate,
  shoreTarget,
  nearbyAlly,
  nearbyShellBed,
  shellBedReady,
  shoreTide,
  shoreFieldHint,
} from './shore';
import type { ShoreChoice } from './shore';
import { Progress } from '@/components/ui/progress';
const choices: Record<
  ShoreChoice,
  { name: string; description: string; benefit: string; cost: string }
> = {
  crawler: {
    name: '撑地足',
    description: '附肢把身体托离地面，交替迈步穿过沙洲。',
    benefit: '陆地移动更快，适合主动探索',
    cost: '水中移动变慢，离水失水较快',
  },
  skipper: {
    name: '湿润足垫',
    description: '宽阔的足垫贴住湿地，在水与陆地之间往返。',
    benefit: '失水更慢，水中仍然灵活',
    cost: '陆地速度较慢',
  },
  reservoir: {
    name: '储水囊',
    description: '身体储存更多水分，容许更长的一次离水探索。',
    benefit: '湿润度上限 100 → 150',
    cost: '完全补水需要更长时间',
  },
  skin: {
    name: '保湿皮膜',
    description: '覆盖身体的皮膜帮助减少水分散失。',
    benefit: '离水失水速度降低 48%',
    cost: '持续耗能 +25%，湿润度上限仍为 100',
  },
};
export function ShoreHUD({
  world: w,
  onLocate,
  onEvolve,
  onSkill,
  onInteract,
}: {
  world: World;
  onLocate: () => void;
  onEvolve: () => void;
  onSkill: () => void;
  onInteract: () => void;
}) {
  const s = w.shore!,
    stats = shoreStats(w),
    wet = wetAt(w, w.player),
    target = shoreTarget(w),
    need = s.tier === 0 ? 8 : s.tier === 1 ? 12 : 8,
    ally = nearbyAlly(w),
    bed = nearbyShellBed(w),
    forage = !!bed && shellBedReady(w, bed.id),
    tide = shoreTide(w),
    fieldHint = shoreFieldHint(w),
    canShelter =
      !wet &&
      s.tier > 0 &&
      w.food >= 3 &&
      !shoreSheltered(w) &&
      (s.shelters?.length ?? 0) < 3;
  return (
    <aside className="mission-panel glass-panel shore-mission">
      <div className="panel-eyebrow">
        潮间带 · 第一次登陆 <span>0{s.tier + 1} / 03</span>
      </div>
      <div className="primary-objective">
        <small>现在做什么</small>
        <h2>{target.label}</h2>
        <button onClick={onLocate}>◎ 跟随目标 · WASD 接管</button>
      </div>
      <div className={`shore-moisture ${s.moisture < 25 ? 'low' : ''}`}>
        <div>
          <span>
            <Droplets size={15} /> 身体湿润度
          </span>
          <strong>
            {Math.ceil(s.moisture)} <small>/ {stats.maxMoisture}</small>
          </strong>
        </div>
        <Progress
          value={(s.moisture / stats.maxMoisture) * 100}
          aria-label="身体湿润度"
          className="moisture-meter"
        />
        <p>
          {shoreSheltered(w)
            ? '庇护下失水减缓 · 仍需回潮池补水'
            : wet
              ? '正在水中恢复 · 停下来也可恢复能量'
              : `预计还能离水 ${Math.floor(s.moisture / stats.dryRate)} 秒 · 冲刺会更快失水`}
        </p>
      </div>
      <details className="hud-details shore-field-details">
        <summary>
          {tide.exposed
            ? '贝床已露出 · 查看潮汐'
            : `${tide.seconds} 秒后退潮 · 查看食场`}
        </summary>
        <div className="shore-tide">
          <span>当前潮位</span>
          <b>
            {Math.cos((w.time * Math.PI * 2) / 70) >= 0
              ? '涨潮 · 水边扩张'
              : '退潮 · 水边收缩'}
          </b>
        </div>
        <div className={`shore-field-note ${tide.exposed ? 'exposed' : ''}`}>
          <strong>
            {tide.exposed ? '退潮食场 · 贝床已露出' : '潮汐食场 · 贝床在水下'}
          </strong>
          <p>
            {tide.exposed
              ? `还有 ${tide.seconds} 秒淹没 · 靠近金色贝床按 K，获得 4 食物`
              : `${tide.seconds} 秒后露出 · 地图上的金色贝壳标记了食场`}
          </p>
          {bed && !forage && tide.exposed && (
            <p>附近贝床本轮已采食，下一次退潮会恢复。</p>
          )}
          {fieldHint && <output>{fieldHint}</output>}
        </div>
      </details>
      <div className="ocean-objectives">
        <div className={w.food >= need ? 'done' : ''}>
          <span>本代摄食</span>
          <strong>
            {Math.min(need, w.food)} / {need}
          </strong>
        </div>
        {s.tier < 2 && (
          <>
            <div
              className={
                s.discovered.includes(s.tier === 0 ? 'support' : 'moisture')
                  ? 'done'
                  : ''
              }
            >
              <span>
                {s.tier === 0 ? '观察撑地结构' : '观察或实践发现保湿'}
              </span>
              <strong>
                {s.discovered.includes(s.tier === 0 ? 'support' : 'moisture')
                  ? '✓'
                  : '待发现'}
              </strong>
            </div>
            {s.tier === 1 && (
              <div
                className={
                  s.visited.includes(SHORE_POOLS[2].name) ||
                  (s.fieldNotes?.safeReturns ?? 0) >= 2 ||
                  (s.fieldNotes?.shelterSeconds ?? 0) >= 6
                    ? 'done'
                    : ''
                }
              >
                <span>远行 / 水陆往返 / 庇护实验</span>
                <strong>
                  {s.visited.includes(SHORE_POOLS[2].name) ||
                  (s.fieldNotes?.safeReturns ?? 0) >= 2 ||
                  (s.fieldNotes?.shelterSeconds ?? 0) >= 6
                    ? '✓'
                    : '任选一种'}
                </strong>
              </div>
            )}
            <button
              className={`evolve-button ${!shoreEvolutionGate(w) ? 'available' : ''}`}
              onClick={onEvolve}
            >
              <Footprints size={16} />
              孕育适合岸上的身体 <kbd>O</kbd>
            </button>
          </>
        )}
      </div>
      <p className="shore-adaptation-history">
        已继承：
        {adaptationsOf(s)
          .map((a) => choices[a].name)
          .join(' + ') || '海洋身体'}
      </p>
      {s.tier === 2 && (
        <button className="evolve-button" onClick={onEvolve}>
          回潮池调整下一代 · 附肢与保湿 <kbd>O</kbd>
        </button>
      )}
      <details className="hud-details shore-map-details">
        <summary>地图 · 说明 · 同行伙伴</summary>
        <p>
          {s.tier === 0
            ? '身体仍然习惯海洋。沿潮池观察撑地生物，为下一代找到新走法。'
            : s.tier === 1
              ? '试试新附肢。观察保湿生物，或离水探索后回潮池，寻找更持久的走法。'
              : '沿潮池穿过最后的沙洲，在蕨林水洼建立新的栖息地。'}
        </p>
        <div className="shore-map" aria-label="五座潮池从西南延伸到东北">
          <svg viewBox="0 0 300 190" aria-hidden="true">
            <path
              d="M46 144 L106 117 L160 85 L215 108 L274 48"
              fill="none"
              stroke="#bcd9bd55"
              strokeDasharray="4 5"
            />
            {SHORE_SHELL_BEDS.map((bed) => (
              <path
                key={bed.id}
                d={`M${bed.x / 10 - 3} ${bed.y / 10} a3 3 0 0 1 6 0 l-3 3z`}
                fill={shellBedReady(w, bed.id) ? '#ffe09b' : '#a5bcb4'}
              />
            ))}
          </svg>
          {SHORE_POOLS.map((pool, i) => (
            <span
              key={pool.name}
              className={s.visited.includes(pool.name) ? 'reached' : ''}
              style={{
                left: `${(pool.x / SHORE_MAP.width) * 100}%`,
                top: `${(pool.y / SHORE_MAP.height) * 100}%`,
              }}
              title={pool.name}
            >
              <i />
              {['登陆', '浅湾', '蕨影', '沙洲', '栖息地'][i]}
            </span>
          ))}
          <b
            style={{
              left: `${(w.player.x / SHORE_MAP.width) * 100}%`,
              top: `${(w.player.y / SHORE_MAP.height) * 100}%`,
            }}
          />
        </div>
        <div className="shore-target">↗ {target.label}</div>
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
              {s.tier === 0 ? '摆体挣脱' : '撑地跃进'}
              <small>
                {s.skillCooldown > 0
                  ? `${Math.ceil(s.skillCooldown)} 秒后恢复`
                  : '12 能量 · 驱离近身威胁'}
              </small>
            </span>
          </button>
          <button
            onClick={onInteract}
            disabled={
              (!forage && (!ally || w.food < 2) && !canShelter) ||
              w.mode !== 'running' ||
              !!s.morph
            }
          >
            <kbd>K</kbd>
            <span>
              {forage ? '采食潮汐贝床' : ally ? '分享食物结伴' : '搭起贝叶庇护'}
              <small>
                {forage
                  ? '获得 4 食物 · 本轮仅一次'
                  : ally
                    ? '分享 2 食物，邀请同类'
                    : canShelter
                      ? '3 营养 · 减少失水，留下保湿线索'
                      : '在干燥陆地搭建 · 需要 3 营养'}
              </small>
            </span>
          </button>
        </div>
        <div className="shore-companions">
          同行伙伴 {s.creatures.filter((c) => c.joined).length} · 陆地{' '}
          {Math.round(stats.landSpeed)} / 水中 {Math.round(stats.waterSpeed)}
        </div>
        <BodyPortrait
          form={w.form}
          traits={w.traits}
          body={s.body}
          adaptation={s.protection ?? undefined}
        />
      </details>
    </aside>
  );
}
export function ShoreEvolution({
  world: w,
  onChoose,
}: {
  world: World;
  onChoose: (choice: ShoreChoice) => void;
}) {
  const s = w.shore!,
    options: ShoreChoice[] =
      s.tier === 0
        ? ['crawler', 'skipper']
        : s.tier === 1
          ? ['reservoir', 'skin']
          : ['crawler', 'skipper', 'reservoir', 'skin'];
  const [selected, setSelected] = useState<ShoreChoice>(options[0]);
  return (
    <div className="shore-evolution">
      <div className="shore-discovery">
        <Footprints size={21} />
        <p>
          {s.tier === 0
            ? '你观察到附肢可以撑住身体。下一代要怎样走上岸？'
            : '附肢与保湿可以继续演变；储水囊和皮膜可逐代组合。原有海洋器官保留。'}
        </p>
      </div>
      <div className="body-choice-grid">
        {options.map((id) => (
          <button
            key={id}
            className={`body-choice ${id === selected ? 'selected' : ''}`}
            aria-pressed={id === selected}
            onClick={() => setSelected(id)}
          >
            <BodyPortrait
              form={id === 'crawler' || id === 'skipper' ? id : w.form}
              traits={w.traits}
              adaptation={
                id === 'reservoir' || id === 'skin'
                  ? id
                  : (s.protection ?? undefined)
              }
              body={s.body}
              large
            />
            <h3>{choices[id].name}</h3>
            <p>{choices[id].description}</p>
            <strong className="shore-benefit">{choices[id].benefit}</strong>
            <small>取舍 · {choices[id].cost}</small>
          </button>
        ))}
      </div>
      <button
        className="primary-button ocean-birth"
        onClick={() => onChoose(selected)}
      >
        孕育第 {w.generation + 1} 代 · {choices[selected].name}
        <ArrowUpRight size={18} />
      </button>
      <p className="science-note">
        这是一段虚构的适应实验，保留你的海洋身体特征。现实中的登陆演化发生在种群的许多代之间，图中的形态选择不代表真实物种的祖先链。
      </p>
    </div>
  );
}
