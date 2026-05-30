import type { ModalityKey } from './viz/colors';

export type DemoSection =
  | 'Foundations'
  | 'The Four Variants'
  | 'Advanced Architectures'
  | 'Behavior & Diagnostics'
  | 'Overview';

export interface DemoEntry {
  id: string;
  number: string;
  title: string;
  question: string;
  route: string;
  priority: 'P0' | 'P1' | 'P2';
  talkMinutes: string;
  accentModality: ModalityKey;
  section: DemoSection;
}

export const DEMOS: DemoEntry[] = [
  // ── Foundations ──
  {
    id: 'signal-sandbox',
    number: '01',
    title: 'Signal Sandbox',
    question: 'What do these signals actually look like, synchronized in time?',
    route: '/signal-sandbox',
    priority: 'P0',
    talkMinutes: '3–5 min',
    accentModality: 'force',
    section: 'Foundations',
  },
  {
    id: 'encoder-zoo',
    number: '02',
    title: 'Encoder Zoo',
    question: 'How does each raw signal become a token (or vector)?',
    route: '/encoder-zoo',
    priority: 'P0',
    talkMinutes: '5–8 min',
    accentModality: 'rgb',
    section: 'Foundations',
  },
  {
    id: 'fusion-playground',
    number: '03',
    title: 'Fusion Playground',
    question: 'Once you have tokens, how do you combine modalities?',
    route: '/fusion-playground',
    priority: 'P0',
    talkMinutes: '8–12 min',
    accentModality: 'proprio',
    section: 'Foundations',
  },
  // ── The Four Variants (Kang) ──
  {
    id: 'force-ladder',
    number: '08',
    title: 'The Force Integration Ladder',
    question: 'DP-B → DP-LF → DP-PF → DP-CA: why does cross-attention win by 57 points?',
    route: '/force-ladder',
    priority: 'P0',
    talkMinutes: '6–9 min',
    accentModality: 'force',
    section: 'The Four Variants',
  },
  {
    id: 'cross-attention',
    number: '09',
    title: 'Cross-Attention Probes',
    question: 'Force as queries: watch attention concentrate as contact builds.',
    route: '/cross-attention',
    priority: 'P0',
    talkMinutes: '8–12 min',
    accentModality: 'force',
    section: 'The Four Variants',
  },
  {
    id: 'architecture-diff',
    number: '04',
    title: 'Architecture Diff',
    question: 'Each model is one path through these fusion mechanisms. Diff them.',
    route: '/architecture-diff',
    priority: 'P0',
    talkMinutes: '6–10 min',
    accentModality: 'action',
    section: 'The Four Variants',
  },
  // ── Advanced Architectures ──
  {
    id: 'temporal-force',
    number: '12',
    title: 'Temporal Force',
    question: "FoAR's 30-step tape, sinusoidal PE, and the contact gate φ.",
    route: '/temporal-force',
    priority: 'P1',
    talkMinutes: '5–8 min',
    accentModality: 'force',
    section: 'Advanced Architectures',
  },
  {
    id: 'octo-tokenizer',
    number: '10',
    title: "Octo's Piano Roll",
    question: 'A continuous force trace becomes 256 discrete tokens.',
    route: '/octo-tokenizer',
    priority: 'P1',
    talkMinutes: '4–6 min',
    accentModality: 'action',
    section: 'Advanced Architectures',
  },
  {
    id: 'mmdit-quadrants',
    number: '11',
    title: 'DECO MMDiT Quadrants',
    question: 'Three differently-shaped pipes into one denoiser.',
    route: '/mmdit-quadrants',
    priority: 'P1',
    talkMinutes: '5–8 min',
    accentModality: 'proprio',
    section: 'Advanced Architectures',
  },
  // ── Behavior & Diagnostics ──
  {
    id: 'diffusion-denoising',
    number: '05',
    title: 'Force Prediction',
    question: 'Why does fusion matter behaviorally?',
    route: '/diffusion-denoising',
    priority: 'P1',
    talkMinutes: '4–6 min',
    accentModality: 'force',
    section: 'Behavior & Diagnostics',
  },
  {
    id: 'contact-gate',
    number: '06',
    title: 'Contact Gate',
    question: 'What does the contact gate fire on?',
    route: '/contact-gate',
    priority: 'P1',
    talkMinutes: '3–5 min',
    accentModality: 'torque',
    section: 'Behavior & Diagnostics',
  },
  {
    id: 'failure-modes',
    number: '07',
    title: 'Failure Modes',
    question: 'When force-aware models fail, why?',
    route: '/failure-modes',
    priority: 'P2',
    talkMinutes: '0–4 min',
    accentModality: 'depth',
    section: 'Behavior & Diagnostics',
  },
  // ── Overview ──
  {
    id: 'landscape',
    number: '13',
    title: 'The Landscape',
    question: 'Four philosophies for force integration, on two axes.',
    route: '/landscape',
    priority: 'P1',
    talkMinutes: '3–5 min',
    accentModality: 'force',
    section: 'Overview',
  },
];

export const SECTION_ORDER: DemoSection[] = [
  'Foundations',
  'The Four Variants',
  'Advanced Architectures',
  'Behavior & Diagnostics',
  'Overview',
];

export const SECTION_BLURB: Record<DemoSection, string> = {
  Foundations: 'Signals, encoders, and the fusion vocabulary.',
  'The Four Variants': "Kang et al.'s DP-B/LF/PF/CA ladder — the heart of the talk.",
  'Advanced Architectures': 'FoAR, Octo, and DECO take force-aware fusion further.',
  'Behavior & Diagnostics': 'What the models actually predict, and how they fail.',
  Overview: 'Where every approach sits in the design space.',
};
