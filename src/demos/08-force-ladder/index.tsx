import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegistrationMark } from '../../components/RegistrationMark';
import { PaperRef } from '../../components/PaperRef';
import { EquationCallout } from '../../components/EquationCallout';
import { Link } from 'react-router-dom';
import { MODALITY_HEX } from '../../lib/viz/colors';

type Variant = 'dp-b' | 'dp-lf' | 'dp-pf' | 'dp-ca';

interface VariantInfo {
  id: Variant;
  name: string;
  subtitle: string;
  metaphor: string;
  success: number;
  blurb: string;
}

const VARIANTS: VariantInfo[] = [
  {
    id: 'dp-b',
    name: 'DP-B',
    subtitle: 'vision-only baseline',
    metaphor: 'the blind diffuser',
    success: 0.39,
    blurb:
      'No force branch at all. The policy can see, but it cannot feel. Force-dependent edges are ghosted — kept visible so the comparison stays legible.',
  },
  {
    id: 'dp-lf',
    name: 'DP-LF',
    subtitle: 'low-dim flat concat',
    metaphor: 'the drowning vector',
    success: 0.48,
    blurb:
      'The 4-element (|F|, F̂) vector is concatenated into a flattened ResNet-18 feature vector of ~25,000 elements. Higher-dimensional image features overshadow the tiny force signal.',
  },
  {
    id: 'dp-pf',
    name: 'DP-PF',
    subtitle: 'projected fusion',
    metaphor: 'the dressed-up vector',
    success: 0.57,
    blurb:
      'Force is linearly projected to F_proj ∈ ℝ^{4×512} — four full-height tokens. The columns are tall, but no one reads them: fusion is still passive concatenation. Barely better than LF despite 100× more force parameters.',
  },
  {
    id: 'dp-ca',
    name: 'DP-CA',
    subtitle: 'cross-attention',
    metaphor: 'four probes querying the image',
    success: 0.96,
    blurb:
      'The four force tokens become queries; the image patches are keys and values. Force learns where to look as a function of contact. +57 points over vision-only.',
  },
];

const N_IMAGE = 49 * 512; // ResNet-18 spatial features, Kang pipeline
const N_FORCE = 4;

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toFixed(2)}</>;
}

