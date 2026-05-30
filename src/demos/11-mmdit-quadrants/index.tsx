import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RegistrationMark } from '../../components/RegistrationMark';
import { PaperRef } from '../../components/PaperRef';
import { EquationCallout } from '../../components/EquationCallout';
import { AttentionHeatmap, ColorRamp } from '../../components/AttentionHeatmap';
import { MODALITY_HEX } from '../../lib/viz/colors';

const N_IMG = 8;
const N_ACT = 6;
const N = N_IMG + N_ACT;

function seeded(i: number, j: number): number {
  const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Quadrant = 'img-img' | 'img-act' | 'act-img' | 'act-act' | null;

export default function MMDiTQuadrants() {
  const [mode, setMode] = useState<'mmdit' | 'cross'>('mmdit');
  const [hoverQuad, setHoverQuad] = useState<Quadrant>(null);
  const [trainStep, setTrainStep] = useState(0.7); // adaLN-Zero gamma ramp 0..1

  // Build (N×N) joint attention matrix
  const matrix = useMemo(() => {
    const m: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const rImg = r < N_IMG;
        const cImg = c < N_IMG;
        let v = 0;
        if (rImg && cImg) {
          // img↔img: soft locality
          v = Math.exp(-Math.abs(r - c) * 0.5) * (0.6 + seeded(r, c) * 0.4);
        } else if (!rImg && !cImg) {
          // act↔act: soft causal-ish
          v = (c <= r ? 0.7 : 0.2) * (0.5 + seeded(r, c) * 0.5);
        } else if (!rImg && cImg) {
          // act→img: action queries look at a few image patches
          v = (Math.abs(c - 3) < 2 ? 0.9 : 0.3) * (0.4 + seeded(r, c) * 0.6);
        } else {
          // img→act
          v = 0.4 * (0.3 + seeded(r, c) * 0.7);
        }
        // In vanilla cross-attention, only the off-diagonal (cross-modal) blocks exist
        if (mode === 'cross' && rImg === cImg) v = 0;
        m[r][c] = v;
      }
    }
    // row-normalize for honesty
    return m.map((row) => {
      const s = row.reduce((a, b) => a + b, 0) || 1;
      return row.map((v) => v / s);
    });
  }, [mode]);

  // dim cells outside hovered quadrant
  const highlightMask = useMemo(() => {
    if (!hoverQuad) return null;
    return (r: number, c: number) => {
      const rImg = r < N_IMG;
      const cImg = c < N_IMG;
      if (hoverQuad === 'img-img') return rImg && cImg;
      if (hoverQuad === 'act-act') return !rImg && !cImg;
      if (hoverQuad === 'act-img') return !rImg && cImg;
      if (hoverQuad === 'img-act') return rImg && !cImg;
      return false;
    };
  }, [hoverQuad]);

  const displayMatrix = useMemo(() => {
    if (!highlightMask) return matrix;
    return matrix.map((row, r) => row.map((v, c) => (highlightMask(r, c) ? v : v * 0.18)));
  }, [matrix, highlightMask]);

  const rowLabels = [
    ...Array.from({ length: N_IMG }, (_, i) => `i${i}`),
    ...Array.from({ length: N_ACT }, (_, i) => `a${i}`),
  ];

  const gamma = trainStep;

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">11</span>
        <h1 className="section-title">DECO — MMDiT's Three Pipes</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4 max-w-3xl">
        DECO routes three modalities into one denoiser three different ways. The killer
        contrast: vanilla cross-attention reads from a frozen source (off-diagonal
        blocks only); MMDiT <em>joint self-attention</em> concatenates vision + action
        and updates both in the same matmul — all four quadrants light up.
      </p>
      <div className="flex gap-2 mb-6 flex-wrap">
        <PaperRef arxiv="2602.05513">Li et al. 2025 (DECO)</PaperRef>
        <PaperRef arxiv="2212.09748">Peebles &amp; Xie 2023 (adaLN-Zero)</PaperRef>
      </div>

      {/* Vision <-> action joint self-attention quadrants */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
        <div className="card-sunken">
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className="font-mono text-2xs text-text-tertiary">JOINT ATTENTION ({N}×{N})</span>
            <div className="flex gap-1">
              {(['mmdit', 'cross'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`font-mono text-2xs px-2 py-0.5 rounded transition-colors ${
                    mode === m ? 'bg-accent/20 text-accent' : 'text-text-disabled hover:text-text-secondary'
                  }`}
                >
                  {m === 'mmdit' ? 'MMDiT joint' : 'vanilla cross-attn'}
                </button>
              ))}
            </div>
          </div>
          <AttentionHeatmap
            matrix={displayMatrix}
            scheme="blues"
            cellSize={20}
            gap={1}
            rowLabels={rowLabels}
            quadrantAt={{ row: N_IMG, col: N_IMG }}
          />
          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            <ColorRamp scheme="blues" label="attention" />
            <div className="flex gap-2 font-mono text-2xs">
              <span style={{ color: MODALITY_HEX.rgb }}>i = image</span>
              <span style={{ color: MODALITY_HEX.action }}>a = action</span>
            </div>
          </div>
        </div>

        {/* quadrant legend / hover toggles */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { id: 'img-img', label: 'image ↔ image', desc: 'spatial self-attention over patches', on: true },
            { id: 'img-act', label: 'image → action', desc: 'image informs action tokens', on: mode === 'mmdit' },
            { id: 'act-img', label: 'action → image', desc: 'action queries the image', on: true },
            { id: 'act-act', label: 'action ↔ action', desc: 'temporal self-attention over the chunk', on: mode === 'mmdit' },
          ] as const).map((q) => (
            <button
              key={q.id}
              onMouseEnter={() => setHoverQuad(q.id as Quadrant)}
              onMouseLeave={() => setHoverQuad(null)}
              className={`card text-left transition-all ${q.on ? '' : 'opacity-40'}`}
              style={{ borderColor: hoverQuad === q.id ? 'var(--accent)' : undefined }}
            >
              <div className="font-mono text-xs text-text-primary mb-1">{q.label}</div>
              <div className="font-mono text-2xs text-text-disabled">{q.desc}</div>
              <div className="font-mono text-2xs mt-1" style={{ color: q.on ? '#4ade80' : '#f87171' }}>
                {q.on ? 'active' : 'absent in cross-attn'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 card-sunken">
        <EquationCallout tex="[\mathbf{o}', \mathbf{a}'] = \text{softmax}\!\left(\frac{[\mathbf{o};\mathbf{a}][\mathbf{o};\mathbf{a}]^\top}{\sqrt{d}}\right)[\mathbf{o};\mathbf{a}]" display />
        <div className="font-mono text-2xs text-text-disabled text-center">
          One softmax updates both modalities. Vanilla cross-attention keeps K/V frozen — the diagonal blocks vanish.
        </div>
      </div>

      {/* The other two pipes */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* adaLN-Zero */}
        <div className="card">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            PROPRIO via adaLN-Zero · <span style={{ color: MODALITY_HEX.proprio }}>modulating sleeve</span>
          </div>
          <div className="flex items-center justify-center gap-6 h-[150px]">
            {/* gamma dial */}
            <div className="flex flex-col items-center gap-1">
              <svg width={70} height={70} viewBox="0 0 70 70">
                <circle cx={35} cy={35} r={30} fill="none" stroke="var(--border-subtle)" strokeWidth={6} />
                <motion.circle
                  cx={35} cy={35} r={30} fill="none"
                  stroke={MODALITY_HEX.proprio} strokeWidth={6} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 30}
                  animate={{ strokeDashoffset: 2 * Math.PI * 30 * (1 - gamma) }}
                  transform="rotate(-90 35 35)"
                />
                <text x={35} y={39} textAnchor="middle" fontSize={13} fontFamily="var(--font-mono)" fill="var(--text-primary)">
                  {gamma.toFixed(2)}
                </text>
              </svg>
              <span className="font-mono text-2xs text-text-disabled">γ (scale)</span>
            </div>
            {/* LayerNorm box */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded border-2 flex items-center justify-center" style={{ borderColor: MODALITY_HEX.proprio }}>
                <span className="font-mono text-2xs text-center" style={{ color: MODALITY_HEX.proprio }}>Layer<br />Norm</span>
              </div>
              <span className="font-mono text-2xs text-text-disabled">(1+γ)·LN(x)+β</span>
            </div>
            {/* beta dial */}
            <div className="flex flex-col items-center gap-1">
              <svg width={70} height={70} viewBox="0 0 70 70">
                <circle cx={35} cy={35} r={30} fill="none" stroke="var(--border-subtle)" strokeWidth={6} />
                <motion.circle
                  cx={35} cy={35} r={30} fill="none"
                  stroke={MODALITY_HEX.proprio} strokeWidth={6} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 30}
                  animate={{ strokeDashoffset: 2 * Math.PI * 30 * (1 - gamma * 0.7) }}
                  transform="rotate(-90 35 35)"
                />
                <text x={35} y={39} textAnchor="middle" fontSize={13} fontFamily="var(--font-mono)" fill="var(--text-primary)">
                  {(gamma * 0.7).toFixed(2)}
                </text>
              </svg>
              <span className="font-mono text-2xs text-text-disabled">β (shift)</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex justify-between font-mono text-2xs mb-1">
              <span className="text-text-secondary">training progress</span>
              <span className="text-text-disabled">γ zero-init → learned</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={trainStep} onChange={(e) => setTrainStep(+e.target.value)} className="w-full accent-accent" />
          </div>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            "Zero" = γ starts at 0, so proprio is a gradual learned add-on (Peebles &amp; Xie DiT).
          </p>
        </div>

        {/* Tactile adapter */}
        <div className="card">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            TACTILE / F-T via cross-attn adapter · <span style={{ color: MODALITY_HEX.force }}>plug-in</span>
          </div>
          <div className="flex items-center justify-center gap-3 h-[150px]">
            <div className="flex flex-col items-center gap-1 opacity-60">
              <div className="w-20 h-20 rounded border-2 border-dashed flex items-center justify-center" style={{ borderColor: 'var(--border-strong)' }}>
                <span className="font-mono text-2xs text-center text-text-tertiary">frozen<br />vision-action<br />policy</span>
              </div>
              <span className="font-mono text-2xs text-text-disabled">stage 1</span>
            </div>
            <span className="font-mono text-text-disabled">+</span>
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className="w-16 h-16 rounded border-2 flex items-center justify-center"
                style={{ borderColor: MODALITY_HEX.force }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                <span className="font-mono text-2xs text-center" style={{ color: MODALITY_HEX.force }}>F/T cross-attn<br />adapter</span>
              </motion.div>
              <span className="font-mono text-2xs text-text-disabled">stage 2</span>
            </div>
          </div>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            Tactile K/V bolt onto the frozen policy's queries — the only path that is purely
            "added on top," matching DECO's two-stage training.
          </p>
        </div>
      </div>

      <div className="mt-4 card-sunken border-l-2 pl-4" style={{ borderColor: MODALITY_HEX.proprio }}>
        <p className="font-mono text-2xs text-text-disabled">
          Color rule: <span style={{ color: MODALITY_HEX.rgb }}>vision</span> ·
          <span style={{ color: MODALITY_HEX.action }}> action</span> ·
          <span style={{ color: MODALITY_HEX.proprio }}> proprio</span> ·
          <span style={{ color: MODALITY_HEX.force }}> tactile/F-T</span> — one color per modality, everywhere.
        </p>
      </div>
    </div>
  );
}
