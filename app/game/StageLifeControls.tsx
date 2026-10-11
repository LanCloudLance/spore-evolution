'use client';
import type { StageLife } from './stage-life';
export function StageLifeControls({
  state,
  stayLabel,
  onStay,
  onReview,
}: {
  state: StageLife;
  stayLabel: string;
  onStay: () => void;
  onReview: () => void;
}) {
  if (state.mode === 'won')
    return (
      <button className="secondary-button stage-life-button" onClick={onStay}>
        {stayLabel}
      </button>
    );
  if (state.freeLife && ['running', 'paused'].includes(state.mode))
    return (
      <button
        className="stage-life-button"
        title="自选出发，打开已达成的阶段入口"
        onClick={onReview}
      >
        出发选择 ↗
      </button>
    );
  return null;
}
