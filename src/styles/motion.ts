import type { Variants, Transition } from 'framer-motion';

export const fusionArrowSpring: Transition = {
  type: 'spring',
  stiffness: 80,
  damping: 14,
};

export const diagramHover: Transition = {
  duration: 0.12,
  ease: 'easeOut',
};

export const crossfade: Transition = {
  duration: 0.15,
  ease: 'easeInOut',
};

export const heatmapInterp: Transition = {
  duration: 0.2,
  ease: 'easeInOut',
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: crossfade },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

export const staggerChildren: Variants = {
  visible: {
    transition: { staggerChildren: 0.03 },
  },
};

export const tokenSlide: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: fusionArrowSpring,
  },
};
