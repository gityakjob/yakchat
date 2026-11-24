# Maintainer: gityakjob <https://github.com/gityakjob>
pkgname=yakchat
pkgver=1.1.0
pkgrel=1
pkgdesc="Independent open-source Linux desktop client for WhatsApp Web (CachyOS / Arch Linux) with WebRTC calls, deep-link support, and KDE Plasma integration"
arch=('any')
url="https://github.com/gityakjob/yakchat"
license=('MIT')
depends=('electron38')
optdepends=(
    'pipewire: screen sharing and audio routing under Wayland'
    'xdg-desktop-portal-kde: screen sharing picker on KDE Plasma'
    'libnotify: desktop notifications'
)
provides=('yakchat')
conflicts=('yakchat')

package() {
    local _base="$startdir"
    if [ -d "$srcdir/${pkgname}-${pkgver}/app" ]; then
        _base="$srcdir/${pkgname}-${pkgver}"
    fi

    install -d "$pkgdir/usr/share/yakchat"
    cp -r "$_base/app" "$pkgdir/usr/share/yakchat/"
    cp -r "$_base/assets" "$pkgdir/usr/share/yakchat/"
    cp "$_base/package.json" "$pkgdir/usr/share/yakchat/"

    install -Dm755 "$_base/bin/yakchat" "$pkgdir/usr/bin/yakchat"
    install -Dm644 "$_base/yakchat.desktop" "$pkgdir/usr/share/applications/yakchat.desktop"
    install -Dm644 "$_base/assets/icon.png" "$pkgdir/usr/share/pixmaps/yakchat.png"
    install -Dm644 "$_base/LICENSE" "$pkgdir/usr/share/licenses/${pkgname}/LICENSE"

    for size in 16 24 32 48 64 128 256 512; do
        if [ -f "$_base/assets/icons/${size}x${size}.png" ]; then
            install -Dm644 "$_base/assets/icons/${size}x${size}.png" \
                "$pkgdir/usr/share/icons/hicolor/${size}x${size}/apps/yakchat.png"
        fi
    done
    install -Dm644 "$_base/assets/icon.svg" "$pkgdir/usr/share/icons/hicolor/scalable/apps/yakchat.svg"
}
