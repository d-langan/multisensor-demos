import { useEffect, useState, useCallback } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';
import { SignalStrip, type TrackConfig } from '../../components/SignalStrip';
import { TimelineScrubber } from '../../components/TimelineScrubber';
import { TimelineProvider, useTimeline } from '../../lib/time/TimelineContext';
import { ModalityChip } from '../../components/ModalityChip';
import { PaperRef } from '../../components/PaperRef';
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
            RGB
          </div>
          <div className="text-text-disabled text-sm">Barely changes</div>
        </div>
        <div className="card-sunken p-3">
          <div
            className="font-mono text-2xs mb-1"
            style={{ color: MODALITY_HEX.proprio }}
          >
            TCP pose
          </div>
          <div className="text-text-disabled text-sm">Barely changes</div>
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

        <div className="mt-8 text-text-tertiary text-sm">
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
