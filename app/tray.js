const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const { getConfig } = require('./config');

let tray = null;
let unreadCount = 0;

function getIconPath(hasUnread = false) {
  const iconName = hasUnread ? 'tray-unread.png' : 'tray.png';
  return path.join(__dirname, '..', 'assets', iconName);
}

function createTray(mainWindow) {
  if (tray) return tray;

  const initialIcon = nativeImage.createFromPath(getIconPath(false));
  tray = new Tray(initialIcon);
  tray.setToolTip('YakChat');

  const config = getConfig();

  function buildContextMenu() {
    const isVisible = mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? 'Ocultar YakChat' : 'Mostrar YakChat',
        click: () => {
          toggleWindow(mainWindow);
        }
      },
      { type: 'separator' },
      {
        label: 'Silenciar notificaciones',
        type: 'checkbox',
        checked: !config.get('notifications'),
        click: (item) => {
          config.set('notifications', !item.checked);
        }
      },
      {
        label: 'Cerrar a la bandeja',
        type: 'checkbox',
        checked: config.get('closeToTray'),
        click: (item) => {
          config.set('closeToTray', item.checked);
        }
      },
      {
        label: 'Iniciar minimizado',
        type: 'checkbox',
        checked: config.get('startMinimized'),
        click: (item) => {
          config.set('startMinimized', item.checked);
        }
      },
      { type: 'separator' },
      {
        label: 'Recargar',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          if (mainWindow) mainWindow.reload();
        }
      },
      { type: 'separator' },
      {
        label: 'Salir de YakChat',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  }

  buildContextMenu();

  tray.on('click', () => {
    toggleWindow(mainWindow);
  });

  tray.on('right-click', () => {
    buildContextMenu();
    tray.popUpContextMenu();
  });

  return tray;
}

function toggleWindow(mainWindow) {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function updateTrayBadge(count) {
  unreadCount = count;
  if (!tray) return;

  const hasUnread = unreadCount > 0;
  const iconPath = getIconPath(hasUnread);
  const icon = nativeImage.createFromPath(iconPath);
  tray.setImage(icon);

  if (hasUnread) {
    tray.setToolTip(`YakChat (${unreadCount} mensaje${unreadCount > 1 ? 's' : ''} no leído${unreadCount > 1 ? 's' : ''})`);
  } else {
    tray.setToolTip('YakChat');
  }
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  createTray,
  updateTrayBadge,
  destroyTray
};
