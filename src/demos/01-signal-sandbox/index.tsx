import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, YAxis } from 'recharts';
import { RegistrationMark } from '../../components/RegistrationMark';
import { SignalStrip, type TrackConfig } from '../../components/SignalStrip';
import { TimelineScrubber } from '../../components/TimelineScrubber';
import { TimelineProvider, useTimeline } from '../../lib/time/TimelineContext';
import { ModalityChip } from '../../components/ModalityChip';
import { PaperRef } from '../../components/PaperRef';
import { EquationCallout } from '../../components/EquationCallout';
import { useEpisode } from '../../lib/data/useEpisode';
import { MODALITY_HEX, type ModalityKey } from '../../lib/viz/colors';

const ALL_TRACKS: TrackConfig[] = [
  { kind: 'rgb' },
  { kind: 'force', axes: ['fz'] },
  { kind: 'force', axes: ['fx', 'fy'] },
  { kind: 'torque', axes: ['tx', 'ty', 'tz'] },
  { kind: 'proprio', components: ['pos'] },
  { kind: 'action', components: ['fz'] },
  { kind: 'phase' },
];

const CHANNEL_LEGEND: { label: string; key: string; color: ModalityKey }[] = [
  { label: 'RGB', key: 'rgb', color: 'rgb' },
  { label: 'F/T', key: 'force', color: 'force' },
  { label: 'Torque', key: 'torque', color: 'torque' },
  { label: 'Proprio', key: 'proprio', color: 'proprio' },
  { label: 'Action', key: 'action', color: 'action' },
];

function StressMomentCard({
  fzData,
}: {
  fzData: { t: number; v: number }[];
}) {
  // Find the contact transient — biggest Fz jump in a 1-second window
  let maxJump = 0;
  let jumpIdx = 0;
  for (let i = 30; i < fzData.length; i++) {
    const jump = Math.abs(fzData[i].v - fzData[i - 30].v);
    if (jump > maxJump) {
      maxJump = jump;
      jumpIdx = i;
    }
  }

  const tCenter = fzData[jumpIdx]?.t || 15;
  const fzBefore = fzData[Math.max(0, jumpIdx - 30)]?.v || 0;
  const fzAfter = fzData[jumpIdx]?.v || -35;

  return (
    <div className="card border-2 border-modality-force/30">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: MODALITY_HEX.force }}
        />
        <h3 className="font-mono text-sm text-text-primary font-semibold">
          Stress Moment
        </h3>
        <span className="font-mono text-2xs text-text-tertiary">
          t ≈ {tCenter.toFixed(1)}s
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card-sunken p-3">
          <div
            className="font-mono text-2xs mb-1"
            style={{ color: MODALITY_HEX.rgb }}
          >
            RGB (before → after)
          </div>
          <div className="flex gap-2">
            <img
              src={`./data/episode_19/rgb/${String(Math.max(0, Math.floor((tCenter - 1) * 10))).padStart(4, '0')}.png`}
              alt="before"
              className="w-16 h-16 rounded object-cover"
            />
            <span className="self-center text-text-disabled">→</span>
            <img
              src={`./data/episode_19/rgb/${String(Math.floor((tCenter + 0.5) * 10)).padStart(4, '0')}.png`}
              alt="after"
              className="w-16 h-16 rounded object-cover"
            />
          </div>
          <div className="text-text-disabled text-2xs mt-1">Nearly identical</div>
        </div>
        <div className="card-sunken p-3">
          <div
            className="font-mono text-2xs mb-1"
            style={{ color: MODALITY_HEX.proprio }}
          >
            TCP pose
          </div>
          <div className="text-text-disabled text-sm mt-2">Barely changes</div>
          <div className="font-mono text-2xs text-text-disabled mt-1">Δpos &lt; 1 mm</div>
        </div>
        <div className="card-sunken p-3 border border-modality-force/30">
          <div
            className="font-mono text-2xs mb-1"
            style={{ color: MODALITY_HEX.force }}
          >
            Fz
          </div>
          <div className="text-lg font-semibold" style={{ color: MODALITY_HEX.force }}>
            {fzBefore.toFixed(0)} N → {fzAfter.toFixed(0)} N
          </div>
          <div style={{ height: 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fzData.slice(Math.max(0, jumpIdx - 60), jumpIdx + 60)}>
                <YAxis domain={['auto', 'auto']} hide />
                <Line dataKey="v" stroke={MODALITY_HEX.force} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <ReferenceLine x={fzData[jumpIdx]?.t} stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="text-text-secondary text-sm italic font-display">
        "In the same 200 ms window, vision and proprioception barely change —
        but force jumps by {maxJump.toFixed(0)} N. This is why force matters."
      </p>
    </div>
  );
}

