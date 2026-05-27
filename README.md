# Multi-Sensor Learning Models — Interactive Demo Site

Interactive visualization of 10 force-aware imitation learning architectures (B1–B5, M1–M5) for aerospace grinding on a KUKA KR 500. Built for the RPM Lab group at UMN.

## Quick Start

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # static dist/
```

## Demos

| # | Demo | Route | Priority |
|---|------|-------|----------|
| 01 | Signal Sandbox | `/#/signal-sandbox` | P0 |
| 02 | Encoder Zoo | `/#/encoder-zoo` | P0 |
| 03 | Fusion Playground | `/#/fusion-playground` | P0 |
| 04 | Architecture Diff | `/#/architecture-diff` | P0 |
| 05 | Force Prediction | `/#/diffusion-denoising` | P1 |
| 06 | Contact Gate | `/#/contact-gate` | P1 |
| 07 | Failure Modes | `/#/failure-modes` | P2 |

## Talk Mode

Press `T` or add `?talk=1` to the URL. Arrow keys navigate between demos. Font sizes increase 25%. Decorative motion freezes.

## Regenerating Data

Mock data (currently in use):
```bash
npx tsx scripts/generate_mock_data.ts
```

Real data extraction (requires capstone conda env):
```bash
conda activate grinding_fusion_312
python scripts/extract_episode.py      # episode 19 from kuka_grinding_v6
python scripts/extract_predictions.py  # B1, M3, M4 inference
python scripts/extract_attention.py    # B4, FoAR, DECO attention maps
```

## Tech Stack

Vite 8 + React 19 + TypeScript + Tailwind 3 + Framer Motion + Recharts + D3 + KaTeX