/** The morphing observation-encoder visualization */
function EncoderViz({ variant }: { variant: Variant }) {
  return (
    <div className="relative h-[260px] flex items-center justify-center">
      <AnimatePresence mode="wait">
        {variant === 'dp-b' && (
          <motion.div
            key="dp-b"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-8"
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-20 h-20 rounded grid grid-cols-7 gap-px p-1"
                style={{ backgroundColor: 'var(--bg-sunken)' }}
              >
                {Array.from({ length: 49 }, (_, i) => (
                  <div key={i} className="rounded-sm" style={{ backgroundColor: MODALITY_HEX.rgb, opacity: 0.3 + (i % 7) * 0.08 }} />
                ))}
              </div>
              <span className="font-mono text-2xs" style={{ color: MODALITY_HEX.rgb }}>image · 49×512</span>
            </div>
            {/* ghosted force */}
            <div className="flex flex-col items-center gap-2 opacity-[0.15]">
              <div className="w-20 h-20 rounded border-2 border-dashed flex items-center justify-center" style={{ borderColor: MODALITY_HEX.force }}>
                <span className="font-mono text-2xs" style={{ color: MODALITY_HEX.force }}>force</span>
              </div>
              <span className="font-mono text-2xs text-text-disabled">absent</span>
            </div>
          </motion.div>
        )}

        {variant === 'dp-lf' && (
          <motion.div
            key="dp-lf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 w-full"
          >
            <span className="font-mono text-2xs text-text-tertiary">flattened feature vector</span>
            <div className="flex items-center w-full max-w-xl">
              <div className="flex-1 h-10 rounded-l flex items-center px-2 overflow-hidden" style={{ backgroundColor: MODALITY_HEX.rgb, opacity: 0.85 }}>
                <span className="font-mono text-2xs text-black/70">image features — {N_IMAGE.toLocaleString()} elements</span>
              </div>
              <div className="flex">
                {Array.from({ length: 4 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-10"
                    style={{ backgroundColor: MODALITY_HEX.force }}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </div>
            </div>
            <div className="card-sunken px-3 py-2 mt-2">
              <span className="font-mono text-2xs text-text-secondary">
                gradient to force ≈ <span style={{ color: MODALITY_HEX.force }}>{N_FORCE} / {N_IMAGE.toLocaleString()}</span> = {(N_FORCE / N_IMAGE * 100).toFixed(3)}% of total norm
              </span>
            </div>
          </motion.div>
        )}

        {variant === 'dp-pf' && (
          <motion.div
            key="dp-pf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-end gap-4"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-px items-end">
                {Array.from({ length: 16 }, (_, i) => (
                  <div key={i} className="w-2" style={{ height: 120, backgroundColor: MODALITY_HEX.rgb, opacity: 0.6 + (i % 4) * 0.1 }} />
                ))}
              </div>
              <span className="font-mono text-2xs" style={{ color: MODALITY_HEX.rgb }}>image · N tokens × 512</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1 items-end">
                {Array.from({ length: 4 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="w-3"
                    style={{ backgroundColor: MODALITY_HEX.force }}
                    initial={{ height: 12 }}
                    animate={{ height: 120 }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                  />
                ))}
              </div>
              <span className="font-mono text-2xs" style={{ color: MODALITY_HEX.force }}>F_proj · 4 × 512</span>
            </div>
          </motion.div>
        )}

        {variant === 'dp-ca' && (
          <motion.div
            key="dp-ca"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-10"
          >
            <div className="relative">
              <div className="w-28 h-28 rounded grid grid-cols-7 gap-px p-1" style={{ backgroundColor: 'var(--bg-sunken)' }}>
                {Array.from({ length: 49 }, (_, i) => {
                  const hot = [16, 17, 23, 24, 25, 31].includes(i);
                  return <div key={i} className="rounded-sm" style={{ backgroundColor: hot ? MODALITY_HEX.force : MODALITY_HEX.rgb, opacity: hot ? 0.9 : 0.25 }} />;
                })}
              </div>
              <span className="font-mono text-2xs text-text-tertiary absolute -bottom-5 left-0">keys/values</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {['|F|', 'F̂x', 'F̂y', 'F̂z'].map((lbl, i) => (
                <motion.div
                  key={lbl}
                  className="px-2 py-1 rounded font-mono text-2xs"
                  style={{ backgroundColor: `${MODALITY_HEX.force}22`, color: MODALITY_HEX.force, border: `1px solid ${MODALITY_HEX.force}55` }}
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12 }}
                >
                  {lbl} → query
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ForceLadder() {
  const [variant, setVariant] = useState<Variant>('dp-b');
  const info = VARIANTS.find((v) => v.id === variant)!;

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">08</span>
        <h1 className="section-title">The Force Integration Ladder</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4 max-w-3xl">
        Kang et al. hold the U-Net denoiser fixed and change only the front-end —
        how force enters the policy. Four variants, four metaphors, a 57-point swing
        in success rate. The denoiser staying still <em>is</em> the point.
      </p>
      <div className="flex gap-2 mb-6">
        <PaperRef arxiv="2503.03998">Kang et al. 2025 (RA-L)</PaperRef>
        <PaperRef arxiv="2303.04137">Chi et al. 2023 (Diffusion Policy)</PaperRef>
      </div>

      {/* Variant tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVariant(v.id)}
            className={`px-3 py-2 rounded border font-mono text-xs transition-colors text-left ${
              variant === v.id
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong'
            }`}
          >
            <div className="font-semibold">{v.name}</div>
            <div className="text-2xs text-text-disabled">{v.subtitle}</div>
          </button>
        ))}
      </div>

      {/* Pipeline: encoder morphs, denoiser fixed */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 items-center">
        <div className="card-sunken">
          <div className="font-mono text-2xs text-text-tertiary mb-2">
            OBSERVATION ENCODER · <span className="text-accent">{info.metaphor}</span>
          </div>
          <EncoderViz variant={variant} />
        </div>

        <div className="flex items-center justify-center">
          <span className="font-mono text-text-disabled text-2xl">→</span>
        </div>

        {/* Fixed denoiser (shared layoutId) */}
        <motion.div layoutId="denoiser" className="card flex flex-col items-center justify-center min-w-[160px] h-[200px]">
          <div className="font-mono text-2xs text-text-tertiary mb-2">DENOISER</div>
          <div className="w-24 h-24 rounded border-2 flex items-center justify-center" style={{ borderColor: MODALITY_HEX.action }}>
            <span className="font-mono text-2xs text-center" style={{ color: MODALITY_HEX.action }}>
              Conditional
              <br />
              U-Net 1D
            </span>
          </div>
          <span className="font-mono text-2xs text-text-disabled mt-2">unchanged</span>
        </motion.div>
      </div>

      {/* Success rate + blurb */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <div className="card text-center flex flex-col justify-center">
          <div className="font-mono text-2xs text-text-tertiary mb-1">SUCCESS RATE</div>
          <div
            className="font-mono text-4xl font-bold"
            style={{ color: info.success > 0.8 ? '#4ade80' : info.success > 0.55 ? '#fbbf24' : '#f87171' }}
          >
            <CountUp value={info.success} />
          </div>
          <div className="font-mono text-2xs text-text-disabled mt-1">Kang et al. reported</div>
        </div>
        <div className="card-sunken flex items-center">
          <p className="text-text-secondary text-sm leading-relaxed">{info.blurb}</p>
        </div>
      </div>

      {/* Ladder summary bar */}
      <div className="mt-6 card-sunken">
        <div className="font-mono text-2xs text-text-tertiary mb-3">THE LADDER</div>
        <div className="flex items-end gap-3 h-32">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariant(v.id)}
              className="flex-1 flex flex-col items-center justify-end gap-1 group"
            >
              <span className="font-mono text-2xs text-text-secondary">{v.success.toFixed(2)}</span>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${v.success * 100}%`,
                  backgroundColor: variant === v.id ? 'var(--accent)' : v.success > 0.8 ? '#4ade80' : MODALITY_HEX.force,
                  opacity: variant === v.id ? 1 : 0.5,
                }}
              />
              <span className="font-mono text-2xs text-text-disabled group-hover:text-text-secondary">{v.name}</span>
            </button>
          ))}
        </div>
      </div>

      {info.id === 'dp-ca' && (
        <div className="mt-4 card border-modality-force/30 flex items-center justify-between flex-wrap gap-3">
          <div>
            <EquationCallout tex="A = \text{softmax}(Q K^\top / \sqrt{d})\, V,\quad Q = \text{force},\ K\!/\!V = \text{image}" display />
          </div>
          <Link
            to="/cross-attention"
            className="font-mono text-2xs px-3 py-2 rounded border border-accent text-accent hover:bg-accent/10 transition-colors no-underline"
          >
            See the probes live →
          </Link>
        </div>
      )}
    </div>
  );
}
