import type { AudioSourceMode } from '../types';
export interface RendererRecordingResult {
  wavBlob: Blob;
  durationSec: number;
  mode: AudioSourceMode;
}

const PCM_WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) {
    return input;
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const sampleA = input[Math.min(idx, input.length - 1)];
    const sampleB = input[Math.min(idx + 1, input.length - 1)];
    output[i] = sampleA + (sampleB - sampleA) * frac;
  }

  return output;
}

export function encodeWavFromFloat32(
  chunks: Float32Array[],
  sourceSampleRate: number,
  targetSampleRate = 16000
): Uint8Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }

  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const samples = resampleLinear(merged, sourceSampleRate, targetSampleRate);
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(pos + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // AudioFormat = PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

export class RendererAudioCapture {
  private recording = false;
  private startTime = 0;
  private currentMode: AudioSourceMode = 'mixed';
  private audioContext: AudioContext | null = null;
  private sysStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private processorNode: AudioNode | null = null;
  private muteNode: GainNode | null = null;
  private workletUrl: string | null = null;
  private chunks: Float32Array[] = [];

  public isRecording(): boolean {
    return this.recording;
  }

  public async start(mode: AudioSourceMode = 'mixed'): Promise<void> {
    if (this.recording) {
      throw new Error('RECORDING_ALREADY_IN_PROGRESS');
    }

    this.chunks = [];
    this.currentMode = mode;

    try {
      if (mode === 'system' || mode === 'mixed') {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true,
          });
          // Stop video track immediately: only loopback system audio is needed
          for (const vt of displayStream.getVideoTracks()) {
            vt.stop();
            displayStream.removeTrack(vt);
          }
          if (displayStream.getAudioTracks().length > 0) {
            this.sysStream = displayStream;
          } else if (mode === 'system') {
            throw new Error('SYSTEM_AUDIO_UNAVAILABLE');
          }
        } catch (err) {
          if (mode === 'system') {
            throw err;
          }
          console.warn('[RendererAudio] System loopback unavailable, falling back to mic:', err);
        }
      }

      if (mode === 'mic' || mode === 'mixed') {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          if (mode === 'mic') {
            throw err;
          }
          console.warn('[RendererAudio] Microphone unavailable, continuing with system audio:', err);
        }
      }

      if (!this.sysStream && !this.micStream) {
        throw new Error('AUDIO_SOURCE_UNAVAILABLE');
      }

      try {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
      } catch {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const mixer = this.audioContext.createGain();
      mixer.channelCount = 1;
      mixer.channelCountMode = 'explicit';
      mixer.channelInterpretation = 'speakers';

      if (this.sysStream) {
        const sysSource = this.audioContext.createMediaStreamSource(this.sysStream);
        sysSource.connect(mixer);
      }
      if (this.micStream) {
        const micSource = this.audioContext.createMediaStreamSource(this.micStream);
        micSource.connect(mixer);
      }

      this.muteNode = this.audioContext.createGain();
      this.muteNode.gain.value = 0;

      if (this.audioContext.audioWorklet) {
        const blob = new Blob([PCM_WORKLET_CODE], { type: 'application/javascript' });
        this.workletUrl = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(this.workletUrl);
        const workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
        });
        workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
          if (this.recording && event.data && event.data.length > 0) {
            this.chunks.push(event.data);
          }
        };
        this.processorNode = workletNode;
      } else {
        const scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);
        scriptNode.onaudioprocess = (event) => {
          if (!this.recording) return;
          const channel = event.inputBuffer.getChannelData(0);
          this.chunks.push(new Float32Array(channel));
        };
        this.processorNode = scriptNode;
      }

      mixer.connect(this.processorNode);
      this.processorNode.connect(this.muteNode);
      this.muteNode.connect(this.audioContext.destination);

      this.startTime = Date.now();
      this.recording = true;
    } catch (err) {
      this.abort();
      throw err;
    }
  }

  public async stop(): Promise<RendererRecordingResult> {
    if (!this.recording) {
      throw new Error('NOT_RECORDING');
    }

    const durationSec = Math.round(((Date.now() - this.startTime) / 1000) * 10) / 10;
    const sampleRate = this.audioContext?.sampleRate || 16000;
    const capturedChunks = this.chunks;
    const mode = this.currentMode;

    this.cleanupResources();

    if (durationSec < 0.5) {
      throw new Error('AUDIO_TOO_SHORT');
    }

    const totalSamples = capturedChunks.reduce((sum, c) => sum + c.length, 0);
    if (totalSamples === 0) {
      throw new Error('AUDIO_EMPTY_OR_UNAVAILABLE');
    }

    const wavBytes = encodeWavFromFloat32(capturedChunks, sampleRate, 16000);
    const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });

    return {
      wavBlob,
      durationSec,
      mode,
    };
  }

  public abort(): void {
    this.cleanupResources();
  }

  private cleanupResources(): void {
    this.recording = false;
    this.chunks = [];

    try {
      this.processorNode?.disconnect();
    } catch {
      // ignore
    }
    this.processorNode = null;

    try {
      this.muteNode?.disconnect();
    } catch {
      // ignore
    }
    this.muteNode = null;

    for (const stream of [this.sysStream, this.micStream]) {
      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            // ignore
          }
        }
      }
    }
    this.sysStream = null;
    this.micStream = null;

    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
  }
}
