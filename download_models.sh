#!/usr/bin/env bash
# download_models.sh — 从 hf-mirror.com（HuggingFace 国内镜像）下载 ONNX 模型文件
# 超过 100MB 的文件自动分块（GitHub Pages 单文件限制 100MB）
set -euo pipefail

MIRROR="https://hf-mirror.com"
CHUNK_SIZE=94371840  # 90MB

TTS_REPO="OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX"
CODEC_REPO="OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"
TTS_DIR="models/MOSS-TTS-Nano-100M-ONNX"
CODEC_DIR="models/MOSS-Audio-Tokenizer-Nano-ONNX"

mkdir -p "$TTS_DIR" "$CODEC_DIR"

# 下载单个文件，带重试
download_file() {
  local url="$1" dest="$2" expected_size="${3:-0}" max_attempts="${4:-5}"
  if [ -f "$dest" ] || [ -f "${dest}.0" ]; then
    echo "[跳过] $(basename "$dest") 已存在"
    return 0
  fi
  local attempt=1
  while [ "$attempt" -le "$max_attempts" ]; do
    echo "[下载] $(basename "$dest") (尝试 $attempt/$max_attempts)"
    if curl -fSL --retry 3 --retry-delay 5 --connect-timeout 60 --max-time 1800 -o "$dest" "$url"; then
      if [ "$expected_size" -gt 0 ]; then
        local got_size
        got_size=$(stat -c%s "$dest" 2>/dev/null || echo 0)
        if [ "$got_size" -eq "$expected_size" ]; then
          echo "[OK] $(basename "$dest"): $got_size bytes"
          return 0
        else
          echo "[不完整] $got_size / $expected_size bytes，重试..."
          rm -f "$dest"
        fi
      else
        echo "[OK] $(basename "$dest") 下载完成"
        return 0
      fi
    else
      echo "[失败] curl 错误"
      rm -f "$dest"
    fi
    attempt=$((attempt + 1))
    sleep 3
  done
  echo "[错误] $(basename "$dest") 下载失败"
  return 1
}

# 下载并分块（仅对超过 100MB 的文件分块）
download_and_chunk() {
  local url="$1" dest_dir="$2" filename="$3" expected_size="$4"
  local dest_path="${dest_dir}/${filename}"

  # 如果分块文件已存在，跳过
  if [ -f "${dest_path}.0" ]; then
    echo "[跳过] ${filename} 分块已存在"
    return 0
  fi
  # 如果原始文件已存在且不需要分块，跳过
  if [ -f "$dest_path" ] && [ "$expected_size" -le 104857600 ]; then
    echo "[跳过] ${filename} 已存在"
    return 0
  fi

  download_file "$url" "$dest_path" "$expected_size" || return 1

  # 检查是否需要分块
  local file_size
  file_size=$(stat -c%s "$dest_path")
  if [ "$file_size" -gt 104857600 ]; then
    echo "[分块] ${filename} (${file_size} bytes > 100MB)，正在分块..."
    split -b "$CHUNK_SIZE" -d "$dest_path" "${dest_path}."
    local chunk_count
    chunk_count=$(ls "${dest_path}."* | wc -l)
    echo "[OK] 分成 ${chunk_count} 块"
    rm -f "$dest_path"
    echo "[清理] 已删除原始大文件 ${filename}"
  else
    echo "[OK] ${filename} (${file_size} bytes < 100MB)，无需分块"
  fi
}

echo "========================================="
echo "  下载 MOSS-TTS-Nano ONNX 模型文件"
echo "  镜像源: $MIRROR"
echo "========================================="

# TTS 模型小文件
TTS_SMALL_FILES=(
  "browser_poc_manifest.json:503354"
  "tts_browser_onnx_meta.json:4487"
  "tokenizer.model:470897"
  "moss_tts_prefill.onnx:283305"
  "moss_tts_decode_step.onnx:291483"
  "moss_tts_local_decoder.onnx:49231"
  "moss_tts_local_cached_step.onnx:53685"
  "moss_tts_local_fixed_sampled_frame.onnx:471262"
)

for entry in "${TTS_SMALL_FILES[@]}"; do
  IFS=':' read -r filename expected_size <<< "$entry"
  download_file "${MIRROR}/${TTS_REPO}/resolve/main/${filename}" "${TTS_DIR}/${filename}" "$expected_size"
done

# TTS 模型大文件（需要分块）
echo ""
echo "=== 下载大文件（将自动分块）==="
download_and_chunk \
  "${MIRROR}/${TTS_REPO}/resolve/main/moss_tts_global_shared.data" \
  "$TTS_DIR" \
  "moss_tts_global_shared.data" \
  440813568

download_and_chunk \
  "${MIRROR}/${TTS_REPO}/resolve/main/moss_tts_local_shared.data" \
  "$TTS_DIR" \
  "moss_tts_local_shared.data" \
  229678080

# Codec 模型小文件
CODEC_SMALL_FILES=(
  "codec_browser_onnx_meta.json:17036"
  "moss_audio_tokenizer_encode.onnx:815775"
  "moss_audio_tokenizer_decode_full.onnx:681902"
  "moss_audio_tokenizer_decode_step.onnx:351400"
)

for entry in "${CODEC_SMALL_FILES[@]}"; do
  IFS=':' read -r filename expected_size <<< "$entry"
  download_file "${MIRROR}/${CODEC_REPO}/resolve/main/${filename}" "${CODEC_DIR}/${filename}" "$expected_size"
done

# Codec 模型数据文件（42MB，不需要分块）
echo ""
echo "=== 下载 Codec 数据文件 ==="
download_and_chunk \
  "${MIRROR}/${CODEC_REPO}/resolve/main/moss_audio_tokenizer_encode.data" \
  "$CODEC_DIR" \
  "moss_audio_tokenizer_encode.data" \
  44507136

download_and_chunk \
  "${MIRROR}/${CODEC_REPO}/resolve/main/moss_audio_tokenizer_decode_shared.data" \
  "$CODEC_DIR" \
  "moss_audio_tokenizer_decode_shared.data" \
  44198912

echo ""
echo "========================================="
echo "  所有模型文件下载完成"
echo "========================================="
echo ""
echo "TTS 模型文件:"
ls -lh "$TTS_DIR"/
echo ""
echo "Codec 模型文件:"
ls -lh "$CODEC_DIR"/
