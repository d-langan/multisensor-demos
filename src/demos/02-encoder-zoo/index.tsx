import { useState } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';
import { TokenInspector } from '../../components/TokenInspector';
import { PaperRef } from '../../components/PaperRef';
import type { EncoderName } from '../../lib/data/types';

const RGB_ENCODERS: { id: EncoderName; label: string }[] = [
  { id: 'resnet18_spatialsoftmax', label: 'ResNet-18 + SpatialSoftmax (B1–B5, M)' },
  { id: 'resnet18_spatial', label: 'ResNet-18 spatial (B4, 49 tokens)' },
  { id: 'octo_smallstem16', label: 'Octo SmallStem16 (M4)' },
];

const FT_ENCODERS: { id: EncoderName; label: string }[] = [
  { id: 'mlp_3layer_30step', label: 'Shared MLP 30-step (M-series)' },
  { id: 'linear_projection', label: 'Linear projection (B3)' },
  { id: 'cross_channel_proj_512', label: 'Cross-channel proj (B4)' },
  { id: 'force_transformer', label: 'Force Transformer (M3 FoAR)' },
  { id: 'lowdim_tokenizer_256bin', label: 'LowdimTokenizer 256-bin (M4)' },
];

const PROPRIO_ENCODERS: { id: EncoderName; label: string }[] = [
  { id: 'flat_concat', label: 'Flat concat (B1/B2)' },
  { id: 'mlp_proprio_64', label: 'MLP → 64D (M-series)' },
  { id: 'lowdim_tokenizer_proprio', label: 'LowdimTokenizer (M4)' },
];

function EncoderSelector({
  options,
  selected,
  onChange,
}: {
  options: { id: EncoderName; label: string }[];
  selected: EncoderName;
  onChange: (id: EncoderName) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`font-mono text-2xs px-2 py-1 rounded border transition-colors ${
            selected === opt.id
              ? 'border-accent text-accent bg-accent/10'
              : 'border-border-subtle text-text-tertiary hover:text-text-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const ANNOTATIONS = [
  {
    text: 'Force is naturally a time-series. Most encoders ignore that and take a single frame.',
    position: 'ft' as const,
  },
  {
    text: "Octo's tokenizer quantizes — same information, different representation. Discrete vs. continuous matters at the fusion stage.",
    position: 'ft' as const,
  },
  {
    text: 'Proprio is small and structured — even a 9D flat concat usually works.',
    position: 'proprio' as const,
  },
];

export default function EncoderZoo() {
  const [rgbEncoder, setRgbEncoder] = useState<EncoderName>(
    'resnet18_spatialsoftmax',
  );
  const [ftEncoder, setFtEncoder] = useState<EncoderName>(
    'mlp_3layer_30step',
  );
  const [proprioEncoder, setProprioEncoder] = useState<EncoderName>(
    'mlp_proprio_64',
  );

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">02</span>
        <h1 className="section-title">Encoder Zoo</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4">
        How does each raw signal become a token (or vector)? Compare encoders
        for each modality — same input, different representations.
      </p>
      <div className="flex gap-2 mb-6">
        <PaperRef arxiv="2503.03998">Kang et al. 2025</PaperRef>
        <PaperRef arxiv="2405.12213">Ghosh et al. 2024 (Octo)</PaperRef>
        <PaperRef arxiv="2411.15753">He et al. 2025 (FoAR)</PaperRef>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RGB column */}
        <div>
          <h2
            className="font-mono text-sm font-semibold mb-2"
            style={{ color: '#4ade80' }}
          >
            RGB Vision
          </h2>
          <TokenInspector signal="rgb" encoder={rgbEncoder} />
          <EncoderSelector
            options={RGB_ENCODERS}
            selected={rgbEncoder}
            onChange={setRgbEncoder}
          />
        </div>

        {/* F/T column */}
        <div>
          <h2
            className="font-mono text-sm font-semibold mb-2"
            style={{ color: '#fb923c' }}
          >
            Force / Torque
          </h2>
          <TokenInspector signal="force" encoder={ftEncoder} />
          <EncoderSelector
            options={FT_ENCODERS}
            selected={ftEncoder}
            onChange={setFtEncoder}
          />
        </div>

        {/* Proprio column */}
        <div>
          <h2
            className="font-mono text-sm font-semibold mb-2"
            style={{ color: '#60a5fa' }}
          >
            Proprioception
          </h2>
          <TokenInspector signal="proprio" encoder={proprioEncoder} />
          <EncoderSelector
            options={PROPRIO_ENCODERS}
            selected={proprioEncoder}
            onChange={setProprioEncoder}
          />
        </div>
      </div>

      {/* Editorial annotations */}
      <div className="mt-8 space-y-3">
        {ANNOTATIONS.map((ann, i) => (
          <div
            key={i}
            className="card-sunken border-l-2 pl-4 py-2"
            style={{
              borderColor:
                ann.position === 'ft'
                  ? '#fb923c'
                  : ann.position === 'proprio'
                    ? '#60a5fa'
                    : '#4ade80',
            }}
          >
            <p className="text-text-secondary text-sm italic font-display">
              {ann.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
