import React from 'react';
import {
  Settings,
  History,
  Headphones,
  ChevronDown,
} from 'lucide-react';
import { AppConfig, ModelsResponse } from '../types';
import { Language, translations } from '../i18n';

interface HeaderProps {
  config: AppConfig | null;
  modelsData: ModelsResponse | null;
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  isHistoryOpen?: boolean;
  historyCount: number;
  onSelectModel: (provider: AppConfig['provider'], model: string) => void;
  isRecording: boolean;
  lang: Language;
  onChangeLanguage: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  modelsData,
  onOpenSettings,
  onToggleHistory,
  isHistoryOpen,
  historyCount,
  onSelectModel,
  isRecording,
  lang,
  onChangeLanguage,
}) => {
  const t = translations[lang] || translations.pt;
  const currentProvider = config?.provider || 'groq';
  const currentModel = config?.model || 'qwen/qwen3.8-27b';

  const providerCatalog = modelsData?.providers?.[currentProvider];
  const activeModelObj = providerCatalog?.models.find((m) => m.id === currentModel);
  const activeModelName = activeModelObj?.name || currentModel;

  return (
    <header className="hud-header">
      {/* Left: Branding & Status */}
      <div className="header-left">
        <div
          className={`header-logo ${isRecording ? 'recording' : ''}`}
          aria-hidden="true"
        >
          <Headphones size={15} />
        </div>
        <div className="header-title-box">
          <span className="header-title">{t.appTitle}</span>
          {isRecording && (
            <span className="badge badge-danger header-rec-badge">
              {t.recording}
            </span>
          )}
        </div>
      </div>

      {/* Right: Inline Controls (Language, Model, History, Settings) */}
      <div className="header-right">
        {/* Language Switcher Pill */}
        <div
          className="lang-switcher"
          role="group"
          aria-label={t.switchLangTitle}
          title={t.switchLangTitle}
        >
          <button
            type="button"
            className={`lang-btn ${lang === 'pt' ? 'active' : ''}`}
            onClick={() => onChangeLanguage('pt')}
            aria-pressed={lang === 'pt'}
          >
            PT
          </button>
          <button
            type="button"
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => onChangeLanguage('en')}
            aria-pressed={lang === 'en'}
          >
            EN
          </button>
        </div>

        {/* Quick Model Selector Dropdown */}
        <div className="model-dropdown-wrapper">
          <select
            value={`${currentProvider}:${currentModel}`}
            onChange={(e) => {
              const [p, m] = e.target.value.split(':');
              onSelectModel(p as AppConfig['provider'], m);
            }}
            aria-label={t.selectModel}
            className="model-select-dropdown"
            title={t.activeModelTitle(activeModelName, currentProvider)}
          >
            {modelsData &&
              Object.entries(modelsData.providers).map(([pKey, pData]) => (
                <optgroup key={pKey} label={pData.name}>
                  {pData.models.map((m) => (
                    <option key={`${pKey}:${m.id}`} value={`${pKey}:${m.id}`}>
                      {m.name}{m.badge ? ` • ${m.badge}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
          <ChevronDown
            size={12}
            className="model-dropdown-chevron"
            aria-hidden="true"
          />
        </div>

        {/* History Toggle Button */}
        <button
          type="button"
          className={`icon-btn header-action-btn ${isHistoryOpen ? 'active' : ''}`}
          onClick={onToggleHistory}
          title={t.historyTitle}
          aria-label={t.historyTitle}
        >
          <History size={15} />
          {historyCount > 0 && (
            <span className="history-badge-count">
              {historyCount}
            </span>
          )}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          className="icon-btn header-action-btn"
          onClick={onOpenSettings}
          title={t.settingsTitle}
          aria-label={t.settingsTitle}
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
};
