'use client';
import { BiologicalReview } from './BiologicalReview';
import { ControlsHelp } from './ControlsHelp';
import { AudioVolumes } from './AudioVolumes';
import { gameKey, keyHints, blocksGameInput } from './dash-input';
import type { BiologicalRecord } from './biological-finale';
import { StageLifeControls } from './StageLifeControls';
import { continueStageLife, reviewStageLife } from './stage-life';
import { LearningMenu } from './LearningMenu';
import { selectLearnedSkill } from './lineage-learning';
import { useEffect, useRef, useState, useCallback } from 'react';
import { GameAudio } from './audio';
import { FORMS } from './forms';
import type { ColonyState } from './colony';
import {
  colonyGoal,
  colonyJourneyTarget,
  stepColony,
  setColonyRole,
  startColonyStorm,
  ROLE_NAMES,
  colonyMemberTraits,
  colonyInteraction,
  colonyGuards,
} from './colony';
import { renderColony, colonyView } from './colony-render';
import { colonySnapshot, colonyCues } from './colony-feedback';
import type { ColonyCue } from './colony-feedback';
export function ColonyGame({
  checkpoint,
  current,
  onExit,
  onProgress,
  saveStatus,
  onSave,
  onTribe,
  hasTribe,
  readCurrent,
  onFinishBiological,
  onBranch,
}: {
  checkpoint: ColonyState;
  current?: ColonyState;
  onExit: (current: ColonyState) => void;
  onProgress?: (current: ColonyState) => void;
  saveStatus?: string;
  onSave?: () => void;
  onTribe?: (s: ColonyState) => void;
  hasTribe?: boolean;
  readCurrent?: () => ColonyState | undefined;
  onFinishBiological?: (s: ColonyState) => BiologicalRecord | null;
  onBranch?: (id: number, generation: number) => void;
}) {
  const [initial] = useState(() => structuredClone(checkpoint));
  const [entry] = useState(() =>
    structuredClone(readCurrent?.() ?? current ?? initial),
  );
  const live = useRef(structuredClone(entry));
  const [s, setS] = useState(entry);
  const canvas = useRef<HTMLCanvasElement>(null),
    keys = useRef(new Set<string>()),
    pointer = useRef<{ x: number; y: number } | null>(null),
    audio = useRef<GameAudio | null>(null);
  const [muted, setMuted] = useState(true);
  const [reviewHome, setReviewHome] = useState(false);
  const [biologicalReview, setBiologicalReview] =
    useState<BiologicalRecord | null>(null);
  const mutePreference = useRef(true);
  const [soundOK, setSoundOK] = useState(true);
  const publish = useCallback(() => {
    setS(structuredClone(live.current));
    onProgress?.(live.current);
  }, [onProgress]);
  const togglePause = useCallback(() => {
    const w = live.current;
    if (w.mode === 'running') w.mode = 'paused';
    else if (w.mode === 'paused') {
      w.mode = 'running';
      audio.current ??= new GameAudio('colony');
      audio.current.setMuted(mutePreference.current);
      audio.current.setPlaying(true);
      void audio.current.unlock().then(setSoundOK);
      canvas.current?.focus({ preventScroll: true });
    }
    keys.current.clear();
    pointer.current = null;
    publish();
  }, [publish]);
  const start = () => {
    setReviewHome(false);
    live.current.mode = 'running';
    audio.current ??= new GameAudio('colony');
    audio.current.setMuted(mutePreference.current);
    audio.current.setPlaying(true);
    void audio.current.unlock().then(setSoundOK);
    publish();
    canvas.current?.focus();
  };
  useEffect(() => {
    const el = canvas.current,
      c = el?.getContext('2d');
    if (!el || !c) return;
    let frame = 0,
      last = 0,
      hud = 0,
      w = el.clientWidth,
      h = el.clientHeight;
    let previous = colonySnapshot(live.current);
    let cues: ColonyCue[] = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const blur = () => {
      keys.current.clear();
      pointer.current = null;
      if (live.current.mode === 'running') {
        live.current.mode = 'paused';
        publish();
      }
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    const down = (e: KeyboardEvent) => {
      const k = gameKey(e);
      if (!k) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest('dialog,[role="dialog"]') ||
          (k !== 'escape' && blocksGameInput(e.target, k)))
      )
        return;
      if (k === 'escape' && !e.repeat) {
        e.preventDefault();
        togglePause();
        return;
      }
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'f',
        ].includes(k)
      ) {
        e.preventDefault();
        if (k !== 'f') pointer.current = null;
        if (!e.repeat || k !== 'f') keys.current.add(k);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = gameKey({ key: e.key, code: e.code });
      if (k && k !== 'f') keys.current.delete(k);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const a = live.current,
        k = keys.current;
      let x =
          Number(k.has('d') || k.has('arrowright')) -
          Number(k.has('a') || k.has('arrowleft')),
        y =
          Number(k.has('s') || k.has('arrowdown')) -
          Number(k.has('w') || k.has('arrowup'));
      if (!x && !y && pointer.current) {
        x = pointer.current.x - a.player.x;
        y = pointer.current.y - a.player.y;
        const d = Math.hypot(x, y);
        if (d < 9) {
          x = 0;
          y = 0;
          pointer.current = null;
        } else {
          x /= d;
          y /= d;
        }
      }
      const delivered = a.delivered,
        growth = a.growth,
        built = a.shelter,
        mode = a.mode;
      stepColony(a, { x, y, interact: k.has('f') }, dt);
      k.delete('f');
      audio.current?.setPlaying(a.mode === 'running');
      if (a.growth > growth || a.shelter !== built) audio.current?.cue('birth');
      else if (a.delivered > delivered) audio.current?.cue('food');
      if (a.mode !== mode && a.mode === 'won') audio.current?.cue('win');
      if (a.time < previous.time || a.mode === 'ready') cues = [];
      cues = [
        ...cues.filter((e) => a.time - e.at < 3),
        ...colonyCues(previous, a),
      ].slice(-18);
      previous = colonySnapshot(a);
      renderColony(c, a, w, h, dpr, pointer.current, cues, motion.matches);
      if (now - hud > 100 || a.mode !== mode) {
        hud = now;
        publish();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      audio.current?.dispose();
      audio.current = null;
    };
    // The mutable simulation and inputs intentionally outlive HUD snapshots.
  }, [publish, togglePause]);
  const interact = () => {
    if (live.current.mode === 'running') keys.current.add('f');
    canvas.current?.focus();
  };
  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (live.current.mode !== 'running') return;
    const rect = e.currentTarget.getBoundingClientRect(),
      v = colonyView(rect.width, rect.height);
    pointer.current = {
      x: (e.clientX - rect.left - v.x) / v.scale,
      y: (e.clientY - rect.top - v.y) / v.scale,
    };
  };
  const action = colonyInteraction(s);
  const guards = colonyGuards(s);
  return (
    <main className="colony-shell">
      <header className="colony-header">
        <div>
          <small>第五章 / 族群的黎明</small>
          <h1>从一个巢，到共同的家。</h1>
        </div>
        <div>
          <ControlsHelp
            colony
            onOpen={() => {
              if (live.current.mode === 'running') togglePause();
              audio.current?.setPlaying(false);
            }}
          />
          <AudioVolumes
            audio={audio}
            habitat="colony"
            onOpen={() => {
              if (live.current.mode === 'running') togglePause();
              audio.current?.setPlaying(false);
            }}
          />
          {onSave && (
            <button
              className="save-button"
              onClick={onSave}
              title="每 5 秒自动保存在这台设备；点击立即保存"
            >
              {saveStatus}
            </button>
          )}
          <button
            onClick={() => {
              if (!soundOK) {
                setMuted(false);
                mutePreference.current = false;
                audio.current ??= new GameAudio('colony');
                audio.current.setMuted(false);
                audio.current.setPlaying(live.current.mode === 'running');
                void audio.current.unlock().then(setSoundOK);
                return;
              }
              const next = !muted;
              setMuted(next);
              mutePreference.current = next;
              audio.current ??= new GameAudio('colony');
              audio.current.setMuted(next);
            }}
          >
            {!soundOK ? '开启声音' : `音乐${muted ? '关' : '开'}`}
          </button>
          <button
            disabled={!['running', 'paused'].includes(s.mode)}
            onClick={togglePause}
          >
            {s.mode === 'paused' ? '继续' : '暂停'}
          </button>
          <button onClick={() => onExit(live.current)}>返回章节</button>
          <LearningMenu
            state={s}
            stage="colony"
            onSelect={(id) => {
              selectLearnedSkill(live.current, id, 'colony');
              publish();
            }}
            onMode={(mode) => {
              if (
                (mode === 'paused' && live.current.mode === 'running') ||
                (mode === 'running' && live.current.mode === 'paused')
              ) {
                live.current.mode = mode;
                keys.current.clear();
                pointer.current = null;
                publish();
              }
            }}
          />
          {s.freeLife && s.mode !== 'won' && (
            <StageLifeControls
              state={s}
              stayLabel="留在家园 · 继续分工"
              onStay={() => {
                if (continueStageLife(live.current)) {
                  setReviewHome(false);
                  publish();
                }
              }}
              onReview={() => {
                if (reviewStageLife(live.current)) publish();
              }}
            />
          )}
        </div>
      </header>
      <div className="colony-layout">
        <section className="colony-field colony-habitat">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label="族群游戏地图，WASD 移动，K 采集、存放、搭棚、喂养和修补。点击地面前往，按住引导方向。"
            onPointerDown={(e) => {
              e.currentTarget.focus();
              e.currentTarget.setPointerCapture(e.pointerId);
              aim(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) aim(e);
            }}
            onPointerCancel={() => {
              pointer.current = null;
            }}
          />
          <output className="colony-notice">{keyHints(s.notice)}</output>
          <div className="colony-action" aria-label="当前位置的互动">
            <small>{action.hint}</small>
            <button
              className="colony-interact"
              onClick={interact}
              disabled={s.mode !== 'running' || !action.ready}
            >
              K · {action.label}
            </button>
          </div>
          {s.mode !== 'running' && !(s.mode === 'won' && reviewHome) && (
            <div className="colony-overlay">
              <div>
                <small>
                  {s.mode === 'ready'
                    ? '族群生活 · 第一条完整旅程'
                    : s.mode === 'paused'
                      ? '暂时休息'
                      : s.mode === 'won'
                        ? '生物篇完成 · 生命留下了后代'
                        : '风雨中的一次尝试'}
                </small>
                <h2>
                  {s.mode === 'ready'
                    ? '新生命，需要大家。'
                    : s.mode === 'paused'
                      ? '林地正在等你'
                      : s.mode === 'won'
                        ? '这一次，是我们一起。'
                        : '再给家一层保护。'}
                </h2>
                <p>
                  {s.mode === 'ready'
                    ? '采集物资，搭起育幼棚。亲手喂养幼崽，让它成为新成员，再一起迎接暴雨。'
                    : s.mode === 'paused'
                      ? '暂停时，采集、成长与天气都会停止。'
                      : s.notice}
                </p>
                {s.mode === 'won' && (
                  <p>
                    幼崽已经学会与你分工。共同生活，成为这个族群新的生存方式。
                  </p>
                )}
                <StageLifeControls
                  state={s}
                  stayLabel="留在家园 · 继续分工"
                  onStay={() => {
                    if (continueStageLife(live.current)) {
                      setReviewHome(false);
                      publish();
                    }
                  }}
                  onReview={() => {
                    if (reviewStageLife(live.current)) publish();
                  }}
                />
                {s.mode === 'won' && onFinishBiological && (
                  <button
                    onClick={() => {
                      const record = onFinishBiological(live.current);
                      if (record) {
                        live.current.archiveId = record.id;
                        setBiologicalReview(record);
                        publish();
                      }
                    }}
                  >
                    保存生物篇成果 · 培育新支系
                  </button>
                )}
                {biologicalReview && (
                  <BiologicalReview
                    record={biologicalReview}
                    onBranch={onBranch}
                  />
                )}
                {s.mode === 'won' && onTribe && (
                  <button onClick={() => onTribe(live.current)}>
                    {hasTribe ? '继续部落旅程' : '走向部落 · 工具与邻居'}
                  </button>
                )}
                {s.mode === 'won' && (
                  <button onClick={() => setReviewHome(true)}>
                    看看我们的家
                  </button>
                )}
                <button
                  onClick={() => {
                    if (s.mode === 'paused') togglePause();
                    else {
                      if (s.mode === 'won' || s.mode === 'lost')
                        live.current = structuredClone(initial);
                      start();
                    }
                  }}
                >
                  {s.mode === 'ready'
                    ? '开始族群生活'
                    : s.mode === 'paused'
                      ? '继续探索'
                      : '从本章起点再试一次'}
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="colony-panel">
          <small className="colony-kicker">
            {s.standalone
              ? '独立体验 · 不计入此前谱系'
              : `继承第 ${s.generation} 代 · ${FORMS[s.form].name}`}
          </small>
          <h2>
            {s.mode === 'won'
              ? '家园留下来了'
              : s.storm !== null
                ? '守住共同的家'
                : s.growth === 100
                  ? '新成员，新的分工'
                  : s.shelter
                    ? '看着幼崽长大'
                    : '先搭起育幼棚'}
          </h2>
          <p>{colonyGoal(s)}</p>
          <button
            className="colony-storm-start"
            disabled={s.mode !== 'running'}
            onClick={() => {
              const goal = colonyJourneyTarget(live.current);
              keys.current.clear();
              pointer.current = { ...goal.point };
              live.current.notice = goal.label;
              publish();
              canvas.current?.focus();
            }}
          >
            ◎ 跟随目标 · WASD 接管
          </button>
          {s.mode === 'won' && reviewHome && onTribe && (
            <button
              className="colony-storm-start"
              onClick={() => onTribe(live.current)}
            >
              {hasTribe ? '继续部落旅程' : '走向部落 · 工具与邻居'}
            </button>
          )}
          <div className="colony-stores">
            <span>
              <b>{s.food}</b> 果实
            </span>
            <span>
              <b>{s.wood}</b> 树枝
            </span>
            <span>
              <b>{s.members.length}</b> 成员
            </span>
          </div>
          <label className="colony-meter">
            {s.storm === null ? '幼崽成长' : '育幼棚牢固度'}
            <b>{Math.ceil(s.storm === null ? s.growth : s.integrity)}%</b>
            <progress
              value={s.storm === null ? s.growth : s.integrity}
              max={100}
            />
          </label>
          {s.storm !== null && (
            <div className="colony-weather">
              {s.mode === 'won' ? (
                '风雨已过 · 你们守住了家园'
              ) : (
                <>
                  暴雨剩余 <strong>{Math.ceil(s.storm)} 秒</strong>
                </>
              )}
              <small>
                已到位守护 {guards.length}/
                {s.members.filter((m) => m.role === 'guard').length} · 修补消耗
                1 树枝
              </small>
            </div>
          )}
          <h3>把任务交给谁</h3>
          {!s.members.length && (
            <p>这次独自抵达新家。先亲手采集，幼崽长大后就会加入分工。</p>
          )}
          {s.members.map((m) => (
            <div className="colony-member" key={m.id}>
              <span>
                {m.newborn ? '✦ 长大的幼崽' : `成员 ${m.id + 1}`}
                <small>
                  {m.carrying
                    ? `正在带回${m.carrying === 'wood' ? '树枝' : '果实'}`
                    : m.role === 'guard'
                      ? guards.some((g) => g.id === m.id)
                        ? '已到位 · 正在护巢'
                        : '正在赶回育幼棚'
                      : ROLE_NAMES[m.role] + '中'}
                </small>
                {colonyMemberTraits(m).map((trait) => (
                  <small key={trait}>{trait}</small>
                ))}
              </span>
              <div>
                {(['food', 'wood', 'guard'] as const).map((role) => (
                  <button
                    key={role}
                    aria-pressed={m.role === role}
                    disabled={s.mode !== 'running'}
                    onClick={() => {
                      setColonyRole(live.current, m.id, role);
                      publish();
                      canvas.current?.focus();
                    }}
                  >
                    {ROLE_NAMES[role]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {s.shelter && s.growth === 100 && s.storm === null && (
            <button
              className="colony-storm-start"
              disabled={s.mode !== 'running'}
              onClick={() => {
                startColonyStorm(live.current);
                publish();
                canvas.current?.focus();
              }}
            >
              准备好了 · 迎接暴雨
            </button>
          )}
          <details className="hud-details">
            <summary>操作与自然手记</summary>
            <p className="colony-tip">
              WASD / 方向键移动；点击地面前往，按住引导。K
              采集或回巢互动，每次可带 3 份同类物资。守巢者到达屋顶旁才会生效。
            </p>
            <p className="colony-science">
              幼崽长大是个体发育，学会协作是行为变化；它们与跨越多代的生物演化不同。这是一段虚构的生态实验。
            </p>
          </details>
          {!soundOK && <small>声音尚未开启，点击上方“开启声音”重试。</small>}
        </aside>
      </div>
    </main>
  );
}
