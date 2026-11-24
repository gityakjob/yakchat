const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(filename, defaults) {
    this.userDataPath = app.getPath('userData');
    this.filePath = path.join(this.userDataPath, filename);
    this.defaults = defaults;
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...this.defaults, ...parsed };
      }
    } catch (err) {
      console.warn(`[Config] Error reading ${this.filePath}, using defaults:`, err.message);
    }
    return { ...this.defaults };
  }

  save() {
    try {
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[Config] Error writing ${this.filePath}:`, err.message);
    }
  }

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  setMultiple(obj) {
    Object.assign(this.data, obj);
    this.save();
  }

  getAll() {
    return { ...this.data };
  }
}

// Config defaults
const configDefaults = {
  minimizeToTray: true,
  closeToTray: true,
  startMinimized: false,
  hardwareAcceleration: true,
  autoHideMenuBar: true,
  zoomFactor: 1.0,
  theme: 'system', // 'system', 'dark', 'light'
  spellcheck: true,
  spellcheckLanguages: ['es-ES', 'es-419', 'es'],
  spellcheckPreset: 'es-ES',
  autocorrectEnabled: true,
  autocorrectNotification: false,
  notifications: true,
  callAlerts: true,
  // Tradutor Rápido (ES • PT-BR • EN) settings
  translatorEnabled: true,
  sourceLang: 'es',
  targetLang: 'pt',
  showFloatingButton: true,
  readingTooltip: true,
  readingTargetLang: 'es'
};

// Window state defaults
const windowStateDefaults = {
  width: 1200,
  height: 800,
  x: undefined,
  y: undefined,
  isMaximized: false
};

let configStore;
let windowStateStore;

function getConfig() {
  if (!configStore) {
    configStore = new Store('config.json', configDefaults);
  }
  return configStore;
}

function getWindowState() {
  if (!windowStateStore) {
    windowStateStore = new Store('window-state.json', windowStateDefaults);
  }
  return windowStateStore;
}

module.exports = {
  getConfig,
  getWindowState
};
