import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface EquationCalloutProps {
  tex: string;
  display?: boolean;
}

export function EquationCallout({ tex, display = false }: EquationCalloutProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
        trust: true,
      });
    }
  }, [tex, display]);

  return (
    <span
      ref={ref}
      className={`${display ? 'block text-center my-2' : 'inline'} text-text-secondary`}
    />
  );
}
