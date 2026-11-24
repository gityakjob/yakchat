const { ipcRenderer, contextBridge, webFrame } = require('electron');
const { initTradutorRapido } = require('./translator');
const { initAutocorrect } = require('./autocorrect');

const chromeVersion = process.versions.chrome || '140.0.0.0';
const chromeMajor = chromeVersion.split('.')[0] || '140';

// 1. Inject Main World compatibility layer:
//    - Configure desktop browser properties in Main World for WebRTC voice/video call support
//    - Route window.Notification and ServiceWorker showNotification through
//      KDE Plasma's native notification daemon (org.freedesktop.Notifications) with contact avatars
const mainWorldScript = `
(() => {
  if (window.__waPlasmaMainWorldInjected) return;
  window.__waPlasmaMainWorldInjected = true;

  try {
    const chromeVersion = ${JSON.stringify(chromeVersion)};
    const chromeMajor = ${JSON.stringify(chromeMajor)};
    const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chromeVersion + " Safari/537.36";
    const desktopAppVersion = "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chromeVersion + " Safari/537.36";

    Object.defineProperty(navigator, 'userAgent', { get: () => desktopUA, configurable: true });
    Object.defineProperty(navigator, 'appVersion', { get: () => desktopAppVersion, configurable: true });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });

    if (navigator.userAgentData) {
      const browserBrands = [
        { brand: 'Chromium', version: chromeMajor },
        { brand: 'Google Chrome', version: chromeMajor },
        { brand: 'Not(A:Brand', version: '24' }
      ];
      Object.defineProperty(navigator.userAgentData, 'brands', { get: () => browserBrands, configurable: true });
      Object.defineProperty(navigator.userAgentData, 'mobile', { get: () => false, configurable: true });
      Object.defineProperty(navigator.userAgentData, 'platform', { get: () => 'Windows', configurable: true });

      const origGetHighEntropyValues = navigator.userAgentData.getHighEntropyValues;
      navigator.userAgentData.getHighEntropyValues = async function (hints) {
        const values = origGetHighEntropyValues ? await origGetHighEntropyValues.call(this, hints) : {};
        values.platform = 'Windows';
        values.platformVersion = '15.0.0';
        values.architecture = 'x86';
        values.model = '';
        values.uaFullVersion = chromeVersion;
        return values;
      };
    }
  } catch (e) {}

  // Convert blob: or https: avatar URL to data:image/png;base64 for KDE Plasma notification icon
  async function resolveIconToDataUrl(iconUrl) {
    if (!iconUrl || typeof iconUrl !== 'string') return null;
    if (iconUrl.startsWith('data:image/')) return iconUrl;
    try {
      const resp = await fetch(iconUrl);
      const blob = await resp.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return null;
    }
  }

  const notificationCallbacks = new Map();
  let notifCounter = 1;

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === '__WA_PLASMA_NOTIF_CLICKED__') {
      const cb = notificationCallbacks.get(event.data.id);
      if (cb) {
        try { cb(); } catch (_) {}
      }
    }
  });

  class PlasmaNotification extends EventTarget {
    static get permission() {
      return 'granted';
    }
    static get maxActions() {
      return 2;
    }
    static requestPermission(cb) {
      if (typeof cb === 'function') cb('granted');
      return Promise.resolve('granted');
    }

    constructor(title, options = {}) {
      super();
      this.title = title || 'YakChat';
      this.body = options.body || '';
      this.tag = options.tag || '';
      this.icon = options.icon || '';
      this.data = options.data || null;
      this.onclick = null;
      this.onclose = null;
      this.onerror = null;
      this.onshow = null;

      const id = ++notifCounter;
      this._id = id;

      // Immediately signal that a native WhatsApp notification is being dispatched
      window.postMessage({ type: '__WA_PLASMA_NOTIF_START__', title: this.title }, '*');

      notificationCallbacks.set(id, () => {
        const evt = new Event('click');
        this.dispatchEvent(evt);
        if (typeof this.onclick === 'function') {
          this.onclick(evt);
        }
      });

      resolveIconToDataUrl(this.icon).then((iconDataUrl) => {
        window.postMessage({
          type: '__WA_PLASMA_NOTIFICATION__',
          payload: {
            id,
            title: this.title,
            body: this.body,
            tag: this.tag,
            iconDataUrl
          }
        }, '*');
      });

      setTimeout(() => {
        const showEvt = new Event('show');
        this.dispatchEvent(showEvt);
        if (typeof this.onshow === 'function') {
          this.onshow(showEvt);
        }
      }, 10);
    }

    close() {
      notificationCallbacks.delete(this._id);
      const closeEvt = new Event('close');
      this.dispatchEvent(closeEvt);
      if (typeof this.onclose === 'function') {
        this.onclose(closeEvt);
      }
    }
  }

  window.Notification = PlasmaNotification;

  if ('ServiceWorkerRegistration' in window) {
    ServiceWorkerRegistration.prototype.showNotification = function (title, options = {}) {
      new PlasmaNotification(title, options);
      return Promise.resolve();
    };
  }
})();
`;

