import fs from 'node:fs';
import path from 'node:path';
import { AppConfig, getEffectiveSystemPrompt } from './configManager.js';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export interface ProviderCatalog {
  name: string;
  models: ModelOption[];
  requiresKey: boolean;
  defaultModel: string;
}

export const SUPPORTED_MODELS: Record<string, ProviderCatalog> = {
  groq: {
    name: 'Groq (Ultra-Rápido & Free Tier)',
    requiresKey: true,
    defaultModel: 'qwen/qwen3.8-27b',
    models: [
      {
        id: 'qwen/qwen3.8-27b',
        name: 'Qwen 3.8 27B',
        description: 'Velocidade máxima e excelente precisão em português e código',
        badge: 'Recomendado',
      },
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT OSS 120B',
        description: 'Modelo de altíssima capacidade e raciocínio profundo',
        badge: 'Mais Inteligente',
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT OSS 20B',
        description: 'Rápido e eficiente para respostas instantâneas',
        badge: 'Mais Rápido',
      },
    ],
  },
  openai: {
    name: 'OpenAI',
    requiresKey: true,
    defaultModel: 'gpt-4o-mini',
    models: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Rápido, preciso e custo mínimo',
        badge: 'Recomendado',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Modelo topo de linha mais capaz da OpenAI',
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        description: 'Modelo de raciocínio passo a passo da OpenAI',
      },
    ],
  },
  gemini: {
    name: 'Google Gemini',
    requiresKey: true,
    defaultModel: 'gemini-2.0-flash',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Geração de altíssima velocidade e raciocínio atualizado',
        badge: 'Recomendado',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Super estável com janela de contexto imensa',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Respostas detalhadas e profunda capacidade de código',
      },
    ],
  },
  openrouter: {
    name: 'OpenRouter (Multi-Provedor)',
    requiresKey: true,
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    models: [
      {
        id: 'meta-llama/llama-3.1-8b-instruct:free',
        name: 'Llama 3.1 8B Instruct (Free)',
        description: 'Acesso sem custo a modelo rápido',
        badge: 'Grátis',
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3',
        description: 'Arquitetura inovadora de ponta por preço irrisório',
      },
      {
        id: 'anthropic/claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        description: 'Excelente precisão e concisão para reuniões',
      },
    ],
  },
  ollama: {
    name: 'Ollama (Local / Offline)',
    requiresKey: false,
    defaultModel: 'llama3.2',
    models: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2 (Local)',
        description: 'Modelo local rápido e leve',
        badge: 'Offline',
      },
      {
        id: 'qwen2.5-coder:7b',
        name: 'Qwen 2.5 Coder 7B',
        description: 'Especialista local para programação',
      },
      {
        id: 'mistral',
        name: 'Mistral 7B',
        description: 'Modelo versátil de uso geral',
      },
    ],
  },
};

export const STT_MODELS = {
  groq: [
    { id: 'whisper-large-v3', name: 'Whisper Large V3 (Mais Preciso)' },
    { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo (Mais Rápido)' },
  ],
  openai: [
    { id: 'whisper-1', name: 'Whisper 1 (OpenAI)' },
  ],
};

/**
 * Transcribes a WAV audio file using the configured STT provider (Groq or OpenAI).
 */
export async function transcribeAudio(wavFilePath: string, config: AppConfig): Promise<string> {
  if (!fs.existsSync(wavFilePath)) {
    throw new Error(`Arquivo de áudio não encontrado em ${wavFilePath}`);
  }

  const stat = fs.statSync(wavFilePath);
  if (stat.size <= 44) {
    throw new Error('O arquivo de áudio está vazio ou contém apenas o cabeçalho WAV.');
  }

  const provider = config.stt_provider || 'groq';
  const apiKey = provider === 'groq' ? config.groq_api_key : config.openai_api_key;

  if (!apiKey || !apiKey.trim()) {
    const providerName = provider === 'groq' ? 'Groq' : 'OpenAI';
    throw new Error(
      `Chave de API do provedor de transcrição (${providerName}) não foi configurada. ` +
      `Abra as Configurações e adicione sua chave de API para habilitar a transcrição automática.`
    );
  }

  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';

  const model = config.stt_model || (provider === 'groq' ? 'whisper-large-v3' : 'whisper-1');

  // Read file as Uint8Array for Blob
  const fileBuffer = fs.readFileSync(wavFilePath);
  const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });

  const formData = new FormData();
  formData.append('file', fileBlob, 'audio.wav');
  formData.append('model', model);
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  if (config.language) {
    formData.append('language', config.language === 'en' ? 'en' : 'pt');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      if (json.error?.message) {
        parsedMessage = json.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(`Falha na transcrição (${provider} ${response.status}): ${parsedMessage}`);
  }

  const jsonResult = (await response.json()) as { text?: string };
  const transcribedText = jsonResult.text ? jsonResult.text.trim() : '';

  if (!transcribedText) {
    throw new Error('Nenhuma fala audível foi detectada na gravação.');
  }

  return transcribedText;
}

