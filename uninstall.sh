#!/usr/bin/env bash
set -e

BIN_DIR="${HOME}/.local/bin"
DATA_DIR="${HOME}/.local/share/yakchat"
APPS_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons/hicolor"
PIXMAPS_DIR="${HOME}/.local/share/pixmaps"

echo "=== Desinstalando YakChat ==="

rm -f "$BIN_DIR/yakchat"
rm -rf "$DATA_DIR"
rm -f "$APPS_DIR/yakchat.desktop"
rm -f "$PIXMAPS_DIR/yakchat.png"
rm -f "$ICONS_DIR/scalable/apps/yakchat.svg"

for size in 16 24 32 48 64 128 256 512; do
  rm -f "$ICONS_DIR/${size}x${size}/apps/yakchat.png"
done

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

echo "✅ YakChat ha sido desinstalado de tu sistema."
