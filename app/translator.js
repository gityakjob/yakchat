// Tradutor Rápido para Inputs (ES • PT-BR • EN) - Native Electron Integration
// Preserves message structure (line breaks, lists, paragraphs), draggable reading card,
// floating input pill, Alt+T shortcut, and built-in settings & live playground modal.

const { ipcRenderer } = require('electron');

function initTradutorRapido() {
  if (window.__tradutorRapidoLoaded) return;
  window.__tradutorRapidoLoaded = true;

  let settings = {
    translatorEnabled: true,
    sourceLang: 'es',
    targetLang: 'pt',
    showFloatingButton: true,
    readingTooltip: true,
    readingTargetLang: 'es'
  };

  let currentInputElement = null;
  let isTranslating = false;
  let hideTimeout = null;
  let isReadingCardClosed = false;
  let currentSelectedText = '';

  // Create isolated container with Shadow DOM
  const hostElement = document.createElement('div');
  hostElement.id = 'tradutor-rapido-root';
  hostElement.style.cssText = 'all: initial; position: absolute; z-index: 2147483647; top: 0; left: 0;';
  document.documentElement.appendChild(hostElement);
  const shadow = hostElement.attachShadow({ mode: 'open' });

  // Styles (Floating Pill + Reading Card + Settings Popup Modal)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif;
      user-select: none;
    }

    /* Floating Action Pill */
    .tr-floating-btn {
      position: fixed;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 20px;
      background: rgba(18, 24, 38, 0.94);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05);
      cursor: pointer;
      transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
      z-index: 2147483647;
      opacity: 0;
      transform: translateY(4px) scale(0.96);
      pointer-events: auto;
    }

    .tr-floating-btn.visible {
      display: flex;
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .tr-floating-btn:hover {
      background: rgba(28, 36, 56, 0.98);
      border-color: rgba(59, 130, 246, 0.55);
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.42), 0 0 14px rgba(59, 130, 246, 0.35);
    }

    .tr-icon {
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tr-lang-pair {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #f1f5f9;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 6px;
      transition: background 0.15s;
    }

    .tr-lang-pair:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .tr-lang-pill {
      background: rgba(255, 255, 255, 0.14);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #60a5fa;
      transition: background 0.15s, color 0.15s;
    }

    .tr-lang-pill.target {
      color: #4ade80;
    }

    .tr-lang-pill:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .tr-swap-btn, .tr-cfg-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: background 0.15s, transform 0.2s;
      font-size: 11px;
    }

    .tr-swap-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: rotate(180deg);
    }

    .tr-cfg-btn:hover {
      background: rgba(59, 130, 246, 0.45);
      transform: scale(1.1);
    }

    .tr-shortcut-hint {
      font-size: 10px;
      opacity: 0.65;
      background: rgba(255, 255, 255, 0.08);
      padding: 1px 5px;
      border-radius: 4px;
    }

    /* Quick Language Menu Popover */
    .tr-lang-menu {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      background: rgba(15, 23, 42, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 6px;
      display: none;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      backdrop-filter: blur(12px);
      min-width: 170px;
      z-index: 2147483647;
    }

    .tr-lang-menu.open {
      display: flex;
    }

    .tr-menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      border-radius: 6px;
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .tr-menu-item:hover {
      background: #2563eb;
      color: #ffffff;
    }

    .tr-menu-item.active {
      background: rgba(59, 130, 246, 0.3);
      color: #60a5fa;
    }

    /* Spinner */
    .tr-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.25);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: tr-spin 0.6s linear infinite;
      display: none;
    }

    .tr-floating-btn.loading .tr-spinner {
      display: inline-block;
    }

    .tr-floating-btn.loading .tr-icon {
      display: none;
    }

    @keyframes tr-spin {
      to { transform: rotate(360deg); }
    }

    .tr-floating-btn.success {
      border-color: rgba(74, 222, 128, 0.7);
      box-shadow: 0 0 16px rgba(74, 222, 128, 0.4);
    }

    @keyframes tr-shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-4px); }
      40%, 80% { transform: translateX(4px); }
    }

    .tr-floating-btn.error {
      border-color: rgba(248, 113, 113, 0.7);
      animation: tr-shake 0.4s ease;
    }

    /* Draggable Reading Card */
    .tr-reading-card {
      position: fixed;
      display: none;
      flex-direction: column;
      width: 360px;
      max-width: calc(100vw - 24px);
      max-height: calc(100vh - 30px);
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(18, 24, 38, 0.98);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
      z-index: 2147483647;
      opacity: 0;
      transform: scale(0.97);
      transition: opacity 0.16s ease, transform 0.16s ease;
      font-size: 13px;
      pointer-events: auto;
    }

    .tr-reading-card.visible {
      display: flex;
      opacity: 1;
      transform: scale(1);
    }

    .tr-reading-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 6px;
      cursor: grab;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .tr-reading-header:active {
      cursor: grabbing;
    }

    .tr-drag-handle {
      font-size: 10px;
      color: #64748b;
      margin-right: 2px;
    }

    .tr-reading-target-picker {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .tr-reading-lang-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .tr-reading-lang-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .tr-reading-lang-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
      color: #ffffff;
    }

    .tr-close-btn {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, transform 0.15s;
      flex-shrink: 0;
    }

    .tr-close-btn:hover {
      background: rgba(239, 68, 68, 0.85);
      color: #ffffff;
      transform: scale(1.1);
    }

    .tr-reading-content {
      color: #f8fafc;
      line-height: 1.55;
      margin-bottom: 10px;
      user-select: text;
      font-weight: 400;
      overflow-y: auto;
      max-height: 220px;
      padding-right: 6px;
      white-space: pre-wrap;
      word-break: break-word;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.25) transparent;
    }

    .tr-reading-content::-webkit-scrollbar {
      width: 5px;
    }

    .tr-reading-content::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.25);
      border-radius: 4px;
    }

    .tr-reading-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .tr-reading-source-hint {
      font-size: 11px;
      color: #94a3b8;
    }

    .tr-copy-btn {
      background: rgba(255, 255, 255, 0.12);
      border: none;
      color: #e2e8f0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.15s, transform 0.1s;
    }

    .tr-copy-btn:hover {
      background: #2563eb;
      color: #fff;
      transform: translateY(-1px);
    }

    /* Settings & Live Playground Modal */
    .tr-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      pointer-events: auto;
    }

    .tr-modal-backdrop.open {
      display: flex;
    }

    .tr-popup-card {
      width: 390px;
      max-width: calc(100vw - 24px);
      background: #0f172a;
      color: #f8fafc;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .tr-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 10px;
    }

    .tr-popup-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tr-popup-logo-icon {
      font-size: 22px;
      background: rgba(59, 130, 246, 0.18);
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tr-popup-title {
      font-size: 15px;
      font-weight: 700;
      margin: 0;
      color: #fff;
    }

    .tr-popup-sub {
      font-size: 11px;
      color: #94a3b8;
      margin: 2px 0 0 0;
    }

    .tr-section-card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tr-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
    }

    .tr-lang-selector-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tr-select {
      flex: 1;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      padding: 7px 8px;
      font-size: 12px;
      font-weight: 600;
      outline: none;
      cursor: pointer;
    }

    .tr-select:focus {
      border-color: #3b82f6;
    }

    .tr-swap-large {
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #60a5fa;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .tr-swap-large:hover {
      background: #2563eb;
      color: #fff;
    }

    .tr-preset-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 2px;
    }

    .tr-preset-btn {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      border-radius: 7px;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .tr-preset-btn:hover {
      background: rgba(59, 130, 246, 0.25);
      color: #fff;
    }

    .tr-preset-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
      color: #fff;
    }

    .tr-playground-textarea {
      width: 100%;
      min-height: 68px;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      resize: vertical;
      outline: none;
      user-select: text;
    }

    .tr-playground-textarea:focus {
      border-color: #3b82f6;
    }

    .tr-primary-btn {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .tr-primary-btn:hover {
      opacity: 0.92;
    }

    .tr-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
    }

    .tr-toggle-label {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      display: block;
    }

    .tr-toggle-desc {
      font-size: 10px;
      color: #94a3b8;
      margin: 2px 0 0 0;
    }

    .tr-checkbox {
      width: 18px;
      height: 18px;
      accent-color: #2563eb;
      cursor: pointer;
    }

    .tr-popup-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      padding-top: 4px;
    }

    .tr-save-status {
      color: #4ade80;
      font-weight: 600;
    }
  `;
  shadow.appendChild(styleEl);

  // 1. Floating Button Element
  const floatingBtn = document.createElement('div');
  floatingBtn.className = 'tr-floating-btn';
  floatingBtn.setAttribute('tabindex', '-1');
  floatingBtn.innerHTML = `
    <span class="tr-icon" title="Traducir mensaje (Alt+T)">🌐</span>
    <span class="tr-spinner"></span>
    <div class="tr-lang-pair" id="tr-lang-pair" title="Clic para cambiar pares rápidos">
      <span class="tr-lang-pill source" id="tr-source-label">ES</span>
      <span>➔</span>
      <span class="tr-lang-pill target" id="tr-target-label">PT</span>
    </div>
    <div class="tr-swap-btn" id="tr-swap-btn" title="Invertir idiomas">⇄</div>
    <div class="tr-cfg-btn" id="tr-cfg-btn" title="Configuración de Tradutor Rápido (Alt+Shift+T)">⚙️</div>
    <span class="tr-shortcut-hint" title="Presiona Alt+T para traducir">Alt+T</span>

    <div class="tr-lang-menu" id="tr-lang-menu">
      <div class="tr-menu-item" data-pair="es|pt"><span>🇪🇸 Español ➔ 🇧🇷 Portugués</span></div>
      <div class="tr-menu-item" data-pair="es|en"><span>🇪🇸 Español ➔ 🇺🇸 Inglés</span></div>
      <div class="tr-menu-item" data-pair="pt|es"><span>🇧🇷 Portugués ➔ 🇪🇸 Español</span></div>
      <div class="tr-menu-item" data-pair="en|es"><span>🇺🇸 Inglés ➔ 🇪🇸 Español</span></div>
      <div class="tr-menu-item" data-pair="pt|en"><span>🇧🇷 Portugués ➔ 🇺🇸 Inglés</span></div>
      <div class="tr-menu-item" data-pair="en|pt"><span>🇺🇸 Inglés ➔ 🇧🇷 Portugués</span></div>
    </div>
  `;
  shadow.appendChild(floatingBtn);

  // 2. Draggable Reading Card Element
  const readingCard = document.createElement('div');
  readingCard.className = 'tr-reading-card';
  readingCard.innerHTML = `
    <div class="tr-reading-header" id="tr-reading-header">
      <div class="tr-reading-target-picker">
        <span class="tr-drag-handle" title="Arrastrar ventana">⋮⋮</span>
        <span style="font-size:11px; color:#94a3b8; font-weight:600;">TRADUCIR A:</span>
        <button class="tr-reading-lang-btn active" data-lang="es">🇪🇸 ES</button>
        <button class="tr-reading-lang-btn" data-lang="pt">🇧🇷 PT</button>
        <button class="tr-reading-lang-btn" data-lang="en">🇺🇸 EN</button>
      </div>
      <button class="tr-close-btn" id="tr-reading-close" title="Cerrar">✕</button>
    </div>
    <div class="tr-reading-content" id="tr-reading-text"></div>
    <div class="tr-reading-footer">
      <span class="tr-reading-source-hint" id="tr-reading-hint">Google Translate • Auto</span>
      <button class="tr-copy-btn" id="tr-reading-copy">Copiar</button>
    </div>
  `;
  shadow.appendChild(readingCard);

  // 3. Settings & Live Playground Modal
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'tr-modal-backdrop';
  modalBackdrop.innerHTML = `
    <div class="tr-popup-card" id="tr-popup-card">
      <div class="tr-popup-header">
        <div class="tr-popup-logo">
          <div class="tr-popup-logo-icon">🌐</div>
          <div>
            <h2 class="tr-popup-title">Tradutor Rápido</h2>
            <p class="tr-popup-sub">Español • Portugués (BR) • Inglés (EE. UU.)</p>
          </div>
        </div>
        <button class="tr-close-btn" id="tr-modal-close" title="Cerrar">✕</button>
      </div>

      <div class="tr-section-card">
        <span class="tr-section-title">Dirección de traducción al escribir</span>
        <div class="tr-lang-selector-row">
          <select id="tr-modal-source" class="tr-select">
            <option value="es">🇪🇸 Español</option>
            <option value="pt">🇧🇷 Portugués (BR)</option>
            <option value="en">🇺🇸 Inglés (EE. UU.)</option>
            <option value="auto">🌐 Auto detectar</option>
          </select>
          <button id="tr-modal-swap" class="tr-swap-large" title="Invertir dirección">⇄</button>
          <select id="tr-modal-target" class="tr-select">
            <option value="pt">🇧🇷 Portugués (BR)</option>
            <option value="es">🇪🇸 Español</option>
            <option value="en">🇺🇸 Inglés (EE. UU.)</option>
          </select>
        </div>
        <div class="tr-preset-grid">
          <button class="tr-preset-btn" data-pair="es|pt">🇪🇸 ➔ 🇧🇷 ES ➔ PT</button>
          <button class="tr-preset-btn" data-pair="es|en">🇪🇸 ➔ 🇺🇸 ES ➔ EN</button>
          <button class="tr-preset-btn" data-pair="pt|es">🇧🇷 ➔ 🇪🇸 PT ➔ ES</button>
          <button class="tr-preset-btn" data-pair="en|es">🇺🇸 ➔ 🇪🇸 EN ➔ ES</button>
        </div>
      </div>

      <div class="tr-section-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="tr-section-title">Prueba en vivo (Alt+T)</span>
          <span id="tr-modal-pair-badge" style="font-size:11px; color:#60a5fa; font-weight:700;">ES ➔ PT</span>
        </div>
        <textarea id="tr-playground-input" class="tr-playground-textarea" placeholder="Escribe aquí en español, portugués o inglés y pulsa Traducir ahora o Alt+T..."></textarea>
        <button id="tr-playground-btn" class="tr-primary-btn">Traducir ahora</button>
      </div>

      <div class="tr-section-card">
        <span class="tr-section-title">Opciones</span>
        <div class="tr-toggle-row">
          <div>
            <span class="tr-toggle-label">Mostrar botón flotante en el chat</span>
            <p class="tr-toggle-desc">Muestra la píldora 🌐 encima del cuadro de mensaje</p>
          </div>
          <input type="checkbox" id="tr-toggle-floating" class="tr-checkbox" checked>
        </div>
        <div class="tr-toggle-row">
          <div>
            <span class="tr-toggle-label">Modo lectura al seleccionar mensajes</span>
            <p class="tr-toggle-desc">Muestra tarjeta de traducción al seleccionar cualquier texto</p>
          </div>
          <input type="checkbox" id="tr-toggle-reading" class="tr-checkbox" checked>
        </div>
      </div>

      <div class="tr-popup-footer">
        <span>Atajo escribir: <b>Alt+T</b> • Panel: <b>Alt+Shift+T</b></span>
        <span id="tr-save-status" class="tr-save-status"></span>
      </div>
    </div>
  `;
  shadow.appendChild(modalBackdrop);

  // References
  const sourceLabel = shadow.getElementById('tr-source-label');
  const targetLabel = shadow.getElementById('tr-target-label');
  const langPairEl = shadow.getElementById('tr-lang-pair');
  const swapBtn = shadow.getElementById('tr-swap-btn');
  const cfgBtn = shadow.getElementById('tr-cfg-btn');
  const langMenu = shadow.getElementById('tr-lang-menu');

  const readingHeader = shadow.getElementById('tr-reading-header');
  const readingText = shadow.getElementById('tr-reading-text');
  const readingCopyBtn = shadow.getElementById('tr-reading-copy');
  const readingCloseBtn = shadow.getElementById('tr-reading-close');
  const readingLangBtns = shadow.querySelectorAll('.tr-reading-lang-btn');

  const modalCloseBtn = shadow.getElementById('tr-modal-close');
  const modalSourceSelect = shadow.getElementById('tr-modal-source');
  const modalTargetSelect = shadow.getElementById('tr-modal-target');
  const modalSwapBtn = shadow.getElementById('tr-modal-swap');
  const modalPresetBtns = shadow.querySelectorAll('.tr-preset-btn');
  const modalPairBadge = shadow.getElementById('tr-modal-pair-badge');
  const playgroundInput = shadow.getElementById('tr-playground-input');
  const playgroundBtn = shadow.getElementById('tr-playground-btn');
  const toggleFloatingChk = shadow.getElementById('tr-toggle-floating');
  const toggleReadingChk = shadow.getElementById('tr-toggle-reading');
  const saveStatusEl = shadow.getElementById('tr-save-status');

  function syncUIWithSettings() {
    const src = settings.sourceLang || 'es';
    const tgt = settings.targetLang || 'pt';

    sourceLabel.textContent = src.toUpperCase();
    targetLabel.textContent = tgt.toUpperCase();

    const currentKey = `${src}|${tgt}`;
    shadow.querySelectorAll('.tr-menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.pair === currentKey);
    });

    modalSourceSelect.value = src;
    modalTargetSelect.value = tgt;
    modalPairBadge.textContent = `${src.toUpperCase()} ➔ ${tgt.toUpperCase()}`;
    modalPresetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pair === currentKey);
    });

    toggleFloatingChk.checked = settings.showFloatingButton !== false;
    toggleReadingChk.checked = settings.readingTooltip !== false;

    readingLangBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === (settings.readingTargetLang || 'es'));
    });

    if (!settings.translatorEnabled || !settings.showFloatingButton) {
      hideFloatingButton();
    }
  }

  function persistSettings(patch, showNotice = false) {
    Object.assign(settings, patch);
    syncUIWithSettings();
    ipcRenderer.send('tradutor-save-settings', patch);
    if (showNotice) {
      saveStatusEl.textContent = 'Guardado ✔';
      setTimeout(() => { saveStatusEl.textContent = ''; }, 1300);
    }
  }

  // Load initial settings from Main Process
  ipcRenderer.invoke('tradutor-get-settings').then((saved) => {
    if (saved) {
      settings = { ...settings, ...saved };
      syncUIWithSettings();
    }
  }).catch(() => {});

  // Listen for menu updates from Main Process
  ipcRenderer.on('tradutor-settings-updated', (_event, updated) => {
    if (updated) {
      settings = { ...settings, ...updated };
      syncUIWithSettings();
    }
  });

  ipcRenderer.on('tradutor-open-popup', () => {
    modalBackdrop.classList.add('open');
  });

  ipcRenderer.on('tradutor-shortcut-translate', () => {
    const active = getEditableRoot(document.activeElement) || currentInputElement;
    if (isValidInput(active)) {
      triggerTranslationOnElement(active);
    }
  });

  // Pill quick menu
  langPairEl.addEventListener('click', (e) => {
    e.stopPropagation();
    langMenu.classList.toggle('open');
  });

  shadow.querySelectorAll('.tr-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const [src, tgt] = item.dataset.pair.split('|');
      persistSettings({ sourceLang: src, targetLang: tgt });
      langMenu.classList.remove('open');
    });
  });

  swapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const temp = settings.sourceLang;
    const newSrc = settings.targetLang;
    const newTgt = temp === 'auto' ? 'es' : temp;
    persistSettings({ sourceLang: newSrc, targetLang: newTgt });
  });

  cfgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langMenu.classList.remove('open');
    modalBackdrop.classList.add('open');
  });

  // Modal events
  modalCloseBtn.addEventListener('click', () => {
    modalBackdrop.classList.remove('open');
  });

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      modalBackdrop.classList.remove('open');
    }
  });

  modalSourceSelect.addEventListener('change', () => {
    persistSettings({ sourceLang: modalSourceSelect.value }, true);
  });

  modalTargetSelect.addEventListener('change', () => {
    persistSettings({ targetLang: modalTargetSelect.value }, true);
  });

  modalSwapBtn.addEventListener('click', () => {
    const temp = modalSourceSelect.value;
    const newSrc = modalTargetSelect.value;
    const newTgt = temp === 'auto' ? 'es' : temp;
    persistSettings({ sourceLang: newSrc, targetLang: newTgt }, true);
  });

  modalPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const [src, tgt] = btn.dataset.pair.split('|');
      persistSettings({ sourceLang: src, targetLang: tgt }, true);
    });
  });

  toggleFloatingChk.addEventListener('change', () => {
    persistSettings({ showFloatingButton: toggleFloatingChk.checked }, true);
  });

  toggleReadingChk.addEventListener('change', () => {
    persistSettings({ readingTooltip: toggleReadingChk.checked }, true);
  });

  async function runPlaygroundTranslate() {
    const text = playgroundInput.value.trim();
    if (!text) return;
    playgroundBtn.textContent = 'Traduciendo...';
    playgroundBtn.disabled = true;
    try {
      const resp = await ipcRenderer.invoke('tradutor-translate', {
        text,
        from: settings.sourceLang,
        to: settings.targetLang
      });
      if (resp && resp.success && resp.translation) {
        playgroundInput.value = resp.translation;
      }
    } catch (_) {}
    playgroundBtn.textContent = 'Traducir ahora';
    playgroundBtn.disabled = false;
  }

  playgroundBtn.addEventListener('click', runPlaygroundTranslate);
  playgroundInput.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      e.stopPropagation();
      runPlaygroundTranslate();
    }
  });

  document.addEventListener('click', () => {
    langMenu.classList.remove('open');
  });

  // Input validation
  function isValidInput(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.getRootNode() === shadow) return false;

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName === 'input') {
      const type = (el.type || 'text').toLowerCase();
      const validTypes = ['text', 'search', 'email', 'url', 'tel', ''];
      return validTypes.includes(type) && !el.readOnly && !el.disabled;
    }

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return true;
    }

    if (el.getAttribute('role') === 'textbox' && el.getAttribute('contenteditable') !== 'false') {
      return true;
    }

    return false;
  }

  function getEditableRoot(el) {
    if (!el) return null;
    if (el.getRootNode && el.getRootNode() === shadow) return null;
    if (el.tagName && (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')) {
      return el;
    }
    let curr = el;
    while (curr && curr !== document.body) {
      if (curr.getAttribute && (curr.getAttribute('contenteditable') === 'true' || curr.isContentEditable)) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return el;
  }

  function positionFloatingButton(target) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const btnWidth = 175;
    const btnHeight = 32;

    let top = rect.top - btnHeight - 6;
    let left = rect.right - btnWidth;

    if (top < 8) {
      top = rect.bottom + 6;
    }

    if (left < 10) left = 10;
    if (left + btnWidth > window.innerWidth - 10) {
      left = window.innerWidth - btnWidth - 10;
    }

    floatingBtn.style.top = `${Math.round(top)}px`;
    floatingBtn.style.left = `${Math.round(left)}px`;
  }

  function showFloatingButton(target) {
    if (!settings.translatorEnabled || !settings.showFloatingButton) return;
    currentInputElement = target;
    positionFloatingButton(target);
    floatingBtn.classList.add('visible');
  }

  function hideFloatingButton() {
    floatingBtn.classList.remove('visible');
    langMenu.classList.remove('open');
  }

  document.addEventListener('focusin', (e) => {
    if (hideTimeout) clearTimeout(hideTimeout);
    const target = getEditableRoot(e.target);
    if (isValidInput(target)) {
      showFloatingButton(target);
    }
  }, true);

  document.addEventListener('focusout', () => {
    hideTimeout = setTimeout(() => {
      const active = getEditableRoot(document.activeElement);
      if (!isValidInput(active)) {
        hideFloatingButton();
      }
    }, 250);
  }, true);

  window.addEventListener('scroll', () => {
    if (floatingBtn.classList.contains('visible') && currentInputElement) {
      positionFloatingButton(currentInputElement);
    }
  }, { passive: true, capture: true });

  window.addEventListener('resize', () => {
    if (floatingBtn.classList.contains('visible') && currentInputElement) {
      positionFloatingButton(currentInputElement);
    }
  }, { passive: true });

  floatingBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  floatingBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentInputElement) {
      triggerTranslationOnElement(currentInputElement);
    }
  });

  function getFormattedInputText(element) {
    if (!element) return '';
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      return element.value || '';
    }

    const pElements = element.querySelectorAll('p');
    if (pElements.length > 0) {
      const paragraphs = [];
      pElements.forEach(p => {
        const clone = p.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        paragraphs.push(clone.textContent || '');
      });
      return paragraphs.join('\n');
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('p, div').forEach(el => el.prepend('\n'));
    return (clone.innerText || clone.textContent || '').replace(/\r\n/g, '\n');
  }

  function getTextAndSelection(target) {
    if (!target) return null;
    const isInputOrTextarea = target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea';

    if (isInputOrTextarea) {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const fullText = target.value || '';
      const hasSelection = end > start;
      const textToTranslate = hasSelection ? fullText.substring(start, end) : fullText;

      return {
        isInput: true,
        fullText,
        textToTranslate,
        hasSelection,
        start,
        end
      };
    } else {
      const sel = window.getSelection();
      const selText = sel ? sel.toString() : '';
      const fullText = getFormattedInputText(target);
      const hasSelection = selText.trim().length > 0;
      const textToTranslate = hasSelection ? selText : fullText;

      return {
        isInput: false,
        fullText,
        textToTranslate,
        hasSelection
      };
    }
  }

  function setNativeInputValue(element, newValue, start) {
    element.focus();
    const proto = element instanceof HTMLInputElement
      ? window.HTMLInputElement.prototype
      : window.HTMLTextAreaElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, newValue);
    } else {
      element.value = newValue;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    const cursor = typeof start === 'number' ? start + newValue.length : newValue.length;
    try {
      element.setSelectionRange(cursor, cursor);
    } catch (_) {}
  }

  function setContentEditableValue(element, translatedText, hasSelection) {
    element.focus();

    if (!hasSelection) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const lines = translatedText.split('\n');

    if (lines.length > 1) {
      let pasteWorked = false;
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', translatedText);
        const pasteEvt = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        pasteWorked = !element.dispatchEvent(pasteEvt);
      } catch (_) {}

      const currentVal = element.innerText || '';
      if (!pasteWorked || !currentVal.includes(lines[1])) {
        try {
          document.execCommand('delete', false, null);
          for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
              const broke = document.execCommand('insertLineBreak', false, null);
              if (!broke) document.execCommand('insertParagraph', false, null);
            }
            if (lines[i].length > 0) {
              document.execCommand('insertText', false, lines[i]);
            }
          }
        } catch (_) {
          document.execCommand('insertText', false, translatedText);
        }
      }
    } else {
      document.execCommand('insertText', false, translatedText);
    }

    try {
      const selection = window.getSelection();
      const endRange = document.createRange();
      endRange.selectNodeContents(element);
      endRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(endRange);
    } catch (_) {}
  }

  function setButtonState(state) {
    floatingBtn.classList.remove('loading', 'success', 'error');
    if (state === 'loading') {
      floatingBtn.classList.add('loading');
    } else if (state === 'success') {
      floatingBtn.classList.add('success');
      setTimeout(() => floatingBtn.classList.remove('success'), 1400);
    } else if (state === 'error') {
      floatingBtn.classList.add('error');
      setTimeout(() => floatingBtn.classList.remove('error'), 1400);
    }
  }

  async function triggerTranslationOnElement(target) {
    if (!settings.translatorEnabled || isTranslating || !target) return;
    const info = getTextAndSelection(target);
    if (!info || !info.textToTranslate.trim()) return;

    isTranslating = true;
    setButtonState('loading');

    try {
      const response = await ipcRenderer.invoke('tradutor-translate', {
        text: info.textToTranslate,
        from: settings.sourceLang,
        to: settings.targetLang
      });

      if (response && response.success && response.translation) {
        const translated = response.translation;

        if (info.isInput) {
          if (info.hasSelection) {
            const prefix = info.fullText.substring(0, info.start);
            const suffix = info.fullText.substring(info.end);
            const combined = prefix + translated + suffix;
            setNativeInputValue(target, combined, info.start);
          } else {
            setNativeInputValue(target, translated);
          }
        } else {
          setContentEditableValue(target, translated, info.hasSelection);
        }

        setButtonState('success');
      } else {
        setButtonState('error');
      }
    } catch (err) {
      console.error('[Tradutor Rápido] Error:', err);
      setButtonState('error');
    } finally {
      isTranslating = false;
      target.focus();
    }
  }

  function extractFormattedTextFromSelection(sel) {
    if (!sel || sel.rangeCount === 0) return '';
    try {
      const range = sel.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());

      container.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      container.querySelectorAll('p, div, li').forEach(el => el.prepend('\n'));

      const text = container.innerText || container.textContent || '';
      const formatted = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      return formatted || sel.toString().trim();
    } catch (_) {
      return sel.toString().trim();
    }
  }

  // Reading Mode Card
  function showReadingTooltip(selectedText, rect, clientX, clientY) {
    if (!settings.translatorEnabled || !settings.readingTooltip || !selectedText.trim()) return;
    currentSelectedText = selectedText;

    readingText.textContent = 'Traduciendo...';

    readingCard.style.visibility = 'hidden';
    readingCard.classList.add('visible');
    const cardRect = readingCard.getBoundingClientRect();
    const cardH = cardRect.height || 220;
    const cardW = cardRect.width || 360;
    readingCard.style.visibility = 'visible';

    const refY = typeof clientY === 'number' ? clientY : rect.bottom;
    const refX = typeof clientX === 'number' ? clientX : rect.left;

    let top = 0;
    let left = refX - 20;

    if (refY > window.innerHeight * 0.5) {
      const anchorTop = typeof clientY === 'number' ? clientY : rect.top;
      top = anchorTop - cardH - 12;
    } else {
      top = refY + 12;
    }

    if (top + cardH > window.innerHeight - 12) {
      top = window.innerHeight - cardH - 12;
    }
    if (top < 12) top = 12;

    if (left + cardW > window.innerWidth - 12) {
      left = window.innerWidth - cardW - 12;
    }
    if (left < 12) left = 12;

    readingCard.style.top = `${Math.round(top)}px`;
    readingCard.style.left = `${Math.round(left)}px`;

    executeReadingTranslation();
  }

  async function executeReadingTranslation() {
    const target = settings.readingTargetLang || 'es';

    readingLangBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === target);
    });

    try {
      const resp = await ipcRenderer.invoke('tradutor-translate', {
        text: currentSelectedText,
        from: 'auto',
        to: target
      });
      if (resp && resp.success) {
        readingText.textContent = resp.translation;
      } else {
        readingText.textContent = 'No se pudo traducir la selección.';
      }
    } catch (_) {
      readingText.textContent = 'Error al conectar con el servicio de traducción.';
    }
  }

  readingLangBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      persistSettings({ readingTargetLang: btn.dataset.lang });
      executeReadingTranslation();
    });
  });

  // Draggable Reading Card
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let cardStartLeft = 0;
  let cardStartTop = 0;

  readingHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = readingCard.getBoundingClientRect();
    cardStartLeft = rect.left;
    cardStartTop = rect.top;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    let newLeft = cardStartLeft + dx;
    let newTop = cardStartTop + dy;

    const cardW = readingCard.offsetWidth || 360;
    const cardH = readingCard.offsetHeight || 220;

    newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - cardW - 10));
    newTop = Math.max(10, Math.min(newTop, window.innerHeight - cardH - 10));

    readingCard.style.left = `${Math.round(newLeft)}px`;
    readingCard.style.top = `${Math.round(newTop)}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
    }
  });

  function closeReadingCard(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    readingCard.classList.remove('visible');
    isReadingCardClosed = true;

    try {
      window.getSelection()?.removeAllRanges();
    } catch (_) {}

    setTimeout(() => {
      isReadingCardClosed = false;
    }, 450);
  }

  readingCloseBtn.addEventListener('click', closeReadingCard);
  readingCloseBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  readingCloseBtn.addEventListener('mouseup', (e) => e.stopPropagation());

  readingCopyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = readingText.textContent;
    if (text && text !== 'Traduciendo...') {
      await navigator.clipboard.writeText(text);
      readingCopyBtn.textContent = '¡Copiado!';
      setTimeout(() => { readingCopyBtn.textContent = 'Copiar'; }, 1500);
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (!settings.translatorEnabled || isReadingCardClosed || isDragging) return;
    if (e.composedPath && e.composedPath().includes(hostElement)) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    setTimeout(() => {
      if (isReadingCardClosed) return;
      const activeEl = getEditableRoot(document.activeElement);
      if (isValidInput(activeEl)) return;

      const sel = window.getSelection();
      const text = extractFormattedTextFromSelection(sel);

      if (text.length > 2 && text.length < 1500) {
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            showReadingTooltip(text, rect, clientX, clientY);
          }
        } catch (_) {}
      } else {
        readingCard.classList.remove('visible');
      }
    }, 40);
  });

  // Keyboard shortcuts: Alt+T (translate) and Alt+Shift+T (open settings modal)
  document.addEventListener('keydown', (e) => {
    if (!settings.translatorEnabled) return;

    if (e.altKey && e.shiftKey && (e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      modalBackdrop.classList.toggle('open');
      return;
    }

    if (e.altKey && !e.shiftKey && (e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) {
      if (e.composedPath && e.composedPath().includes(hostElement)) return;

      const active = getEditableRoot(document.activeElement) || currentInputElement;
      if (isValidInput(active)) {
        e.preventDefault();
        e.stopPropagation();
        triggerTranslationOnElement(active);
      } else {
        const sel = window.getSelection();
        const text = extractFormattedTextFromSelection(sel);
        if (text.length > 0) {
          e.preventDefault();
          const range = sel.getRangeAt(0);
          showReadingTooltip(text, range.getBoundingClientRect());
        }
      }
    }
  }, true);

  console.log('[Tradutor Rápido ES • PT-BR • EN] Integrado nativamente en YakChat.');
}

module.exports = {
  initTradutorRapido
};
