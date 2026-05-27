import type { ModalityKey } from './viz/colors';

export interface DemoEntry {
  id: string;
  number: string;
  title: string;
  question: string;
  route: string;
  priority: 'P0' | 'P1' | 'P2';
  talkMinutes: string;
  accentModality: ModalityKey;
}

export const DEMOS: DemoEntry[] = [
  {
    id: 'signal-sandbox',
    number: '01',
    title: 'Signal Sandbox',
    question: 'What do these signals actually look like, synchronized in time?',
    route: '/signal-sandbox',
    priority: 'P0',
    talkMinutes: '3–5 min',
    accentModality: 'force',
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
  },
  {
    id: 'diffusion-denoising',
    number: '05',
    title: 'Diffusion Denoising',
    question: 'Why does fusion matter behaviorally?',
    route: '/diffusion-denoising',
    priority: 'P1',
    talkMinutes: '4–6 min',
    accentModality: 'force',
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
  },
];