try {
  webFrame.executeJavaScript(mainWorldScript);
} catch (err) {
  console.warn('[Preload] Could not inject Main World script:', err);
}

// Track when WhatsApp Web fires a native web notification so fallback doesn't duplicate it
let lastWebNotificationTime = 0;
let fallbackClickTargets = new Map();
let fallbackIdCounter = 100000;

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.type === '__WA_PLASMA_NOTIF_START__') {
    lastWebNotificationTime = Date.now();
  } else if (event.data.type === '__WA_PLASMA_NOTIFICATION__' && event.data.payload) {
    lastWebNotificationTime = Date.now();
    ipcRenderer.send('whatsapp-message-notification', event.data.payload);
  }
});

ipcRenderer.on('whatsapp-notification-clicked', (_event, id) => {
  if (fallbackClickTargets.has(id)) {
    const rowEl = fallbackClickTargets.get(id);
    if (rowEl && typeof rowEl.click === 'function') {
      try { rowEl.click(); } catch (_) {}
    }
    return;
  }
  window.postMessage({ type: '__WA_PLASMA_NOTIF_CLICKED__', id }, '*');
});

// 2. Per-Chat State Diff Tracker & Unread Badge Counter
//    Accurately detects WHICH specific chat received a new message by comparing per-chat
//    unread counts and message previews, never picking unrelated or pinned chats.
let lastUnreadCount = 0;
const chatStateMap = new Map(); // senderName -> { unread: number, preview: string }
let paneFirstSeenAt = 0;
let lastPaneScrollTime = 0;
let paneScrollBound = false;

async function fetchAvatarDataUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:image/')) return url;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

function getIndividualChatRows() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return [];

  if (!paneFirstSeenAt) {
    paneFirstSeenAt = Date.now();
  }
  if (!paneScrollBound) {
    paneScrollBound = true;
    pane.addEventListener('scroll', () => {
      lastPaneScrollTime = Date.now();
    }, { passive: true });
  }

  const rows = [];
  const seen = new Set();

  // Climb from any unread badge or chat span to its individual ~72px row container (NEVER #pane-side)
  const anchors = pane.querySelectorAll(
    '[aria-label*="no leído" i], [aria-label*="unread" i], [aria-label*="não lida" i], [data-testid="icon-unread-count"], span[dir="auto"], span[title]'
  );
  for (const anchor of anchors) {
    let curr = anchor.parentElement;
    let rowCandidate = null;
    while (curr && curr !== pane) {
      const h = curr.offsetHeight;
      const w = curr.offsetWidth;
      if (h >= 48 && h <= 125 && w >= 180) {
        rowCandidate = curr;
      } else if (h > 140) {
        break;
      }
      curr = curr.parentElement;
    }
    if (rowCandidate && !seen.has(rowCandidate)) {
      seen.add(rowCandidate);
      rows.push(rowCandidate);
    }
  }

  // Sort by actual visual Y position on screen (handles WhatsApp Web's virtualized translateY order)
  rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  return rows;
}

