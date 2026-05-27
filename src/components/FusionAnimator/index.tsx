import { motion, AnimatePresence } from 'framer-motion';
import { MODALITY_HEX } from '../../lib/viz/colors';
import type { FusionStrategy } from '../../lib/data/types';

interface FusionAnimatorProps {
  strategy: FusionStrategy;
  playing?: boolean;
  step?: number;
}

interface StrategyInfo {
  title: string;
  steps: { label: string; description: string }[];
  shapeIn: string;
  shapeOut: string;
  models: string;
}

const STRATEGY_INFO: Record<FusionStrategy, StrategyInfo> = {
  concat: {
    title: 'Concatenation',
    steps: [
      { label: 'Encode modalities', description: 'Each modality encoded independently to fixed-dim vectors' },
      { label: 'Stack tokens', description: 'Tokens concatenated along feature dimension' },
      { label: 'Output', description: 'Single vector passed to conditioning layer' },
    ],
    shapeIn: '(N_v, D) + (N_f, D)',
    shapeOut: '(N_v + N_f, D)',
    models: 'B1, B2',
  },
  projected_concat: {
    title: 'Projected Concatenation',
    steps: [
      { label: 'Encode vision', description: 'ResNet-18 + SpatialSoftmax → 64D' },
      { label: 'Project force', description: 'MLP projects F/T from 6D → 64D (same dim as vision)' },
      { label: 'Concatenate', description: 'Projected vectors stacked: [vision_64D, force_64D, tcp_9D]' },
    ],
    shapeIn: '(6,) → (64,)',
    shapeOut: '(137,)',
    models: 'B3',
  },
  film: {
    title: 'FiLM Conditioning',
    steps: [
      { label: 'Compute global cond', description: 'Concatenated observation vector becomes conditioning' },
      { label: 'Predict γ, β', description: 'MLP predicts per-channel scale (γ) and shift (β)' },
      { label: 'Modulate features', description: 'h = γ · h + β applied at each UNet layer' },
    ],
    shapeIn: 'cond → (γ, β)',
    shapeOut: 'modulated features',
    models: 'B1–B5 (backbone conditioning)',
  },
  cross_attention: {
    title: 'Cross-Attention',
    steps: [
      { label: 'Project Q, K, V', description: 'Force tokens → Q (6×512). Image tokens → K, V (49×512)' },
      { label: 'Softmax attention', description: 'Attention = softmax(Q·Kᵀ / √d). Each force axis "queries" the image.' },
      { label: 'Weighted sum', description: 'Output = Attention · V. Force-informed visual features.' },
      { label: 'Pool + output', description: 'AdaptiveAvgPool → 512D joint embedding' },
    ],
    shapeIn: 'Q:(6,512) K,V:(49,512)',
    shapeOut: '(512,)',
    models: 'B4, B5, DECO adapter, FoAR F/T queries',
  },
  mmdit_joint: {
    title: 'MMDiT Joint Self-Attention',
    steps: [
      { label: 'Tokenize both modalities', description: 'Obs and action tokens projected to shared dim' },
      { label: 'Joint QKV', description: 'Modality-specific Q, K, V projections, then joint attention' },
      { label: 'Bidirectional update', description: 'SAME attention matrix updates BOTH modalities. Vision ↔ action.' },
      { label: 'Modality-specific FFN', description: 'Separate feedforward networks preserve modality structure' },
    ],
    shapeIn: '(N_obs + N_act, D)',
    shapeOut: '(N_obs, D), (N_act, D)',
    models: 'M2 (DECO), M5 (Custom MMDiT)',
  },
  contact_gated: {
    title: 'Contact Gating',
    steps: [
      { label: 'Compute |F|', description: 'L2 norm of (Fx, Fy, Fz) from raw F/T' },
      { label: 'Gate decision (φ)', description: 'φ=1 if |F|>threshold (contact), φ=0 otherwise' },
      { label: 'Gate the pathway', description: 'ft_gated = φ·ft_embed + (1−φ)·ft_null' },
      { label: 'Concat', description: 'Gated F/T joins vision + proprio for conditioning' },
    ],
    shapeIn: 'φ ∈ [0,1], ft_embed ∈ ℝ⁶⁴',
    shapeOut: 'ft_gated ∈ ℝ⁶⁴',
    models: 'M1 (ACT+CFG), M3 (FoAR)',
  },
  adaLN_zero: {
    title: 'adaLN-Zero Conditioning',
    steps: [
      { label: 'Compute conditioning', description: 'Proprio + timestep → cond vector' },
      { label: 'Predict modulation', description: 'MLP(cond) → [γ₁, β₁, α₁, γ₂, β₂, α₂]' },
      { label: 'Modulate LayerNorm', description: 'h = (1+γ)·LN(x) + β at self-attn and FFN' },
      { label: 'Gate residual', description: 'Output scaled by α (zero-initialized at start of training)' },
    ],
    shapeIn: 'cond → 6×D params',
    shapeOut: 'modulated hidden states',
    models: 'M2 (DECO), M5 (Custom MMDiT)',
  },
  classifier_free_guidance: {
    title: 'Classifier-Free Guidance',
    steps: [
      { label: 'Conditional forward', description: 'Full model with F/T embedding → a_cond' },
      { label: 'Unconditional forward', description: 'Model with null F/T embedding → a_uncond' },
      { label: 'Compute guidance weight', description: 'w = 1 + φ·α·softplus(w_scale). φ from contact gate.' },
      { label: 'Blend outputs', description: 'a = a_uncond + w·(a_cond − a_uncond)' },
    ],
    shapeIn: 'a_cond, a_uncond, w',
    shapeOut: 'a_guided',
    models: 'M1 (ACT+CFG)',
  },
};

