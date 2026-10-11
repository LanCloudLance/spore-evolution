'use client';
import { useState } from 'react';
import { distance } from './simulation';
import { OCEAN_NURSERY } from './ocean';
import type { World } from './simulation';
import { DNA_SOURCES } from './dna-evolution';
import { oceanDnaCandidates, oceanDnaGuide } from './ocean-dna';
import type { OceanDnaBody } from './ocean-dna';
import { BodyPortrait } from './OceanUI';

export function OceanDnaEvolution({
  world,
  onCommit,
  onSeek,
  onReturn,
}: {
  world: World;
  onCommit: (id: OceanDnaBody) => void;
  onSeek: (id: OceanDnaBody) => void;
  onReturn: () => void;
}) {
  const candidates = oceanDnaCandidates(world);
  const [selected, setSelected] = useState<OceanDnaBody>(
    () => candidates.find((c) => c.available)?.id ?? 'silverflow',
  );
  const body = candidates.find((c) => c.id === selected)!;
  const guide = oceanDnaGuide(world, selected);
  return (
    <section className="ocean-dna-menu" aria-label="海洋DNA分化">
      <p className="ocean-dna-intro">
        捕猎或分享营养，留下对方的DNA；回育生点孕育新的身体。
      </p>
      <div className="ocean-dna-choices">
        {candidates.map((c) => (
          <button
            key={c.id}
            className={selected === c.id ? 'is-selected' : ''}
            aria-pressed={selected === c.id}
            onClick={() => setSelected(c.id)}
          >
            {c.draft && (
              <BodyPortrait
                form={world.form}
                traits={world.traits}
                body={c.draft}
              />
            )}
            <strong>{c.name}</strong>
            <small>{c.available ? '祖源已齐' : '还需新的祖源'}</small>
          </button>
        ))}
      </div>
      <div className="ocean-dna-detail">
        <strong>
          {body.name} · 第 {world.generation + 1} 代
        </strong>
        <p>{body.benefit}</p>
        <small>取舍：{body.cost}</small>
        <div className="ocean-dna-sources">
          {body.needs.map((n, i) => {
            const units = n.sources.reduce(
              (sum, s) => sum + (world.dnaLineage?.sources[s]?.units ?? 0),
              0,
            );
            return (
              <span key={i} className={units >= n.units ? 'is-ready' : ''}>
                {n.sources.map((s) => DNA_SOURCES[s].name).join(' / ')}{' '}
                <b>
                  {units}/{n.units}
                </b>
              </span>
            );
          })}
        </div>
        <div className="ocean-dna-buttons">
          <button
            className="primary-button"
            disabled={!!body.gate}
            onClick={() => onCommit(selected)}
          >
            孕育{body.name} · {body.costDna} DNA
          </button>
          {distance(world.player, OCEAN_NURSERY) > OCEAN_NURSERY.radius && (
            <button className="secondary-button" onClick={onReturn}>
              返回育生点
            </button>
          )}
          {guide && (
            <button
              className="secondary-button"
              onClick={() => onSeek(selected)}
            >
              {guide.intent === 'visit' ? '前往共生' : '追猎'} · {guide.name}
            </button>
          )}
        </div>
        {body.gate && (
          <p className="ocean-dna-gate">
            {body.available ? body.gate : '尚未收集齐来源DNA。'}
          </p>
        )}
        {guide?.intent === 'visit' && (
          <small>
            靠近后按 K 分享 1 份营养，等对方吃下；捕食者可能打断共生。
          </small>
        )}
      </div>
    </section>
  );
}