function isTimestampText(txt) {
  if (!txt) return false;
  if (/^\d{1,2}:\d{2}(\s*[ap]\.?\s*m\.?)?$/i.test(txt)) return true;
  if (/^(ayer|yesterday|hoy|today|ontem|hoje|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)$/i.test(txt)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(txt)) return true;
  return false;
}

function extractChatRowInfo(row) {
  if (!row) return null;
  const rowRect = row.getBoundingClientRect();
  if (rowRect.height < 40 || rowRect.height > 140) return null;

  const midY = rowRect.top + rowRect.height * 0.52;

  // Check if this specific chat row is muted
  const isMuted = Boolean(
    row.querySelector('[data-icon="muted"], [data-testid="muted"], [aria-label*="silenciado" i], [aria-label*="muted" i]')
  );

  // Check unread badge inside THIS specific chat row only
  const badgeEl = row.querySelector(
    '[aria-label*="no leído" i], [aria-label*="unread" i], [aria-label*="não lida" i], [data-testid="icon-unread-count"]'
  );
  let unread = 0;
  if (badgeEl) {
    const aria = (badgeEl.getAttribute('aria-label') || badgeEl.textContent || '').trim();
    const m = aria.match(/(\d+)/);
    unread = m ? parseInt(m[1], 10) : 1;
  }

  // Collect spans inside THIS row and split by Top Line (Chat Name) vs Bottom Line (Message Preview)
  const allSpans = Array.from(row.querySelectorAll('span[dir="auto"], span[dir="ltr"], span[title]'));
  let titleSpan = null;
  let sender = '';

  // 1. Find the Chat Name in the upper half of this specific row
  for (const s of allSpans) {
    if (badgeEl && (s === badgeEl || badgeEl.contains(s) || s.contains(badgeEl))) continue;
    const r = s.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const centerY = r.top + r.height * 0.5;
    if (centerY <= midY) {
      const candidate = (s.getAttribute('title') || s.textContent || '').trim();
      if (candidate && !isTimestampText(candidate)) {
        titleSpan = s;
        sender = candidate;
        break;
      }
    }
  }

  // Fallback if layout height wasn't standard
  if (!sender) {
    const fallbackSpan = row.querySelector('span[dir="auto"][title], span[title], span[dir="auto"]');
    if (!fallbackSpan) return null;
    titleSpan = fallbackSpan;
    sender = (fallbackSpan.getAttribute('title') || fallbackSpan.textContent || '').trim();
  }
  if (!sender) return null;

  // 2. Extract Message Preview from the lower half of this specific row
  const previewParts = [];
  for (const s of allSpans) {
    if (s === titleSpan || (titleSpan && (titleSpan.contains(s) || s.contains(titleSpan)))) continue;
    if (badgeEl && (s === badgeEl || badgeEl.contains(s) || s.contains(badgeEl))) continue;
    if (allSpans.some(other => other !== s && other !== titleSpan && other.contains(s))) continue;

    const r = s.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const centerY = r.top + r.height * 0.5;
    if (centerY < midY - 4) continue; // skip upper line elements (like timestamp)

    const txt = (s.getAttribute('title') || s.textContent || '').trim();
    if (!txt || txt === sender || isTimestampText(txt)) continue;
    if (/^\d+$/.test(txt) && unread > 0 && parseInt(txt, 10) === unread) continue;
    previewParts.push(txt);
  }

  const preview = previewParts.join(' ').replace(/\s+/g, ' ').trim() || 'Nuevo mensaje';
  const avatarImg = row.querySelector('img[src]');
  const avatarUrl = avatarImg ? avatarImg.src : null;

  return {
    sender,
    unread,
    isMuted,
    preview,
    avatarUrl,
    row
  };
}