export interface StreamAIOptions {
  prompt: string;
  config: AppConfig;
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

/**
 * Streams the AI response from the selected LLM provider using fetch and SSE.
 */
export async function streamAIResponse(options: StreamAIOptions): Promise<void> {
  const { prompt, config, onToken, onComplete, onError, signal } = options;
  const provider = config.provider || 'groq';
  const systemPrompt = getEffectiveSystemPrompt(config);

  try {
    switch (provider) {
      case 'groq':
      case 'openai':
      case 'openrouter':
        await streamOpenAICompatible(provider, prompt, systemPrompt, config, onToken, onComplete, signal);
        break;
      case 'gemini':
        await streamGemini(prompt, systemPrompt, config, onToken, onComplete, signal);
        break;
      case 'ollama':
        await streamOllama(prompt, systemPrompt, config, onToken, onComplete, signal);
        break;
      default:
        throw new Error(`Provedor de IA desconhecido: ${provider}`);
    }
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * OpenAI-compatible SSE streaming for Groq, OpenAI, and OpenRouter.
 */
async function streamOpenAICompatible(
  provider: 'groq' | 'openai' | 'openrouter',
  prompt: string,
  systemPrompt: string,
  config: AppConfig,
  onToken: (t: string) => void,
  onComplete: (full: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let endpoint = '';
  let apiKey = '';
  let defaultModel = '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    apiKey = config.groq_api_key;
    defaultModel = 'qwen/qwen3.8-27b';
  } else if (provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    apiKey = config.openai_api_key;
    defaultModel = 'gpt-4o-mini';
  } else if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    apiKey = config.openrouter_api_key;
    defaultModel = 'meta-llama/llama-3.1-8b-instruct:free';
    headers['HTTP-Referer'] = 'http://127.0.0.1:5000';
    headers['X-Title'] = 'AudioCallAssistant';
  }

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      `Chave de API do provedor ${provider.toUpperCase()} não configurada. Insira sua chave nas Configurações.`
    );
  }

  headers.Authorization = `Bearer ${apiKey.trim()}`;

  const model = config.model || defaultModel;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    stream: true,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = errorText;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.error?.message || errJson.message || errorText;
    } catch {
      // ignore
    }
    throw new Error(`Erro na API (${provider} ${response.status}): ${msg}`);
  }

  if (!response.body) {
    throw new Error('Nenhum corpo de resposta recebido da API');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulated += decoder.decode(value, { stream: true });
    const lines = accumulated.split('\n');
    // Keep the incomplete last line in the accumulator
    accumulated = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') {
        onComplete(fullResponse);
        return;
      }

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullResponse += delta;
          onToken(delta);
        }
      } catch {
        // Skip unparseable chunks
      }
    }
  }

  onComplete(fullResponse);
}

/**
 * Google Gemini streaming via REST SSE endpoint.
 */
async function streamGemini(
  prompt: string,
  systemPrompt: string,
  config: AppConfig,
  onToken: (t: string) => void,
  onComplete: (full: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = config.gemini_api_key?.trim();
  if (!apiKey) {
    throw new Error('Chave de API do Google Gemini não configurada. Adicione sua chave nas Configurações.');
  }

  const model = config.model || 'gemini-2.0-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = errorText;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.error?.message || errorText;
    } catch {
      // ignore
    }
    throw new Error(`Erro na API Gemini (${response.status}): ${msg}`);
  }

  if (!response.body) {
    throw new Error('Nenhum stream recebido do Google Gemini');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulated += decoder.decode(value, { stream: true });
    const lines = accumulated.split('\n');
    accumulated = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') break;

      try {
        const parsed = JSON.parse(dataStr);
        const candidates = parsed.candidates;
        if (candidates && candidates.length > 0) {
          const parts = candidates[0].content?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.text) {
                fullResponse += part.text;
                onToken(part.text);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  onComplete(fullResponse);
}

/**
 * Ollama local streaming via `/api/chat`.
 */
async function streamOllama(
  prompt: string,
  systemPrompt: string,
  config: AppConfig,
  onToken: (t: string) => void,
  onComplete: (full: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const baseUrl = config.ollama_base_url || 'http://localhost:11434';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const model = config.model || 'llama3.2';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    stream: true,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new Error(`Não foi possível conectar ao Ollama em ${baseUrl}. Verifique se o serviço está em execução.`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro do Ollama (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Nenhum stream recebido do Ollama');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulated += decoder.decode(value, { stream: true });
    const lines = accumulated.split('\n');
    accumulated = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const chunk = parsed.message?.content;
        if (chunk) {
          fullResponse += chunk;
          onToken(chunk);
        }
        if (parsed.done) {
          onComplete(fullResponse);
          return;
        }
      } catch {
        // ignore
      }
    }
  }

  onComplete(fullResponse);
}
