#!/usr/bin/env python3
"""
Download MOSS-TTS-Nano ONNX models from HuggingFace for browser deployment.

This script downloads the TTS model and audio tokenizer ONNX files
to the models/ directory for GitHub Pages deployment.
"""

import os
import sys
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent / "models"

REPOS = [
    {
        "repo_id": "OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX",
        "local_dir": "MOSS-TTS-Nano-100M-ONNX",
        "files": [
            "browser_poc_manifest.json",
            "tts_browser_onnx_meta.json",
            "tokenizer.model",
            "moss_tts_prefill.onnx",
            "moss_tts_decode_step.onnx",
            "moss_tts_local_decoder.onnx",
            "moss_tts_local_cached_step.onnx",
            "moss_tts_local_fixed_sampled_frame.onnx",
            "moss_tts_global_shared.data",
            "moss_tts_local_shared.data",
        ],
    },
    {
        "repo_id": "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX",
        "local_dir": "MOSS-Audio-Tokenizer-Nano-ONNX",
        "files": [
            "codec_browser_onnx_meta.json",
            "moss_audio_tokenizer_encode.onnx",
            "moss_audio_tokenizer_encode.data",
            "moss_audio_tokenizer_decode_full.onnx",
            "moss_audio_tokenizer_decode_step.onnx",
            "moss_audio_tokenizer_decode_shared.data",
        ],
    },
]


def download_with_huggingface_hub():
    """Download using huggingface_hub library."""
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("Please install huggingface_hub: pip install huggingface_hub")
        return False

    for repo in REPOS:
        local_dir = MODELS_DIR / repo["local_dir"]
        local_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nDownloading {repo['repo_id']}...")
        for filename in repo["files"]:
            local_path = local_dir / filename
            if local_path.exists():
                print(f"  [SKIP] {filename} (already exists)")
                continue
            print(f"  [DOWNLOAD] {filename}...")
            try:
                downloaded = hf_hub_download(
                    repo_id=repo["repo_id"],
                    filename=filename,
                    local_dir=local_dir,
                    local_dir_use_symlinks=False,
                )
                print(f"    -> {downloaded}")
            except Exception as e:
                print(f"    [ERROR] {e}")
    return True


def download_with_requests():
    """Download using requests (fallback)."""
    import requests

    HF_BASE = "https://huggingface.co"

    for repo in REPOS:
        local_dir = MODELS_DIR / repo["local_dir"]
        local_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nDownloading {repo['repo_id']}...")
        for filename in repo["files"]:
            local_path = local_dir / filename
            if local_path.exists():
                print(f"  [SKIP] {filename} (already exists)")
                continue
            url = f"{HF_BASE}/{repo['repo_id']}/resolve/main/{filename}"
            print(f"  [DOWNLOAD] {url}...")
            try:
                resp = requests.get(url, stream=True, timeout=300)
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(local_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            pct = downloaded * 100 // total
                            print(f"\r    {pct}%", end="", flush=True)
                print(f"\n    -> {local_path} ({downloaded} bytes)")
            except Exception as e:
                print(f"\n    [ERROR] {e}")
                if local_path.exists():
                    local_path.unlink()
    return True


def main():
    print("=" * 60)
    print("MOSS-TTS-Nano Model Downloader")
    print("=" * 60)
    print(f"Target directory: {MODELS_DIR}")
    print()

    # Try huggingface_hub first, then requests
    if not download_with_huggingface_hub():
        print("\nFalling back to requests-based download...")
        download_with_requests()

    print("\n" + "=" * 60)
    print("Download complete!")
    print(f"Models saved to: {MODELS_DIR}")
    print()
    print("Total model size: ~700MB")
    print()
    print("Next steps:")
    print("  1. Verify model files are present")
    print("  2. Deploy to GitHub Pages")
    print("  3. Open index.html in a browser")
    print("=" * 60)


if __name__ == "__main__":
    main()