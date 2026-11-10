import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getConfig,
  saveConfig,
  getMaskedConfig,
  getAppDataDir,
  AppConfig,
} from './configManager.js';
import {
  AudioCaptureManager,
  AudioSourceMode,
} from './audioCapture.js';
import {
  transcribeAudio,
  streamAIResponse,
  SUPPORTED_MODELS,
  STT_MODELS,
} from './aiEngine.js';

const serverDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

function resolveDistClientDir(): string {
  const candidates = [
    path.resolve(serverDir, '../dist/client'),
    path.resolve(process.cwd(), 'dist/client'),
    path.resolve(serverDir, '../client'),
    path.resolve(process.cwd(), 'client'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) {
      return c;
    }
  }
  return candidates[0];
}

const DIST_CLIENT_DIR = resolveDistClientDir();
const DEFAULT_PORT = Number(process.env.PORT) || 5000;
type ConfigUpdateListener = (config: AppConfig) => void;
type RecordingStateListener = (isRecording: boolean) => void;
const configListeners = new Set<ConfigUpdateListener>();

interface AudioJob {
  id: string;
  filePath?: string;
  questionText?: string;
  durationSec?: number;
  mode?: AudioSourceMode;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  question: string;
  answer: string;
  provider: string;
  model: string;
  durationSec?: number;
}

export const audioCapture = new AudioCaptureManager();
const pendingJobs = new Map<string, AudioJob>();
const sessionHistory: HistoryItem[] = [];

export function onConfigUpdated(listener: ConfigUpdateListener): () => void {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

export function onRecordingStateChange(listener: RecordingStateListener): () => void {
  audioCapture.on('recording-change', listener);
  return () => audioCapture.off('recording-change', listener);
}
// Helper to parse JSON body
function parseJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 5 * 1024 * 1024) {
      reject(new Error('Payload too large'));
    }
  });
  req.on('end', () => {
    if (!data.trim()) {
      resolve({} as T);
      return;
    }
    try {
      resolve(JSON.parse(data));
    } catch (e) {
      reject(new Error('Invalid JSON format'));
    }
  });
  req.on('error', reject);
  return promise;
}

