'use client';
import type { ExpeditionRecord } from './space';
import { STARS, completeJourney } from './space';
import { FORMS } from './forms';
import { TRAITS } from './simulation';
import { BodyPortrait } from './OceanUI';
import { DISCOVERIES, LEARNED_SKILLS } from './lineage-learning';
import { DROUGHT_NAMES } from './land-drought';
import { LAND_WAY_NAMES } from './land';
const choiceNames: Record<string, string> = {
  'society:workshop': '本族工坊聚落',
  'tool:basket': '学会编篮',
  'tool:hammer': '学会石锤',
  'moss:trade': '与苔石交换',
  'moss:help': '帮助苔石铺路',
  'reed:trade': '与芦湾交换',
  'reed:help': '帮助芦湾修屋',
  'energy:wind': '风能生产',
  'energy:fuel': '燃料生产',
  'space:sail': '太阳帆',
  'space:shield': '生态屏障',
  'planet:tide': '选择青潮星',
  'planet:ember': '选择熔光星',
  'habitat:wetland': '湿地前哨',
  'habitat:dome': '穹顶前哨',
  'discovery:echo': '记录回声遗迹',
  'seed:eaten': '月露荚作为旅途补给',
  'seed:grown': '照料月露果丛并带走种苗',
};
export function ExpeditionReview({ record: r }: { record: ExpeditionRecord }) {
  return (
    <article className="expedition-review">
      <small>
        {completeJourney(r)
          ? '从微生物到星海 · 完整旅程'
          : '独立体验的延续 · 未计作八章完整旅程'}
      </small>
      <h2>{STARS[r.planet].name}，新的生命坐标</h2>
      <div className="expedition-hero">
        <BodyPortrait
          form={r.form}
          traits={r.traits}
          body={r.body}
          landOrgan={r.organ}
          adaptation={r.adaptation}
        />
        <p>
          第 {r.generation} 代 · {FORMS[r.form].name}
          <br />
          {r.crew} 位同行者 · 前哨稳定度 {Math.round(r.stability)}%
        </p>
      </div>
      {r.history.some((a) => a.milestone) && (
        <div className="expedition-memories" aria-label="这一支生命留下的足迹">
          {[
            r.history.find((a) => a.form === 'microbe'),
            r.history.find((a) => a.milestone),
            r.history.findLast((a) => a.habitat === 'land'),
          ]
            .filter((a, i, all) => a && all.indexOf(a) === i)
            .map(
              (a) =>
                a && (
                  <figure key={`${a.generation}-${a.habitat}`}>
                    <BodyPortrait
                      form={a.form ?? 'microbe'}
                      traits={a.traits}
                      body={a.body}
                      landOrgan={a.landOrgan}
                      adaptation={a.adaptation}
                    />
                    <figcaption>
                      {a.milestone ??
                        (a.form === 'microbe'
                          ? '最初的一滴水'
                          : '曾经安家的土地')}
                    </figcaption>
                  </figure>
                ),
            )}
        </div>
      )}
      {r.tidalLegacy && (
        <p className="expedition-tidal-legacy">
          河口育生点仍在。曾以
          {r.tidalLegacy.diet
            .map(
              (d) =>
                ({
                  hunt: '追猎',
                  filter: '滤食',
                  reserve: '储能远行',
                  symbiosis: '共生同行',
                })[d],
            )
            .join('、') || '沿途补给'}
          抵达海岸，留下 {r.tidalLegacy.companions.length}{' '}
          位浅水同行者。水生器官与纹样仍保存在这一支身体中。
        </p>
      )}
      {r.learning && (
        <details className="learning-archive">
          <summary>遗传与技艺 · {r.learning.entries.length}项真实发现</summary>
          <ul>
            {r.learning.entries.map((e) => (
              <li key={e.source}>
                {LEARNED_SKILLS[DISCOVERIES[e.source].skill].name} · 第
                {e.generation}代 · {DISCOVERIES[e.source].name}
                {r.learning!.learned.includes(DISCOVERIES[e.source].skill)
                  ? ' · 已学会'
                  : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="expedition-choices">
        {r.choices.map((choice, i) => (
          <span key={`${choice}-${i}`}>{choiceNames[choice] ?? choice}</span>
        ))}
      </div>
      <details>
        <summary>回看真实谱系 · {r.history.length} 条记录</summary>
        {r.history.length ? (
          r.history.map((a, i) => (
            <div className="expedition-ancestor" key={`${a.generation}-${i}`}>
              {a.form && (
                <BodyPortrait
                  form={a.form}
                  traits={a.traits}
                  body={a.body}
                  landOrgan={a.landOrgan}
                  adaptation={a.adaptation}
                />
              )}
              <p>
                <strong>
                  第 {a.generation} 代{a.form ? ` · ${FORMS[a.form].name}` : ''}
                </strong>
                {a.milestone && (
                  <small className="lineage-milestone">✦ {a.milestone}</small>
                )}
                {a.landLegacy && (
                  <small className="lineage-milestone">
                    ✦ 旱季 · {DROUGHT_NAMES[a.landLegacy.strategy]}
                  </small>
                )}
                {a.landWays?.length ? (
                  <small className="lineage-milestone">
                    ✦ 林地 ·{' '}
                    {a.landWays.map((way) => LAND_WAY_NAMES[way]).join('、')}
                  </small>
                ) : null}
                <small>
                  {a.traits
                    .map((t) => TRAITS.find((v) => v.id === t)?.name ?? t)
                    .join('、') || '尚未形成额外特征'}
                </small>
              </p>
            </div>
          ))
        ) : (
          <p>这次从独立章节开始，没有补造之前的祖先。</p>
        )}
      </details>
    </article>
  );
}
