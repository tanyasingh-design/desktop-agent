# 🐾 Ash Companion

> **Ash** is a procedural pixel-art desktop companion built with Electron, Vite, React, and TypeScript. Ash lives transparently on your desktop, tracks your daily goal and tasks, reminds you to hydrate and rest your eyes, plays ambient nature sounds, and guides 4-phase breathing meditation sessions.

---

## ✨ Features

- **Procedural Pixel Wolf (Ash)**:
  - Real-time low-res canvas sprite (`68×58` grid) with crisp 1px silhouette outliner and 7 animated states (`idle`, `walk`, `fly`, `sleep`, `remind`, `angry`, `sad`).
  - Calm horizontal floor walks, automatic undisturbed sleep, and diagonal flight to the opposite top corner when typing.
- **3-Step First-Run Onboarding**:
  - Asks for your name, preferred focus/wellness rhythm (*Balanced*, *Deep Focus*, *Gentle*), and Ash's size & typing-avoidance preference.
  - Can be re-run anytime from **Settings → Run Setup**.
- **Goals, Tasks & Pomodoro (`Ash` Panel)**:
  - **Goals (`WHAT'S THE PLAN?`)**: Focus on one main daily goal with edit/remove and previous goals history.
  - **Tasks (`TASKS`)**: Schedule tasks for `Today` or `Later` with per-task reminder timers (`20m`–`60m`) and neglect escalation (`remind` → `angry` → `sad`).
  - **Pomodoro (`25:00`)**: Built-in focus & break timer with session tracking.
- **Water, Eye Rest & Breathing Meditation**:
  - Configurable hydration and eye/screen rest reminders.
  - Full-screen 4-phase box-breathing overlay (`BREATHE IN → HOLD → BREATHE OUT → HOLD`) with an animated pixel wolf avatar, hold-to-leave button, and 5 ambient nature tracks (*Heavy Rain*, *Rain*, *Beach Waves*, *Nightingale*, *Ocean*).

---

## 🚀 How Anyone Can Install & Run Ash

### Option 1: Run From Source (Developers / Contributors)

#### Prerequisites
- [Node.js](https://nodejs.org/) **v18.0 or higher** (v20+ recommended)
- `npm` (included with Node.js) and `git`

#### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/tanyasingh-design/desktop-agent.git
   cd desktop-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   *(Or build and preview the production bundle with `npm run build` followed by `npm start`.)*

---

### Option 2: Build a Standalone Desktop Installer (`.exe` / `.dmg` / `AppImage`)

Anyone can build a double-clickable installer for their OS using `electron-builder`:

1. **Build the production bundles**:
   ```bash
   npm run build
   ```
2. **Package for your OS**:
   - **Windows (`.exe` NSIS installer)**:
     ```bash
     npm run package:win
     ```
   - **macOS (`.dmg` & `.zip`)**:
     ```bash
     npm run package:mac
     ```
   - **Linux (`AppImage`)**:
     ```bash
     npx electron-builder --linux
     ```
3. Find the generated installer inside the `dist/` folder and run it. On first launch, Ash will greet you with the 3-step onboarding setup.

---

## 📜 Available Scripts

- `npm run dev` — Start Electron + Vite in development mode.
- `npm run build` — Build `main`, `preload`, and `renderer` bundles into `out/`.
- `npm start` — Preview the built production app.
- `npm run typecheck` — Run TypeScript type checking (`tsconfig.node.json` & `tsconfig.web.json`).
- `npm run package:win` — Build Windows installer in `dist/`.
- `npm run package:mac` — Build macOS `.dmg` in `dist/`.

---

## 📄 License

MIT License — see [package.json](package.json) for details.
