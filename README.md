# MOSS-TTS-Nano Web

A **fully browser-based** text-to-speech demo powered by
[MOSS-TTS-Nano](https://github.com/OpenMOSS/MOSS-TTS-Nano) (0.1B parameters).

Deployed on **GitHub Pages** — no server, no GPU, no backend. Models are
pre-packaged in this repository and loaded from the same origin, so any user
can open the page and start synthesising speech immediately.

## Features

- **Pure browser inference** via ONNX Runtime Web (WASM)
- **0.1B-parameter** multilingual TTS model (20 languages)
- **48 kHz stereo** audio output
- **Voice cloning** from a short reference clip
- **Realtime streaming decode** with low first-token latency
- **Pre-packaged models** — no download required at runtime

## How It Works

```
text → SentencePiece tokenizer → ONNX prefill → autoregressive decode
     → ONNX audio-tokenizer decode → 48 kHz PCM → Web Audio playback
```

All inference happens in the browser using `onnxruntime-web`. The model files
(ONNX graphs + external weight data) are stored in the `models/` directory and
served as static assets by GitHub Pages.

## Repository Structure

```
├── index.html                  # Main web page
├── app.js                      # Inference + UI bundle (ES module)
├── app.css                     # Styles
├── chrome-shim.js              # chrome.runtime/storage polyfill for web
├── coi-serviceworker.js        # COOP/COEP service worker (multi-threaded WASM)
├── model_store.js              # Model download/store helper (hf-mirror fallback)
├── tokenizer_sandbox.html/js   # SentencePiece tokenizer sandbox (iframe)
├── vendor/ort/                 # ONNX Runtime Web WASM files
├── assets/
│   ├── audio/                  # Built-in reference voice clips
│   └── voice_browser_metadata.json
├── models/                     # Pre-packaged ONNX model files (Git LFS)
│   ├── MOSS-TTS-Nano-100M-ONNX/
│   └── MOSS-Audio-Tokenizer-Nano-ONNX/
├── .github/workflows/deploy.yml  # GitHub Pages deployment
├── .gitattributes              # Git LFS tracking for large files
└── download_models.sh          # Script to (re)download models from mirror
```

## Deployment

### Prerequisites

1. **Git LFS** must be installed (the two `.data` weight files exceed GitHub's
   100 MB per-file limit):
   ```bash
   git lfs install
   ```

2. The model files must be present in `models/`. If they are missing, run:
   ```bash
   bash download_models.sh
   ```
   This downloads from `hf-mirror.com` (a domestic mirror of Hugging Face) so
   it works in China without a VPN.

### Push to GitHub

```bash
git add .
git commit -m "Deploy MOSS-TTS-Nano to GitHub Pages"
git push origin main
```

The `.github/workflows/deploy.yml` GitHub Action will:
1. Check out the repo **with LFS** (so real model binaries are included)
2. Upload the entire repository as the Pages artifact
3. Deploy to GitHub Pages

### Enable GitHub Pages

In the repository settings → **Pages**:
- **Source**: GitHub Actions
- The workflow handles the rest automatically.

## Local Development

To test locally, serve the repository root with any static file server that
supports range requests (needed for large model files):

```bash
# Python
python3 -m http.server 8080

# Or npx
npx serve .
```

Then open `http://localhost:8080`.

> **Note:** For multi-threaded WASM, the page needs `Cross-Origin-Opener-Policy:
> same-origin` and `Cross-Origin-Embedder-Policy: credentialless` headers. The
> included `coi-serviceworker.js` adds these automatically on HTTPS origins
> (including GitHub Pages). On `localhost` without HTTPS, it falls back to
> single-threaded mode.

## Model File Sizes

| File | Size | LFS |
|------|------|-----|
| `moss_tts_global_shared.data` | 420.6 MB | ✅ |
| `moss_tts_local_shared.data` | 219.1 MB | ✅ |
| `moss_audio_tokenizer_encode.data` | 42.4 MB | ✅ |
| `moss_audio_tokenizer_decode_shared.data` | 42.1 MB | ✅ |
| `ort-wasm-simd-threaded.wasm` | 11.5 MB | ✅ |
| Other ONNX graphs + configs | < 1 MB each | ❌ |

Total model size: ~728 MB (16 files).

## Credits

- [MOSS-TTS-Nano](https://github.com/OpenMOSS/MOSS-TTS-Nano) by OpenMOSS Team / MOSI.AI
- [MOSS-TTS-Nano-Reader](https://github.com/OpenMOSS/MOSS-TTS-Nano-Reader) — browser PoC code
- ONNX model weights from [HuggingFace](https://huggingface.co/OpenMOSS-Team) / [hf-mirror.com](https://hf-mirror.com)

## License

Apache 2.0 (following the upstream MOSS-TTS-Nano project).
