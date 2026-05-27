import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTalkMode } from '../../lib/useTalkMode';
import { DEMOS } from '../../lib/demoRegistry';
import { ChevronRight } from 'lucide-react';

export function TalkModeOverlay() {
  const { active } = useTalkMode();
  const navigate = useNavigate();
  const location = useLocation();

  const currentIdx = useMemo(() => {
    const path = location.pathname.replace(/^\//, '');
    return DEMOS.findIndex((d) => d.route.replace(/^\//, '') === path);
  }, [location.pathname]);

  useEffect(() => {
    if (!active) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault();
        if (currentIdx < 0) {
          navigate(DEMOS[0].route);
        } else {
          const next = currentIdx < DEMOS.length - 1 ? currentIdx + 1 : 0;
          navigate(DEMOS[next].route);
        }
      } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault();
        if (currentIdx < 0) {
          navigate(DEMOS[DEMOS.length - 1].route);
        } else {
          const prev = currentIdx > 0 ? currentIdx - 1 : DEMOS.length - 1;
          navigate(DEMOS[prev].route);
        }
      } else if (e.key === 'Escape') {
        navigate('/');
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, currentIdx, navigate]);

  if (!active) return null;

  const nextDemo = currentIdx < DEMOS.length - 1 ? DEMOS[currentIdx + 1] : null;

  return (
    <>
      {/* Progress bar at very top */}
      {currentIdx >= 0 && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-[60] bg-sunken">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / DEMOS.length) * 100}%` }}
          />
        </div>
      )}

      {/* Demo counter */}
      {currentIdx >= 0 && (
        <div className="fixed top-3 right-24 z-[60] font-mono text-xs text-text-tertiary bg-raised/80 backdrop-blur-sm px-2 py-0.5 rounded border border-border-subtle">
          {currentIdx + 1} / {DEMOS.length}
        </div>
      )}

      {/* Next demo hint */}
      {nextDemo && (
        <div className="fixed bottom-6 right-8 z-[60] font-mono text-xs text-text-disabled flex items-center gap-1 bg-raised/80 backdrop-blur-sm px-3 py-1.5 rounded border border-border-subtle">
          next: {nextDemo.title}
          <ChevronRight size={12} />
        </div>
      )}

      {/* Keyboard hint on home page */}
      {currentIdx < 0 && (
        <div className="fixed bottom-6 right-8 z-[60] font-mono text-xs text-accent bg-raised/80 backdrop-blur-sm px-3 py-1.5 rounded border border-accent/30">
          Press → to start · Esc to exit talk mode
        </div>
      )}
    </>
  );
}
