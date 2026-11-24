# YakChat para CachyOS / Arch Linux 🚀📞

Cliente comunitario **independiente** y de código abierto para usar **WhatsApp Web** en **CachyOS / Arch Linux**, diseñado para ofrecer integración nativa con **KDE Plasma 6**, **Wayland**, **PipeWire**, aceleración por hardware, apertura directa de enlaces `api.whatsapp.com`, `wa.me` y `whatsapp://`, y soporte de **llamadas de voz y videollamadas WebRTC**.

> [!IMPORTANT]
> **Disclaimer / Aviso Legal**:
> * **EN**: YakChat is an **unofficial**, independent open-source community desktop wrapper for WhatsApp Web on Linux. It is **not affiliated with, authorized, maintained, sponsored, or endorsed by WhatsApp LLC, Meta Platforms, Inc.**, or any of their affiliates. "WhatsApp" is a registered trademark of WhatsApp LLC.
> * **ES**: YakChat es un contenedor comunitario **no oficial** e independiente de código abierto para usar WhatsApp Web en Linux. **No está afiliado, autorizado, mantenido, patrocinado ni respaldado por WhatsApp LLC ni Meta Platforms, Inc.** "WhatsApp" es una marca registrada de WhatsApp LLC.

![YakChat Icon](assets/icon-128.png)

---

## ✨ Características Principales

- 🔗 **Apertura Nativa de Enlaces y Deep-Links (`Ctrl + L`)**:
  - Resuelve y abre directamente dentro de la app enlaces cortos de empresa (`https://api.whatsapp.com/message/...`, `https://wa.me/message/...`), enlaces directos (`api.whatsapp.com/send`, `wa.me/<número>`), invitaciones a grupos (`chat.whatsapp.com/...`) y URIs `whatsapp://...`.
  - Registra automáticamente el protocolo `x-scheme-handler/whatsapp` para abrir enlaces desde Firefox, Chrome o cualquier aplicación del sistema.
  - Incluye el diálogo rápido **Abrir enlace o teléfono... (`Ctrl + L`)** con detección automática del portapapeles.
- 📞 **Llamadas y Videollamadas WebRTC**:
  - Configuración de cabeceras de escritorio compatibles con WebRTC para habilitar llamadas de voz y video en WhatsApp Web.
  - Permisos de micrófono, cámara y dispositivos de audio restringidos exclusivamente a dominios de servicio autorizados.
  - Alertas de escritorio y parpadeo de ventana (`flashFrame`) en llamadas entrantes incluso con la ventana minimizada.
- 🖥️ **Soporte Nativo de Wayland y Pantalla Compartida**:
  - Integración con PipeWire (`WebRTCPipeWireCapturer`) para compartir pantalla durante videollamadas mediante el portal nativo de KDE Plasma (`xdg-desktop-portal-kde`).
  - Renderizado nativo en Wayland (`--ozone-platform-hint=auto`) y decoraciones de ventana nativas.
- ⚡ **Aceleración por Hardware en CachyOS**:
  - Decodificación y codificación de video por hardware (`VaapiVideoDecoder`, `VaapiVideoEncoder`) para videollamadas en alta definición con mínimo uso de CPU.
- 🔔 **Notificaciones Nativas de KDE Plasma y Bandeja del Sistema**:
  - Integración directa con `org.freedesktop.Notifications` (`yakchat.desktop`) mostrando la foto de perfil del contacto en el popup de KDE Plasma.
  - Al hacer clic en una notificación de Plasma, restaura la ventana (incluso si estaba oculta en la bandeja) y abre directamente el chat del remitente.
  - Icono dinámico en la bandeja con indicador rojo y contador de mensajes no leídos.
  - Menú contextual: silenciar notificaciones, recargar, iniciar minimizado, cerrar a la bandeja, etc.
- ✍️ **Corrector Ortográfico y Autocorrector en Español (`Alt + O`)**:
  - Corrector ortográfico nativo con sugerencias en el menú contextual (clic derecho), diccionario personal y soporte para variantes (`es-ES`, `es-419`, `es-MX`, `es-AR`, multilingüe, inglés y portugués).
  - Autocorrector inteligente en vivo al escribir con reversión instantánea al pulsar `Backspace`.
