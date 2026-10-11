'use client';
import { useEffect, useRef } from 'react';
import type { BodyDesign } from './body-design';
import type { World } from './simulation';
import type { LandChoice } from './land';
import { landStats } from './land';
import { drawBody } from './ocean-render';
export function EvolutionStudio({
  world: w,
  choice,
  body,
  onChange,
}: {
  world: World;
  choice: LandChoice;
  body: BodyDesign;
  onChange: (body: BodyDesign) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; body: BodyDesign } | null>(null);
  const form = choice === 'strider' || choice === 'stalker' ? choice : w.form;
  const organ =
    choice === 'crest' || choice === 'plates'
      ? choice
      : (w.land!.organ ?? undefined);
  const stats = landStats({
    ...w,
    form,
    land: { ...w.land!, body, organ: organ ?? null },
  });
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let frame = 0;
    const draw = (time: number) => {
      c.clearRect(0, 0, 560, 290);
      const t = time / 1000;
      for (let i = 0; i < 28; i++) {
        const a = i * 2.4 + t * 0.08,
          r = 88 + i * 4;
        c.beginPath();
        c.arc(
          280 + Math.cos(a) * r,
          145 + Math.sin(a) * r * 0.55,
          1 + (i % 3),
          0,
          Math.PI * 2,
        );
        c.fillStyle = '#cbeaa038';
        c.fill();
      }
      drawBody(
        c,
        form,
        280,
        145,
        42 / Math.max(1, ((body.legs ?? 1) * body.width) / 1.4),
        0,
        t,
        w.traits,
        false,
        undefined,
        body,
        organ,
        1,
        w.land?.protection ?? undefined,
      );
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [body, form, organ, w.traits, w.land?.protection]);
  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, n));
  return (
    <section className="evolution-studio" aria-label="身体塑形实验">
      <div className="studio-heading">
        <span>生命塑形台</span>
        <small>拖动身体：横向拉长 · 纵向加宽</small>
      </div>
      <canvas
        ref={canvas}
        width={560}
        height={290}
        aria-label="新身体动态预览，可用下方滑块调整同样的身体比例"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            body: structuredClone(body),
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          onChange({
            ...d.body,
            length: clamp(d.body.length + (e.clientX - d.x) / 240, 0.8, 1.5),
            width: clamp(d.body.width + (e.clientY - d.y) / 200, 0.7, 1.3),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      />
      <div className="studio-sliders">
        {(
          [
            { key: 'length', name: '躯干长度', min: 0.8, max: 1.5 },
            { key: 'width', name: '躯干宽度', min: 0.7, max: 1.3 },
            { key: 'legs', name: '腿的伸展', min: 0.75, max: 1.4 },
          ] as const
        ).map((item) => (
          <label key={item.key}>
            {item.name}
            <output>{Math.round((body[item.key] ?? 1) * 100)}%</output>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={0.01}
              value={body[item.key] ?? 1}
              onChange={(e) =>
                onChange({ ...body, [item.key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <div className="studio-effects">
        <span>
          移动 <b>{Math.round(stats.speed)}</b>
        </span>
        <span>
          耗能 <b>{stats.metabolism.toFixed(2)}</b> / 秒基准
        </span>
        <span>
          承伤 <b>{Math.round(stats.damage * 100)}%</b>
        </span>
      </div>
      <p>
        长腿提高速度，也需要更多能量；宽身体更耐撞，游走更费力。试着捏出你想带到林地的下一代。
      </p>
    </section>
  );
}
