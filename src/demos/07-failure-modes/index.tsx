import { useState, useMemo } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';

interface SliderParam {
  label: string;
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description: string;
}

const PARAMS: SliderParam[] = [
  {
    label: 'Train magnitude ratio',
    key: 'train_mag',
    min: 0.5,
    max: 2.0,
    step: 0.05,
    default: 1.0,
    description: 'Ratio of predicted to GT action magnitude during training',
  },
  {
    label: 'Normalization compression',
    key: 'norm_compression',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    default: 0.55,
    description:
      'MinMax normalization compresses deploy-time OOD inputs toward zero',
  },
  {
    label: 'Checkpoint collapse',
    key: 'ckpt_collapse',
    min: 0.1,
    max: 1.5,
    step: 0.05,
    default: 1.0,
    description: 'Training-duration dependent: 30K vs 100K checkpoints diverge',
  },
  {
    label: 'Chunk position-0 factor',
    key: 'chunk_pos0',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    default: 1.8,
    description:
      'Position 0 in the action chunk is systematically amplified vs mean-chunk',
  },
];

function ParamSlider({
  param,
  value,
  onChange,
}: {
  param: SliderParam;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-2xs text-text-secondary">
          {param.label}
        </span>
        <span className="font-mono text-xs text-text-primary tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1"
      />
      <p className="font-mono text-2xs text-text-disabled">{param.description}</p>
    </div>
  );
}

export default function FailureModes() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(PARAMS.map((p) => [p.key, p.default])),
  );

  const deployRatio = useMemo(() => {
    return (
      values.train_mag *
      values.norm_compression *
      values.ckpt_collapse *
      values.chunk_pos0
    );
  }, [values]);

  // Real M3 data points from Phase 1.9
  const m3_30k_predicted = 3.16;
  const m3_30k_observed = 3.29;

  return (
    <div className="container-demo py-8 max-w-4xl overflow-x-hidden">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">07</span>
        <h1 className="section-title">Failure Mode Taxonomy</h1>
      </div>
      <p className="text-text-secondary text-sm mb-6">
        When force-aware models fail, why? A three-mechanism decomposition
        predicts deployment magnitude from training behavior.
      </p>

      <div className="card mb-6">
        <div className="font-mono text-sm text-text-primary mb-3">
          Deployment Magnitude Formula
        </div>
        <div className="card-sunken px-4 py-3 font-mono text-2xs overflow-x-auto">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span className="text-text-secondary">deploy_mag</span>
            <span className="text-text-tertiary">=</span>
            <span className="text-text-primary">train_mag</span>
            <span className="text-text-tertiary">×</span>
            <span style={{ color: '#fb923c' }}>norm_compress</span>
            <span className="text-text-tertiary">×</span>
            <span style={{ color: '#60a5fa' }}>ckpt_collapse</span>
            <span className="text-text-tertiary">×</span>
            <span style={{ color: '#4ade80' }}>chunk_pos0</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Sliders */}
        <div className="space-y-5">
          {PARAMS.map((param) => (
            <ParamSlider
              key={param.key}
              param={param}
              value={values[param.key]}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [param.key]: v }))
              }
            />
          ))}

          <button
            onClick={() =>
              setValues(
                Object.fromEntries(PARAMS.map((p) => [p.key, p.default])),
              )
            }
            className="font-mono text-2xs text-accent hover:underline"
          >
            Reset to defaults
          </button>
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          <div className="card text-center">
            <div className="font-mono text-2xs text-text-tertiary mb-1">
              Predicted deploy ratio
            </div>
            <div
              className="font-mono text-3xl font-bold"
              style={{
                color:
                  deployRatio > 2
                    ? '#f87171'
                    : deployRatio > 1.2
                      ? '#fbbf24'
                      : '#4ade80',
              }}
            >
              {deployRatio.toFixed(2)}×
            </div>
            <div className="font-mono text-2xs text-text-disabled mt-1">
              {deployRatio > 2
                ? 'Dangerous overshoot'
                : deployRatio > 1.2
                  ? 'Moderate amplification'
                  : deployRatio < 0.5
                    ? 'Under-damped'
                    : 'Reasonable range'}
            </div>
          </div>

          <div className="card-sunken">
            <div className="font-mono text-2xs text-text-tertiary mb-2">
              M3 FoAR 30K validation
            </div>
            <div className="space-y-1 font-mono text-2xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Predicted</span>
                <span>{m3_30k_predicted.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Observed</span>
                <span>{m3_30k_observed.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Error</span>
                <span className="text-green-400">
                  {(
                    Math.abs(m3_30k_predicted - m3_30k_observed) /
                    m3_30k_observed *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="text-text-tertiary text-2xs font-mono">
            <p>
              The formula predicts deployment behavior
              across all four M-series checkpoint variations
              within 4% error.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
