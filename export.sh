#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
VERSION="$(grep -o '"version": *"[^"]*"' "$PROJECT_DIR/package.json" | cut -d'"' -f4)"
VERSION="${VERSION:-1.1.0}"
BUILD_TMP="/tmp/makepkg-yakchat"

echo "=========================================================="
echo "    Exportador y Empaquetador para YakChat"
echo "    Versión: $VERSION"
echo "=========================================================="

mkdir -p "$DIST_DIR"

# 1. Limpiar construcciones anteriores en dist
rm -rf "$DIST_DIR"/* "$PROJECT_DIR"/pkg "$BUILD_TMP"

# 2. Construir paquete nativo de Arch Linux / CachyOS (.pkg.tar.zst)
echo ""
echo "-> [1/2] Construyendo paquete nativo de CachyOS / Arch Linux (.pkg.tar.zst)..."
if command -v makepkg >/dev/null 2>&1; then
    mkdir -p "$BUILD_TMP"
    (cd "$PROJECT_DIR" && BUILDDIR="$BUILD_TMP" makepkg -f --nodeps)
    mv "$PROJECT_DIR"/yakchat-*.pkg.tar.zst "$DIST_DIR/"
    echo "   [✓] Paquete Pacman creado con éxito en dist/"
else
    echo "   [!] makepkg no encontrado, omitiendo paquete pacman."
fi

# 3. Crear paquete portable universal (.tar.gz)
echo ""
echo "-> [2/2] Creando paquete portable independiente (.tar.gz)..."
PORTABLE_NAME="yakchat-v${VERSION}-linux-x64"
PORTABLE_DIR="$DIST_DIR/$PORTABLE_NAME"

rm -rf "$PORTABLE_DIR"
mkdir -p "$PORTABLE_DIR"

cp -r "$PROJECT_DIR/app" "$PORTABLE_DIR/"
cp -r "$PROJECT_DIR/assets" "$PORTABLE_DIR/"
cp -r "$PROJECT_DIR/bin" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/package.json" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/yakchat.desktop" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/install.sh" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/uninstall.sh" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/update.sh" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/PKGBUILD" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/LICENSE" "$PORTABLE_DIR/"
cp "$PROJECT_DIR/README.md" "$PORTABLE_DIR/"

(cd "$DIST_DIR" && tar -czf "${PORTABLE_NAME}.tar.gz" "$PORTABLE_NAME")
rm -rf "$PORTABLE_DIR"

echo "   [✓] Paquete portable creado con éxito en dist/${PORTABLE_NAME}.tar.gz"

# Limpieza de temporales
rm -rf "$PROJECT_DIR"/pkg "$BUILD_TMP"

echo ""
echo "=========================================================="
echo "           ¡Exportación completada con éxito!"
echo "=========================================================="
echo "Archivos generados en $DIST_DIR:"
ls -lh "$DIST_DIR"
echo ""
echo "Modos de uso y distribución:"
echo " 1. Para instalar o actualizar en CachyOS/Arch:"
echo "    sudo pacman -U dist/yakchat-${VERSION}-1-any.pkg.tar.zst"
echo ""
echo " 2. Para compartir o llevar a otra PC:"
echo "    Copia dist/${PORTABLE_NAME}.tar.gz, descomprime y ejecuta ./install.sh"
echo "=========================================================="
