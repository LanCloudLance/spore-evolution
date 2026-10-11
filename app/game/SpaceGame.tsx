'use client';
import { StageLifeControls } from './StageLifeControls';
import { continueStageLife, reviewStageLife } from './stage-life';
import { LearningMenu } from './LearningMenu';
import { selectLearnedSkill } from './lineage-learning';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio } from './audio';
import { AudioVolumes } from './AudioVolumes';
import { SpaceMap } from './SpaceMap';
import { OutpostScene } from './OutpostScene';
import { ExpeditionReview } from './ExpeditionReview';
import { TRAITS } from './simulation';
import type { TraitId } from './simulation';
import type { SpaceState, StarId } from './space';
import {
  STARS,
  ECOLOGY_NAMES,
  ECOLOGY_TARGETS,
  travelCost,
  travelSpace,
  spaceActivity,
  upgradeSpace,
  recordSpaceRelic,
  buildOutpost,
  setEcology,
  startOutpostTrial,
  stepSpace,
  spaceGoal,
  spaceCompletionNotice,
  canSpaceAct,
  flareStrength,
  ecologyFeedback,
  ecologyReadings,
  expeditionRecord,
} from './space';
export function SpaceGame({
  checkpoint,
  current,
  onProgress,
  onExit,
  onSave,
  saveStatus,
  onReplay,
  readCurrent,
}: {
  checkpoint: SpaceState;
  current: SpaceState;
  onProgress: (s: SpaceState) => void;
  onExit: (s: SpaceState) => void;
  onSave: () => void;
  saveStatus: string;
  readCurrent?: () => SpaceState | undefined;
  onReplay: (s: SpaceState, trait?: TraitId) => void;
}) {
  const [initial] = useState(() => structuredClone(checkpoint));
  const [entry] = useState(() => structuredClone(readCurrent?.() ?? current));
  const live = useRef(structuredClone(entry)),
    [s, setS] = useState(entry);
  const [view, setView] = useState<'map' | 'surface'>('surface');
  const mutePreference = useRef(true);
  const [selected, setSelected] = useState<StarId>(
      entry.flight?.to ?? entry.location,
    ),
    [inherit, setInherit] = useState<TraitId | ''>(''),
    [muted, setMuted] = useState(true),
    [soundOK, setSoundOK] = useState(true);
  const audio = useRef<GameAudio | null>(null);
  const publish = useCallback(() => {
    setS(structuredClone(live.current));
    onProgress(live.current);
  }, [onProgress]);
  const act = (fn: (state: SpaceState) => boolean) => {
    if (fn(live.current)) audio.current?.cue('food');
    publish();
  };
  const resume = useCallback(() => {
    live.current.mode = 'running';
    audio.current ??= new GameAudio('colony');
    audio.current.setMuted(mutePreference.current);
    audio.current.setPlaying(true);
    void audio.current.unlock().then(setSoundOK);
    publish();
  }, [publish]);
  const pause = useCallback(() => {
    if (live.current.mode === 'paused') resume();
    else if (live.current.mode === 'running') {
      live.current.mode = 'paused';
      publish();
    }
  }, [publish, resume]);
  useEffect(() => {
    let frame = 0,
      last = 0,
      hud = 0;
    const blur = () => {
      if (live.current.mode === 'running') {
        live.current.mode = 'paused';
        publish();
      }
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat) {
        e.preventDefault();
        pause();
      }
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('keydown', key);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const old = live.current.mode;
      stepSpace(live.current, dt);
      audio.current?.setPlaying(live.current.mode === 'running');
      if (old !== live.current.mode && live.current.mode === 'won')
        audio.current?.cue('win');
      if (now - hud > 80 || old !== live.current.mode) {
        hud = now;
        publish();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('keydown', key);
      audio.current?.dispose();
      audio.current = null;
    };
  }, [pause, publish]);
  const free = canSpaceAct(s),
    finished = s.mode === 'won' || s.mode === 'lost',
    here = selected === s.location,
    planet =
      s.location === 'tide' || s.location === 'ember' ? s.location : null,
    o = s.outpost,
    record = expeditionRecord(s, 0),
    known = new Set([...s.traits, ...s.history.flatMap((a) => a.traits)]);
  return (
    <main className="colony-shell space-shell">
      <header className="colony-header">
        <div>
          <small>第八章 / 带着生命走向远方</small>
          <h1>在另一颗星上，种下一个世界。</h1>
        </div>
        <div>
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
              mutePreference.current = !muted;
              setMuted(!muted);
              audio.current ??= new GameAudio('colony');
              audio.current.setMuted(!muted);
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
          <button onClick={() => onExit(live.current)}>返回文明</button>
          <LearningMenu
            state={s}
            stage="space"
            onSelect={(id) => {
              selectLearnedSkill(live.current, id, 'space');
              publish();
            }}
            onMode={(mode) => {
              if (
                (mode === 'paused' && live.current.mode === 'running') ||
                (mode === 'running' && live.current.mode === 'paused')
              ) {
                live.current.mode = mode;
                publish();
              }
            }}
          />
          <StageLifeControls
            state={s}
            stayLabel="留在星海 · 继续探索"
            onStay={() => {
              if (continueStageLife(live.current)) {
                publish();
              }
            }}
            onReview={() => {
              if (reviewStageLife(live.current)) publish();
            }}
          />
        </div>
      </header>
      <div className="city-goal">
        <small>
          {s.standalone ? '独立体验延续' : `第 ${s.generation} 代的旅程`}
        </small>
        <strong>{spaceGoal(s)}</strong>
        <output>
          {s.mode === 'won' ? spaceCompletionNotice(s) : s.notice}
        </output>
      </div>
      <div className="city-layout">
        <section className="city-scene space-scene">
          {o && (
            <div className="space-view-picker">
              <button
                aria-pressed={view === 'surface'}
                onClick={() => setView('surface')}
              >
                观察地表
              </button>
              <button
                aria-pressed={view === 'map'}
                onClick={() => setView('map')}
              >
                回看星图
              </button>
            </div>
          )}
          {o && view === 'surface' ? (
            <OutpostScene s={s} />
          ) : (
            <SpaceMap s={s} selected={selected} onSelect={setSelected} />
          )}
          {s.mode === 'paused' && (
            <div className="city-planning">
              <span>
                {o
                  ? '已暂停 · 环境设定仍可调整'
                  : '航行与作业已暂停 · 可以查看星图'}
              </span>
              <button onClick={resume}>继续探索</button>
            </div>
          )}
          {(s.flight || s.activity) && (
            <div className="space-work">
              <strong>
                {s.flight
                  ? `航向${STARS[s.flight.to].name}`
                  : s.activity?.kind === 'water'
                    ? '探针正在寻找水分与基质'
                    : s.activity?.kind === 'air'
                      ? '测量光照与气候'
                      : s.activity?.kind === 'charge'
                        ? '太阳帆正在汇集能量'
                        : '补给舱正在对接'}
              </strong>
              <progress
                aria-label="航行或作业进度"
                max={1}
                value={
                  s.flight
                    ? s.flight.elapsed / s.flight.duration
                    : 1 -
                      s.activity!.remaining /
                        (['water', 'air'].includes(s.activity!.kind) ? 5 : 4)
                }
              />
              <span>
                {s.flight
                  ? Math.ceil(s.flight.duration - s.flight.elapsed)
                  : Math.ceil(s.activity!.remaining)}{' '}
                秒
              </span>
            </div>
          )}
          {['ready', 'lost'].includes(s.mode) && (
            <div className="colony-overlay city-overlay">
              <div>
                <small>
                  {s.mode === 'lost'
                    ? '远航救援'
                    : s.mode === 'paused'
                      ? '星海已暂停'
                      : '从母星出发'}
                </small>
                <h2>
                  {s.mode === 'lost'
                    ? '换一种准备，再走向远方。'
                    : s.mode === 'paused'
                      ? '先观察，再调整。'
                      : '船舱里，有你一路带来的生命。'}
                </h2>
                <p>
                  {s.mode === 'ready'
                    ? `${s.crew.length} 位远航者带着真实谱系同行。选择星球、扫描环境、建立前哨，再照料它度过 30 秒生态观察。`
                    : s.mode === 'paused'
                      ? '航行与生态试验已暂停，仍可调节前哨环境。'
                      : s.notice}
                </p>
                <button
                  onClick={() => {
                    if (s.mode === 'lost') {
                      live.current = structuredClone(initial);
                      setSelected(initial.location);
                    }
                    resume();
                  }}
                >
                  {s.mode === 'ready'
                    ? '驶入星海'
                    : s.mode === 'paused'
                      ? '继续探索'
                      : '从星海起点重试'}
                </button>
              </div>
            </div>
          )}
          <div className="city-legend">
            <span>能量 {s.fuel}</span>
            <span>食物 {s.food}</span>
            <span>零件 {s.parts}</span>
            <span>
              {s.upgrade === 'sail'
                ? '太阳帆 · 节省航耗'
                : s.upgrade === 'shield'
                  ? '生态屏障 · 抵御耀斑'
                  : '可选择一项船舱升级'}
            </span>
          </div>
        </section>
        <aside className="colony-panel city-panel">
          {(!o || view === 'map') && (
            <>
              <div className="city-node-picker">
                {(Object.keys(STARS) as StarId[]).map((id) => (
                  <button
                    key={id}
                    aria-pressed={selected === id}
                    onClick={() => setSelected(id)}
                  >
                    {STARS[id].name}
                    {s.location === id ? ' · 所在' : ''}
                  </button>
                ))}
              </div>
              <section className="tribe-context">
                <h2>{STARS[selected].name}</h2>
                <p>{STARS[selected].description}</p>
                {!here && (
                  <button
                    disabled={
                      !free ||
                      (!!o && !s.freeLife) ||
                      s.fuel < travelCost(s, selected) ||
                      s.food < 1
                    }
                    onClick={() => act((a) => travelSpace(a, selected))}
                  >
                    航向{STARS[selected].name} · {travelCost(s, selected)} 能量
                    / 1 食物
                  </button>
                )}
                {s.flight && (
                  <p>
                    航行 {Math.ceil(s.flight.duration - s.flight.elapsed)}{' '}
                    秒后抵达
                    {STARS[s.flight.to].name}
                  </p>
                )}
                {s.activity && (
                  <p>
                    探针 / 补给作业还需 {Math.ceil(s.activity.remaining)} 秒
                  </p>
                )}
                {here && (
                  <>
                    <button
                      disabled={
                        !free ||
                        (!!o && !s.freeLife) ||
                        s.fuel >= 10 ||
                        (!['home', 'beacon'].includes(s.location) && s.food < 1)
                      }
                      onClick={() => act((a) => spaceActivity(a, 'charge'))}
                    >
                      展开太阳帆充能
                      {['home', 'beacon'].includes(s.location)
                        ? ''
                        : ' · 消耗 1 食物'}
                    </button>
                    {['home', 'beacon'].includes(s.location) && (
                      <button
                        disabled={!free || s.food >= 12}
                        onClick={() => act((a) => spaceActivity(a, 'supply'))}
                      >
                        对接食物补给
                      </button>
                    )}
                    {s.location === 'echo' && (
                      <button
                        disabled={!free || s.relic}
                        onClick={() => act(recordSpaceRelic)}
                      >
                        {s.relic ? '回声已记入旅程' : '记录遗迹回声'}
                      </button>
                    )}
                  </>
                )}
              </section>
            </>
          )}
          {!s.upgrade && (
            <section className="tribe-context">
              <h2>用 2 零件改变旅程</h2>
              <p>升级后还剩 4 零件，足够建一座前哨。</p>
              <button
                disabled={!free || s.parts < 2}
                onClick={() => act((a) => upgradeSpace(a, 'sail'))}
              >
                展开航行帆 · 航耗减少
              </button>
              <button
                disabled={!free || s.parts < 2}
                onClick={() => act((a) => upgradeSpace(a, 'shield'))}
              >
                安装生态屏障 · 耀斑减弱
              </button>
            </section>
          )}
          {planet && (!o || s.freeLife) && (
            <section className="tribe-context">
              <h2>{STARS[planet].name} · 轨道观测</h2>
              <button
                disabled={!free || s.surveys[planet].includes('water')}
                onClick={() => act((a) => spaceActivity(a, 'water'))}
              >
                扫描水分与基质
              </button>
              <button
                disabled={!free || s.surveys[planet].includes('air')}
                onClick={() => act((a) => spaceActivity(a, 'air'))}
              >
                扫描光照与气候
              </button>
              <p>
                水分读数：
                {s.surveys[planet].includes('water')
                  ? ECOLOGY_TARGETS[planet].water
                  : '待扫描'}{' '}
                / 光照：
                {s.surveys[planet].includes('air')
                  ? ECOLOGY_TARGETS[planet].light
                  : '待扫描'}{' '}
                / 温度：
                {s.surveys[planet].includes('air')
                  ? ECOLOGY_TARGETS[planet].heat
                  : '待扫描'}
              </p>
              {!o && (
                <>
                  <p>
                    前哨消耗 4 零件、2 食物，另需保留 3
                    食物供观察。建立后本次旅程将在这里安家。
                  </p>
                  <button
                    disabled={
                      !free ||
                      s.surveys[planet].length < 2 ||
                      s.food < 5 ||
                      s.parts < 4
                    }
                    onClick={() => act((a) => buildOutpost(a, 'wetland'))}
                  >
                    建立湿地前哨 · 水分容差 ±1
                  </button>
                  <button
                    disabled={
                      !free ||
                      s.surveys[planet].length < 2 ||
                      s.food < 5 ||
                      s.parts < 4
                    }
                    onClick={() => act((a) => buildOutpost(a, 'dome'))}
                  >
                    建立穹顶前哨 · 温度容差 ±1
                  </button>
                </>
              )}
            </section>
          )}
          {o && (
            <section className="tribe-context space-ecology">
              <h2>
                {s.mode === 'won'
                  ? '前哨已经稳定'
                  : s.mode === 'lost'
                    ? '这次观察已结束'
                    : '照料这片新世界'}
              </h2>
              <p>
                {s.mode === 'won'
                  ? '30 秒生态观察已完成。这里保留最后的环境读数，可以回看地表与这一路同行的生命。'
                  : s.mode === 'lost'
                    ? '这里保留本次观察的环境读数。重试前，可以想一想如何安排补给和调节温度。'
                    : '耀斑在观察第 10–20 秒增加温度；加热设定可以随时调整。'}
              </p>
              {ecologyReadings(s).map((r) => (
                <div className="space-reading" key={r.key}>
                  <div>
                    <strong>{ECOLOGY_NAMES[r.key]}</strong>
                    <span>
                      实际 {r.actual} · 目标 {r.target}
                      {r.tolerance ? ` ±${r.tolerance}` : ''}
                    </span>
                  </div>
                  {!finished && (
                    <fieldset
                      className="space-setting"
                      aria-label={`${ECOLOGY_NAMES[r.key]}设定`}
                    >
                      {[0, 1, 2, 3].map((v) => (
                        <button
                          key={v}
                          disabled={!['running', 'paused'].includes(s.mode)}
                          aria-label={`${ECOLOGY_NAMES[r.key]}设为${v}`}
                          aria-pressed={r.setting === v}
                          onClick={() => act((a) => setEcology(a, r.key, v))}
                        >
                          {v}
                        </button>
                      ))}
                    </fieldset>
                  )}
                  <small>
                    {r.key === 'heat'
                      ? `实际温度 = 加热设定 ${r.setting} + 耀斑 ${flareStrength(s)}`
                      : `目前设定 ${r.setting}`}
                    {finished
                      ? ' · 最后一次读数'
                      : r.offset
                        ? r.offset > 0
                          ? ' · 需要降低'
                          : ' · 需要提高'
                        : ' · 在适应范围内'}
                  </small>
                </div>
              ))}
              {!finished && <p>当前耀斑：温度 +{flareStrength(s)}</p>}
              <output>
                {s.mode === 'won'
                  ? '这座前哨已完成本次考验。下方可以回顾谱系，或保留旅程记录开启新的生命。'
                  : s.mode === 'lost'
                    ? '本次考验未通过，可从星海起点重新准备。'
                    : ecologyFeedback(s).hint}
              </output>
              <label>
                生长 {Math.floor(o.growth)}%{' '}
                <progress value={o.growth} max={100} />
              </label>
              <label>
                稳定度 {Math.round(o.stability)}%{' '}
                <progress value={o.stability} max={100} />
              </label>
              {o.trial === null ? (
                <button
                  disabled={!free || s.food < 3}
                  onClick={() => act(startOutpostTrial)}
                >
                  开始 30 秒生态观察
                </button>
              ) : (
                <strong>生态观察 {Math.floor(o.trial)} / 30 秒</strong>
              )}
            </section>
          )}
          {!soundOK && <p>声音尚未开启，点击上方“开启声音”重试。</p>}
        </aside>
      </div>
      {record && (
        <section className="space-ending">
          <ExpeditionReview record={record} />
          <div className="space-replay">
            <h2>另一种生命，会走向哪里？</h2>
            <p>
              保留这次旅程记录，从新的微生物开始。可以选择一项这次曾经拥有的特征作为起点，再探索其他身体和环境。
            </p>
            <label>
              初生特征{' '}
              <select
                value={inherit}
                onChange={(e) => setInherit(e.target.value as TraitId | '')}
              >
                <option value="">初生形态 · 不携带特征</option>
                {TRAITS.filter((t) => known.has(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => onReplay(live.current, inherit || undefined)}
            >
              保留旅程记录 · 开启新的生命
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
