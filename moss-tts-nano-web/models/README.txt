此目录需要下载 ONNX 模型文件。

请运行项目根目录下的下载脚本:
```bash
python download_models.py
```

或手动从 HuggingFace 下载以下文件:

## TTS 模型 (MOSS-TTS-Nano-100M-ONNX)
从 https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX 下载:
- browser_poc_manifest.json
- tts_browser_onnx_meta.json
- tokenizer.model
- moss_tts_prefill.onnx
- moss_tts_decode_step.onnx
- moss_tts_local_decoder.onnx
- moss_tts_local_cached_step.onnx
- moss_tts_local_fixed_sampled_frame.onnx
- moss_tts_global_shared.data
- moss_tts_local_shared.data

## 音频分词器 (MOSS-Audio-Tokenizer-Nano-ONNX)
从 https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX 下载:
- codec_browser_onnx_meta.json
- moss_audio_tokenizer_encode.onnx
- moss_audio_tokenizer_encode.data
- moss_audio_tokenizer_decode_full.onnx
- moss_audio_tokenizer_decode_step.onnx
- moss_audio_tokenizer_decode_shared.data