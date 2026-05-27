#!/usr/bin/env python3
"""Extract attention weights from B4, M3 (FoAR), and M2 (DECO) for the demo site.

Uses PyTorch forward hooks to capture attention weights during inference.
Runs on ~10 representative timesteps spanning episode 19.

Run: cd ~/Robotics_Capstone/grinding_capstone && conda run -n grinding_fusion_312 \
     python ~/Robotics_Capstone/Sensor_demo/multisensor-demos/scripts/extract_attention.py
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

CAPSTONE = Path("/home/danny/Robotics_Capstone/grinding_capstone")
sys.path.insert(0, str(CAPSTONE))
sys.path.insert(0, str(CAPSTONE / "scripts"))

DATASET_ID = "local/kuka_grinding_v6"
EPISODE = 19
FPS = 30
SCHEMA_VERSION = 1
OUT = Path("/home/danny/Robotics_Capstone/Sensor_demo/multisensor-demos/public/data/attention_maps")

# Sample 10 timesteps spanning approach/contact/retract
SAMPLE_TIMES = [2.0, 8.0, 12.0, 15.0, 18.0, 22.0, 28.0, 35.0, 42.0, 48.0]


def get_git_sha():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=CAPSTONE).decode().strip()[:12]
    except Exception:
        return "unknown"


def make_meta():
    return {
        "generated_from": f"{DATASET_ID}/episode_{EPISODE}",
        "extraction_script": "scripts/extract_attention.py",
        "extracted_at": __import__("datetime").date.today().isoformat(),
        "git_sha": get_git_sha(),
        "schema_version": SCHEMA_VERSION,
    }


def classify_phase(t: float) -> str:
    if t < 14.7:
        return "approach"
    elif t < 33.2:
        return "contact"
    else:
        return "retract"


def extract_b4_attention():
    """Extract cross-attention weights from B4 (VisionForceCA)."""
    from lerobot.policies.diffusion.configuration_diffusion import DiffusionConfig
    _orig = DiffusionConfig.__post_init__
    def _patched(self):
        saved = self.prediction_type
        if self.prediction_type == "v_prediction":
            self.prediction_type = "epsilon"
        _orig(self)
        self.prediction_type = saved
    DiffusionConfig.__post_init__ = _patched

    from lerobot_policy_b4.lerobot_policy_b4.configuration_b4 import B4Config  # noqa: F401
    from lerobot_policy_b4.lerobot_policy_b4.modeling_b4 import B4Policy

    checkpoint = "/data/grinding_capstone/checkpoints/baselines/b4_dp_ca/checkpoints/100000/pretrained_model"
    if not Path(checkpoint).exists():
        # Try other B4 checkpoints
        for alt in ["b4_dp_ca_v2_3", "b4_dp_ca_v2_2", "b4_dp_ca_v2_1"]:
            alt_path = f"/data/grinding_capstone/checkpoints/baselines/{alt}/checkpoints/last/pretrained_model"
            if Path(alt_path).exists():
                checkpoint = alt_path
                break

    if not Path(checkpoint).exists():
        print("  B4 checkpoint not found, skipping")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Loading B4 from {checkpoint}")
    policy = B4Policy.from_pretrained(checkpoint)
    policy = policy.to(device)
    policy.eval()

    # Register forward hook on cross-attention
    captured_attn = {}

    def hook_fn(module, input, output):
        if isinstance(output, tuple) and len(output) >= 2 and output[1] is not None:
            captured_attn["weights"] = output[1].detach().cpu()

    # Find and patch the cross-attention module to return weights
    hook_handle = None
    target_mha = None
    for name, module in policy.named_modules():
        if "cross_attn" in name.lower() and isinstance(module, torch.nn.MultiheadAttention):
            target_mha = module
            hook_handle = module.register_forward_hook(hook_fn)
            print(f"  Hook registered on: {name}")
            break

    # Monkey-patch forward to force need_weights=True
    if target_mha is not None:
        _orig_forward = target_mha.forward
        def _patched_forward(*args, **kwargs):
            kwargs['need_weights'] = True
            kwargs['average_attn_weights'] = False
            return _orig_forward(*args, **kwargs)
        target_mha.forward = _patched_forward

    if hook_handle is None:
        print("  Could not find cross_attn module, skipping B4")
        return

    from preloaded_dataset import preload_from_parquet
    dataset = preload_from_parquet(repo_id=DATASET_ID, cache_path=None)

    ep_indices = dataset.episode_indices
    mask = ep_indices == EPISODE
    frame_indices = torch.where(mask)[0]
    T = len(frame_indices)
    n_obs_steps = getattr(policy.config, 'n_obs_steps', 2)

    if hasattr(policy, 'reset'):
        policy.reset()

    attention_samples = []
    sample_frame_indices = [int(t * FPS) for t in SAMPLE_TIMES]

    with torch.inference_mode():
        for t_idx in range(n_obs_steps - 1, T):
            idx = frame_indices[t_idx].item()
            item = dataset[idx]

            obs = {}
            for key in item:
                if key.startswith("observation"):
                    val = item[key]
                    if isinstance(val, torch.Tensor):
                        obs[key] = val.unsqueeze(0).to(device)

            captured_attn.clear()
            try:
                policy.select_action(obs)
            except Exception:
                pass

            if t_idx in sample_frame_indices and "weights" in captured_attn:
                weights = captured_attn["weights"].numpy()  # (1, Q, K) or (B, H, Q, K)
                if weights.ndim == 4:
                    weights = weights[0].mean(axis=0)  # Average over heads: (Q, K)
                elif weights.ndim == 3:
                    weights = weights[0]  # (Q, K)

                t_sec = t_idx / FPS
                attention_samples.append({
                    "t": round(t_sec, 2),
                    "phase": classify_phase(t_sec),
                    "weights": [[round(float(w), 4) for w in row] for row in weights],
                })
                print(f"  Captured attention at t={t_sec:.1f}s, shape={weights.shape}")

    hook_handle.remove()

    if attention_samples:
        data = {
            "_meta": make_meta(),
            "model": "b4",
            "module": "VisionForceCA.cross_attn",
            "t_samples": [s["t"] for s in attention_samples],
            "attention": attention_samples,
        }
        out_path = OUT / "b4_crossattn.json"
        out_path.write_text(json.dumps(data))
        print(f"  ✓ b4_crossattn.json ({len(attention_samples)} samples)")
    else:
        print("  No attention captured for B4")

    del policy, dataset
    torch.cuda.empty_cache()


def extract_foar_attention():
    """Extract Force Transformer self-attention from M3 (FoAR)."""
    from lerobot.policies.diffusion.configuration_diffusion import DiffusionConfig
    _orig = DiffusionConfig.__post_init__
    def _patched(self):
        saved = self.prediction_type
        if self.prediction_type == "v_prediction":
            self.prediction_type = "epsilon"
        _orig(self)
        self.prediction_type = saved
    DiffusionConfig.__post_init__ = _patched

    from lerobot_policy_foar.lerobot_policy_foar.configuration_foar import FoARConfig  # noqa: F401
    from lerobot_policy_foar.lerobot_policy_foar.modeling_foar import FoARPolicy

    checkpoint = "/data/grinding_capstone/checkpoints/models/m3_foar/checkpoints/last/pretrained_model"
    if not Path(checkpoint).exists():
        print("  M3 checkpoint not found, skipping")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    ds_root = os.path.expanduser(f"~/.cache/huggingface/lerobot/{DATASET_ID}")
    with open(os.path.join(ds_root, "meta", "stats.json")) as f:
        ds_stats_raw = json.load(f)
    torch_stats = {
        feat_key: {k: torch.tensor(v, dtype=torch.float32) for k, v in feat_stats.items()}
        for feat_key, feat_stats in ds_stats_raw.items()
    }

    print(f"  Loading M3 from {checkpoint}")
    policy = FoARPolicy.from_pretrained(checkpoint, dataset_stats=torch_stats)
    policy = policy.to(device)
    policy.eval()

    captured_attn = {}

    def hook_fn(module, input, output):
        if isinstance(output, tuple) and len(output) >= 2 and output[1] is not None:
            captured_attn["weights"] = output[1].detach().cpu()

    # Find ForceTransformer's self-attention
    hook_handle = None
    target_mha = None
    for name, module in policy.named_modules():
        if "force_transformer" in name.lower() or "encoder" in name.lower():
            if isinstance(module, torch.nn.MultiheadAttention):
                target_mha = module
                hook_handle = module.register_forward_hook(hook_fn)
                print(f"  Hook registered on: {name}")
                break

    if hook_handle is None:
        for name, module in policy.named_modules():
            if isinstance(module, torch.nn.TransformerEncoderLayer):
                if hasattr(module, 'self_attn'):
                    target_mha = module.self_attn
                    hook_handle = target_mha.register_forward_hook(hook_fn)
                    print(f"  Hook registered on: {name}.self_attn")
                    break

    # Monkey-patch to force need_weights=True
    if target_mha is not None:
        _orig_forward = target_mha.forward
        def _patched_forward(*args, **kwargs):
            kwargs['need_weights'] = True
            kwargs['average_attn_weights'] = False
            return _orig_forward(*args, **kwargs)
        target_mha.forward = _patched_forward

    from preloaded_dataset import preload_from_parquet
    dataset = preload_from_parquet(
        repo_id=DATASET_ID, cache_path=None,
        include_pointclouds=True, ft_window_size=30,
    )

    ep_indices = dataset.episode_indices
    mask = ep_indices == EPISODE
    frame_indices = torch.where(mask)[0]
    T = len(frame_indices)
    n_obs_steps = getattr(policy.config, 'n_obs_steps', 1)

    if hasattr(policy, 'reset'):
        policy.reset()

    attention_samples = []
    sample_frame_indices = [int(t * FPS) for t in SAMPLE_TIMES]

    with torch.inference_mode():
        for t_idx in range(n_obs_steps - 1, T):
            idx = frame_indices[t_idx].item()
            item = dataset[idx]

            obs = {}
            for key in item:
                if key.startswith("observation"):
                    val = item[key]
                    if isinstance(val, torch.Tensor):
                        obs[key] = val.unsqueeze(0).to(device)

            captured_attn.clear()
            try:
                policy.select_action(obs)
            except Exception:
                pass

            if t_idx in sample_frame_indices and "weights" in captured_attn:
                weights = captured_attn["weights"].numpy()
                if weights.ndim == 4:
                    weights = weights[0].mean(axis=0)
                elif weights.ndim == 3:
                    weights = weights[0]

                t_sec = t_idx / FPS
                attention_samples.append({
                    "t": round(t_sec, 2),
                    "phase": classify_phase(t_sec),
                    "weights": [[round(float(w), 4) for w in row] for row in weights],
                })
                print(f"  Captured attention at t={t_sec:.1f}s, shape={weights.shape}")

    if hook_handle:
        hook_handle.remove()

    if attention_samples:
        data = {
            "_meta": make_meta(),
            "model": "m3",
            "module": "ForceTransformer.self_attn",
            "t_samples": [s["t"] for s in attention_samples],
            "attention": attention_samples,
        }
        out_path = OUT / "foar_force_transformer.json"
        out_path.write_text(json.dumps(data))
        print(f"  ✓ foar_force_transformer.json ({len(attention_samples)} samples)")
    else:
        print("  No attention captured for FoAR")

    del policy, dataset
    torch.cuda.empty_cache()


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    print("="*50)
    print("Extracting B4 cross-attention weights")
    print("="*50)
    try:
        extract_b4_attention()
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback; traceback.print_exc()

    print()
    print("="*50)
    print("Extracting FoAR Force Transformer self-attention")
    print("="*50)
    try:
        extract_foar_attention()
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback; traceback.print_exc()


if __name__ == "__main__":
    os.chdir(str(CAPSTONE))
    main()
