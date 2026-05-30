import { useMemo } from 'react';
import {
  interpolateBlues,
  interpolateGreys,
  interpolateOranges,
  interpolatePuBuGn,
  interpolateRdPu,
} from 'd3';

const SCHEMES = {
  blues: interpolateBlues,
  greys: interpolateGreys,
  oranges: interpolateOranges,
  pubugn: interpolatePuBuGn,
  rdpu: interpolateRdPu,
} as const;

export type HeatmapScheme = keyof typeof SCHEMES;

interface AttentionHeatmapProps {
  matrix: number[][];
  scheme?: HeatmapScheme;
  cellSize?: number;
  gap?: number;
  rowLabels?: string[];
  colLabels?: string[];
  /** normalize colors against this max; defaults to per-matrix max */
  vmax?: number;
  highlightRow?: number | null;
  highlightCol?: number | null;
  onCellHover?: (row: number, col: number, value: number) => void;
  onRowHover?: (row: number | null) => void;
  showValues?: boolean;
  /** draw a thin border around every cell */
  gridLines?: boolean;
  /** quadrant dividers at these row/col indices */
  quadrantAt?: { row?: number; col?: number };
  maxWidth?: number;
}

export function AttentionHeatmap({
  matrix,
  scheme = 'blues',
  cellSize = 16,
  gap = 1,
  rowLabels,
  colLabels,
  vmax,
  highlightRow = null,
  highlightCol = null,
  onCellHover,
  onRowHover,
  showValues = false,
  gridLines = false,
  quadrantAt,
  maxWidth,
}: AttentionHeatmapProps) {
  const interp = SCHEMES[scheme];
  const rows = matrix.length;
  const cols = rows > 0 ? matrix[0].length : 0;

  const computedMax = useMemo(() => {
    if (vmax != null) return vmax;
    let m = 0;
    for (const row of matrix) for (const v of row) if (v > m) m = v;
    return m || 1;
  }, [matrix, vmax]);

  const labelW = rowLabels ? 36 : 0;
  const labelH = colLabels ? 16 : 0;
  const step = cellSize + gap;
  const gridW = cols * step;
  const gridH = rows * step;
  const totalW = labelW + gridW + 4;
  const totalH = labelH + gridH + 4;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={maxWidth ? { maxWidth, width: '100%', height: 'auto' } : undefined}
      className="select-none"
      onMouseLeave={() => onRowHover?.(null)}
    >
      {/* Column labels */}
      {colLabels &&
        colLabels.map((lbl, c) => (
          <text
            key={`col-${c}`}
            x={labelW + c * step + cellSize / 2}
            y={labelH - 4}
            textAnchor="middle"
            fontSize={8}
            fontFamily="var(--font-mono)"
            fill="var(--text-tertiary)"
          >
            {lbl}
          </text>
        ))}

      {/* Cells */}
      {matrix.map((row, r) =>
        row.map((v, c) => {
          const norm = Math.max(0, Math.min(1, v / computedMax));
          const isHi =
            (highlightRow != null && highlightRow === r) ||
            (highlightCol != null && highlightCol === c);
          const dimmed =
            (highlightRow != null && highlightRow !== r) ||
            (highlightCol != null && highlightCol !== c);
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={labelW + c * step}
                y={labelH + r * step}
                width={cellSize}
                height={cellSize}
                rx={1.5}
                fill={interp(0.12 + norm * 0.88)}
                opacity={dimmed ? 0.35 : 1}
                stroke={isHi ? 'var(--accent)' : gridLines ? 'var(--border-subtle)' : 'none'}
                strokeWidth={isHi ? 1.5 : 0.5}
                onMouseEnter={() => {
                  onCellHover?.(r, c, v);
                  onRowHover?.(r);
                }}
                style={{ cursor: onCellHover || onRowHover ? 'crosshair' : 'default' }}
              />
              {showValues && cellSize >= 22 && (
                <text
                  x={labelW + c * step + cellSize / 2}
                  y={labelH + r * step + cellSize / 2 + 3}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="var(--font-mono)"
                  fill={norm > 0.55 ? '#000' : 'var(--text-secondary)'}
                  pointerEvents="none"
                >
                  {v.toFixed(2)}
                </text>
              )}
            </g>
          );
        }),
      )}

      {/* Row labels */}
      {rowLabels &&
        rowLabels.map((lbl, r) => (
          <text
            key={`row-${r}`}
            x={labelW - 6}
            y={labelH + r * step + cellSize / 2 + 3}
            textAnchor="end"
            fontSize={8}
            fontFamily="var(--font-mono)"
            fill="var(--text-tertiary)"
          >
            {lbl}
          </text>
        ))}

      {/* Quadrant dividers */}
      {quadrantAt?.col != null && (
        <line
          x1={labelW + quadrantAt.col * step - gap / 2}
          y1={labelH}
          x2={labelW + quadrantAt.col * step - gap / 2}
          y2={labelH + gridH}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      {quadrantAt?.row != null && (
        <line
          x1={labelW}
          y1={labelH + quadrantAt.row * step - gap / 2}
          x2={labelW + gridW}
          y2={labelH + quadrantAt.row * step - gap / 2}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}

/** Sequential color ramp legend */
export function ColorRamp({
  scheme = 'blues',
  width = 120,
  label,
  min = '0',
  max = '1',
}: {
  scheme?: HeatmapScheme;
  width?: number;
  label?: string;
  min?: string;
  max?: string;
}) {
  const interp = SCHEMES[scheme];
  const stops = 24;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="font-mono text-2xs text-text-tertiary">{label}</span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-2xs text-text-disabled">{min}</span>
        <svg width={width} height={8}>
          {Array.from({ length: stops }, (_, i) => (
            <rect
              key={i}
              x={(i / stops) * width}
              y={0}
              width={width / stops + 1}
              height={8}
              fill={interp(0.12 + (i / stops) * 0.88)}
            />
          ))}
        </svg>
        <span className="font-mono text-2xs text-text-disabled">{max}</span>
      </div>
    </div>
  );
}
