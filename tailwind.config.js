/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        raised: 'var(--bg-raised)',
        sunken: 'var(--bg-sunken)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-disabled': 'var(--text-disabled)',
        modality: {
          rgb: 'var(--color-rgb)',
          depth: 'var(--color-depth)',
          normals: 'var(--color-normals)',
          force: 'var(--color-force)',
          torque: 'var(--color-torque)',
          proprio: 'var(--color-proprio)',
          action: 'var(--color-action)',
          pc: 'var(--color-pc)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        phase: {
          approach: 'var(--phase-approach)',
          contact: 'var(--phase-contact)',
          retract: 'var(--phase-retract)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      fontSize: {
        '2xs': 'var(--text-2xs)',
      },
      maxWidth: {
        demo: '1280px',
      },
    },
  },
  plugins: [],
};
