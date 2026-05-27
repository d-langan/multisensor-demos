#!/usr/bin/env python3
"""Extract episode 19 from kuka_grinding_v6 into demo site JSON + PNG.

Run: conda run -n grinding_fusion_312 python scripts/extract_episode.py

Phase detection uses |F| = L2 norm of (Fx, Fy, Fz), NOT |Fz| alone.
This matches torch.norm(raw_ft[:, :3]) in the M1 ContactGate.
"""

import json
import subprocess
from pathlib import Path

import numpy as np
import torch
from PIL import Image

DATASET = "local/kuka_grinding_v6"
EPISODE = 19
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "episode_19"
FPS = 30
SCHEMA_VERSION = 1

# Phase detection thresholds (from ContactGate)
ENGAGE_N = 5.0
DISENGAGE_N = 2.5
MA_WINDOW = 5  # 5-frame moving average before thresholding


def get_git_sha():
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=Path(__file__).parent.parent)
            .decode()
            .strip()[:12]
        )
    except Exception:
        return "unknown"


def make_meta(script_name: str) -> dict:
    return {
        "generated_from": f"{DATASET}/episode_{EPISODE}",
        "extraction_script": script_name,
        "extracted_at": __import__("datetime").date.today().isoformat(),
        "git_sha": get_git_sha(),
        "schema_version": SCHEMA_VERSION,
    }


def moving_average(arr: np.ndarray, window: int) -> np.ndarray:
    kernel = np.ones(window) / window
    return np.convolve(arr, kernel, mode="same")


