'use client';
import { StageLifeControls } from './StageLifeControls';
import { ControlsHelp } from './ControlsHelp';
import { AudioVolumes } from './AudioVolumes';
import { gameKey, keyHints } from './dash-input';
import { continueStageLife, reviewStageLife } from './stage-life';
import { LearningMenu } from './LearningMenu';
import { selectLearnedSkill } from './lineage-learning';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TribeState, Tool, TribeRole } from './tribe';
import {
  tribeGoal,
  tribeContext,
  tribeAllies,
  tribeInteract,
  stepTribe,
  craftTribeTool,
  setTribeRole,
  neighborAction,
  startTribeStorm,
  TOOL_NAMES,
  TOOL_COST,
  MATERIAL_NAMES,
  TRIBE_ROLES,
  costLabel,
  tribePrompt,
  chooseTribeOrganization,
} from './tribe';
import { renderTribe, tribeView } from './tribe-render';
import { tribeSnapshot, tribeCues } from './tribe-feedback';
import type { TribeCue } from './tribe-feedback';
import { GameAudio } from './audio';
export function TribeGame({
  checkpoint,
  current,
  onProgress,
  onExit,
  onSave,
  saveStatus,
  onCity,
  hasCity,
  readCurrent,
}: {
  checkpoint: TribeState;
  current: TribeState;
  onProgress: (s: TribeState) => void;
  onExit: (s: TribeState) => void;
  onSave: () => void;
  saveStatus: string;
  onCity?: (s: TribeState) => void;
  hasCity?: boolean;
  readCurrent?: () => TribeState | undefined;
}) {
  const [initial] = useState(() => structuredClone(checkpoint));
  const [entry] = useState(() => structuredClone(readCurrent?.() ?? current));
  const live = useRef(structuredClone(entry));
  const [s, setS] = useState(entry),
    canvas = useRef<HTMLCanvasElement>(null);
  const [reviewCamp, setReviewCamp] = useState(false);
  const mutePreference = useRef(true);
  const keys = useRef(new Set<string>()),
    pointer = useRef<{ x: number; y: number } | null>(null),
    audio = useRef<GameAudio | null>(null);
  const [muted, setMuted] = useState(true),
    [soundOK, setSoundOK] = useState(true);
  const publish = useCallback(() => {
    setS(structuredClone(live.current));
    onProgress(live.current);
  }, [onProgress]);
  const action = useCallback(
    (fn: (state: TribeState) => unknown) => {
      fn(live.current);
      publish();
      canvas.current?.focus();
    },
    [publish],
  );
  const resume = useCallback(() => {
    setReviewCamp(false);
    live.current.mode = 'running';
    audio.current ??= new GameAudio('colony');
    audio.current.setMuted(mutePreference.current);
    audio.current.setPlaying(true);
    void audio.current.unlock().then(setSoundOK);
    publish();
    canvas.current?.focus();
  }, [publish]);
  const pause = useCallback(() => {
    keys.current.clear();
    pointer.current = null;
    if (live.current.mode === 'paused') resume();
    else if (live.current.mode === 'running') {
      live.current.mode = 'paused';
      publish();
    }
  }, [publish, resume]);
  useEffect(() => {
    const el = canvas.current,
      c = el?.getContext('2d');
    if (!el || !c) return;
    let frame = 0,
      last = 0,
      hud = 0,
      w = el.clientWidth,
      h = el.clientHeight;
    let previous = tribeSnapshot(live.current);
    let cues: TribeCue[] = [];
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
      if (
        e.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
          e.target.isContentEditable)
      )
        return;
      const k = gameKey(e);
      if (!k) return;
      if (k === 'escape' && !e.repeat) {
        e.preventDefault();
        pause();
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
      const won = a.mode,
        completed = a.banks.filter((b) => b.work >= 6).length;
      stepTribe(a, { x, y, interact: k.has('f') }, dt);
      k.delete('f');
      audio.current?.setPlaying(a.mode === 'running');
      if (won !== a.mode && a.mode === 'won') audio.current?.cue('win');
      else if (a.banks.filter((b) => b.work >= 6).length > completed)
        audio.current?.cue('birth');
      if (a.time < previous.time || a.mode === 'ready') cues = [];
      cues = [
        ...cues.filter((e) => a.time - e.at < 2.6),
        ...tribeCues(previous, a),
      ].slice(-18);
      previous = tribeSnapshot(a);
      renderTribe(c, a, w, h, dpr, pointer.current, cues, motion.matches);
      if (now - hud > 100 || won !== a.mode) {
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
  }, [pause, publish]);
  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      v = tribeView(r.width, r.height);
    pointer.current = {
      x: (e.clientX - r.left - v.x) / v.scale,
      y: (e.clientY - r.top - v.y) / v.scale,
    };
  };
  const prompt = tribePrompt(s);
  const context = tribeContext(s),
    near = s.neighbors.find((n) => n.id === context),
    running = s.mode === 'running';
  const craft = (tool: Tool) =>
    action((a) => {
      if (craftTribeTool(a, tool)) {
        audio.current?.cue('birth');
      }
    });
  return (
    <main className="colony-shell tribe-shell">
      <header className="colony-header">
        <div>
          <small>第六章 / 山谷中的朋友</small>
          <h1>用双手，把家园连起来。</h1>
        </div>
        <div>
          <ControlsHelp colony />
          <AudioVolumes audio={audio} habitat="colony" />
          <button className="save-button" onClick={onSave}>
            {saveStatus}
          </button>
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
              mutePreference.current = next;
              setMuted(next);
              audio.current ??= new GameAudio('colony');
              audio.current.setMuted(next);
            }}
          >
            {!soundOK ? '开启声音' : `音乐${muted ? '关' : '开'}`}
          </button>
          <button
            disabled={!['running', 'paused'].includes(s.mode)}
            onClick={pause}
          >
            {s.mode === 'paused' ? '继续' : '暂停'}
          </button>
          <button onClick={() => onExit(live.current)}>返回族群</button>
          <LearningMenu
            state={s}
            stage="tribe"
            onSelect={(id) => {
              selectLearnedSkill(live.current, id, 'tribe');
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
              stayLabel="留在山谷 · 继续生活"
              onStay={() => {
                if (continueStageLife(live.current)) {
                  setReviewCamp(false);
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
        <section className="colony-field tribe-field colony-habitat">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label="部落山谷地图，WASD 或点击地图移动，K 采集、存放、拜访、建设。"
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
            <small>{prompt.hint}</small>
            <button
              className="colony-interact"
              disabled={!running}
              onClick={() => action(tribeInteract)}
            >
              K · {prompt.label}
            </button>
          </div>
          {s.mode !== 'running' && !(s.mode === 'won' && reviewCamp) && (
            <div className="colony-overlay">
              <div>
                <small>
                  {s.mode === 'ready'
                    ? '从族群走向部落'
                    : s.mode === 'paused'
                      ? '暂时休息'
                      : s.mode === 'won'
                        ? '第六章完成'
                        : '再一次合作的机会'}
                </small>
                <h2>
                  {s.mode === 'ready'
                    ? '工具，让想法成为可能。'
                    : s.mode === 'paused'
                      ? '山谷正在等你'
                      : s.mode === 'won'
                        ? '这里，有我们的名字。'
                        : '带好工具，一起重来。'}
                </h2>
                <p>
                  {s.mode === 'ready'
                    ? `带着 ${s.members.length} 名成员、${s.stores.food} 果实、${s.stores.wood} 树枝来到山谷。制作工具，认识两处邻居，一起建起能够抵挡涨水的共同营地。`
                    : s.mode === 'paused'
                      ? '暂停时，成员、建设和天气都会停止。'
                      : s.notice}
                </p>
                {s.mode === 'won' && (
                  <p>
                    工具、结盟方式和真实谱系已保存。下一章将让营地形成食物、制造与能源的分工。
                  </p>
                )}
                <StageLifeControls
                  state={s}
                  stayLabel="留在山谷 · 继续生活"
                  onStay={() => {
                    if (continueStageLife(live.current)) {
                      setReviewCamp(false);
                      publish();
                    }
                  }}
                  onReview={() => {
                    if (reviewStageLife(live.current)) publish();
                  }}
                />
                {s.mode === 'won' && onCity && (
                  <button onClick={() => onCity(live.current)}>
                    {hasCity ? '继续文明旅程' : '走向文明 · 生产与运输'}
                  </button>
                )}
                {s.mode === 'won' && (
                  <button onClick={() => setReviewCamp(true)}>
                    看看共同营地
                  </button>
                )}
                <button
                  onClick={() => {
                    if (['won', 'lost'].includes(s.mode))
                      live.current = structuredClone(initial);
                    resume();
                  }}
                >
                  {s.mode === 'ready'
                    ? '走进山谷'
                    : s.mode === 'paused'
                      ? '继续探索'
                      : '从部落起点再试一次'}
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="colony-panel tribe-panel">
          <small className="colony-kicker">
            {s.standalone
              ? '独立体验延续 · 不虚构祖先'
              : `第 ${s.generation} 代的族群 · 身体与谱系延续`}
          </small>
          <h2>
            {s.mode === 'won'
              ? '共同营地落成'
              : !s.tools.length
                ? '第一件工具'
                : tribeAllies(s) < 2
                  ? '认识山谷的邻居'
                  : !s.camp
                    ? '把家园连起来'
                    : s.storm === null
                      ? '准备防洪协作'
                      : s.banks.every((b) => b.work >= 6)
                        ? '回到共同的家'
                        : '三道河堤，大家一起'}
          </h2>
          <p>{tribeGoal(s)}</p>
          {!s.camp && (
            <section className="tribe-context">
              <h3>怎样建立工具社会？</h3>
              <div className="land-focus-options">
                <button
                  aria-pressed={s.organization !== 'workshop'}
                  disabled={!running}
                  onClick={() =>
                    action((a) => chooseTribeOrganization(a, 'network'))
                  }
                >
                  贸易 / 互助聚落
                </button>
                <button
                  aria-pressed={s.organization === 'workshop'}
                  disabled={!running}
                  onClick={() =>
                    action((a) => chooseTribeOrganization(a, 'workshop'))
                  }
                >
                  本族工坊聚落
                </button>
              </div>
              <p>
                {s.organization === 'workshop'
                  ? '两类工具、更高的自建材料投入，由本族完成防洪工程；拜访邻居仍可选。'
                  : '通过真实交换或帮忙与两处邻居结盟，再共同建设。'}
              </p>
            </section>
          )}
          {s.mode === 'won' && reviewCamp && onCity && (
            <button
              className="colony-storm-start"
              onClick={() => onCity(live.current)}
            >
              {hasCity ? '继续文明旅程' : '走向文明 · 生产与运输'}
            </button>
          )}
          <div className="colony-stores tribe-stores">
            {Object.entries(s.stores).map(([key, value]) => (
              <span key={key}>
                <b>{value}</b>
                {MATERIAL_NAMES[key as keyof typeof MATERIAL_NAMES]}
              </span>
            ))}
          </div>
          <div className="tribe-progress">
            <span>工具 {s.tools.length}/2</span>
            <span>
              {s.organization === 'workshop'
                ? '工坊路线 · 结盟可选'
                : `盟友 ${tribeAllies(s)}/2`}
            </span>
            <span>河堤 {s.banks.filter((b) => b.work >= 6).length}/3</span>
          </div>
          {context === 'home' && (
            <section className="tribe-context">
              <h3>工作台</h3>
              <p>K 放下携带物。制作需要使用储备中的材料。</p>
              <div className="tribe-tools">
                {(['basket', 'hammer'] as Tool[]).map((t) => (
                  <button
                    key={t}
                    disabled={!running || s.tools.includes(t)}
                    onClick={() => craft(t)}
                  >
                    <strong>
                      {s.tools.includes(t) ? '✓ ' : ''}
                      {TOOL_NAMES[t]}
                    </strong>
                    <small>
                      {t === 'basket'
                        ? '携带上限 6 · 采果每趟更多'
                        : '采石拾枝更多 · 建设翻倍'}
                    </small>
                    <small>{costLabel(TOOL_COST[t])}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          {near && (
            <section className="tribe-context">
              <h3>
                {near.id === 'moss' ? '苔石聚落' : '芦湾聚落'} · 信任{' '}
                {near.trust}/2
              </h3>
              {!near.met ? (
                <p>按 K 打个招呼，了解他们需要什么。</p>
              ) : near.trust >= 2 ? (
                <p>已经结盟。共同营地建好后，邻居会沿路前来。</p>
              ) : (
                <>
                  <p>
                    {!s.tools.length
                      ? '先回工作台做出第一件工具，展示你的经验。'
                      : '交换两次，或帮忙一次，两种方式都能结盟。'}
                  </p>
                  <button
                    disabled={!running || !s.tools.length}
                    onClick={() =>
                      action((a) => neighborAction(a, near.id, 'trade'))
                    }
                  >
                    {near.id === 'moss' ? '4 果实 → 4 石料' : '4 树枝 → 4 纤维'}{' '}
                    · 信任 +1
                  </button>
                  <button
                    disabled={!running || !s.tools.length}
                    onClick={() =>
                      action((a) => neighborAction(a, near.id, 'help'))
                    }
                  >
                    {near.id === 'moss'
                      ? '帮忙铺路 · 3 树枝 + 2 石料'
                      : '修好屋顶 · 4 树枝 + 2 纤维'}{' '}
                    · 直接结盟
                  </button>
                </>
              )}
            </section>
          )}
          {context === 'council' && s.camp && s.storm === null && (
            <button
              className="colony-storm-start"
              disabled={!running}
              onClick={() => action(startTribeStorm)}
            >
              材料准备好了 · 开启防洪协作
            </button>
          )}
          {s.storm !== null && (
            <section className="tribe-context">
              <h3>
                {s.banks.every((b) => b.work >= 6)
                  ? '河水退去了'
                  : `涨水倒计时 ${Math.ceil(s.storm)} 秒`}
              </h3>
              <label className="colony-meter">
                营地稳固度 <b>{Math.ceil(s.integrity)}%</b>
                <progress value={s.integrity} max={100} />
              </label>
              {s.banks.map((b) => (
                <label className="colony-meter" key={b.id}>
                  {b.id + 1} 号河堤{' '}
                  <b>
                    {b.work >= 6 ? '完成' : b.paid ? '正在建设' : '待投入材料'}
                  </b>
                  <progress
                    aria-label={`${b.id + 1}号河堤进度`}
                    value={b.work}
                    max={6}
                  />
                </label>
              ))}
            </section>
          )}
          <h3>把任务交给谁 · {s.members.length} 名成员</h3>
          {s.members.map((m) => (
            <div className="colony-member" key={m.id}>
              <span>
                {m.newborn ? '✦ 长大的幼崽' : `成员 ${m.id + 1}`}
                <small>
                  {m.carrying
                    ? `送回 ${m.load} ${MATERIAL_NAMES[m.carrying]}`
                    : TRIBE_ROLES[m.role]}
                </small>
              </span>
              <div>
                {(Object.keys(TRIBE_ROLES) as TribeRole[]).map((role) => (
                  <button
                    key={role}
                    aria-pressed={m.role === role}
                    disabled={!running}
                    onClick={() => action((a) => setTribeRole(a, m.id, role))}
                  >
                    {TRIBE_ROLES[role]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="colony-tip">
            WASD / 方向键移动，也可点击地面前往。K
            采集、存放、拜访和建设。随行成员必须走到你身边，才能一起建造。
          </p>
          <p className="colony-science">
            工具与结盟是学习和文化的变化，身体与真实谱系继续保留。没有把某种社会生活方式设为自然演化的必然终点。
          </p>
          {!soundOK && <small>声音尚未开启，点击上方“开启声音”重试。</small>}
        </aside>
      </div>
    </main>
  );
}
