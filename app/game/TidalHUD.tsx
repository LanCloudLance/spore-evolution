import { TIDAL_SPECIES } from './tidal/catalog';
import type { World } from './simulation';
import { tidalGuidance } from './tidal/migration';
import type { TidalAction } from './tidal/types';
import { tidalActionGate } from './tidal/abilities';
import { FORMS } from './forms';
export const TIDAL_ACTION_LABELS: Record<TidalAction, string> = {
  'form-skill': '身体能力',
  filter: '滤食',
  shell: '缩壳',
  grasp: '抓取 / 投送',
  reserve: '释放储能',
  ink: '释放墨云',
  anchor: '锚定 / 收回',
};
function actionHint(world: World, action: TidalAction | null) {
  if (!action) return 'O 配置能力';
  const gate = tidalActionGate(world, action);
  if (!gate) return action === 'form-skill' ? '14 能量' : '点击使用';
  const seconds = gate.match(/(\d+) 秒/);
  if (seconds)
    return `${gate.startsWith('缩壳') ? '缩壳中' : '恢复'} ${seconds[1]}秒`;
  const energy = gate.match(/需要 (\d+) 能量/);
  if (energy) return `需 ${energy[1]} 能量`;
  if (gate.includes('没有储能')) return '储能为空';
  if (gate.includes('能量已满')) return '能量已满';
  if (gate.includes('可搬运')) return '靠近食物';
  return '暂不可用';
}
export function TidalHUD({
  world,
  onSkill,
  onCommand,
  onInteract,
  onEvolve,
  onJournal,
  onLocate,
}: {
  world: World;
  onSkill: () => void;
  onCommand: () => void;
  onInteract: () => void;
  onEvolve: () => void;
  onJournal: () => void;
  onLocate: () => void;
}) {
  const t = world.ocean!.tidal!,
    a = t.abilities,
    goal = tidalGuidance(world);
  const seconds = Math.floor(t.tick / 120),
    phase = seconds % 90,
    tide =
      seconds >= 90 && phase < 30
        ? `大潮还剩 ${30 - phase} 秒`
        : `下一次大潮 ${90 - phase} 秒`;
  return (
    <aside className="tidal-hud glass-panel" aria-label="潮海旅程">
      <button
        className="tidal-goal"
        onClick={onLocate}
        disabled={world.mode !== 'running'}
      >
        <span>潮海群岛 · 第 {world.generation} 代</span>
        <strong>{goal?.label ?? '探索生命的海洋'}</strong>
        <small>
          点这里跟随目标 · WASD 接管 · 营养 {world.food} · 生长{' '}
          {world.ocean!.dna}
        </small>
      </button>
      {world.ocean!.tier === 2 && <small>{tide} · 河口按 K 借势</small>}
      <div className="tidal-actions">
        <button
          onClick={onSkill}
          disabled={!!tidalActionGate(world, a.slots[0])}
          title={tidalActionGate(world, a.slots[0]) ?? '按 J 或点击使用'}
        >
          <kbd>J</kbd>
          <span>
            {a.slots[0] === 'form-skill'
              ? FORMS[world.form].skill
              : a.slots[0]
                ? TIDAL_ACTION_LABELS[a.slots[0]]
                : '空能力位'}
            {a.slots[0] === 'filter' && a.filterOpen ? ' · 开' : ''}
            <small>{actionHint(world, a.slots[0])}</small>
          </span>
        </button>
        <button
          onClick={onCommand}
          disabled={!!tidalActionGate(world, a.slots[1])}
          title={tidalActionGate(world, a.slots[1]) ?? '按 L 或点击使用'}
        >
          <kbd>L</kbd>
          <span>
            {a.slots[1] === 'form-skill'
              ? FORMS[world.form].skill
              : a.slots[1]
                ? TIDAL_ACTION_LABELS[a.slots[1]]
                : '空能力位'}
            {a.slots[1] === 'filter' && a.filterOpen ? ' · 开' : ''}
            <small>{actionHint(world, a.slots[1])}</small>
          </span>
        </button>
        <button onClick={onInteract} disabled={world.mode !== 'running'}>
          <kbd>K</kbd>
          {world.ocean!.tier === 2 ? '互动 / 育生点' : '分享 1 营养'}
        </button>
      </div>
      <div className="tidal-tools">
        <button onClick={onEvolve} disabled={world.mode !== 'running'}>
          O 孕育
        </button>
        <button onClick={onJournal}>
          图鉴 {t.journal.seen.length}/{TIDAL_SPECIES.length}
        </button>
      </div>
    </aside>
  );
}
