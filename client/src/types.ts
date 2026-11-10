export type AudioSourceMode = 'mixed' | 'system' | 'mic';

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
  audio_source: AudioSourceMode;
  system_prompt_mode: 'concise_meeting' | 'job_interview' | 'coding' | 'custom';
  custom_system_prompt?: string;
  language?: 'pt' | 'en';
  minimize_to_tray?: boolean;
  launch_at_startup?: boolean;
}

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

export interface ModelsResponse {
  providers: Record<string, ProviderCatalog>;
  stt: Record<string, Array<{ id: string; name: string }>>;
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

export type AssistantState = 'idle' | 'recording' | 'transcribing' | 'generating' | 'error';

export interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  isAlwaysOnTop: () => Promise<boolean>;
  toggleAlwaysOnTop: () => Promise<boolean>;
  hideToTray?: () => Promise<boolean>;
  setRecordingState?: (recording: boolean) => void;
  onRecordToggleShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
