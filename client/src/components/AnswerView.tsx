import React, { useState } from 'react';
import {
  Copy,
  Check,
  MessageSquare,
  AlertCircle,
  RotateCcw,
  Bot,
  Headphones,
  CheckCheck,
} from 'lucide-react';
import { AssistantState } from '../types';
import { Language, translations } from '../i18n';

interface AnswerViewProps {
  question: string;
  answer: string;
  state: AssistantState;
  activeModelName?: string;
  activeProvider?: string;
  errorMessage?: string;
  onRetry?: () => void;
  lang: Language;
}

// Clean and highly readable Markdown renderer for live assistant answers
function renderFormattedMarkdown(content: string) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let keyIdx = 0;
    const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    const splitMatches = text.split(inlineRegex);

    for (const token of splitMatches) {
      if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
        parts.push(
          <code key={`code-${keyIdx++}`} className="inline-code">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
        parts.push(
          <strong key={`bold-${keyIdx++}`} className="bold-emphasis">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token) {
        parts.push(token);
      }
    }

    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block opening or closing
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`codeblock-${i}`} className="code-block-container">
            {codeBlockLang && (
              <div className="code-block-header">
                <span>{codeBlockLang}</span>
              </div>
            )}
            <pre className="code-block-pre">
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Blank lines
    if (!line.trim()) {
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="md-heading-3">
          {parseInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="md-heading-2">
          {parseInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="md-heading-1">
          {parseInline(line.slice(2))}
        </h1>
      );
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const bulletText = line.trim().slice(2);
      elements.push(
        <div key={`li-${i}`} className="md-bullet-item">
          <span className="md-bullet-dot" aria-hidden="true" />
          <div className="md-bullet-content">{parseInline(bulletText)}</div>
        </div>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <div key={`oli-${i}`} className="md-numbered-item">
            <span className="md-numbered-idx">{match[1]}.</span>
            <div className="md-bullet-content">{parseInline(match[2])}</div>
          </div>
        );
      }
    } else {
      elements.push(
        <p key={`p-${i}`} className="md-paragraph">
          {parseInline(line)}
        </p>
      );
    }
  }

  // Handle stream still inside code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <div key="codeblock-unclosed" className="code-block-container">
        {codeBlockLang && (
          <div className="code-block-header">
            <span>{codeBlockLang}</span>
          </div>
        )}
        <pre className="code-block-pre">
          <code>{codeBlockContent.join('\n')}</code>
        </pre>
      </div>
    );
  }

  return elements;
}

export const AnswerView: React.FC<AnswerViewProps> = ({
  question,
  answer,
  state,
  activeModelName,
  errorMessage,
  onRetry,
  lang,
}) => {
  const t = translations[lang] || translations.pt;
  const [copiedQuestion, setCopiedQuestion] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const handleCopyQuestion = () => {
    if (!question) return;
    navigator.clipboard.writeText(question);
    setCopiedQuestion(true);
    setTimeout(() => setCopiedQuestion(false), 2000);
  };

  const handleCopyAnswer = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  const isStreaming = state === 'generating';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Question Card */}
      {question && (
        <div className="question-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                color: 'var(--blue-700)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <MessageSquare size={13} />
              <span>{t.questionIdentified}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyQuestion}
              className="copy-btn-subtle"
              title={t.copyQuestionTitle}
              aria-label={t.copyQuestionTitle}
            >
              {copiedQuestion ? <Check size={12} color="var(--success-solid)" /> : <Copy size={12} />}
              <span>{copiedQuestion ? t.copied : t.copy}</span>
            </button>
          </div>
          <div className="question-text">{question}</div>
        </div>
      )}

      {/* Error Banner */}
      {state === 'error' && errorMessage && (
        <div className="card-surface error-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle
              size={18}
              color="var(--danger-solid)"
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--danger-text)',
                  marginBottom: '2px',
                }}
              >
                {t.errorTitle}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--danger-text)',
                  lineHeight: 1.5,
                  opacity: 0.9,
                }}
              >
                {errorMessage}
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="retry-btn"
                >
                  <RotateCcw size={12} />
                  <span>{t.retry}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recommended Answer Card */}
      {(answer || isStreaming) && (
        <div className="card-surface answer-card">
          <div className="answer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Bot size={16} color="var(--blue-600)" />
              <span className="answer-title">{t.suggestedAnswer}</span>
              {activeModelName && (
                <span className="badge badge-blue" style={{ fontSize: '10.5px' }}>
                  {activeModelName}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleCopyAnswer}
              disabled={isStreaming || !answer}
              className={`copy-answer-btn ${copiedAnswer ? 'copied' : ''}`}
              title={t.copyAnswerTitle}
              aria-label={t.copyAnswerTitle}
            >
              {copiedAnswer ? (
                <CheckCheck size={13} color="var(--success-solid)" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copiedAnswer ? t.copiedAnswer : t.copyAnswer}</span>
            </button>
          </div>

          <div className="markdown-body">
            {renderFormattedMarkdown(answer)}
            {isStreaming && <span className="streaming-cursor" />}
          </div>
        </div>
      )}

      {/* Initial Empty State */}
      {!question && !answer && state === 'idle' && (
        <div className="empty-state-container">
          <div className="empty-state-icon" aria-hidden="true">
            <Headphones size={22} />
          </div>
          <div className="empty-state-title">{t.emptyTitle}</div>
          <div className="empty-state-desc">{t.emptyDesc}</div>
        </div>
      )}
    </div>
  );
};
