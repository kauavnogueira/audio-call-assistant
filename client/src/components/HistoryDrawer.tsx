import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Trash2,
  X,
  Clock,
  ChevronRight,
  ArrowLeft,
  Search,
  Copy,
  Check,
  Sparkles,
  Bot,
  MessageSquare,
  CornerDownLeft,
} from 'lucide-react';
import { HistoryItem } from '../types';
import { Language, translations } from '../i18n';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onDeleteItem?: (id: string) => void;
  lang: Language;
}

// Lightweight Markdown / Text formatter for readable detail view
function renderDetailMarkdown(content: string) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={match.index} className="inline-code">
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <div key={`code-${i}`} className="detail-code-block">
            {codeBlockLang && <div className="detail-code-lang">{codeBlockLang}</div>}
            <pre>
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          </div>
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={`bullet-${i}`} className="detail-bullet-item">
          <span className="bullet-dot">•</span>
          <div>{parseInline(line.trim().slice(2))}</div>
        </div>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="detail-paragraph">
        {parseInline(line)}
      </p>
    );
  }

  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <div key="code-tail" className="detail-code-block">
        <pre>
          <code>{codeBlockContent.join('\n')}</code>
        </pre>
      </div>
    );
  }

  return elements;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectItem,
  onClearHistory,
  onDeleteItem,
  lang,
}) => {
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedField, setCopiedField] = useState<'question' | 'answer' | null>(null);

  // Safe history array guarantee to prevent TypeError: history.map is not a function
  const safeHistory = useMemo(() => (Array.isArray(history) ? history : []), [history]);

  // Support Escape key to dismiss drawer or exit detail view
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedItem) {
          setSelectedItem(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItem, onClose]);

  // Reset selected item and confirmation when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedItem(null);
      setConfirmClear(false);
      setSearchTerm('');
      setCopiedField(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const t = translations[lang] || translations.pt;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatFullDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString([], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = async (text: string, field: 'question' | 'answer') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Filtered history by search term
  const filteredHistory = safeHistory.filter((item) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.question?.toLowerCase().includes(q) ||
      item.answer?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="history-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
    >
      {/* Drawer Top Navigation Bar */}
      <header className="history-header">
        <div className="history-header-left">
          {/* Primary Back Button */}
          <button
            type="button"
            onClick={selectedItem ? () => setSelectedItem(null) : onClose}
            className="drawer-back-btn"
            title={selectedItem ? t.backToList : t.backToHome}
            aria-label={selectedItem ? t.backToList : t.backToHome}
          >
            <ArrowLeft size={16} />
            <span>{selectedItem ? t.backToList : t.back}</span>
          </button>

          <div className="history-title-wrap">
            <History size={16} className="history-header-icon" />
            <h2 id="history-drawer-title" className="history-title">
              {selectedItem ? t.historyDetailsTitle : t.historyTitleModal}
            </h2>
            {!selectedItem && (
              <span className="badge badge-blue">{safeHistory.length}</span>
            )}
          </div>
        </div>

        <div className="history-header-right">
          {!selectedItem && safeHistory.length > 0 && (
            confirmClear ? (
              <div className="history-confirm-clear">
                <span className="confirm-text">{lang === 'en' ? 'Clear all?' : 'Limpar tudo?'}</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory();
                    setConfirmClear(false);
                  }}
                  className="confirm-btn danger"
                  title="Confirm"
                >
                  {lang === 'en' ? 'Yes' : 'Sim'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="confirm-btn cancel"
                  title="Cancel"
                >
                  {lang === 'en' ? 'No' : 'Não'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="icon-btn"
                title={t.clearHistory}
                aria-label={t.clearHistory}
                style={{ color: 'var(--danger-solid)' }}
              >
                <Trash2 size={15} />
              </button>
            )
          )}

          {/* Close button */}
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
      </header>

      {/* Drawer Content */}
      <div className="history-body">
        {selectedItem ? (
          /* Detail View of Selected History Item */
          <div className="history-detail-view">
            {/* Metadata Bar */}
            <div className="history-detail-meta">
              <div className="history-meta-left">
                <span className="history-detail-time">
                  <Clock size={12} />
                  {formatFullDate(selectedItem.timestamp)}
                </span>
                <span className="badge badge-blue">{selectedItem.model}</span>
                {selectedItem.provider && (
                  <span className="badge badge-neutral">{selectedItem.provider}</span>
                )}
              </div>

              {onDeleteItem && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteItem(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className="icon-btn danger"
                  title={t.historyDeleteTooltip}
                  aria-label={t.historyDeleteTooltip}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Question Card */}
            <div className="history-detail-card">
              <div className="history-card-header">
                <div className="history-card-label">
                  <MessageSquare size={14} color="var(--blue-600)" />
                  <span>{t.historyQuestionLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedItem.question, 'question')}
                  className="copy-btn-mini"
                  title={t.copyQuestionTitle}
                >
                  {copiedField === 'question' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedField === 'question' ? t.copied : t.copy}</span>
                </button>
              </div>
              <div className="history-question-body">{selectedItem.question}</div>
            </div>

            {/* Answer Card */}
            <div className="history-detail-card">
              <div className="history-card-header">
                <div className="history-card-label">
                  <Bot size={14} color="var(--blue-600)" />
                  <span>{t.historyAnswerLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedItem.answer, 'answer')}
                  className="copy-btn-mini"
                  title={t.copyAnswerTitle}
                >
                  {copiedField === 'answer' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedField === 'answer' ? t.copiedAnswer : t.copyAnswer}</span>
                </button>
              </div>
              <div className="history-answer-body">
                {renderDetailMarkdown(selectedItem.answer)}
              </div>
            </div>

            {/* Detail Actions Footer */}
            <div className="history-detail-footer">
              <button
                type="button"
                onClick={() => {
                  onSelectItem(selectedItem);
                  onClose();
                }}
                className="history-load-btn"
              >
                <CornerDownLeft size={15} />
                <span>{t.historyLoadInAssistant}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="history-back-secondary-btn"
              >
                <ArrowLeft size={15} />
                <span>{t.backToList}</span>
              </button>
            </div>
          </div>
        ) : safeHistory.length === 0 ? (
          /* Friendly Empty State View */
          <div className="history-empty-container">
            <div className="history-empty-card">
              {/* Friendly Illustrated Icon */}
              <div className="history-empty-icon-box">
                <div className="history-empty-icon-glow" />
                <History size={38} className="history-empty-icon" />
              </div>

              {/* Title & Description */}
              <h3 className="history-empty-title">{t.noHistory}</h3>
              <p className="history-empty-desc">{t.noHistoryDesc}</p>

              {/* Helpful Tips Card */}
              <div className="history-tips-card">
                <div className="history-tips-header">
                  <Sparkles size={14} color="var(--blue-600)" />
                  <span>{t.historyTipTitle}</span>
                </div>
                <div className="history-tip-row">
                  <span className="history-tip-number">1</span>
                  <p>{t.historyTipSpace}</p>
                </div>
                <div className="history-tip-row">
                  <span className="history-tip-number">2</span>
                  <p>{t.historyTipManual}</p>
                </div>
              </div>

              {/* High visibility Return/Back button so user never gets stuck */}
              <button
                type="button"
                onClick={onClose}
                className="friendly-back-btn"
                title={t.backToHome}
              >
                <ArrowLeft size={16} />
                <span>{t.backToHome}</span>
              </button>
            </div>
          </div>
        ) : (
          /* List of History Items */
          <div className="history-list-view">
            {/* Search filter if there are multiple items */}
            {safeHistory.length > 2 && (
              <div className="history-search-bar">
                <Search size={14} className="history-search-icon" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.historySearchPlaceholder}
                  className="history-search-input"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="history-search-clear"
                    title={t.close}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {filteredHistory.length === 0 ? (
              <div className="history-no-results">
                <Search size={24} color="var(--text-muted)" />
                <p>{lang === 'en' ? 'No questions match your search.' : 'Nenhuma pergunta encontrada para esta busca.'}</p>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="history-clear-search-btn"
                >
                  {lang === 'en' ? 'Clear search' : 'Limpar busca'}
                </button>
              </div>
            ) : (
              <div className="history-cards-column">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedItem(item);
                      }
                    }}
                    className="history-card"
                  >
                    <div className="history-card-top">
                      <div className="history-card-meta">
                        <span className="history-card-time">
                          <Clock size={11} />
                          {formatTime(item.timestamp)}
                        </span>
                        <span className="badge badge-blue">{item.model}</span>
                      </div>

                      <div className="history-card-actions" onClick={(e) => e.stopPropagation()}>
                        {onDeleteItem && (
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item.id)}
                            className="history-card-del-btn"
                            title={t.historyDeleteTooltip}
                            aria-label={t.historyDeleteTooltip}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <ChevronRight size={14} className="history-card-chevron" />
                      </div>
                    </div>

                    <h4 className="history-card-question">{item.question}</h4>
                    <p className="history-card-answer">{item.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
