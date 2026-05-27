import { useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useTimeline } from '../../lib/time/TimelineContext';
import type { ForceTorqueData, ProprioceptionData, ActionsData, Phase } from '../../lib/data/types';
import { MODALITY_HEX } from '../../lib/viz/colors';
import { PHASE_HEX } from '../../lib/viz/colors';

export type TrackConfig =
  | { kind: 'rgb'; height?: number }
  | { kind: 'depth' }
  | { kind: 'force'; axes?: ('fx' | 'fy' | 'fz')[] }
  | { kind: 'torque'; axes?: ('tx' | 'ty' | 'tz')[] }
  | { kind: 'proprio'; components?: ('pos' | 'rot')[] }
  | { kind: 'action'; components?: ('pose' | 'fz')[] }
  | { kind: 'phase' };

interface SignalStripProps {
  forceTorque?: ForceTorqueData;
  proprioception?: ProprioceptionData;
  actions?: ActionsData;
  phases?: Phase[];
  tracks: TrackConfig[];
  mutedTracks?: Set<string>;
  height?: number;
}

// LTTB downsampling for performance
function downsample(
  data: { t: number; v: number }[],
  threshold: number,
): { t: number; v: number }[] {
  if (data.length <= threshold) return data;

  const sampled: { t: number; v: number }[] = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);

  let prevIndex = 0;
  for (let i = 1; i < threshold - 1; i++) {
    const rangeStart = Math.floor((i - 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor(i * bucketSize) + 1, data.length - 1);

    // Average of next bucket for area calculation
    const nextStart = Math.floor(i * bucketSize) + 1;
    const nextEnd = Math.min(
      Math.floor((i + 1) * bucketSize) + 1,
      data.length - 1,
    );
    let avgT = 0;
    let avgV = 0;
    const nextLen = nextEnd - nextStart;
    for (let j = nextStart; j < nextEnd; j++) {
      avgT += data[j].t;
      avgV += data[j].v;
    }
    avgT /= nextLen || 1;
    avgV /= nextLen || 1;

    let maxArea = -1;
    let maxIdx = rangeStart;
    const prevPoint = data[prevIndex];

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (prevPoint.t - avgT) * (data[j].v - prevPoint.v) -
          (prevPoint.t - data[j].t) * (avgV - prevPoint.v),
      );
      if (area > maxArea) {
        maxArea = area;
        maxIdx = j;
      }
    }

    sampled.push(data[maxIdx]);
    prevIndex = maxIdx;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}

const TRACK_HEIGHT = 80;
const LABEL_WIDTH = 80;
const MAX_POINTS = 800;