function scanChatRowsForChanges() {
  try {
    const rows = getIndividualChatRows();
    if (rows.length === 0) return;

    const now = Date.now();
    // During initial startup (first 4s after #pane-side renders) or while scrolling the chat list,
    // record existing state silently without triggering notifications.
    const isInitializingOrScrolling =
      (now - paneFirstSeenAt < 4000) ||
      (now - lastPaneScrollTime < 1500);

    for (let i = 0; i < rows.length; i++) {
      const info = extractChatRowInfo(rows[i]);
      if (!info) continue;

      const prev = chatStateMap.get(info.sender);
      chatStateMap.set(info.sender, {
        unread: info.unread,
        preview: info.preview
      });

      if (isInitializingOrScrolling) continue;
      if (info.isMuted || info.unread <= 0) continue;

      // Did THIS specific chat just receive a new unread message?
      const isNewMessageInChat = prev
        ? (info.unread > prev.unread || (info.unread > 0 && info.preview !== prev.preview))
        : (i < 5 && info.unread > 0); // Brand new chat appearing in the top 5 rows

      if (isNewMessageInChat) {
        // Wait 600ms to let WhatsApp Web's own window.Notification fire first if active
        setTimeout(async () => {
          if (Date.now() - lastWebNotificationTime < 1800) {
            return; // Already notified by window.Notification
          }
          lastWebNotificationTime = Date.now();
          const iconDataUrl = await fetchAvatarDataUrl(info.avatarUrl);
          const id = ++fallbackIdCounter;
          fallbackClickTargets.set(id, info.row);

          ipcRenderer.send('whatsapp-message-notification', {
            id,
            title: info.sender,
            body: info.preview,
            tag: `chat-${info.sender}`,
            iconDataUrl
          });
        }, 600);
      }
    }
  } catch (_) {}
}

function checkUnreadCount() {
  const title = document.title || '';
  const match = title.match(/^\((\d+)\)/);
  let count = 0;
  if (match) {
    count = parseInt(match[1], 10);
  } else if (title.startsWith('(•)') || title.startsWith('(·)')) {
    count = 1;
  }

  if (count !== lastUnreadCount) {
    lastUnreadCount = count;
    ipcRenderer.send('unread-count-changed', count);
  }
}

// 3. Incoming Call Detection & desktop alert
let lastCallAlertTimestamp = 0;

function checkIncomingCalls() {
  try {
    const callDialog = document.querySelector('[data-testid*="call"], [aria-label*="llamada" i], [aria-label*="call" i]');
    if (callDialog) {
      const text = callDialog.innerText || callDialog.textContent || '';
      const isIncoming = /llamada entrante|incoming call|videollamada entrante|incoming video call/i.test(text);
      if (isIncoming) {
        const now = Date.now();
        if (now - lastCallAlertTimestamp > 8000) {
          lastCallAlertTimestamp = now;
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          const caller = lines[0] || 'Contacto';
          const isVideo = /video/i.test(text);
          ipcRenderer.send('incoming-call-alert', {
            caller: caller,
            isVideo: isVideo
          });
        }
      }
    }
  } catch (err) {
    // Silent fail for DOM checks
  }
}

// Set up MutationObserver once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.querySelector('title');
  if (titleEl) {
    const titleObserver = new MutationObserver(() => {
      checkUnreadCount();
      scanChatRowsForChanges();
    });
    titleObserver.observe(titleEl, { subtree: true, characterData: true, childList: true });
  }

  const bodyObserver = new MutationObserver(() => {
    checkUnreadCount();
    scanChatRowsForChanges();
    checkIncomingCalls();
  });

  bodyObserver.observe(document.body, { childList: true, subtree: true });

  checkUnreadCount();
  scanChatRowsForChanges();
  checkIncomingCalls();

  // Initialize Tradutor Rápido (ES • PT-BR • EN)
  try {
    initTradutorRapido();
  } catch (err) {
    console.error('[Preload] Error initializing Tradutor Rápido:', err);
  }

  // Initialize Asistente de Ortografía y Autocorrector en Español
  try {
    initAutocorrect();
  } catch (err) {
    console.error('[Preload] Error initializing Autocorrector:', err);
  }
});

// Periodic fallback check every 2 seconds
setInterval(() => {
  checkUnreadCount();
  scanChatRowsForChanges();
  checkIncomingCalls();
}, 2000);

// 4. Safe contextBridge API
contextBridge.exposeInMainWorld('yakChat', {
  sendNotificationClick: () => ipcRenderer.send('notification-clicked'),
  toggleTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getVersion: () => process.versions.electron
});
