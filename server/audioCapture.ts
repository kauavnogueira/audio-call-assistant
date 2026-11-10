import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { getAppDataDir } from './configManager.js';

export type AudioSourceMode = 'mixed' | 'system' | 'mic';

export interface AudioRecordingResult {
  filePath: string;
  durationSec: number;
  mode: AudioSourceMode;
  fileSizeBytes: number;
}

export class AudioCaptureManager extends EventEmitter {
  private sysProcess: ChildProcess | null = null;
  private micProcess: ChildProcess | null = null;
  private recording = false;
  private startTime = 0;
  private currentMode: AudioSourceMode = 'mixed';

  private readonly tempDir = path.join(getAppDataDir(), 'temp');
  private readonly sysPath = path.join(this.tempDir, 'assistant_sys.wav');
  private readonly micPath = path.join(this.tempDir, 'assistant_mic.wav');
  private readonly finalPath = path.join(this.tempDir, 'assistant_question.wav');

  constructor() {
    super();
  }
  public isRecording(): boolean {
    return this.recording;
  }

  public getStatus() {
    return {
      isRecording: this.recording,
      elapsedSec: this.recording ? (Date.now() - this.startTime) / 1000 : 0,
      mode: this.currentMode,
    };
  }

  public startRecording(mode: AudioSourceMode = 'mixed'): void {
    if (process.platform !== 'linux') {
      throw new Error(
        'NATIVE_CAPTURE_LINUX_ONLY: On Windows, audio capture runs natively through Electron loopback.'
      );
    }
    if (this.recording) {
      throw new Error('RECORDING_ALREADY_IN_PROGRESS');
    }
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Clean up any stale files
    this.cleanTempFiles();

    this.currentMode = mode;
    this.startTime = Date.now();
    this.recording = true;
    this.emit('recording-change', true);
    try {
      if (mode === 'mixed' || mode === 'system') {
        this.sysProcess = this.spawnRecordProcess('@DEFAULT_AUDIO_SINK@', this.sysPath, true);
      }
      if (mode === 'mixed' || mode === 'mic') {
        this.micProcess = this.spawnRecordProcess('@DEFAULT_AUDIO_SOURCE@', this.micPath, false);
      }
    } catch (err) {
      this.abortRecording();
      throw new Error(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private spawnRecordProcess(target: string, outputPath: string, isSink = false): ChildProcess {
    const isFlatpak = fs.existsSync('/.flatpak-info');
    const binary = isFlatpak ? 'flatpak-spawn' : 'pw-record';
    const pwArgs = [
      '--target',
      target,
      '--rate',
      '16000',
      '--channels',
      '1',
      '--format',
      's16',
    ];

    if (isSink) {
      // In PipeWire, capturing from an audio sink requires stream.capture.sink=true to link to the sink's monitor
      pwArgs.push('-P', '{ stream.capture.sink = true }');
    }

    pwArgs.push(outputPath);
    const args = isFlatpak ? ['--host', 'pw-record', ...pwArgs] : pwArgs;
    const child = spawn(binary, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    child.stderr?.on('data', (data) => {
      const msg = data.toString();
      // Only log genuine errors, pw-record can be chatty on normal shutdown
      if (msg.includes('error') || msg.includes('failed')) {
        console.warn(`[pw-record ${target}] ${msg.trim()}`);
      }
    });

    child.on('error', (err) => {
      console.error(`[pw-record ${target}] process error:`, err);
    });

    return child;
  }

  public async stopRecording(): Promise<AudioRecordingResult> {
    if (!this.recording) {
      throw new Error('NOT_RECORDING');
    }

    const durationSec = (Date.now() - this.startTime) / 1000;
    this.recording = false;
    this.emit('recording-change', false);
    const promises: Promise<void>[] = [];
    if (this.sysProcess) {
      promises.push(this.stopProcess(this.sysProcess));
      this.sysProcess = null;
    }
    if (this.micProcess) {
      promises.push(this.stopProcess(this.micProcess));
      this.micProcess = null;
    }

    await Promise.all(promises);

    // Give the kernel / filesystem a brief moment to flush WAV headers
    await delay(150);

    // Duration check
    if (durationSec < 0.5) {
      this.cleanTempFiles();
      throw new Error('AUDIO_TOO_SHORT');
    }

    // Process output files according to mode
    if (this.currentMode === 'system') {
      if (!fs.existsSync(this.sysPath) || fs.statSync(this.sysPath).size <= 44) {
        throw new Error('AUDIO_EMPTY_OR_UNAVAILABLE');
      }
      fs.copyFileSync(this.sysPath, this.finalPath);
    } else if (this.currentMode === 'mic') {
      if (!fs.existsSync(this.micPath) || fs.statSync(this.micPath).size <= 44) {
        throw new Error('AUDIO_EMPTY_OR_UNAVAILABLE');
      }
      fs.copyFileSync(this.micPath, this.finalPath);
    } else {
      // Mixed mode
      const hasSys = fs.existsSync(this.sysPath) && fs.statSync(this.sysPath).size > 44;
      const hasMic = fs.existsSync(this.micPath) && fs.statSync(this.micPath).size > 44;

      if (!hasSys && !hasMic) {
        throw new Error('AUDIO_EMPTY_OR_UNAVAILABLE');
      }

      if (hasSys && hasMic) {
        const sysBuf = fs.readFileSync(this.sysPath);
        const micBuf = fs.readFileSync(this.micPath);
        const mixedBuf = mixWavBuffers(sysBuf, micBuf);
        fs.writeFileSync(this.finalPath, mixedBuf);
      } else if (hasSys) {
        fs.copyFileSync(this.sysPath, this.finalPath);
      } else {
        fs.copyFileSync(this.micPath, this.finalPath);
      }
    }

    const stat = fs.statSync(this.finalPath);
    if (stat.size <= 44) {
      throw new Error('AUDIO_TOO_SHORT');
    }

    return {
      filePath: this.finalPath,
      durationSec: Math.round(durationSec * 10) / 10,
      mode: this.currentMode,
      fileSizeBytes: stat.size,
    };
  }

  private stopProcess(proc: ChildProcess): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    if (proc.killed || proc.exitCode !== null) {
      resolve();
      return promise;
    }

    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve();
    }, 1500);

    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    try {
      proc.kill('SIGINT');
    } catch {
      clearTimeout(timer);
      resolve();
    }

    return promise;
  }


  private abortRecording(): void {
    const wasRecording = this.recording;
    this.recording = false;
    if (wasRecording) {
      this.emit('recording-change', false);
    }
    if (this.sysProcess) {
      try {
        this.sysProcess.kill('SIGKILL');
      } catch {
        // ignore
      }
      this.sysProcess = null;
    }
    if (this.micProcess) {
      try {
        this.micProcess.kill('SIGKILL');
      } catch {
        // ignore
      }
      this.micProcess = null;
    }
  }

  private cleanTempFiles(): void {
    for (const f of [this.sysPath, this.micPath, this.finalPath]) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}
export function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/**
 * Parses RIFF WAV and finds the start and length of the 'data' chunk.
 */
export function extractPcmData(wavBuf: Buffer): { dataOffset: number; dataLength: number; sampleRate: number; channels: number } {
  if (wavBuf.length < 44) {
    throw new Error('Buffer too small for WAV header');
  }

  const riff = wavBuf.toString('ascii', 0, 4);
  const wave = wavBuf.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV header format');
  }

  let offset = 12;
  let sampleRate = 16000;
  let channels = 1;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= wavBuf.length) {
    const chunkId = wavBuf.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuf.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      channels = wavBuf.readUInt16LE(offset + 10);
      sampleRate = wavBuf.readUInt32LE(offset + 12);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, wavBuf.length - dataOffset);
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataOffset === -1) {
    // Fallback standard 44-byte header if chunk search fails
    dataOffset = 44;
    dataLength = Math.max(0, wavBuf.length - 44);
  }

  return { dataOffset, dataLength, sampleRate, channels };
}

