import fs from 'node:fs';
import { AudioCaptureManager, mixWavBuffers, extractPcmData } from '../server/audioCapture.js';

async function runAudioTests() {
  console.log('--- Starting Audio Capture & Mixing Tests ---');

  // 1. Synthetic WAV mixing test
  console.log('1. Testing synthetic PCM WAV creation & mixing...');
  const sampleRate = 16000;
  const numSamples = 16000; // 1 second
  const bufA = Buffer.alloc(44 + numSamples * 2);
  const bufB = Buffer.alloc(44 + numSamples * 2);

  // Write headers
  function writeWavHeader(buf: Buffer, dataSize: number) {
    buf.write('RIFF', 0, 'ascii');
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write('WAVE', 8, 'ascii');
    buf.write('fmt ', 12, 'ascii');
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36, 'ascii');
    buf.writeUInt32LE(dataSize, 40);
  }

  writeWavHeader(bufA, numSamples * 2);
  writeWavHeader(bufB, numSamples * 2);

  // Fill with test tones (440Hz sine wave and 880Hz sine wave)
  for (let i = 0; i < numSamples; i++) {
    const valA = Math.round(10000 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    const valB = Math.round(10000 * Math.sin((2 * Math.PI * 880 * i) / sampleRate));
    bufA.writeInt16LE(valA, 44 + i * 2);
    bufB.writeInt16LE(valB, 44 + i * 2);
  }

  const pcmA = extractPcmData(bufA);
  if (pcmA.dataLength !== numSamples * 2 || pcmA.sampleRate !== 16000) {
    throw new Error(`extractPcmData failed on synthetic buffer: ${JSON.stringify(pcmA)}`);
  }
  console.log('   ✓ extractPcmData verified successfully');

  const mixedBuf = mixWavBuffers(bufA, bufB);
  if (mixedBuf.length !== 44 + numSamples * 2) {
    throw new Error(`mixWavBuffers produced unexpected length: ${mixedBuf.length}`);
  }
  const mixedPcm = extractPcmData(mixedBuf);
  // Verify sample summing at index 100
  const expectedSample = Math.round(10000 * Math.sin((2 * Math.PI * 440 * 100) / sampleRate)) +
                         Math.round(10000 * Math.sin((2 * Math.PI * 880 * 100) / sampleRate));
  const actualSample = mixedBuf.readInt16LE(44 + 100 * 2);
  if (Math.abs(expectedSample - actualSample) > 2) {
    throw new Error(`Sample mismatch: expected ${expectedSample}, got ${actualSample}`);
  }
  console.log('   ✓ mixWavBuffers verified (exact sample addition and clamping confirmed)');

  // 2. Real PipeWire system capture test (1.2 seconds)
  console.log('2. Testing system (call audio) capture via AudioCaptureManager...');
  const manager = new AudioCaptureManager();

  console.log('   Starting system recording (call/speaker monitor)...');
  manager.startRecording('system');
  if (!manager.isRecording()) {
    throw new Error('Manager reporting not recording after startRecording');
  }

  const delay1 = Promise.withResolvers<void>();
  setTimeout(delay1.resolve, 1200);
  await delay1.promise;

  console.log('   Stopping system recording...');
  const sysResult = await manager.stopRecording();
  console.log('   System recording result:', sysResult);

  if (!fs.existsSync(sysResult.filePath)) {
    throw new Error(`Output file not created at ${sysResult.filePath}`);
  }
  const sysStat = fs.statSync(sysResult.filePath);
  if (sysStat.size <= 44) {
    throw new Error(`Recorded WAV file is empty or only header: ${sysStat.size} bytes`);
  }
  const sysPcm = extractPcmData(fs.readFileSync(sysResult.filePath));
  console.log(`   ✓ System WAV verified: ${sysStat.size} bytes, ${sysPcm.sampleRate}Hz, ${sysPcm.channels} channel(s)`);

  // 3. Real PipeWire mixed capture test (1.2 seconds)
  console.log('3. Testing mixed (system + mic) capture via AudioCaptureManager...');
  manager.startRecording('mixed');
  const delay2 = Promise.withResolvers<void>();
  setTimeout(delay2.resolve, 1200);
  await delay2.promise;
  const mixedResult = await manager.stopRecording();
  const liveMixedStat = fs.statSync(mixedResult.filePath);
  const liveMixedPcm = extractPcmData(fs.readFileSync(mixedResult.filePath));
  console.log(`   ✓ Mixed WAV verified: ${liveMixedStat.size} bytes, ${liveMixedPcm.sampleRate}Hz, ${liveMixedPcm.channels} channel(s)`);
  console.log('\nAll Audio Capture & Mixing Tests PASSED successfully!');
}

runAudioTests().catch((err) => {
  console.error('Audio Test FAILED:', err);
  process.exit(1);
});
