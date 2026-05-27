#!/usr/bin/env python3
"""Extract model predictions on episode 19 for the demo site.

Run: conda run -n grinding_fusion_312 python scripts/extract_predictions.py

Runs B1, M3, M4 on episode 19 observations and saves predicted action chunks.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

import numpy as np
import torch

DATASET = "local/kuka_grinding_v6"
EPISODE = 19
FPS = 30
SCHEMA_VERSION = 1
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "model_predictions"

# Capstone root (parent of lerobot_policy_*) must be on path for plugin imports
CAPSTONE = Path(__file__).resolve().parent.parent.parent.parent / "grinding_capstone"
sys.path.insert(0, str(CAPSTONE))
sys.path.insert(0, str(CAPSTONE / "scripts"))

MODELS = {
    "b1": {
        "checkpoint": "/data/grinding_capstone/checkpoints/baselines/b1_dp_b/checkpoints/100000/pretrained_model",
        "policy_type": "diffusion",
        "dataset_for_stats": "local/kuka_grinding_v6",
    },
    "m3": {
        "checkpoint": "/data/grinding_capstone/checkpoints/models/m3_foar/checkpoints/last/pretrained_model",
        "policy_type": "foar",
        "dataset_for_stats": "local/kuka_grinding_v6",
    },
    "m4": {
        "checkpoint": "/data/grinding_capstone/checkpoints/models/m4_octo/checkpoints/005000/pretrained_model",
        "policy_type": "octo_wrapper",
        "dataset_for_stats": "local/kuka_grinding_v6",
    },
}


def get_git_sha():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=Path(__file__).parent.parent,
        ).decode().strip()[:12]
    except Exception:
        return "unknown"


def make_meta():
    return {
        "generated_from": f"{DATASET}/episode_{EPISODE}",
        "extraction_script": "scripts/extract_predictions.py",
        "extracted_at": __import__("datetime").date.today().isoformat(),
        "git_sha": get_git_sha(),
        "schema_version": SCHEMA_VERSION,
    }


def load_dataset_stats(dataset_id: str) -> dict:
    ds_root = os.path.expanduser(f"~/.cache/huggingface/lerobot/{dataset_id}")
    with open(os.path.join(ds_root, "meta", "stats.json")) as f:
        raw = json.load(f)
    return {
        feat_key: {k: torch.tensor(v, dtype=torch.float32) for k, v in feat_stats.items()}
        for feat_key, feat_stats in raw.items()
    }


def load_policy(model_id: str, model_cfg: dict, device: str):
    """Load a policy checkpoint using the capstone's plugin pattern."""
    checkpoint = model_cfg["checkpoint"]
    policy_type = model_cfg["policy_type"]

    # Apply v-prediction monkey-patch
    from lerobot.policies.diffusion.configuration_diffusion import DiffusionConfig
    _original_post_init = DiffusionConfig.__post_init__
    def _patched_post_init(self):
        saved = self.prediction_type
        if self.prediction_type == "v_prediction":
            self.prediction_type = "epsilon"
        _original_post_init(self)
        self.prediction_type = saved
    DiffusionConfig.__post_init__ = _patched_post_init

    from lerobot.policies.diffusion.modeling_diffusion import DiffusionPolicy
    POLICY_MAP = {"diffusion": DiffusionPolicy}

    # Register plugins — importing Config is required for draccus registration
    try:
        from lerobot_policy_foar.lerobot_policy_foar.configuration_foar import FoARConfig  # noqa: F401
        from lerobot_policy_foar.lerobot_policy_foar.modeling_foar import FoARPolicy
        POLICY_MAP["foar"] = FoARPolicy
    except ImportError as e:
        print(f"  Warning: FoAR plugin not available: {e}")

    try:
        from lerobot_policy_octo.lerobot_policy_octo.configuration_octo import OctoWrapperConfig  # noqa: F401
        from lerobot_policy_octo.lerobot_policy_octo.modeling_octo import OctoWrapperPolicy
        POLICY_MAP["octo_wrapper"] = OctoWrapperPolicy
    except ImportError as e:
        print(f"  Warning: Octo plugin not available: {e}")

    policy_cls = POLICY_MAP.get(policy_type, DiffusionPolicy)
    print(f"  Loading as {policy_cls.__name__} from {checkpoint}")

    self_unnorm_types = {"foar", "octo_wrapper", "custom_grinding", "act_contact_gated", "deco"}
    if policy_type in self_unnorm_types:
        stats = load_dataset_stats(model_cfg["dataset_for_stats"])
        policy = policy_cls.from_pretrained(checkpoint, dataset_stats=stats)
    else:
        policy = policy_cls.from_pretrained(checkpoint)

    policy = policy.to(device)
    policy.eval()
    print(f"  {sum(p.numel() for p in policy.parameters()):,} params")
    return policy


