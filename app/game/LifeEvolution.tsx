'use client';
import { LAND_FEATURES, type LandFeature } from './land-catalog';
import { activeLandFeature } from './land-features';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { World } from './simulation';
import { nextGenerationCandidates } from './biological-evolution';
import { DNA_SOURCES, MICROBE_BODIES } from './dna-evolution';
import type { MicrobeBody } from './dna-evolution';
import type { DnaSource } from './dna-evolution';
import { LEARNED_SKILLS, knowsSkill } from './lineage-learning';
import type { LearnedSkill } from './lineage-learning';
import { BodyPortrait } from './OceanUI';
import { oceanDnaDraft } from './ocean-dna';
import type { OceanDnaBody } from './ocean-dna';
import type { BodyForm } from './forms';

export function LifeEvolution({
  world,
  onCommit,
  onGuide,
  onReturn,
  onLearn,
  onFeature,
  children,
}: {
  world: World;
  onCommit: (id: string) => void;
  onGuide: (id: string, intent?: 'hunt' | 'visit') => void;
  onReturn: () => void;
  onLearn: (id: LearnedSkill | null) => void;
  children?: ReactNode;
  onFeature?: (id: LandFeature) => void;
}) {
  const candidates = nextGenerationCandidates(world);
  const [selected, setSelected] = useState(
    () =>
      candidates.find((c) => !c.gate)?.id ??
      candidates.find((c) => c.available)?.id ??
      candidates[0]?.id,
  );
  const candidate = candidates.find((c) => c.id === selected) ?? candidates[0];
  if (!candidate) return null;
  const shape = world.ocean?.body ?? world.shore?.body ?? world.land?.body;
  const preview = candidate.id.startsWith('ocean:')
    ? (oceanDnaDraft(world, candidate.id.split(':')[1] as OceanDnaBody) ??
      shape)
    : shape;
  const form = candidate.id.startsWith('ocean:')
    ? candidate.id === 'ocean:fancrest'
      ? world.ocean!.tier === 0
        ? 'radial'
        : 'jelly'
      : world.ocean!.tier === 0
        ? 'bilateral'
        : 'fish'
    : candidate.id.startsWith('land:') &&
        ['strider', 'stalker'].includes(candidate.id.split(':')[1])
      ? (candidate.id.split(':')[1] as BodyForm)
      : candidate.id.startsWith('shore:') &&
          ['crawler', 'skipper'].includes(candidate.id.split(':')[1])
        ? (candidate.id.split(':')[1] as BodyForm)
        : world.form;
  const sources = Object.entries(world.dnaLineage?.sources ?? {});
  return (
    <section className="life-evolution" aria-label="下一代与祖源">
      <div className="life-parent">
        <BodyPortrait
          form={world.form}
          traits={world.traits}
          body={shape}
          landFeatures={world.land?.features}
          microbeBody={world.dnaLineage?.body}
        />
        <div>
          <small>
            第 {world.generation} 代 → 第 {world.generation + 1} 代
          </small>
          <strong>经历决定身体，身体打开新办法</strong>
        </div>
      </div>
      <div className="life-candidates" aria-label="下一代候选">
        {candidates
          .filter((c) => !c.id.startsWith('landpart:'))
          .map((c) => (
            <button
              key={c.id}
              aria-pressed={candidate.id === c.id}
              className={candidate.id === c.id ? 'is-selected' : ''}
              onClick={() => setSelected(c.id)}
            >
              <strong>{c.name}</strong>
              <small>{c.available ? '祖源已具备' : '等待新经历'}</small>
            </button>
          ))}
      </div>
      {world.land && (
        <details
          className="life-source-detail"
          open={candidate.id.startsWith('landpart:') || undefined}
        >
          <summary>物种留下的身体组织 · 12种，最多遗传3种</summary>
          <div className="life-candidates">
            {candidates
              .filter((c) => c.id.startsWith('landpart:'))
              .map((c) => (
                <button
                  key={c.id}
                  aria-pressed={candidate.id === c.id}
                  className={candidate.id === c.id ? 'is-selected' : ''}
                  onClick={() => setSelected(c.id)}
                >
                  <strong>{c.name}</strong>
                  <small>{c.available ? '祖源已具备' : '寻找来源'}</small>
                </button>
              ))}
          </div>
        </details>
      )}
      <div className="life-candidate-detail">
        <BodyPortrait
          form={form}
          traits={
            candidate.id.startsWith('pond:')
              ? [
                  ...new Set([
                    ...world.traits,
                    ...MICROBE_BODIES[candidate.id.split(':')[1] as MicrobeBody]
                      .traits,
                  ]),
                ]
              : world.traits
          }
          microbeBody={
            candidate.id.startsWith('pond:')
              ? (candidate.id.split(':')[1] as MicrobeBody)
              : world.dnaLineage?.body
          }
          body={preview}
          landFeatures={
            candidate.id.startsWith('landpart:')
              ? [
                  ...(world.land?.features ?? []),
                  candidate.id.split(':')[1] as LandFeature,
                ].slice(-3)
              : world.land?.features
          }
          large
        />
        <div>
          <h3>{candidate.name}</h3>
          <p>{candidate.benefit}</p>
          <strong className="life-new-action">{candidate.action}</strong>
          <small>取舍 · {candidate.cost}</small>
          <button
            className="primary-button"
            disabled={!!candidate.gate}
            onClick={() => onCommit(candidate.id)}
          >
            孕育下一代 · {candidate.resource}
          </button>
          {candidate.gate && (
            <output className="life-birth-gate">{candidate.gate}</output>
          )}
          <div className="life-guide-actions">
            <button
              className="secondary-button"
              onClick={() => onGuide(candidate.id)}
            >
              寻找来源
            </button>
            {world.habitat === 'pond' && (
              <button
                className="secondary-button"
                onClick={() => onGuide(candidate.id, 'hunt')}
              >
                追猎这个来源
              </button>
            )}
            <button className="secondary-button" onClick={onReturn}>
              返回育生地
            </button>
          </div>
        </div>
      </div>
      <details className="life-source-detail">
        <summary>这条谱系的来源 · {sources.length} 种</summary>
        <div className="life-source-list">
          {sources.length ? (
            sources.map(([id, r]) => (
              <span
                key={id}
                style={{ borderColor: DNA_SOURCES[id as DnaSource].color }}
              >
                <strong>{DNA_SOURCES[id as DnaSource].name}</strong>
                <small>
                  {r!.methods
                    ? Object.entries(r!.methods)
                        .map(
                          ([method, count]) =>
                            `${({ hunt: '捕猎', symbiosis: '共生', observe: '观察', practice: '实践' } as Record<string, string>)[method]} ${count}`,
                        )
                        .join(' · ')
                    : r!.method
                      ? `祖代记录 · 最近${{ hunt: '捕猎', symbiosis: '共生', observe: '观察', practice: '实践' }[r!.method]}`
                      : '祖代已记录'}{' '}
                  · 来源 {r!.units}
                </small>
              </span>
            ))
          ) : (
            <p>接近生物，观察、摄食或分享营养，留下第一次经历。</p>
          )}
        </div>
        <small>
          DNA获取是游戏中的进化想象；自然界的进化发生在多代遗传与选择中。
        </small>
      </details>
      <div className="life-abilities" aria-label="遗传能力">
        {(['jet', 'ward', 'gather'] as LearnedSkill[])
          .filter((id) => knowsSkill(world, id))
          .map((id) => (
            <button
              key={id}
              aria-pressed={world.learning?.equipped === id}
              title={LEARNED_SKILLS[id].effect}
              onClick={() =>
                onLearn(world.learning?.equipped === id ? null : id)
              }
            >
              {LEARNED_SKILLS[id].name}
              {world.learning?.equipped === id ? ' · U 已装备' : ' · 装备'}
            </button>
          ))}
      </div>
      {!!world.land?.features?.length && (
        <div className="life-abilities">
          {world.land.features.map((id) =>
            activeLandFeature(id) ? (
              <button
                key={id}
                aria-pressed={world.land?.activeFeature === id}
                onClick={() => onFeature?.(id)}
              >
                {LAND_FEATURES[id].name}
                {world.land?.activeFeature === id ? ' · I' : ' · 选择'}
              </button>
            ) : (
              <span key={id} title={LAND_FEATURES[id].action}>
                {LAND_FEATURES[id].name} · 自动生效
              </span>
            ),
          )}
        </div>
      )}
      {children && (
        <details className="ocean-dna-editor">
          <summary>自由组合身体与器官</summary>
          {children}
        </details>
      )}
    </section>
  );
}
