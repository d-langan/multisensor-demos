#!/usr/bin/env python3
"""Extract per-timestep model predictions on episode 19 for the demo site.

Follows the exact inference pattern from evaluate.py:
  - Single-frame obs dict with unsqueeze(0)
  - Policy handles temporal buffering internally via deques
  - Dataset handles F/T window expansion

Run: cd ~/Robotics_Capstone/grinding_capstone && conda run -n grinding_fusion_312 \
     python ~/Robotics_Capstone/Sensor_demo/multisensor-demos/scripts/extract_predictions.py
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

# Must run from capstone root for relative checkpoint paths
CAPSTONE = Path("/home/danny/Robotics_Capstone/grinding_capstone")
sys.path.insert(0, str(CAPSTONE))
sys.path.insert(0, str(CAPSTONE / "scripts"))

DATASET_ID = "local/kuka_grinding_v6"
EPISODE = 19
FPS = 30
SCHEMA_VERSION = 1
OUT = Path("/home/danny/Robotics_Capstone/Sensor_demo/multisensor-demos/public/data/model_predictions")

SELF_UNNORM_TYPES = {"foar", "octo_wrapper", "custom_grinding", "act_contact_gated", "deco"}

MODELS = {
    "b1": {
        "checkpoint": "/data/grinding_capstone/checkpoints/baselines/b1_dp_b/checkpoints/100000/pretrained_model",
        "policy_type": "diffusion",
    },
    "m3": {
        "checkpoint": "/data/grinding_capstone/checkpoints/models/m3_foar/checkpoints/last/pretrained_model",
        "policy_type": "foar",
    },
    "m4": {
        "checkpoint": "/data/grinding_capstone/checkpoints/models/m4_octo/checkpoints/005000/pretrained_model",
        "policy_type": "octo_wrapper",
    },
}


def get_git_sha():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=CAPSTONE).decode().strip()[:12]
    except Exception:
        return "unknown"


def make_meta():
    return {
        "generated_from": f"{DATASET_ID}/episode_{EPISODE}",
        "extraction_script": "scripts/extract_predictions.py",
        "extracted_at": __import__("datetime").date.today().isoformat(),
        "git_sha": get_git_sha(),
        "schema_version": SCHEMA_VERSION,
    }


def unnormalize_minmax(normalized, stats_min, stats_max):
    return (normalized + 1.0) / 2.0 * (stats_max - stats_min) + stats_min


def main():
    # Apply v-prediction monkey-patch (same as evaluate.py)
    from lerobot.policies.diffusion.configuration_diffusion import DiffusionConfig
    _orig = DiffusionConfig.__post_init__
    def _patched(self):
        saved = self.prediction_type
        if self.prediction_type == "v_prediction":
            self.prediction_type = "epsilon"
        _orig(self)
        self.prediction_type = saved
    DiffusionConfig.__post_init__ = _patched

    # Register all plugins (importing Config triggers draccus registration)
    from lerobot.policies.diffusion.modeling_diffusion import DiffusionPolicy
    POLICY_MAP = {"diffusion": DiffusionPolicy}

    try:
        from lerobot_policy_b3.lerobot_policy_b3.configuration_b3 import B3Config  # noqa: F401
        from lerobot_policy_b3.lerobot_policy_b3.modeling_b3 import B3Policy
        POLICY_MAP["diffusion_pf"] = B3Policy
    except ImportError:
        pass
    try:
        from lerobot_policy_b4.lerobot_policy_b4.configuration_b4 import B4Config  # noqa: F401
        from lerobot_policy_b4.lerobot_policy_b4.modeling_b4 import B4Policy
        POLICY_MAP["diffusion_ca"] = B4Policy
    except ImportError:
        pass
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

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    # Load dataset stats for unnormalization
    ds_root = os.path.expanduser(f"~/.cache/huggingface/lerobot/{DATASET_ID}")
    with open(os.path.join(ds_root, "meta", "stats.json")) as f:
        ds_stats_raw = json.load(f)
    torch_stats = {
        feat_key: {k: torch.tensor(v, dtype=torch.float32) for k, v in feat_stats.items()}
        for feat_key, feat_stats in ds_stats_raw.items()
    }

    OUT.mkdir(parents=True, exist_ok=True)
    meta = make_meta()

    for model_id, model_cfg in MODELS.items():
        print(f"\n{'='*50}")
        print(f"Model: {model_id}")
        print(f"{'='*50}")

        checkpoint = model_cfg["checkpoint"]
        policy_type = model_cfg["policy_type"]

        if not Path(checkpoint).exists():
            print(f"  Checkpoint not found: {checkpoint}, skipping")
            continue

        # Determine policy class
        config_path = Path(checkpoint) / "config.json"
        with open(config_path) as f:
            cfg_dict = json.load(f)
        actual_type = cfg_dict.get("type", policy_type)
        policy_cls = POLICY_MAP.get(actual_type, POLICY_MAP.get(policy_type, DiffusionPolicy))
        print(f"  Config type: {actual_type}, loading as {policy_cls.__name__}")

        # Load policy
        try:
            if policy_type in SELF_UNNORM_TYPES:
                policy = policy_cls.from_pretrained(checkpoint, dataset_stats=torch_stats)
            else:
                policy = policy_cls.from_pretrained(checkpoint)
            policy = policy.to(device)
            policy.eval()
            n_params = sum(p.numel() for p in policy.parameters())
            n_obs_steps = getattr(policy.config, 'n_obs_steps', 2)
            print(f"  {n_params:,} params, n_obs_steps={n_obs_steps}")
        except Exception as e:
            print(f"  ERROR loading policy: {e}")
            import traceback; traceback.print_exc()
            continue

        # Load dataset with policy-appropriate flags
        from preloaded_dataset import preload_from_parquet

        include_pointclouds = (policy_type == "foar")
        ft_window_size = None
        if policy_type in ("foar", "act_contact_gated", "deco", "custom_grinding"):
            ft_window_size = getattr(policy.config, "ft_window", 30)
        elif policy_type == "octo_wrapper":
            ft_window_size = getattr(policy.config, "ft_window", 0) or None

        print(f"  Loading dataset (ft_window={ft_window_size}, pc={include_pointclouds})...")
        dataset = preload_from_parquet(
            repo_id=DATASET_ID,
            cache_path=None,
            include_pointclouds=include_pointclouds,
            ft_window_size=ft_window_size,
        )

        # Action unnormalization setup
        if policy_type in SELF_UNNORM_TYPES:
            action_stats = None
        else:
            action_stats = {
                "min": np.array(ds_stats_raw["action"]["min"], dtype=np.float32),
                "max": np.array(ds_stats_raw["action"]["max"], dtype=np.float32),
            }

        # Get episode frame range
        ep_indices = dataset.episode_indices
        mask = ep_indices == EPISODE
        frame_indices = torch.where(mask)[0]
        T = len(frame_indices)
        print(f"  Episode {EPISODE}: {T} frames")

        # Reset policy state
        if hasattr(policy, 'reset'):
            policy.reset()

        # Run inference — exact pattern from evaluate.py
        predictions = []
        with torch.inference_mode():
            for t_idx in range(n_obs_steps - 1, T):
                idx = frame_indices[t_idx].item()
                item = dataset[idx]

                # Build observation batch — single frame, unsqueeze(0) for batch dim
                obs = {}
                for key in item:
                    if key.startswith("observation"):
                        val = item[key]
                        if isinstance(val, torch.Tensor):
                            obs[key] = val.unsqueeze(0).to(device)

                # Policy prediction
                try:
                    pred_action = policy.select_action(obs)
                    pred_np = pred_action.squeeze(0).cpu().numpy()

                    if action_stats is not None:
                        pred_np = unnormalize_minmax(pred_np, action_stats["min"], action_stats["max"])
                except Exception as e:
                    if t_idx < 5:
                        print(f"  Warning at frame {t_idx}: {e}")
                    pred_np = np.zeros(7)

                # Ground truth
                gt_action = item["action"].numpy()

                t_seconds = t_idx / FPS

                # Save every 8th frame to keep JSON manageable
                if t_idx % 8 == 0:
                    predictions.append({
                        "t": round(float(t_seconds), 4),
                        "predicted_chunk": [pred_np.tolist()],
                        "executed": pred_np.tolist(),
                        "ground_truth": gt_action.tolist(),
                    })

                if t_idx % 200 == 0:
                    fz_pred = pred_np[6] if len(pred_np) > 6 else 0
                    fz_gt = gt_action[6] if len(gt_action) > 6 else 0
                    print(f"  t={t_seconds:.1f}s ({100*t_idx/T:.0f}%) Fz pred={fz_pred:.1f} gt={fz_gt:.1f}")

        data = {
            "_meta": meta,
            "model": model_id,
            "predictions": predictions,
        }
        out_path = OUT / f"{model_id}.json"
        out_path.write_text(json.dumps(data))
        print(f"  ✓ {out_path.name} ({len(predictions)} predictions)")

        # Cleanup
        del policy, dataset
        torch.cuda.empty_cache()


if __name__ == "__main__":
    os.chdir(str(CAPSTONE))
    main()
