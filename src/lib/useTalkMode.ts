import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createElement } from 'react';

interface TalkModeState {
  active: boolean;
  toggle: () => void;
}

const TalkModeContext = createContext<TalkModeState>({
  active: false,
  toggle: () => {},
});

export function TalkModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('talk') === '1';
  });

  const toggle = useCallback(() => setActive((a) => !a), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === 't' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  useEffect(() => {
    document.documentElement.classList.toggle('talk-mode', active);
  }, [active]);

  return createElement(
    TalkModeContext.Provider,
    { value: { active, toggle } },
    children,
  );
}

export function useTalkMode(): TalkModeState {
  return useContext(TalkModeContext);
}