function SignalSandboxInner() {
  const { data, loading, error } = useEpisode();
  const { setDuration } = useTimeline();
  const [mutedTracks, setMutedTracks] = useState(new Set<string>());

  useEffect(() => {
    if (data) {
      setDuration(data.manifest.duration_s);
    }
  }, [data, setDuration]);

  const toggleMute = useCallback((key: string) => {
    setMutedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-sm text-text-secondary animate-pulse">
          Loading episode data…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card border-danger/30 text-danger font-mono text-sm">
        Error loading data: {error}
      </div>
    );
  }

  const fzData = data.forceTorque.t.map((t, i) => ({
    t,
    v: data.forceTorque.fz[i],
  }));

  return (
    <>
      <SignalStrip
        forceTorque={data.forceTorque}
        proprioception={data.proprioception}
        actions={data.actions}
        phases={data.annotations.phases}
        tracks={ALL_TRACKS}
        mutedTracks={mutedTracks}
      />

      <div className="mt-4">
        <TimelineScrubber phases={data.annotations.phases} />
      </div>

      <div className="mt-6">
        <StressMomentCard fzData={fzData} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHANNEL_LEGEND.map((ch) => (
          <ModalityChip
            key={ch.key}
            label={ch.label}
            color={ch.color}
            muted={mutedTracks.has(ch.key)}
            onClick={() => toggleMute(ch.key)}
          />
        ))}
      </div>
    </>
  );
}

export default function SignalSandbox() {
  return (
    <TimelineProvider>
      <div className="container-demo py-8">
        <div className="flex items-center gap-3 mb-2">
          <RegistrationMark />
          <span className="font-mono text-2xs text-text-disabled">01</span>
          <h1 className="section-title">Signal Sandbox</h1>
        </div>
        <p className="text-text-secondary text-sm mb-6">
          What do these signals actually look like, synchronized in time?
          Play the episode and watch how force, vision, and proprioception
          evolve together.
        </p>

        <div className="flex gap-2 mb-6">
          <PaperRef arxiv="2503.03998">Kang et al. 2025</PaperRef>
          <PaperRef arxiv="1812.07035">Zhou et al. 2019 (6D rotation)</PaperRef>
        </div>

        <SignalSandboxInner />

        {/* Data format sidebar */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-sunken">
            <div className="font-mono text-2xs text-text-tertiary mb-1">F/T SENSOR</div>
            <div className="font-mono text-2xs text-text-secondary space-y-0.5">
              <div>ATI SI-1500-240, 6-axis</div>
              <div>Raw 1 kHz → 30 Hz for policy I/O</div>
              <div>Fz convention: <span style={{ color: MODALITY_HEX.force }}>negative = into surface</span></div>
            </div>
          </div>
          <div className="card-sunken">
            <div className="font-mono text-2xs text-text-tertiary mb-1">TCP POSE</div>
            <div className="font-mono text-2xs text-text-secondary space-y-0.5">
              <div>9D = 3D position + 6D rotation</div>
              <div><EquationCallout tex="R \in \text{SO}(3) \to [r_1, r_2] \in \mathbb{R}^6" /></div>
              <div>Zhou et al. 2019 continuous repr.</div>
            </div>
          </div>
          <div className="card-sunken">
            <div className="font-mono text-2xs text-text-tertiary mb-1">ACTIONS</div>
            <div className="font-mono text-2xs text-text-secondary space-y-0.5">
              <div>7D delta: [dx,dy,dz,droll,dpitch,dyaw,Fz]</div>
              <div>Position + Euler delta + absolute Fz setpoint</div>
              <div>H=16 chunk, 8 executed</div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-text-tertiary text-sm no-talk">
          <p className="font-mono text-2xs mb-2">KEYBOARD</p>
          <p>
            Space = play/pause · ←→ = ±0.1s · [ ] = speed · Click channel
            chips to mute
          </p>
        </div>
      </div>
    </TimelineProvider>
  );
}