function TokenBar({
  color,
  count,
  label,
  dim,
}: {
  color: string;
  count: number;
  label: string;
  dim: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-2xs" style={{ color }}>
        {label}
      </span>
      <div className="flex gap-0.5">
        {Array.from({ length: Math.min(count, 12) }, (_, i) => (
          <motion.div
            key={i}
            className="rounded-sm"
            style={{
              width: Math.max(4, 48 / count),
              height: 32,
              backgroundColor: color,
              opacity: 0.4 + Math.random() * 0.5,
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 80, damping: 14 }}
          />
        ))}
        {count > 12 && (
          <span className="font-mono text-2xs text-text-disabled self-center ml-1">
            +{count - 12}
          </span>
        )}
      </div>
      <span className="font-mono text-2xs text-text-disabled">{dim}D</span>
    </div>
  );
}

function ConcatViz({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-6 justify-center py-4">
      <motion.div animate={{ opacity: step >= 0 ? 1 : 0.3 }}>
        <TokenBar color={MODALITY_HEX.rgb} count={1} label="vision" dim={64} />
      </motion.div>
      <motion.div
        className="font-mono text-lg text-text-tertiary"
        animate={{ opacity: step >= 1 ? 1 : 0.2 }}
      >
        +
      </motion.div>
      <motion.div animate={{ opacity: step >= 0 ? 1 : 0.3 }}>
        <TokenBar color={MODALITY_HEX.force} count={1} label="force" dim={6} />
      </motion.div>
      <motion.div
        className="font-mono text-lg text-text-tertiary"
        animate={{ opacity: step >= 1 ? 1 : 0.2 }}
      >
        →
      </motion.div>
      <motion.div animate={{ opacity: step >= 2 ? 1 : 0.3 }}>
        <TokenBar color="#a4a8b0" count={2} label="concat" dim={70} />
      </motion.div>
    </div>
  );
}

function CrossAttnViz({ step }: { step: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-start gap-8 justify-center">
        <motion.div animate={{ opacity: step >= 0 ? 1 : 0.3 }}>
          <TokenBar color={MODALITY_HEX.force} count={6} label="Q (force)" dim={512} />
        </motion.div>
        <motion.div animate={{ opacity: step >= 0 ? 1 : 0.3 }}>
          <TokenBar color={MODALITY_HEX.rgb} count={12} label="K, V (image)" dim={512} />
        </motion.div>
      </div>
      {step >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="font-mono text-2xs text-text-tertiary text-center mb-1">
            Attention: softmax(Q·Kᵀ / √d)
          </div>
          <div className="grid grid-cols-12 gap-px mx-auto" style={{ maxWidth: 200 }}>
            {Array.from({ length: 6 * 12 }, (_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-sm"
                style={{
                  backgroundColor: MODALITY_HEX.force,
                  opacity: 0.1 + Math.random() * 0.8,
                }}
              />
            ))}
          </div>
          <div className="font-mono text-2xs text-text-disabled text-center mt-1">
            6 queries × 49 keys (shown: 6×12)
          </div>
        </motion.div>
      )}
      {step >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="font-mono text-2xs text-text-tertiary text-center mb-1">
            ↓ Weighted sum → Pool
          </div>
          <TokenBar color="#a4a8b0" count={1} label="joint embed" dim={512} />
        </motion.div>
      )}
    </div>
  );
}

