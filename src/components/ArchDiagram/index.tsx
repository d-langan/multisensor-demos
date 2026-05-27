import { useMemo } from 'react';
import type { ArchDiagramDef, DiagramBlock } from '../../lib/data/types';
import { MODALITY_HEX } from '../../lib/viz/colors';

interface ArchDiagramProps {
  diagram: ArchDiagramDef;
  diffWith?: ArchDiagramDef;
  compact?: boolean;
  onBlockClick?: (b: DiagramBlock) => void;
  highlightBlocks?: Set<string>;
}

const KIND_FILL: Record<string, string> = {
  obs: '#1a1d24',
  encoder: '#1a1e28',
  fusion: '#1e1a24',
  cond: '#241e1a',
  backbone: '#1a2420',
  output: '#241a1a',
};

const KIND_BORDER: Record<string, string> = {
  obs: '#2d3138',
  encoder: '#2d3850',
  fusion: '#502d38',
  cond: '#50382d',
  backbone: '#2d5038',
  output: '#503838',
};

const BLOCK_W = 160;
const BLOCK_H = 52;
const GAP_X = 190;
const GAP_Y = 72;
const PAD = 30;

function getBlockPos(block: DiagramBlock) {
  return {
    x: PAD + (block.x || 0) * GAP_X,
    y: PAD + (block.y || 0) * GAP_Y,
  };
}

function getBlockCenter(block: DiagramBlock) {
  const pos = getBlockPos(block);
  return { cx: pos.x + BLOCK_W / 2, cy: pos.y + BLOCK_H / 2 };
}

export function ArchDiagram({
  diagram,
  diffWith,
  compact = false,
  onBlockClick,
  highlightBlocks,
}: ArchDiagramProps) {
  const diffBlockIds = useMemo(() => {
    if (!diffWith) return null;
    const otherIds = new Set(diffWith.blocks.map((b) => b.id));
    const thisIds = new Set(diagram.blocks.map((b) => b.id));
    return {
      added: diagram.blocks.filter((b) => !otherIds.has(b.id)).map((b) => b.id),
      removed: diffWith.blocks.filter((b) => !thisIds.has(b.id)).map((b) => b.id),
      shared: diagram.blocks.filter((b) => otherIds.has(b.id)).map((b) => b.id),
    };
  }, [diagram, diffWith]);

  const blockMap = useMemo(
    () => new Map(diagram.blocks.map((b) => [b.id, b])),
    [diagram],
  );

  // Compute SVG dimensions
  const maxX = Math.max(...diagram.blocks.map((b) => (b.x || 0))) * GAP_X + BLOCK_W + PAD * 2;
  const maxY = Math.max(...diagram.blocks.map((b) => (b.y || 0))) * GAP_Y + BLOCK_H + PAD * 2;

  const scale = compact ? 0.45 : 1;

  return (
    <div className={compact ? '' : 'overflow-x-auto'}>
      <svg
        width={maxX * scale}
        height={maxY * scale}
        viewBox={`0 0 ${maxX} ${maxY}`}
        className="select-none"
      >
        <defs>
          <marker
            id={`arrow-${diagram.model}`}
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L8,3 L0,6" fill="var(--text-tertiary)" />
          </marker>
        </defs>

        {/* Edges */}
        {diagram.edges.map((edge, i) => {
          const fromBlock = blockMap.get(edge.from);
          const toBlock = blockMap.get(edge.to);
          if (!fromBlock || !toBlock) return null;

          const from = getBlockCenter(fromBlock);
          const to = getBlockCenter(toBlock);

          // Simple straight-ish path from right of source to left of target
          const fromPos = getBlockPos(fromBlock);
          const toPos = getBlockPos(toBlock);
          const x1 = fromPos.x + BLOCK_W;
          const y1 = from.cy;
          const x2 = toPos.x;
          const y2 = to.cy;

          const midX = (x1 + x2) / 2;

          return (
            <g key={`edge-${i}`}>
              <path
                d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                stroke="var(--text-tertiary)"
                strokeWidth={1}
                fill="none"
                opacity={0.5}
                markerEnd={`url(#arrow-${diagram.model})`}
              />
              {edge.label && !compact && (
                <text
                  x={midX}
                  y={Math.min(y1, y2) - 6}
                  textAnchor="middle"
                  fill="var(--text-disabled)"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Blocks */}
        {diagram.blocks.map((block) => {
          const pos = getBlockPos(block);
          const isAdded = diffBlockIds?.added.includes(block.id);
          const isHighlighted = highlightBlocks?.has(block.id);
          const modalityColor = block.color
            ? MODALITY_HEX[block.color as keyof typeof MODALITY_HEX]
            : undefined;

          let borderColor = KIND_BORDER[block.kind] || '#2d3138';
          let fillColor = KIND_FILL[block.kind] || '#1a1d24';
          let opacity = 1;

          if (isAdded) {
            borderColor = '#4ade80';
            fillColor = '#0f2917';
          }
          if (isHighlighted) {
            borderColor = 'var(--accent)';
          }

          return (
            <g
              key={block.id}
              onClick={() => onBlockClick?.(block)}
              className={onBlockClick ? 'cursor-pointer' : ''}
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={BLOCK_W}
                height={BLOCK_H}
                rx={6}
                fill={fillColor}
                stroke={borderColor}
                strokeWidth={isAdded || isHighlighted ? 2 : 1}
                opacity={opacity}
              />
              {modalityColor && (
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={3}
                  height={BLOCK_H}
                  rx={1.5}
                  fill={modalityColor}
                />
              )}
              {!compact && (
                <>
                  <text
                    x={pos.x + 10}
                    y={pos.y + 20}
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    fontWeight={500}
                  >
                    {block.label.length > 24
                      ? block.label.slice(0, 22) + '…'
                      : block.label}
                  </text>
                  <text
                    x={pos.x + 10}
                    y={pos.y + 36}
                    fill="var(--text-tertiary)"
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                  >
                    {block.shape}
                  </text>
                </>
              )}
              {compact && (
                <text
                  x={pos.x + BLOCK_W / 2}
                  y={pos.y + BLOCK_H / 2 + 4}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                >
                  {block.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
