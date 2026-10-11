'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG has no native button element; its draggable g targets expose keyboard selection and arrow adjustment. */
import { useState, useRef } from 'react';
import type { PointerEvent } from 'react';
import {
  listOrgans,
  organAnchor,
  ORGAN_MOUNTS,
  MOUNT_NAMES,
} from './body-layout';
import type { Mount, OrganPlacement } from './body-layout';
import {
  bodyDraft,
  placeDraftOrgan,
  moveDraftOrgan,
  mirrorDraftOrgan,
} from './tidal/body-draft';
import type { TidalAction } from './tidal/types';
import type { World } from './simulation';
import { getStats } from './simulation';
import { BodyPortrait } from './OceanUI';
import {
  ORGANS,
  SLOTS,
  SLOT_NAMES,
  bodyEffects,
  designCost,
  bodyBirthCost,
  validateDesign,
} from './body-design';
import type { BodyDesign, Slot, Organ } from './body-design';
function LegacyBodyEditor({
  world: w,
  onCommit,
}: {
  world: World;
  onCommit: (body: BodyDesign) => void;
}) {
  const [draft, setDraft] = useState<BodyDesign>(() =>
    structuredClone(w.ocean!.body),
  );
  const [slot, setSlot] = useState<Slot>('tail');
  const effects = bodyEffects(draft),
    stats = getStats(w.traits, w.form);
  const error = validateDesign(w, draft);
  function install(organ?: Organ) {
    setDraft((previous) => {
      const next = structuredClone(previous);
      if (organ) next.organs[slot] = organ;
      else delete next.organs[slot];
      return next;
    });
  }
  return (
    <div className="body-lab">
      <div className="lab-preview">
        <div className="lab-eyebrow">
          下一代身体实验室 <span>{w.ocean!.dna} DNA</span>
        </div>
        <BodyPortrait form={w.form} traits={w.traits} body={draft} large />
        <div className="anatomy-slots" aria-label="选择器官安装方向">
          {SLOTS.map((position) => (
            <button
              key={position}
              className={slot === position ? 'selected' : ''}
              aria-pressed={slot === position}
              onClick={() => setSlot(position)}
            >
              <span>{SLOT_NAMES[position]}</span>
              <strong>
                {draft.organs[position]
                  ? ORGANS[draft.organs[position]!].name
                  : '空位'}
              </strong>
            </button>
          ))}
        </div>
        <p>先点身体方位，再安装器官。画面右侧为头部，左侧为尾部。</p>
        <label>
          身体长度 <b>{draft.length.toFixed(1)} 倍</b>
          <input
            aria-label="身体长度"
            type="range"
            min="0.8"
            max="1.5"
            step="0.1"
            value={draft.length}
            onChange={(e) =>
              setDraft({ ...draft, length: Number(e.target.value) })
            }
          />
        </label>
        <label>
          身体宽度 <b>{draft.width.toFixed(1)} 倍</b>
          <input
            aria-label="身体宽度"
            type="range"
            min="0.7"
            max="1.3"
            step="0.1"
            value={draft.width}
            onChange={(e) =>
              setDraft({ ...draft, width: Number(e.target.value) })
            }
          />
        </label>
        <div className="lab-stats">
          <span>
            游速 <b>{Math.round(stats.speed * effects.speed)}</b>
          </span>
          <span>
            转向 <b>{Math.round(effects.turn * 100)}%</b>
          </span>
          <span>
            耗能 <b>{(stats.metabolism * effects.metabolism).toFixed(2)}/秒</b>
          </span>
          <span>
            受伤 <b>{Math.round(effects.damage * 100)}%</b>
          </span>
        </div>
        <p>细长身体游得快、转弯慢；宽身体更耐碰撞，但游速和耗能有代价。</p>
      </div>
      <div className="lab-parts">
        <div className="ocean-step-label">为{SLOT_NAMES[slot]}选择器官</div>
        {(Object.keys(ORGANS) as Organ[]).map((id) => {
          const part = ORGANS[id],
            known = w.ocean!.discovered.includes(id);
          return (
            <button
              key={id}
              disabled={!known}
              className={`lab-organ ${draft.organs[slot] === id ? 'selected' : ''}`}
              aria-pressed={draft.organs[slot] === id}
              onClick={() => install(id)}
            >
              <strong>
                {known ? part.name : '◇ ' + part.name}
                <small>{part.cost} DNA</small>
              </strong>
              <span>{known ? part.hint : part.source}</span>
            </button>
          );
        })}
        <button
          className="text-button"
          disabled={!draft.organs[slot]}
          onClick={() => install()}
        >
          移除这个位置的器官
        </button>
        <div className="lab-birth">
          <span>
            本次孕育 <b>{designCost(draft)} DNA</b>
          </span>
          <small>含 8 DNA 孕育消耗；食物和发现都能获得 DNA。</small>
          <button
            className="primary-button"
            disabled={!!error}
            onClick={() => onCommit(structuredClone(draft))}
          >
            孕育第 {w.generation + 1} 代
          </button>
          <output className="lab-status">
            {error || '身体准备好了。带着新设计回到海里试一试。'}
          </output>
        </div>
      </div>
      <p className="science-note">
        这是身体适应的游戏实验。真实演化发生在种群的许多代之间；观察和获得器官是游戏规则。
      </p>
    </div>
  );
}

