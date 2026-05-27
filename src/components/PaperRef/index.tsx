import { ExternalLink } from 'lucide-react';

interface PaperRefProps {
  arxiv?: string;
  children: React.ReactNode;
}

export function PaperRef({ arxiv, children }: PaperRefProps) {
  if (!arxiv) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-2xs text-text-tertiary border border-border-subtle rounded px-1.5 py-0.5">
        {children}
      </span>
    );
  }

  return (
    <a
      href={`https://arxiv.org/abs/${arxiv}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-2xs text-accent border border-accent/30 rounded px-1.5 py-0.5 hover:bg-accent/10 transition-colors no-underline"
    >
      {children}
      <ExternalLink size={10} />
    </a>
  );
}
