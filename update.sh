#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

echo "=== Actualizando YakChat ==="

if [ -d "$PROJECT_DIR/.git" ]; then
    echo "-> Comprobando actualizaciones en el repositorio..."
    git -C "$PROJECT_DIR" pull --ff-only 2>/dev/null || echo "   (Repositorio local al día o sin cambios remotos)"
fi

echo "-> Aplicando archivos actualizados..."
"$PROJECT_DIR/install.sh"

echo ""
echo "✅ ¡YakChat ha sido actualizado exitosamente!"
