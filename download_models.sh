#!/usr/bin/env bash
# download_models.sh — fetch MOSS-TTS-Nano ONNX model files from the
# hf-mirror.com domestic mirror into the models/ directory.
#
# Usage:
#   bash download_models.sh
#
# This script is intended for repository maintainers. Run it once before
# committing so the model files are pre-packaged in the repository.
# Files larger than 100 MB are tracked by Git LFS (see .gitattributes).
set -euo pipefail

MIRROR="${MIRROR:-https://hf-mirror.com}"

TTS_REPO="OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX"
CODEC_REPO="OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"

TTS_DIR="models/MOSS-TTS-Nano-100M-ONNX"
CODEC_DIR="models/MOSS-Audio-Tokenizer-Nano-ONNX"

TTS_FILES=(
  browser_poc_manifest.json
  tts_browser_onnx_meta.json
  tokenizer.model
  moss_tts_prefill.onnx
  moss_tts_decode_step.onnx
  moss_tts_local_decoder.onnx
  moss_tts_local_cached_step.onnx
  moss_tts_local_fixed_sampled_frame.onnx
  moss_tts_global_shared.data
  moss_tts_local_shared.data
)

CODEC_FILES=(
  codec_browser_onnx_meta.json
  moss_audio_tokenizer_encode.onnx
  moss_audio_tokenizer_encode.data
  moss_audio_tokenizer_decode_full.onnx
  moss_audio_tokenizer_decode_step.onnx
  moss_audio_tokenizer_decode_shared.data
)

mkdir -p "$TTS_DIR" "$CODEC_DIR"

download_file() {
  local repo="$1" dir="$2" file="$3"
  local url="${MIRROR}/${repo}/resolve/main/${file}"
  local dest="${dir}/${file}"

  if [ -f "$dest" ]; then
    local existing_size
    existing_size=$(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest" 2>/dev/null || echo 0)
    if [ "$existing_size" -gt 1024 ]; then
      echo "  [skip] ${file} already exists (${existing_size} bytes)"
      return 0
    fi
  fi

  echo "  [download] ${file}"
  # Retry up to 3 times for robustness against transient network errors.
  local attempt=1
  while [ "$attempt" -le 3 ]; do
    if curl -fSL --retry 2 --connect-timeout 30 -o "$dest" "$url"; then
      local got_size
      got_size=$(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest" 2>/dev/null || echo 0)
      echo "    -> ${got_size} bytes"
      return 0
    fi
    echo "    attempt ${attempt} failed, retrying..."
    attempt=$((attempt + 1))
    sleep 2
  done

  echo "  [FAILED] ${file} after 3 attempts"
  return 1
}

echo "=== Downloading TTS model files from ${MIRROR} ==="
for f in "${TTS_FILES[@]}"; do
  download_file "$TTS_REPO" "$TTS_DIR" "$f"
done

echo ""
echo "=== Downloading Audio Tokenizer model files from ${MIRROR} ==="
for f in "${CODEC_FILES[@]}"; do
  download_file "$CODEC_REPO" "$CODEC_DIR" "$f"
done

echo ""
echo "=== Download complete ==="
echo "TTS model:"
ls -lh "$TTS_DIR"/
echo ""
echo "Audio tokenizer:"
ls -lh "$CODEC_DIR"/
echo ""
echo "Total model size:"
du -sh models/
