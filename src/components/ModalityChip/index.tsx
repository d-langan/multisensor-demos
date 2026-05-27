import { MODALITY_HEX, type ModalityKey } from '../../lib/viz/colors';

interface ModalityChipProps {
  label: string;
  color: ModalityKey;
  muted?: boolean;
  onClick?: () => void;
}

export function ModalityChip({
  label,
  color,
  muted = false,
  onClick,
}: ModalityChipProps) {
  const hex = MODALITY_HEX[color];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-mono text-2xs px-2 py-0.5 rounded-full border transition-all ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${muted ? 'opacity-30' : 'opacity-100'}`}
      style={{
        borderColor: muted ? 'var(--border-subtle)' : hex,
        color: muted ? 'var(--text-disabled)' : hex,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: muted ? 'var(--text-disabled)' : hex }}
      />
      {label}
    </button>
  );
}
