export type Language = 'pt' | 'en';

export interface Translations {
  appTitle: string;
  recording: string;
  selectModel: string;
  activeModelTitle: (name: string, provider: string) => string;
  pinPinned: string;
  pinUnpinned: string;
  pinAria: string;
  historyTitle: string;
  settingsTitle: string;
  switchLangTitle: string;

  // Audio source
  sourceAria: string;
  sourceMixed: string;
  sourceMixedTooltip: string;
  sourceCall: string;
  sourceCallTooltip: string;
  sourceMic: string;
  sourceMicTooltip: string;

  // Recording controls
  recordBtn: string;
  recordSpace: string;
  recordBtnTitle: string;
  stopAndAnswer: (time: string) => string;
  stopBtnTitle: string;
  transcribingStatus: string;
  generatingStatus: string;
  sendingStatus: string;
  typeManually: string;
  inputPlaceholder: string;
  sendQuestion: string;
  cancel: string;

  // Answer & Question
  questionIdentified: string;
  copy: string;
  copied: string;
  copyQuestionTitle: string;
  suggestedAnswer: string;
  copyAnswer: string;
  copiedAnswer: string;
  copyAnswerTitle: string;
  errorTitle: string;
  retry: string;
  emptyTitle: string;
  emptyDesc: string;

  // History
  historyTitleModal: string;
  clearHistory: string;
  clearHistoryConfirm: string;
  close: string;
  back: string;
  backToHome: string;
  backToList: string;
  noHistory: string;
  noHistoryDesc: string;
  historyTipTitle: string;
  historyTipSpace: string;
  historyTipManual: string;
  historySearchPlaceholder: string;
  historyDetailsTitle: string;
  historyLoadInAssistant: string;
  historyQuestionLabel: string;
  historyAnswerLabel: string;
  historyDeleteTooltip: string;
  // Settings
  settingsTitleModal: string;
  settingsSubtitle: string;
  langSectionTitle: string;
  langSectionDesc: string;
  langPt: string;
  langPtDesc: string;
  langEn: string;
  langEnDesc: string;
  aiProviderTitle: string;
  aiModelTitle: string;
  apiKeysTitle: string;
  apiKeysDesc: string;
  sttTitle: string;
  sttProvider: string;
  sttModel: string;
  promptModeTitle: string;
  promptModeDesc: string;
  modeMeeting: string;
  modeMeetingDesc: string;
  modeInterview: string;
  modeInterviewDesc: string;
  modeCoding: string;
  modeCodingDesc: string;
  modeCustom: string;
  modeCustomDesc: string;
  customPromptPlaceholder: string;
  desktopSectionTitle: string;
  desktopSectionDesc: string;
  minimizeToTrayLabel: string;
  minimizeToTrayDesc: string;
  launchAtStartupLabel: string;
  launchAtStartupDesc: string;
  saveSettings: string;
  savingSettings: string;
  savedSuccess: string;
}

