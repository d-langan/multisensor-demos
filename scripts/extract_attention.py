#!/usr/bin/env python3
"""Extract real attention weights from B4 (DP-CA) and M3 (FoAR) for the demo site.

B4's VisionForceCA uses nn.MultiheadAttention which discards weights at the call
site (attn_out, _ = self.cross_attn(...)). We force capture via a forward_pre_hook
(with_kwargs) that injects need_weights=True, average_attn_weights=False, plus a
forward_hook that grabs the returned per-head weights.

Samples densely across episode 19 so the demo can scrub the prying trajectory and
watch attention concentrate as |F| rises.

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
STRIDE = 20  # sample every 20 frames (~0.67s) → ~75 samples
OUT = Path("/home/danny/Robotics_Capstone/Sensor_demo/multisensor-demos/public/data/attention_maps")

# Contact phase boundaries (from extract_episode.py phase detection)
CONTACT_START = 14.7
CONTACT_END = 33.2


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


def classify_phase(t):
    if t < CONTACT_START:
        return "approach"
    elif t < CONTACT_END:
        return "contact"
    return "retract"


def apply_vpred_patch():
    from lerobot.policies.diffusion.configuration_diffusion import DiffusionConfig
    _orig = DiffusionConfig.__post_init__
    def _patched(self):
        saved = self.prediction_type
        if self.prediction_type == "v_prediction":
            self.prediction_type = "epsilon"
        _orig(self)
        self.prediction_type = saved
    DiffusionConfig.__post_init__ = _patched


def force_mag_at(item):
    ft = item["observation.force_torque"].numpy()
    if ft.ndim == 2:  # (window, 6) — use last frame
        ft = ft[-1]
    return float(np.sqrt(ft[0] ** 2 + ft[1] ** 2 + ft[2] ** 2))


def extract_b4():
    apply_vpred_patch()
    from lerobot_policy_b4.lerobot_policy_b4.configuration_b4 import B4Config  # noqa: F401
    from lerobot_policy_b4.lerobot_policy_b4.modeling_b4 import B4Policy

    checkpoint = "/data/grinding_capstone/checkpoints/baselines/b4_dp_ca/checkpoints/last/pretrained_model"
    if not Path(checkpoint).exists():
        print("  B4 checkpoint not found, skipping")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Loading B4 from {checkpoint}")
    policy = B4Policy.from_pretrained(checkpoint).to(device)
    policy.eval()

    captured = {}

    # Pre-hook forces the module to compute + return per-head weights
    def pre_hook(module, args, kwargs):
        kwargs = dict(kwargs)
        kwargs["need_weights"] = True
        kwargs["average_attn_weights"] = False
        return (args, kwargs)

    def fwd_hook(module, args, kwargs, output):
        if isinstance(output, tuple) and len(output) >= 2 and output[1] is not None:
            captured["weights"] = output[1].detach().cpu()  # (B, H, Q, K)

    target = None
    for name, module in policy.named_modules():
        if name.endswith("cross_attn") and isinstance(module, torch.nn.MultiheadAttention):
            target = module
            module.register_forward_pre_hook(pre_hook, with_kwargs=True)
            module.register_forward_hook(fwd_hook, with_kwargs=True)
            print(f"  Hooks registered on: {name}")
            break
    if target is None:
        print("  Could not find cross_attn, skipping B4")
        return

    from preloaded_dataset import preload_from_parquet
    dataset = preload_from_parquet(repo_id=DATASET_ID, cache_path=None)

    ep_indices = dataset.episode_indices
    frame_indices = torch.where(ep_indices == EPISODE)[0]
    T = len(frame_indices)
    n_obs_steps = getattr(policy.config, "n_obs_steps", 2)
    print(f"  Episode {EPISODE}: {T} frames, n_obs_steps={n_obs_steps}")

    if hasattr(policy, "reset"):
        policy.reset()

    # B4 caches its action chunk and only re-runs the network (incl. cross_attn)
    # every ~n_action_steps frames. So record a sample whenever cross_attn actually
    # fires AND ~0.6s has elapsed since the last recorded sample.
    samples = []
    errors_shown = 0
    last_t = -1e9
    n_fired = 0
    with torch.inference_mode():
        for t_idx in range(n_obs_steps - 1, T):
            idx = frame_indices[t_idx].item()
            item = dataset[idx]
            obs = {k: v.unsqueeze(0).to(device) for k, v in item.items()
                   if k.startswith("observation") and isinstance(v, torch.Tensor)}

            captured.clear()
            try:
                policy.select_action(obs)
            except Exception as e:
                if errors_shown < 3:
                    print(f"  select_action error at frame {t_idx}: {e}")
                    errors_shown += 1

            t_sec = t_idx / FPS
            if "weights" in captured:
                n_fired += 1
                if t_sec - last_t >= 0.6:
                    last_t = t_sec
                    w = captured["weights"].numpy()  # (B, H, Q, K)
                    if w.ndim == 4:
                        w = w[0]  # (H, Q, K)
                    samples.append({
                        "t": round(t_sec, 3),
                        "phase": classify_phase(t_sec),
                        "force_mag": round(force_mag_at(item), 2),
                        "heads": [[[round(float(x), 4) for x in row] for row in head] for head in w],
                    })

            if t_idx % 200 == 0:
                print(f"  t={t_sec:.1f}s ({100*t_idx/T:.0f}%) fires={n_fired} samples={len(samples)}")

    if not samples:
        print("  No B4 attention captured")
        del policy, dataset
        torch.cuda.empty_cache()
        return

    H = len(samples[0]["heads"])
    Q = len(samples[0]["heads"][0])
    K = len(samples[0]["heads"][0][0])
    data = {
        "_meta": make_meta(),
        "model": "b4",
        "module": "VisionForceCA.cross_attn",
        "n_heads": H, "n_queries": Q, "n_keys": K,
        "query_labels": ["Fx", "Fy", "Fz", "Tx", "Ty", "Tz"][:Q],
        "grid": [7, 7],
        "t_samples": [s["t"] for s in samples],
        "samples": samples,
    }
    (OUT / "b4_crossattn.json").write_text(json.dumps(data))
    print(f"  ✓ b4_crossattn.json ({len(samples)} samples, {H} heads, {Q}×{K})")

    del policy, dataset
    torch.cuda.empty_cache()


def extract_foar():
    apply_vpred_patch()
    from lerobot_policy_foar.lerobot_policy_foar.configuration_foar import FoARConfig  # noqa: F401
    from lerobot_policy_foar.lerobot_policy_foar.modeling_foar import FoARPolicy

    checkpoint = "/data/grinding_capstone/checkpoints/models/m3_foar/checkpoints/last/pretrained_model"
    if not Path(checkpoint).exists():
        print("  M3 checkpoint not found, skipping")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    ds_root = os.path.expanduser(f"~/.cache/huggingface/lerobot/{DATASET_ID}")
    with open(os.path.join(ds_root, "meta", "stats.json")) as f:
        raw = json.load(f)
    torch_stats = {k: {kk: torch.tensor(vv, dtype=torch.float32) for kk, vv in v.items()}
                   for k, v in raw.items()}

    print(f"  Loading M3 from {checkpoint}")
    policy = FoARPolicy.from_pretrained(checkpoint, dataset_stats=torch_stats).to(device)
    policy.eval()

    captured = {}

    def pre_hook(module, args, kwargs):
        kwargs = dict(kwargs)
        kwargs["need_weights"] = True
        kwargs["average_attn_weights"] = False
        return (args, kwargs)

    def fwd_hook(module, args, kwargs, output):
        if isinstance(output, tuple) and len(output) >= 2 and output[1] is not None:
            captured["weights"] = output[1].detach().cpu()

    target = None
    for name, module in policy.named_modules():
        if isinstance(module, torch.nn.TransformerEncoderLayer) and hasattr(module, "self_attn"):
            target = module.self_attn
            target.register_forward_pre_hook(pre_hook, with_kwargs=True)
            target.register_forward_hook(fwd_hook, with_kwargs=True)
            print(f"  Hooks registered on: {name}.self_attn")
            break
    if target is None:
        print("  Could not find Force Transformer self_attn, skipping")
        return

    from preloaded_dataset import preload_from_parquet
    dataset = preload_from_parquet(repo_id=DATASET_ID, cache_path=None,
                                   include_pointclouds=True, ft_window_size=30)

    ep_indices = dataset.episode_indices
    frame_indices = torch.where(ep_indices == EPISODE)[0]
    T = len(frame_indices)
    n_obs_steps = getattr(policy.config, "n_obs_steps", 1)
    print(f"  Episode {EPISODE}: {T} frames, n_obs_steps={n_obs_steps}")

    if hasattr(policy, "reset"):
        policy.reset()

    samples = []
    with torch.inference_mode():
        for t_idx in range(n_obs_steps - 1, T):
            idx = frame_indices[t_idx].item()
            item = dataset[idx]
            obs = {k: v.unsqueeze(0).to(device) for k, v in item.items()
                   if k.startswith("observation") and isinstance(v, torch.Tensor)}

            captured.clear()
            try:
                policy.select_action(obs)
            except Exception:
                pass

            if t_idx % STRIDE == 0 and "weights" in captured:
                w = captured["weights"].numpy()
                if w.ndim == 4:
                    w = w[0]  # (H, 30, 30)
                t_sec = t_idx / FPS
                samples.append({
                    "t": round(t_sec, 3),
                    "phase": classify_phase(t_sec),
                    "force_mag": round(force_mag_at(item), 2),
                    "heads": [[[round(float(x), 4) for x in row] for row in head] for head in w],
                })

            if t_idx % 200 == 0:
                print(f"  t={t_idx/FPS:.1f}s ({100*t_idx/T:.0f}%) captured={'weights' in captured}")

    if not samples:
        print("  No FoAR attention captured")
        del policy, dataset
        torch.cuda.empty_cache()
        return

    H = len(samples[0]["heads"])
    data = {
        "_meta": make_meta(),
        "model": "m3",
        "module": "ForceTransformer.self_attn",
        "n_heads": H, "window": 30,
        "t_samples": [s["t"] for s in samples],
        "samples": samples,
    }
    (OUT / "foar_force_transformer.json").write_text(json.dumps(data))
    print(f"  ✓ foar_force_transformer.json ({len(samples)} samples, {H} heads, 30×30)")

    del policy, dataset
    torch.cuda.empty_cache()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("=" * 50)
    print("B4 cross-attention (VisionForceCA)")
    print("=" * 50)
    try:
        extract_b4()
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback; traceback.print_exc()

    # Skip FoAR if already extracted in the rich format
    foar_path = OUT / "foar_force_transformer.json"
    skip_foar = False
    if foar_path.exists():
        try:
            existing = json.loads(foar_path.read_text())
            skip_foar = "samples" in existing and len(existing["samples"]) > 0
        except Exception:
            pass

    if skip_foar:
        print("\nFoAR already extracted (rich format) — skipping")
    else:
        print()
        print("=" * 50)
        print("FoAR Force Transformer self-attention")
        print("=" * 50)
        try:
            extract_foar()
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback; traceback.print_exc()


if __name__ == "__main__":
    os.chdir(str(CAPSTONE))
    main()
