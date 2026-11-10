import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Key,
  Cpu,
  Mic,
  Check,
  Eye,
  EyeOff,
  Sliders,
  ExternalLink,
  Save,
  Languages,
  Monitor,
} from 'lucide-react';
import { AppConfig, ModelsResponse } from '../types';
import { Language, translations } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  modelsData: ModelsResponse | null;
  onSaveConfig: (updated: Partial<AppConfig>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  modelsData,
  onSaveConfig,
}) => {
  const [language, setLanguage] = useState<Language>('pt');
  const [provider, setProvider] = useState<AppConfig['provider']>('groq');
  const [model, setModel] = useState('qwen/qwen3.8-27b');
  const [sttProvider, setSttProvider] = useState<'groq' | 'openai'>('groq');
  const [sttModel, setSttModel] = useState('whisper-large-v3');

  const [groqKey, setGroqKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');

  const [promptMode, setPromptMode] = useState<AppConfig['system_prompt_mode']>('concise_meeting');
  const [customPrompt, setCustomPrompt] = useState('');
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  useEffect(() => {
    if (config) {
      setLanguage(config.language || 'pt');
      setProvider(config.provider || 'groq');
      setModel(config.model || 'qwen/qwen3.8-27b');
      setSttProvider(config.stt_provider || 'groq');
      setSttModel(config.stt_model || 'whisper-large-v3');
      setGroqKey(config.groq_api_key || '');
      setOpenaiKey(config.openai_api_key || '');
      setGeminiKey(config.gemini_api_key || '');
      setOpenrouterKey(config.openrouter_api_key || '');
      setOllamaUrl(config.ollama_base_url || 'http://localhost:11434');
      setPromptMode(config.system_prompt_mode || 'concise_meeting');
      setCustomPrompt(config.custom_system_prompt || '');
      setMinimizeToTray(config.minimize_to_tray ?? true);
      setLaunchAtStartup(Boolean(config.launch_at_startup));
    }
  }, [config, isOpen]);

  if (!isOpen) return null;

  const t = translations[language] || translations.pt;

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProviderChange = (newProvider: AppConfig['provider']) => {
    setProvider(newProvider);
    const defaultModel = modelsData?.providers?.[newProvider]?.defaultModel;
    if (defaultModel) {
      setModel(defaultModel);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig({
        language,
        provider,
        model,
        stt_provider: sttProvider,
        stt_model: sttModel,
        groq_api_key: groqKey,
        openai_api_key: openaiKey,
        gemini_api_key: geminiKey,
        openrouter_api_key: openrouterKey,
        ollama_base_url: ollamaUrl,
        system_prompt_mode: promptMode,
        custom_system_prompt: customPrompt,
        minimize_to_tray: minimizeToTray,
        launch_at_startup: launchAtStartup,
      });
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const availableModels = modelsData?.providers?.[provider]?.models || [];
  const availableSttModels = modelsData?.stt?.[sttProvider] || [];

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--blue-600)" />
            <div>
              <h2
                id="settings-modal-title"
                style={{
                  fontWeight: 700,
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {t.settingsTitleModal}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            title={t.close}
            aria-label={t.close}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form
          onSubmit={handleSave}
          style={{
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {/* Section: Language Choice (English or Portuguese) */}
          <div className="settings-section">
            <div className="section-label">
              <Languages size={15} color="var(--blue-600)" />
              <span>{t.langSectionTitle}</span>
            </div>
            <p className="section-subtext">{t.langSectionDesc}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setLanguage('pt')}
                className={`lang-choice-card ${language === 'pt' ? 'selected' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>🇧🇷 Português</span>
                  {language === 'pt' && <Check size={14} color="var(--blue-600)" />}
                </div>
                <span className="lang-choice-desc">{t.langPtDesc}</span>
              </button>

              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`lang-choice-card ${language === 'en' ? 'selected' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>🇺🇸 English</span>
                  {language === 'en' && <Check size={14} color="var(--blue-600)" />}
                </div>
                <span className="lang-choice-desc">{t.langEnDesc}</span>
              </button>
            </div>
          </div>

          {/* Section: LLM Provider & Model */}
          <div className="settings-section">
            <div className="section-label">
              <Cpu size={15} color="var(--blue-600)" />
              <span>{t.aiProviderTitle}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label
                  htmlFor="setting-provider"
                  style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}
                >
                  {t.aiProviderTitle}
                </label>
                <select
                  id="setting-provider"
                  className="form-select"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as AppConfig['provider'])}
                >
                  <option value="groq">Groq (Ultra-Rápido)</option>
                  <option value="openai">OpenAI (GPT-4o Mini)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openrouter">OpenRouter (Grátis)</option>
                  <option value="ollama">Ollama (Offline/Local)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="setting-model"
                  style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}
                >
                  {t.aiModelTitle}
                </label>
                <select
                  id="setting-model"
                  className="form-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: STT Transcription */}
          <div className="settings-section">
            <div className="section-label">
              <Mic size={15} color="var(--blue-600)" />
              <span>{t.sttTitle}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label
                  htmlFor="setting-stt-provider"
                  style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}
                >
                  {t.sttProvider}
                </label>
                <select
                  id="setting-stt-provider"
                  className="form-select"
                  value={sttProvider}
                  onChange={(e) => {
                    const next = e.target.value as 'groq' | 'openai';
                    setSttProvider(next);
                    setSttModel(next === 'groq' ? 'whisper-large-v3' : 'whisper-1');
                  }}
                >
                  <option value="groq">Groq Whisper (Rápido)</option>
                  <option value="openai">OpenAI Whisper</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="setting-stt-model"
                  style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}
                >
                  {t.sttModel}
                </label>
                <select
                  id="setting-stt-model"
                  className="form-select"
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                >
                  {availableSttModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: API Keys */}
          <div className="settings-section">
            <div className="section-label">
              <Key size={15} color="var(--blue-600)" />
              <span>{t.apiKeysTitle}</span>
            </div>
            <p className="section-subtext">{t.apiKeysDesc}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              {/* Groq Key */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="key-groq" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Groq API Key {provider === 'groq' && <span className="badge badge-blue" style={{ fontSize: '9px', padding: '0 4px' }}>Ativo</span>}
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: 'var(--blue-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>Obter chave grátis</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="key-groq"
                    type={showKeys.groq ? 'text' : 'password'}
                    className="form-input"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('groq')}
                    className="icon-btn"
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent' }}
                  >
                    {showKeys.groq ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* OpenAI Key */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="key-openai" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    OpenAI API Key {provider === 'openai' && <span className="badge badge-blue" style={{ fontSize: '9px', padding: '0 4px' }}>Ativo</span>}
                  </label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: 'var(--blue-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>Painel OpenAI</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="key-openai"
                    type={showKeys.openai ? 'text' : 'password'}
                    className="form-input"
                    placeholder="sk-proj-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="icon-btn"
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent' }}
                  >
                    {showKeys.openai ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Gemini Key */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="key-gemini" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Google Gemini API Key {provider === 'gemini' && <span className="badge badge-blue" style={{ fontSize: '9px', padding: '0 4px' }}>Ativo</span>}
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: 'var(--blue-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>Google AI Studio</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="key-gemini"
                    type={showKeys.gemini ? 'text' : 'password'}
                    className="form-input"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="icon-btn"
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent' }}
                  >
                    {showKeys.gemini ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* OpenRouter Key */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="key-openrouter" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    OpenRouter API Key {provider === 'openrouter' && <span className="badge badge-blue" style={{ fontSize: '9px', padding: '0 4px' }}>Ativo</span>}
                  </label>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: 'var(--blue-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>OpenRouter Keys</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="key-openrouter"
                    type={showKeys.openrouter ? 'text' : 'password'}
                    className="form-input"
                    placeholder="sk-or-v1-..."
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openrouter')}
                    className="icon-btn"
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent' }}
                  >
                    {showKeys.openrouter ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Ollama URL */}
              <div>
                <label htmlFor="url-ollama" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                  Ollama Base URL (Local / Sem Nuvem)
                </label>
                <input
                  id="url-ollama"
                  type="text"
                  className="form-input"
                  placeholder="http://localhost:11434"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Assistant Persona / Prompt Mode */}
          <div className="settings-section">
            <div className="section-label">
              <Sliders size={15} color="var(--blue-600)" />
              <span>{t.promptModeTitle}</span>
            </div>
            <p className="section-subtext">{t.promptModeDesc}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              {[
                { id: 'concise_meeting', label: t.modeMeeting },
                { id: 'job_interview', label: t.modeInterview },
                { id: 'coding', label: t.modeCoding },
                { id: 'custom', label: t.modeCustom },
              ].map((m) => {
                const isActive = promptMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPromptMode(m.id as AppConfig['system_prompt_mode'])}
                    className={`prompt-mode-btn ${isActive ? 'active' : ''}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {promptMode === 'custom' && (
              <textarea
                className="form-input"
                style={{ height: '76px', resize: 'vertical', marginTop: '8px' }}
                placeholder={t.customPromptPlaceholder}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            )}
          </div>

          {/* Section: Desktop Tray & Startup Behavior */}
          {window.electronAPI?.isElectron && (
            <div className="settings-section">
              <div className="section-label">
                <Monitor size={15} color="var(--blue-600)" />
                <span>{t.desktopSectionTitle}</span>
              </div>
              <p className="section-subtext">{t.desktopSectionDesc}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <label className="desktop-toggle-row">
                  <input
                    type="checkbox"
                    className="desktop-toggle-checkbox"
                    checked={minimizeToTray}
                    onChange={(e) => setMinimizeToTray(e.target.checked)}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.minimizeToTrayLabel}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {t.minimizeToTrayDesc}
                    </span>
                  </div>
                </label>

                <label className="desktop-toggle-row">
                  <input
                    type="checkbox"
                    className="desktop-toggle-checkbox"
                    checked={launchAtStartup}
                    onChange={(e) => setLaunchAtStartup(e.target.checked)}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.launchAtStartupLabel}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {t.launchAtStartupDesc}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div style={{ marginTop: '4px' }}>
            <button
              type="submit"
              disabled={saving}
              className={`submit-save-btn ${saveSuccess ? 'success' : ''}`}
            >
              {saveSuccess ? (
                <>
                  <Check size={16} />
                  <span>{t.savedSuccess}</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{saving ? t.savingSettings : t.saveSettings}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
