'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG groups need an ARIA role; equivalent native facility buttons are also available beside the map. */
import { useEffect, useState } from 'react';
import { BodyPortrait } from './OceanUI';
import type {
  CivilizationState,
  CityNodeId,
  CityResource,
  CityEvent,
} from './civilization';
import { CITY_NAMES, CITY_RESOURCES, cityProduction } from './civilization';
const colors = {
  food: '#edc674',
  wood: '#bd9a70',
  stone: '#b2d1c6',
  fiber: '#bfd184',
  ore: '#96c5c7',
  energy: '#ffda85',
  parts: '#d4b5ee',
};
function Cargo({
  kind,
  x = 0,
  y = 0,
}: {
  kind: CityResource;
  x?: number;
  y?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill={colors[kind]}
      stroke="#173d36"
      strokeWidth="1.5"
    >
      {kind === 'food' ? (
        <>
          <circle r="7" />
          <path d="M0-6Q2-17 10-12Q9-5 0-6" fill="#b9d69d" />
        </>
      ) : kind === 'wood' ? (
        <path d="M-9 5 6-10 10-6-5 9Z M-2-2-5-10" />
      ) : kind === 'fiber' ? (
        <path
          d="M-9 8-6-9M-3 9 0-10M3 9 6-9M-10 2H9"
          stroke={colors[kind]}
          strokeWidth="3"
        />
      ) : kind === 'energy' ? (
        <path d="M2-12-9 3H-1L-3 12 9-3H2Z" />
      ) : kind === 'parts' ? (
        <>
          <circle r="9" />
          <circle r="4" fill="#31534b" />
          <path
            d="M-12 0H-8M8 0H12M0-12V-8M0 8V12"
            stroke={colors[kind]}
            strokeWidth="4"
          />
        </>
      ) : (
        <path
          d={
            kind === 'ore'
              ? 'M0-12 9-4 6 9-7 8-10-3Z'
              : 'M-11 7-7-7 4-10 12 6 5 10Z'
          }
        />
      )}
    </g>
  );
}
export function CityMap({
  s,
  selected,
  onSelect,
  courier,
  onCourier,
  events,
}: {
  s: CivilizationState;
  selected: CityNodeId;
  onSelect: (id: CityNodeId) => void;
  courier: string;
  onCourier: (id: string) => void;
  events: CityEvent[];
}) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(motion.matches);
    update();
    motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, []);
  const flood = s.crisis !== null && !s.bridgeFixed;
  return (
    <svg
      className="city-map"
      viewBox="0 0 1200 800"
      aria-label="文明生产与运输地图"
    >
      <defs>
        <linearGradient id="city-ground" x2="1" y2="1">
          <stop stopColor={s.mode === 'won' ? '#173c3b' : '#294c47'} />
          <stop
            offset=".55"
            stopColor={s.mode === 'won' ? '#355448' : '#657c65'}
          />
          <stop offset="1" stopColor="#233f4c" />
        </linearGradient>
        <radialGradient id="city-light">
          <stop stopColor="#fbe0a8" stopOpacity=".3" />
          <stop offset="1" stopColor="#fbe0a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#city-ground)" />
      <svg
        width="1200"
        height="800"
        viewBox="100 100 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <image href="/assets/life-terrain-atlas.png" width="200" height="200" />
      </svg>
      {flood && <rect width="1200" height="800" fill="#214657" opacity=".25" />}
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse
          key={i}
          cx="180"
          cy="100"
          rx={330 + i * 42}
          ry={160 + i * 31}
          fill="none"
          stroke="#d0d5b113"
          strokeWidth="11"
        />
      ))}
      <path
        d="M 730 -30 C 665 190 765 470 720 830"
        stroke={flood ? '#648b94' : '#416e7c'}
        strokeWidth={flood ? 94 : 64}
        fill="none"
      />
      <path
        d="M 730 -30 C 665 190 765 470 720 830"
        stroke="#a0cad330"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M 450 155 L 660 70 L 760 70 L 950 160"
        fill="none"
        stroke="#d5ca9666"
        strokeWidth="12"
      />
      <text x="710" y="36" textAnchor="middle" fill="#efe2bf" fontSize="18">
        高地备用路
      </text>
      <path
        d="M 190 430 L 500 410 L 815 410 L 965 640 M 815 410 L 955 170 M 200 165 L 190 430 L 240 695"
        fill="none"
        stroke={s.mode === 'won' ? '#f7d38c88' : '#e0cba22d'}
        strokeWidth="16"
      />
      <g pointerEvents="none">
        {Array.from({ length: 32 }, (_, i) => {
          const x = i % 2 ? 1184 : 16,
            y = Math.floor(i / 2) * 53;
          return (
            <g
              key={i}
              transform={`translate(${x} ${y}) rotate(${i % 2 ? 145 : -35})`}
            >
              <path
                d="M0 0Q-22-45 0-68Q29-32 0 0"
                fill={i % 3 ? '#8fa47866' : '#bdc89466'}
              />
              <path d="M0 0V-60" stroke="#d4dca842" strokeWidth="2" />
            </g>
          );
        })}
      </g>
      <g opacity=".4">
        {Array.from({ length: 45 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 143.3) % 1200}
            cy={(i * 79.1) % 800}
            r={(i % 3) + 2}
            fill="#d7e3b4"
          />
        ))}
      </g>
      <path
        d="M 664 402 H 765"
        stroke={flood ? '#bd755e' : '#c7b889'}
        strokeWidth="14"
        strokeDasharray={flood ? '22 22' : undefined}
      />
      {flood && (
        <g>
          <text
            x="710"
            y="371"
            textAnchor="middle"
            fill="#ffe2bd"
            fontSize="20"
          >
            直达路中断
          </text>
          <path
            d="m700 392 20 24m0-24-20 24"
            stroke="#f6bb90"
            strokeWidth="5"
          />
        </g>
      )}
      {s.couriers
        .filter((c) => c.route)
        .map((c) => {
          const from = s.nodes.find((n) => n.id === c.route!.from)!,
            to = s.nodes.find((n) => n.id === c.route!.to)!;
          const cross = from.x < 710 !== to.x < 710;
          const d =
            c.route!.safe && cross
              ? `M${from.x} ${from.y} L${from.x < 710 ? 660 : 760} 70 L${from.x < 710 ? 760 : 660} 70 L${to.x} ${to.y}`
              : `M${from.x} ${from.y} L${to.x} ${to.y}`;
          return (
            <path
              key={c.id}
              d={d}
              fill="none"
              stroke={colors[c.route!.resource]}
              strokeWidth="3"
              strokeOpacity=".45"
              strokeDasharray="5 12"
            />
          );
        })}
      {s.nodes.map((n) => {
        const production = cityProduction(s, n.id);
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={`选择${CITY_NAMES[n.id]}${n.built ? '' : '，待建设'}`}
            onClick={() => onSelect(n.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(n.id);
              }
            }}
            className="city-map-node"
            transform={`translate(${n.x} ${n.y})`}
          >
            <circle
              r="72"
              fill="url(#city-light)"
              opacity={n.built ? 1 : 0.2}
            />
            <ellipse cy="28" rx="61" ry="23" fill="#102e324d" />
            <circle
              r="66"
              fill="transparent"
              stroke={selected === n.id ? '#f4dfab' : '#d0dabb22'}
              strokeWidth={selected === n.id ? 3 : 1}
              strokeDasharray={n.built ? undefined : '5 7'}
            />
            <g opacity={n.built ? 1 : 0.3}>
              {n.id === 'farm' ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <g key={i}>
                      <path
                        d={`M-48 ${-10 + i * 19} Q0 ${-30 + i * 19} 48 ${-10 + i * 19}`}
                        stroke="#b8bb76"
                        strokeWidth="10"
                        fill="none"
                      />
                      {[0, 1, 2, 3].map((j) => (
                        <path
                          key={j}
                          d={`m${-38 + j * 24} ${-15 + i * 19} -3 -12 m3 12 5 -10`}
                          stroke="#e8d391"
                          strokeWidth="3"
                        />
                      ))}
                    </g>
                  ))}
                </>
              ) : n.id === 'grove' ? (
                <>
                  <path
                    d="M-48 26 -28 -36 -8 26 M-18 26 5 -51 29 26"
                    fill="#7f9e76"
                    stroke="#a9b48a"
                    strokeWidth="3"
                  />
                  <path d="m25 27 5-29 19-12 16 34Z" fill="#a0b7a8" />
                </>
              ) : n.id === 'power' ? (
                <>
                  {s.energy !== 'fuel' ? (
                    <>
                      <path d="M-9 35 0-42 10 35" fill="#c4c8a4" />
                      <g
                        transform={`translate(0 -30) rotate(${reduced ? 0 : (production?.progress ?? 0) * 360})`}
                      >
                        <path
                          d="M0 0 0-38 9-48 4 0 M0 0 33 18 38 32 -4 4 M0 0-33 20-48 18-3-4"
                          fill="#efdb9d"
                        />
                      </g>
                    </>
                  ) : (
                    <>
                      <rect
                        x="-34"
                        y="-16"
                        width="68"
                        height="50"
                        rx="7"
                        fill="#ad9870"
                      />
                      <rect
                        x="14"
                        y="-54"
                        width="16"
                        height="44"
                        fill="#b6b59b"
                      />
                      <circle cy="10" r="12" fill="#efbd6c" />
                    </>
                  )}
                </>
              ) : n.id === 'port' ? (
                <>
                  <ellipse cy="35" rx="60" ry="16" fill="#66847d" />
                  <path d="M-17 22-14-33 Q0-76 14-33L17 22Z" fill="#d1dcc6" />
                  <path d="m-15 1-21 35 22-8m29-27 21 35-22-8" fill="#91bab1" />
                  <circle cy="-19" r="8" fill="#507a80" />
                </>
              ) : n.id === 'quarry' ? (
                <>
                  <path
                    d="m-55 27 20-53 19 19 27-49 39 83Z"
                    fill="#92aba8"
                    stroke="#c0cdbc"
                    strokeWidth="4"
                  />
                  <path
                    d="m-16 23 14-35 17 35"
                    stroke="#355a5d"
                    strokeWidth="12"
                  />
                </>
              ) : (
                <>
                  <rect
                    x="-40"
                    y="-14"
                    width="80"
                    height="48"
                    rx="5"
                    fill={n.id === 'workshop' ? '#a09d80' : '#acb68b'}
                  />
                  <path
                    d="M-49-11 0-47 49-11Z"
                    fill={n.id === 'workshop' ? '#6f9e9c' : '#d0b681'}
                  />
                  <rect x="-10" y="5" width="20" height="29" fill="#35554f" />
                  {n.id === 'workshop' && (
                    <g
                      transform={`translate(30 -9) rotate(${reduced || production?.missing.length ? 0 : (production?.progress ?? 0) * 180})`}
                    >
                      <circle
                        r="17"
                        fill="none"
                        stroke="#dbc49c"
                        strokeWidth="7"
                      />
                      <path
                        d="M-21 0H21M0-21V21"
                        stroke="#dbc49c"
                        strokeWidth="5"
                      />
                    </g>
                  )}
                  {n.id === 'relay' && (
                    <path
                      d="M-17-20H17M0-36V-4"
                      stroke="#395a58"
                      strokeWidth="7"
                    />
                  )}
                </>
              )}
            </g>
            <text y="-81" textAnchor="middle" fill="#f8e9c9" fontSize="20">
              {CITY_NAMES[n.id]}
            </text>
            {production && (
              <g>
                <rect
                  x="-50"
                  y="78"
                  width="100"
                  height="4"
                  rx="2"
                  fill="#193d39"
                />
                <rect
                  x="-50"
                  y="78"
                  width={100 * production.progress}
                  height="4"
                  rx="2"
                  fill={production.missing.length ? '#e9b47f' : '#b9da99'}
                />
                <text
                  y="103"
                  textAnchor="middle"
                  fill={production.missing.length ? '#ffd09a' : '#d1ddbd'}
                  fontSize="14"
                >
                  {s.mode === 'won' ? '生产记录已保存' : production.label}
                </text>
              </g>
            )}
            <text y="65" textAnchor="middle" fill="#d5e2c5" fontSize="15">
              {n.built
                ? Object.entries(n.stock)
                    .filter(([, v]) => v > 0)
                    .slice(-3)
                    .map(
                      ([r, v]) =>
                        `${CITY_RESOURCES[r as keyof typeof CITY_RESOURCES]} ${v}`,
                    )
                    .join(' · ') || '等待物资'
                : '点击建设'}
            </text>
          </g>
        );
      })}
      {s.couriers
        .filter((c) => c.id === courier && c.destination && c.path.length)
        .map((c) => (
          <path
            key={`journey-${c.id}`}
            d={`M${c.x} ${c.y} ${c.path.map((p) => `L${p.x} ${p.y}`).join(' ')}`}
            fill="none"
            stroke="#fff0be"
            strokeWidth="3"
            strokeOpacity=".8"
            pointerEvents="none"
          />
        ))}
      {s.couriers.map((c, i) => (
        <g
          key={c.id}
          transform={`translate(${c.x} ${c.y})`}
          role="button"
          tabIndex={0}
          className="city-map-node"
          aria-label={`选择运输队：${i === 0 ? '你' : `成员 ${i}`}${c.blocked ? '，封路' : ''}`}
          aria-pressed={courier === c.id}
          onClick={() => onCourier(c.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCourier(c.id);
            }
          }}
        >
          <ellipse
            rx="38"
            ry="30"
            fill="transparent"
            stroke={courier === c.id ? '#fff0b6' : 'transparent'}
            strokeWidth="2"
          />
          <circle r="21" fill={c.blocked ? '#ce846b44' : '#e2d39722'} />
          <g transform={`rotate(${(c.angle * 180) / Math.PI})`}>
            <rect
              x="-15"
              y="-11"
              width="26"
              height="22"
              rx="4"
              fill={c.cargo ? colors[c.cargo] : '#b6b994'}
              stroke="#e9dfbe"
              strokeWidth="2"
            />
            <circle cx="-6" cy="-13" r="4" fill="#294744" />
            <circle cx="-6" cy="13" r="4" fill="#294744" />
            {c.cargo &&
              Array.from({ length: Math.min(c.load, 4) }, (_, j) => (
                <Cargo
                  key={j}
                  kind={c.cargo!}
                  x={-7 + (j % 2) * 12}
                  y={-5 + Math.floor(j / 2) * 11}
                />
              ))}
            <foreignObject
              x="-19"
              y="-27"
              width="94"
              height="55"
              pointerEvents="none"
            >
              <BodyPortrait
                form={c.form}
                body={c.newborn ? s.body : undefined}
                traits={c.newborn ? s.traits : []}
                landOrgan={c.newborn ? s.organ : undefined}
                adaptation={c.newborn ? s.adaptation : undefined}
              />
            </foreignObject>
          </g>
          <text
            y="-40"
            textAnchor="middle"
            fill={c.blocked ? '#ffcfaa' : '#f6e6c0'}
            fontSize="14"
          >
            {c.blocked ? '封路' : c.id === 'leader' ? '你' : `成员 ${i}`}
            {c.load ? ` · ${c.load}` : ''}
          </text>
        </g>
      ))}
      {s.nodes.map((n) => {
        const e = events.filter((e) => e.node === n.id).at(-1);
        return (
          e && (
            <g
              key={`event-${n.id}`}
              transform={`translate(${n.x} ${n.y - 113 - (reduced ? 0 : Math.min(1, s.time - e.at) * 12)})`}
              pointerEvents="none"
              opacity={reduced ? 1 : Math.min(1, (2 - s.time + e.at) * 2)}
            >
              <rect
                x="-83"
                y="-20"
                width="166"
                height="29"
                rx="14"
                fill="#163b36eb"
                stroke="#d7dfab44"
              />
              <text
                textAnchor="middle"
                fill={e.kind === 'deliver' ? '#fff0be' : '#cdeab4'}
                fontSize="15"
              >
                {e.text}
              </text>
            </g>
          )
        );
      })}
    </svg>
  );
}
