import { useState, useCallback } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';
import { FusionAnimator } from '../../components/FusionAnimator';
import { PaperRef } from '../../components/PaperRef';
import type { FusionStrategy } from '../../lib/data/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StrategyOption {
  id: FusionStrategy;
  label: string;
  models: string;
  paper?: { arxiv: string; label: string };
}

const STRATEGIES: StrategyOption[] = [
  { id: 'concat', label: 'Concat', models: 'B1, B2', paper: { arxiv: '2303.04137', label: 'Chi 2023' } },
  { id: 'projected_concat', label: 'Projected Concat', models: 'B3', paper: { arxiv: '2503.03998', label: 'Kang 2025' } },
  { id: 'film', label: 'FiLM', models: 'B1–B5 backbone', paper: { arxiv: '2303.04137', label: 'Chi 2023' } },
  { id: 'cross_attention', label: 'Cross-Attention', models: 'B4, B5, DECO adapter', paper: { arxiv: '2503.03998', label: 'Kang 2025' } },
  { id: 'mmdit_joint', label: 'MMDiT Joint', models: 'M2 (DECO), M5', paper: { arxiv: '2602.05513', label: 'Li 2025' } },
  { id: 'contact_gated', label: 'Contact Gated', models: 'M1, M3 (FoAR)', paper: { arxiv: '2411.15753', label: 'He 2025' } },
  { id: 'adaLN_zero', label: 'adaLN-Zero', models: 'M2 (DECO), M5', paper: { arxiv: '2212.09748', label: 'Peebles 2023' } },
  { id: 'classifier_free_guidance', label: 'CFG', models: 'M1 (ACT+CFG)', paper: { arxiv: '2604.01414', label: 'Lei 2026' } },
];

const STEP_COUNTS: Record<FusionStrategy, number> = {
  concat: 3,
  projected_concat: 3,
  film: 3,
  cross_attention: 4,
  mmdit_joint: 3,
  contact_gated: 4,
  adaLN_zero: 4,
  classifier_free_guidance: 4,
};

const ANNOTATIONS: Record<FusionStrategy, string> = {
  concat:
    'Concat lets the model see force, but it has no mechanism to selectively attend. Kang et al. found this collapses to vision-only behavior.',
  projected_concat:
    'Projection brings F/T to the same dimensionality as vision features. Better than raw concat, but still no selective attention.',
  film:
    'FiLM modulates the denoiser\'s features at every layer. The conditioning is global — all spatial locations are affected equally.',
  cross_attention:
    'Cross-attention lets force queries the image. The model learns WHERE to look given a force reading. This is the key insight from Kang et al. 2025.',
  mmdit_joint:
    'MMDiT updates both modalities in the same matrix-multiply. Vision and action talk back and forth — bidirectional, not one-way.',
  contact_gated:
    'Contact gating turns force on and off. When φ=0 the model is vision-only; when φ=1 force dominates. This prevents force noise during free-space motion.',
  adaLN_zero:
    'adaLN-Zero conditions by modulating LayerNorm. Zero-initialized gates mean force influence starts dormant and is learned gradually during training.',
  classifier_free_guidance:
    'CFG runs the model twice — with and without force — then amplifies the difference. The guidance weight w is itself modulated by the contact gate.',
};

export default function FusionPlayground() {
  const [strategy, setStrategy] = useState<FusionStrategy>('cross_attention');
  const [step, setStep] = useState(0);
  const maxSteps = STEP_COUNTS[strategy];
  const currentStrategyInfo = STRATEGIES.find((s) => s.id === strategy)!;

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, maxSteps - 1));
  }, [maxSteps]);

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const changeStrategy = useCallback((id: FusionStrategy) => {
    setStrategy(id);
    setStep(0);
  }, []);

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">03</span>
        <h1 className="section-title">Fusion Mechanism Playground</h1>
      </div>
      <p className="text-text-secondary text-sm mb-6">
        Same inputs, different ways of combining them. Step through each fusion
        strategy to see how encoded tokens merge.
      </p>

      <div className="grid grid-cols-[200px_1fr_260px] gap-6">
        {/* Left: strategy selector */}
        <div className="space-y-1">
          <div className="font-mono text-2xs text-text-tertiary mb-2">STRATEGY</div>
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => changeStrategy(s.id)}
              className={`w-full text-left font-mono text-xs px-3 py-2 rounded transition-colors ${
                strategy === s.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-raised border border-transparent'
              }`}
            >
              <div>{s.label}</div>
              <div className="text-2xs text-text-disabled mt-0.5">
                {s.models}
              </div>
            </button>
          ))}
        </div>

        {/* Center: animation stage */}
        <div>
          <div className="card-sunken min-h-[320px] flex flex-col">
            <div className="flex-1">
              <FusionAnimator strategy={strategy} step={step} />
            </div>

            {/* Step indicator */}
            <div className="border-t border-border-subtle pt-3 mt-3">
              <div className="flex items-center gap-2 mb-2">
                {Array.from({ length: maxSteps }, (_, i) => {
                  return (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`flex-1 py-1 rounded text-center font-mono text-2xs transition-colors ${
                        step === i
                          ? 'bg-accent/20 text-accent'
                          : step > i
                            ? 'bg-raised text-text-secondary'
                            : 'bg-sunken text-text-disabled'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevStep}
                  disabled={step === 0}
                  className="p-1 text-text-tertiary hover:text-text-primary disabled:text-text-disabled"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex-1 text-center font-mono text-2xs text-text-secondary">
                  Step {step + 1}: {/* Get step label from STRATEGY_INFO via FusionAnimator data */}
                  {
                    [
                      'concat', 'projected_concat', 'film', 'cross_attention',
                      'mmdit_joint', 'contact_gated', 'adaLN_zero', 'classifier_free_guidance',
                    ].includes(strategy)
                      ? ['Encode', 'Project / Attend', 'Combine', 'Output'][Math.min(step, 3)]
                      : `Step ${step + 1}`
                  }
                </div>
                <button
                  onClick={nextStep}
                  disabled={step >= maxSteps - 1}
                  className="p-1 text-text-tertiary hover:text-text-primary disabled:text-text-disabled"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: explainer panel */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-mono text-xs text-text-primary mb-2">
              {currentStrategyInfo.label}
            </h3>
            <p className="text-text-secondary text-2xs leading-relaxed">
              {ANNOTATIONS[strategy]}
            </p>
          </div>

          <div className="card-sunken">
            <div className="font-mono text-2xs text-text-tertiary mb-2">
              MODELS
            </div>
            <div className="font-mono text-xs text-text-primary">
              {currentStrategyInfo.models}
            </div>
          </div>

          {currentStrategyInfo.paper && (
            <div>
              <PaperRef arxiv={currentStrategyInfo.paper.arxiv}>
                {currentStrategyInfo.paper.label}
              </PaperRef>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
