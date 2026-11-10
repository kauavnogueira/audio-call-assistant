import React, { useState } from 'react';
import {
  Mic,
  Square,
  Loader2,
  Volume2,
  Headphones,
  Send,
  Keyboard,
  X,
} from 'lucide-react';
import { AssistantState, AudioSourceMode } from '../types';
import { Language, translations } from '../i18n';

interface RecordingControlProps {
  state: AssistantState;
  elapsedSec: number;
  sourceMode: AudioSourceMode;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onChangeSourceMode: (mode: AudioSourceMode) => void;
  onAskText: (question: string) => void;
  statusMessage?: string;
  lang: Language;
}

export const RecordingControl: React.FC<RecordingControlProps> = ({
  state,
  elapsedSec,
  sourceMode,
  onStartRecord,
  onStopRecord,
  onChangeSourceMode,
  onAskText,
  statusMessage,
  lang,
}) => {
  const t = translations[lang] || translations.pt;
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedQuestion, setTypedQuestion] = useState('');

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedQuestion.trim() || isBusy || state === 'recording') return;

    onAskText(typedQuestion.trim());
    setTypedQuestion('');
    setShowTextInput(false);
  };

  const isBusy = state === 'transcribing' || state === 'generating';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Audio Source Selector */}
      <div className="source-segmented" role="group" aria-label={t.sourceAria}>
        <button
          type="button"
          className={`source-seg-btn ${sourceMode === 'mixed' ? 'active' : ''}`}
          onClick={() => onChangeSourceMode('mixed')}
          disabled={state === 'recording' || isBusy}
          title={t.sourceMixedTooltip}
        >
          <Volume2 size={14} />
          <span>{t.sourceMixed}</span>
        </button>
        <button
          type="button"
          className={`source-seg-btn ${sourceMode === 'system' ? 'active' : ''}`}
          onClick={() => onChangeSourceMode('system')}
          disabled={state === 'recording' || isBusy}
          title={t.sourceCallTooltip}
        >
          <Headphones size={14} />
          <span>{t.sourceCall}</span>
        </button>
        <button
          type="button"
          className={`source-seg-btn ${sourceMode === 'mic' ? 'active' : ''}`}
          onClick={() => onChangeSourceMode('mic')}
          disabled={state === 'recording' || isBusy}
          title={t.sourceMicTooltip}
        >
          <Mic size={14} />
          <span>{t.sourceMic}</span>
        </button>
      </div>

      {/* Main Action Button */}
      <div className="record-btn-container">
        {state === 'recording' ? (
          <button
            type="button"
            className="big-record-btn btn-recording"
            onClick={onStopRecord}
            title={t.stopBtnTitle}
            aria-label={t.stopBtnTitle}
          >
            <Square size={17} fill="currentColor" />
            <span>{t.stopAndAnswer(formatTime(elapsedSec))}</span>
          </button>
        ) : isBusy ? (
          <button
            type="button"
            className="big-record-btn btn-processing"
            disabled
            aria-busy="true"
          >
            <Loader2 size={18} className="spinner" />
            <span>
              {statusMessage ||
                (state === 'transcribing' ? t.transcribingStatus : t.generatingStatus)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="big-record-btn btn-ready"
            onClick={onStartRecord}
            title={t.recordBtnTitle}
            aria-label={t.recordBtn}
          >
            <Mic size={18} />
            <span>{t.recordBtn}</span>
            <span
              style={{
                fontSize: '11px',
                backgroundColor: 'rgba(255, 255, 255, 0.22)',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {t.recordSpace}
            </span>
          </button>
        )}
      </div>

      {/* Manual Text Input Option */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {!showTextInput ? (
          <button
            type="button"
            onClick={() => setShowTextInput(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'inherit',
              fontWeight: 500,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--blue-600)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Keyboard size={14} />
            <span>{t.typeManually}</span>
          </button>
        ) : (
          <form
            onSubmit={handleTextSubmit}
            style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '2px' }}
          >
            <input
              type="text"
              className="form-input"
              placeholder={t.inputPlaceholder}
              value={typedQuestion}
              onChange={(e) => setTypedQuestion(e.target.value)}
              autoFocus
              disabled={isBusy || state === 'recording'}
            />
            <button
              type="submit"
              className="icon-btn"
              style={{
                backgroundColor: 'var(--blue-600)',
                borderColor: 'var(--blue-600)',
                color: 'var(--text-inverse)',
                width: '36px',
                height: '36px',
                flexShrink: 0,
              }}
              disabled={!typedQuestion.trim() || isBusy || state === 'recording'}
              title={t.sendQuestion}
              aria-label={t.sendQuestion}
            >
              <Send size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '36px', height: '36px', flexShrink: 0 }}
              onClick={() => setShowTextInput(false)}
              title={t.cancel}
              aria-label={t.cancel}
            >
              <X size={15} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