function parseBinaryBody(req: http.IncomingMessage, maxBytes = 50 * 1024 * 1024): Promise<Buffer> {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>();
  const chunks: Buffer[] = [];
  let totalSize = 0;
  let aborted = false;

  req.on('data', (chunk: Buffer) => {
    if (aborted) return;
    totalSize += chunk.length;
    if (totalSize > maxBytes) {
      aborted = true;
      reject(new Error('Audio payload too large'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!aborted) {
      resolve(Buffer.concat(chunks));
    }
  });
  req.on('error', (err) => {
    if (!aborted) reject(err);
  });
  return promise;
}

const LOCAL_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isOriginRejected(req: http.IncomingMessage): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  return Boolean(origin && !LOCAL_ORIGIN_REGEX.test(origin));
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

function sendSseEvent(res: http.ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(_req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean {
  if (!fs.existsSync(DIST_CLIENT_DIR)) return false;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return true;
  }

  const clientRoot = path.resolve(DIST_CLIENT_DIR);
  const relPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  let filePath = path.resolve(clientRoot, relPath);

  if (filePath !== clientRoot && !filePath.startsWith(clientRoot + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(clientRoot, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
    });
    stream.pipe(res);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method?.toUpperCase();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (reqOrigin && LOCAL_ORIGIN_REGEX.test(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (isOriginRejected(req)) {
    if (method === 'OPTIONS' || pathname.startsWith('/api/')) {
      sendJson(res, 403, { error: 'Origin not allowed' });
      return;
    }
  }

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // --- API ROUTES ---

  // GET /api/config
  if (pathname === '/api/config' && method === 'GET') {
    return sendJson(res, 200, getMaskedConfig());
  }

  // POST /api/config
  if (pathname === '/api/config' && method === 'POST') {
    try {
      const body = await parseJsonBody<Partial<AppConfig>>(req);
      const updated = saveConfig(body);
      for (const listener of configListeners) {
        try {
          listener(updated);
        } catch (err) {
          console.warn('[Server] config listener error:', err);
        }
      }
      return sendJson(res, 200, getMaskedConfig());
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // GET /api/models
  if (pathname === '/api/models' && method === 'GET') {
    return sendJson(res, 200, {
      providers: SUPPORTED_MODELS,
      stt: STT_MODELS,
    });
  }

  // GET /api/record/status
  if (pathname === '/api/record/status' && method === 'GET') {
    return sendJson(res, 200, audioCapture.getStatus());
  }

  // POST /api/record/start
  if (pathname === '/api/record/start' && method === 'POST') {
    try {
      const body = await parseJsonBody<{ mode?: AudioSourceMode }>(req);
      const config = getConfig();
      const mode = body.mode || config.audio_source || 'mixed';

      audioCapture.startRecording(mode);
      return sendJson(res, 200, { ok: true, mode });
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // POST /api/record/stop
  if (pathname === '/api/record/stop' && method === 'POST') {
    try {
      const result = await audioCapture.stopRecording();
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      pendingJobs.set(jobId, {
        id: jobId,
        filePath: result.filePath,
        durationSec: result.durationSec,
        mode: result.mode,
        createdAt: Date.now(),
      });

      return sendJson(res, 200, {
        ok: true,
        jobId,
        durationSec: result.durationSec,
        mode: result.mode,
      });
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // POST /api/record/upload (Used by Electron renderer loopback+mic capture on Windows)
  if (pathname === '/api/record/upload' && method === 'POST') {
    try {
      const wavBuffer = await parseBinaryBody(req);
      if (
        wavBuffer.length <= 44 ||
        wavBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
        wavBuffer.toString('ascii', 8, 12) !== 'WAVE'
      ) {
        return sendJson(res, 400, { error: 'AUDIO_EMPTY_OR_UNAVAILABLE' });
      }

      const rawMode = urlObj.searchParams.get('mode');
      const mode: AudioSourceMode =
        rawMode === 'system' || rawMode === 'mic' || rawMode === 'mixed' ? rawMode : 'mixed';
      const parsedDuration = Number(urlObj.searchParams.get('durationSec'));
      const durationSec =
        Number.isFinite(parsedDuration) && parsedDuration > 0
          ? Math.round(parsedDuration * 10) / 10
          : Math.round(((wavBuffer.length - 44) / 32000) * 10) / 10;

      const tempDir = path.join(getAppDataDir(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const filePath = path.join(tempDir, 'assistant_question.wav');
      fs.writeFileSync(filePath, wavBuffer);

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      pendingJobs.set(jobId, {
        id: jobId,
        filePath,
        durationSec,
        mode,
        createdAt: Date.now(),
      });

      return sendJson(res, 200, {
        ok: true,
        jobId,
        durationSec,
        mode,
      });
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // POST /api/record/toggle (For global system hotkey)
  if (pathname === '/api/record/toggle' && method === 'POST') {
    try {
      if (audioCapture.isRecording()) {
        const result = await audioCapture.stopRecording();
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        pendingJobs.set(jobId, {
          id: jobId,
          filePath: result.filePath,
          durationSec: result.durationSec,
          mode: result.mode,
          createdAt: Date.now(),
        });
        return sendJson(res, 200, {
          state: 'stopped',
          jobId,
          durationSec: result.durationSec,
        });
      } else {
        const config = getConfig();
        const mode = config.audio_source || 'mixed';
        audioCapture.startRecording(mode);
        return sendJson(res, 200, { state: 'recording', mode });
      }
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // POST /api/ask/text
  if (pathname === '/api/ask/text' && method === 'POST') {
    try {
      const body = await parseJsonBody<{ question: string }>(req);
      if (!body.question || !body.question.trim()) {
        return sendJson(res, 400, { error: 'Pergunta em texto não pode ser vazia.' });
      }

      const jobId = `job_text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      pendingJobs.set(jobId, {
        id: jobId,
        questionText: body.question.trim(),
        createdAt: Date.now(),
      });

      return sendJson(res, 200, { ok: true, jobId });
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // GET /api/ask/stream?jobId=...
  if (pathname === '/api/ask/stream' && method === 'GET') {
    const jobId = urlObj.searchParams.get('jobId');
    if (!jobId || !pendingJobs.has(jobId)) {
      return sendJson(res, 404, { error: 'Trabalho de áudio ou texto não encontrado ou expirado.' });
    }

    const job = pendingJobs.get(jobId)!;
    pendingJobs.delete(jobId);

    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
    });

    try {
      const config = getConfig();
      let question = job.questionText || '';

      // Step 1: Transcribe if audio file
      if (job.filePath && !question) {
        sendSseEvent(res, 'status', {
          phase: 'transcribing',
          message: 'Transcrevendo áudio gravado...',
        });

        try {
          question = await transcribeAudio(job.filePath, config);
        } finally {
          try {
            if (fs.existsSync(job.filePath)) {
              fs.unlinkSync(job.filePath);
            }
          } catch {
            // ignore temp file cleanup error
          }
        }
      }
      sendSseEvent(res, 'question', { question });

      // Step 2: Stream AI Response
      sendSseEvent(res, 'status', {
        phase: 'generating',
        message: 'Consultando IA...',
        model: config.model,
        provider: config.provider,
      });

      await streamAIResponse({
        prompt: question,
        config,
        signal: abortController.signal,
        onToken: (token) => {
          sendSseEvent(res, 'token', { token });
        },
        onComplete: (fullText) => {
          sendSseEvent(res, 'done', {
            question,
            answer: fullText,
            model: config.model,
            provider: config.provider,
          });

          // Add to session history
          sessionHistory.unshift({
            id: `hist_${Date.now()}`,
            timestamp: Date.now(),
            question,
            answer: fullText,
            provider: config.provider,
            model: config.model,
            durationSec: job.durationSec,
          });

          res.end();
        },
        onError: (err) => {
          const message = err.message || 'Erro ao gerar resposta da IA';
          sendSseEvent(res, 'server-error', { message });
          sendSseEvent(res, 'error', { message });
          res.end();
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendSseEvent(res, 'server-error', { message });
      sendSseEvent(res, 'error', { message });
      res.end();
    }

    return;
  }

  // GET /api/history
  if (pathname === '/api/history' && method === 'GET') {
    return sendJson(res, 200, sessionHistory);
  }

  // POST /api/history
  if (pathname === '/api/history' && method === 'POST') {
    const body = await parseJsonBody<Partial<HistoryItem>>(req);
    const item: HistoryItem = {
      id: body?.id || `hist_${Date.now()}`,
      timestamp: body?.timestamp || Date.now(),
      question: body?.question || 'Pergunta teste',
      answer: body?.answer || 'Resposta teste',
      model: body?.model || 'qwen/qwen3.8-27b',
      provider: body?.provider || 'groq',
    };
    sessionHistory.unshift(item);
    return sendJson(res, 201, item);
  }

  // DELETE /api/history (supports ?id=... to delete individual item or clears all)
  if (pathname === '/api/history' && method === 'DELETE') {
    const id = urlObj.searchParams.get('id');
    if (id) {
      const idx = sessionHistory.findIndex((item) => item.id === id);
      if (idx !== -1) {
        sessionHistory.splice(idx, 1);
        return sendJson(res, 200, { ok: true, message: 'Item removido do histórico.' });
      }
      return sendJson(res, 404, { error: 'Item não encontrado no histórico.' });
    }
    sessionHistory.length = 0;
    return sendJson(res, 200, { ok: true, message: 'Histórico limpo com sucesso.' });
  }

  // Static Frontend Serving (fallback for all non-API paths)
  if (serveStatic(req, res, pathname)) {
    return;
  }

  // If not built yet and in dev mode:
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Assistente Pessoal de Voz - Dev</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: grid; place-items: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; text-align: center; max-width: 480px; }
          h2 { color: #38bdf8; margin-top: 0; }
          a { color: #38bdf8; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Assistente Pessoal de Voz</h2>
          <p>Servidor backend ativo na porta 5000.</p>
          <p>A interface React está sendo compilada ou disponível no Vite Dev Server:</p>
          <p><a href="http://localhost:5173">Abrir Vite Dev Server (porta 5173)</a></p>
        </div>
      </body>
    </html>
  `);
});

let startPromise: Promise<number> | null = null;
let boundPort: number | null = null;

export function startServer(preferredPort: number = DEFAULT_PORT): Promise<number> {
  if (boundPort !== null) {
    return Promise.resolve(boundPort);
  }
  if (startPromise) {
    return startPromise;
  }

  const { promise, resolve, reject } = Promise.withResolvers<number>();
  startPromise = promise;

  const onError = (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && preferredPort !== 0) {
      console.log(`Port ${preferredPort} is already in use by an existing instance; continuing.`);
      boundPort = preferredPort;
      resolve(preferredPort);
    } else {
      console.error('Server error:', err);
      startPromise = null;
      reject(err);
    }
  };

  server.once('error', onError);
  server.listen(preferredPort, '127.0.0.1', () => {
    server.off('error', onError);
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : preferredPort;
    boundPort = actualPort;
    console.log(`Assistente Pessoal de Voz Server running at http://127.0.0.1:${actualPort}`);
    resolve(actualPort);
  });

  return promise;
}

export function stopServer(): void {
  if (server.listening) {
    server.close();
  }
}

// Auto-start when run directly as standalone Node server (not embedded in Electron)
if (!process.versions.electron) {
  startServer(DEFAULT_PORT).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
