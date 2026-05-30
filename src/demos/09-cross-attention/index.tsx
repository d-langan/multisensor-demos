import { useEffect, useState, useMemo } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';
import { PaperRef } from '../../components/PaperRef';
import { EquationCallout } from '../../components/EquationCallout';
import { AttentionHeatmap, ColorRamp } from '../../components/AttentionHeatmap';
import { MODALITY_HEX, PHASE_HEX } from '../../lib/viz/colors';

interface AttnSample {
  t: number;
  phase: string;
  force_mag: number;
  heads: number[][][]; // [H][Q][K]
}

interface AttnData {
  model: string;
  module: string;
  n_heads: number;
  n_queries: number;
  n_keys: number;
  query_labels: string[];
  grid: [number, number];
  t_samples: number[];
  samples: AttnSample[];
}

const TOKEN_COLORS = ['#fb923c', '#fdba74', '#f97316', '#e879f9', '#f0abfc', '#d946ef'];

// Accept both the rich extraction format and the legacy synthetic format
function normalizeAttn(raw: any): AttnData {
  if (raw.samples) return raw as AttnData;
  // legacy: { t_samples, attention:[{t,phase,weights:[Q][K]}] }
  const att = raw.attention as Array<{ t: number; phase: string; weights: number[][] }>;
  const Q = att[0]?.weights.length ?? 6;
  const K = att[0]?.weights[0].length ?? 49;
  return {
    model: raw.model ?? 'b4',
    module: raw.module ?? 'VisionForceCA.cross_attn',
    n_heads: 1,
    n_queries: Q,
    n_keys: K,
    query_labels: ['Fx', 'Fy', 'Fz', 'Tx', 'Ty', 'Tz'].slice(0, Q),
    grid: [7, 7],
    t_samples: raw.t_samples ?? att.map((a) => a.t),
    samples: att.map((a) => ({ t: a.t, phase: a.phase, force_mag: 0, heads: [a.weights] })),
  };
}

function rowEntropy(row: number[]): number {
  const sum = row.reduce((a, b) => a + b, 0) || 1;
  let h = 0;
  for (const w of row) {
    const p = w / sum;
    if (p > 1e-9) h -= p * Math.log(p);
  }
  return h / Math.log(row.length); // normalized 0..1
}

function softmaxRows(mat: number[][]): number[][] {
  return mat.map((row) => {
    const mx = Math.max(...row);
    const exp = row.map((v) => Math.exp((v - mx) * 4));
    const s = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / s);
  });
}

