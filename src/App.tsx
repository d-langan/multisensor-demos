import { Outlet, Link } from 'react-router-dom';
import { RegistrationMark } from './components/RegistrationMark';
import { TalkModeOverlay } from './components/TalkModeOverlay';
import { useTalkMode } from './lib/useTalkMode';

export function App() {
  const { active: isTalk } = useTalkMode();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border-subtle px-4 md:px-8 py-3 flex items-center gap-3 md:gap-4 bg-raised/50 backdrop-blur-sm sticky top-0 z-50 overflow-hidden">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <RegistrationMark size={18} />
          <span className="font-mono text-xs md:text-sm text-text-secondary tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
            MULTI-SENSOR LEARNING MODELS
          </span>
        </Link>
        <div className="flex-1" />
        <Link
          to="/about"
          className="font-mono text-2xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          ABOUT
        </Link>
        {isTalk && (
          <span className="font-mono text-2xs text-accent">TALK MODE</span>
        )}
      </header>

      <TalkModeOverlay />

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border-subtle px-8 py-4">
        <div className="container-demo flex items-center justify-between">
          <span className="font-mono text-2xs text-text-disabled">
            RPM Lab — UMN — Capstone Demo Site
          </span>
          <span className="font-mono text-2xs text-text-disabled">
            Press T for talk mode
          </span>
        </div>
      </footer>
    </div>
  );
}
