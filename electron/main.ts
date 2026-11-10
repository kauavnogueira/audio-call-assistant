import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  session,
  shell,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Embedded backend server & configuration
import {
  startServer,
  stopServer,
  onConfigUpdated,
  onRecordingStateChange,
  audioCapture,
} from '../server/index.js';
import { getConfig, saveConfig, AppConfig } from '../server/configManager.js';

const appDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverPort = Number(process.env.PORT) || 5000;
let isQuitting = false;
let isRecording = false;

const GLOBAL_RECORD_SHORTCUT = 'CommandOrControl+Shift+Space';
const START_HIDDEN = process.argv.includes('--hidden');

function resolveAssetPath(relativeFromRoot: string): string | null {
  const candidates = [
    path.resolve(appDir, '../../', relativeFromRoot),
    path.resolve(process.cwd(), relativeFromRoot),
    path.resolve(process.resourcesPath || '', relativeFromRoot),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolvePreloadPath(): string {
  const candidates = [
    path.join(appDir, 'preload.cjs'),
    path.join(appDir, 'preload.js'),
    path.resolve(process.cwd(), 'dist/electron/preload.cjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function getTargetUrl(): string {
  return process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${serverPort}/`;
}

function isAllowedLocalOrigin(originOrUrl: string): boolean {
  if (!originOrUrl) return false;
  if (originOrUrl.startsWith(`http://127.0.0.1:${serverPort}`)) return true;
  if (process.env.VITE_DEV_SERVER_URL && originOrUrl.startsWith(process.env.VITE_DEV_SERVER_URL)) {
    return true;
  }
  return false;
}

function showAndFocusWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow({ show: true });
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindowVisibility(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow({ show: true });
    return;
  }
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    showAndFocusWindow();
  }
}

function triggerRecordToggle(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow({ show: true }).then(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow?.webContents.send('trigger-record-toggle');
        });
      } else {
        mainWindow.webContents.send('trigger-record-toggle');
      }
    });
    return;
  }

  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    showAndFocusWindow();
  }
  mainWindow.webContents.send('trigger-record-toggle');
}

function updateTrayMenu(cfg: AppConfig = getConfig()): void {
  if (!tray) return;

  const isEn = cfg.language === 'en';
  const isVisible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
  const isPinned = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isAlwaysOnTop());
  const minimizeToTray = cfg.minimize_to_tray !== false;

  tray.setToolTip(
    isRecording
      ? isEn
        ? 'Assistente Pessoal de Voz — Recording...'
        : 'Assistente Pessoal de Voz — Gravando...'
      : 'Assistente Pessoal de Voz'
  );

  const menu = Menu.buildFromTemplate([
    {
      label: isVisible
        ? isEn
          ? 'Hide window'
          : 'Ocultar janela'
        : isEn
          ? 'Open assistant'
          : 'Abrir assistente',
      click: () => toggleWindowVisibility(),
    },
    {
      label: isRecording
        ? isEn
          ? 'Stop recording & answer'
          : 'Parar gravação e responder'
        : isEn
          ? 'Record question (Ctrl+Shift+Space)'
          : 'Gravar pergunta (Ctrl+Shift+Space)',
      click: () => triggerRecordToggle(),
    },
    { type: 'separator' },
    {
      label: isEn ? 'Always on top' : 'Sempre no topo',
      type: 'checkbox',
      checked: isPinned,
      click: (item) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(item.checked, 'floating');
          updateTrayMenu();
        }
      },
    },
    {
      label: isEn ? 'Minimize to tray on close' : 'Minimizar para a bandeja ao fechar',
      type: 'checkbox',
      checked: minimizeToTray,
      click: (item) => {
        const updated = saveConfig({ minimize_to_tray: item.checked });
        updateTrayMenu(updated);
      },
    },
    { type: 'separator' },
    {
      label: isEn ? 'Quit' : 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function setupTray(): void {
  if (tray) return;

  try {
    const trayPath =
      resolveAssetPath('build/tray.png') ||
      resolveAssetPath('build/icon.png') ||
      resolveAssetPath('icon.svg');

    let image = trayPath ? nativeImage.createFromPath(trayPath) : nativeImage.createEmpty();
    if (!image.isEmpty() && process.platform === 'win32') {
      image = image.resize({ width: 16, height: 16 });
    } else if (!image.isEmpty()) {
      image = image.resize({ width: 22, height: 22 });
    }

    tray = new Tray(image);
    tray.on('click', () => toggleWindowVisibility());
    tray.on('double-click', () => showAndFocusWindow());
    updateTrayMenu();
  } catch (err) {
    console.warn('[Electron] Tray initialization skipped:', err);
    tray = null;
  }
}

function syncAutoStart(enabled: boolean): void {
  try {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      if (app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          args: enabled ? ['--hidden'] : [],
        });
      } else {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          path: process.execPath,
          args: enabled ? [path.resolve(appDir, '../..'), '--hidden'] : [],
        });
      }
      return;
    }

    if (process.platform === 'linux') {
      const autostartDir = path.join(os.homedir(), '.config', 'autostart');
      const desktopFile = path.join(autostartDir, 'assistente-pessoal-de-voz.desktop');

      if (!enabled) {
        if (fs.existsSync(desktopFile)) {
          fs.unlinkSync(desktopFile);
        }
        return;
      }

      fs.mkdirSync(autostartDir, { recursive: true });

      let execCommand: string;
      if (process.env.APPIMAGE) {
        execCommand = `"${process.env.APPIMAGE}" --hidden`;
      } else if (app.isPackaged) {
        execCommand = `"${process.execPath}" --hidden`;
      } else {
        const startScript = resolveAssetPath('start.sh');
        execCommand = startScript
          ? `"${startScript}" --hidden`
          : `"${process.execPath}" "${path.resolve(appDir, '../..')}" --hidden`;
      }

      const diskIcon =
        app.isPackaged && !process.env.APPIMAGE
          ? 'assistente-pessoal-de-voz'
          : resolveAssetPath('build/icon.png') || resolveAssetPath('icon.svg') || 'assistente-pessoal-de-voz';

      const entry = [
        '[Desktop Entry]',
        'Version=1.0',
        'Type=Application',
        'Name=Assistente Pessoal de Voz',
        'Comment=Assistente pessoal de IA para chamadas de áudio e voz',
        `Exec=${execCommand}`,
        `Icon=${diskIcon}`,
        'Terminal=false',
        'Categories=Utility;AudioVideo;Audio;',
        'X-GNOME-Autostart-enabled=true',
        '',
      ].join('\n');

      fs.writeFileSync(desktopFile, entry, 'utf-8');
    }
  } catch (err) {
    console.warn('[Electron] Failed to sync autostart setting:', err);
  }
}