- 🌐 **Tradutor Rápido Integrado (ES • PT-BR • EN)**:
  - Integración nativa de **Tradutor Rápido para Inputs** con soporte multimotor y respaldo automático MyMemory.
  - **Al escribir (`Alt + T`)**: Píldora flotante `🌐 ES ➔ PT ⇄ ⚙️ Alt+T` sobre la barra de mensaje que traduce instantáneamente lo que escribes preservando saltos de línea, listas y párrafos.
  - **Al leer (Modo Lectura)**: Selecciona cualquier mensaje recibido con el ratón para abrir la tarjeta flotante arrastrable y traducirlo en 1 clic a **🇪🇸 Español**, **🇧🇷 Portugués (BR)** o **🇺🇸 Inglés**.
  - **Panel de Configuración y Prueba en Vivo (`Alt + Shift + T`)**: Selector de idiomas, pares rápidos y área de pruebas accesible desde el botón `⚙️` de la píldora o desde el menú **Traductor 🌐**.
- 🛡️ **Ejecución en Segundo Plano sin Cortes**:
  - `backgroundThrottling: false`: las llamadas y la recepción de mensajes nunca se congelan ni se desconectan cuando la ventana está minimizada o en la bandeja del sistema.
- ⚙️ **Flags Personalizables y Persistencia**:
  - Soporte para argumentos personalizados en `~/.config/yakchat-flags.conf`.
  - Guarda tamaño/posición de ventana, zoom, tema (`system`, `dark`, `light`) y preferencias en `~/.config/YakChat/config.json`.

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
| :--- | :--- |
| **`Ctrl + L`** | **Abrir enlace (`api.whatsapp.com`, `wa.me`, `whatsapp://`) o número de teléfono** |
| **`Alt + T`** | **Traducir mensaje escrito en el cuadro de chat (o texto seleccionado)** |
| **`Alt + Shift + T`** | **Abrir panel de configuración y prueba en vivo de Tradutor Rápido** |
| **`Alt + O`** | **Activar / desactivar el autocorrector en español** |
| **`Alt + Shift + O`** | **Probar autocorrección en vivo** |
| **`Ctrl + N`** | Nuevo chat / Buscar contacto |
| **`Ctrl + W`** | Ocultar / Cerrar a la bandeja del sistema |
| **`Ctrl + Q`** | Salir completamente de la aplicación |
| **`Ctrl + R` / `F5`** | Recargar |
| **`Ctrl + Shift + R`** | Forzar recarga ignorando caché |
| **`Ctrl + +` / `Ctrl + -`** | Aumentar / Reducir zoom |
| **`Ctrl + 0`** | Restablecer zoom |
| **`F11`** | Pantalla completa |
| **`Ctrl + Shift + I`** | Herramientas de desarrollador (DevTools) |

---

## 📦 Instalación y Uso

### 1. Instalación Directa con Pacman (Recomendada para CachyOS / Arch)

Puedes instalar el paquete compilado directamente con un solo comando sin necesidad de compilar:

```bash
sudo pacman -U https://github.com/gityakjob/yakchat/releases/download/v1.1.0/yakchat-1.1.0-1-any.pkg.tar.zst
```

### 2. Instalación desde AUR (cuando esté disponible)

```bash
paru -S yakchat
```

### 3. Instalación Rápida Local (sin permisos de administrador)

Clona el repositorio y ejecuta:

```bash
git clone https://github.com/gityakjob/yakchat.git
cd yakchat
./install.sh
```

### 4. Construcción e Instalación como Paquete de Sistema (PKGBUILD)

```bash
makepkg -si
```

---

## 🚀 Cómo Iniciar la Aplicación

- **Desde el Menú de Aplicaciones de KDE Plasma / KRunner (`Alt + Espacio`)**: Busca **YakChat**.
- **Desde la terminal**:
  ```bash
  yakchat
  ```
- **Abrir directamente un enlace de chat desde la terminal**:
  ```bash
  yakchat "https://api.whatsapp.com/message/TLLRBF3QVSEXC1?autoload=1&app_absent=0"
  ```
- **Iniciar minimizado en la bandeja del sistema**:
  ```bash
  yakchat --start-minimized
  ```

---

## 🛠️ Scripts de Gestión y Empaquetado

- **`./install.sh`**: Instala la aplicación, iconos, acceso `.desktop` y registra `x-scheme-handler/whatsapp` en el perfil del usuario (`~/.local`).
- **`./update.sh`**: Descarga los últimos cambios del repositorio y actualiza la instalación local.
- **`./export.sh`**: Construye en `dist/` el paquete nativo de Pacman (`.pkg.tar.zst`) y el archivo portable (`.tar.gz`).
- **`./publish-aur.sh`**: Asistente automatizado para publicar el `PKGBUILD` y `.SRCINFO` directamente en el AUR (`ssh://aur@aur.archlinux.org/yakchat.git`).
- **`./uninstall.sh`**: Elimina limpiamente la instalación local.

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo [`LICENSE`](LICENSE) para más detalles.
