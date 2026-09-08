# 🎵 Muzo - Free Music Streaming Player

A modern, ad-free music streaming web application inspired by **Spotify** and **Harmony Music**. Search, browse top charts, get personalized smart recommendations based on what you listen to, create playlists, and stream virtually any song in the world for free with synchronized karaoke lyrics.

---

## 🌐 Live 24/7 Web App (No PC Required!)

Muzo is live in the cloud and accessible 24/7 on any phone, tablet, or browser:
👉 **[https://paulfucks.github.io/muzo/public/](https://paulfucks.github.io/muzo/public/)**

---

## 📥 Downloads & Releases

Get the official latest release (**v2.0.0**) for your device directly from [**GitHub Releases**](https://github.com/paulfucks/muzo/releases):

| Platform | Download | Description |
| :--- | :--- | :--- |
| **🤖 Android** | [**Muzo-2.0.0.apk**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-2.0.0.apk) | Official Muzo Android App (~1.2 MB, Signed APK) |
| **🤖 Android (Store Bundle)** | [**Muzo-2.0.0.aab**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-2.0.0.aab) | Android App Bundle (for Google Play Console) |
| **🪟 Windows PC** | [**Muzo-2.0.0.exe**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-2.0.0.exe) | Standalone Windows Player (Desktop App Mode) |
| **🪟 Windows (Portable)** | [**Muzo-2.0.0-windows-x64.zip**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-2.0.0-windows-x64.zip) | Portable Full Windows Package |
| **🐧 Linux** | [**Muzo-2.0.0.AppImage**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-2.0.0.AppImage) | Portable Linux Launcher |
| **🐧 Linux (Tarball)** | [**Muzo-2.0.0-linux-x64.tar.gz**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-2.0.0-linux-x64.tar.gz) | Complete Linux Package |
| **🔐 Verification** | [**Muzo-v2.0.0.sha256sum**](https://github.com/paulfucks/muzo/releases/download/v2.0.0/Muzo-v2.0.0.sha256sum) | SHA256 Checksums |

> **⚠️ Note on File Types:**
> - `.apk` files are for **Android devices**.
> - `.exe` files are for **Windows PCs only** (Windows executables cannot be opened on Android).
> - `.AppImage` files are for **Linux systems**.

---

## ☁️ 24/7 Always Running Cloud Setup (Free Forever)

You can run Muzo in the cloud **24/7 for free** so you and your friends can use it on your phones forever without needing your PC turned on!

👉 **Read the quick 2-minute guide: [DEPLOY_24_7.md](DEPLOY_24_7.md)**
- Deploy to **Vercel** with 1 click (free custom `https://muzo-xyz.vercel.app` URL with automatic HTTPS).
- Or run on **Render**, **Railway**, or **Docker** via `server.js`.
- Features a **Universal Client Fallback Engine**: even if deployed as pure static files (e.g. GitHub Pages), Muzo's client engine directly routes searches and suggestions so it never fails!

---

## 📱 Mobile Experience & PWA App

Muzo features a native-feeling mobile interface engineered specifically for touchscreens:

1. **Floating Mobile Mini-Player**:
   - Sits right above the bottom navigation bar.
   - Real-time glowing cyan 2px progress bar.
   - Album artwork, track title, and artist.
   - High-contrast, easy-to-touch **Like (Heart)**, **Add to Playlist (`+`)**, and **Play/Pause** buttons that are always visible!
2. **Fullscreen Mobile Now Playing Sheet**:
   - Tapping the mini-player slides up a fullscreen player.
   - High-resolution album artwork (with toggle to official video stream).
   - Interactive timeline scrubber with timestamp displays.
   - Large touch controls for Shuffle, Previous, Giant Play/Pause, Next, and Repeat.
   - Synced Lyrics and Queue shortcuts.
3. **Touchscreen-Optimized Action Buttons**:
   - All song cards, search results, trending grids, and playlist rows have permanent, easily tappable **Add to Playlist (`+`)** buttons.

### 📲 How to Install as a Native App:
* **🍏 iPhone / iPad (iOS)**:
  1. Open Muzo in **Safari**.
  2. Tap the **Share icon** at the bottom (box with an arrow pointing up).
  3. Tap **"Add to Home Screen"**.
* **🤖 Android (Chrome / Edge / Samsung Internet)**:
  1. Open Muzo in your browser.
  2. Tap the 3 dots menu and select **"Install app"** or **"Add to Home screen"**.

---

## 🌟 Core Features

- **🎧 Unlimited Free Music**: Instant access to millions of songs, albums, and artists with zero subscription fees and no ads.
- **⚡ Instant Playback (<300ms)**: Pre-warmed audio engine with unthrottled streaming.
- **⚡ Instant Search & Autocomplete**: Real-time suggestions as you type with 0ms client and server caching.
- **✨ Smart Taste Match Recommendations**: Dynamically updates recommendations based on what you play.
- **🎤 Synchronized Karaoke Lyrics**: Live lyrics powered by LRCLIB that highlight line-by-line as the music plays. Tap any lyric line to jump audio directly to that moment!
- **📚 Playlists & Library**:
  - Dedicated **Add to Playlist (`+`)** button in player bars and on every card.
  - Liked Songs favorites collection.
  - Custom user playlists (saved locally in your browser/device).
- **🎛️ Full Playback Controls**:
  - Play, Pause, Next, Previous, Shuffle, Repeat (All / One).
  - Smooth timeline scrubber with click/touch-to-seek.
  - Official Music Video / Canvas view (tap the TV icon).
- **⌨️ Lockscreen & Earbud Controls**: Full MediaSession API support for controlling playback from lock screens, notification bars, and Bluetooth headphones.

---

## 🚀 Local PC Launch

1. Double-click **`start.bat`**.
2. Your browser will open **`http://localhost:5050`**.
3. To connect phones on your local Wi-Fi, scan the QR code in the **"Phone App"** modal!
