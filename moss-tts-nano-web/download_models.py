#!/usr/bin/env python3
"""
Download MOSS-TTS-Nano ONNX models from HuggingFace for browser deployment.

This script downloads the TTS model and audio tokenizer ONNX files
to the models/ directory for GitHub Pages deployment.

Usage:
    python download_models.py              # Default download
    python download_models.py --mirror     # Use HF mirror (for China)
    python download_models.py --check      # Only verify existing files
"""

import os
import sys
import hashlib
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent / "models"

# HuggingFace mirror for users in China
HF_MIRROR = "https://hf-mirror.com"
HF_BASE = "https://huggingface.co"

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


def format_size(size_bytes):
    """Format bytes to human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def check_existing():
    """Check which model files exist and their sizes."""
    print("\n" + "=" * 60)
    print("Checking model files...")
    print("=" * 60)
    all_ok = True
    total_size = 0
    for repo in REPOS:
        local_dir = MODELS_DIR / repo["local_dir"]
        print(f"\n{repo['repo_id']}:")
        for filename in repo["files"]:
            local_path = local_dir / filename
            if local_path.exists():
                size = local_path.stat().st_size
                total_size += size
                print(f"  [OK] {filename} ({format_size(size)})")
            else:
                print(f"  [MISSING] {filename}")
                all_ok = False
    print(f"\nTotal: {format_size(total_size)}")
    return all_ok


def download_with_huggingface_hub(use_mirror=False):
    """Download using huggingface_hub library."""
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("Please install huggingface_hub: pip install huggingface_hub")
        return False

    endpoint = HF_MIRROR if use_mirror else None

    for repo in REPOS:
        local_dir = MODELS_DIR / repo["local_dir"]
        local_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nDownloading {repo['repo_id']}...")
        for filename in repo["files"]:
            local_path = local_dir / filename
            if local_path.exists():
                size = local_path.stat().st_size
                print(f"  [SKIP] {filename} ({format_size(size)})")
                continue
            print(f"  [DOWNLOAD] {filename}...")
            try:
                kwargs = {
                    "repo_id": repo["repo_id"],
                    "filename": filename,
                    "local_dir": local_dir,
                    "local_dir_use_symlinks": False,
                }
                if endpoint:
                    kwargs["endpoint"] = endpoint
                downloaded = hf_hub_download(**kwargs)
                print(f"    -> {downloaded}")
            except Exception as e:
                print(f"    [ERROR] {e}")
                return False
    return True


def download_with_requests(use_mirror=False):
    """Download using requests (fallback)."""
    import requests

    base_url = HF_MIRROR if use_mirror else HF_BASE

    for repo in REPOS:
        local_dir = MODELS_DIR / repo["local_dir"]
        local_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nDownloading {repo['repo_id']}...")
        for filename in repo["files"]:
            local_path = local_dir / filename
            if local_path.exists():
                size = local_path.stat().st_size
                print(f"  [SKIP] {filename} ({format_size(size)})")
                continue
            url = f"{base_url}/{repo['repo_id']}/resolve/main/{filename}"
            print(f"  [DOWNLOAD] {filename}...")
            try:
                resp = requests.get(url, stream=True, timeout=600)
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(local_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            pct = downloaded * 100 // total
                            print(f"\r    {pct}% ({format_size(downloaded)})", end="", flush=True)
                print(f"\n    -> {format_size(downloaded)}")
            except Exception as e:
                print(f"\n    [ERROR] {e}")
                if local_path.exists():
                    local_path.unlink()
                return False
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Download MOSS-TTS-Nano ONNX models")
    parser.add_argument("--mirror", action="store_true", help="Use HF mirror (hf-mirror.com) for China")
    parser.add_argument("--check", action="store_true", help="Only verify existing files")
    args = parser.parse_args()

    if args.check:
        ok = check_existing()
        sys.exit(0 if ok else 1)

    print("=" * 60)
    print("MOSS-TTS-Nano Model Downloader")
    print("=" * 60)
    print(f"Target directory: {MODELS_DIR}")
    if args.mirror:
        print(f"Using mirror: {HF_MIRROR}")
    print()

    # Check existing files first
    check_existing()

    # Download
    print("\n" + "=" * 60)
    print("Starting download...")
    print("=" * 60)

    success = download_with_huggingface_hub(use_mirror=args.mirror)
    if not success:
        print("\nTrying requests-based download...")
        success = download_with_requests(use_mirror=args.mirror)

    print("\n" + "=" * 60)
    if success:
        print("Download complete!")
        check_existing()
        print()
        print("Next steps:")
        print("  1. Push to GitHub (with Git LFS for large files)")
        print("  2. Enable GitHub Pages in repo settings")
        print("  3. Open your GitHub Pages URL")
    else:
        print("Download failed. Please check your network connection.")
        print("Try using --mirror flag for China: python download_models.py --mirror")
    print("=" * 60)


if __name__ == "__main__":
    main()