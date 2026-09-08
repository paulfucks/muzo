# 🌐 Muzo 24/7 Free Cloud Deployment Guide

Get your own permanent **`https://muzo-music.vercel.app`** link that runs **24/7/365 for FREE forever** — so you, your friends, and family can stream songs on any phone or device without needing your PC turned on!

---

## ⚡ Option 1: Deploy to Vercel (Recommended — Takes 2 Minutes)

Vercel provides unlimited free hosting and free serverless edge functions.

### Step 1: Upload your Muzo folder to GitHub
1. Go to [github.com](https://github.com) and log in (or create a free account).
2. Click **New Repository** (give it a name like `muzo` or `muzo-music`), keep it Public or Private, and click **Create repository**.
3. Upload the files from this folder:
   - Either drag and drop the folder files into GitHub's **"uploading an existing file"** page.
   - Or in terminal / PowerShell:
     ```bash
     git init
     git add .
     git commit -m "Muzo 2.0 Music App"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/muzo.git
     git push -u origin main
     ```

### Step 2: Connect to Vercel (1 Click)
1. Go to [vercel.com](https://vercel.com) and click **Sign Up** (Sign in with your GitHub account).
2. On your Vercel dashboard, click **"Add New..."** -> **"Project"**.
3. Select your `muzo` GitHub repository and click **Import**.
4. Leave all settings at their default values (Vercel automatically detects `vercel.json` and the `api/` folder).
5. Click **Deploy**!

🎉 **Done!** Within 20 seconds, Vercel will give you a live URL like:
👉 **`https://muzo-xxxx.vercel.app`**

---

## 📱 How to Install Muzo as a Native Mobile App

Once your Vercel link is live:

### 🍏 On iPhone / iPad (iOS):
1. Open your link (`https://muzo-xxxx.vercel.app`) in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up at the bottom).
3. Scroll down and tap **"Add to Home Screen"**.
4. Muzo will now appear on your home screen with the custom aqua badge icon — opening it gives you a full-screen, native app experience with background lock-screen audio!

### 🤖 On Android (Samsung, Pixel, OnePlus, Xiaomi, etc.):
1. Open your link in **Google Chrome**.
2. Tap the **3 vertical dots** (top-right menu).
3. Tap **"Install app"** or **"Add to Home screen"**.
4. Muzo installs as a native Android app with full media notification controls!

---

## 🚀 Option 2: Deploy to Render (Free Web Service)

If you prefer Render:
1. Go to [render.com](https://render.com) and sign up for free.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set:
   - **Runtime**: `Node`
   - **Build Command**: *(leave blank)*
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
5. Click **Create Web Service**.
6. Render gives you an `https://muzo.onrender.com` link running 24/7!

---

## 🛡️ Universal Zero-Server Fallback Mode

Muzo is engineered with a 3-layer architecture:
1. **Local Mode**: Runs on your Windows PC via `start.bat` for offline / home Wi-Fi listening.
2. **Cloud Serverless Mode**: Deployed on Vercel / Render for worldwide 24/7 streaming.
3. **Universal Client Fallback**: Even if any server goes down or if hosted on static hosting (like GitHub Pages), Muzo's client-side fallback engine automatically routes search queries through open Invidious mirrors and Google Suggest JSONP so **playback and search never stop working**.