export const translations: Record<Language, Translations> = {
  pt: {
    appTitle: 'Assistente de Voz',
    recording: 'Gravando',
    selectModel: 'Selecionar modelo de IA',
    activeModelTitle: (name, provider) => `Modelo: ${name} (${provider})`,
    pinPinned: 'Fixado no topo (sobrepondo janelas)',
    pinUnpinned: 'Fixar janela no topo',
    pinAria: 'Alternar janela sempre visível no topo',
    historyTitle: 'Histórico de consultas',
    settingsTitle: 'Configurações',
    switchLangTitle: 'Alternar idioma (Português / Inglês)',

    sourceAria: 'Fonte de captura de áudio',
    sourceMixed: 'Misto',
    sourceMixedTooltip: 'Captura simultaneamente a chamada e o seu microfone',
    sourceCall: 'Chamada',
    sourceCallTooltip: 'Captura o áudio que sai da chamada (fone ou alto-falante)',
    sourceMic: 'Microfone',
    sourceMicTooltip: 'Captura somente o seu microfone',

    recordBtn: 'Gravar pergunta',
    recordSpace: 'Espaço',
    recordBtnTitle: 'Iniciar captura da fala ao vivo (Espaço)',
    stopAndAnswer: (time) => `Parar e responder (${time})`,
    stopBtnTitle: 'Concluir gravação e gerar resposta (Espaço)',
    transcribingStatus: 'Transcrevendo fala...',
    generatingStatus: 'Processando resposta...',
    sendingStatus: 'Enviando pergunta...',
    typeManually: 'Digitar pergunta manualmente',
    inputPlaceholder: 'Digite a dúvida da reunião ou cole o texto...',
    sendQuestion: 'Enviar pergunta',
    cancel: 'Cancelar digitação',

    questionIdentified: 'Pergunta identificada',
    copy: 'Copiar',
    copied: 'Copiado',
    copyQuestionTitle: 'Copiar texto da pergunta',
    suggestedAnswer: 'Resposta sugerida',
    copyAnswer: 'Copiar resposta',
    copiedAnswer: 'Copiado!',
    copyAnswerTitle: 'Copiar resposta sugerida',
    errorTitle: 'Não foi possível processar',
    retry: 'Tentar novamente',
    emptyTitle: 'Pronto para sua chamada',
    emptyDesc: 'Pressione Espaço ou clique em Gravar pergunta quando alguém fizer uma pergunta na reunião.',

    historyTitleModal: 'Histórico da sessão',
    clearHistory: 'Limpar histórico',
    clearHistoryConfirm: 'Deseja limpar todo o histórico de perguntas desta sessão?',
    close: 'Fechar histórico',
    back: 'Voltar',
    backToHome: 'Voltar ao assistente',
    backToList: 'Voltar para a lista',
    noHistory: 'Nenhuma pergunta registrada ainda',
    noHistoryDesc: 'Aqui ficarão salvas todas as perguntas e respostas inteligentes geradas durante a sua reunião.',
    historyTipTitle: 'Como funciona o histórico:',
    historyTipSpace: 'Pressione Espaço durante a reunião para capturar perguntas e respostas em tempo real.',
    historyTipManual: 'Você também pode digitar ou colar perguntas manualmente a qualquer momento.',
    historySearchPlaceholder: 'Buscar perguntas ou respostas...',
    historyDetailsTitle: 'Detalhes da Consulta',
    historyLoadInAssistant: 'Carregar no Assistente',
    historyQuestionLabel: 'Pergunta identificada',
    historyAnswerLabel: 'Resposta sugerida',
    historyDeleteTooltip: 'Excluir esta pergunta do histórico',

    settingsTitleModal: 'Configurações do Assistente',
    settingsSubtitle: 'Configure modelos de IA, transcrição e idioma de respostas',
    langSectionTitle: 'Idioma das Respostas e Interface',
    langSectionDesc: 'Define o idioma utilizado nas respostas da IA, transcrição do áudio e na interface.',
    langPt: 'Português',
    langPtDesc: 'Respostas da IA em Português e transcrição otimizada para PT-BR',
    langEn: 'English',
    langEnDesc: 'AI responses in English and transcription optimized for English',
    aiProviderTitle: 'Provedor de IA',
    aiModelTitle: 'Modelo de Linguagem',
    apiKeysTitle: 'Chaves de API',
    apiKeysDesc: 'Chaves armazenadas localmente no seu dispositivo (~/.config/audio-call-assistant).',
    sttTitle: 'Transcrição de Áudio (Speech-to-Text)',
    sttProvider: 'Provedor de Transcrição',
    sttModel: 'Modelo Whisper',
    promptModeTitle: 'Estilo de Resposta do Copiloto',
    promptModeDesc: 'Escolha a formatação ideal para o seu contexto de chamada.',
    modeMeeting: 'Reunião Concisa',
    modeMeetingDesc: 'Direto ao ponto com bullet points técnicos',
    modeInterview: 'Entrevista Técnica',
    modeInterviewDesc: 'Conceito principal, arquitetura e trade-offs',
    modeCoding: 'Copiloto de Código',
    modeCodingDesc: 'Snippets limpos, Big-O e edge cases',
    modeCustom: 'Prompt Customizado',
    modeCustomDesc: 'Defina suas próprias instruções para a IA',
    customPromptPlaceholder: 'Escreva suas instruções personalizadas para o modelo...',
    desktopSectionTitle: 'Bandeja e Inicialização (Desktop)',
    desktopSectionDesc: 'Controle o comportamento da janela e do atalho global em segundo plano.',
    minimizeToTrayLabel: 'Minimizar para a bandeja ao fechar',
    minimizeToTrayDesc: 'Mantém o atalho Ctrl+Shift+Space ativo perto do relógio. Use "Sair" na bandeja para encerrar.',
    launchAtStartupLabel: 'Iniciar automaticamente com o sistema',
    launchAtStartupDesc: 'Abre discretamente minimizado na bandeja ao fazer login no computador.',
    saveSettings: 'Salvar Configurações',
    savingSettings: 'Salvando...',
    savedSuccess: 'Configurações salvas com sucesso!',
  },
  en: {
    appTitle: 'Voice Assistant',
    recording: 'Recording',
    selectModel: 'Select AI model',
    activeModelTitle: (name, provider) => `Model: ${name} (${provider})`,
    pinPinned: 'Pinned on top (overlaying windows)',
    pinUnpinned: 'Pin window on top',
    pinAria: 'Toggle window always on top',
    historyTitle: 'Consultation history',
    settingsTitle: 'Settings',
    switchLangTitle: 'Switch language (Portuguese / English)',

    sourceAria: 'Audio capture source',
    sourceMixed: 'Mixed',
    sourceMixedTooltip: 'Captures both call audio and your microphone',
    sourceCall: 'Call',
    sourceCallTooltip: 'Captures incoming call audio (headphones/speakers)',
    sourceMic: 'Microphone',
    sourceMicTooltip: 'Captures your microphone only',

    recordBtn: 'Record question',
    recordSpace: 'Space',
    recordBtnTitle: 'Start live speech capture (Space)',
    stopAndAnswer: (time) => `Stop and answer (${time})`,
    stopBtnTitle: 'Finish recording and generate answer (Space)',
    transcribingStatus: 'Transcribing speech...',
    generatingStatus: 'Processing response...',
    sendingStatus: 'Sending question...',
    typeManually: 'Type question manually',
    inputPlaceholder: 'Type the meeting question or paste text...',
    sendQuestion: 'Send question',
    cancel: 'Cancel input',

    questionIdentified: 'Identified question',
    copy: 'Copy',
    copied: 'Copied',
    copyQuestionTitle: 'Copy question text',
    suggestedAnswer: 'Suggested answer',
    copyAnswer: 'Copy answer',
    copiedAnswer: 'Copied!',
    copyAnswerTitle: 'Copy suggested answer',
    errorTitle: 'Unable to process',
    retry: 'Try again',
    emptyTitle: 'Ready for your call',
    emptyDesc: 'Press Space or click Record question when someone asks a question in your meeting.',

    historyTitleModal: 'Session History',
    clearHistory: 'Clear history',
    clearHistoryConfirm: 'Are you sure you want to clear all history from this session?',
    close: 'Close history',
    back: 'Back',
    backToHome: 'Back to assistant',
    backToList: 'Back to list',
    noHistory: 'No questions recorded yet',
    noHistoryDesc: 'All questions and smart answers generated during your meeting will be saved here.',
    historyTipTitle: 'How history works:',
    historyTipSpace: 'Press Space during meetings to capture questions and answers in real time.',
    historyTipManual: 'You can also type or paste questions manually at any time.',
    historySearchPlaceholder: 'Search questions or answers...',
    historyDetailsTitle: 'Question Details',
    historyLoadInAssistant: 'Load into Assistant',
    historyQuestionLabel: 'Identified question',
    historyAnswerLabel: 'Suggested answer',
    historyDeleteTooltip: 'Delete this question from history',
    settingsTitleModal: 'Assistant Settings',
    settingsSubtitle: 'Configure AI models, transcription, and response language',
    langSectionTitle: 'Response & Interface Language',
    langSectionDesc: 'Sets the language for AI responses, audio transcription, and UI.',
    langPt: 'Português',
    langPtDesc: 'AI responses in Portuguese and optimized PT-BR transcription',
    langEn: 'English',
    langEnDesc: 'AI responses in English and transcription optimized for English',
    aiProviderTitle: 'AI Provider',
    aiModelTitle: 'Language Model',
    apiKeysTitle: 'API Keys',
    apiKeysDesc: 'Keys are stored locally on your machine (~/.config/audio-call-assistant).',
    sttTitle: 'Audio Transcription (Speech-to-Text)',
    sttProvider: 'Transcription Provider',
    sttModel: 'Whisper Model',
    promptModeTitle: 'Copilot Response Style',
    promptModeDesc: 'Choose the best output format for your call context.',
    modeMeeting: 'Concise Meeting',
    modeMeetingDesc: 'Direct answer with concise technical bullets',
    modeInterview: 'Technical Interview',
    modeInterviewDesc: 'Core concepts, architecture, and trade-offs',
    modeCoding: 'Coding Copilot',
    modeCodingDesc: 'Clean code snippets, Big-O, and edge cases',
    modeCustom: 'Custom Prompt',
    modeCustomDesc: 'Define your own instructions for the AI',
    customPromptPlaceholder: 'Enter custom system instructions for the AI...',
    desktopSectionTitle: 'Tray & Startup (Desktop)',
    desktopSectionDesc: 'Control background window behavior and global hotkey availability.',
    minimizeToTrayLabel: 'Minimize to tray on close',
    minimizeToTrayDesc: 'Keeps Ctrl+Shift+Space active in the system tray. Use "Quit" in the tray menu to exit.',
    launchAtStartupLabel: 'Launch at system startup',
    launchAtStartupDesc: 'Starts silently minimized in the system tray when you log in.',
    saveSettings: 'Save Settings',
    savingSettings: 'Saving...',
    savedSuccess: 'Settings saved successfully!',
  },
};