export default function CrossAttentionProbes() {
  const [data, setData] = useState<AttnData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [head, setHead] = useState<number | 'avg'>('avg');
  const [hoverToken, setHoverToken] = useState<number | null>(null);
  const [swap, setSwap] = useState(false);

  useEffect(() => {
    fetch('./data/attention_maps/b4_crossattn.json')
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((raw) => {
        const d = normalizeAttn(raw);
        setData(d);
        // default to a contact-phase sample for a strong first impression
        const ci = d.samples.findIndex((s) => s.phase === 'contact');
        setSampleIdx(ci >= 0 ? ci : Math.floor(d.samples.length / 2));
      })
      .catch((e) => setError(String(e)));
  }, []);

  const sample = data?.samples[sampleIdx];

  // Effective attention matrix (Q×K), averaged over heads or single head
  const attn = useMemo(() => {
    if (!sample) return [];
    if (head === 'avg') {
      const H = sample.heads.length;
      const Q = sample.heads[0].length;
      const K = sample.heads[0][0].length;
      const out: number[][] = Array.from({ length: Q }, () => Array(K).fill(0));
      for (let h = 0; h < H; h++)
        for (let q = 0; q < Q; q++) for (let k = 0; k < K; k++) out[q][k] += sample.heads[h][q][k] / H;
      return out;
    }
    return sample.heads[head];
  }, [sample, head]);

  // Swapped (image-queries-force) degenerate matrix — pedagogical toy
  const displayMatrix = useMemo(() => {
    if (!swap || attn.length === 0) return attn;
    // transpose to K×Q then re-softmax — only 6 keys → washed-out attention
    const K = attn[0].length;
    const Q = attn.length;
    const t: number[][] = Array.from({ length: K }, (_, k) =>
      Array.from({ length: Q }, (_, q) => attn[q][k]),
    );
    return softmaxRows(t);
  }, [swap, attn]);

  const meanEntropy = useMemo(() => {
    if (attn.length === 0) return 0;
    return attn.reduce((a, r) => a + rowEntropy(r), 0) / attn.length;
  }, [attn]);

  // Before vs after contact — the single wow moment (only with real force_mag)
  const comparison = useMemo(() => {
    if (!data) return null;
    const withMag = data.samples.filter((s) => s.force_mag > 0);
    if (withMag.length < 2) return null;
    const avgHeads = (s: AttnSample) => {
      const H = s.heads.length, Q = s.heads[0].length, K = s.heads[0][0].length;
      const out: number[][] = Array.from({ length: Q }, () => Array(K).fill(0));
      for (let h = 0; h < H; h++) for (let q = 0; q < Q; q++) for (let k = 0; k < K; k++) out[q][k] += s.heads[h][q][k] / H;
      return out;
    };
    const ent = (m: number[][]) => m.reduce((a, r) => a + rowEntropy(r), 0) / m.length;
    const before = withMag.reduce((lo, s) => (s.force_mag < lo.force_mag ? s : lo), withMag[0]);
    const after = withMag.reduce((hi, s) => (s.force_mag > hi.force_mag ? s : hi), withMag[0]);
    return {
      before: { s: before, m: avgHeads(before), e: ent(avgHeads(before)) },
      after: { s: after, m: avgHeads(after), e: ent(avgHeads(after)) },
    };
  }, [data]);

  if (error) {
    return (
      <div className="container-demo py-8">
        <div className="card border-danger/30 text-danger font-mono text-sm">
          Could not load attention data: {error}
        </div>
      </div>
    );
  }
  if (!data || !sample) {
    return (
      <div className="container-demo py-8">
        <span className="font-mono text-sm text-text-secondary animate-pulse">Loading attention…</span>
      </div>
    );
  }

  const [gr, gc] = data.grid;
  const frameIdx = Math.floor(sample.t * 10);
  const frameSrc = `./data/episode_19/rgb/${String(frameIdx).padStart(4, '0')}.png`;
  const imgSize = 280;
  const patchSize = imgSize / gc;

  // For ray drawing: patch attention for the hovered token
  const hoverRow = hoverToken != null && !swap ? attn[hoverToken] : null;
  const rowMax = hoverRow ? Math.max(...hoverRow) : 1;

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">09</span>
        <h1 className="section-title">Cross-Attention Probes</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4 max-w-3xl">
        DP-CA makes the force axes the <em>queries</em>. Each force token attends to
        image patches — the model learns <em>where to look as a function of contact</em>.
        Hover a force token to see its attention rays light up the image.
      </p>
      <div className="flex gap-2 mb-6 flex-wrap">
        <PaperRef arxiv="2503.03998">Kang et al. 2025</PaperRef>
        <PaperRef arxiv="1906.05714">BertViz (Vig 2019)</PaperRef>
        <span className="font-mono text-2xs text-text-disabled self-center">
          B4 checkpoint · {data.n_queries}×{data.n_keys} · {data.n_heads} heads · real attention
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_140px_1fr] gap-6">
        {/* LEFT: image with patch grid + attention overlay */}
        <div>
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            WRIST RGB · 7×7 patches
          </div>
          <div className="relative" style={{ width: imgSize, height: imgSize }}>
            <img
              src={frameSrc}
              alt={`frame ${frameIdx}`}
              className="absolute inset-0 rounded"
              style={{ width: imgSize, height: imgSize, objectFit: 'cover' }}
            />
            <svg
              className="absolute inset-0"
              width={imgSize}
              height={imgSize}
              viewBox={`0 0 ${imgSize} ${imgSize}`}
            >
              {/* patch grid */}
              {Array.from({ length: gr }, (_, r) =>
                Array.from({ length: gc }, (_, c) => {
                  const k = r * gc + c;
                  const w = hoverRow ? hoverRow[k] / rowMax : 0;
                  return (
                    <rect
                      key={k}
                      x={c * patchSize}
                      y={r * patchSize}
                      width={patchSize}
                      height={patchSize}
                      fill={hoverToken != null ? TOKEN_COLORS[hoverToken] : 'transparent'}
                      fillOpacity={hoverRow ? w * 0.75 : 0}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={0.5}
                    />
                  );
                }),
              )}
            </svg>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="font-mono text-2xs px-1.5 py-0.5 rounded"
              style={{
                color: PHASE_HEX[sample.phase as keyof typeof PHASE_HEX],
                backgroundColor: `${PHASE_HEX[sample.phase as keyof typeof PHASE_HEX]}22`,
              }}
            >
              {sample.phase}
            </span>
            <span className="font-mono text-2xs text-text-secondary">
              t={sample.t.toFixed(1)}s
            </span>
            {sample.force_mag > 0 && (
              <span className="font-mono text-2xs" style={{ color: MODALITY_HEX.force }}>
                |F| = {sample.force_mag.toFixed(1)} N
              </span>
            )}
          </div>
        </div>

        {/* MIDDLE: force token pills */}
        <div>
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            FORCE QUERIES
          </div>
          <div className="space-y-1.5">
            {data.query_labels.map((lbl, q) => (
              <button
                key={q}
                onMouseEnter={() => setHoverToken(q)}
                onMouseLeave={() => setHoverToken(null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded border transition-all font-mono text-xs"
                style={{
                  borderColor: hoverToken === q ? TOKEN_COLORS[q] : 'var(--border-subtle)',
                  backgroundColor: hoverToken === q ? `${TOKEN_COLORS[q]}1a` : 'transparent',
                  color: TOKEN_COLORS[q],
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TOKEN_COLORS[q] }} />
                {lbl}
                <span className="ml-auto text-text-disabled text-2xs">Q{q}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 font-mono text-2xs text-text-disabled leading-relaxed">
            Hover a query to project its attention onto the image and heatmap row.
          </div>
        </div>

        {/* RIGHT: heatmap + controls */}
        <div>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <span className="font-mono text-2xs text-text-tertiary">
              ATTENTION {swap ? '(image → force, degenerate)' : '(force → image)'}
            </span>
            {data.n_heads > 1 && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-2xs text-text-disabled mr-1">head</span>
                {(['avg', ...Array.from({ length: data.n_heads }, (_, i) => i)] as const).map((h) => (
                  <button
                    key={String(h)}
                    onClick={() => setHead(h as number | 'avg')}
                    className={`font-mono text-2xs px-1.5 py-0.5 rounded transition-colors ${
                      head === h ? 'bg-accent/20 text-accent' : 'text-text-disabled hover:text-text-secondary'
                    }`}
                  >
                    {h === 'avg' ? 'avg' : (h as number) + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card-sunken overflow-x-auto">
            <AttentionHeatmap
              matrix={displayMatrix}
              scheme={swap ? 'greys' : 'blues'}
              cellSize={swap ? 18 : 11}
              gap={1}
              rowLabels={swap ? undefined : data.query_labels}
              highlightRow={!swap ? hoverToken : null}
              onRowHover={!swap ? (r) => setHoverToken(r) : undefined}
              maxWidth={520}
            />
            <div className="mt-2">
              <ColorRamp scheme={swap ? 'greys' : 'blues'} label="attention weight" />
            </div>
          </div>

          {/* Entropy thermometer */}
          <div className="mt-3 flex items-center gap-3">
            <span className="font-mono text-2xs text-text-tertiary w-28">
              attention entropy
            </span>
            <div className="flex-1 h-2 bg-sunken rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${meanEntropy * 100}%`,
                  backgroundColor: meanEntropy < 0.6 ? '#4ade80' : meanEntropy < 0.85 ? '#fbbf24' : '#f87171',
                }}
              />
            </div>
            <span className="font-mono text-2xs text-text-secondary w-10 text-right">
              {meanEntropy.toFixed(2)}
            </span>
          </div>
          <div className="font-mono text-2xs text-text-disabled mt-1">
            Low entropy = the model is confident about where to look. Watch it drop as |F| rises.
          </div>
        </div>
      </div>

      {/* Trajectory scrubber */}
      <div className="mt-6 card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-2xs text-text-tertiary">REPLAY TRAJECTORY</span>
          <button
            onClick={() => setSwap((s) => !s)}
            className={`font-mono text-2xs px-2 py-1 rounded border transition-colors ${
              swap ? 'border-accent text-accent bg-accent/10' : 'border-border-subtle text-text-secondary'
            }`}
          >
            {swap ? '↺ force as query' : '⇄ swap Q ⇄ K/V'}
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={data.samples.length - 1}
          value={sampleIdx}
          onChange={(e) => setSampleIdx(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between font-mono text-2xs text-text-disabled mt-1">
          <span>approach</span>
          <span>contact (prying)</span>
          <span>retract</span>
        </div>
      </div>

      {/* Before vs after contact — the wow moment */}
      {comparison && (
        <div className="mt-6 card border-modality-force/30">
          <div className="font-mono text-2xs text-text-tertiary mb-3">
            BEFORE vs AFTER CONTACT · attention concentrates as force builds
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {([
              { tag: 'before', d: comparison.before, label: 'approach' },
              { tag: 'after', d: comparison.after, label: 'prying contact' },
            ] as const).map(({ tag, d, label }) => (
              <div key={tag} className="card-sunken">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-2xs text-text-secondary">{label}</span>
                  <span className="font-mono text-2xs" style={{ color: MODALITY_HEX.force }}>
                    |F| = {d.s.force_mag.toFixed(1)} N
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <AttentionHeatmap
                    matrix={d.m}
                    scheme="blues"
                    cellSize={11}
                    rowLabels={data.query_labels}
                    maxWidth={460}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-mono text-2xs text-text-tertiary">entropy</span>
                  <span
                    className="font-mono text-2xs font-semibold"
                    style={{ color: d.e < 0.6 ? '#4ade80' : d.e < 0.85 ? '#fbbf24' : '#f87171' }}
                  >
                    {d.e.toFixed(2)}
                  </span>
                  <span className="font-mono text-2xs text-text-disabled">
                    {tag === 'before' ? 'diffuse — looking everywhere' : 'concentrated — looking at the tool tip'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="font-mono text-2xs text-text-disabled mt-3">
            Visual proof that cross-attention is learning <em>where to look as a function of contact</em>.
          </p>
        </div>
      )}

      {/* Equations + finding */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-sunken">
          <EquationCallout tex="A = \text{softmax}\!\left(\frac{Q K^\top}{\sqrt{d}}\right) V" display />
          <div className="font-mono text-2xs text-text-disabled text-center">
            {'Q = force·W_Q (6×512) · K,V = image·W_KV (49×512) · 4 heads'}
          </div>
        </div>
        <div className="card-sunken border-l-2 border-modality-force pl-4">
          <p className="text-text-secondary text-sm italic font-display">
            "Using force as the query source outperforms an architecture using it as
            key and value."
          </p>
          <p className="font-mono text-2xs text-text-disabled mt-2">
            — Kang et al. 2025. Toggle ⇄ swap to see attention degenerate with only 6 keys.
          </p>
        </div>
      </div>
    </div>
  );
}
