import type { EncoderName } from '../../lib/data/types';
import { MODALITY_HEX } from '../../lib/viz/colors';
import { ShapeBadge } from '../ShapeBadge';

interface TokenInspectorProps {
  signal: 'rgb' | 'force' | 'proprio';
  encoder: EncoderName;
  showShapes?: boolean;
}

interface EncoderInfo {
  name: string;
  inputShape: string[];
  outputShape: string[];
  layers: { label: string; detail?: string }[];
  description: string;
}

const ENCODER_INFO: Record<string, EncoderInfo> = {
  resnet18_spatialsoftmax: {
    name: 'ResNet-18 + SpatialSoftmax',
    inputShape: ['3', '224', '224'],
    outputShape: ['64'],
    layers: [
      { label: 'ResNet-18 (GroupNorm)', detail: '512 ch, 7×7 spatial' },
      { label: 'SpatialSoftmax (32 kp)', detail: '32 keypoints → 64D' },
      { label: 'Linear(64→64) + ReLU' },
    ],
    description:
      'Standard visual encoder for B1–B5 and M-series. 32 spatial keypoints give translation-equivariant features.',
  },
  resnet18_spatial: {
    name: 'ResNet-18 (Spatial, no pool)',
    inputShape: ['3', '224', '224'],
    outputShape: ['49', '512'],
    layers: [
      { label: 'ResNet-18 (GroupNorm)', detail: '512 ch, 7×7 spatial' },
      { label: 'Flatten to 49 tokens', detail: '7×7=49 spatial positions' },
    ],
    description:
      'Used in B4/B5: keeps spatial structure as 49 tokens for cross-attention K/V.',
  },
  octo_smallstem16: {
    name: 'Octo SmallStem16',
    inputShape: ['3', '256', '256'],
    outputShape: ['256', '768'],
    layers: [
      { label: 'SmallStem (16×16 patches)' },
      { label: 'Patch embed → 768D' },
      { label: '256 visual tokens' },
    ],
    description:
      'Octo\'s pretrained vision tower. Patch-based, no SpatialSoftmax.',
  },
  mlp_3layer_30step: {
    name: 'ForceTorqueEncoder (Shared MLP)',
    inputShape: ['30', '6'],
    outputShape: ['64'],
    layers: [
      { label: 'Flatten(30×6=180)', detail: '1-second F/T window' },
      { label: 'Linear(180→256) + LN + ReLU' },
      { label: 'Linear(256→128) + LN + ReLU' },
      { label: 'Linear(128→64)' },
    ],
    description:
      'Shared across M1–M3, M5. Encodes 1 second of force history into a 64D vector.',
  },
  linear_projection: {
    name: 'Linear Projection (B3)',
    inputShape: ['6'],
    outputShape: ['64'],
    layers: [
      { label: 'Linear(6→64) + ReLU' },
      { label: 'Linear(64→64)' },
    ],
    description:
      'Simple MLP: projects single-frame F/T into the same dimension as vision features.',
  },
  cross_channel_proj_512: {
    name: 'Cross-Channel Projection (B4)',
    inputShape: ['6'],
    outputShape: ['6', '512'],
    layers: [
      { label: 'Linear(6→6×512)', detail: 'Broadcast to 512D per axis' },
      { label: 'Reshape to (6, 512)', detail: '6 force query tokens' },
    ],
    description:
      'B4\'s force encoder: each F/T axis becomes a 512D query token for cross-attention.',
  },
  force_transformer: {
    name: 'Force Transformer (FoAR)',
    inputShape: ['30', '6'],
    outputShape: ['64'],
    layers: [
      { label: 'Per-step MLP: 6→128D', detail: '30 timesteps → (30, 128)' },
      { label: 'Transformer (2L, 4H)', detail: 'Self-attention over time' },
      { label: 'Pool → 64D' },
    ],
    description:
      'M3\'s temporal attention: 30-step F/T history processed by self-attention to capture force dynamics.',
  },
  lowdim_tokenizer_256bin: {
    name: 'LowdimObsTokenizer (Octo)',
    inputShape: ['6'],
    outputShape: ['6', '768'],
    layers: [
      { label: 'Per-dim quantize (256 bins)' },
      { label: 'Learned embedding per bin', detail: '256×768 lookup table' },
      { label: '6 tokens of 768D' },
    ],
    description:
      'Octo\'s approach: discretize each F/T axis into one of 256 bins, then embed. Discrete, not continuous.',
  },
  flat_concat: {
    name: 'Flat Concat (No Encoder)',
    inputShape: ['9'],
    outputShape: ['9'],
    layers: [{ label: 'Identity (passthrough)' }],
    description:
      'B1/B2: raw 9D TCP pose concatenated directly. No learnable transformation.',
  },
  mlp_proprio_64: {
    name: 'ProprioEncoder MLP',
    inputShape: ['9'],
    outputShape: ['64'],
    layers: [
      { label: 'Linear(9→128) + LN + ReLU' },
      { label: 'Linear(128→64) + LN' },
    ],
    description:
      'Shared M-series proprio encoder. Projects 9D TCP pose to 64D latent.',
  },
  lowdim_tokenizer_proprio: {
    name: 'LowdimObsTokenizer (Proprio, Octo)',
    inputShape: ['9'],
    outputShape: ['9', '768'],
    layers: [
      { label: 'Per-dim quantize (256 bins)' },
      { label: 'Learned embedding per bin' },
      { label: '9 tokens of 768D' },
    ],
    description:
      'Same quantization-based tokenizer as F/T but for 9D proprioception.',
  },
};

