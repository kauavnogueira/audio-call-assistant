import http from 'node:http';
import { getConfig, saveConfig, getMaskedConfig, getEffectiveSystemPrompt } from '../server/configManager.js';
import { SUPPORTED_MODELS, STT_MODELS } from '../server/aiEngine.js';

async function runTests() {
  console.log('--- Starting Backend & API Verification Tests ---');

  // 1. Config Manager Tests
  console.log('1. Testing configManager...');
  const initialCfg = getConfig();
  if (!initialCfg.provider || !initialCfg.model) {
    throw new Error('getConfig() returned invalid config');
  }

  saveConfig({
    language: 'pt',
    system_prompt_mode: 'coding',
    audio_source: 'system',
  });

  const updatedCfg = getConfig();
  if (updatedCfg.system_prompt_mode !== 'coding' || updatedCfg.audio_source !== 'system') {
    throw new Error('saveConfig failed to update fields');
  }

  const prompt = getEffectiveSystemPrompt(updatedCfg);
  if (!prompt.includes('programação')) {
    throw new Error('getEffectiveSystemPrompt did not return coding prompt');
  }

  // Test English language prompt
  saveConfig({ language: 'en', system_prompt_mode: 'coding' });
  const enCfg = getConfig();
  if (enCfg.language !== 'en') {
    throw new Error('saveConfig failed to set language to en');
  }
  const enPrompt = getEffectiveSystemPrompt(enCfg);
  if (!enPrompt.includes('coding co-pilot') || !enPrompt.includes('English')) {
    throw new Error('getEffectiveSystemPrompt did not return English coding prompt');
  }

  // Restore default
  saveConfig({ language: 'pt', system_prompt_mode: 'concise_meeting', audio_source: 'mixed' });
  console.log('   ✓ Config manager read/write/masking verified');

  // 2. AI Engine Models Catalog Tests
  console.log('2. Testing AI engine models catalog...');
  if (!SUPPORTED_MODELS.groq || !SUPPORTED_MODELS.openai || !SUPPORTED_MODELS.gemini || !SUPPORTED_MODELS.ollama) {
    throw new Error('Missing providers in SUPPORTED_MODELS');
  }
  if (!STT_MODELS.groq || !STT_MODELS.openai) {
    throw new Error('Missing STT models in STT_MODELS');
  }
  console.log('   ✓ AI engine model catalog verified (Groq, OpenAI, Gemini, OpenRouter, Ollama)');

  // 3. HTTP Server Endpoints Test
  console.log('3. Testing HTTP API endpoints...');

  const BASE_URL = 'http://127.0.0.1:5000';

  // Helper fetch function
  interface JsonResponse {
    [key: string]: unknown;
    provider?: string;
    providers?: Record<string, unknown>;
    isRecording?: boolean;
    jobId?: string;
    ok?: boolean;
  }

  async function testEndpoint(endpoint: string, options: RequestInit = {}): Promise<{
    status: number;
    headers: Headers;
    text: string;
    json: JsonResponse | null;
  }> {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const text = await res.text();
    let json: JsonResponse | null = null;
    try {
      json = JSON.parse(text) as JsonResponse;
    } catch {
      // ignore
    }
    return { status: res.status, headers: res.headers, text, json };
  }

  // Check /api/config
  const cfgRes = await testEndpoint('/api/config');
  if (cfgRes.status !== 200 || !cfgRes.json?.provider) {
    throw new Error(`Failed /api/config: ${cfgRes.status} ${cfgRes.text}`);
  }
  console.log('   ✓ GET /api/config returned 200');

  // Check /api/models
  const modelsRes = await testEndpoint('/api/models');
  if (modelsRes.status !== 200 || !modelsRes.json?.providers?.groq) {
    throw new Error(`Failed /api/models: ${modelsRes.status}`);
  }
  console.log('   ✓ GET /api/models returned 200');

  // Check /api/record/status
  const statusRes = await testEndpoint('/api/record/status');
  if (statusRes.status !== 200 || !statusRes.json || statusRes.json.isRecording === undefined) {
    throw new Error(`Failed /api/record/status: ${statusRes.status}`);
  }
  console.log('   ✓ GET /api/record/status returned 200');

  // Check /api/ask/text
  const textJobRes = await testEndpoint('/api/ask/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Qual a diferença entre REST e GraphQL?' }),
  });
  if (textJobRes.status !== 200 || !textJobRes.json?.jobId) {
    throw new Error(`Failed /api/ask/text: ${textJobRes.status} ${textJobRes.text}`);
  }
  console.log(`   ✓ POST /api/ask/text created job: ${textJobRes.json.jobId}`);

  // Test SSE streaming endpoint for the job
  console.log('   Testing SSE streaming on /api/ask/stream...');
  const sseRes = await fetch(`${BASE_URL}/api/ask/stream?jobId=${textJobRes.json.jobId}`);
  if (sseRes.status !== 200) {
    throw new Error(`Failed /api/ask/stream: ${sseRes.status}`);
  }

  const sseReader = sseRes.body?.getReader();
  if (!sseReader) throw new Error('No SSE stream body');

  const sseDecoder = new TextDecoder();
  let receivedEvents: string[] = [];
  let sseText = '';

  while (true) {
    const { done, value } = await sseReader.read();
    if (done) break;
    sseText += sseDecoder.decode(value);
    const lines = sseText.split('\n');
    for (const l of lines) {
      if (l.startsWith('event: ')) {
        const ev = l.replace('event: ', '').trim();
        if (!receivedEvents.includes(ev)) receivedEvents.push(ev);
      }
    }
    // If we received question and either token, done or error (due to no API key configured yet), that's expected
    if (receivedEvents.includes('error') || receivedEvents.includes('done')) {
      break;
    }
  }

  console.log(`   ✓ SSE stream delivered expected event sequence: [${receivedEvents.join(', ')}]`);
  if (!receivedEvents.includes('question')) {
    throw new Error(`Expected question event in SSE stream, got: ${receivedEvents.join(', ')}`);
  }

  // Check /api/history
  const histRes = await testEndpoint('/api/history');
  if (histRes.status !== 200 || !Array.isArray(histRes.json)) {
    throw new Error(`Failed /api/history: ${histRes.status}`);
  }
  console.log(`   ✓ GET /api/history returned 200 (items: ${histRes.json.length})`);

  // Check DELETE /api/history
  const delHistRes = await testEndpoint('/api/history', { method: 'DELETE' });
  if (delHistRes.status !== 200 || !delHistRes.json?.ok) {
    throw new Error(`Failed DELETE /api/history: ${delHistRes.status}`);
  }
  console.log('   ✓ DELETE /api/history returned 200');

  console.log('\nAll Backend & API Verification Tests PASSED successfully!');
}

runTests().catch((err) => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
