# Google Apps Script Fullstack Development Environment

A modern, containerized full-stack development environment for **Google Apps Script (GAS)**, featuring:
- **Base OS**: Ubuntu 24.04 LTS
- **UI Framework**: React 18 + Tailwind CSS
- **Bundler**: Vite + `vite-plugin-singlefile` (compiles frontend into a self-contained HTML for GAS `HtmlService`)
- **Backend**: TypeScript compiled to GAS V8 runtime (`Code.js` / `Code.gs`)
- **CLI Tools**:
  - `clasp` (`@google/clasp` for GAS project management & deployment)
  - `agy` (Google Antigravity AI coding assistant CLI)
  - `glow` (Charm's CLI markdown viewer)
  - `tmux` & `vim` (terminal multiplexing & editor pre-configured)
  - `git`, `curl`, `jq`, `fzf`, `ripgrep`, `build-essential`

---

## 🚀 Quick Start: Running with Devcontainer from npm

You can launch and connect to this container using the official Devcontainer CLI from npm:

### 1. Install Devcontainer CLI (if not already installed)
```bash
npm install -g @devcontainers/cli
```

### 2. Start the Devcontainer
From the project root:
```bash
npx @devcontainers/cli up --workspace-folder .
```

### 3. Open a Shell inside the Container
```bash
npx @devcontainers/cli exec --workspace-folder . /bin/bash
```

### 4. Exposing Vite Port via `socat` (WSL2 / Headless CLI Environments)
When running the devcontainer via CLI inside **WSL2** or a headless terminal (without VS Code's automatic port forwarding UI), you can expose the Vite development server (`port 5173`) to your host machine's browser using `socat`:

```bash
# 1. Install socat on the WSL2 host (if not already installed):
sudo apt-get install -y socat

# 2. Forward traffic from localhost:5173 into the running devcontainer IP:
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker ps -lq))
socat TCP-LISTEN:5173,fork,reuseaddr TCP:$CONTAINER_IP:5173
```

Or run as a one-liner in the background:
```bash
socat TCP-LISTEN:5173,fork,reuseaddr TCP:$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker ps -lq)):5173 &
```

Now navigate to **`http://localhost:5173`** in your host browser (e.g. Windows Chrome/Edge/Firefox) to access the live app!

> **Alternatively in VS Code / Cursor / Windsurf**:
> Open this directory and click **"Reopen in Container"** when prompted, or run `Dev Containers: Reopen in Container` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`). Port forwarding happens automatically.

---

## 🛠 Included CLI Tools & Workflow

Inside the container, all tools are ready in your `$PATH`:

| Tool | Description | Example Command |
|---|---|---|
| **`clasp`** | Google Apps Script CLI | `clasp login`, `clasp push`, `clasp open` |
| **`agy`** | Antigravity AI Assistant | `agy`, `agy -p "write a GAS trigger"` |
| **`glow`** / `md` | Terminal Markdown Viewer | `glow README.md` or `md README.md` |
| **`tmux`** | Terminal Multiplexer | `tmux new -s dev` |
| **`vim`** | Text Editor | `vim src/server/Code.ts` |
| **`node` / `npm`**| Node 22 LTS | `node -v`, `npm test` |

---

## 💻 Development Workflow

### 1. Local Development (Fast HMR + Mock GAS Server)
Run Vite locally to develop the React + Tailwind UI with instant hot module replacement:
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser. 
- Calls to `callGas()` automatically detect local development and return mock server data.

### 2. Connect to Your Google Apps Script Project
Log in to your Google account with clasp:
```bash
clasp login
```
*(Your login token is automatically persisted in `~/.clasprc.json` and mounted into the container).*

Then either create a new Apps Script project or clone an existing one:
```bash
# Create a new standalone web app or sheet add-on:
clasp create --type webapp --title "My React GAS App" --rootDir ./dist

# OR link to an existing script ID:
cp .clasp.json.example .clasp.json
# Edit .clasp.json and set "scriptId": "YOUR_SCRIPT_ID"
```

### 3. Build & Deploy
Compile both the frontend (React + Tailwind into single-file `dist/index.html`) and backend (TypeScript to `dist/Code.js`), then push to Google Apps Script:
```bash
npm run deploy
```

Open the project directly in the Google Apps Script Web Editor:
```bash
npm run open
```

---

## 📁 Project Structure

```
.
├── .devcontainer/
│   ├── Dockerfile             # Ubuntu 24.04 with clasp, agy, glow, tmux, vim, node 22
│   └── devcontainer.json      # Devcontainer port forwarding, mounts, and VS Code extensions
├── src/
│   ├── client/                # React + Tailwind Frontend
│   │   ├── index.html         # Entry HTML
│   │   ├── main.tsx           # React Root
│   │   ├── App.tsx            # Interactive Dashboard & GAS Bridge UI
│   │   ├── index.css          # Tailwind CSS definitions
│   │   ├── utils/gas.ts       # Promise-based google.script.run wrapper with mock mode
│   │   └── types/google.d.ts  # Typings for google.script.run
│   └── server/                # Google Apps Script V8 Backend
│       ├── Code.ts            # WebApp (doGet), menus (onOpen), and RPC functions
│       └── types.ts           # Data interfaces
├── scripts/
│   └── copy-manifest.js       # Copies appsscript.json to dist/ during build
├── appsscript.json            # Apps Script manifest (V8 runtime enabled)
├── .claspignore               # Excludes raw source files; only sends dist/
├── tailwind.config.js         # Tailwind configuration
├── vite.config.ts             # Bundles client with vite-plugin-singlefile
├── tsconfig.json              # Client TypeScript config
└── tsconfig.server.json       # GAS V8 Server TypeScript config
```

---

## 🔑 Authentication Persistence

The `devcontainer.json` includes bind mounts for:
- `~/.clasprc.json` (clasp Google credentials)
- `~/.gemini` (Antigravity settings and sessions)
- `~/.gitconfig` and `~/.ssh` (Git credentials)

Your credentials persist automatically across container restarts and rebuilds.