function NumericTrack({
  label,
  data,
  color,
  unit,
  muted,
  domain,
}: {
  label: string;
  data: { t: number; v: number }[];
  color: string;
  unit: string;
  muted: boolean;
  domain?: [number, number];
}) {
  const { currentTime, duration } = useTimeline();

  const downsampled = useMemo(() => downsample(data, MAX_POINTS), [data]);

  // Find current value
  const currentIdx = useMemo(() => {
    if (data.length === 0) return -1;
    let lo = 0;
    let hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (data[mid].t <= currentTime) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }, [data, currentTime]);

  const currentValue = currentIdx >= 0 ? data[currentIdx]?.v : null;

  if (muted) {
    return (
      <div
        className="flex items-center border-b border-border-subtle"
        style={{ height: TRACK_HEIGHT }}
      >
        <div
          className="flex-shrink-0 font-mono text-2xs text-text-disabled px-2 text-right"
          style={{ width: LABEL_WIDTH }}
        >
          {label}
        </div>
        <div className="flex-1 bg-sunken/50 h-full" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center border-b border-border-subtle"
      style={{ height: TRACK_HEIGHT }}
    >
      <div
        className="flex-shrink-0 font-mono text-2xs px-2 text-right flex flex-col items-end justify-center"
        style={{ width: LABEL_WIDTH, color }}
      >
        <span>{label}</span>
        {currentValue !== null && (
          <span className="text-text-secondary">
            {currentValue.toFixed(1)} {unit}
          </span>
        )}
      </div>
      <div className="flex-1 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={downsampled}
            margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
          >
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, duration]}
              hide
            />
            <YAxis domain={domain || ['auto', 'auto']} hide />
            <Line
              dataKey="v"
              stroke={color}
              dot={false}
              strokeWidth={1.2}
              isAnimationActive={false}
            />
            {currentTime > 0 && (
              <ReferenceLine
                x={currentTime}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PhaseTrack({ phases, duration }: { phases: Phase[]; duration: number }) {
  if (duration <= 0) return null;

  return (
    <div
      className="flex items-center border-b border-border-subtle"
      style={{ height: 24 }}
    >
      <div
        className="flex-shrink-0 font-mono text-2xs text-text-disabled px-2 text-right"
        style={{ width: LABEL_WIDTH }}
      >
        phase
      </div>
      <div className="flex-1 h-full relative">
        {phases.map((phase) => {
          const left = (phase.t_start / duration) * 100;
          const width = ((phase.t_end - phase.t_start) / duration) * 100;
          const hex = PHASE_HEX[phase.label as keyof typeof PHASE_HEX] || '#666';
          return (
            <div
              key={`${phase.label}-${phase.t_start}`}
              className="absolute top-1 bottom-1 rounded-sm flex items-center justify-center"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: hex,
                opacity: 0.3,
              }}
            >
              <span
                className="font-mono text-2xs overflow-hidden text-ellipsis whitespace-nowrap px-1"
                style={{ color: hex, opacity: 1, maxWidth: '100%' }}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RgbTrack({ muted }: { muted: boolean }) {
  const { currentTime } = useTimeline();
  // 10 Hz frames: every 3rd frame at 30Hz, so frame index = floor(t * 10)
  const frameIdx = Math.floor(currentTime * 10);
  const frameSrc = `./data/episode_19/rgb/${String(frameIdx).padStart(4, '0')}.png`;

  // Preload nearby frames for smooth scrubbing
  useEffect(() => {
    for (let offset = 1; offset <= 5; offset++) {
      const img = new Image();
      img.src = `./data/episode_19/rgb/${String(frameIdx + offset).padStart(4, '0')}.png`;
    }
  }, [frameIdx]);

  if (muted) {
    return (
      <div
        className="flex items-center border-b border-border-subtle"
        style={{ height: 80 }}
      >
        <div
          className="flex-shrink-0 font-mono text-2xs text-text-disabled px-2 text-right"
          style={{ width: LABEL_WIDTH }}
        >
          RGB
        </div>
        <div className="flex-1 bg-sunken/50 h-full" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center border-b border-border-subtle"
      style={{ height: 80 }}
    >
      <div
        className="flex-shrink-0 font-mono text-2xs px-2 text-right flex flex-col items-end justify-center"
        style={{ width: LABEL_WIDTH, color: MODALITY_HEX.rgb }}
      >
        <span>RGB</span>
        <span className="text-text-disabled">{currentTime.toFixed(1)}s</span>
      </div>
      <div className="flex-1 h-full bg-sunken flex items-center gap-2 px-2">
        <img
          src={frameSrc}
          alt={`frame ${frameIdx}`}
          className="h-full object-contain rounded"
          style={{ imageRendering: 'auto' }}
        />
      </div>
    </div>
  );
}

export function SignalStrip({
  forceTorque,
  proprioception,
  actions,
  phases,
  tracks,
  mutedTracks = new Set(),
  height,
}: SignalStripProps) {
  const { duration } = useTimeline();

  const ftData = useMemo(() => {
    if (!forceTorque) return {};
    const build = (key: 'fx' | 'fy' | 'fz' | 'tx' | 'ty' | 'tz') =>
      forceTorque.t.map((t, i) => ({ t, v: forceTorque[key][i] }));
    return {
      fx: build('fx'),
      fy: build('fy'),
      fz: build('fz'),
      tx: build('tx'),
      ty: build('ty'),
      tz: build('tz'),
    };
  }, [forceTorque]);

  const proprioData = useMemo(() => {
    if (!proprioception) return {};
    return {
      px: proprioception.t.map((t, i) => ({ t, v: proprioception.px[i] })),
      py: proprioception.t.map((t, i) => ({ t, v: proprioception.py[i] })),
      pz: proprioception.t.map((t, i) => ({ t, v: proprioception.pz[i] })),
    };
  }, [proprioception]);

  const actionFzData = useMemo(() => {
    if (!actions) return [];
    return actions.t.map((t, i) => ({ t, v: actions.fz[i] }));
  }, [actions]);

  return (
    <div
      className="border border-border-subtle rounded-lg overflow-hidden bg-raised"
      style={height ? { height } : undefined}
    >
      {tracks.map((track, idx) => {
        switch (track.kind) {
          case 'rgb':
            return (
              <RgbTrack
                key={`rgb-${idx}`}
                muted={mutedTracks.has('rgb')}
              />
            );
          case 'force': {
            const axes = track.axes || ['fx', 'fy', 'fz'];
            return axes.map((axis) => (
              <NumericTrack
                key={axis}
                label={axis.toUpperCase()}
                data={ftData[axis] || []}
                color={MODALITY_HEX.force}
                unit="N"
                muted={mutedTracks.has('force')}
              />
            ));
          }
          case 'torque': {
            const axes = track.axes || ['tx', 'ty', 'tz'];
            return axes.map((axis) => (
              <NumericTrack
                key={axis}
                label={axis.toUpperCase()}
                data={ftData[axis] || []}
                color={MODALITY_HEX.torque}
                unit="Nm"
                muted={mutedTracks.has('torque')}
              />
            ));
          }
          case 'proprio': {
            const comps = track.components || ['pos'];
            return comps.flatMap((comp) => {
              if (comp === 'pos') {
                return (['px', 'py', 'pz'] as const).map((k) => (
                  <NumericTrack
                    key={k}
                    label={k.toUpperCase()}
                    data={proprioData[k] || []}
                    color={MODALITY_HEX.proprio}
                    unit="m"
                    muted={mutedTracks.has('proprio')}
                  />
                ));
              }
              return [];
            });
          }
          case 'action': {
            const comps = track.components || ['fz'];
            return comps.flatMap((comp) => {
              if (comp === 'fz') {
                return [
                  <NumericTrack
                    key="action-fz"
                    label="Action Fz"
                    data={actionFzData}
                    color={MODALITY_HEX.action}
                    unit="N"
                    muted={mutedTracks.has('action')}
                  />,
                ];
              }
              return [];
            });
          }
          case 'phase':
            return (
              <PhaseTrack
                key={`phase-${idx}`}
                phases={phases || []}
                duration={duration}
              />
            );
          case 'depth':
            return (
              <div
                key={`depth-${idx}`}
                className="flex items-center border-b border-border-subtle"
                style={{ height: 60 }}
              >
                <div
                  className="flex-shrink-0 font-mono text-2xs px-2 text-right"
                  style={{ width: LABEL_WIDTH, color: MODALITY_HEX.depth }}
                >
                  Depth
                </div>
                <div className="flex-1 h-full bg-sunken flex items-center justify-center">
                  <span className="font-mono text-2xs text-text-disabled">
                    depth frames
                  </span>
                </div>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
