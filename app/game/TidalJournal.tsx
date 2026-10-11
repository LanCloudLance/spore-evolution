import type { World } from './simulation';
import { TIDAL_SPECIES, TIDAL_BIOMES } from './tidal/catalog';
export function TidalJournal({ world }: { world: World }) {
  const t = world.ocean!.tidal!;
  return (
    <div className="tidal-journal">
      <p>
        观察真实行为，发现器官；回育生湾设计后代，试用身体，再走向新的生境。
      </p>
      <div className="tidal-biomes">
        {TIDAL_BIOMES.map((b) => (
          <span key={b.id}>
            {b.name}
            {t.migration.visited.includes(b.id) ? ' ✓' : ''}
          </span>
        ))}
      </div>
      <div className="tidal-species-grid">
        {TIDAL_SPECIES.map((s) => (
          <article
            key={s.id}
            className={t.journal.seen.includes(s.id) ? 'seen' : ''}
          >
            <h3>{t.journal.seen.includes(s.id) ? s.name : '尚未观察'}</h3>
            <p>
              {t.journal.seen.includes(s.id)
                ? s.mechanism
                : '靠近生境中的生物，看看它如何生活。'}
            </p>
          </article>
        ))}
      </div>
      <details>
        <summary>操作与迁移</summary>
        <p>
          WASD / 方向键游动，空格冲刺，也可点击水域自动游过去。J、L
          使用已配置的器官，K
          分享或建立育生点。身体设计中可移动、对称放置器官与配置能力。
        </p>
        <p>
          成熟后从育生湾出发。猎食穿过礁谷，滤食沿漂流带与藻林，结伴可走庇护海域；也能混合探索。途中真实补给，留下
          4 份营养，等大潮时在河口按
          K。失败可回最近的安全育生点，知识保留，资源恢复到当时。
        </p>
      </details>
    </div>
  );
}
