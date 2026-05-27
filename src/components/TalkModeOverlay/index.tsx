import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTalkMode } from '../../lib/useTalkMode';
import { DEMOS } from '../../lib/demoRegistry';

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
        const next = currentIdx < DEMOS.length - 1 ? currentIdx + 1 : 0;
        navigate(DEMOS[next].route);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
        const prev = currentIdx > 0 ? currentIdx - 1 : DEMOS.length - 1;
        navigate(DEMOS[prev].route);
        e.preventDefault();
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
      {/* Demo counter */}
      {currentIdx >= 0 && (
        <div className="fixed top-3 right-20 z-50 font-mono text-2xs text-text-tertiary">
          {currentIdx + 1} / {DEMOS.length}
        </div>
      )}

      {/* Next demo hint */}
      {nextDemo && (
        <div className="fixed bottom-4 right-8 z-50 font-mono text-2xs text-text-disabled">
          next: {nextDemo.title} →
        </div>
      )}
    </>
  );
}
