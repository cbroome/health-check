# Health Check

A Tauri + SvelteKit app that monitors a list of URLs and alerts you when they go down.

## What it does

- Add a list of URLs via the UI.
- Polls each URL at a global interval (default: every **2 hours**).
- Checks whether the site is reachable and returning a healthy status (2xx).
- Shows live OK / DOWN / PENDING status for each URL.
- Sends desktop notifications when a site goes down or comes back up.
- Checks immediately on app startup.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri system dependencies for your platform (macOS: Xcode CLI tools, Linux: webkit2gtk, etc.)

## Install

```bash
git clone <your-repo-url> health-check
cd health-check
```

## Development

```bash
# install dependencies
npm install

# run frontend dev server (Vite)
npm run dev

# run the full Tauri app (dev)
npm run tauri dev

# build the frontend production bundle
npm run build

# build the Tauri desktop app (release)
npm run tauri build
```

## Testing

```bash
# run unit tests
npx vitest run
```

## Configuration

- Add URLs via the input field in the app UI.
- Change the global check interval via the minutes input (default `120`).
- Notifications require OS notification permission; the app requests it on first use.

## Notes

- The app polls only while the desktop window is open.
- Health checks use the Tauri HTTP plugin to perform fetches from the backend.