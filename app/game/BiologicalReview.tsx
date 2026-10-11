'use client';
import type { BiologicalRecord } from './biological-finale';
import { BodyPortrait } from './OceanUI';
import { DNA_SOURCES } from './dna-evolution';
import type { DnaSource } from './dna-evolution';
import { LAND_FEATURES } from './land-catalog';
export function BiologicalReview({
  record: r,
  onBranch,
}: {
  record: BiologicalRecord;
  onBranch?: (id: number, generation: number) => void;
}) {
  return (
    <section className="biological-review" aria-label={`${r.title}生物篇成果`}>
      <small>生物篇 · 已留下能够生活的族群</small>
      <h3>
        {r.title} · 第 {r.generation} 代
      </h3>
      <BodyPortrait
        form={r.form}
        traits={r.traits}
        body={r.body}
        landFeatures={r.features}
        large
      />
      <p>
        幼体已长大，家园挺过风雨。
        {r.features.map((id) => LAND_FEATURES[id].name).join('、') ||
          '祖代身体'}
        在后代中延续。
      </p>
      <div className="biological-descendants">
        {r.descendants.map((m) => (
          <div key={m.id}>
            <BodyPortrait
              form={m.form}
              body={m.body ?? (m.newborn ? r.body : undefined)}
              landFeatures={m.features}
              traits={m.newborn ? r.traits : []}
            />
            <small>
              {m.newborn
                ? '你的后代'
                : m.source
                  ? DNA_SOURCES[m.source].name
                  : '同行者'}{' '}
              ·{' '}
              {m.role === 'food' ? '采食' : m.role === 'wood' ? '搬运' : '守护'}
            </small>
          </div>
        ))}
      </div>
      <details>
        <summary>
          这条谱系留下的来源 · {Object.keys(r.dnaLineage?.sources ?? {}).length}{' '}
          种
        </summary>
        <p>
          {Object.keys(r.dnaLineage?.sources ?? {})
            .map((id) => DNA_SOURCES[id as DnaSource].name)
            .join(' · ')}
        </p>
      </details>
      {!!r.history.length && (
        <details className="biological-branches">
          <summary>从祖先培育另一条支系</summary>
          <p>
            旧族群已保存。新支系继承所选祖先当时的身体与来源，从空物资开始；可以改换生活办法。
          </p>
          <div>
            {r.history.map((a) => (
              <button
                key={a.generation}
                disabled={!onBranch}
                onClick={() => onBranch?.(r.id, a.generation)}
              >
                第 {a.generation} 代 ·{' '}
                {
                  (
                    {
                      pond: '一滴水',
                      ocean: '海洋',
                      shore: '潮岸',
                      land: '陆地',
                    } as Record<string, string>
                  )[a.habitat ?? 'pond']
                }
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