function ContactGatedViz({ step }: { step: number }) {
  const phi = step >= 1 ? 0.85 : 0;
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <motion.div
        className="text-center"
        animate={{ opacity: step >= 0 ? 1 : 0.3 }}
      >
        <div className="font-mono text-2xs text-text-tertiary mb-1">|F| magnitude</div>
        <div className="w-48 h-3 bg-sunken rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: MODALITY_HEX.force }}
            animate={{ width: `${phi * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>

      <motion.div
        className="text-center"
        animate={{ opacity: step >= 1 ? 1 : 0.3 }}
      >
        <div className="font-mono text-2xs text-text-tertiary mb-1">Gate φ</div>
        <motion.div
          className="text-2xl font-mono font-bold"
          animate={{
            color: phi > 0.5 ? '#4ade80' : '#f87171',
          }}
        >
          {phi.toFixed(2)}
        </motion.div>
      </motion.div>

      <div className="flex gap-6">
        <motion.div animate={{ opacity: step >= 2 ? phi : 0.2 }}>
          <TokenBar color={MODALITY_HEX.force} count={1} label="ft_embed" dim={64} />
        </motion.div>
        <motion.div animate={{ opacity: step >= 2 ? 1 - phi + 0.1 : 0.2 }}>
          <TokenBar color="#3a3d44" count={1} label="ft_null" dim={64} />
        </motion.div>
      </div>

      {step >= 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-mono text-2xs text-text-tertiary"
        >
          → concat with vision + proprio
        </motion.div>
      )}
    </div>
  );
}

function MMDiTViz({ step }: { step: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex gap-8">
        <motion.div animate={{ opacity: step >= 0 ? 1 : 0.3 }}>
          <TokenBar color={MODALITY_HEX.rgb} count={4} label="obs tokens" dim={256} />
        </motion.div>
        <motion.div animate={{ opacity: step >= 0 ? 1 : 0.3 }}>
          <TokenBar color={MODALITY_HEX.action} count={8} label="action tokens" dim={256} />
        </motion.div>
      </div>

      {step >= 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            Joint self-attention (obs + action)
          </div>
          <div
            className="w-32 h-32 border border-border-strong rounded mx-auto relative overflow-hidden"
          >
            {Array.from({ length: 144 }, (_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${(i % 12) * 8.33}%`,
                  top: `${Math.floor(i / 12) * 8.33}%`,
                  width: '8.33%',
                  height: '8.33%',
                  backgroundColor:
                    i < 48
                      ? MODALITY_HEX.rgb
                      : i < 96
                        ? MODALITY_HEX.action
                        : '#666',
                  opacity: 0.15 + Math.random() * 0.5,
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {step >= 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3 font-mono text-2xs"
        >
          <span style={{ color: MODALITY_HEX.rgb }}>obs updated ✓</span>
          <span style={{ color: MODALITY_HEX.action }}>action updated ✓</span>
        </motion.div>
      )}
    </div>
  );
}

function GenericViz({ info, step }: { info: StrategyInfo; step: number }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {info.steps.map((s, i) => (
        <motion.div
          key={i}
          animate={{ opacity: step >= i ? 1 : 0.2 }}
          className="card-sunken px-4 py-2 w-full max-w-md text-center"
        >
          <div className="font-mono text-xs text-text-primary">{s.label}</div>
          <div className="font-mono text-2xs text-text-tertiary">{s.description}</div>
        </motion.div>
      ))}
    </div>
  );
}

export function FusionAnimator({ strategy, step = 0 }: FusionAnimatorProps) {
  const info = STRATEGY_INFO[strategy];

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div
          key={strategy}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {strategy === 'concat' || strategy === 'projected_concat' ? (
            <ConcatViz step={step} />
          ) : strategy === 'cross_attention' ? (
            <CrossAttnViz step={step} />
          ) : strategy === 'contact_gated' ? (
            <ContactGatedViz step={step} />
          ) : strategy === 'mmdit_joint' ? (
            <MMDiTViz step={step} />
          ) : (
            <GenericViz info={info} step={step} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
