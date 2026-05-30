import { useEffect, useState, useMemo } from 'react';
import { interpolateCividis, interpolateRdBu } from 'd3';
import { RegistrationMark } from '../../components/RegistrationMark';
import { PaperRef } from '../../components/PaperRef';
import { EquationCallout } from '../../components/EquationCallout';
import { MODALITY_HEX } from '../../lib/viz/colors';

interface FTData {
  t: number[];
  fx: number[]; fy: number[]; fz: number[];
  tx: number[]; ty: number[]; tz: number[];
}

const CHANNELS = ['fx', 'fy', 'fz', 'tx', 'ty', 'tz'] as const;
const CH_LABELS = ['Fx', 'Fy', 'Fz', 'Tx', 'Ty', 'Tz'];
const WINDOW = 30;

// soft contact gate φ: 0 at 2N → 1 at 8N
const phiSoft = (mag: number) => Math.max(0, Math.min(1, (mag - 2) / 6));

export default function TemporalForce() {
  const [ft, setFt] = useState<FTData | null>(null);
  const [playhead, setPlayhead] = useState(0.6); // 0..1 across episode

  useEffect(() => {
    fetch('./data/episode_19/force_torque.json').then((r) => r.json()).then(setFt).catch(() => {});
  }, []);

  const T = ft ? ft.t.length : 0;
  const nowIdx = Math.floor(playhead * (T - 1));

  // 30-step window ending at nowIdx
  const windowData = useMemo(() => {
    if (!ft) return [];
    const start = Math.max(0, nowIdx - WINDOW + 1);
    return CHANNELS.map((ch) => {
      const vals: number[] = [];
      for (let i = start; i <= nowIdx; i++) vals.push(ft[ch][i]);
      while (vals.length < WINDOW) vals.unshift(0);
      return vals;
    });
  }, [ft, nowIdx]);

  // force magnitude + phi over whole episode (downsampled)
  const phasePoints = useMemo(() => {
    if (!ft) return [];
    const pts: { mag: number; phi: number; tNorm: number }[] = [];
    const stride = Math.max(1, Math.floor(T / 400));
    for (let i = 0; i < T; i += stride) {
      const mag = Math.sqrt(ft.fx[i] ** 2 + ft.fy[i] ** 2 + ft.fz[i] ** 2);
      pts.push({ mag, phi: phiSoft(mag), tNorm: i / (T - 1) });
    }
    return pts;
  }, [ft, T]);

  const magNow = useMemo(() => {
    if (!ft) return 0;
    return Math.sqrt(ft.fx[nowIdx] ** 2 + ft.fy[nowIdx] ** 2 + ft.fz[nowIdx] ** 2);
  }, [ft, nowIdx]);
  const phiNow = phiSoft(magNow);

  // sinusoidal PE: 30 positions × d dims
  const D_PE = 64;
  const pe = useMemo(() => {
    const m: number[][] = [];
    for (let pos = 0; pos < WINDOW; pos++) {
      const row: number[] = [];
      for (let i = 0; i < D_PE; i++) {
        const freq = 1 / Math.pow(10000, (2 * Math.floor(i / 2)) / D_PE);
        row.push(i % 2 === 0 ? Math.sin(pos * freq) : Math.cos(pos * freq));
      }
      m.push(row);
    }
    return m;
  }, []);

  // 2D Lissajous projection of PE (two-frequency blend)
  const lissajous = useMemo(() => {
    return pe.map((row, pos) => {
      const x = row[0] + 0.5 * row[4] + 0.3 * row[8];
      const y = row[1] + 0.5 * row[5] + 0.3 * row[9];
      return { x, y, pos };
    });
  }, [pe]);

  if (!ft) {
    return (
      <div className="container-demo py-8">
        <span className="font-mono text-sm text-text-secondary animate-pulse">Loading force data…</span>
      </div>
    );
  }

  // --- layout constants ---
  const tapeW = 360, tapeRowH = 18, tapeColW = tapeW / WINDOW;
  const ppW = 280, ppH = 200;
  const magMax = Math.max(...phasePoints.map((p) => p.mag), 1);
  const lisExtent = Math.max(...lissajous.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])) || 1;

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">12</span>
        <h1 className="section-title">Temporal Force — FoAR's Tape Head</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4 max-w-3xl">
        FoAR runs a Force Transformer over a 30-step F/T window with sinusoidal
        positional encoding, gated by a learned contact probability φ. Three views of
        how force becomes <em>time-aware</em>.
      </p>
      <div className="flex gap-2 mb-6 flex-wrap">
        <PaperRef arxiv="2411.15753">He et al. 2025 (FoAR)</PaperRef>
        <PaperRef arxiv="1706.03762">Vaswani et al. 2017 (PE)</PaperRef>
      </div>

      {/* playhead */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-2xs text-text-tertiary">PLAYHEAD · t={ft.t[nowIdx].toFixed(1)}s</span>
          <div className="flex items-center gap-3 font-mono text-2xs">
            <span style={{ color: MODALITY_HEX.force }}>|F| = {magNow.toFixed(1)} N</span>
            <span style={{ color: phiNow > 0.5 ? '#4ade80' : '#f87171' }}>φ = {phiNow.toFixed(2)}</span>
          </div>
        </div>
        <input type="range" min={0} max={1} step={0.002} value={playhead} onChange={(e) => setPlayhead(+e.target.value)} className="w-full accent-accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30-step rolling tape */}
        <div className="card-sunken">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            30-STEP F/T WINDOW · the rolling tape head
          </div>
          <svg width={tapeW + 30} height={WINDOW > 0 ? 6 * (tapeRowH + 2) + 16 : 0} className="overflow-visible">
            {windowData.map((vals, ch) => {
              const maxAbs = Math.max(...vals.map((v) => Math.abs(v)), 1);
              return (
                <g key={ch} transform={`translate(30, ${ch * (tapeRowH + 2)})`}>
                  <text x={-6} y={tapeRowH / 2 + 3} textAnchor="end" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-tertiary)">
                    {CH_LABELS[ch]}
                  </text>
                  {vals.map((v, i) => (
                    <rect
                      key={i}
                      x={i * tapeColW}
                      y={0}
                      width={tapeColW - 0.5}
                      height={tapeRowH}
                      fill={interpolateRdBu(0.5 - (v / maxAbs) * 0.45)}
                      rx={0.5}
                    />
                  ))}
                </g>
              );
            })}
            {/* now cursor */}
            <line x1={30 + WINDOW * tapeColW} y1={0} x2={30 + WINDOW * tapeColW} y2={6 * (tapeRowH + 2)} stroke="var(--accent)" strokeWidth={1.5} />
            <text x={30 + WINDOW * tapeColW - 2} y={6 * (tapeRowH + 2) + 10} textAnchor="end" fontSize={8} fontFamily="var(--font-mono)" fill="var(--accent)">now</text>
            <text x={30} y={6 * (tapeRowH + 2) + 10} fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-disabled)">−1.0s</text>
          </svg>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            6 channels × 30 timesteps (1 s at 30 Hz). Old steps slide off the left as time advances.
            Diverging color: <span style={{ color: '#ef4444' }}>+</span> / <span style={{ color: '#3b82f6' }}>−</span>.
          </p>
        </div>

        {/* phase portrait */}
        <div className="card-sunken">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            PHASE PORTRAIT · (|F|, φ) · time = color
          </div>
          <svg width={ppW + 40} height={ppH + 30}>
            <g transform="translate(35, 8)">
              {/* axes */}
              <line x1={0} y1={ppH} x2={ppW} y2={ppH} stroke="var(--border-strong)" strokeWidth={1} />
              <line x1={0} y1={0} x2={0} y2={ppH} stroke="var(--border-strong)" strokeWidth={1} />
              {phasePoints.map((p, i) => (
                <circle
                  key={i}
                  cx={(p.mag / magMax) * ppW}
                  cy={ppH - p.phi * ppH}
                  r={1.8}
                  fill={interpolateCividis(p.tNorm)}
                  opacity={0.8}
                />
              ))}
              {/* current point */}
              <circle cx={(magNow / magMax) * ppW} cy={ppH - phiNow * ppH} r={5} fill="none" stroke="var(--accent)" strokeWidth={2} />
              <text x={ppW / 2} y={ppH + 22} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-tertiary)">|F| (N) →</text>
              <text x={-26} y={ppH / 2} fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-tertiary)" transform={`rotate(-90 -26 ${ppH / 2})`}>φ →</text>
            </g>
          </svg>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            A clean episode traces a clockwise loop: low-force/low-φ → high/high (contact) → release.
            Weird trajectories here are a diagnostic for bad runs.
          </p>
        </div>

        {/* sinusoidal PE stacked */}
        <div className="card-sunken">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            SINUSOIDAL PE · geometrically-spaced frequencies
          </div>
          <svg width={tapeW + 30} height={140}>
            {[0, 4, 8, 16, 24, 40].map((dim, k) => {
              const yBase = 18 + k * 20;
              const pts = pe.map((row, pos) => `${30 + (pos / (WINDOW - 1)) * tapeW},${yBase - row[dim] * 8}`).join(' ');
              return (
                <g key={dim}>
                  <text x={26} y={yBase + 3} textAnchor="end" fontSize={7} fontFamily="var(--font-mono)" fill="var(--text-disabled)">d{dim}</text>
                  <polyline points={pts} fill="none" stroke={MODALITY_HEX.proprio} strokeWidth={1} opacity={0.85} />
                </g>
              );
            })}
          </svg>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            PE(pos, 2i) = sin(pos / 10000^{'{'}2i/d{'}'}). Low dims wiggle fast, high dims slow — a binary-clock encoding of position.
          </p>
        </div>

        {/* Lissajous */}
        <div className="card-sunken">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            PE LISSAJOUS · 2D projection of the 30-step PE
          </div>
          <svg width={ppW + 40} height={ppH + 30}>
            <g transform={`translate(${(ppW + 40) / 2}, ${(ppH + 30) / 2})`}>
              {lissajous.map((p, i) => {
                if (i === 0) return null;
                const prev = lissajous[i - 1];
                const scale = (ppH / 2 - 10) / lisExtent;
                return (
                  <line
                    key={i}
                    x1={prev.x * scale} y1={-prev.y * scale}
                    x2={p.x * scale} y2={-p.y * scale}
                    stroke={interpolateCividis(p.pos / (WINDOW - 1))}
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          </svg>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            Project the PE into 2D and the 30 positions trace a near-elliptical loop — the
            "obvious in hindsight" picture of relative time.
          </p>
        </div>
      </div>

      <div className="mt-6 card-sunken">
        <EquationCallout tex="\text{PE}_{(pos,2i)} = \sin\!\left(\frac{pos}{10000^{2i/d}}\right),\quad \text{PE}_{(pos,2i+1)} = \cos\!\left(\frac{pos}{10000^{2i/d}}\right)" display />
      </div>
    </div>
  );
}
