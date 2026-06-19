# MOSS-TTS-Nano Web

基于 [MOSS-TTS-Nano](https://github.com/OpenMOSS/MOSS-TTS-Nano)（0.1B 参数）的**纯浏览器端**文字转语音演示。

部署在 **GitHub Pages** 上 —— 无需服务器、无需 GPU、无需后端。模型文件已预置在仓库中，从同源加载，打开页面即可使用。

## 功能特性

- **纯浏览器推理**：通过 ONNX Runtime Web (WASM) 运行
- **0.1B 参数**多语言 TTS 模型（支持 20 种语言）
- **48 kHz 立体声**音频输出
- **声音克隆**：从简短的参考音频中克隆音色
- **实时流式解码**：低首字延迟，边生成边播放
- **模型预置**：无需运行时下载，即开即用

## 工作原理

```
文本 → SentencePiece 分词器 → ONNX prefill → 自回归解码
     → ONNX 音频分词器解码 → 48 kHz PCM → Web Audio 播放
```

所有推理均在浏览器中通过 `onnxruntime-web` 完成。模型文件（ONNX 图 + 外部权重数据）存储在 `models/` 目录中，作为静态资源由 GitHub Pages 提供。

## 仓库结构

```
├── index.html                  # 主页面
├── app.js                      # 推理 + UI 打包文件（ES 模块）
├── app.css                     # 样式表
├── chrome-shim.js              # chrome.runtime/storage 网页垫片
├── coi-serviceworker.js        # COOP/COEP 跨域隔离 Service Worker（多线程 WASM）
├── model_store.js              # 模型下载/存储助手（hf-mirror 备用源）
├── tokenizer_sandbox.html/js   # SentencePiece 分词器沙盒（iframe）
├── vendor/ort/                 # ONNX Runtime Web WASM 文件
├── assets/
│   ├── audio/                  # 内置参考语音片段
│   └── voice_browser_metadata.json
├── models/                     # 预置 ONNX 模型文件（Git LFS）
│   ├── MOSS-TTS-Nano-100M-ONNX/
│   └── MOSS-Audio-Tokenizer-Nano-ONNX/
├── .github/workflows/deploy.yml  # GitHub Pages 部署工作流
├── .gitattributes              # Git LFS 追踪配置
└── download_models.sh          # 从镜像站（重新）下载模型的脚本
```

## 部署

### 前置条件

1. 必须安装 **Git LFS**（两个 `.data` 权重文件超过 GitHub 的 100 MB 单文件限制）：
   ```bash
   git lfs install
   ```

2. 模型文件必须存在于 `models/` 目录中。如果缺失，运行：
   ```bash
   bash download_models.sh
   ```
   此脚本从 `hf-mirror.com`（Hugging Face 国内镜像）下载，无需 VPN。

### 推送到 GitHub

```bash
git add .
git commit -m "部署 MOSS-TTS-Nano 到 GitHub Pages"
git push origin main
```

`.github/workflows/deploy.yml` GitHub Action 工作流将：
1. 检出仓库（**含 LFS**，确保真实模型文件被包含）
2. 验证 LFS 文件不是指针文件
3. 上传整个仓库作为 Pages 制品
4. 部署到 GitHub Pages

### 启用 GitHub Pages

在仓库设置 → **Pages** 中：
- **Source**：选择 GitHub Actions
- 工作流会自动处理其余步骤。

## 本地开发

在本地测试时，使用支持 Range 请求的静态文件服务器（大型模型文件需要）：

```bash
# Python
python3 -m http.server 8080

# 或 npx
npx serve .
```

然后打开 `http://localhost:8080`。

> **注意：** 多线程 WASM 需要浏览器设置 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: credentialless` 响应头。项目中的 `coi-serviceworker.js` 会在 HTTPS 来源（包括 GitHub Pages）上自动添加这些头。在 `localhost` 上由于没有 HTTPS，会降级为单线程模式。

## 页面使用说明

### 1. 模型源
- 确认模型根目录（默认 `models`）
- 点击「加载并准备」加载分词器、ONNX 会话并预热
- 加载完成后状态栏会显示「模型加载完成」

### 2. 生成选项
- **采样模式**：固定采样帧（默认，快速）或全采样
- **WeTextProcessing**：多语言文本正则化
- **文本规范化**：输入文本预处理
- 其余参数保持默认即可获得良好效果

### 3. 语音选择
- 选择内置或已上传的语音音色
- 输入要合成的文本（支持 20 种语言）
- 点击「非流式合成」（完整生成后播放）或「实时流式解码」（边生成边播放）

### 4. 上传语音
- 填写名称和分组
- 上传一段清晰的单人语音片段（建议 3-10 秒）
- 点击「编码并保存」，编码后在语音列表中可用

### 5. 状态与日志
- **状态栏**：显示当前操作状态
- **命令解释**：对当前状态/日志的中文解释
- **运行日志**：以 `[时间戳]` 格式记录每一步详细操作

## 状态栏命令解释

| 状态信息 | 含义 |
|---------|------|
| Browser ONNX PoC script initialized | 页面初始化完成，推理引擎已就绪 |
| Selected local model path | 已确认模型文件路径 |
| Model path saved | 路径已保存到浏览器本地存储 |
| Loading browser ONNX assets | 正在加载分词器、ONNX 会话并预热（约 1-3 分钟） |
| loaded and warmed up | 模型加载完成，可以开始合成 |
| Manifest resolved | 模型清单文件解析完成 |
| Loaded model bytes | 正在加载 ONNX 模型文件到内存 |
| Loaded external data bytes | 正在加载外部权重数据（.data 文件） |
| Tokenizer loaded via sandbox | SentencePiece 分词器加载完成 |
| Creating ORT session | 正在创建 ONNX 推理会话 |
| ORT session ready | ONNX 推理会话创建完成 |
| Running realtime streaming decode | 正在实时流式解码（边生成边播放） |
| Running non-streaming synthesis | 正在非流式合成（完整生成后播放） |
| Generation stopped at step | 生成在指定步数停止（通常表示已完成） |
| Streaming chunk queued | 音频块已生成并加入播放队列 |
| playback queued | 合成完成，音频已加入播放队列 |
| Voice list refreshed | 语音列表已刷新 |
| Encoding uploaded prompt audio | 正在编码上传的参考音频 |
| Uploaded voice saved | 自定义语音已保存到本地存储 |

### 常见错误

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| Enter a valid model path | 未设置模型路径 | 输入 `models` 并点击「应用路径」 |
| Packaged browser_onnx models missing | 模型文件缺失 | 系统将自动下载，或手动运行 `download_models.sh` |
| Initial metadata load skipped | 元数据加载失败 | 检查模型文件是否完整，路径是否正确 |
| Full codec decode failed | 编解码器降级 | 自动切换到增量模式，通常不影响输出 |
| 加载超时 / 无响应 | 大型模型文件加载慢 | 耐心等待 1-3 分钟，首次加载较慢 |

## 模型文件大小

| 文件 | 大小 | LFS |
|------|------|-----|
| `moss_tts_global_shared.data` | 420.6 MB | ✅ |
| `moss_tts_local_shared.data` | 219.1 MB | ✅ |
| `moss_audio_tokenizer_encode.data` | 42.4 MB | ✅ |
| `moss_audio_tokenizer_decode_shared.data` | 42.1 MB | ✅ |
| `ort-wasm-simd-threaded.wasm` | 11.5 MB | ✅ |
| 其他 ONNX 图 + 配置文件 | < 1 MB | ❌ |

模型总大小：约 728 MB（16 个文件）。

## 致谢

- [MOSS-TTS-Nano](https://github.com/OpenMOSS/MOSS-TTS-Nano) by OpenMOSS Team / MOSI.AI
- [MOSS-TTS-Nano-Reader](https://github.com/OpenMOSS/MOSS-TTS-Nano-Reader) — 浏览器 PoC 代码
- ONNX 模型权重来自 [HuggingFace](https://huggingface.co/OpenMOSS-Team) / [hf-mirror.com](https://hf-mirror.com)

## 许可证

Apache 2.0（遵循上游 MOSS-TTS-Nano 项目）。