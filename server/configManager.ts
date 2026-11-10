import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AppConfig {
  provider: 'groq' | 'openai' | 'gemini' | 'openrouter' | 'ollama';
  model: string;
  stt_provider: 'groq' | 'openai';
  stt_model: string;
  groq_api_key: string;
  openai_api_key: string;
  gemini_api_key: string;
  openrouter_api_key: string;
  ollama_base_url: string;
  audio_source: 'mixed' | 'system' | 'mic';
  system_prompt_mode: 'concise_meeting' | 'job_interview' | 'coding' | 'custom';
  custom_system_prompt?: string;
  language: 'pt' | 'en';
  minimize_to_tray: boolean;
  launch_at_startup: boolean;
}

export function getAppDataDir(): string {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'audio-call-assistant');
  }
  return path.join(os.homedir(), '.config', 'audio-call-assistant');
}

const CONFIG_DIR = getAppDataDir();
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const DEFAULT_PROMPTS_PT: Record<string, string> = {
  concise_meeting:
    'Você é um assistente pessoal ao vivo durante uma reunião/chamada. Sua função é responder diretamente à pergunta capturada com clareza imediata e precisão técnica. Formato obrigatório: 1. Resposta direta e objetiva na primeira frase; 2. Bullet points curtos com detalhes essenciais, fórmulas ou termos técnicos; 3. Responda em Português. Evite introduções ou saudações desnecessárias.',
  job_interview:
    'Você é um copiloto de entrevista técnica de alto nível. Ao receber uma pergunta da entrevista: 1. Dê a resposta conceitual perfeita logo no primeiro parágrafo; 2. Forneça exemplos práticos, arquitetura e trade-offs em tópicos concisos; 3. Use termos técnicos precisos da indústria. Seja confiante, direto e elegante. Responda em Português.',
  coding:
    'Você é um copiloto sênior de programação ao vivo. Responda à dúvida técnica ou de algoritmo: 1. Explicação técnica imediata em 1-2 frases; 2. Snippet de código limpo e moderno pronto para uso; 3. Complexidade de tempo/espaço (Big-O) e principais armadilhas (edge cases) em bullet points curtos. Responda em Português.',
  custom:
    'Você é um assistente de IA prestativo, rápido e objetivo para chamadas ao vivo. Responda em Português.',
};

export const DEFAULT_PROMPTS_EN: Record<string, string> = {
  concise_meeting:
    'You are a live personal assistant during a meeting/call. Your role is to answer captured questions directly with immediate clarity and technical precision. Mandatory format: 1. Direct and concise answer in the very first sentence; 2. Short bullet points with essential details, formulas, or technical terms; 3. Respond in English. Avoid unnecessary fluff or greetings.',
  job_interview:
    'You are a top-tier live technical interview co-pilot. When a question is received: 1. Provide the conceptually perfect answer in the first paragraph; 2. Provide practical examples, architecture, and trade-offs in concise bullet points; 3. Use precise industry terminology. Be confident, direct, and elegant. Respond in English.',
  coding:
    'You are a senior live coding co-pilot. Answer technical or algorithm questions: 1. Immediate technical explanation in 1-2 sentences; 2. Clean, modern, production-ready code snippet; 3. Time/space complexity (Big-O) and main edge cases in short bullet points. Respond in English.',
  custom:
    'You are a helpful, fast, and concise AI assistant for live calls. Respond in English.',
};

export const DEFAULT_PROMPTS = DEFAULT_PROMPTS_PT;
export const DEFAULT_CONFIG: AppConfig = {
  provider: 'groq',
  model: 'qwen/qwen3.8-27b',
  stt_provider: 'groq',
  stt_model: 'whisper-large-v3',
  groq_api_key: process.env.GROQ_API_KEY || '',
  openai_api_key: process.env.OPENAI_API_KEY || '',
  gemini_api_key: process.env.GEMINI_API_KEY || '',
  openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
  ollama_base_url: 'http://localhost:11434',
  audio_source: 'mixed',
  system_prompt_mode: 'concise_meeting',
  custom_system_prompt: '',
  language: 'pt',
  minimize_to_tray: true,
  launch_at_startup: false,
};
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  } else if (process.platform !== 'win32') {
    try {
      fs.chmodSync(CONFIG_DIR, 0o700);
    } catch {
      // ignore chmod errors
    }
  }
}

export function getConfig(): AppConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = {
      ...DEFAULT_CONFIG,
      ...parsed,
    };

    // Auto-migrate deprecated Groq models
    const deprecatedGroqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'deepseek-r1-distill-llama-70b',
      'mixtral-8x7b-32768',
    ];
    if (merged.provider === 'groq' && deprecatedGroqModels.includes(merged.model)) {
      merged.model = 'qwen/qwen3.8-27b';
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
          encoding: 'utf-8',
          mode: 0o600,
        });
      } catch {
        // ignore write error
      }
    }

    return merged;
  } catch (err) {
    console.error('Error reading config file, using defaults:', err);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  ensureConfigDir();
  const current = getConfig();
  
  // If a masked key is passed back, don't overwrite the real key with the mask
  const sanitizedPatch = { ...patch };
  const keyFields: (keyof AppConfig)[] = [
    'groq_api_key',
    'openai_api_key',
    'gemini_api_key',
    'openrouter_api_key',
  ];

  for (const field of keyFields) {
    const val = sanitizedPatch[field];
    if (typeof val === 'string' && val.includes('••••')) {
      delete sanitizedPatch[field];
    }
  }

  if (typeof sanitizedPatch.ollama_base_url === 'string') {
    const trimmedUrl = sanitizedPatch.ollama_base_url.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      throw new Error('Ollama Base URL deve iniciar com http:// ou https://');
    }
    sanitizedPatch.ollama_base_url = trimmedUrl || DEFAULT_CONFIG.ollama_base_url;
  }

  const updated: AppConfig = {
    ...current,
    ...sanitizedPatch,
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(CONFIG_FILE, 0o600);
    } catch {
      // ignore chmod errors
    }
  }
  return updated;
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function getMaskedConfig(): AppConfig {
  const cfg = getConfig();
  return {
    ...cfg,
    groq_api_key: maskKey(cfg.groq_api_key),
    openai_api_key: maskKey(cfg.openai_api_key),
    gemini_api_key: maskKey(cfg.gemini_api_key),
    openrouter_api_key: maskKey(cfg.openrouter_api_key),
  };
}

export function getEffectiveSystemPrompt(config: AppConfig): string {
  const isEnglish = config.language === 'en';
  const prompts = isEnglish ? DEFAULT_PROMPTS_EN : DEFAULT_PROMPTS_PT;

  if (config.system_prompt_mode === 'custom' && config.custom_system_prompt?.trim()) {
    const custom = config.custom_system_prompt.trim();
    return isEnglish && !/english/i.test(custom) ? `${custom}\n\nRespond in English.` : custom;
  }
  return prompts[config.system_prompt_mode] || prompts.concise_meeting;
}