function LayerBlock({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="bg-raised border border-border-subtle rounded px-3 py-1.5">
      <div className="font-mono text-2xs text-text-primary">{label}</div>
      {detail && (
        <div className="font-mono text-2xs text-text-disabled mt-0.5">
          {detail}
        </div>
      )}
    </div>
  );
}

export function TokenInspector({
  signal,
  encoder,
  showShapes = true,
}: TokenInspectorProps) {
  const info = ENCODER_INFO[encoder];
  if (!info) {
    return (
      <div className="card-sunken text-text-disabled font-mono text-2xs">
        Unknown encoder: {encoder}
      </div>
    );
  }

  const signalColor =
    signal === 'rgb'
      ? MODALITY_HEX.rgb
      : signal === 'force'
        ? MODALITY_HEX.force
        : MODALITY_HEX.proprio;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: signalColor }}
        />
        <span className="font-mono text-xs font-semibold text-text-primary">
          {info.name}
        </span>
      </div>

      <div className="flex items-start gap-4">
        {/* Input */}
        <div className="flex-shrink-0 w-24">
          <div className="font-mono text-2xs text-text-tertiary mb-1">Input</div>
          <div
            className="border rounded p-2 text-center"
            style={{ borderColor: signalColor + '40' }}
          >
            {signal === 'rgb' && (
              <div className="w-12 h-12 bg-sunken rounded mx-auto mb-1 flex items-center justify-center">
                <span className="text-2xs text-text-disabled">IMG</span>
              </div>
            )}
            {signal === 'force' && (
              <div className="space-y-0.5">
                {['Fx', 'Fy', 'Fz', 'Tx', 'Ty', 'Tz'].map((a) => (
                  <div
                    key={a}
                    className="h-1 rounded-full"
                    style={{
                      backgroundColor: signalColor,
                      width: `${40 + Math.random() * 60}%`,
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            )}
            {signal === 'proprio' && (
              <div className="font-mono text-2xs text-text-secondary">
                9D TCP
              </div>
            )}
            {showShapes && (
              <div className="mt-1">
                <ShapeBadge dims={info.inputShape} />
              </div>
            )}
          </div>
        </div>

        {/* Pipeline arrow + layers */}
        <div className="flex-1">
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            Pipeline
          </div>
          <div className="space-y-1.5">
            {info.layers.map((layer, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-text-disabled text-xs">↓</span>
                )}
                <LayerBlock label={layer.label} detail={layer.detail} />
              </div>
            ))}
          </div>
        </div>

        {/* Output */}
        <div className="flex-shrink-0 w-24">
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            Output
          </div>
          <div className="border border-accent/30 rounded p-2 text-center">
            <div className="flex gap-0.5 justify-center flex-wrap mb-1">
              {Array.from(
                { length: Math.min(16, parseInt(info.outputShape[0]) || 8) },
                (_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-6 rounded-sm"
                    style={{
                      backgroundColor: signalColor,
                      opacity: 0.3 + Math.random() * 0.7,
                    }}
                  />
                ),
              )}
            </div>
            {showShapes && (
              <ShapeBadge dims={info.outputShape} />
            )}
          </div>
        </div>
      </div>

      <p className="text-text-tertiary text-2xs mt-3 italic">
        {info.description}
      </p>
    </div>
  );
}
