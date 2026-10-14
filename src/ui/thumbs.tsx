/** Small line-art thumbnails for shapes, structures and railings */
import type { RailingType, StairShape, StructureType } from '../engine/types';

const S = { stroke: 'currentColor', strokeWidth: 1.4, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const WOOD = '#d3ad7f';

function treadLines(x: number, y: number, w: number, h: number, n: number, vertical: boolean) {
  const out = [];
  for (let i = 1; i < n; i++) {
    out.push(
      vertical ? <line key={i} x1={x} x2={x + w} y1={y + (h * i) / n} y2={y + (h * i) / n} {...S} strokeWidth={0.8} opacity={0.55} /> : <line key={i} y1={y} y2={y + h} x1={x + (w * i) / n} x2={x + (w * i) / n} {...S} strokeWidth={0.8} opacity={0.55} />,
    );
  }
  return out;
}

export function ShapeThumb({ shape }: { shape: StairShape }) {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      {shape === 'I' && (
        <g>
          <rect x={24} y={6} width={16} height={52} rx={1.5} {...S} />
          {treadLines(24, 6, 16, 52, 11, true)}
          <path d="M32 52 L32 14 M28.5 17.5 L32 13.5 L35.5 17.5" {...S} strokeWidth={1.2} />
        </g>
      )}
      {shape === 'L' && (
        <g>
          <rect x={10} y={24} width={16} height={34} rx={1.5} {...S} />
          {treadLines(10, 24, 16, 34, 6, true)}
          <rect x={10} y={8} width={16} height={16} rx={1.5} {...S} fill="currentColor" fillOpacity={0.07} />
          <rect x={26} y={8} width={30} height={16} rx={1.5} {...S} />
          {treadLines(26, 8, 30, 16, 6, false)}
          <path d="M18 52 L18 16 L50 16 M46.5 12.5 L50.5 16 L46.5 19.5" {...S} strokeWidth={1.2} />
        </g>
      )}
      {shape === 'U' && (
        <g>
          <rect x={10} y={22} width={18} height={36} rx={1.5} {...S} />
          {treadLines(10, 22, 18, 36, 7, true)}
          <rect x={36} y={22} width={18} height={36} rx={1.5} {...S} />
          {treadLines(36, 22, 18, 36, 7, true)}
          <rect x={10} y={8} width={44} height={14} rx={1.5} {...S} fill="currentColor" fillOpacity={0.07} />
          <path d="M19 52 L19 15 L45 15 L45 52 M41.5 48.5 L45 52.5 L48.5 48.5" {...S} strokeWidth={1.2} />
        </g>
      )}
    </svg>
  );
}

/** side profile of 4 steps */
function steps(n = 5, x0 = 6, y0 = 54, g = 10, h = 9) {
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * g, y: y0 - (i + 1) * h, g, h }));
}

export function StructureThumb({ type }: { type: StructureType }) {
  const st = steps();
  const treads = st.map((s, i) => <rect key={i} x={s.x - 1.5} y={s.y} width={s.g + 1.5} height={3} rx={0.8} fill={WOOD} />);
  return (
    <svg viewBox="0 0 64 60" className="h-full w-full">
      {type === 'A' && (
        <g>
          <path d="M10 56 L54 22 L54 30 L18 58 Z" fill="currentColor" opacity={0.9} />
          {st.map((s, i) => (
            <line key={i} x1={s.x + s.g / 2} x2={s.x + s.g / 2} y1={s.y + 3} y2={56 - (s.x + s.g / 2 - 10) * 0.77 + 0} stroke="currentColor" strokeWidth={1.4} />
          ))}
        </g>
      )}
      {type === 'B' && <path d="M4 56 L4 45 L56 6 L58 6 L58 14 L12 56 Z" fill="currentColor" opacity={0.85} />}
      {type === 'C' && (
        <path
          d={`M6 56 ${st.map((s) => `L${s.x} ${s.y + 3} L${s.x + s.g} ${s.y + 3}`).join(' ')} L56 16 L22 56 Z`}
          fill="currentColor"
          opacity={0.9}
        />
      )}
      {type === 'D' && (
        <path d={`M6 56 ${st.map((s) => `L${s.x} ${s.y + 3} L${s.x + s.g} ${s.y + 3}`).join(' ')}`} {...S} strokeWidth={2.4} />
      )}
      {type === 'E' && (
        <g {...S} strokeWidth={1.3}>
          <path d="M12 56 L56 20" strokeWidth={2.4} />
          {st.map((s, i) => (
            <g key={i}>
              <path d={`M${s.x + 1} ${s.y + 4} L${s.x + 1} ${56 - (s.x + 1 - 12) * 0.82}`} />
              <path d={`M${s.x + s.g - 1} ${s.y + 4} L${s.x + s.g - 1} ${56 - (s.x + s.g - 1 - 12) * 0.82}`} />
            </g>
          ))}
          <path d="M40 34 L40 58" strokeWidth={2} />
        </g>
      )}
      {treads}
    </svg>
  );
}

