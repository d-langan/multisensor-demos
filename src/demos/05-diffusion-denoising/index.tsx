import { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { RegistrationMark } from '../../components/RegistrationMark';
import { TimelineScrubber } from '../../components/TimelineScrubber';
import { TimelineProvider, useTimeline } from '../../lib/time/TimelineContext';
import { PaperRef } from '../../components/PaperRef';
import { useEpisode } from '../../lib/data/useEpisode';
import { usePredictions, getAvailablePredictionModels } from '../../lib/data/usePredictions';
import type { ModelId } from '../../lib/data/types';

const MODEL_COLORS: Record<string, string> = {
  b1: '#f87171',
  m3: '#4ade80',
  m4: '#60a5fa',
};

const MODEL_LABELS: Record<string, string> = {
  b1: 'B1 — Vision Only (Fz MAE: 27.85 N)',
  m3: 'M3 — FoAR (Fz MAE: 6.13 N)',
  m4: 'M4 — Octo (Fz MAE: 6.93 N)',
};

function DenoisingInner() {
  const { data: episode, loading: epLoading } = useEpisode();
  const { setDuration, currentTime } = useTimeline();
  const [modelA, setModelA] = useState<ModelId>('b1');
  const [modelB, setModelB] = useState<ModelId>('m3');
  const { data: predsA } = usePredictions(modelA);
  const { data: predsB } = usePredictions(modelB);

  const availableModels = getAvailablePredictionModels();

  useEffect(() => {
    if (episode) setDuration(episode.manifest.duration_s);
  }, [episode, setDuration]);

  const chartData = useMemo(() => {
    if (!episode) return [];
    const gt = episode.actions;
    return gt.t.map((t, i) => {
      const row: Record<string, number> = { t, gt_fz: gt.fz[i] };

      // Find closest prediction for model A
      if (predsA) {
        const pred = predsA.predictions.reduce((closest, p) =>
          Math.abs(p.t - t) < Math.abs(closest.t - t) ? p : closest,
        );
        row.a_fz = pred.executed[6] ?? 0;
      }

      if (predsB) {
        const pred = predsB.predictions.reduce((closest, p) =>
          Math.abs(p.t - t) < Math.abs(closest.t - t) ? p : closest,
        );
        row.b_fz = pred.executed[6] ?? 0;
      }

      return row;
    });
  }, [episode, predsA, predsB]);

  if (epLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-sm text-text-secondary animate-pulse">
          Loading…
        </span>
      </div>
    );
  }

  if (!episode) return null;

  return (
    <div className="space-y-6">
      {/* Model selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-2xs text-text-tertiary mb-1">Model A</div>
          <select
            value={modelA}
            onChange={(e) => setModelA(e.target.value as ModelId)}
            className="w-full bg-sunken border border-border-subtle rounded px-2 py-1.5 font-mono text-xs text-text-primary"
          >
            {availableModels.map((id) => (
              <option key={id} value={id}>
                {MODEL_LABELS[id] || id.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-tertiary mb-1">Model B</div>
          <select
            value={modelB}
            onChange={(e) => setModelB(e.target.value as ModelId)}
            className="w-full bg-sunken border border-border-subtle rounded px-2 py-1.5 font-mono text-xs text-text-primary"
          >
            {availableModels.map((id) => (
              <option key={id} value={id}>
                {MODEL_LABELS[id] || id.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fz comparison chart */}
      <div className="card">
        <div className="font-mono text-xs text-text-primary mb-2">
          Fz Prediction vs Ground Truth
        </div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, episode.manifest.duration_s]}
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={(v: number) => `${v.toFixed(0)}s`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={(v: number) => `${v.toFixed(0)} N`}
              />
              <Line
                dataKey="gt_fz"
                stroke="var(--text-secondary)"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="Ground truth"
              />
              <Line
                dataKey="a_fz"
                stroke={MODEL_COLORS[modelA] || '#f87171'}
                dot={false}
                strokeWidth={1.2}
                strokeDasharray="4 2"
                isAnimationActive={false}
                name={modelA.toUpperCase()}
              />
              <Line
                dataKey="b_fz"
                stroke={MODEL_COLORS[modelB] || '#4ade80'}
                dot={false}
                strokeWidth={1.2}
                strokeDasharray="4 2"
                isAnimationActive={false}
                name={modelB.toUpperCase()}
              />
              <ReferenceLine
                x={currentTime}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MAE summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-sunken text-center">
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            B1 Fz MAE
          </div>
          <div className="font-mono text-xl text-red-400 font-bold">
            27.85 N
          </div>
          <div className="font-mono text-2xs text-text-disabled">
            Vision only
          </div>
        </div>
        <div className="card-sunken text-center">
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            M3 Fz MAE
          </div>
          <div className="font-mono text-xl text-green-400 font-bold">
            6.13 N
          </div>
          <div className="font-mono text-2xs text-text-disabled">
            Force Transformer + gate
          </div>
        </div>
        <div className="card-sunken text-center">
          <div className="font-mono text-2xs text-text-tertiary mb-1">
            M4 Fz MAE
          </div>
          <div className="font-mono text-xl text-blue-400 font-bold">
            6.93 N
          </div>
          <div className="font-mono text-2xs text-text-disabled">
            Octo pretrained
          </div>
        </div>
      </div>

      <TimelineScrubber phases={episode.annotations.phases} />

      <div className="card-sunken border-l-2 border-modality-force pl-4">
        <p className="text-text-secondary text-sm italic font-display">
          "The 30-step F/T temporal window is likely the primary driver. Baselines
          see only the current F/T frame — they cannot distinguish sensor noise
          from meaningful force dynamics."
        </p>
      </div>
    </div>
  );
}

export default function DiffusionDenoising() {
  return (
    <TimelineProvider>
      <div className="container-demo py-8">
        <div className="flex items-center gap-3 mb-2">
          <RegistrationMark />
          <span className="font-mono text-2xs text-text-disabled">05</span>
          <h1 className="section-title">Force Prediction Comparison</h1>
        </div>
        <p className="text-text-secondary text-sm mb-4">
          Why does fusion matter behaviorally? Compare action predictions
          from vision-only (B1) vs force-aware (M3, M4) models.
        </p>
        <div className="flex gap-2 mb-6">
          <PaperRef arxiv="2303.04137">Chi et al. 2023</PaperRef>
          <PaperRef arxiv="2411.15753">He et al. 2025 (FoAR)</PaperRef>
          <PaperRef arxiv="2405.12213">Ghosh et al. 2024 (Octo)</PaperRef>
        </div>

        <DenoisingInner />
      </div>
    </TimelineProvider>
  );
}
