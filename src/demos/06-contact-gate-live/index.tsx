import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { RegistrationMark } from '../../components/RegistrationMark';
import { TimelineScrubber } from '../../components/TimelineScrubber';
import { TimelineProvider, useTimeline } from '../../lib/time/TimelineContext';
import { PaperRef } from '../../components/PaperRef';
import { useEpisode } from '../../lib/data/useEpisode';
import { MODALITY_HEX } from '../../lib/viz/colors';

interface GateParams {
  engageThreshold: number;
  disengageThreshold: number;
  softRampLow: number;
  softRampHigh: number;
}

const DEFAULT_PARAMS: GateParams = {
  engageThreshold: 5.0,
  disengageThreshold: 2.5,
  softRampLow: 2.0,
  softRampHigh: 8.0,
};

// |F| = L2 norm of force vector (Fx, Fy, Fz), NOT |Fz| alone
function computeForceMag(
  fx: number[],
  fy: number[],
  fz: number[],
): number[] {
  return fx.map((_, i) =>
    Math.sqrt(fx[i] ** 2 + fy[i] ** 2 + fz[i] ** 2),
  );
}

function computeGateOutputs(
  forceMag: number[],
  params: GateParams,
): { phiHard: number[]; phiSoft: number[] } {
  const phiHard: number[] = [];
  const phiSoft: number[] = [];

  let engaged = false;
  for (let i = 0; i < forceMag.length; i++) {
    // Hard gate with hysteresis
    if (!engaged && forceMag[i] > params.engageThreshold) {
      engaged = true;
    } else if (engaged && forceMag[i] < params.disengageThreshold) {
      engaged = false;
    }
    phiHard.push(engaged ? 1 : 0);

    // Soft ramp
    const soft = Math.max(
      0,
      Math.min(
        1,
        (forceMag[i] - params.softRampLow) /
          (params.softRampHigh - params.softRampLow),
      ),
    );
    phiSoft.push(soft);
  }

  return { phiHard, phiSoft };
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-2xs text-text-secondary w-28 text-right">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent h-1"
      />
      <span className="font-mono text-2xs text-text-primary w-16 tabular-nums">
        {value.toFixed(1)} {unit}
      </span>
    </div>
  );
}

const CHART_HEIGHT = 140;