def run_inference(model_id: str, policy, dataset, from_idx: int, to_idx: int, device: str) -> list:
    """Run step-by-step inference and collect predictions."""
    n_obs_steps = getattr(policy.config, 'n_obs_steps', 2)
    predictions = []

    with torch.no_grad():
        for local_i in range(0, to_idx - from_idx, 8):  # Step every 8 frames (~0.27s)
            global_i = from_idx + local_i
            t = local_i / FPS

            # Build observation batch
            obs_indices = [min(global_i + j, to_idx - 1) for j in range(n_obs_steps)]
            batch = {}
            for key in dataset[from_idx].keys():
                if key.startswith("observation.") or key in ("action",):
                    vals = [dataset[idx][key] for idx in obs_indices]
                    batch[key] = torch.stack(vals).unsqueeze(0).to(device)

            try:
                action = policy.select_action(batch)
                if isinstance(action, torch.Tensor):
                    action_np = action.cpu().numpy()
                else:
                    action_np = np.array(action)

                if action_np.ndim == 1:
                    action_np = action_np.reshape(1, -1)

                chunk = action_np.tolist()
                executed = chunk[0] if len(chunk) > 0 else [0.0] * 7

                predictions.append({
                    "t": round(t, 4),
                    "predicted_chunk": chunk[:16],
                    "executed": executed,
                })
            except Exception as e:
                print(f"  Warning at t={t:.1f}s: {e}")
                predictions.append({
                    "t": round(t, 4),
                    "predicted_chunk": [[0.0] * 7],
                    "executed": [0.0] * 7,
                })

            if local_i % 200 == 0:
                print(f"  t={t:.1f}s ({100*local_i/(to_idx-from_idx):.0f}%)")

    return predictions


def main():
    from lerobot.datasets.lerobot_dataset import LeRobotDataset

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    print(f"Loading dataset {DATASET}...")
    ds = LeRobotDataset(DATASET)
    ep_meta = ds.meta.episodes.to_pandas()
    ep = ep_meta[ep_meta["episode_index"] == EPISODE]
    from_idx = int(ep["dataset_from_index"].iloc[0])
    to_idx = int(ep["dataset_to_index"].iloc[0])
    print(f"Episode {EPISODE}: frames {from_idx}..{to_idx}")

    OUT.mkdir(parents=True, exist_ok=True)
    meta = make_meta()

    for model_id, model_cfg in MODELS.items():
        print(f"\n{'='*40}")
        print(f"Model: {model_id}")
        print(f"{'='*40}")

        if not Path(model_cfg["checkpoint"]).exists():
            print(f"  Checkpoint not found: {model_cfg['checkpoint']}, skipping")
            continue

        try:
            policy = load_policy(model_id, model_cfg, device)
            predictions = run_inference(model_id, policy, ds, from_idx, to_idx, device)

            data = {
                "_meta": meta,
                "model": model_id,
                "predictions": predictions,
            }
            out_path = OUT / f"{model_id}.json"
            out_path.write_text(json.dumps(data))
            print(f"  ✓ {out_path.name} ({len(predictions)} predictions)")

            del policy
            torch.cuda.empty_cache()
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
