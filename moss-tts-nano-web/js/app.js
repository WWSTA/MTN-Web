// MOSS-TTS-Nano Web App - UI Logic
import { createBrowserOnnxTtsRuntime } from './browser_onnx_runtime.js';

// ---- DOM Elements ----
const $ = (id) => document.getElementById(id);

const modelPathInput = $('model-path');
const cpuThreadsInput = $('cpu-threads');
const btnLoadModel = $('btn-load-model');
const statusDot = $('status-dot');
const statusText = $('status-text');
const progressFill = $('progress-fill');
const logArea = $('log-output');
const voiceSelect = $('voice-select');
const sampleSelect = $('sample-select');
const voiceFileInput = $('voice-file');
const ttsTextInput = $('tts-text');
const sampleModeSelect = $('sample-mode');
const streamingSelect = $('streaming');
const btnGenerate = $('btn-generate');
const btnStop = $('btn-stop');
const audioPanel = $('audio-panel');
const audioPlayer = $('audio-player');

// ---- State ----
let runtime = null;
let cancelled = false;
let audioContext = null;
let generatedBlob = null;

// ---- Logging ----
function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  logArea.textContent += `[${timestamp}] ${message}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function setProgress(percent) {
  progressFill.style.width = Math.min(100, Math.max(0, percent)) + '%';
}

// ---- Initialize ----
function init() {
  addLog('MOSS-TTS-Nano 浏览器端语音合成已就绪');
  addLog('请配置模型路径并点击"加载模型"');
  setStatus('loading', '等待模型加载...');
  btnLoadModel.disabled = false;

  // Set default model path
  modelPathInput.value = './models';
}

// ---- Load Model ----
btnLoadModel.addEventListener('click', async () => {
  const modelPath = modelPathInput.value.trim() || './models';
  const threadCount = parseInt(cpuThreadsInput.value, 10) || 4;

  btnLoadModel.disabled = true;
  setStatus('loading', '正在加载模型...');
  setProgress(5);
  addLog(`模型路径: ${modelPath}`);
  addLog(`CPU 线程数: ${threadCount}`);

  try {
    // Create runtime
    runtime = createBrowserOnnxTtsRuntime({
      logger: (msg) => addLog(msg),
    });

    addLog('配置 ONNX 运行时...');
    setProgress(10);

    await runtime.configure({
      modelPath: modelPath,
      threadCount: threadCount,
    });

    addLog('加载模型清单...');
    setProgress(20);

    addLog('加载分词器...');
    await runtime.ensureTokenizerLoaded();
    setProgress(40);

    addLog('加载 ONNX 模型会话...');
    await runtime.ensureSynthesisLoaded();
    setProgress(70);

    addLog('预热推理引擎...');
    await runtime.warmup();
    setProgress(100);

    // Populate voices
    const voices = runtime.listBuiltinVoices();
    const samples = runtime.listTextSamples();

    voiceSelect.innerHTML = '';
    voices.forEach((v, i) => {
      const option = document.createElement('option');
      option.value = v.name || v.voice_name || `voice_${i}`;
      option.textContent = `${v.name || v.voice_name || `Voice ${i}`} (${v.lang || v.language || 'multi'})`;
      voiceSelect.appendChild(option);
    });

    sampleSelect.innerHTML = '';
    samples.forEach((s, i) => {
      const option = document.createElement('option');
      option.value = s.text || '';
      option.textContent = (s.text || '').substring(0, 60) + (s.text && s.text.length > 60 ? '...' : '');
      if (option.textContent) {
        sampleSelect.appendChild(option);
      }
    });

    // Enable controls
    btnGenerate.disabled = false;
    setStatus('ready', '模型已就绪');
    addLog(`模型加载完成！内置音色: ${voices.length} 个`);

    // Apply sample text
    if (samples.length > 0 && samples[0].text) {
      ttsTextInput.value = samples[0].text;
    }
  } catch (error) {
    setStatus('error', '模型加载失败');
    setProgress(0);
    addLog(`错误: ${error.message}`);
    console.error('Model load error:', error);
    btnLoadModel.disabled = false;
  }
});

// ---- Sample Text Selection ----
sampleSelect.addEventListener('change', () => {
  if (sampleSelect.value) {
    ttsTextInput.value = sampleSelect.value;
  }
});

// ---- Generate ----
btnGenerate.addEventListener('click', async () => {
  if (!runtime) {
    addLog('错误: 请先加载模型');
    return;
  }

  const text = ttsTextInput.value.trim();
  if (!text) {
    addLog('错误: 请输入要合成的文本');
    return;
  }

  const voiceName = voiceSelect.value;
  const sampleMode = sampleModeSelect.value;
  const streaming = streamingSelect.value === 'true';
  const maxTextTokens = 75;

  cancelled = false;
  btnGenerate.disabled = true;
  btnStop.disabled = false;
  setStatus('generating', '正在生成语音...');
  setProgress(0);
  addLog(`开始合成: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

  const audioChunks = [];
  let totalSamples = 0;

  try {
    const result = await runtime.synthesizeVoiceClone({
      text: text,
      voiceName: voiceName,
      sampleMode: sampleMode,
      doSample: sampleMode !== 'greedy',
      streaming: streaming,
      enableNormalizeTtsText: true,
      enableWeTextProcessing: false,
      voiceCloneMaxTextTokens: maxTextTokens,
      isCancelled: () => cancelled,
      onPreparedText: (preparedText) => {
        addLog(`文本预处理: ${preparedText.text.substring(0, 80)}${preparedText.text.length > 80 ? '...' : ''}`);
      },
      onAudioChunk: async (chunk) => {
        if (cancelled) return;
        for (const channelData of chunk.chunkData) {
          audioChunks.push(new Float32Array(channelData));
          totalSamples += channelData.length;
        }
        const progress = Math.min(90, 10 + audioChunks.length * 5);
        setProgress(progress);
      },
    });

    setProgress(95);
    addLog(`合成完成！共 ${result.textChunks.length} 个文本块, ${result.outputs.length} 个输出`);

    // Combine audio chunks
    if (audioChunks.length > 0) {
      const sampleRate = runtime.codecMeta?.codec_config?.sample_rate || 48000;
      const channels = runtime.codecMeta?.codec_config?.channels || 2;

      // Interleave channels
      const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
      const interleaved = new Float32Array(totalLength);

      if (channels === 2) {
        // Stereo interleaving
        for (let i = 0; i < audioChunks.length; i += 2) {
          const left = audioChunks[i] || new Float32Array(0);
          const right = audioChunks[i + 1] || new Float32Array(0);
          const offset = i > 0 ? audioChunks.slice(0, i).reduce((s, c) => s + c.length, 0) : 0;
          for (let j = 0; j < Math.max(left.length, right.length); j++) {
            interleaved[offset + j * 2] = left[j] || 0;
            interleaved[offset + j * 2 + 1] = right[j] || 0;
          }
        }
      } else {
        // Mono or other - concatenate
        let offset = 0;
        for (const chunk of audioChunks) {
          interleaved.set(chunk, offset);
          offset += chunk.length;
        }
      }

      // Create WAV blob
      const wavBlob = createWavBlob(interleaved, sampleRate, channels);
      const url = URL.createObjectURL(wavBlob);

      // Clean up previous blob
      if (generatedBlob) {
        URL.revokeObjectURL(audioPlayer.src);
      }
      generatedBlob = url;

      audioPlayer.src = url;
      audioPanel.style.display = 'block';
      addLog(`音频已生成: ${(totalSamples / sampleRate).toFixed(1)} 秒, ${sampleRate}Hz, ${channels}声道`);
    }

    setProgress(100);
    setStatus('ready', '模型已就绪');
  } catch (error) {
    if (error.message?.includes('cancelled') || cancelled) {
      addLog('合成已取消');
      setStatus('ready', '模型已就绪');
    } else {
      addLog(`合成错误: ${error.message}`);
      console.error('Synthesis error:', error);
      setStatus('error', '合成失败');
    }
    setProgress(0);
  } finally {
    btnGenerate.disabled = false;
    btnStop.disabled = true;
  }
});

// ---- Stop ----
btnStop.addEventListener('click', () => {
  cancelled = true;
  addLog('正在停止...');
  btnStop.disabled = true;
});

// ---- Voice File Upload ----
voiceFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  addLog(`上传参考音频: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

  try {
    // Decode audio
    const arrayBuffer = await file.arrayBuffer();
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    addLog(`音频解码完成: ${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);
    // Note: Voice cloning via uploaded audio requires encoding through the codec
    // This is a simplified version - full implementation needs encode + storage
    addLog('提示: 语音克隆功能需要模型支持编码参考音频');
  } catch (error) {
    addLog(`音频解码失败: ${error.message}`);
  }
});

// ---- WAV Creation ----
function createWavBlob(samples, sampleRate, numChannels) {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 32768 : sample * 32767;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ---- Start ----
init();