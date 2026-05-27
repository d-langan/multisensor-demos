/**
 * Generates mock data for the multi-sensor demo site.
 * Run with: npx tsx scripts/generate_mock_data.ts
 *
 * Produces correctly-shaped synthetic JSON matching the real extraction schema.
 * The mock→real swap is a file replacement with zero component changes.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'public', 'data');

const META = {
  generated_from: 'mock_data_generator',
  extraction_script: 'scripts/generate_mock_data.ts',
  extracted_at: new Date().toISOString().slice(0, 10),
  git_sha: 'mock',
  schema_version: 1,
};

const FPS = 30;
const DURATION = 50; // ~50s for ep19
const N_FRAMES = FPS * DURATION;

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function noise(scale = 1) {
  return (Math.random() - 0.5) * 2 * scale;
}

// --- Episode manifest ---
function writeManifest() {
  const manifest = {
    _meta: META,
    fps_video: 10,
    fps_numeric: 30,
    n_frames: N_FRAMES,
    duration_s: DURATION,
    episode_index: 19,
    dataset: 'local/kuka_grinding_v6',
  };
  writeFileSync(
    join(OUT, 'episode_19', 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
}

// --- Force/Torque data ---
// Realistic profile: approach (low force) → contact transient → grinding → retract
function generateForceTorque() {
  const t: number[] = [];
  const fx: number[] = [];
  const fy: number[] = [];
  const fz: number[] = [];
  const tx: number[] = [];
  const ty: number[] = [];
  const tz: number[] = [];

  const contactStart = 14; // seconds
  const grindStart = 16;
  const grindEnd = 40;
  const retractStart = 42;

  for (let i = 0; i < N_FRAMES; i++) {
    const time = i / FPS;
    t.push(Number(time.toFixed(4)));

    let baseFz: number;
    if (time < contactStart) {
      // Approach: near zero force
      baseFz = noise(2);
    } else if (time < grindStart) {
      // Contact transient: rapid ramp to grinding force
      const prog = (time - contactStart) / (grindStart - contactStart);
      baseFz = lerp(0, -35, prog) + noise(3);
    } else if (time < grindEnd) {
      // Grinding: oscillating around setpoint
      baseFz =
        -30 + 5 * Math.sin(time * 0.8) + 3 * Math.sin(time * 2.3) + noise(2);
    } else if (time < retractStart) {
      // Retract ramp
      const prog = (time - grindEnd) / (retractStart - grindEnd);
      baseFz = lerp(-30, 0, prog) + noise(2);
    } else {
      baseFz = noise(1.5);
    }

    fz.push(Number(baseFz.toFixed(2)));
    fx.push(Number((noise(5) + (time > contactStart && time < grindEnd ? 8 : 0)).toFixed(2)));
    fy.push(Number((noise(4) + (time > contactStart && time < grindEnd ? -5 : 0)).toFixed(2)));
    tx.push(Number((noise(0.5)).toFixed(3)));
    ty.push(Number((noise(0.3)).toFixed(3)));
    tz.push(Number((noise(0.2)).toFixed(3)));
  }

  const data = { _meta: META, t, fx, fy, fz, tx, ty, tz };
  writeFileSync(
    join(OUT, 'episode_19', 'force_torque.json'),
    JSON.stringify(data),
  );
  return { t, fz };
}

// --- Proprioception ---
function generateProprioception() {
  const t: number[] = [];
  const px: number[] = [];
  const py: number[] = [];
  const pz: number[] = [];
  const rot6d: number[][] = [];

  for (let i = 0; i < N_FRAMES; i++) {
    const time = i / FPS;
    t.push(Number(time.toFixed(4)));

    // Smooth TCP trajectory
    const phase = time / DURATION;
    px.push(Number((2.0 + 0.1 * Math.sin(phase * Math.PI * 3) + noise(0.001)).toFixed(4)));
    py.push(Number((0.4 + 0.2 * phase + 0.05 * Math.sin(phase * Math.PI * 5) + noise(0.001)).toFixed(4)));

    // Z descends during contact
    let z: number;
    if (time < 14) z = 1.2 + noise(0.001);
    else if (time < 16) z = lerp(1.2, 0.82, (time - 14) / 2) + noise(0.001);
    else if (time < 40) z = 0.82 + 0.01 * Math.sin(time * 0.5) + noise(0.001);
    else if (time < 42) z = lerp(0.82, 1.2, (time - 40) / 2) + noise(0.001);
    else z = 1.2 + noise(0.001);
    pz.push(Number(z.toFixed(4)));

    // 6D rotation: first two columns of identity + small perturbation
    rot6d.push([
      1 + noise(0.001), noise(0.001), noise(0.001),
      noise(0.001), 1 + noise(0.001), noise(0.001),
    ]);
  }

  const data = { _meta: META, t, px, py, pz, rot6d };
  writeFileSync(
    join(OUT, 'episode_19', 'proprioception.json'),
    JSON.stringify(data),
  );
}

// --- Actions ---
function generateActions() {
  const t: number[] = [];
  const dx: number[] = [];
  const dy: number[] = [];
  const dz: number[] = [];
  const droll: number[] = [];
  const dpitch: number[] = [];
  const dyaw: number[] = [];
  const fzArr: number[] = [];

  for (let i = 0; i < N_FRAMES; i++) {
    const time = i / FPS;
    t.push(Number(time.toFixed(4)));

    dx.push(Number(noise(0.002).toFixed(5)));
    dy.push(Number(noise(0.002).toFixed(5)));
    dz.push(Number(noise(0.002).toFixed(5)));
    droll.push(Number(noise(0.005).toFixed(5)));
    dpitch.push(Number(noise(0.005).toFixed(5)));
    dyaw.push(Number(noise(0.003).toFixed(5)));

    // Fz setpoint: ~-30N during contact
    const inContact = time > 14 && time < 42;
    fzArr.push(Number((inContact ? -30 + noise(3) : noise(2)).toFixed(2)));
  }

  const data = {
    _meta: META,
    t,
    dx,
    dy,
    dz,
    droll,
    dpitch,
    dyaw,
    fz: fzArr,
  };
  writeFileSync(
    join(OUT, 'episode_19', 'actions.json'),
    JSON.stringify(data),
  );
}

// --- Annotations ---
function writeAnnotations() {
  const data = {
    _meta: META,
    phases: [
      { label: 'approach', t_start: 0.0, t_end: 14.0 },
      { label: 'contact', t_start: 14.0, t_end: 42.0 },
      { label: 'retract', t_start: 42.0, t_end: 50.0 },
    ],
    contact_threshold_N: 5.0,
    fz_setpoint_N: -30.0,
  };
  writeFileSync(
    join(OUT, 'episode_19', 'annotations.json'),
    JSON.stringify(data, null, 2),
  );
}

// --- Model predictions (B1, M3, M4) ---
function generatePredictions() {
  const models = [
    { id: 'b1', fzError: 25, posError: 0.008 },
    { id: 'm3', fzError: 4, posError: 0.001 },
    { id: 'm4', fzError: 5, posError: 0.0005 },
  ];

  for (const model of models) {
    const predictions: Array<{
      t: number;
      predicted_chunk: number[][];
      executed: number[];
    }> = [];

    for (let i = 0; i < N_FRAMES; i += 16) {
      const time = i / FPS;
      const chunk: number[][] = [];
      const inContact = time > 14 && time < 42;

      for (let h = 0; h < 16; h++) {
        chunk.push([
          noise(model.posError),
          noise(model.posError),
          noise(model.posError),
          noise(0.005),
          noise(0.005),
          noise(0.003),
          inContact ? -30 + noise(model.fzError) : noise(model.fzError * 0.3),
        ]);
      }

      predictions.push({
        t: Number(time.toFixed(4)),
        predicted_chunk: chunk,
        executed: chunk[0],
      });
    }

    const data = {
      _meta: META,
      model: model.id,
      predictions,
    };
    writeFileSync(
      join(OUT, 'model_predictions', `${model.id}.json`),
      JSON.stringify(data),
    );
  }
}

// --- Attention maps ---
function generateAttention() {
  // B4 cross-attention: 6 force queries × 49 image KV tokens
  const b4Samples = [];
  const tSamples = [1.0, 5.0, 10.0, 14.5, 16.0, 20.0, 25.0, 35.0, 42.0, 48.0];

  for (const t of tSamples) {
    const inContact = t > 14 && t < 42;
    const weights: number[][] = [];
    for (let q = 0; q < 6; q++) {
      const row: number[] = [];
      for (let k = 0; k < 49; k++) {
        // During contact, attention is more focused; during approach, more uniform
        let w = Math.random();
        if (inContact) {
          // Focus attention on center spatial tokens
          const kx = k % 7;
          const ky = Math.floor(k / 7);
          const dist = Math.sqrt((kx - 3) ** 2 + (ky - 3) ** 2);
          w = Math.exp(-dist * 0.5) + noise(0.1);
        }
        row.push(Number(Math.max(0, w).toFixed(4)));
      }
      // Normalize to sum to 1
      const sum = row.reduce((a, b) => a + b, 0);
      weights.push(row.map((v) => Number((v / sum).toFixed(4))));
    }
    b4Samples.push({
      t,
      phase: t < 14 ? 'approach' : t < 42 ? 'contact' : 'retract',
      weights,
    });
  }

  writeFileSync(
    join(OUT, 'attention_maps', 'b4_crossattn.json'),
    JSON.stringify({
      _meta: META,
      model: 'b4',
      module: 'VisionForceCA.cross_attn',
      t_samples: tSamples,
      attention: b4Samples,
    }),
  );

  // FoAR Force Transformer self-attention: 30×30
  const foarSamples = [];
  for (const t of tSamples) {
    const weights: number[][] = [];
    for (let i = 0; i < 30; i++) {
      const row: number[] = [];
      for (let j = 0; j < 30; j++) {
        // Temporal attention: nearby timesteps attend more strongly
        const dist = Math.abs(i - j);
        row.push(Number((Math.exp(-dist * 0.3) + noise(0.05)).toFixed(4)));
      }
      const sum = row.reduce((a, b) => a + Math.max(0, b), 0);
      weights.push(row.map((v) => Number((Math.max(0, v) / sum).toFixed(4))));
    }
    foarSamples.push({
      t,
      phase: t < 14 ? 'approach' : t < 42 ? 'contact' : 'retract',
      weights,
    });
  }

  writeFileSync(
    join(OUT, 'attention_maps', 'foar_force_transformer.json'),
    JSON.stringify({
      _meta: META,
      model: 'm3',
      module: 'ForceTransformer.self_attn',
      t_samples: tSamples,
      attention: foarSamples,
    }),
  );

  // DECO cross-attention adapter: simplified
  const decoSamples = [];
  for (const t of tSamples) {
    const weights: number[][] = [];
    for (let i = 0; i < 16; i++) {
      const row: number[] = [];
      for (let j = 0; j < 6; j++) {
        row.push(Number((Math.random()).toFixed(4)));
      }
      const sum = row.reduce((a, b) => a + b, 0);
      weights.push(row.map((v) => Number((v / sum).toFixed(4))));
    }
    decoSamples.push({
      t,
      phase: t < 14 ? 'approach' : t < 42 ? 'contact' : 'retract',
      weights,
    });
  }

  writeFileSync(
    join(OUT, 'attention_maps', 'deco_xattn.json'),
    JSON.stringify({
      _meta: META,
      model: 'm2',
      module: 'DECOBlock.adapter_xattn',
      t_samples: tSamples,
      attention: decoSamples,
    }),
  );
}

// --- Generate placeholder RGB frames ---
function generatePlaceholderFrames() {
  // We won't generate real PNGs here — just a manifest note
  // Real frames come from extract_episode.py
  // For dev, the SignalStrip will show a "no image" placeholder
  console.log(
    'Note: RGB/depth/normal PNGs are not generated by mock data.',
  );
  console.log(
    'Run scripts/extract_episode.py in the capstone conda env for real frames.',
  );
}

// --- Main ---
function main() {
  console.log('Generating mock data for multi-sensor demo site...');

  ensureDir(join(OUT, 'episode_19', 'rgb'));
  ensureDir(join(OUT, 'episode_19', 'depth'));
  ensureDir(join(OUT, 'episode_19', 'normals'));
  ensureDir(join(OUT, 'model_predictions'));
  ensureDir(join(OUT, 'attention_maps'));
  ensureDir(join(OUT, 'feature_maps'));

  writeManifest();
  console.log('  ✓ manifest.json');

  generateForceTorque();
  console.log('  ✓ force_torque.json');

  generateProprioception();
  console.log('  ✓ proprioception.json');

  generateActions();
  console.log('  ✓ actions.json');

  writeAnnotations();
  console.log('  ✓ annotations.json');

  generatePredictions();
  console.log('  ✓ model_predictions/ (b1, m3, m4)');

  generateAttention();
  console.log('  ✓ attention_maps/ (b4, foar, deco)');

  generatePlaceholderFrames();

  console.log('\nDone. Mock data written to public/data/');
}

main();
