const {
  app,
  BrowserWindow,
  session,
  shell,
  ipcMain,
  Notification,
  desktopCapturer,
  nativeTheme,
  nativeImage,
  Menu,
  MenuItem,
  clipboard,
  dialog
} = require('electron');
const path = require('path');
const { getConfig, getWindowState } = require('./config');
const { createTray, updateTrayBadge, destroyTray } = require('./tray');
const { createApplicationMenu } = require('./menu');
const {
  isWhatsAppPermissionOrigin,
  isDirectWebWhatsAppUrl,
  isDeepLinkUrl,
  normalizeUserInputToUrl,
  extractDeepLinkFromArgv,
  resolveToWebWhatsAppUrl
} = require('./deeplink');

// 1. Hardware acceleration, Wayland & PipeWire switches optimized for CachyOS
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch(
  'enable-features',
  'WaylandWindowDecorations,WebRTCPipeWireCapturer,VaapiVideoDecoder,VaapiVideoEncoder,VaapiIgnoreDriverChecks,CanvasOopRasterization'
);
app.commandLine.appendSwitch('disable-features', 'Vulkan');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// App identity for KDE Plasma / org.freedesktop.Notifications
app.setName('YakChat');
if (typeof app.setDesktopName === 'function') {
  app.setDesktopName('yakchat.desktop');
}
if (typeof app.setAppUserModelId === 'function') {
  app.setAppUserModelId('yakchat');
}
try {
  app.setAsDefaultProtocolClient('whatsapp');
} catch (_) {}

// 2. Single instance enforcement
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[YakChat] Another instance is already running. Focusing it.');
  app.quit();
  process.exit(0);
}

const startupDeepLink = extractDeepLinkFromArgv(process.argv);
let mainWindow = null;
let openLinkWin = null;
app.isQuitting = false;

// Standard desktop Chrome User-Agent for WebRTC voice/video call compatibility
const chromeVersion = process.versions.chrome || '140.0.0.0';
const customUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

async function handleDeepLink(rawUrl, { showErrorDialog = true } = {}) {
  focusMainWindow();
  try {
    const targetUrl = await resolveToWebWhatsAppUrl(rawUrl, customUserAgent);
    if (targetUrl && mainWindow) {
      mainWindow.loadURL(targetUrl, { userAgent: customUserAgent });
      return true;
    }
  } catch (err) {
    console.warn('[DeepLink] Error resolving URL:', err.message);
  }

  if (showErrorDialog && mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'YakChat',
      message: 'No se pudo abrir el enlace',
      detail: 'El enlace no pudo resolverse a una conversación válida de WhatsApp Web.',
      buttons: ['Aceptar']
    });
  }
  return false;
}

