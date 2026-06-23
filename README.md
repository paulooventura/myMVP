# myMVP — "I GOT YOU." 🐐

Your enthusiastic assistant — **myMVP is the brain**. Web scouts (search, Wikipedia, news,
video, forums) gather intel; optional API scouts (GPT, Gemini, Claude) add depth. Desktop
**Agent mode** gets things done on your machine.

Built with **Electron + React + TypeScript**, with a **browser build** for Netlify (same pattern
as [Mind and Venture](https://github.com/paulooventura/Mind-and-Venture)).

---

## Links

| | URL |
| --- | --- |
| **Play in browser** | https://papaya-malabi-1e40d5.netlify.app |
| **GitHub** | https://github.com/paulooventura/myMVP |
| **Mind & Venture** (sibling project) | https://mind-and-venture.netlify.app |

> After you connect this repo to Netlify (see **Deploy** below), pushes to `main` update the live site automatically — just like Mind & Venture.

---

## Quick start

```bash
npm install      # installs deps + self-heals the Electron binary
npm run dev      # launches myMVP with hot reload
```

Then click the **⚙ Settings** icon and paste in scout API keys for deeper intel — **or skip them entirely**.
myMVP answers out of the box using **web scouts** (search, Wikipedia, news, video, forums). No keys required.

| Scout | Where to get a key |
| --- | --- |
| OpenAI (GPT) | https://platform.openai.com/api-keys |
| Google (Gemini) | https://aistudio.google.com/app/apikey |
| Anthropic (Claude) | https://console.anthropic.com/settings/keys |

> **Agent mode needs an OpenAI key** — GPT drives the tool-calling loop. Digest mode works
> with any single provider, but it shines when you give it 2–3.

Your keys are stored locally via `electron-store` and never leave your machine.

---

## The two modes

### 🧠 Digest mode
Ask a question. myMVP sends **data scouts** (GPT, Gemini, Claude) out in parallel to gather
intel, then **myMVP's brain** weighs it all and renders the answer — free to agree, disagree,
or combine. Scouts report; myMVP thinks.

Every answer includes a **brain vs scouts** breakdown — percentages showing how much each
scout's intel vs myMVP's own reasoning shaped the response.

Expand **"see their field intel"** under any answer to view each scout's raw report.

### 📚 Question history + live updates
myMVP **keeps a record of every question** you ask (open the **☰** sidebar). For each one it
can **watch the web in the background**, cross-analyze fresh results, filter noise, and
**notify you** when new information would change the answer — with a revised verdict and updated
influence percentages (including a **Web intel** slice).

Toggle web monitoring per question, manually hit **↻ Check web**, or configure the scan interval
in Settings.

### 🛠️ Agent mode
Give it a task. myMVP plans and executes step-by-step using real tools:

- `run_command` — run any shell command (git, npm, scripts, queries…)
- `read_file` / `write_file` — read and create files
- `list_dir` — explore folders

Every step streams into the chat so you can watch it work. It operates inside the
**Workspace folder** set in Settings (defaults to your home directory).

> ⚠️ Agent mode runs real commands on your computer. It's powerful — review what it's doing,
> especially for destructive actions.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run in development with hot reload |
| `npm run build` | Build production bundles into `out/` |
| `npm start` | Preview the production build |
| `npm run typecheck` | Type-check main + renderer |
| `npm run fix:electron` | Re-repair the Electron binary if it goes missing |

---

## Project structure

```
src/
  main/                 # Electron main process (Node)
    index.ts            # Window + IPC wiring
    config.ts           # Settings store (electron-store)
    orchestrator.ts     # Parallel fan-out + digest/synthesis
    agent.ts            # Tool-calling agent loop
    providers/          # OpenAI, Gemini, Anthropic over fetch
    tools/              # run_command, read/write/list
  preload/index.ts      # Secure bridge (window.mvp)
  renderer/             # React UI (chat, modes, settings)
  shared/types.ts       # Types shared across processes
scripts/
  ensure-electron.mjs   # Self-heals the Electron binary on install
```

---

## Deploy (GitHub + Netlify)

Same workflow as Mind & Venture:

### One-time setup

1. Create an empty repo: https://github.com/new → name it `myMVP`
2. In this folder:
   ```bash
   git remote add origin https://github.com/paulooventura/myMVP.git
   git push -u origin main
   ```
3. In [Netlify](https://app.netlify.com): **Add new site** → **Import from Git** → pick `myMVP`
   - Build command: `npm run build:web` (already in `netlify.toml`)
   - Publish directory: `dist/web`
   - Functions directory: `netlify/functions`
4. Set the site name to **mymvp** → live at **https://mymvp.netlify.app**

### Ship updates

Double-click **`DEPLOY.bat`** or:

```bash
npm run build:web
git add -A && git commit -m "your message" && git push origin main
```

Netlify rebuilds on every push to `main`.

---

## Troubleshooting

**Web app works; desktop needs API keys for GPT/Gemini/Claude scouts** — browser build uses web scouts only (server-side on Netlify).

**Electron won't launch / binary missing** — run `npm run fix:electron`, or as a last
resort `npm rebuild electron`.

**A scout pill shows a red dot** — that API key is empty or invalid. Web scouts still work.

---

## Roadmap ideas

- Streaming token-by-token responses
- More tools (web search, screenshots, app control)
- Spawn specialized sub-agents for bigger jobs
- Global hotkey to summon myMVP from anywhere
- Conversation history & saved sessions

Made with **I GOT YOU** energy. 🔥
