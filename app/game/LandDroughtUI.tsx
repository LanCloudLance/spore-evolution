'use client';
import type { World } from './simulation';
import { DROUGHT_NAMES, droughtDry } from './land-drought';
import type { DroughtStrategy } from './land-drought';
export type DroughtCommand = 'start' | DroughtStrategy | 'track' | 'untrack';
export function LandDroughtUI({
  world: w,
  onAction,
}: {
  world: World;
  onAction: (action: DroughtCommand) => void;
}) {
  const s = w.land!,
    d = s.drought;
  const inactive = w.mode !== 'running' || !!s.morph;
  if (!s.tier || !s.nests.length) return null;
  if (!d)
    return (
      <section className="land-ecology-card" aria-label="林地生态事件">
        <small>林地正在变化</small>
        <button disabled={inactive} onClick={() => onAction('start')}>
          观察旱季预兆 <span>可选探索 ↗</span>
        </button>
      </section>
    );
  const paid = d.built || d.watered || d.stops > 0;
  const status =
    d.phase === 'resolved'
      ? '已找到生存办法'
      : d.elapsed < 12
        ? `${Math.ceil(12 - d.elapsed)}秒后旱风到来`
        : droughtDry(w)
          ? `旱风还持续${Math.ceil(72 - d.elapsed)}秒`
          : '雨后恢复';
  return (
    <section
      className={`land-ecology-card ${droughtDry(w) ? 'dry' : ''}`}
      aria-label="旱季生存"
    >
      <div className="land-ecology-heading">
        <strong>旱季</strong>
        <span>{status}</span>
      </div>
      {d.phase === 'resolved' ? (
        <details className="hud-details">
          <summary>{DROUGHT_NAMES[d.strategy!]} · 留给后代</summary>
          <p>
            {d.strategy === 'refuge'
              ? '3份储备带入族群；筑窝经验让每次暴雨修补多恢复10稳固度。'
              : d.strategy === 'grove'
                ? '4份储备与成熟种苗带入族群。'
                : '水源足迹带来更近的族群食场，方便伙伴采集。'}
          </p>
        </details>
      ) : (
        <>
          {!paid && (
            <div className="drought-choices" aria-label="旱季应对办法">
              {(['grove', 'refuge', 'migration'] as const).map((route) => (
                <button
                  key={route}
                  aria-pressed={d.strategy === route}
                  disabled={
                    inactive ||
                    (route === 'grove' && s.seedPod?.stage === 'eaten')
                  }
                  onClick={() => onAction(route)}
                >
                  {DROUGHT_NAMES[route]}
                  <small>
                    {route === 'grove'
                      ? s.seedPod?.stage === 'eaten'
                        ? '种荚已吃掉'
                        : '照料与补水'
                      : route === 'refuge'
                        ? '筑窝后往返采食'
                        : '沿两个水源远行'}
                  </small>
                </button>
              ))}
            </div>
          )}
          {paid && <small>{DROUGHT_NAMES[d.strategy!]} · 已投入材料</small>}
          <div className="drought-water">
            <span>湿润度</span>
            <strong>
              {Math.ceil(s.moisture)}/{s.protection === 'reservoir' ? 150 : 100}
            </strong>
          </div>
          <div className="drought-water-meter">
            <i
              style={{
                width: `${Math.min(100, (s.moisture / (s.protection === 'reservoir' ? 150 : 100)) * 100)}%`,
              }}
            />
          </div>
          <small>浅水退缩 · 东北泉眼常流</small>
          {d.strategy && (
            <button
              className="drought-tracking"
              disabled={inactive}
              onClick={() => onAction(d.tracking ? 'untrack' : 'track')}
            >
              {d.tracking ? '继续主线' : '追踪旱季'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
