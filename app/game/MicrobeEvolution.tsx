'use client';
import { useState } from 'react';
import { getStats, TRAITS } from './simulation';
import type { TraitId, World } from './simulation';
import {
  MICROBE_BODIES,
  POND_DNA_SOURCES as DNA_SOURCES,
  microbeCandidates,
  microbeEffects,
} from './dna-evolution';
import type { MicrobeBody } from './dna-evolution';
import { BodyPortrait } from './OceanUI';
export function MicrobeEvolution({
  world,
  onCommit,
}: {
  world: World;
  onCommit: (traits: TraitId[], body: MicrobeBody) => void;
}) {
  const [draft, setDraft] = useState<TraitId[]>([...world.traits]);
  const [body, setBody] = useState<MicrobeBody>(
    world.dnaLineage?.body ?? 'ancestor',
  );
  const candidates = microbeCandidates(world);
  const dna = microbeEffects(world, body);
  const limit = Math.max(3, world.traits.length),
    stats = getStats(draft);
  stats.speed *= dna.speed;
  stats.pickup += dna.pickup;
  stats.metabolism *= dna.metabolism;
  return (
    <div className="microbe-evolution">
      <div className="dna-source-track" aria-label="已吸收的猎物DNA">
        {Object.entries(DNA_SOURCES).map(([id, source]) => (
          <span key={id} style={{ borderColor: source.color }}>
            {source.direction}{' '}
            <strong>
              {world.dnaLineage?.sources[id as keyof typeof DNA_SOURCES]
                ?.units ?? 0}
            </strong>
          </span>
        ))}
      </div>
      <p className="dna-intro">
        吃过的猎物决定身体分化。选择下一代，再调整器官。
      </p>
      <div className="dna-body-grid">
        {candidates.map((c) => (
          <button
            key={c.id}
            className={`dna-body-choice ${body === c.id ? 'selected' : ''}`}
            aria-pressed={body === c.id}
            disabled={!c.available}
            onClick={() => {
              setBody(c.id);
              setDraft(
                c.id === 'ancestor'
                  ? [...world.traits]
                  : [...new Set([...c.traits, ...world.traits])].slice(
                      0,
                      limit,
                    ),
              );
            }}
          >
            <strong>
              {c.name}
              {body === c.id ? ' ✓' : ''}
            </strong>
            <span>{c.available ? c.benefit : c.requirement}</span>
            {c.available && <small>代价 · {c.cost}</small>}
          </button>
        ))}
      </div>
      <p>
        组合下一代的结构 · 保留、替换或重新尝试，最多{limit}
        项。不同身体适合不同水域。
      </p>
      <BodyPortrait form="microbe" traits={draft} microbeBody={body} large />
      <div className="body-tradeoff">
        <span>
          游速 <strong>{Math.round(stats.speed)}</strong>
        </span>
        <span>
          摄食范围 <strong>{stats.pickup}</strong>
        </span>
        <span>
          储能 <strong>{stats.maxEnergy}</strong>
        </span>
      </div>
      <div className="trait-grid">
        {TRAITS.map((t) => (
          <button
            key={t.id}
            className={`trait-choice ${draft.includes(t.id) ? 'selected' : ''}`}
            aria-pressed={draft.includes(t.id)}
            disabled={
              (!draft.includes(t.id) && draft.length >= limit) ||
              (body !== 'ancestor' &&
                MICROBE_BODIES[body].traits.includes(t.id))
            }
            onClick={() =>
              setDraft(
                draft.includes(t.id)
                  ? draft.filter((id) => id !== t.id)
                  : [...draft, t.id],
              )
            }
          >
            <small>
              {t.label}
              {draft.includes(t.id) ? ' · ✓' : ''}
            </small>
            <h3>{t.name}</h3>
            <p className="trait-benefit">{t.benefit}</p>
            <p className="trait-cost">代价 · {t.cost}</p>
          </button>
        ))}
      </div>
      <button
        className="primary-button"
        disabled={!draft.length}
        onClick={() => onCommit(draft, body)}
      >
        孕育第{world.generation + 1}代 · 采用这个组合
      </button>
      <p className="science-note">
        游戏用吞食DNA表达幻想进化；现实中吃掉动物不会获得它的器官。真实演化发生在种群的多代遗传与选择中。
      </p>
    </div>
  );
}
