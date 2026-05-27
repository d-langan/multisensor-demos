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

  if (display) {
    return (
      <div className="overflow-x-auto my-2">
        <span
          ref={ref}
          className="block text-center text-text-secondary"
        />
      </div>
    );
  }

  return (
    <span
      ref={ref}
      className="inline text-text-secondary"
    />
  );
}