function ContactGateInner() {
  const { data, loading, error } = useEpisode();
  const { currentTime, setDuration } = useTimeline();
  const [params, setParams] = useState<GateParams>(DEFAULT_PARAMS);

  useEffect(() => {
    if (data) setDuration(data.manifest.duration_s);
  }, [data, setDuration]);

  const updateParam = useCallback(
    (key: keyof GateParams, value: number) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const { chartData, currentGate } = useMemo(() => {
    if (!data)
      return { chartData: [], currentGate: { phiHard: 0, phiSoft: 0, forceMag: 0 } };

    const { fx, fy, fz, t } = data.forceTorque;
    const forceMag = computeForceMag(fx, fy, fz);
    const { phiHard, phiSoft } = computeGateOutputs(forceMag, params);

    const cd = t.map((time, i) => ({
      t: time,
      forceMag: forceMag[i],
      phiHard: phiHard[i],
      phiSoft: phiSoft[i],
    }));

    // Find current values
    let idx = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] <= currentTime) idx = i;
      else break;
    }

    return {
      chartData: cd,
      currentGate: {
        phiHard: phiHard[idx] || 0,
        phiSoft: phiSoft[idx] || 0,
        forceMag: forceMag[idx] || 0,
      },
    };
  }, [data, params, currentTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-sm text-text-secondary animate-pulse">
          Loading…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card border-danger/30 text-danger font-mono text-sm">
        Error: {error}
      </div>
    );
  }

  const duration = data.manifest.duration_s;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
      <div className="space-y-4">
        {/* |F| signal */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="font-mono text-2xs font-semibold"
              style={{ color: MODALITY_HEX.force }}
            >
              |F| (force magnitude)
            </span>
            <span className="font-mono text-2xs text-text-secondary">
              {currentGate.forceMag.toFixed(1)} N
            </span>
          </div>
          <div style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <XAxis dataKey="t" type="number" domain={[0, duration]} hide />
                <YAxis domain={[0, 'auto']} hide />
                <Area
                  dataKey="forceMag"
                  stroke={MODALITY_HEX.force}
                  fill={MODALITY_HEX.force}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  dot={false}
                />
                <ReferenceLine
                  y={params.engageThreshold}
                  stroke="#4ade80"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <ReferenceLine
                  y={params.disengageThreshold}
                  stroke="#f87171"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <ReferenceLine
                  x={currentTime}
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-1 font-mono text-2xs">
            <span style={{ color: '#4ade80' }}>
              ── engage: {params.engageThreshold.toFixed(1)} N
            </span>
            <span style={{ color: '#f87171' }}>
              ── disengage: {params.disengageThreshold.toFixed(1)} N
            </span>
          </div>
        </div>

        {/* Gate outputs */}
        <div className="card">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-2xs text-text-secondary">
              Gate outputs
            </span>
            <span className="font-mono text-2xs">
              φ_hard ={' '}
              <span
                className="font-semibold"
                style={{
                  color: currentGate.phiHard > 0.5 ? '#4ade80' : '#f87171',
                }}
              >
                {currentGate.phiHard.toFixed(0)}
              </span>
            </span>
            <span className="font-mono text-2xs">
              φ_soft ={' '}
              <span className="font-semibold text-text-primary">
                {currentGate.phiSoft.toFixed(2)}
              </span>
            </span>
          </div>
          <div style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
              >
                <XAxis dataKey="t" type="number" domain={[0, duration]} hide />
                <YAxis domain={[0, 1.05]} hide />
                <Line
                  dataKey="phiHard"
                  stroke="#4ade80"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                  name="φ_hard"
                />
                <Line
                  dataKey="phiSoft"
                  stroke="#60a5fa"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  isAnimationActive={false}
                  name="φ_soft"
                />
                <ReferenceLine
                  x={currentTime}
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-1 font-mono text-2xs">
            <span style={{ color: '#4ade80' }}>── φ_hard (step)</span>
            <span style={{ color: '#60a5fa' }}>╌╌ φ_soft (ramp)</span>
          </div>
        </div>

        {/* Gated pathway contribution */}
        <div className="card">
          <div className="font-mono text-2xs text-text-secondary mb-2">
            ft_gated = φ · ft_embed + (1 − φ) · ft_null
          </div>
          <div className="flex items-center gap-4 h-12">
            <div
              className="h-full rounded transition-all duration-200"
              style={{
                width: `${currentGate.phiSoft * 100}%`,
                minWidth: '2px',
                backgroundColor: MODALITY_HEX.force,
                opacity: 0.7,
              }}
            />
            <div
              className="h-full rounded transition-all duration-200 bg-text-disabled/20"
              style={{
                width: `${(1 - currentGate.phiSoft) * 100}%`,
                minWidth: '2px',
              }}
            />
          </div>
          <div className="flex justify-between font-mono text-2xs mt-1">
            <span style={{ color: MODALITY_HEX.force }}>
              ft_embed ({(currentGate.phiSoft * 100).toFixed(0)}%)
            </span>
            <span className="text-text-disabled">
              ft_null ({((1 - currentGate.phiSoft) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        <TimelineScrubber phases={data.annotations.phases} />
      </div>

      {/* Sidebar: parameter sliders */}
      <div className="space-y-4">
        <div className="card">
          <h3 className="font-mono text-xs text-text-primary mb-3">
            Gate Parameters
          </h3>
          <div className="space-y-3">
            <ParamSlider
              label="Engage"
              value={params.engageThreshold}
              min={1}
              max={20}
              step={0.5}
              unit="N"
              onChange={(v) => updateParam('engageThreshold', v)}
            />
            <ParamSlider
              label="Disengage"
              value={params.disengageThreshold}
              min={0.5}
              max={15}
              step={0.5}
              unit="N"
              onChange={(v) => updateParam('disengageThreshold', v)}
            />
            <ParamSlider
              label="Soft low"
              value={params.softRampLow}
              min={0.5}
              max={10}
              step={0.5}
              unit="N"
              onChange={(v) => updateParam('softRampLow', v)}
            />
            <ParamSlider
              label="Soft high"
              value={params.softRampHigh}
              min={2}
              max={20}
              step={0.5}
              unit="N"
              onChange={(v) => updateParam('softRampHigh', v)}
            />
          </div>
          <button
            onClick={() => setParams(DEFAULT_PARAMS)}
            className="font-mono text-2xs text-accent mt-3 hover:underline"
          >
            Reset to defaults
          </button>
        </div>

        <div className="card">
          <h3 className="font-mono text-xs text-text-primary mb-2">
            Current State
          </h3>
          <div className="space-y-1 font-mono text-2xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">|F|</span>
              <span>{currentGate.forceMag.toFixed(1)} N</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">φ_hard</span>
              <span
                style={{
                  color:
                    currentGate.phiHard > 0.5 ? '#4ade80' : '#f87171',
                }}
              >
                {currentGate.phiHard.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">φ_soft</span>
              <span>{currentGate.phiSoft.toFixed(3)}</span>
            </div>
          </div>
        </div>

        <div className="text-text-tertiary text-2xs font-mono space-y-1">
          <p>
            During contact φ ≈ 1: force dominates.
            <br />
            During free space φ ≈ 0: force is suppressed.
          </p>
          <p>
            |F| = L2 norm of (Fx, Fy, Fz)
            <br />
            NOT |Fz| alone, NOT including torque.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ContactGateLive() {
  return (
    <TimelineProvider>
      <div className="container-demo py-8">
        <div className="flex items-center gap-3 mb-2">
          <RegistrationMark />
          <span className="font-mono text-2xs text-text-disabled">06</span>
          <h1 className="section-title">Contact Gate Live</h1>
        </div>
        <p className="text-text-secondary text-sm mb-4">
          What does the contact gate actually do, mechanically? Watch how
          the gate fires on the force signal and controls the F/T pathway
          contribution.
        </p>
        <div className="flex gap-2 mb-6">
          <PaperRef arxiv="2411.15753">He et al. 2025 (FoAR)</PaperRef>
          <PaperRef arxiv="2604.01414">Lei et al. 2026 (ACT+CFG)</PaperRef>
        </div>

        <ContactGateInner />
      </div>
    </TimelineProvider>
  );
}
