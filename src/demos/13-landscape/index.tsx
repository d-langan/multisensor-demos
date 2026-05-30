import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RegistrationMark } from '../../components/RegistrationMark';
import { PaperRef } from '../../components/PaperRef';
import { MODALITY_HEX } from '../../lib/viz/colors';

interface Approach {
  id: string;
  name: string;
  paper: string;
  arxiv: string;
  /** force influence 0..1 (cross-attention magnitude) */
  x: number;
  /** time-awareness 0..1 (window × PE expressivity) */
  y: number;
  ours: string;
  mechanism: string;
  metric: string;
  route?: string;
}

const APPROACHES: Approach[] = [
  {
    id: 'dp-ca', name: 'DP-CA', paper: 'Kang 2025', arxiv: '2503.03998',
    x: 0.9, y: 0.22, ours: 'B4',
    mechanism: 'Force-as-query cross-attention over image patches.',
    metric: '0.96 success (Kang) · 6×49 attention', route: '/cross-attention',
  },
  {
    id: 'foar', name: 'FoAR', paper: 'He 2025', arxiv: '2411.15753',
    x: 0.78, y: 0.92, ours: 'M3',
    mechanism: 'Force Transformer over 30-step window + φ contact gate.',
    metric: '6.13 N Fz MAE · ΔFz=4.3 N ablation', route: '/temporal-force',
  },
  {
    id: 'octo', name: 'Octo', paper: 'Ghosh 2024', arxiv: '2405.12213',
    x: 0.5, y: 0.7, ours: 'M4',
    mechanism: '256-bin tokenized F/T in a blockwise-causal transformer.',
    metric: '6.93 N Fz MAE · 93M pretrained', route: '/octo-tokenizer',
  },
  {
    id: 'deco', name: 'DECO', paper: 'Li 2025', arxiv: '2602.05513',
    x: 0.68, y: 0.5, ours: 'M2',
    mechanism: 'MMDiT joint attn + adaLN-Zero + tactile cross-attn adapter.',
    metric: '8.73 N Fz MAE · 3 conditioning paths', route: '/mmdit-quadrants',
  },
];

export default function Landscape() {
  const [hover, setHover] = useState<string | null>(null);
  const W = 560, H = 420, pad = 50;
  const px = (x: number) => pad + x * (W - 2 * pad);
  const py = (y: number) => H - pad - y * (H - 2 * pad);

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">13</span>
        <h1 className="section-title">The Landscape</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4 max-w-3xl">
        Four papers, four philosophies for letting force shape a policy. Place them on
        two axes — how much force can <em>vary</em> the policy (x), and how <em>time-aware</em>
        the force pathway is (y) — and each lands in a distinct quadrant.
      </p>
      <div className="flex gap-2 mb-6 flex-wrap">
        {APPROACHES.map((a) => (
          <PaperRef key={a.id} arxiv={a.arxiv}>{a.paper}</PaperRef>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
        <div className="card-sunken">
          <svg width={W} height={H} className="select-none" style={{ maxWidth: '100%', height: 'auto' }}>
            {/* quadrant fills */}
            <rect x={px(0.5)} y={pad} width={(W - 2 * pad) / 2} height={(H - 2 * pad) / 2} fill={MODALITY_HEX.force} opacity={0.04} />
            {/* grid */}
            <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border-strong)" strokeWidth={1} />
            <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--border-strong)" strokeWidth={1} />
            <line x1={px(0.5)} y1={pad} x2={px(0.5)} y2={H - pad} stroke="var(--grid-line-strong)" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={pad} y1={py(0.5)} x2={W - pad} y2={py(0.5)} stroke="var(--grid-line-strong)" strokeWidth={1} strokeDasharray="3 3" />

            {/* axis labels */}
            <text x={W / 2} y={H - 12} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--text-tertiary)">
              force influence (cross-attention magnitude) →
            </text>
            <text x={16} y={H / 2} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--text-tertiary)" transform={`rotate(-90 16 ${H / 2})`}>
              time-awareness (window × PE) →
            </text>

            {/* quadrant captions */}
            <text x={px(0.75)} y={py(0.95)} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-disabled)">strong + temporal</text>
            <text x={px(0.25)} y={py(0.95)} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-disabled)">passive + temporal</text>
            <text x={px(0.75)} y={py(0.05)} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-disabled)">strong + instantaneous</text>

            {/* points */}
            {APPROACHES.map((a) => {
              const hot = hover === a.id;
              return (
                <g key={a.id} transform={`translate(${px(a.x)}, ${py(a.y)})`} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                  <circle r={hot ? 11 : 8} fill={MODALITY_HEX.force} opacity={hot ? 0.9 : 0.65} />
                  <circle r={hot ? 11 : 8} fill="none" stroke={hot ? 'var(--accent)' : 'transparent'} strokeWidth={2} />
                  <text x={14} y={4} fontSize={11} fontFamily="var(--font-mono)" fontWeight={600} fill="var(--text-primary)">{a.name}</text>
                  <text x={14} y={16} fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-disabled)">{a.ours}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* detail panel */}
        <div className="space-y-3">
          {APPROACHES.map((a) => {
            const hot = hover === a.id;
            return (
              <div
                key={a.id}
                onMouseEnter={() => setHover(a.id)}
                onMouseLeave={() => setHover(null)}
                className="card transition-all"
                style={{ borderColor: hot ? 'var(--accent)' : undefined }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-text-primary">{a.name}</span>
                    <span className="font-mono text-2xs text-text-disabled">{a.paper}</span>
                    <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">{a.ours}</span>
                  </div>
                  {a.route && (
                    <Link to={a.route} className="font-mono text-2xs text-accent hover:underline no-underline">demo →</Link>
                  )}
                </div>
                <p className="text-text-secondary text-2xs leading-relaxed">{a.mechanism}</p>
                <p className="font-mono text-2xs text-text-disabled mt-1">{a.metric}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 card-sunken border-l-2 border-modality-force pl-4">
        <p className="text-text-secondary text-sm italic font-display">
          "The variable that matters is the fusion strategy — not the signal content.
          Hold the sensors fixed, change only how force enters, and success swings from
          0.39 to 0.96."
        </p>
      </div>
    </div>
  );
}