export function RailingThumb({ type }: { type: RailingType }) {
  // sloped railing elevation
  const x0 = 6;
  const x1 = 58;
  const yb0 = 54;
  const yb1 = 26;
  const H = 22;
  const top = (x: number) => yb0 + ((yb1 - yb0) * (x - x0)) / (x1 - x0) - H;
  const bot = (x: number) => yb0 + ((yb1 - yb0) * (x - x0)) / (x1 - x0);
  const xs = (n: number) => Array.from({ length: n }, (_, i) => x0 + 3 + ((x1 - x0 - 6) * (i + 0.5)) / n);
  return (
    <svg viewBox="0 0 64 60" className="h-full w-full">
      <line x1={x0} y1={top(x0)} x2={x1} y2={top(x1)} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <line x1={x0} y1={bot(x0)} x2={x1} y2={bot(x1)} stroke={WOOD} strokeWidth={3} />
      <line x1={x0} y1={top(x0)} x2={x0} y2={bot(x0) + 3} stroke="currentColor" strokeWidth={2} />
      <line x1={x1} y1={top(x1)} x2={x1} y2={bot(x1) + 3} stroke="currentColor" strokeWidth={2} />
      {type === 'A' && xs(12).map((x, i) => <line key={i} x1={x} x2={x} y1={top(x)} y2={bot(x)} stroke="currentColor" strokeWidth={0.8} />)}
      {type === 'B' && xs(8).map((x, i) => <line key={i} x1={x} x2={x} y1={top(x)} y2={bot(x)} stroke="currentColor" strokeWidth={2.6} />)}
      {type === 'C' && [0.25, 0.45, 0.65, 0.85].map((k, i) => <line key={i} x1={x0} x2={x1} y1={top(x0) + H * k} y2={top(x1) + H * k} stroke="currentColor" strokeWidth={0.9} />)}
      {(type === 'D' || type === 'E' || type === 'F') && (
        <g>
          <defs>
            <pattern id="perf" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.9" fill="currentColor" opacity="0.55" />
            </pattern>
            <pattern id="mesh" width="5" height="3.4" patternUnits="userSpaceOnUse">
              <path d="M0 1.7 L2.5 0 L5 1.7 L2.5 3.4 Z" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
            </pattern>
          </defs>
          <path
            d={`M${x0 + 2} ${top(x0 + 2) + 2} L${x1 - 2} ${top(x1 - 2) + 2} L${x1 - 2} ${bot(x1 - 2) - 1} L${x0 + 2} ${bot(x0 + 2) - 1} Z`}
            fill={type === 'D' ? 'url(#perf)' : type === 'E' ? 'url(#mesh)' : 'currentColor'}
            fillOpacity={type === 'F' ? 0.85 : 1}
            stroke="currentColor"
            strokeWidth={1}
          />
        </g>
      )}
    </svg>
  );
}