function createWindow(initialUrl = 'https://web.whatsapp.com') {
  const config = getConfig();
  const windowState = getWindowState();

  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: windowState.get('width'),
    height: windowState.get('height'),
    x: windowState.get('x'),
    y: windowState.get('y'),
    minWidth: 700,
    minHeight: 500,
    title: 'YakChat',
    icon: iconPath,
    autoHideMenuBar: config.get('autoHideMenuBar'),
    backgroundColor: '#111b21', // Dark splash color
    show: false, // will show when ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: config.get('spellcheck'),
      // Keep WebRTC calls active when minimized
      backgroundThrottling: false,
      sandbox: false
    }
  });

  if (windowState.get('isMaximized')) {
    mainWindow.maximize();
  }

  // Restore zoom factor
  const savedZoom = config.get('zoomFactor');
  if (savedZoom && savedZoom !== 1.0) {
    mainWindow.webContents.setZoomFactor(savedZoom);
  }
  mainWindow.webContents.on('did-finish-load', () => {
    const currentSavedZoom = config.get('zoomFactor');
    if (currentSavedZoom && currentSavedZoom !== 1.0) {
      mainWindow.webContents.setZoomFactor(currentSavedZoom);
    }
  });

  // Set window User-Agent
  mainWindow.webContents.setUserAgent(customUserAgent);

  // Setup Application Menu and Tray
  createApplicationMenu(mainWindow);
  createTray(mainWindow);
  setupContextMenu(mainWindow);

  // Load WhatsApp Web or resolved startup deep-link
  mainWindow.loadURL(initialUrl, {
    userAgent: customUserAgent
  });

  // Show window when ready unless configured to start minimized
  mainWindow.once('ready-to-show', () => {
    const startMinimizedFlag = process.argv.includes('--start-minimized');
    if (!config.get('startMinimized') && !startMinimizedFlag) {
      mainWindow.show();
    }
  });

  // Track window bounds & maximized state
  const saveBounds = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds();
      windowState.set('width', bounds.width);
      windowState.set('height', bounds.height);
      windowState.set('x', bounds.x);
      windowState.set('y', bounds.y);
      windowState.set('isMaximized', false);
    } else if (mainWindow.isMaximized()) {
      windowState.set('isMaximized', true);
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('maximize', () => windowState.set('isMaximized', true));
  mainWindow.on('unmaximize', () => windowState.set('isMaximized', false));

  // Close to tray handling
  mainWindow.on('close', (event) => {
    if (!app.isQuitting && config.get('closeToTray')) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Deep links open inside YakChat; external URLs open in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isDeepLinkUrl(url)) {
      handleDeepLink(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDirectWebWhatsAppUrl(url)) {
      return;
    }
    event.preventDefault();
    if (isDeepLinkUrl(url)) {
      handleDeepLink(url);
    } else {
      shell.openExternal(url);
    }
  });

  // Stop flashing on window focus
  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
  });
}

// Second instance focus & deep-link routing
app.on('second-instance', (_event, commandLine) => {
  focusMainWindow();
  const deepLink = extractDeepLinkFromArgv(commandLine);
  if (deepLink) {
    handleDeepLink(deepLink);
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    handleDeepLink(url);
  }
});

