'use client';
import { StageLifeControls } from './StageLifeControls';
import { continueStageLife, reviewStageLife } from './stage-life';
import { LearningMenu } from './LearningMenu';
import { selectLearnedSkill } from './lineage-learning';
import { cityCapacity } from './civilization';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CivilizationState,
  CityNodeId,
  CityResource,
  CityRoute,
} from './civilization';
import {
  CITY_NAMES,
  CITY_RESOURCES,
  CITY_COST,
  cityNode,
  cityRecipe,
  cityGoal,
  cityCostLabel,
  buildCityNode,
  assignCityRoute,
  organizeCityProduction,
  startCityCrisis,
  repairCityBridge,
  launchCityVoyage,
  stepCivilization,
  cityProduction,
} from './civilization';
import { CityMap } from './CityMap';
import { citySupplyRoutes } from './city-guidance';
import type { CityEvent } from './civilization';
import { BodyPortrait } from './OceanUI';
import { GameAudio } from './audio';
import { AudioVolumes } from './AudioVolumes';
export function CivilizationGame({
  onSpace,
  hasSpace,
  checkpoint,
  current,
  onProgress,
  onExit,
  onSave,
  saveStatus,
  readCurrent,
}: {
  onSpace: (s: CivilizationState) => void;
  hasSpace: boolean;
  checkpoint: CivilizationState;
  current: CivilizationState;
  onProgress: (s: CivilizationState) => void;
  onExit: (s: CivilizationState) => void;
  onSave: () => void;
  saveStatus: string;
  readCurrent?: () => CivilizationState | undefined;
}) {
  const [initial] = useState(() => structuredClone(checkpoint));
  const [entry] = useState(() => structuredClone(readCurrent?.() ?? current));
  const live = useRef(structuredClone(entry)),
    [s, setS] = useState(entry);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [reviewCity, setReviewCity] = useState(false);
  const mutePreference = useRef(true);
  const [selected, setSelected] = useState<CityNodeId>('camp'),
    [courier, setCourier] = useState('leader');
  const [draft, setDraft] = useState<CityRoute>(() => ({
    ...(entry.couriers[0].route ?? {
      from: 'grove',
      to: 'camp',
      resource: 'wood',
      safe: false,
    }),
  }));
  const audio = useRef<GameAudio | null>(null),
    [muted, setMuted] = useState(true),
    [soundOK, setSoundOK] = useState(true);
  const publish = useCallback(() => {
    setS(structuredClone(live.current));
    onProgress(live.current);
  }, [onProgress]);
  const act = useCallback(
    (fn: (s: CivilizationState) => boolean) => {
      if (fn(live.current))
        audio.current?.cue(live.current.mode === 'won' ? 'win' : 'food');
      publish();
    },
    [publish],
  );
  const resume = useCallback(() => {
    setReviewCity(false);
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
    let feedback: CityEvent[] = [];
    let previousTime = live.current.time;
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
    window.addEventListener('keydown', key);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const mode = live.current.mode;
      if (live.current.time < previousTime) feedback = [];
      stepCivilization(live.current, dt, (e) => {
        feedback.push(e);
      });
      previousTime = live.current.time;
      feedback = feedback
        .filter((e) => live.current.time - e.at < 2)
        .slice(-24);
      audio.current?.setPlaying(live.current.mode === 'running');
      if (now - hud > 80 || mode !== live.current.mode) {
        hud = now;
        setEvents([...feedback]);
        publish();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      audio.current?.dispose();
      audio.current = null;
    };
  }, [pause, publish]);
  const n = cityNode(s, selected),
    running = s.mode === 'running',
    planning = running || s.mode === 'paused';
  const editCourier = (id: string) => {
    setCourier(id);
    const r = s.couriers.find((c) => c.id === id)?.route;
    setDraft(
      r
        ? { ...r }
        : { from: 'grove', to: 'camp', resource: 'wood', safe: false },
    );
  };
  return (
    <main className="colony-shell city-shell">
      <header className="colony-header">
        <div>
          <small>第七章 / 彼此需要的城市</small>
          <h1>每一道灯光，都来自一次协作。</h1>
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
              const next = !muted;
              mutePreference.current = next;
              setMuted(next);
              audio.current ??= new GameAudio('colony');
              audio.current.setMuted(next);
            }}
          >
            {!soundOK ? '开启声音' : `音乐${muted ? '关' : '开'}`}
          </button>
          <button disabled={!planning} onClick={pause}>
            {s.mode === 'paused' ? '继续' : '暂停'}
          </button>
          <button onClick={() => onExit(live.current)}>返回部落</button>
          <LearningMenu
            state={s}
            stage="city"
            onSelect={(id) => {
              selectLearnedSkill(live.current, id, 'city');
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
          {s.freeLife && s.mode !== 'won' && (
            <StageLifeControls
              state={s}
              stayLabel="留下经营 · 继续建设"
              onStay={() => {
                if (continueStageLife(live.current)) {
                  setReviewCity(false);
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
      <div className="city-goal">
        <small>
          {s.standalone ? '独立体验延续' : `第 ${s.generation} 代的旅程`}
        </small>
        <strong>{cityGoal(s)}</strong>
        <output>{s.notice}</output>
      </div>
      <div className="city-layout">
        <section className="city-scene">
          <CityMap
            s={s}
            selected={selected}
            onSelect={setSelected}
            courier={courier}
            onCourier={editCourier}
            events={events}
          />
          {s.mode !== 'running' &&
            s.mode !== 'paused' &&
            !(s.mode === 'won' && reviewCity) && (
              <div className="colony-overlay city-overlay">
                <div>
                  <small>
                    {s.mode === 'ready'
                      ? '从部落走向文明'
                      : s.mode === 'won'
                        ? '第七章完成'
                        : '供给中断'}
                  </small>
                  <h2>
                    {s.mode === 'ready'
                      ? '让资源找到需要它的地方。'
                      : s.mode === 'won'
                        ? '山谷的灯，照向了星空。'
                        : '换条路，再试一次。'}
                  </h2>
                  <p>
                    {s.mode === 'ready'
                      ? `你与 ${s.couriers.length - 1} 名成员继续合作。建设设施、安排运输、制造远航器；每份物资都要真正抵达，生产链才会转动。`
                      : s.notice}
                  </p>
                  <StageLifeControls
                    state={s}
                    stayLabel="留下经营 · 继续建设"
                    onStay={() => {
                      if (continueStageLife(live.current)) {
                        setReviewCity(false);
                        publish();
                      }
                    }}
                    onReview={() => {
                      if (reviewStageLife(live.current)) publish();
                    }}
                  />
                  {s.mode === 'won' && (
                    <button onClick={() => onSpace(live.current)}>
                      {hasSpace ? '继续星海旅程' : '驶入星海 · 为生命寻找新家'}
                    </button>
                  )}
                  {s.mode === 'won' && (
                    <button onClick={() => setReviewCity(true)}>
                      看看亮起的城市
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
                      ? '建设第一条生产链'
                      : '从文明起点再试一次'}
                  </button>
                </div>
              </div>
            )}
          {s.mode === 'paused' && (
            <div className="city-planning">
              <span>已暂停 · 可以点选设施和运输队，调整路线</span>
              <button onClick={resume}>继续生产</button>
            </div>
          )}
          {s.mode === 'won' && reviewCity && (
            <div className="city-planning">
              <span>这座城市留下了你们的选择</span>
              <button onClick={() => onSpace(live.current)}>
                {hasSpace ? '继续星海旅程' : '驶入星海 · 为生命寻找新家'}
              </button>
            </div>
          )}
          <div className="city-team-picker" aria-label="选择要调度的运输队">
            {s.couriers.map((c, i) => (
              <button
                key={c.id}
                aria-pressed={courier === c.id}
                onClick={() => editCourier(c.id)}
              >
                {i === 0 ? '你' : `成员 ${i}`}
                <small>
                  {c.blocked
                    ? '封路'
                    : c.cargo
                      ? `${c.load}${CITY_RESOURCES[c.cargo]}`
                      : c.route
                        ? s.mode === 'running'
                          ? '执行中'
                          : s.mode === 'paused'
                            ? '已暂停'
                            : '已记录'
                        : '待命'}
                </small>
              </button>
            ))}
          </div>
          <div className="city-legend">
            <span>● 浅蓝：矿石</span>
            <span>● 金色：能量 / 食物</span>
            <span>● 淡紫：零件</span>
            <span>点选运输队，再点设施安排补给 · 实线是当前行程</span>
          </div>
        </section>
        <aside className="colony-panel city-panel">
          <div className="city-node-picker">
            {s.nodes.map((node) => (
              <button
                key={node.id}
                aria-pressed={selected === node.id}
                onClick={() => setSelected(node.id)}
              >
                {CITY_NAMES[node.id]}
              </button>
            ))}
          </div>
          <section className="tribe-context">
            <h2>{CITY_NAMES[selected]}</h2>
            <p>{cityRecipe(s, selected)}</p>
            {cityProduction(s, selected) && (
              <div className="city-production">
                <strong>
                  {s.mode === 'won'
                    ? '生产记录已保存'
                    : cityProduction(s, selected)!.label}
                </strong>
                <progress
                  aria-label={`${CITY_NAMES[selected]}生产进度`}
                  max={1}
                  value={cityProduction(s, selected)!.progress}
                />
              </div>
            )}
            {n.built ? (
              <div className="city-stock">
                {Object.entries(n.stock)
                  .filter(([, v]) => v > 0)
                  .map(([r, v]) => (
                    <span key={r}>
                      {CITY_RESOURCES[r as CityResource]} <b>{v}</b>
                    </span>
                  ))}
                {Object.values(n.stock).every((v) => v === 0) && (
                  <span>暂无物资，等待生产或送达</span>
                )}
              </div>
            ) : (
              <>
                <p>
                  中央营地建材：
                  {cityCostLabel(CITY_COST[selected as keyof typeof CITY_COST])}
                </p>
                {selected === 'power' ? (
                  <div className="city-energy">
                    <button
                      disabled={!running}
                      onClick={() =>
                        act((a) => buildCityNode(a, 'power', 'wind'))
                      }
                    >
                      建设风能站<small>无需燃料 · 暴雨会降低输出</small>
                    </button>
                    <button
                      disabled={!running}
                      onClick={() =>
                        act((a) => buildCityNode(a, 'power', 'fuel'))
                      }
                    >
                      建设燃料站<small>消耗食物 · 天气中输出稳定</small>
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={!running}
                    onClick={() => act((a) => buildCityNode(a, selected))}
                  >
                    建设{CITY_NAMES[selected]}
                  </button>
                )}
                <small>建材不足时，从木石采集地运回中央营地。</small>
              </>
            )}
            {planning && citySupplyRoutes(s, selected).length > 0 && (
              <div className="city-supply">
                <strong>
                  派
                  {courier === 'leader'
                    ? '你'
                    : `成员 ${s.couriers.findIndex((c) => c.id === courier)}`}
                  来补给
                </strong>
                <small>当前货物先送完，再执行新路线。</small>
                {citySupplyRoutes(s, selected).map((route) => (
                  <button
                    key={route.resource}
                    onClick={() =>
                      act((a) => {
                        const ok = assignCityRoute(a, courier, route);
                        if (ok) setDraft(route);
                        return ok;
                      })
                    }
                  >
                    运{CITY_RESOURCES[route.resource]}：{CITY_NAMES[route.from]}{' '}
                    → {CITY_NAMES[route.to]}
                    {route.safe ? ' · 高地' : ''}
                  </button>
                ))}
              </div>
            )}
            {selected === 'relay' &&
              n.built &&
              s.crisis !== null &&
              !s.bridgeFixed && (
                <button
                  disabled={!running}
                  onClick={() => act(repairCityBridge)}
                >
                  使用本站物资 · 修复断桥
                </button>
              )}
            {selected === 'port' &&
              n.built &&
              (s.crisis === null ? (
                <button
                  disabled={!running || !cityNode(s, 'relay').built}
                  onClick={() => act(startCityCrisis)}
                >
                  开始试航准备 · 应对供给危机
                </button>
              ) : (
                <button
                  disabled={!running || !s.bridgeFixed}
                  onClick={() => act(launchCityVoyage)}
                >
                  装载港口物资 · 开启远航
                </button>
              ))}
          </section>
          {s.crisis !== null && (
            <div className="city-alert">
              <strong>
                {s.bridgeFixed
                  ? '直达路已经恢复'
                  : `断桥危机 · ${Math.ceil(s.crisis)} 秒`}
              </strong>
              <span>
                {s.launched
                  ? '远航准备已经完成。运输与补给记录会随旅程继续保留。'
                  : s.bridgeFixed
                    ? '补齐远航港的物资，即可出发。'
                    : '跨河路线改为高地绕行，把 3 零件和 2 能量送到维修站。可暂停调整。'}
              </span>
            </div>
          )}
          <section className="tribe-context city-dispatch">
            <h3>运输调度 · 载量 {cityCapacity(s)}</h3>
            <p>物资在出发地装车，在目的地交付。改派时会先送完车上的货。</p>
            <button
              disabled={
                !planning ||
                ['farm', 'quarry', 'power', 'workshop'].some(
                  (id) => !cityNode(s, id as CityNodeId).built,
                )
              }
              onClick={() =>
                act((a) => {
                  const ok = organizeCityProduction(a),
                    r = a.couriers.find((c) => c.id === courier)?.route;
                  if (ok && r) setDraft({ ...r });
                  return ok;
                })
              }
            >
              应用基础分工
            </button>
            <small>
              矿石与能量入厂，零件回营，食物送往能源站或营地。会替换现有路线。
            </small>
            <label>
              运输队
              <select
                value={courier}
                onChange={(e) => editCourier(e.target.value)}
              >
                {s.couriers.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {i === 0 ? '你' : `成员 ${i}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="city-route-fields">
              <label>
                出发地
                <select
                  value={draft.from}
                  onChange={(e) =>
                    setDraft({ ...draft, from: e.target.value as CityNodeId })
                  }
                >
                  {s.nodes
                    .filter((a) => a.built)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {CITY_NAMES[a.id]}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                目的地
                <select
                  value={draft.to}
                  onChange={(e) =>
                    setDraft({ ...draft, to: e.target.value as CityNodeId })
                  }
                >
                  {s.nodes
                    .filter((a) => a.built)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {CITY_NAMES[a.id]}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              运送物资
              <select
                value={draft.resource}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    resource: e.target.value as CityResource,
                  })
                }
              >
                {Object.entries(CITY_RESOURCES).map(([r, name]) => (
                  <option key={r} value={r}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="city-safe">
              <input
                type="checkbox"
                checked={draft.safe}
                onChange={(e) => setDraft({ ...draft, safe: e.target.checked })}
              />
              高地绕行 · 路更远，但避开断桥
            </label>
            <button
              disabled={!planning || draft.from === draft.to}
              onClick={() => act((a) => assignCityRoute(a, courier, draft))}
            >
              确认这条运输路线
            </button>
          </section>
          <div className="city-couriers">
            {s.couriers.map((c, i) => (
              <div className="city-courier" key={c.id}>
                <BodyPortrait
                  form={c.form}
                  body={c.newborn ? s.body : undefined}
                  traits={c.newborn ? s.traits : []}
                  landOrgan={c.newborn ? s.organ : undefined}
                  adaptation={c.newborn ? s.adaptation : undefined}
                />
                <div>
                  <strong>
                    {i === 0 ? '你' : `成员 ${i}`}
                    {c.blocked ? ' · 封路等待' : ''}
                  </strong>
                  <small>
                    {c.cargo
                      ? `${c.load} ${CITY_RESOURCES[c.cargo]} → ${CITY_NAMES[c.destination!]}`
                      : c.route
                        ? `等待 / 前往${CITY_NAMES[c.route.from]}`
                        : '待命'}
                  </small>
                  <small>
                    {c.route
                      ? `${CITY_NAMES[c.route.from]} → ${CITY_NAMES[c.route.to]} · ${CITY_RESOURCES[c.route.resource]}`
                      : '尚未分配路线'}
                  </small>
                </div>
                <button disabled={!planning} onClick={() => editCourier(c.id)}>
                  改派
                </button>
                {c.route && (
                  <button
                    disabled={!planning}
                    aria-pressed={c.route.safe}
                    onClick={() =>
                      act((a) =>
                        assignCityRoute(a, c.id, {
                          ...c.route!,
                          safe: !c.route!.safe,
                        }),
                      )
                    }
                  >
                    {c.route.safe ? '高地' : '直达'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="colony-science">
            能源、运输和生产改变了生活方式；你的生物身体与谱系仍然保留。这里是一套虚构的协作系统，不代表社会只有一条发展道路。
          </p>
          {!soundOK && <small>声音尚未开启，点击上方“开启声音”重试。</small>}
        </aside>
      </div>
    </main>
  );
}
