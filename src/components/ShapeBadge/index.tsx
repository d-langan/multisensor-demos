interface ShapeBadgeProps {
  dims: (string | number)[];
}

export function ShapeBadge({ dims }: ShapeBadgeProps) {
  return (
    <span className="inline-flex font-mono text-2xs text-text-tertiary border border-border-subtle rounded px-1.5 py-0.5 tracking-tight">
      ({dims.join(', ')})
    </span>
  );
}
