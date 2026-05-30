import { useEffect, useState, useMemo } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';
import { PaperRef } from '../../components/PaperRef';
import { AttentionHeatmap, ColorRamp } from '../../components/AttentionHeatmap';
import { MODALITY_HEX } from '../../lib/viz/colors';

// Abramowitz-Stegun erf approximation → standard normal CDF
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

const AXES = [
  { key: 'fx', label: 'Fx' },
  { key: 'fy', label: 'Fy' },
  { key: 'fz', label: 'Fz' },
  { key: 'tx', label: 'Tx' },
  { key: 'ty', label: 'Ty' },
  { key: 'tz', label: 'Tz' },
] as const;

type AxisKey = (typeof AXES)[number]['key'];

interface FTData {
  t: number[];
  fx: number[]; fy: number[]; fz: number[];
  tx: number[]; ty: number[]; tz: number[];
}

const N_COLS = 120; // downsampled timesteps shown

export default function OctoTokenizer() {
  const [ft, setFt] = useState<FTData | null>(null);
  const [axis, setAxis] = useState<AxisKey>('fz');
  const [nBins, setNBins] = useState(256);
  const [low, setLow] = useState(-2);
  const [high, setHigh] = useState(2);
  const [binType, setBinType] = useState<'normal' | 'uniform'>('normal');

  useEffect(() => {
    fetch('./data/episode_19/force_torque.json')
      .then((r) => r.json())
      .then(setFt)
      .catch(() => {});
  }, []);

  const series = useMemo(() => {
    if (!ft) return [];
    const raw = ft[axis];
    // downsample to N_COLS
    const stride = Math.max(1, Math.floor(raw.length / N_COLS));
    const sampled: number[] = [];
    for (let i = 0; i < raw.length && sampled.length < N_COLS; i += stride) sampled.push(raw[i]);
    return sampled;
  }, [ft, axis]);

  const stats = useMemo(() => {
    if (series.length === 0) return { mean: 0, std: 1 };
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const std = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length) || 1;
    return { mean, std };
  }, [series]);

  // tokenize each timestep → bin index
  const tokens = useMemo(() => {
    return series.map((v) => {
      const z = Math.max(low, Math.min(high, (v - stats.mean) / stats.std));
      let frac: number;
      if (binType === 'normal') {
        // equal-probability bins under N(0,1) between low and high
        const lo = normCdf(low);
        const hi = normCdf(high);
        frac = (normCdf(z) - lo) / (hi - lo);
      } else {
        frac = (z - low) / (high - low);
      }
      return Math.max(0, Math.min(nBins - 1, Math.floor(frac * nBins)));
    });
  }, [series, stats, low, high, nBins, binType]);

  // layout
  const W = 640;
  const topH = 120;
  const rollH = 200;
  const colW = W / N_COLS;
  const minV = series.length ? Math.min(...series) : 0;
  const maxV = series.length ? Math.max(...series) : 1;
  const yTop = (v: number) => topH - ((v - minV) / (maxV - minV || 1)) * topH;

  // blockwise-causal mask (8 blocks for illustration)
  const NB = 8;
  const mask = useMemo(
    () => Array.from({ length: NB }, (_, r) => Array.from({ length: NB }, (_, c) => (c <= r ? 1 : 0))),
    [],
  );

  if (!ft || series.length === 0) {
    return (
      <div className="container-demo py-8">
        <span className="font-mono text-sm text-text-secondary animate-pulse">Loading force trace…</span>
      </div>
    );
  }

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">10</span>
        <h1 className="section-title">Octo's Tokenizer — the Piano Roll</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4 max-w-3xl">
        Octo turns continuous low-dim signals into <em>discrete tokens</em> via a
        256-bin quantizer (<span className="font-mono text-2xs">bin_type="normal", low=-2, high=2</span>).
        A continuous force trace becomes a piano roll. Re-bin live to feel why 16 is
        too coarse and 1024 is wasteful.
      </p>
      <div className="flex gap-2 mb-6 flex-wrap">
        <PaperRef arxiv="2405.12213">Ghosh et al. 2024 (Octo)</PaperRef>
        <span className="font-mono text-2xs text-text-disabled self-center">
          real Fz trace · episode 19 · LowdimObsTokenizer
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
        <div className="card-sunken overflow-x-auto">
          {/* continuous trace */}
          <div className="font-mono text-2xs text-text-tertiary mb-1">continuous {axis.toUpperCase()}(t)</div>
          <svg width={W} height={topH} className="block">
            <polyline
              points={series.map((v, i) => `${i * colW + colW / 2},${yTop(v)}`).join(' ')}
              fill="none"
              stroke={MODALITY_HEX.force}
              strokeWidth={1.5}
            />
          </svg>

          {/* piano roll */}
          <div className="font-mono text-2xs text-text-tertiary mt-3 mb-1">
            quantized → {nBins} bins ({binType})
          </div>
          <svg width={W} height={rollH} className="block">
            {/* bin gridlines when sparse enough */}
            {nBins <= 64 &&
              Array.from({ length: nBins + 1 }, (_, b) => (
                <line
                  key={b}
                  x1={0}
                  y1={(b / nBins) * rollH}
                  x2={W}
                  y2={(b / nBins) * rollH}
                  stroke="var(--grid-line)"
                  strokeWidth={0.5}
                />
              ))}
            {/* density gradient suggestion when many bins */}
            {nBins > 64 && (
              <rect x={0} y={0} width={W} height={rollH} fill="url(#binGrad)" opacity={0.15} />
            )}
            <defs>
              <linearGradient id="binGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MODALITY_HEX.force} stopOpacity="0.05" />
                <stop offset="50%" stopColor={MODALITY_HEX.force} stopOpacity="0.4" />
                <stop offset="100%" stopColor={MODALITY_HEX.force} stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {/* chosen token per timestep */}
            {tokens.map((bin, i) => {
              const y = rollH - ((bin + 0.5) / nBins) * rollH;
              return (
                <rect
                  key={i}
                  x={i * colW}
                  y={y - Math.max(2, rollH / nBins / 2)}
                  width={Math.max(1.5, colW - 0.5)}
                  height={Math.max(2.5, rollH / nBins)}
                  fill={MODALITY_HEX.force}
                  rx={0.5}
                />
              );
            })}
          </svg>
          <div className="flex justify-between font-mono text-2xs text-text-disabled mt-1">
            <span>bin 0</span>
            <span>token id = which bin · one per timestep</span>
            <span>bin {nBins - 1}</span>
          </div>
        </div>

        {/* controls */}
        <div className="space-y-4">
          <div className="card">
            <div className="font-mono text-2xs text-text-tertiary mb-2">AXIS</div>
            <div className="grid grid-cols-3 gap-1">
              {AXES.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAxis(a.key)}
                  className={`font-mono text-2xs px-1.5 py-1 rounded transition-colors ${
                    axis === a.key ? 'bg-accent/20 text-accent' : 'text-text-disabled hover:text-text-secondary'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <div className="flex justify-between font-mono text-2xs mb-1">
                <span className="text-text-secondary">n_bins</span>
                <span className="text-text-primary">{nBins}</span>
              </div>
              <input type="range" min={4} max={512} step={4} value={nBins} onChange={(e) => setNBins(+e.target.value)} className="w-full accent-accent" />
              <div className="flex gap-1 mt-1">
                {[16, 64, 256, 512].map((n) => (
                  <button key={n} onClick={() => setNBins(n)} className="font-mono text-2xs px-1.5 py-0.5 rounded text-text-disabled hover:text-accent">
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between font-mono text-2xs mb-1">
                <span className="text-text-secondary">low</span>
                <span className="text-text-primary">{low.toFixed(1)}</span>
              </div>
              <input type="range" min={-4} max={-0.5} step={0.5} value={low} onChange={(e) => setLow(+e.target.value)} className="w-full accent-accent" />
            </div>
            <div>
              <div className="flex justify-between font-mono text-2xs mb-1">
                <span className="text-text-secondary">high</span>
                <span className="text-text-primary">{high.toFixed(1)}</span>
              </div>
              <input type="range" min={0.5} max={4} step={0.5} value={high} onChange={(e) => setHigh(+e.target.value)} className="w-full accent-accent" />
            </div>
            <div>
              <div className="font-mono text-2xs text-text-secondary mb-1">bin_type</div>
              <div className="flex gap-1">
                {(['normal', 'uniform'] as const).map((bt) => (
                  <button
                    key={bt}
                    onClick={() => setBinType(bt)}
                    className={`font-mono text-2xs px-2 py-0.5 rounded transition-colors ${
                      binType === bt ? 'bg-accent/20 text-accent' : 'text-text-disabled hover:text-text-secondary'
                    }`}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => { setNBins(256); setLow(-2); setHigh(2); setBinType('normal'); }}
              className="font-mono text-2xs text-accent hover:underline"
            >
              reset to Octo defaults
            </button>
          </div>
        </div>
      </div>

      {/* Blockwise-causal mask */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
        <div className="card-sunken">
          <div className="font-mono text-2xs text-text-tertiary mb-2">BLOCKWISE-CAUSAL MASK</div>
          <AttentionHeatmap
            matrix={mask}
            scheme="pubugn"
            cellSize={22}
            gap={2}
            rowLabels={Array.from({ length: NB }, (_, i) => `t${i}`)}
            colLabels={Array.from({ length: NB }, (_, i) => `t${i}`)}
            gridLines
          />
          <div className="mt-2">
            <ColorRamp scheme="pubugn" label="attends" min="no" max="yes" />
          </div>
        </div>
        <div className="card-sunken flex flex-col justify-center">
          <p className="text-text-secondary text-sm leading-relaxed mb-2">
            Octo's transformer is <em>blockwise-causal</em>: each timestep block attends
            to itself and all past blocks, never the future. The token grid above feeds
            this attention as a sequence of discrete observation tokens — the same
            piano-roll bins, now queryable by the policy.
          </p>
          <p className="font-mono text-2xs text-text-disabled">
            Discrete vs. continuous matters at the fusion stage: tokens let one
            transformer treat force, proprio, and vision uniformly.
          </p>
        </div>
      </div>
    </div>
  );
}
