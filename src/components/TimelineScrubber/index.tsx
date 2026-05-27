import { useRef, useCallback } from 'react';
import { useTimeline, type PlaybackSpeed } from '../../lib/time/TimelineContext';
import type { Phase } from '../../lib/data/types';
import { PHASE_HEX } from '../../lib/viz/colors';
import { Play, Pause, SkipBack } from 'lucide-react';

const SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2];

interface TimelineScrubberProps {
  phases?: Phase[];
}

export function TimelineScrubber({ phases }: TimelineScrubberProps) {
  const {
    currentTime,
    setCurrentTime,
    playing,
    togglePlay,
    speed,
    setSpeed,
    duration,
  } = useTimeline();

  const trackRef = useRef<HTMLDivElement>(null);

  const scrub = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!trackRef.current || duration <= 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setCurrentTime((x / rect.width) * duration);
    },
    [duration, setCurrentTime],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      scrub(e);
      const onMove = (ev: MouseEvent) => scrub(ev);
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [scrub],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-2 py-2 bg-raised border border-border-subtle rounded-lg">
      <button
        onClick={() => setCurrentTime(0)}
        className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
        title="Reset"
      >
        <SkipBack size={14} />
      </button>

      <button
        onClick={togglePlay}
        className="p-1.5 bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
        title={playing ? 'Pause (space)' : 'Play (space)'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        className="flex-1 h-6 relative cursor-pointer group"
      >
        {/* Phase underlay */}
        {phases && duration > 0 && (
          <div className="absolute inset-0 rounded overflow-hidden">
            {phases.map((phase) => {
              const left = (phase.t_start / duration) * 100;
              const width =
                ((phase.t_end - phase.t_start) / duration) * 100;
              return (
                <div
                  key={`${phase.label}-${phase.t_start}`}
                  className="absolute top-0 bottom-0 opacity-20"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor:
                      PHASE_HEX[phase.label as keyof typeof PHASE_HEX],
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Track background */}
        <div className="absolute inset-0 bg-sunken rounded border border-border-subtle" />

        {/* Progress fill */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-accent/30 rounded-l"
          style={{ width: `${progress}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent group-hover:w-1 transition-all"
          style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Time display */}
      <span className="font-mono text-2xs text-text-secondary w-20 text-right tabular-nums">
        {currentTime.toFixed(2)}s / {duration.toFixed(1)}s
      </span>

      {/* Speed selector */}
      <div className="flex gap-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`font-mono text-2xs px-1.5 py-0.5 rounded transition-colors ${
              speed === s
                ? 'bg-accent/20 text-accent'
                : 'text-text-disabled hover:text-text-secondary'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
