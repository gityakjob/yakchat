const { Menu, app, shell, dialog, nativeTheme, Notification, session } = require('electron');
const path = require('path');
const { getConfig } = require('./config');
const { version: APP_VERSION } = require('../package.json');

function createApplicationMenu(mainWindow) {
  const config = getConfig();

  function applySpellLanguage(langs, preset) {
    config.setMultiple({
      spellcheckLanguages: langs,
      spellcheckPreset: preset,
      spellcheck: true
    });
    try {
      session.defaultSession.setSpellCheckerEnabled(true);
      session.defaultSession.setSpellCheckerLanguages(langs);
    } catch (e) {
      console.warn('[Menu] Error setting spellchecker languages:', e.message);
    }
    createApplicationMenu(mainWindow);
  }

  const currentSpellPreset = config.get('spellcheckPreset') || 'es-ES';

  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo chat',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                const searchOrNew = document.querySelector('[data-testid="chat-list-search"]') || document.querySelector('[contenteditable="true"]');
                if (searchOrNew) searchOrNew.focus();
              `);
            }
          }
        },
        {
          label: 'Abrir enlace o teléfono...',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            app.emit('yakchat-open-link-dialog');
          }
        },
        {
          label: 'Silenciar notificaciones',
          type: 'checkbox',
          checked: !config.get('notifications'),
          click: (item) => {
            config.set('notifications', !item.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Cerrar a la bandeja',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        {
          label: 'Salir de YakChat',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'pasteAndMatchStyle', label: 'Pegar con el mismo estilo' },
        { role: 'delete', label: 'Eliminar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
        { type: 'separator' },
        {
          label: 'Autocorrector en español',
          type: 'checkbox',
          accelerator: 'Alt+O',
          checked: config.get('autocorrectEnabled') !== false,
          click: (item) => {
            config.set('autocorrectEnabled', item.checked);
            if (mainWindow) {
              mainWindow.webContents.send('autocorrect-settings-updated', {
                autocorrectEnabled: item.checked
              });
            }
            createApplicationMenu(mainWindow);
          }
        }
      ]
    },
    {
      label: 'Ortografía ✍️',
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
            createApplicationMenu(mainWindow);
          }
        },
        {
          label: 'Autocorrector de texto al escribir (Español)',
          type: 'checkbox',
          accelerator: 'Alt+O',
          checked: config.get('autocorrectEnabled') !== false,
          click: (item) => {
            const nextVal = item.checked;
            config.set('autocorrectEnabled', nextVal);
            if (mainWindow) {
              mainWindow.webContents.send('autocorrect-settings-updated', {
                autocorrectEnabled: nextVal
              });
            }
            createApplicationMenu(mainWindow);
          }
        },
        {
          label: 'Notificación visual al autocorregir',
          type: 'checkbox',
          checked: config.get('autocorrectNotification') === true,
          click: (item) => {
            config.set('autocorrectNotification', item.checked);
            if (mainWindow) {
              mainWindow.webContents.send('autocorrect-settings-updated', {
                autocorrectNotification: item.checked
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Idioma del corrector ortográfico',
          submenu: [
            {
              label: '🇪🇸 Español (España)',
              type: 'radio',
              checked: currentSpellPreset === 'es-ES',
              click: () => applySpellLanguage(['es-ES', 'es'], 'es-ES')
            },
            {
              label: '🌎 Español (Latinoamérica)',
              type: 'radio',
              checked: currentSpellPreset === 'es-419',
              click: () => applySpellLanguage(['es-419', 'es'], 'es-419')
            },
            {
              label: '🇲🇽 Español (México)',
              type: 'radio',
              checked: currentSpellPreset === 'es-MX',
              click: () => applySpellLanguage(['es-MX', 'es-419', 'es'], 'es-MX')
            },
            {
              label: '🇦🇷 Español (Argentina)',
              type: 'radio',
              checked: currentSpellPreset === 'es-AR',
              click: () => applySpellLanguage(['es-AR', 'es-419', 'es'], 'es-AR')
            },
            {
              label: '🌐 Multilingüe (Español + Portugués + Inglés)',
              type: 'radio',
              checked: currentSpellPreset === 'multi',
              click: () => applySpellLanguage(['es-ES', 'es-419', 'pt-BR', 'en-US'], 'multi')
            },
            {
              label: '🇺🇸 Inglés (EE. UU.)',
              type: 'radio',
              checked: currentSpellPreset === 'en-US',
              click: () => applySpellLanguage(['en-US'], 'en-US')
            },
            {
              label: '🇧🇷 Portugués (Brasil)',
              type: 'radio',
              checked: currentSpellPreset === 'pt-BR',
              click: () => applySpellLanguage(['pt-BR'], 'pt-BR')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Probar autocorrección en vivo...',
          accelerator: 'Alt+Shift+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('autocorrect-test-live');
            }
          }
        },
        {
          label: 'Ver palabras en el diccionario personal...',
          click: async () => {
            try {
              const words = await session.defaultSession.listWordsInSpellCheckerDictionary();
              const wordsText = words.length > 0
                ? words.map(w => `• ${w}`).join('\n')
                : '(El diccionario personal está vacío)';
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Diccionario Personal',
                message: `Palabras aprendidas (${words.length}):`,
                detail: wordsText,
                buttons: ['Aceptar']
              });
            } catch (err) {
              dialog.showErrorBox('Error', 'No se pudieron consultar las palabras del diccionario: ' + err.message);
            }
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: 'Forzar recarga',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
          }
        },
        {
          label: 'Herramientas de desarrollador',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        {
          label: 'Aumentar zoom',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const current = mainWindow.webContents.getZoomFactor();
              const next = Math.min(current + 0.1, 2.0);
              mainWindow.webContents.setZoomFactor(next);
              config.set('zoomFactor', next);
            }
          }
        },
        {
          label: 'Reducir zoom',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const current = mainWindow.webContents.getZoomFactor();
              const next = Math.max(current - 0.1, 0.6);
              mainWindow.webContents.setZoomFactor(next);
              config.set('zoomFactor', next);
            }
          }
        },
        {
          label: 'Restablecer zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomFactor(1.0);
              config.set('zoomFactor', 1.0);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Tema',
          submenu: [
            {
              label: 'Seguir el sistema',
              type: 'radio',
              checked: config.get('theme') === 'system',
              click: () => {
                config.set('theme', 'system');
                nativeTheme.themeSource = 'system';
              }
            },
            {
              label: 'Modo oscuro',
              type: 'radio',
              checked: config.get('theme') === 'dark',
              click: () => {
                config.set('theme', 'dark');
                nativeTheme.themeSource = 'dark';
              }
            },
            {
              label: 'Modo claro',
              type: 'radio',
              checked: config.get('theme') === 'light',
              click: () => {
                config.set('theme', 'light');
                nativeTheme.themeSource = 'light';
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Llamadas y Audio',
      submenu: [
        {
          label: 'Activar alertas de llamadas entrantes',
          type: 'checkbox',
          checked: config.get('callAlerts'),
          click: (item) => {
            config.set('callAlerts', item.checked);
          }
        },
        {
          label: 'Probar dispositivos de audio/video...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                navigator.mediaDevices.enumerateDevices().then(devices => {
                  console.log('[MediaDevices]', devices);
                  alert('Dispositivos detectados:\\n' + devices.map(d => '- ' + d.kind + ': ' + (d.label || '(dispositivo sin etiqueta)')).join('\\n'));
                }).catch(e => alert('Error obteniendo dispositivos: ' + e));
              `);
            }
          }
        },
        {
          label: 'Probar notificación de KDE Plasma',
          click: () => {
            if (Notification.isSupported()) {
              const notif = new Notification({
                title: 'YakChat',
                body: '✅ El sistema de notificaciones nativo de KDE Plasma está activo y funcionando.',
                icon: path.join(__dirname, '..', 'assets', 'icon-128.png'),
                urgency: 'normal'
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
          }
        }
      ]
    },
    {
      label: 'Traductor 🌐',
      submenu: [
        {
          label: 'Activar Tradutor Rápido (ES • PT-BR • EN)',
          type: 'checkbox',
          checked: config.get('translatorEnabled') !== false,
          click: (item) => {
            config.set('translatorEnabled', item.checked);
            if (mainWindow) {
              mainWindow.webContents.send('tradutor-settings-updated', { translatorEnabled: item.checked });
            }
          }
        },
        {
          label: 'Mostrar botón flotante en el chat',
          type: 'checkbox',
          checked: config.get('showFloatingButton') !== false,
          click: (item) => {
            config.set('showFloatingButton', item.checked);
            if (mainWindow) {
              mainWindow.webContents.send('tradutor-settings-updated', { showFloatingButton: item.checked });
            }
          }
        },
        {
          label: 'Modo lectura al seleccionar texto',
          type: 'checkbox',
          checked: config.get('readingTooltip') !== false,
          click: (item) => {
            config.set('readingTooltip', item.checked);
            if (mainWindow) {
              mainWindow.webContents.send('tradutor-settings-updated', { readingTooltip: item.checked });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Dirección al escribir',
          submenu: [
            {
              label: '🇪🇸 Español ➔ 🇧🇷 Portugués (BR)',
              type: 'radio',
              checked: `${config.get('sourceLang')}|${config.get('targetLang')}` === 'es|pt',
              click: () => {
                config.setMultiple({ sourceLang: 'es', targetLang: 'pt' });
                if (mainWindow) {
                  mainWindow.webContents.send('tradutor-settings-updated', { sourceLang: 'es', targetLang: 'pt' });
                }
              }
            },
            {
              label: '🇪🇸 Español ➔ 🇺🇸 Inglés (EE. UU.)',
              type: 'radio',
              checked: `${config.get('sourceLang')}|${config.get('targetLang')}` === 'es|en',
              click: () => {
                config.setMultiple({ sourceLang: 'es', targetLang: 'en' });
                if (mainWindow) {
                  mainWindow.webContents.send('tradutor-settings-updated', { sourceLang: 'es', targetLang: 'en' });
                }
              }
            },
            {
              label: '🇧🇷 Portugués (BR) ➔ 🇪🇸 Español',
              type: 'radio',
              checked: `${config.get('sourceLang')}|${config.get('targetLang')}` === 'pt|es',
              click: () => {
                config.setMultiple({ sourceLang: 'pt', targetLang: 'es' });
                if (mainWindow) {
                  mainWindow.webContents.send('tradutor-settings-updated', { sourceLang: 'pt', targetLang: 'es' });
                }
              }
            },
            {
              label: '🇺🇸 Inglés (EE. UU.) ➔ 🇪🇸 Español',
              type: 'radio',
              checked: `${config.get('sourceLang')}|${config.get('targetLang')}` === 'en|es',
              click: () => {
                config.setMultiple({ sourceLang: 'en', targetLang: 'es' });
                if (mainWindow) {
                  mainWindow.webContents.send('tradutor-settings-updated', { sourceLang: 'en', targetLang: 'es' });
                }
              }
            },
            {
              label: '🇧🇷 Portugués (BR) ➔ 🇺🇸 Inglés (EE. UU.)',
              type: 'radio',
              checked: `${config.get('sourceLang')}|${config.get('targetLang')}` === 'pt|en',
              click: () => {
                config.setMultiple({ sourceLang: 'pt', targetLang: 'en' });
                if (mainWindow) {
                  mainWindow.webContents.send('tradutor-settings-updated', { sourceLang: 'pt', targetLang: 'en' });
                }
              }
            },
            {
              label: '🇺🇸 Inglés (EE. UU.) ➔ 🇧🇷 Portugués (BR)',
              type: 'radio',
              checked: `${config.get('sourceLang')}|${config.get('targetLang')}` === 'en|pt',
              click: () => {
                config.setMultiple({ sourceLang: 'en', targetLang: 'pt' });
                if (mainWindow) {
                  mainWindow.webContents.send('tradutor-settings-updated', { sourceLang: 'en', targetLang: 'pt' });
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Traducir mensaje actual',
          accelerator: 'Alt+T',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('tradutor-shortcut-translate');
            }
          }
        },
        {
          label: 'Configuración y prueba en vivo...',
          accelerator: 'Alt+Shift+T',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('tradutor-open-popup');
            }
          }
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de YakChat',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de YakChat',
              message: 'YakChat (Cliente Independiente para Linux)',
              detail: `Versión ${APP_VERSION}\nElectron: ${process.versions.electron}\nChromium: ${process.versions.chrome}\nNode.js: ${process.versions.node}\n\nCliente comunitario independiente y de código abierto para usar WhatsApp Web en CachyOS / Arch Linux. No afiliado ni respaldado por WhatsApp LLC ni Meta Platforms, Inc.`,
              buttons: ['Aceptar']
            });
          }
        },
        {
          label: 'Documentación de llamadas en la Web',
          click: () => {
            shell.openExternal('https://faq.whatsapp.com');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  createApplicationMenu
};
