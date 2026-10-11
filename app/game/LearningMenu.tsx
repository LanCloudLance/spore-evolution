'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DISCOVERIES, LEARNED_SKILLS, knowsSkill } from './lineage-learning';
import type {
  LearnedSkill,
  LearningBearer,
  LifeStage,
} from './lineage-learning';
export function LearningMenu({
  state,
  stage,
  onSelect,
  onMode,
  onUse,
  actionGate,
}: {
  state: LearningBearer;
  stage: LifeStage;
  onSelect: (id: LearnedSkill | null) => void;
  onMode: (mode: 'running' | 'paused') => void;
  onUse?: () => void;
  actionGate?: string | null;
}) {
  const [open, setOpen] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    wasPlaying = useRef(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  function close() {
    dialog.current?.close();
    setOpen(false);
    if (wasPlaying.current) onMode('running');
    wasPlaying.current = false;
  }
  const [resumeAfterMenu, setResumeAfterMenu] = useState(false);
  const l = state.learning,
    equipped = l?.equipped,
    current = equipped ? LEARNED_SKILLS[equipped] : null;
  const biological = ['pond', 'ocean', 'shore', 'land'].includes(stage);
  return (
    <>
      {!biological && (
        <button
          className="learning-toggle"
          onClick={() => {
            wasPlaying.current = state.mode === 'running';
            setResumeAfterMenu(state.mode === 'running');
            if (wasPlaying.current) onMode('paused');
            setOpen(true);
          }}
        >
          DNA / 技艺{l?.entries.length ? ` · ${l.entries.length}` : ''}
        </button>
      )}
      {current?.active && current.stages.includes(stage) && onUse && (
        <button
          className="learned-action"
          disabled={
            !!actionGate || state.mode !== 'running' || (l?.cooldown ?? 0) > 0
          }
          onClick={onUse}
          title={actionGate ?? current.effect}
        >
          {current.name}{' '}
          {(l?.cooldown ?? 0) > 0
            ? `${Math.ceil(l!.cooldown)}秒`
            : actionGate?.includes('12 能量')
              ? '能量不足'
              : 'U'}
        </button>
      )}
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="learning-dialog"
            aria-label="生命能力图谱"
            onKeyDownCapture={(e) => e.stopPropagation()}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
          >
            <button
              className="learning-close"
              onClick={close}
              aria-label="关闭能力图谱"
            >
              ×
            </button>
            <h2>生命学会的新办法</h2>
            <p>
              研习点 {l?.credits ?? 0} · 首次学会消耗1点，之后可免费换装 ·
              一次装备一种
            </p>
            <div className="learning-cards">
              {(
                Object.entries(LEARNED_SKILLS) as [
                  LearnedSkill,
                  (typeof LEARNED_SKILLS)[LearnedSkill],
                ][]
              )
                .filter(
                  ([id, d]) =>
                    d.stages.includes(stage) || knowsSkill(state, id),
                )
                .map(([id, d]) => {
                  const entry = l?.entries.find(
                      (e) => DISCOVERIES[e.source].skill === id,
                    ),
                    discovered = !!entry,
                    applicable = d.stages.includes(stage),
                    learned = l?.learned.includes(id);
                  const source = entry
                    ? DISCOVERIES[entry.source]
                    : Object.values(DISCOVERIES).find(
                        (s) => s.skill === id && s.stage === stage,
                      );
                  return (
                    <article
                      key={id}
                      className={
                        equipped === id && applicable ? 'equipped' : ''
                      }
                    >
                      <h3>
                        {d.name}
                        <small>
                          {equipped === id && applicable
                            ? '正在装备'
                            : discovered
                              ? '已发现'
                              : '待发现'}
                        </small>
                      </h3>
                      <p>{d.effect}</p>
                      <small>
                        {entry
                          ? `第${entry.generation}代 · ${source?.name}`
                          : `来源 · ${source?.name ?? '后续旅程'}`}
                      </small>
                      {applicable ? (
                        <button
                          disabled={
                            !discovered ||
                            equipped === id ||
                            (l?.active ?? 0) > 0 ||
                            (!learned && (l?.credits ?? 0) < 1)
                          }
                          onClick={() => onSelect(id)}
                        >
                          {equipped === id
                            ? '已装备'
                            : learned
                              ? '装备'
                              : discovered
                                ? '学习并装备 · 1点'
                                : '先完成来源互动'}
                        </button>
                      ) : (
                        <small>已遗传 · 在对应生命阶段使用</small>
                      )}
                    </article>
                  );
                })}
            </div>
            {(l?.active ?? 0) > 0 && (
              <p>能力正在发挥作用，关闭图谱后等待它结束，再更换装备。</p>
            )}
            <button
              className="secondary-button"
              disabled={!equipped || (l?.active ?? 0) > 0}
              onClick={() => onSelect(null)}
            >
              不装备能力
            </button>
            <p className="science-note">
              DNA吸收是本游戏的幻想设定；进入社会后，技艺通过实践和学习获得。
            </p>
            <button className="primary-button" onClick={close}>
              返回世界{resumeAfterMenu ? ' · 继续探索' : ''}
            </button>
          </dialog>,
          document.body,
        )}
    </>
  );
}
