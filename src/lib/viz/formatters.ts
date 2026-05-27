export function formatForce(n: number): string {
  return `${n.toFixed(1)} N`;
}

export function formatTorque(nm: number): string {
  return `${nm.toFixed(2)} Nm`;
}

export function formatMm(m: number): string {
  return `${(m * 1000).toFixed(1)} mm`;
}

export function formatDeg(rad: number): string {
  return `${((rad * 180) / Math.PI).toFixed(2)}°`;
}

export function formatTime(s: number): string {
  return `${s.toFixed(2)}s`;
}