app.whenReady().then(async () => {
  const config = getConfig();

  // Set theme preference
  const savedTheme = config.get('theme') || 'system';
  nativeTheme.themeSource = savedTheme;

  // 3. User-Agent and Client Hints request headers configuration
  session.defaultSession.setUserAgent(customUserAgent);

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.whatsapp.com/*', 'https://*.whatsapp.net/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = customUserAgent;
      details.requestHeaders['sec-ch-ua-platform'] = '"Windows"';
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // 4. Permissions handler restricted strictly to official WhatsApp Web domains
  const allowedPermissions = [
    'media',
    'audioCapture',
    'videoCapture',
    'notifications',
    'clipboard-read',
    'clipboard-sanitized-write',
    'display-capture',
    'mediaKeySystem',
    'fullscreen',
    'pointerLock'
  ];

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const reqUrl = (details && details.requestingUrl) || (webContents && webContents.getURL()) || '';
    if (isWhatsAppPermissionOrigin(reqUrl) && allowedPermissions.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (isWhatsAppPermissionOrigin(requestingOrigin) && allowedPermissions.includes(permission)) {
      return true;
    }
    return false;
  });

  session.defaultSession.setDevicePermissionHandler((details) => {
    if (isWhatsAppPermissionOrigin(details.origin || '')) {
      return true;
    }
    return false;
  });

  // 5. Screen sharing handling via desktopCapturer & PipeWire
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        if (sources && sources.length > 0) {
          callback({ video: sources[0] });
        } else {
          callback({});
        }
      })
      .catch((err) => {
        console.error('[DisplayMedia] Error acquiring sources:', err);
        callback({});
      });
  });

  // 6. Spellchecker initialization & languages
  const isSpellcheckActive = config.get('spellcheck') !== false;
  try {
    session.defaultSession.setSpellCheckerEnabled(isSpellcheckActive);
    if (isSpellcheckActive) {
      const langs = config.get('spellcheckLanguages') || ['es-ES', 'es-419', 'es'];
      session.defaultSession.setSpellCheckerLanguages(langs);
    }
  } catch (e) {
    console.warn('[SpellChecker] Could not configure spellchecker:', e.message);
  }

  // Resolve startup deep link if provided on CLI / xdg-open
  let initialUrl = 'https://web.whatsapp.com';
  if (startupDeepLink) {
    try {
      const resolved = await resolveToWebWhatsAppUrl(startupDeepLink, customUserAgent);
      if (resolved) {
        initialUrl = resolved;
      }
    } catch (err) {
      console.warn('[DeepLink] Error resolving startup URL:', err.message);
    }
  }

  // Create main window
  createWindow(initialUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// IPC: Unread badge count
ipcMain.on('unread-count-changed', (event, count) => {
  updateTrayBadge(count);
  if (typeof app.setBadgeCount === 'function') {
    app.setBadgeCount(count);
  }
});

// IPC: Incoming call alert
ipcMain.on('incoming-call-alert', (event, { caller, isVideo }) => {
  const config = getConfig();
  if (!config.get('callAlerts')) return;

  if (mainWindow) {
    mainWindow.flashFrame(true);
  }

  const callType = isVideo ? 'Videollamada' : 'Llamada de voz';
  const iconPath = path.join(__dirname, '..', 'assets', 'icon-128.png');

  if (Notification.isSupported() && config.get('notifications')) {
    const notif = new Notification({
      title: `📞 ${callType} entrante`,
      body: `${caller} te está llamando`,
      icon: iconPath,
      urgency: 'critical',
      hasReply: false
    });

    notif.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notif.show();
  }
});

// IPC: Theme change
ipcMain.on('set-theme', (event, theme) => {
  const config = getConfig();
  config.set('theme', theme);
  nativeTheme.themeSource = theme;
});

// IPC: Notification clicked
ipcMain.on('notification-clicked', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Native KDE Plasma notification helper (org.freedesktop.Notifications)
function showPlasmaNotification({ id, title, body, iconDataUrl, urgency = 'normal' }) {
  const config = getConfig();
  if (!config.get('notifications') || !Notification.isSupported()) return;

  const fallbackIconPath = path.join(__dirname, '..', 'assets', 'icon-128.png');
  let notifIcon = fallbackIconPath;

  if (iconDataUrl && typeof iconDataUrl === 'string' && iconDataUrl.startsWith('data:image/')) {
    try {
      const img = nativeImage.createFromDataURL(iconDataUrl);
      if (!img.isEmpty()) {
        notifIcon = img;
      }
    } catch (_) {}
  }

  const notif = new Notification({
    title: title || 'YakChat',
    body: body || 'Nuevo mensaje recibido',
    icon: notifIcon,
    urgency
  });

  notif.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (id) {
        mainWindow.webContents.send('whatsapp-notification-clicked', id);
      }
    }
  });

  notif.show();

  if (mainWindow && (!mainWindow.isFocused() || !mainWindow.isVisible())) {
    mainWindow.flashFrame(true);
  }
}

// IPC: Incoming message notification from WhatsApp Web
ipcMain.on('whatsapp-message-notification', (_event, payload) => {
  if (!payload) return;
  showPlasmaNotification({
    id: payload.id,
    title: payload.title,
    body: payload.body,
    iconDataUrl: payload.iconDataUrl,
    urgency: 'normal'
  });
});

// ============================================================================
// Tradutor Rápido (ES • PT-BR • EN) - Main Process Translation Engine
// ============================================================================
const translationCache = new Map();

async function translateWithGoogle(text, sl, tl) {
  const cleanSl = sl === 'auto' ? 'auto' : sl;
  const cleanTl = tl;
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(cleanSl)}&tl=${encodeURIComponent(cleanTl)}&q=${encodeURIComponent(text)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': customUserAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Google Translate HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data.map((item) => (Array.isArray(item) ? item[0] : item)).join('');
  } else if (typeof data === 'string') {
    return data;
  }
  throw new Error('Unexpected Google Translate response');
}

async function translateWithFallback(text, sl, tl) {
  const source = sl === 'auto' ? 'es' : (sl === 'pt' ? 'pt-BR' : (sl === 'en' ? 'en-US' : sl));
  const target = tl === 'pt' ? 'pt-BR' : (tl === 'en' ? 'en-US' : tl);
  const pair = `${source}|${target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;

  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Fallback HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data && data.responseData && data.responseData.translatedText) {
    return data.responseData.translatedText;
  }
  throw new Error('Fallback translation failed');
}

async function performTranslation(text, sourceLang, targetLang) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  const cacheKey = `${sourceLang}|${targetLang}|${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  let translated = '';
  try {
    translated = await translateWithGoogle(trimmed, sourceLang, targetLang);
  } catch (primaryErr) {
    console.warn('[Tradutor Rápido] Primary engine failed, trying fallback:', primaryErr.message);
    translated = await translateWithFallback(trimmed, sourceLang, targetLang);
  }

  const leadingSpace = (text.match(/^\s*/) || [''])[0];
  const trailingSpace = (text.match(/\s*$/) || [''])[0];
  const result = leadingSpace + translated + trailingSpace;

  if (translationCache.size > 300) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, result);

  return result;
}