/**
 * Mixes two 16-bit mono 16kHz PCM WAV buffers in pure Node.js memory.
 * Clamps sums to 16-bit signed integer range [-32768, 32767].
 */
export function mixWavBuffers(bufA: Buffer, bufB: Buffer): Buffer {
  const pcmA = extractPcmData(bufA);
  const pcmB = extractPcmData(bufB);

  const numSamplesA = Math.floor(pcmA.dataLength / 2);
  const numSamplesB = Math.floor(pcmB.dataLength / 2);
  const maxSamples = Math.max(numSamplesA, numSamplesB);

  const mixedDataSize = maxSamples * 2;
  const outBuf = Buffer.alloc(44 + mixedDataSize);

  // Write RIFF Header
  outBuf.write('RIFF', 0, 'ascii');
  outBuf.writeUInt32LE(36 + mixedDataSize, 4); // ChunkSize: 36 + SubChunk2Size
  outBuf.write('WAVE', 8, 'ascii');

  // Write 'fmt ' Subchunk
  outBuf.write('fmt ', 12, 'ascii');
  outBuf.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  outBuf.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  outBuf.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  outBuf.writeUInt32LE(16000, 24); // SampleRate (16000 Hz)
  outBuf.writeUInt32LE(32000, 28); // ByteRate (16000 * 1 * 2 = 32000)
  outBuf.writeUInt16LE(2, 32);  // BlockAlign (1 * 2 = 2 bytes)
  outBuf.writeUInt16LE(16, 34); // BitsPerSample (16 bits)

  // Write 'data' Subchunk
  outBuf.write('data', 36, 'ascii');
  outBuf.writeUInt32LE(mixedDataSize, 40);

  // Mix samples
  for (let i = 0; i < maxSamples; i++) {
    let sampleA = 0;
    let sampleB = 0;

    if (i < numSamplesA) {
      sampleA = bufA.readInt16LE(pcmA.dataOffset + i * 2);
    }
    if (i < numSamplesB) {
      sampleB = bufB.readInt16LE(pcmB.dataOffset + i * 2);
    }

    const mixed = sampleA + sampleB;
    const clamped = Math.max(-32768, Math.min(32767, mixed));
    outBuf.writeInt16LE(clamped, 44 + i * 2);
  }

  return outBuf;
}