def detect_phases(force_mag: np.ndarray, timestamps: np.ndarray) -> list[dict]:
    smoothed = moving_average(force_mag, MA_WINDOW)

    # Use a sustained-contact detector: find the first window of 15+ consecutive
    # frames (0.5s) above threshold, and last such window below threshold.
    engaged = False
    contact_start = None
    contact_end = None
    consecutive_above = 0
    consecutive_below = 0

    for i, f in enumerate(smoothed):
        if not engaged:
            if f > ENGAGE_N:
                consecutive_above += 1
                if consecutive_above >= 15:
                    engaged = True
                    contact_start = timestamps[i - 14]
            else:
                consecutive_above = 0
        else:
            if f < DISENGAGE_N:
                consecutive_below += 1
                if consecutive_below >= 15:
                    engaged = False
                    contact_end = timestamps[i - 14]
            else:
                consecutive_below = 0

    if contact_start is None:
        contact_start = timestamps[len(timestamps) // 3]
    if contact_end is None:
        contact_end = timestamps[2 * len(timestamps) // 3]

    return [
        {"label": "approach", "t_start": round(float(timestamps[0]), 4), "t_end": round(float(contact_start), 4)},
        {"label": "contact", "t_start": round(float(contact_start), 4), "t_end": round(float(contact_end), 4)},
        {"label": "retract", "t_start": round(float(contact_end), 4), "t_end": round(float(timestamps[-1]), 4)},
    ]


def main():
    from lerobot.datasets.lerobot_dataset import LeRobotDataset

    print(f"Loading {DATASET}...")
    ds = LeRobotDataset(DATASET)

    ep_meta = ds.meta.episodes.to_pandas()
    ep = ep_meta[ep_meta["episode_index"] == EPISODE]
    from_idx = int(ep["dataset_from_index"].iloc[0])
    to_idx = int(ep["dataset_to_index"].iloc[0])
    n_frames = to_idx - from_idx
    duration = n_frames / FPS

    print(f"Episode {EPISODE}: {n_frames} frames, {duration:.1f}s")

    # Allocate arrays
    timestamps = np.zeros(n_frames)
    fx = np.zeros(n_frames)
    fy = np.zeros(n_frames)
    fz = np.zeros(n_frames)
    tx = np.zeros(n_frames)
    ty = np.zeros(n_frames)
    tz = np.zeros(n_frames)
    px = np.zeros(n_frames)
    py = np.zeros(n_frames)
    pz = np.zeros(n_frames)
    rot6d = np.zeros((n_frames, 6))
    act_dx = np.zeros(n_frames)
    act_dy = np.zeros(n_frames)
    act_dz = np.zeros(n_frames)
    act_droll = np.zeros(n_frames)
    act_dpitch = np.zeros(n_frames)
    act_dyaw = np.zeros(n_frames)
    act_fz = np.zeros(n_frames)

    # Ensure output dirs
    rgb_dir = OUT / "rgb"
    rgb_dir.mkdir(parents=True, exist_ok=True)

    print("Extracting frames...")
    for local_i in range(n_frames):
        global_i = from_idx + local_i
        sample = ds[global_i]

        t = local_i / FPS
        timestamps[local_i] = t

        ft = sample["observation.force_torque"].numpy()
        fx[local_i], fy[local_i], fz[local_i] = ft[0], ft[1], ft[2]
        tx[local_i], ty[local_i], tz[local_i] = ft[3], ft[4], ft[5]

        state = sample["observation.state"].numpy()
        px[local_i], py[local_i], pz[local_i] = state[0], state[1], state[2]
        rot6d[local_i] = state[3:9]

        action = sample["action"].numpy()
        act_dx[local_i] = action[0]
        act_dy[local_i] = action[1]
        act_dz[local_i] = action[2]
        act_droll[local_i] = action[3]
        act_dpitch[local_i] = action[4]
        act_dyaw[local_i] = action[5]
        act_fz[local_i] = action[6]

        # Save every 3rd frame as RGB PNG (10 Hz)
        if local_i % 3 == 0:
            img_tensor = sample["observation.images.scene"]  # (3, 224, 224) float [0,1]
            img_np = (img_tensor.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
            img = Image.fromarray(img_np)
            img.save(rgb_dir / f"{local_i // 3:04d}.png", optimize=True)

        if local_i % 200 == 0:
            print(f"  {local_i}/{n_frames} ({100*local_i/n_frames:.0f}%)")

    print(f"  {n_frames}/{n_frames} (100%)")

    meta = make_meta("scripts/extract_episode.py")

    # Force magnitude for phase detection: L2 norm of (Fx, Fy, Fz)
    force_mag = np.sqrt(fx**2 + fy**2 + fz**2)
    phases = detect_phases(force_mag, timestamps)

    # Round arrays for JSON compactness
    def r2(a):
        return [round(float(v), 2) for v in a]

    def r4(a):
        return [round(float(v), 4) for v in a]

    def r5(a):
        return [round(float(v), 5) for v in a]

    # Write manifest
    manifest = {
        "_meta": meta,
        "fps_video": 10,
        "fps_numeric": 30,
        "n_frames": n_frames,
        "duration_s": round(duration, 4),
        "episode_index": EPISODE,
        "dataset": DATASET,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("✓ manifest.json")

    # Write force_torque.json
    ft_data = {"_meta": meta, "t": r4(timestamps), "fx": r2(fx), "fy": r2(fy), "fz": r2(fz), "tx": r2(tx), "ty": r2(ty), "tz": r2(tz)}
    (OUT / "force_torque.json").write_text(json.dumps(ft_data))
    print("✓ force_torque.json")

    # Write proprioception.json
    proprio_data = {
        "_meta": meta,
        "t": r4(timestamps),
        "px": r4(px),
        "py": r4(py),
        "pz": r4(pz),
        "rot6d": [[round(float(v), 4) for v in row] for row in rot6d],
    }
    (OUT / "proprioception.json").write_text(json.dumps(proprio_data))
    print("✓ proprioception.json")

    # Write actions.json
    actions_data = {
        "_meta": meta,
        "t": r4(timestamps),
        "dx": r5(act_dx),
        "dy": r5(act_dy),
        "dz": r5(act_dz),
        "droll": r5(act_droll),
        "dpitch": r5(act_dpitch),
        "dyaw": r5(act_dyaw),
        "fz": r2(act_fz),
    }
    (OUT / "actions.json").write_text(json.dumps(actions_data))
    print("✓ actions.json")

    # Write annotations.json
    annotations = {
        "_meta": meta,
        "phases": phases,
        "contact_threshold_N": ENGAGE_N,
        "fz_setpoint_N": -30.0,
    }
    (OUT / "annotations.json").write_text(json.dumps(annotations, indent=2))
    phase_desc = ", ".join(f"{p['label']} {p['t_start']:.1f}-{p['t_end']:.1f}s" for p in phases)
    print(f"✓ annotations.json (phases: {phase_desc})")

    # Summary
    n_images = len(list(rgb_dir.glob("*.png")))
    total_kb = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1024
    print(f"\nDone: {n_frames} frames, {n_images} RGB PNGs, {total_kb:.0f} KB total")


if __name__ == "__main__":
    main()
