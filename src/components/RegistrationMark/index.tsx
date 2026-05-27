export function RegistrationMark({ size = 20 }: { size?: number }) {
  const r = size / 2;
  const cross = size * 0.35;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className="opacity-30"
    >
      <circle cx={r} cy={r} r={r - 1} stroke="currentColor" strokeWidth={1} />
      <line
        x1={r}
        y1={r - cross}
        x2={r}
        y2={r + cross}
        stroke="currentColor"
        strokeWidth={0.8}
      />
      <line
        x1={r - cross}
        y1={r}
        x2={r + cross}
        y2={r}
        stroke="currentColor"
        strokeWidth={0.8}
      />
    </svg>
  );
}
