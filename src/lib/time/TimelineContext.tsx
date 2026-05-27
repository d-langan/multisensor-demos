import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2;

interface TimelineState {
  currentTime: number;
  setCurrentTime: (t: number) => void;
  playing: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  speed: PlaybackSpeed;
  setSpeed: (s: PlaybackSpeed) => void;
  duration: number;
  setDuration: (d: number) => void;
}

const TimelineContext = createContext<TimelineState>({
  currentTime: 0,
  setCurrentTime: () => {},
  playing: false,
  play: () => {},
  pause: () => {},
  togglePlay: () => {},
  speed: 1,
  setSpeed: () => {},
  duration: 0,
  setDuration: () => {},
});

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTimeRaw] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [duration, setDuration] = useState(0);

  const timeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const durationRef = useRef(duration);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  timeRef.current = currentTime;
  playingRef.current = playing;
  speedRef.current = speed;
  durationRef.current = duration;

  const setCurrentTime = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(t, durationRef.current));
    setCurrentTimeRaw(clamped);
    timeRef.current = clamped;
  }, []);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastFrameRef.current = performance.now();

    function tick(now: number) {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      if (playingRef.current && durationRef.current > 0) {
        let next = timeRef.current + dt * speedRef.current;
        if (next >= durationRef.current) {
          next = 0;
        }
        setCurrentTimeRaw(next);
        timeRef.current = next;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime(timeRef.current - 0.1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime(timeRef.current + 0.1);
          break;
        case '[':
          setSpeed(
            Math.max(0.25, speedRef.current / 2) as PlaybackSpeed,
          );
          break;
        case ']':
          setSpeed(
            Math.min(2, speedRef.current * 2) as PlaybackSpeed,
          );
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCurrentTime, togglePlay]);

  return (
    <TimelineContext.Provider
      value={{
        currentTime,
        setCurrentTime,
        playing,
        play,
        pause,
        togglePlay,
        speed,
        setSpeed,
        duration,
        setDuration,
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  return useContext(TimelineContext);
}
