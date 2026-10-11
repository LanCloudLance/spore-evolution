'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Interactive SVG stars have equivalent native destination buttons. */
import { useEffect, useState } from 'react';
import { flightPresentation } from './space-presentation';
import type { SpaceState, StarId } from './space';
import { STARS, ecologyError, ecologyFeedback } from './space';
export function SpaceMap({
  s,
  selected,
  onSelect,
}: {
  s: SpaceState;
  selected: StarId;
  onSelect: (id: StarId) => void;
}) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const f = s.flight,
    flight = flightPresentation(s, reduced),
    { x, y } = flight;
  return (
    <svg
      className="space-map"
      viewBox="0 0 1200 760"
      aria-label="远航星图与生态前哨"
    >
      <defs>
        <radialGradient id="nebula-a">
          <stop stopColor="#568797" stopOpacity=".38" />
          <stop offset="1" stopColor="#1b2543" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebula-b">
          <stop stopColor="#856989" stopOpacity=".3" />
          <stop offset="1" stopColor="#171a31" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="planet-glow">
          <stop stopColor="#d7e5c4" stopOpacity=".1" />
          <stop offset="1" stopColor="#bac8e5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="760" fill="#101a2b" />
      <ellipse cx="530" cy="380" rx="600" ry="380" fill="url(#nebula-a)" />
      <ellipse cx="995" cy="590" rx="510" ry="340" fill="url(#nebula-b)" />
      {Array.from({ length: 95 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 173.1) % 1200}
          cy={(i * 91.7) % 760}
          r={i % 7 === 0 ? 2 : 1}
          opacity={0.25 + (i % 5) * 0.12}
          fill="#e1e8de"
        />
      ))}
      <path
        d="M145 485 360 295 650 170 1060 285 885 560 360 295"
        fill="none"
        stroke="#93bac224"
        strokeWidth="2"
        strokeDasharray="3 11"
      />
      {f && (
        <path
          d={flight.path}
          fill="none"
          stroke="#e3d9ab66"
          strokeWidth="3"
          strokeDasharray="6 10"
        />
      )}
      {(Object.entries(STARS) as [StarId, (typeof STARS)[StarId]][]).map(
        ([id, p]) => (
          <g
            role="button"
            tabIndex={0}
            aria-label={`查看${p.name}`}
            key={id}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(id);
              }
            }}
            className="space-star"
            transform={`translate(${p.x} ${p.y})`}
          >
            <circle r={p.radius * 2.1} fill="url(#planet-glow)" />
            <circle
              r={p.radius + 13}
              fill="none"
              stroke={selected === id ? '#e4d5a2' : '#7299ac33'}
              strokeWidth={selected === id ? 2.5 : 1}
            />
            <clipPath id={`star-face-${id}`}>
              <circle r={p.radius} />
            </clipPath>
            <radialGradient id={`star-skin-${id}`} cx=".3" cy=".25" r=".85">
              <stop stopColor="#ecf2d4" />
              <stop offset=".3" stopColor={p.color} />
              <stop offset="1" stopColor="#20344e" />
            </radialGradient>
            <circle
              r={p.radius}
              fill={`url(#star-skin-${id})`}
              stroke="#b7dbce88"
              strokeWidth="1.5"
            />
            <g clipPath={`url(#star-face-${id})`}>
              {(id === 'tide' || id === 'home') && (
                <>
                  <path
                    d="M-60-20Q-28-49-11-25L7-10-8 13-34 8-21 39-52 48Z"
                    fill="#b4d09a"
                    opacity=".65"
                  />
                  <path
                    d="M17-47 57-15 22 0 34 27 8 41"
                    fill="#c5d9ab"
                    opacity=".5"
                  />
                </>
              )}
              {id === 'ember' && (
                <>
                  <path
                    d="M-46-16-20-22-8 5 18 0 27 19 51 8M-8 5-19 37M18 0 33-30"
                    fill="none"
                    stroke="#ffda99"
                    strokeWidth="3"
                  />
                  <circle cx="-24" cy="-4" r="12" fill="#946c66" />
                  <circle cx="20" cy="25" r="8" fill="#b57d68" />
                </>
              )}
              {id === 'echo' && (
                <path
                  d="M-21 14-9-23 11-18 23 7 0 26Z"
                  fill="none"
                  stroke="#e4cfef"
                  strokeWidth="3"
                />
              )}
            </g>
            <path
              d={`M${-p.radius * 0.6} ${-p.radius * 0.75} Q${p.radius * 0.8} ${-p.radius * 0.3} ${-p.radius * 0.2} ${p.radius * 0.9}`}
              fill="none"
              stroke="#e7ead044"
              strokeWidth={p.radius * 0.32}
            />
            <path
              d={`M0 ${-p.radius} A${p.radius} ${p.radius} 0 0 1 0 ${p.radius} Q${p.radius * 0.8} 0 0 ${-p.radius}`}
              fill="#0b203651"
            />
            {id === 'tide' && (
              <ellipse
                rx="74"
                ry="12"
                transform="rotate(-25)"
                fill="none"
                stroke="#accfbb66"
                strokeWidth="3"
              />
            )}
            {id === 'beacon' && (
              <path d="M-30 0H30M0-30V30" stroke="#d5d8c0" strokeWidth="4" />
            )}
            <text
              y={p.radius + 45}
              textAnchor="middle"
              fontSize="21"
              fill="#e7e9d0"
            >
              {p.name}
            </text>
            <text
              y={p.radius + 70}
              textAnchor="middle"
              fontSize="14"
              fill="#a6c0c0"
            >
              {s.location === id && !f
                ? '当前轨道'
                : s.visited.includes(id)
                  ? '曾经抵达'
                  : '等待探索'}
            </text>
            {(id === 'tide' || id === 'ember') && (
              <g transform={`translate(0 ${-p.radius - 27})`}>
                <circle
                  cx="-9"
                  r="5"
                  fill={s.surveys[id].includes('water') ? '#ade0d0' : '#597687'}
                />
                <circle
                  cx="9"
                  r="5"
                  fill={s.surveys[id].includes('air') ? '#f0d695' : '#597687'}
                />
              </g>
            )}
            {s.outpost?.planet === id && (
              <g transform={`translate(0 ${-p.radius - 40})`}>
                <path d="M-18 15 Q0-30 18 15Z" fill="#d9e2b3" />
                <path d="M-20 15H20" stroke="#f0da9e" strokeWidth="3" />
              </g>
            )}
          </g>
        ),
      )}
      <g transform={`translate(${x} ${y}) rotate(${flight.angle})`}>
        <path
          d="M0-22 15 16 0 10-15 16Z"
          fill="#e6ddba"
          stroke="#9ab6bd"
          strokeWidth="2"
        />
        {s.upgrade === 'sail' && (
          <path
            d="M-12-8-44 21-16 15M12-8 44 21 16 15"
            fill="#ebd39ccc"
            stroke="#fff0bf"
            strokeWidth="1.5"
          />
        )}
        {s.upgrade === 'shield' && (
          <ellipse
            rx="28"
            ry="34"
            fill="#a1d9d321"
            stroke="#b8e2d6bb"
            strokeWidth="2"
          />
        )}
        {f && <path d="M-5 14 0 33 5 14" fill="#acdce0" />}
      </g>
      {s.activity && (
        <circle
          cx={x}
          cy={STARS[s.location].y}
          r={
            STARS[s.location].radius +
            22 +
            (reduced ? 0 : (1 - s.activity.remaining / 5) * 18)
          }
          fill="none"
          stroke="#c6dec477"
          strokeWidth="2"
          strokeDasharray="8 8"
        />
      )}
      {s.outpost && (
        <g transform="translate(410 640)">
          <rect
            x="-360"
            y="-55"
            width="720"
            height="100"
            rx="20"
            fill="#132e3be8"
            stroke="#8eb6b444"
          />
          <text x="-333" y="-23" fontSize="16" fill="#dce4bb">
            {s.outpost.habitat === 'wetland' ? '湿地前哨' : '穹顶前哨'}
          </text>
          <path
            d="M-330 27Q-290-15-250 27T-170 27"
            stroke="#8bc1a8"
            strokeWidth="5"
            fill="none"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${-315 + i * 31} 25v${-8 - s.outpost!.growth * 0.32}m0 12-8-9m8 9 8-9`}
              stroke="#c0d996"
              strokeWidth="3"
              fill="none"
            />
          ))}
          <text x="-115" y="-2" fontSize="18" fill="#dce4bb">
            生长 {Math.floor(s.outpost.growth)}% · 稳定{' '}
            {Math.round(s.outpost.stability)}%
          </text>
          <text
            x="-115"
            y="24"
            fontSize="15"
            fill={ecologyError(s) ? '#f2ba8c' : '#a9cfcc'}
          >
            {ecologyFeedback(s).label}
          </text>
        </g>
      )}
    </svg>
  );
}