const actionNames: Record<TidalAction, string> = {
  'form-skill': '形态技能',
  filter: '展开滤食',
  shell: '缩壳',
  grasp: '抓握 / 投饵',
  reserve: '释放储能',
  ink: '释放墨云',
  anchor: '锚定 / 收回',
};
const mounts = Object.keys(MOUNT_NAMES) as Mount[];
export function BodyEditor(props: {
  world: World;
  onCommit: (
    body: BodyDesign,
    slots?: [TidalAction | null, TidalAction | null],
  ) => void;
  onSlots?: (slots: [TidalAction | null, TidalAction | null]) => void;
}) {
  return props.world.ocean?.tidal?.compat.mode === 'active' ? (
    <TidalBodyEditor {...props} />
  ) : (
    <LegacyBodyEditor {...props} />
  );
}
function TidalBodyEditor({
  world: w,
  onCommit,
  onSlots,
}: {
  world: World;
  onCommit: (
    body: BodyDesign,
    slots?: [TidalAction | null, TidalAction | null],
  ) => void;
  onSlots?: (slots: [TidalAction | null, TidalAction | null]) => void;
}) {
  const [draft, setDraft] = useState(() => bodyDraft(w.ocean!.body));
  const [selected, setSelected] = useState<string | null>(
    () => listOrgans(w.ocean!.body)[0]?.id ?? null,
  );
  const [mount, setMount] = useState<Mount>(
      () => listOrgans(w.ocean!.body)[0]?.mount ?? 'tail',
    ),
    [offset, setOffset] = useState(() => listOrgans(w.ocean!.body)[0]?.t ?? 0);
  const [slots, setSlots] = useState<[TidalAction | null, TidalAction | null]>(
    () => [...w.ocean!.tidal!.abilities.slots],
  );
  const dragging = useRef<{ id: string; draft: BodyDesign } | null>(null);
  const parts = listOrgans(draft),
    chosen = parts.find((p) => p.id === selected);
  const actions: TidalAction[] = [
    'form-skill',
    ...(parts.some((p) => p.organ === 'filter') || w.ocean!.branch === 'radial'
      ? ['filter' as const]
      : []),
    ...(['shell', 'grasp', 'reserve', 'ink', 'anchor'] as const).filter((a) =>
      parts.some((p) => p.organ === a),
    ),
  ];
  const validSlots =
    slots.every((a) => a === null || actions.includes(a)) &&
    !(slots[0] !== null && slots[0] === slots[1]);
  const error = validateDesign(w, draft),
    effects = bodyEffects(draft),
    stats = getStats(w.traits, w.form);
  function select(p: OrganPlacement) {
    setSelected(p.id);
    setMount(p.mount);
    setOffset(p.t);
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    const rect = event.currentTarget.getBoundingClientRect(),
      x = ((event.clientX - rect.left) * 240) / rect.width,
      y = ((event.clientY - rect.top) * 140) / rect.height;
    const part = listOrgans(dragging.current.draft).find(
      (p) => p.id === dragging.current!.id,
    )!;
    const anchors = ORGAN_MOUNTS[part.organ]
      .flatMap((m) =>
        Array.from({ length: 21 }, (_, i) => ({ mount: m, t: (i - 10) / 10 })),
      )
      .map((a) => ({
        ...a,
        ...organAnchor(
          { x: 131, y: 70, angle: -0.12, size: 43, form: w.form, body: draft },
          { ...part, ...a },
        ),
      }));
    const nearest = anchors.sort(
      (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
    )[0];
    const next = moveDraftOrgan(
      dragging.current.draft,
      part.id,
      nearest.mount,
      nearest.t,
    );
    setDraft(next);
    const moved = listOrgans(next).find((p) => p.id === part.id)!;
    setMount(moved.mount);
    setOffset(moved.t);
  }
  function updatePosition(nextMount: Mount, t: number) {
    setMount(nextMount);
    setOffset(t);
    if (chosen) setDraft(moveDraftOrgan(draft, chosen.id, nextMount, t));
  }
  return (
    <div className="body-lab tidal-lab">
      <div className="lab-preview">
        <div className="lab-eyebrow">
          你的下一代 <span>{w.ocean!.dna} DNA</span>
        </div>
        <div className="anatomy-canvas">
          <BodyPortrait form={w.form} traits={w.traits} body={draft} large />
          <svg
            viewBox="0 0 240 140"
            aria-label="拖动器官调整位置"
            onPointerMove={pointerMove}
            onPointerUp={(e) => {
              dragging.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              if (dragging.current) setDraft(dragging.current.draft);
              dragging.current = null;
            }}
          >
            {parts.map((p) => {
              const a = organAnchor(
                {
                  x: 131,
                  y: 70,
                  angle: -0.12,
                  size: 43,
                  form: w.form,
                  body: draft,
                },
                p,
              );
              return (
                <g
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`选择${MOUNT_NAMES[p.mount]}${ORGANS[p.organ].name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(p);
                    } else if (
                      e.key === 'ArrowLeft' ||
                      e.key === 'ArrowRight'
                    ) {
                      e.preventDefault();
                      select(p);
                      setDraft(
                        moveDraftOrgan(
                          draft,
                          p.id,
                          p.mount,
                          Math.max(
                            -1,
                            Math.min(
                              1,
                              Math.round(
                                (p.t + (e.key === 'ArrowLeft' ? -0.1 : 0.1)) *
                                  10,
                              ) / 10,
                            ),
                          ),
                        ),
                      );
                    }
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    select(p);
                    dragging.current = { id: p.id, draft: bodyDraft(draft) };
                    e.currentTarget.ownerSVGElement!.setPointerCapture(
                      e.pointerId,
                    );
                  }}
                >
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={selected === p.id ? 9 : 7}
                    className={selected === p.id ? 'anchor selected' : 'anchor'}
                  />
                  <text x={a.x} y={a.y + 2.5} textAnchor="middle">
                    {p.organ === 'jaw'
                      ? '口'
                      : p.organ === 'fin'
                        ? '鳍'
                        : p.organ === 'spine'
                          ? '刺'
                          : p.organ === 'filter'
                            ? '扇'
                            : p.organ === 'shell'
                              ? '壳'
                              : p.organ === 'grasp'
                                ? '握'
                                : p.organ === 'lateral'
                                  ? '纹'
                                  : '囊'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="lab-tip">拖动器官，或用下方位置按钮调整。右侧是头。</p>
        <div className="anatomy-slots" aria-label="器官安装位置">
          {mounts.map((m) => (
            <button
              key={m}
              className={mount === m ? 'selected' : ''}
              aria-pressed={mount === m}
              onClick={() => updatePosition(m, offset)}
            >
              {MOUNT_NAMES[m]}
            </button>
          ))}
        </div>
        <label>
          沿身体的位置{' '}
          <input
            aria-label="器官沿身体的位置"
            type="range"
            min="-1"
            max="1"
            step="0.1"
            value={offset}
            onChange={(e) => updatePosition(mount, Number(e.target.value))}
          />
        </label>
        <div className="lab-inline-actions">
          <button
            disabled={!chosen || !['left', 'right'].includes(chosen.mount)}
            onClick={() => setDraft(mirrorDraftOrgan(draft, chosen!.id))}
          >
            左右对称
          </button>
          <button
            disabled={!chosen}
            onClick={() => {
              setDraft({
                ...draft,
                placements: parts.filter((p) => p.id !== selected),
              });
              setSelected(null);
            }}
          >
            移除所选
          </button>
          <button
            onClick={() => {
              setDraft(bodyDraft(w.ocean!.body));
              setSelected(null);
            }}
          >
            还原草稿
          </button>
        </div>
        <label>
          长 {draft.length.toFixed(1)} 倍
          <input
            aria-label="身体长度"
            type="range"
            min="0.8"
            max="1.5"
            step="0.1"
            value={draft.length}
            onChange={(e) =>
              setDraft({ ...draft, length: Number(e.target.value) })
            }
          />
        </label>
        <label>
          宽 {draft.width.toFixed(1)} 倍
          <input
            aria-label="身体宽度"
            type="range"
            min="0.7"
            max="1.3"
            step="0.1"
            value={draft.width}
            onChange={(e) =>
              setDraft({ ...draft, width: Number(e.target.value) })
            }
          />
        </label>
        <details className="lab-details">
          <summary>身体的取舍</summary>
          <div className="lab-stats">
            <span>
              游速 <b>{Math.round(stats.speed * effects.speed)}</b>
            </span>
            <span>
              转向 <b>{Math.round(effects.turn * 100)}%</b>
            </span>
            <span>
              耗能{' '}
              <b>{(stats.metabolism * effects.metabolism).toFixed(2)}/秒</b>
            </span>
          </div>
          <p>细长更快，宽身耐碰撞；储满能量时转向更慢。</p>
        </details>
      </div>
      <div className="lab-parts">
        <div className="ocean-step-label">
          安装到{MOUNT_NAMES[mount]} · {parts.length}/8
        </div>
        {(Object.keys(ORGANS) as Organ[]).map((id) => {
          const known = w.ocean!.discovered.includes(id),
            legal = ORGAN_MOUNTS[id].includes(mount),
            part = ORGANS[id];
          return (
            <button
              key={id}
              disabled={!known || !legal}
              className="lab-organ"
              onClick={() => {
                const next = placeDraftOrgan(draft, id, mount, offset);
                setDraft(next);
                if (
                  [
                    'filter',
                    'shell',
                    'grasp',
                    'reserve',
                    'ink',
                    'anchor',
                  ].includes(id) &&
                  !listOrgans(draft).some((p) => p.organ === id) &&
                  slots.includes(null)
                ) {
                  const filled = [...slots] as typeof slots;
                  filled[filled.indexOf(null)] = id as TidalAction;
                  setSlots(filled);
                }
                const p = listOrgans(next).find(
                  (p) => p.mount === mount && p.t === offset,
                );
                if (p) select(p);
              }}
            >
              <strong>
                {known ? part.name : '◇ ' + part.name}
                <small>{part.cost} DNA</small>
              </strong>
              <span>
                {known ? (legal ? part.hint : '换一个安装位置') : part.source}
              </span>
            </button>
          );
        })}
        <div className="lab-abilities">
          {slots.map((action, index) => (
            <label key={index}>
              {index === 0 ? 'J' : 'L'} 能力
              <select
                aria-label={`${index === 0 ? 'J' : 'L'}能力`}
                value={action ?? ''}
                onChange={(e) => {
                  const next: [TidalAction | null, TidalAction | null] = [
                    ...slots,
                  ];
                  next[index] = (e.target.value as TidalAction) || null;
                  setSlots(next);
                }}
              >
                <option value="">空位</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {actionNames[a]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            disabled={
              !validSlots ||
              slots.some(
                (a) =>
                  a !== null &&
                  ![
                    'form-skill',
                    ...(w.ocean!.branch === 'radial' ? ['filter'] : []),
                    ...listOrgans(w.ocean!.body).map((p) => p.organ),
                  ].includes(a),
              )
            }
            onClick={() => onSlots?.(slots)}
          >
            仅应用能力配置
          </button>
        </div>
        <div className="lab-birth">
          <span>
            孕育代价 <b>{bodyBirthCost(w, draft)} DNA</b>
          </span>
          <small>8 DNA 孕育 + 新增器官净差额；取消不扣除。</small>
          <button
            className="primary-button"
            disabled={!!error || !validSlots}
            onClick={() => onCommit(bodyDraft(draft), slots)}
          >
            孕育第 {w.generation + 1} 代
          </button>
          <output className="lab-status">
            {error ||
              (!validSlots
                ? '两个能力位不能重复，且需要对应器官。'
                : '准备好了，诞生后在附近试一试。')}
          </output>
        </div>
      </div>
      <p className="science-note">
        这是演化游戏实验；真实演化发生在种群的许多代之间。
      </p>
    </div>
  );
}
