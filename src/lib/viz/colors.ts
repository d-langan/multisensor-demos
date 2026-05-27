export const MODALITY_COLORS = {
  rgb: 'var(--color-rgb)',
  depth: 'var(--color-depth)',
  normals: 'var(--color-normals)',
  force: 'var(--color-force)',
  torque: 'var(--color-torque)',
  proprio: 'var(--color-proprio)',
  action: 'var(--color-action)',
  pc: 'var(--color-pc)',
} as const;

export const MODALITY_HEX = {
  rgb: '#4ade80',
  depth: '#a78bfa',
  normals: '#c4b5fd',
  force: '#fb923c',
  torque: '#e879f9',
  proprio: '#60a5fa',
  action: '#fbbf24',
  pc: '#22d3ee',
} as const;

export const PHASE_COLORS = {
  approach: 'var(--phase-approach)',
  contact: 'var(--phase-contact)',
  retract: 'var(--phase-retract)',
} as const;

export const PHASE_HEX = {
  approach: '#60a5fa',
  contact: '#fb923c',
  retract: '#a78bfa',
} as const;

export type ModalityKey = keyof typeof MODALITY_COLORS;
export type PhaseKey = keyof typeof PHASE_COLORS;
