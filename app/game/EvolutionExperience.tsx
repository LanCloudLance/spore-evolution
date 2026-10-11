'use client';
import { drawLandFeatures } from './land-features';
import { LAND_FEATURES, type LandFeature } from './land-catalog';
import { OCEAN_DNA_BODIES } from './ocean-dna';
import type { OceanDnaBody } from './ocean-dna';
import { MICROBE_BODIES } from './dna-evolution';
import { useEffect, useRef, useState } from 'react';
import type { World } from './simulation';
import { TRAITS } from './simulation';
import { FORMS } from './forms';
import { evolutionFrame, evolutionStructure } from './evolution-presentation';
import { BodyPortrait } from './OceanUI';
import { drawBody } from './ocean-render';
import { drawOrganism } from './render';
import {
  revealing,
  evolutionTrialText,
  evolutionTrialTarget,
} from './evolution-experience';
export function EvolutionExperience({
  world: w,
  live,
  onSkip,
  onResume,
  onDismiss,
}: {
  world: World;
  live: () => World;
  onSkip: () => void;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const active = revealing(w),
    e = w.evolution;
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const paint = () => {
      const c = canvas.current?.getContext('2d'),
        state = live(),
        ev = state.evolution;
      if (!c || !ev) return;
      const presentation = evolutionFrame(state, reduced)!;
      const p = presentation.progress,
        t = reduced ? 0 : ev.elapsed;
      c.clearRect(0, 0, 440, 300);
      const halo = c.createRadialGradient(220, 146, 12, 220, 146, 160);
      halo.addColorStop(0, '#b3cda12e');
      halo.addColorStop(1, '#729ea000');
      c.fillStyle = halo;
      c.fillRect(0, 0, 440, 300);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(
          220,
          146,
          105 + i * 20,
          44 + i * 13,
          -0.35 + (reduced ? 0 : t * 0.08),
          0,
          Math.PI * 2,
        );
        c.strokeStyle = ['#e0e5b54a', '#b7d5c42a', '#a1b6d321'][i];
        c.lineWidth = 1;
        c.stroke();
      }
      const body = presentation.body;
      const size = ['strider', 'stalker'].includes(state.form)
        ? 60 / Math.max(1, (body?.legs ?? 1) * (body?.width ?? 1))
        : (state.form === 'jelly' ? 59 : 70) /
          Math.max(1, (body?.length ?? 1) * 0.95);
      if (presentation.parentOpacity > 0) {
        c.globalAlpha = presentation.parentOpacity;
        if ((ev.before.form ?? 'microbe') === 'microbe')
          drawOrganism(
            c,
            250,
            142,
            55,
            -0.1,
            t,
            ev.before.traits,
            false,
            false,
            {},
            ev.before.dnaLineage?.body,
          );
        else
          drawBody(
            c,
            ev.before.form ?? 'microbe',
            250,
            142,
            size,
            -0.1,
            t,
            ev.before.traits,
            false,
            undefined,
            ev.before.body,
            ev.before.landOrgan,
            1,
            ev.before.adaptation,
          );
      }
      if (presentation.parentOpacity > 0 && ev.before.landFeatures)
        drawLandFeatures(
          c,
          { x: 250, y: 142, angle: -0.1 },
          size,
          ev.before.landFeatures,
          t,
        );
      c.globalAlpha = presentation.childOpacity;
      if (state.form === 'microbe')
        drawOrganism(
          c,
          250,
          142,
          55,
          -0.1,
          t,
          state.traits,
          false,
          false,
          presentation.traits,
          state.dnaLineage?.body,
        );
      else
        drawBody(
          c,
          state.form,
          250,
          142,
          size,
          -0.1,
          t,
          state.traits,
          false,
          undefined,
          body,
          state.land?.organ ?? undefined,
          1,
          state.land?.protection ?? state.shore?.protection ?? undefined,
          presentation.formation,
        );
      if (presentation.childOpacity > 0 && state.land?.features)
        drawLandFeatures(
          c,
          { x: 250, y: 142, angle: -0.1 },
          size,
          state.land.features,
          t,
        );
      c.globalAlpha = 1;
      if (!reduced)
        for (let i = 0; i < 26; i++) {
          const a = i * 2.399 + t * 0.3,
            r = 60 + Math.sin(Math.PI * p) * 65 + (i % 4) * 9;
          c.beginPath();
          c.arc(
            220 + Math.cos(a) * r,
            142 + Math.sin(a) * r * 0.72,
            1 + (i % 3) * 0.6,
            0,
            Math.PI * 2,
          );
          c.fillStyle = `rgba(216,238,181,${Math.sin(Math.PI * p) * 0.3})`;
          c.fill();
        }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [active, live, reduced]);
  if (!e || e.generation !== w.generation || e.habitat !== w.habitat)
    return null;
  const trait = TRAITS.find(
    (t) => w.traits.includes(t.id) && !e.before.traits.includes(t.id),
  );
  const oceanDna = e.choice.startsWith('ocean-dna:')
    ? OCEAN_DNA_BODIES[e.choice.slice(10) as OceanDnaBody]
    : undefined;
  const landPart = e.choice.startsWith('landpart:')
    ? LAND_FEATURES[e.choice.split(':')[1] as LandFeature]
    : undefined;
  const name =
    landPart?.name ??
    oceanDna?.name ??
    (e.choice === 'anatomy'
      ? '你设计的新身体'
      : e.choice === 'reservoir'
        ? '储水囊'
        : e.choice === 'skin'
          ? '保湿皮膜'
          : e.choice === 'crest'
            ? '共鸣冠'
            : e.choice === 'plates'
              ? '护肩骨板'
              : w.habitat === 'pond'
                ? w.dnaLineage?.body && w.dnaLineage.body !== 'ancestor'
                  ? MICROBE_BODIES[w.dnaLineage.body].name
                  : (trait?.name ?? '新的特征')
                : FORMS[w.form].name);
  const benefit =
    landPart?.benefit ??
    oceanDna?.benefit ??
    (e.choice === 'anatomy'
      ? '嘴、长刺和身体比例已经改变。回到环境中验证它们的方向和用途。'
      : e.choice === 'reservoir'
        ? '体内留住更多水分，延长离水探索。'
        : e.choice === 'skin'
          ? '皮膜减缓失水，维持它也需要能量。'
          : e.choice === 'crest'
            ? '共鸣冠扩大呼唤范围，分享食物的消耗减半。'
            : e.choice === 'plates'
              ? '骨板减轻冲撞伤害，厚重的身体移动更慢。'
              : w.habitat === 'pond'
                ? w.dnaLineage?.body && w.dnaLineage.body !== 'ancestor'
                  ? MICROBE_BODIES[w.dnaLineage.body].benefit
                  : (trait?.benefit ?? '观察新身体的变化。')
                : FORMS[w.form].skillHint);
  const structure = evolutionStructure(w),
    presentation = evolutionFrame(w, reduced)!;
  if (active)
    return (
      <section className="evolution-reveal" aria-label="新生命诞生">
        <div className="evolution-reveal-card">
          <small>
            第 {w.generation} 代 ·{' '}
            {reduced
              ? '形态对照'
              : ['上一代留下生命的线索', structure.title, '新身体，第一次活动'][
                  presentation.phase
                ]}
          </small>
          <h2>{name}</h2>
          <canvas
            ref={canvas}
            width={440}
            height={300}
            aria-label={`${FORMS[e.before.form ?? 'microbe'].name}形成新的${name}`}
          />
          <ol className="evolution-stages" aria-label="诞生进度">
            {['生命延续', '结构展开', '第一次活动'].map((stage, index) => (
              <li
                key={stage}
                aria-current={presentation.phase === index ? 'step' : undefined}
                className={index <= presentation.phase ? 'reached' : ''}
              >
                <i aria-hidden="true" />
                {stage}
              </li>
            ))}
          </ol>
          <p className="evolution-structure">{structure.detail}</p>
          <div className="evolution-comparison">
            <div>
              <BodyPortrait
                form={e.before.form ?? 'microbe'}
                traits={e.before.traits}
                microbeBody={e.before.dnaLineage?.body}
                body={e.before.body}
                landOrgan={e.before.landOrgan}
                adaptation={e.before.adaptation}
              />
              <span>上一代</span>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <BodyPortrait
                form={w.form}
                traits={w.traits}
                microbeBody={w.dnaLineage?.body}
                body={w.land?.body ?? w.shore?.body ?? w.ocean?.body}
                landOrgan={w.land?.organ ?? undefined}
                adaptation={
                  w.land?.protection ?? w.shore?.protection ?? undefined
                }
              />
              <span>这一代 · {name}</span>
            </div>
          </div>
          <p>{benefit}</p>
          <div className="evolution-controls">
            <button onClick={onResume}>
              {w.mode === 'paused' ? '继续诞生' : '暂停观察'}
            </button>
            <button onClick={onSkip} disabled={w.mode === 'paused'}>
              跳过演出 · 试试新身体
            </button>
          </div>
          <small className="evolution-science">
            游戏把多代变化压缩为一次诞生。
          </small>
        </div>
      </section>
    );
  if (e.dismissed || w.mode === 'won' || w.mode === 'dead') return null;
  const trial = evolutionTrialText(w)!,
    target = evolutionTrialTarget(w),
    dx = target ? target.x - w.player.x : 0,
    dy = target ? target.y - w.player.y : 0;
  const bearing = target
    ? ['东', '东南', '南', '西南', '西', '西北', '北', '东北'][
        (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
      ]
    : null;
  return (
    <aside
      className={`evolution-trial ${e.complete ? 'complete' : ''}`}
      aria-label="新身体实践"
    >
      <small>{e.complete ? '第一次实践完成' : '新身体实践 · 可选'}</small>
      <strong>{trial.title}</strong>
      <details className="hud-details">
        <summary>展开练习提示</summary>
        <p>{trial.hint}</p>
        <output>{trial.progress}</output>
        {target && (
          <span>
            附近目标 · {bearing}方 {Math.round(Math.hypot(dx, dy))}
          </span>
        )}
      </details>
      <button onClick={onDismiss}>
        {e.complete ? '记住这次体验' : '收起提示，继续探索'}
      </button>
    </aside>
  );
}