ipcMain.handle('tradutor-translate', async (_event, { text, from, to }) => {
  try {
    const translation = await performTranslation(text, from || 'es', to || 'pt');
    return { success: true, translation };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('tradutor-get-settings', () => {
  const config = getConfig();
  return {
    translatorEnabled: config.get('translatorEnabled'),
    sourceLang: config.get('sourceLang'),
    targetLang: config.get('targetLang'),
    showFloatingButton: config.get('showFloatingButton'),
    readingTooltip: config.get('readingTooltip'),
    readingTargetLang: config.get('readingTargetLang')
  };
});

ipcMain.on('tradutor-save-settings', (_event, patch) => {
  if (!patch || typeof patch !== 'object') return;
  const config = getConfig();
  config.setMultiple(patch);
  if (mainWindow) {
    createApplicationMenu(mainWindow);
  }
});

// ============================================================================
// Ortografía, Corrector Nativo y Autocorrector de Texto en Español
// ============================================================================
function setSpellCheckerPreset(langs, presetName) {
  const config = getConfig();
  config.setMultiple({
    spellcheckLanguages: langs,
    spellcheckPreset: presetName,
    spellcheck: true
  });
  try {
    session.defaultSession.setSpellCheckerEnabled(true);
    session.defaultSession.setSpellCheckerLanguages(langs);
  } catch (err) {
    console.warn('[SpellChecker] Error configurando idiomas:', err.message);
  }
  if (mainWindow) {
    createApplicationMenu(mainWindow);
  }
}

function setupContextMenu(win) {
  win.webContents.on('context-menu', (_event, params) => {
    const config = getConfig();
    const menu = new Menu();

    // 1. Sugerencias ortográficas del diccionario de Chromium / Hunspell
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(
          new MenuItem({
            label: suggestion,
            click: () => win.webContents.replaceMisspelling(suggestion)
          })
        );
      }
      menu.append(new MenuItem({ type: 'separator' }));
    } else if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: '(Sin sugerencias ortográficas)',
          enabled: false
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // Opción para añadir la palabra detectada al diccionario personal
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: `Añadir "${params.misspelledWord}" al diccionario`,
          click: () => {
            session.defaultSession.addWordToSpellCheckerDictionary(params.misspelledWord);
          }
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // 2. Acciones sobre texto seleccionado
    const hasSelection = Boolean(params.selectionText && params.selectionText.trim().length > 0);
    if (hasSelection) {
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy', accelerator: 'CmdOrCtrl+C' }));
      if (config.get('translatorEnabled') !== false) {
        menu.append(
          new MenuItem({
            label: 'Traducir selección con Tradutor Rápido 🌐',
            click: () => {
              win.webContents.send('tradutor-translate-selection', params.selectionText);
            }
          })
        );
      }
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // 3. Acciones de edición en campos de texto (contenteditable, input, textarea)
    if (params.isEditable) {
      if (!hasSelection) {
        menu.append(new MenuItem({ label: 'Deshacer', role: 'undo' }));
        menu.append(new MenuItem({ label: 'Rehacer', role: 'redo' }));
        menu.append(new MenuItem({ type: 'separator' }));
      }
      menu.append(new MenuItem({ label: 'Cortar', role: 'cut', enabled: hasSelection }));
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy', enabled: hasSelection }));
      menu.append(new MenuItem({ label: 'Pegar', role: 'paste' }));
      menu.append(new MenuItem({ label: 'Pegar con el mismo estilo', role: 'pasteAndMatchStyle' }));
      menu.append(new MenuItem({ label: 'Seleccionar todo', role: 'selectAll' }));
      menu.append(new MenuItem({ type: 'separator' }));

      // Submenú completo de Ortografía y Autocorrector en el clic derecho
      const currentPreset = config.get('spellcheckPreset') || 'es-ES';
      menu.append(
        new MenuItem({
          label: 'Ortografía y Autocorrector ✍️',
          submenu: [
            {
              label: 'Revisar ortografía mientras se escribe',
              type: 'checkbox',
              checked: config.get('spellcheck') !== false,
              click: (item) => {
                config.set('spellcheck', item.checked);
                try {
                  session.defaultSession.setSpellCheckerEnabled(item.checked);
                } catch (_) {}
                createApplicationMenu(win);
              }
            },
            {
              label: 'Autocorrector al escribir (Español)',
              type: 'checkbox',
              checked: config.get('autocorrectEnabled') !== false,
              click: (item) => {
                const nextVal = item.checked;
                config.set('autocorrectEnabled', nextVal);
                win.webContents.send('autocorrect-settings-updated', {
                  autocorrectEnabled: nextVal
                });
                createApplicationMenu(win);
              }
            },
            { type: 'separator' },
            {
              label: 'Idioma del corrector ortográfico',
              submenu: [
                {
                  label: '🇪🇸 Español (España)',
                  type: 'radio',
                  checked: currentPreset === 'es-ES',
                  click: () => setSpellCheckerPreset(['es-ES', 'es'], 'es-ES')
                },
                {
                  label: '🌎 Español (Latinoamérica)',
                  type: 'radio',
                  checked: currentPreset === 'es-419',
                  click: () => setSpellCheckerPreset(['es-419', 'es'], 'es-419')
                },
                {
                  label: '🇲🇽 Español (México)',
                  type: 'radio',
                  checked: currentPreset === 'es-MX',
                  click: () => setSpellCheckerPreset(['es-MX', 'es-419', 'es'], 'es-MX')
                },
                {
                  label: '🇦🇷 Español (Argentina)',
                  type: 'radio',
                  checked: currentPreset === 'es-AR',
                  click: () => setSpellCheckerPreset(['es-AR', 'es-419', 'es'], 'es-AR')
                },
                {
                  label: '🌐 Multilingüe (Español + Portugués + Inglés)',
                  type: 'radio',
                  checked: currentPreset === 'multi',
                  click: () => setSpellCheckerPreset(['es-ES', 'es-419', 'pt-BR', 'en-US'], 'multi')
                },
                {
                  label: '🇺🇸 Inglés (EE. UU.)',
                  type: 'radio',
                  checked: currentPreset === 'en-US',
                  click: () => setSpellCheckerPreset(['en-US'], 'en-US')
                },
                {
                  label: '🇧🇷 Portugués (Brasil)',
                  type: 'radio',
                  checked: currentPreset === 'pt-BR',
                  click: () => setSpellCheckerPreset(['pt-BR'], 'pt-BR')
                }
              ]
            }
          ]
        })
      );
    }

    // 4. Enlaces (deep-links en YakChat vs enlaces externos en navegador)
    if (params.linkURL) {
      menu.append(new MenuItem({ type: 'separator' }));
      if (isDeepLinkUrl(params.linkURL)) {
        menu.append(
          new MenuItem({
            label: 'Abrir enlace en YakChat',
            click: () => handleDeepLink(params.linkURL)
          })
        );
      } else {
        menu.append(
          new MenuItem({
            label: 'Abrir enlace en el navegador',
            click: () => shell.openExternal(params.linkURL)
          })
        );
      }
      menu.append(
        new MenuItem({
          label: 'Copiar dirección del enlace',
          click: () => clipboard.writeText(params.linkURL)
        })
      );
    }

    // 5. Imágenes
    if (params.hasImageContents && params.srcURL) {
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(
        new MenuItem({
          label: 'Copiar imagen',
          click: () => win.webContents.copyImageAt(params.x, params.y)
        })
      );
    }

    if (menu.items.length > 0) {
      menu.popup({ window: win });
    }
  });
}

// IPC: Autocorrector de texto al escribir
ipcMain.handle('autocorrect-get-settings', () => {
  const config = getConfig();
  return {
    autocorrectEnabled: config.get('autocorrectEnabled') !== false,
    autocorrectNotification: config.get('autocorrectNotification') === true
  };
});

ipcMain.on('autocorrect-toggle', () => {
  const config = getConfig();
  const nextVal = !(config.get('autocorrectEnabled') !== false);
  config.set('autocorrectEnabled', nextVal);
  if (mainWindow) {
    mainWindow.webContents.send('autocorrect-settings-updated', {
      autocorrectEnabled: nextVal
    });
    createApplicationMenu(mainWindow);
  }
});

ipcMain.on('autocorrect-save-settings', (_event, patch) => {
  if (!patch || typeof patch !== 'object') return;
  const config = getConfig();
  config.setMultiple(patch);
  if (mainWindow) {
    mainWindow.webContents.send('autocorrect-settings-updated', patch);
    createApplicationMenu(mainWindow);
  }
});

// IPC: Corrector ortográfico
ipcMain.on('spellcheck-toggle', () => {
  const config = getConfig();
  const nextVal = !(config.get('spellcheck') !== false);
  config.set('spellcheck', nextVal);
  try {
    session.defaultSession.setSpellCheckerEnabled(nextVal);
  } catch (_) {}
  if (mainWindow) {
    createApplicationMenu(mainWindow);
  }
});

ipcMain.on('spellcheck-set-preset', (_event, { langs, preset }) => {
  setSpellCheckerPreset(langs, preset);
});

// ============================================================================
// Diálogo "Abrir enlace o teléfono" (Ctrl+L)
// ============================================================================
function openLinkDialog() {
  if (openLinkWin && !openLinkWin.isDestroyed()) {
    openLinkWin.focus();
    return;
  }

  openLinkWin = new BrowserWindow({
    width: 520,
    height: 235,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111b21',
    title: 'Abrir enlace o teléfono — YakChat',
    webPreferences: {
      preload: path.join(__dirname, 'open-link-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  openLinkWin.setMenuBarVisibility(false);
  openLinkWin.loadFile(path.join(__dirname, 'open-link.html'));

  openLinkWin.once('ready-to-show', () => {
    if (openLinkWin && !openLinkWin.isDestroyed()) {
      openLinkWin.show();
    }
  });

  openLinkWin.on('closed', () => {
    openLinkWin = null;
  });
}

app.on('yakchat-open-link-dialog', openLinkDialog);

ipcMain.handle('open-link-get-initial', () => {
  const clip = (clipboard.readText() || '').trim();
  return normalizeUserInputToUrl(clip) ? clip : '';
});

ipcMain.handle('open-link-submit', async (_event, rawValue) => {
  const normalized = normalizeUserInputToUrl(rawValue);
  if (!normalized) {
    return {
      ok: false,
      error: 'Introduce una URL válida (api.whatsapp.com, wa.me, chat.whatsapp.com, whatsapp://) o un teléfono con código de país.'
    };
  }

  try {
    const resolved = await resolveToWebWhatsAppUrl(normalized, customUserAgent);
    if (!resolved) {
      return {
        ok: false,
        error: 'No se pudo resolver el enlace a una conversación válida.'
      };
    }

    if (openLinkWin && !openLinkWin.isDestroyed()) {
      openLinkWin.close();
    }
    focusMainWindow();
    if (mainWindow) {
      mainWindow.loadURL(resolved, { userAgent: customUserAgent });
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Error al resolver el enlace: ${err.message}`
    };
  }
});

ipcMain.on('open-link-cancel', () => {
  if (openLinkWin && !openLinkWin.isDestroyed()) {
    openLinkWin.close();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  destroyTray();
});

app.on('window-all-closed', () => {
  const config = getConfig();
  if (process.platform !== 'darwin' && !config.get('closeToTray')) {
    app.quit();
  }
});

