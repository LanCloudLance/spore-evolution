'use client';
import type { SpaceState } from './space';
import {
  STARS,
  flareStrength,
  ecologyReadings,
  ecologyFeedback,
  ECOLOGY_NAMES,
} from './space';
import { BodyPortrait } from './OceanUI';

export function OutpostScene({ s }: { s: SpaceState }) {
  const o = s.outpost;
  if (!o) return null;
  const ember = o.planet === 'ember',
    flare = flareStrength(s),
    growth = o.growth / 100;
  const stressed = ecologyReadings(s).some((r) => r.offset !== 0);
  return (
    <svg
      className="outpost-scene"
      viewBox="0 0 1200 760"
      aria-label={`${STARS[o.planet].name}地表，${o.habitat === 'dome' ? '穹顶' : '湿地'}前哨，生长${Math.floor(o.growth)}%，稳定${Math.round(o.stability)}%`}
    >
      <defs>
        <clipPath id="outpost-boundary">
          <rect width="1200" height="760" />
        </clipPath>
        <linearGradient id="outpost-sky" x2="0" y2="1">
          <stop stopColor={flare ? '#773e59' : ember ? '#583f59' : '#203f62'} />
          <stop offset="1" stopColor={ember ? '#e2a178' : '#92c3b6'} />
        </linearGradient>
        <linearGradient id="outpost-soil" x2="0" y2="1">
          <stop stopColor={ember ? '#a07860' : '#648a75'} />
          <stop offset="1" stopColor={ember ? '#453b48' : '#234d4d'} />
        </linearGradient>
        <radialGradient id="outpost-sun">
          <stop stopColor="#ffeab5" />
          <stop offset=".2" stopColor="#f5c188" />
          <stop offset="1" stopColor="#fbc992" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="outpost-glass" x2="1" y2="1">
          <stop stopColor="#d3eee7" stopOpacity=".24" />
          <stop offset="1" stopColor="#a2d6d0" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <g clipPath="url(#outpost-boundary)">
        <rect width="1200" height="760" fill="url(#outpost-sky)" />
        <circle
          cx="975"
          cy="125"
          r={flare ? 175 : 100}
          fill="url(#outpost-sun)"
        />
        <circle cx="975" cy="125" r="27" fill="#fff1c6" />
        {flare > 0 && (
          <g fill="none" stroke="#ffdcb08c" strokeWidth="5">
            <path d="M1010 105Q1110 12 1070 140Q1015 160 1030 90" />
            <path d="M944 123Q829 145 864 211Q943 196 947 156" />
          </g>
        )}
        <path
          d="M0 390 90 283 190 350 330 238 470 367 600 310 775 380 900 286 1050 368 1200 300V760H0Z"
          fill={ember ? '#735865' : '#486d7c'}
        />
        <path
          d="M0 438Q290 350 560 425T1200 415V760H0Z"
          fill="url(#outpost-soil)"
        />
        {Array.from({ length: 18 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 78 - 30} ${525 + (i % 3) * 64}q36 -18 69 0`}
            fill="none"
            stroke={ember ? '#e4bc8050' : '#b3d0a736'}
            strokeWidth="3"
          />
        ))}
        <ellipse cx="575" cy="545" rx="302" ry="111" fill="#183a3b66" />
        {o.habitat === 'wetland' ? (
          <>
            <ellipse
              cx="575"
              cy="530"
              rx="268"
              ry="97"
              fill={stressed ? '#5c9491' : '#71b6b0'}
            />
            {[0, 1, 2].map((i) => (
              <ellipse
                key={i}
                cx={455 + i * 95}
                cy={540 + (i % 2) * 20}
                rx="52"
                ry="12"
                fill="none"
                stroke="#cce8ce66"
                strokeWidth="3"
              />
            ))}
          </>
        ) : (
          <>
            <path
              d="M290 535Q310 181 575 173Q840 181 860 535Z"
              fill="url(#outpost-glass)"
              stroke="#c2e0cb"
              strokeWidth="5"
            />
            <path
              d="M575 173V535M290 535Q575 444 860 535M360 307Q575 375 792 307M460 200Q386 350 416 517M690 200Q764 350 734 517"
              fill="none"
              stroke="#d0e7ca55"
              strokeWidth="3"
            />
          </>
        )}
        <ellipse
          cx="575"
          cy="534"
          rx="220"
          ry="65"
          fill={stressed ? '#7d9270' : '#8eb27a'}
        />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 405 + (i % 5) * 83,
            y = 511 + Math.floor(i / 5) * 52,
            h = 13 + growth * (60 + (i % 3) * 16),
            lean = stressed ? 19 : i % 2 ? 5 : -6;
          return (
            <g
              key={i}
              transform={`translate(${x} ${y})`}
              opacity={0.55 + o.stability / 220}
            >
              <ellipse cy="5" rx="22" ry="7" fill="#254e4766" />
              <path
                d={`M0 0Q${lean} ${-h / 2} ${lean} ${-h}`}
                fill="none"
                stroke="#d0df9d"
                strokeWidth="5"
              />
              {growth > 0.12 && (
                <path
                  d={`M${lean / 2} ${-h * 0.4}Q-42 ${-h * 0.7} -30 ${-h}Q6 ${-h * 0.9} ${lean / 2} ${-h * 0.4}M${lean} ${-h * 0.6}Q46 ${-h * 1.1} 35 ${-h * 0.4}Q18 ${-h * 0.1} ${lean} ${-h * 0.6}`}
                  fill={stressed ? '#b8b184' : '#b8dca1'}
                />
              )}
              {growth > 0.68 && (
                <g transform={`translate(${lean} ${-h - 3})`}>
                  <circle
                    r={5 + growth * 5}
                    fill={ember ? '#ffd0a0' : '#d9eecc'}
                  />
                  <circle r="3" fill="#dbb376" />
                </g>
              )}
            </g>
          );
        })}
        {s.crew.slice(0, 6).map((c, i) => (
          <g
            key={c.id}
            transform={`translate(${310 + i * 112} ${610 + (i % 2) * 13})`}
          >
            <ellipse cy="15" rx="35" ry="10" fill="#172f3970" />
            <foreignObject x="-68" y="-45" width="136" height="80">
              <BodyPortrait
                form={c.form}
                body={c.newborn ? s.body : undefined}
                traits={c.newborn ? s.traits : []}
                landOrgan={c.newborn ? s.organ : undefined}
                adaptation={c.newborn ? s.adaptation : undefined}
              />
            </foreignObject>
            <text y="49" fill="#e7e9c5" textAnchor="middle" fontSize="14">
              {i === 0 ? '你' : c.newborn ? '长大的幼崽' : `旅伴 ${i}`}
            </text>
          </g>
        ))}
        <rect x="30" y="24" width="570" height="86" rx="18" fill="#102d3bcc" />
        <text x="53" y="61" fill="#fff0cc" fontSize="25">
          {STARS[o.planet].name} ·{' '}
          {o.habitat === 'dome' ? '穹顶生命舱' : '浅水生态湿地'}
        </text>
        <text x="53" y="91" fill="#d6e7c7" fontSize="17">
          {s.mode === 'won'
            ? '第一片外星花丛，已经扎根。'
            : ecologyFeedback(s).label}
        </text>
        {ecologyReadings(s).map((r, i) => (
          <g key={r.key} transform={`translate(${43 + i * 265} 705)`}>
            <rect
              x="-10"
              y="-28"
              width="248"
              height="55"
              rx="12"
              fill="#12353dcc"
            />
            <text fill={r.offset ? '#ffd098' : '#daebc5'} fontSize="17">
              {ECOLOGY_NAMES[r.key]} {r.actual} · 目标 {r.target}
              {r.tolerance ? ` ±${r.tolerance}` : ''}
            </text>
            <text y="19" fill="#bed5c8" fontSize="13">
              {r.offset > 0 ? '偏高' : r.offset < 0 ? '偏低' : '在适应范围内'}
            </text>
          </g>
        ))}
        <text x="1125" y="696" textAnchor="end" fill="#f4e2bb" fontSize="20">
          生长 {Math.floor(o.growth)}%
        </text>
        <text x="1125" y="729" textAnchor="end" fill="#d5e5c8" fontSize="17">
          稳定 {Math.round(o.stability)}%
        </text>
      </g>
    </svg>
  );
}
