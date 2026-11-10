import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { RecordingControl } from './components/RecordingControl';
import { AnswerView } from './components/AnswerView';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SettingsModal } from './components/SettingsModal';
import {
  AppConfig,
  ModelsResponse,
  HistoryItem,
  AssistantState,
  AudioSourceMode,
} from './types';
import { Language, translations } from './i18n';
import { RendererAudioCapture } from './utils/rendererAudioCapture';
export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [lang, setLang] = useState<Language>('pt');
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [state, setState] = useState<AssistantState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [activeQuestion, setActiveQuestion] = useState<string>('');
  const [activeAnswer, setActiveAnswer] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('');
  const [activeProvider, setActiveProvider] = useState<string>('');

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [sourceMode, setSourceMode] = useState<AudioSourceMode>('mixed');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeEventSourceRef = useRef<EventSource | null>(null);
  const rendererCaptureRef = useRef<RendererAudioCapture | null>(null);
  const useRendererAudioCapture = Boolean(
    window.electronAPI?.isElectron && window.electronAPI?.platform === 'win32'
  );

  // Load initial configuration and models catalog
  const loadConfigAndModels = useCallback(async () => {
    try {
      const [cfgRes, modRes, histRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/models'),
        fetch('/api/history'),
      ]);

      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as AppConfig;
        setConfig(cfg);
        if (cfg.language) {
          setLang(cfg.language);
        }
        setSourceMode(cfg.audio_source || 'mixed');
        setActiveModel(cfg.model);
        setActiveProvider(cfg.provider);
      }

      if (modRes.ok) {
        const mod = (await modRes.json()) as ModelsResponse;
        setModelsData(mod);
      }

      if (histRes.ok) {
        const hist = await histRes.json();
        setHistory(Array.isArray(hist) ? hist : []);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setState('error');
      setErrorMessage(
        lang === 'en'
          ? 'Unable to connect to backend server (port 5000). Please verify the server is running.'
          : 'Não foi possível conectar ao servidor backend (porta 5000). Verifique se o servidor está ativo.'
      );
    }
  }, [lang]);

  useEffect(() => {
    loadConfigAndModels();
  }, [loadConfigAndModels]);

  // Handle Recording Stopwatch Timer
  useEffect(() => {
    if (state === 'recording') {
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  // Connect to SSE Stream for a Job
  const connectJobStream = useCallback((jobId: string) => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }

    setState('transcribing');
    setStatusMessage(lang === 'en' ? 'Transcribing recorded audio...' : 'Transcrevendo áudio gravado...');
    setErrorMessage('');
    setActiveAnswer('');

    const eventSource = new EventSource(`/api/ask/stream?jobId=${jobId}`);
    activeEventSourceRef.current = eventSource;
    let explicitError = false;
    eventSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.phase === 'generating') {
          setState('generating');
          setStatusMessage(data.message || 'Consultando IA...');
          if (data.model) setActiveModel(data.model);
          if (data.provider) setActiveProvider(data.provider);
        } else if (data.phase === 'transcribing') {
          setState('transcribing');
          setStatusMessage(data.message || 'Transcrevendo...');
        }
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('question', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.question) {
          setActiveQuestion(data.question);
        }
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('token', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.token) {
          setState('generating');
          setActiveAnswer((prev) => prev + data.token);
        }
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.answer) {
          setActiveAnswer(data.answer);
        }
      } catch {
        // ignore
      }
      setState('idle');
      setStatusMessage('');
      eventSource.close();
      activeEventSourceRef.current = null;

      // Refresh session history list
      fetch('/api/history')
        .then((r) => r.json())
        .then((h) => setHistory(Array.isArray(h) ? h : []))
        .catch(() => {});
    });

    eventSource.addEventListener('server-error', (e) => {
      explicitError = true;
      let msg = 'Erro ao processar solicitação com o provedor de IA.';
      try {
        const messageEvent = e as MessageEvent;
        if (messageEvent.data) {
          const parsed = JSON.parse(messageEvent.data);
          if (parsed.message) msg = parsed.message;
        }
      } catch {
        // ignore
      }
      setState('error');
      setErrorMessage(msg);
      eventSource.close();
      activeEventSourceRef.current = null;
    });

    eventSource.addEventListener('error', (e: Event) => {
      let msg = '';
      try {
        const messageEvent = e as MessageEvent;
        if (messageEvent.data) {
          const parsed = JSON.parse(messageEvent.data);
          if (parsed.message) msg = parsed.message;
        }
      } catch {
        // ignore
      }
      if (msg) {
        explicitError = true;
        setState('error');
        setErrorMessage(msg);
        eventSource.close();
        activeEventSourceRef.current = null;
      }
    });

    eventSource.onerror = () => {
      if (explicitError) return;
      if (state !== 'idle') {
        setState('error');
        setErrorMessage('Conexão encerrada ou falha ao se comunicar com o servidor.');
      }
      eventSource.close();
      activeEventSourceRef.current = null;
    };
  }, [state]);

  const formatCaptureError = useCallback(
    (err: unknown, fallback: string) => {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw === 'AUDIO_TOO_SHORT') {
        return lang === 'en'
          ? 'Recording too short (minimum 0.5s). Please try again.'
          : 'Gravação muito curta (mínimo 0,5s). Tente novamente.';
      }
      if (raw === 'AUDIO_EMPTY_OR_UNAVAILABLE' || raw === 'SYSTEM_AUDIO_UNAVAILABLE' || raw === 'AUDIO_SOURCE_UNAVAILABLE') {
        return lang === 'en'
          ? 'Could not capture audio from the selected source. Check audio permissions and active device.'
          : 'Não foi possível capturar áudio da fonte selecionada. Verifique as permissões e o dispositivo ativo.';
      }
      return raw || fallback;
    },
    [lang]
  );

  useEffect(() => {
    return () => {
      rendererCaptureRef.current?.abort();
      window.electronAPI?.setRecordingState?.(false);
    };
  }, []);

  // Start Recording Action
  const handleStartRecording = useCallback(async () => {
    if (state === 'recording' || state === 'transcribing' || state === 'generating') return;
    try {
      setErrorMessage('');
      if (useRendererAudioCapture) {
        if (!rendererCaptureRef.current) {
          rendererCaptureRef.current = new RendererAudioCapture();
        }
        await rendererCaptureRef.current.start(sourceMode);
        window.electronAPI?.setRecordingState?.(true);
        setState('recording');
        return;
      }

      const res = await fetch('/api/record/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: sourceMode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao iniciar gravação.');
      }
      setState('recording');
    } catch (err) {
      window.electronAPI?.setRecordingState?.(false);
      setState('error');
      setErrorMessage(formatCaptureError(err, 'Erro ao iniciar gravação.'));
    }
  }, [state, useRendererAudioCapture, sourceMode, formatCaptureError]);

  // Stop Recording Action
  const handleStopRecording = useCallback(async () => {
    if (state !== 'recording') return;
    try {
      if (useRendererAudioCapture && rendererCaptureRef.current) {
        window.electronAPI?.setRecordingState?.(false);
        const captured = await rendererCaptureRef.current.stop();
        setState('transcribing');
        setStatusMessage(lang === 'en' ? 'Uploading recorded audio...' : 'Enviando áudio gravado...');
        const res = await fetch(
          `/api/record/upload?mode=${encodeURIComponent(captured.mode)}&durationSec=${encodeURIComponent(String(captured.durationSec))}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            body: captured.wavBlob,
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao enviar áudio gravado.');
        }
        const data = await res.json();
        if (data.jobId) {
          connectJobStream(data.jobId);
        }
        return;
      }

      const res = await fetch('/api/record/stop', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao finalizar gravação.');
      }
      const data = await res.json();
      if (data.jobId) {
        connectJobStream(data.jobId);
      }
    } catch (err) {
      window.electronAPI?.setRecordingState?.(false);
      setState('error');
      setErrorMessage(formatCaptureError(err, 'Erro ao finalizar gravação.'));
    }
  }, [state, useRendererAudioCapture, lang, connectJobStream, formatCaptureError]);
  // Manual Text Question Action
  const handleAskText = async (question: string) => {
    try {
      setActiveQuestion(question);
      setActiveAnswer('');
      setState('generating');
      setStatusMessage(lang === 'en' ? 'Sending question...' : 'Enviando pergunta...');
      setErrorMessage('');

      const res = await fetch('/api/ask/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar pergunta.');
      }

      const data = await res.json();
      if (data.jobId) {
        connectJobStream(data.jobId);
      }
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  // Change Audio Source
  const handleChangeSourceMode = async (mode: AudioSourceMode) => {
    setSourceMode(mode);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_source: mode }),
      });
    } catch {
      // ignore
    }
  };

  // Change Language
  const handleToggleLanguage = async (newLang: Language) => {
    setLang(newLang);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: newLang }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
      }
    } catch (err) {
      console.error('Error changing language:', err);
    }
  };
  // Quick Select Model
  const handleQuickSelectModel = async (p: AppConfig['provider'], m: string) => {
    setActiveProvider(p);
    setActiveModel(m);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p, model: m }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
      }
    } catch (err) {
      console.error('Error changing model:', err);
    }
  };

  // Save Settings from Modal
  const handleSaveConfig = async (patch: Partial<AppConfig>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao salvar configuração.');
    }
    const updated = await res.json();
    setConfig(updated);
    if (updated.language) setLang(updated.language);
    if (updated.provider) setActiveProvider(updated.provider);
    if (updated.model) setActiveModel(updated.model);
    if (updated.audio_source) setSourceMode(updated.audio_source);
  };
  // Clear Session History
  const handleClearHistory = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch {
      setHistory([]);
    }
  };

  // Delete Single History Item
  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setHistory((prev) => (Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []));
    } catch {
      setHistory((prev) => (Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []));
    }
  };

  // Global Keyboard Shortcut: Space bar to start/stop recording (unless inside an input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        isSettingsOpen ||
        isHistoryOpen
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (state === 'recording') {
          handleStopRecording();
        } else if (state === 'idle' || state === 'error') {
          handleStartRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, isSettingsOpen, isHistoryOpen, handleStartRecording, handleStopRecording]);
  // Desktop Global Shortcut (Ctrl+Shift+Space / Cmd+Shift+Space)
  useEffect(() => {
    if (!window.electronAPI?.onRecordToggleShortcut) return;
    return window.electronAPI.onRecordToggleShortcut(() => {
      if (state === 'recording') {
        handleStopRecording();
      } else if (state === 'idle' || state === 'error') {
        handleStartRecording();
      }
    });
  }, [state, handleStartRecording, handleStopRecording]);

  // Model name display helper
  const currentCatalog = modelsData?.providers?.[activeProvider];
  const activeModelObj = currentCatalog?.models.find((m) => m.id === activeModel);
  const displayModelName = activeModelObj?.name || activeModel;

  return (
    <div className="hud-container">
      {/* HUD Header */}
      <Header
        config={config}
        modelsData={modelsData}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleHistory={() => setIsHistoryOpen((prev) => !prev)}
        isHistoryOpen={isHistoryOpen}
        historyCount={Array.isArray(history) ? history.length : 0}
        onSelectModel={handleQuickSelectModel}
        isRecording={state === 'recording'}
        lang={lang}
        onChangeLanguage={handleToggleLanguage}
      />

      {/* Main Scrollable HUD Content */}
      <main className="hud-content">
        {/* Recording Control & Audio Source Buttons */}
        <RecordingControl
          state={state}
          elapsedSec={elapsedSec}
          sourceMode={sourceMode}
          onStartRecord={handleStartRecording}
          onStopRecord={handleStopRecording}
          onChangeSourceMode={handleChangeSourceMode}
          onAskText={handleAskText}
          statusMessage={statusMessage}
          lang={lang}
        />

        {/* Question & AI Answer View */}
        <AnswerView
          question={activeQuestion}
          answer={activeAnswer}
          state={state}
          activeModelName={displayModelName}
          activeProvider={activeProvider}
          errorMessage={errorMessage}
          onRetry={activeQuestion ? () => handleAskText(activeQuestion) : undefined}
          lang={lang}
        />
      </main>
      {/* History Drawer Modal */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        lang={lang}
        onSelectItem={(item) => {
          setActiveQuestion(item.question);
          setActiveAnswer(item.answer);
          setActiveModel(item.model);
          setActiveProvider(item.provider);
          setState('idle');
          setErrorMessage('');
        }}
        onClearHistory={handleClearHistory}
        onDeleteItem={handleDeleteHistoryItem}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        modelsData={modelsData}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
};
