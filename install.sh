#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
BIN_DIR="${HOME}/.local/bin"
DATA_DIR="${HOME}/.local/share/yakchat"
APPS_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons/hicolor"
PIXMAPS_DIR="${HOME}/.local/share/pixmaps"

echo "=== Instalando YakChat para CachyOS / Linux ==="

# 1. Asegurar directorios
mkdir -p "$BIN_DIR" "$DATA_DIR" "$APPS_DIR" "$PIXMAPS_DIR"

# 2. Copiar archivos de la aplicación
echo "-> Copiando archivos de la app a $DATA_DIR..."
rm -rf "$DATA_DIR/app" "$DATA_DIR/assets" "$DATA_DIR/bin"
cp -r "$PROJECT_DIR/app" "$DATA_DIR/"
cp -r "$PROJECT_DIR/assets" "$DATA_DIR/"
cp -r "$PROJECT_DIR/bin" "$DATA_DIR/"
cp "$PROJECT_DIR/package.json" "$DATA_DIR/"

# 3. Enlace ejecutable en ~/.local/bin
echo "-> Creando ejecutable en $BIN_DIR/yakchat..."
ln -sf "$DATA_DIR/bin/yakchat" "$BIN_DIR/yakchat"
chmod +x "$DATA_DIR/bin/yakchat" "$BIN_DIR/yakchat"

# 4. Instalar iconos en hicolor y pixmaps
echo "-> Instalando iconos..."
cp "$PROJECT_DIR/assets/icon.png" "$PIXMAPS_DIR/yakchat.png"

for size in 16 24 32 48 64 128 256 512; do
  TARGET_ICON_DIR="$ICONS_DIR/${size}x${size}/apps"
  mkdir -p "$TARGET_ICON_DIR"
  if [ -f "$PROJECT_DIR/assets/icons/${size}x${size}.png" ]; then
    cp "$PROJECT_DIR/assets/icons/${size}x${size}.png" "$TARGET_ICON_DIR/yakchat.png"
  fi
done

SCALABLE_DIR="$ICONS_DIR/scalable/apps"
mkdir -p "$SCALABLE_DIR"
cp "$PROJECT_DIR/assets/icon.svg" "$SCALABLE_DIR/yakchat.svg"

# 5. Instalar entrada de escritorio (.desktop) y registrar manejador whatsapp://
echo "-> Instalando acceso directo en $APPS_DIR/yakchat.desktop..."
cp "$PROJECT_DIR/yakchat.desktop" "$APPS_DIR/yakchat.desktop"

if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default yakchat.desktop x-scheme-handler/whatsapp || true
fi

# 6. Actualizar cachés del sistema
echo "-> Actualizando caché de aplicaciones e iconos..."
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$ICONS_DIR" >/dev/null 2>&1 || true
fi

if command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 --noincremental >/dev/null 2>&1 || true
elif command -v kbuildsycoca5 >/dev/null 2>&1; then
  kbuildsycoca5 --noincremental >/dev/null 2>&1 || true
fi

echo ""
echo "✅ ¡YakChat instalado con éxito!"
echo "Puedes ejecutarlo escribiendo 'yakchat' en tu terminal"
echo "o buscándolo en el menú de aplicaciones de KDE Plasma."