async function createWindow(options: { show?: boolean } = {}): Promise<void> {
  const shouldShow = options.show ?? true;
  const preloadPath = resolvePreloadPath();
  const iconPath =
    (process.platform === 'win32'
      ? resolveAssetPath('build/icon.ico') || resolveAssetPath('build/icon.png')
      : resolveAssetPath('build/icon.png') || resolveAssetPath('icon.svg')) ?? undefined;

  mainWindow = new BrowserWindow({
    width: 440,
    height: 760,
    minWidth: 380,
    minHeight: 520,
    maxWidth: 640,
    show: false,
    title: 'Assistente Pessoal de Voz',
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (shouldShow && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
    updateTrayMenu();
  });

  mainWindow.on('show', () => updateTrayMenu());
  mainWindow.on('hide', () => updateTrayMenu());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedLocalOrigin(url)) {
      event.preventDefault();
    }
  });
  // Log renderer console warnings/errors to terminal
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.warn(`[Renderer] ${message} (${sourceId}:${line})`);
    }
  });

  // Retry on failed load
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Electron] Failed to load ${validatedURL} (${errorCode}: ${errorDescription}). Retrying...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        void mainWindow.loadURL(getTargetUrl());
      }
    }, 600);
  });

  await mainWindow.loadURL(getTargetUrl());

  mainWindow.on('close', (event) => {
    const cfg = getConfig();
    if (!isQuitting && cfg.minimize_to_tray !== false && tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    updateTrayMenu();
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showAndFocusWindow();
  });

  app.whenReady().then(async () => {
    // Start embedded server on an available ephemeral port (or 5000 in Vite dev mode)
    const preferredPort = process.env.VITE_DEV_SERVER_URL
      ? 5000
      : process.env.PORT
        ? Number(process.env.PORT)
        : 0;
    serverPort = await startServer(preferredPort);

    const initialConfig = getConfig();
    syncAutoStart(Boolean(initialConfig.launch_at_startup));

    // IPC Handlers
    ipcMain.handle('get-always-on-top', () => mainWindow?.isAlwaysOnTop() ?? true);

    ipcMain.handle('toggle-always-on-top', () => {
      if (!mainWindow) return false;
      const next = !mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(next, 'floating');
      updateTrayMenu();
      return next;
    });

    ipcMain.handle('hide-to-tray', () => {
      if (mainWindow && !mainWindow.isDestroyed() && tray) {
        mainWindow.hide();
        return true;
      }
      return false;
    });


    ipcMain.on('set-recording-state', (_event, recording: boolean) => {
      isRecording = Boolean(recording);
      updateTrayMenu();
    });


    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (permission === 'media' || permission === 'display-capture') {
        return isAllowedLocalOrigin(requestingOrigin || webContents?.getURL() || '');
      }
      return false;
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'display-capture') {
        callback(isAllowedLocalOrigin(webContents.getURL()));
        return;
      }
      callback(false);
    });

    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        try {
          const sources = await desktopCapturer.getSources({ types: ['screen'] });
          if (sources.length > 0) {
            callback({ video: sources[0], audio: 'loopback' });
            return;
          }
        } catch (err) {
          console.warn('[Electron] DisplayMediaRequestHandler error:', err);
        }
        callback({});
      },
      { useSystemPicker: false }
    );
    setupTray();

    // Sync Tray and OS autostart whenever config or recording state changes
    onConfigUpdated((updatedCfg) => {
      syncAutoStart(Boolean(updatedCfg.launch_at_startup));
      updateTrayMenu(updatedCfg);
    });

    isRecording = audioCapture.isRecording();
    onRecordingStateChange((recording) => {
      isRecording = recording;
      updateTrayMenu();
    });

    // Create Window (optionally hidden in Tray when launched with --hidden)
    await createWindow({ show: !(START_HIDDEN && tray) });

    // Register Global Shortcut
    globalShortcut.register(GLOBAL_RECORD_SHORTCUT, () => {
      triggerRecordToggle();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow({ show: true });
      } else {
        showAndFocusWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopServer();
});

app.on('window-all-closed', () => {
  const cfg = getConfig();
  if (!tray || cfg.minimize_to_tray === false || isQuitting) {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});
