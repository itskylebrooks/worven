# Worven

Worven is a minimal translation web app for people who work across multiple languages every day. It combines fast word lookup and paragraph-level translation in one focused interface, so you do not need to bounce between a dictionary and a chat app to get useful results.

For single words, Worven behaves like a smart dictionary. It returns a primary translation, related alternatives, pronunciation guidance, grammar notes, and short usage examples. For sentences and paragraphs, it uses an LLM to generate a clean translation and can request an alternative phrasing on demand.

## Functionality

- Translate single words and short phrases with dictionary-style detail.
- Translate sentences and longer passages in the same interface.
- Switch translation direction between source-to-target and target-to-native workflows.
- Choose between OpenAI, Anthropic, and Gemini.
- Pick the model, target language, native language, and translation tone from Settings.
- Save translation history locally in the browser and restore previous results.
- Copy primary translations and alternative sentence renderings with one click.
- Use light, dark, or system theme modes.
- Install Worven as a Progressive Web App (PWA) with browser-specific install guidance.
- Reload the app shell offline after the first visit, while keeping live translation network-only.

## Privacy and Storage

Worven is built around local-first usage:

- There is no account system.
- There is no remote database for user data.
- API keys are provided by the user.
- API keys are encrypted in the browser when secure storage is available, using Web Crypto with an IndexedDB-backed key store.
- App settings and translation history are stored locally in browser storage.

Current implementation note:

- Translation history is currently stored in `localStorage` and can be cleared from the History panel.
- The app does not currently include a toggle to disable history entirely.

## How It Works

The UI is a React + Vite app. Translation requests are sent to a local `/api/translate` endpoint exposed by Vite middleware during development and preview. That handler forwards the request to the selected provider, normalizes the response, and returns a consistent shape to the client.

This keeps the project lightweight:

- no separate backend app
- no authentication layer
- no hosted persistence

## Tech Stack

- React 18
- TypeScript
- Vite
- Vite PWA Plugin / Workbox
- Tailwind CSS
- Lucide React
- ESLint
- Vitest
- pnpm

## Getting Started

### Requirements

- Node.js 18+ recommended
- pnpm 9+

### Install

```bash
pnpm install
```

### Start the development server

```bash
pnpm dev
```

The app will start in Vite development mode. Open the local URL shown in the terminal, then add your provider API key in the Settings panel before translating.

### Local HTTPS dev for device PWA testing

Real mobile-device install testing works best over trusted local HTTPS:

1. Install mkcert on macOS: `brew install mkcert nss`
2. Run `mkcert -install`
3. Generate project certs:

```bash
pnpm run gen:certs
```

4. Start Worven with HTTPS enabled:

```bash
pnpm run dev:https
```

For LAN/device testing, use:

```bash
pnpm run dev:https:host
```

Normal `pnpm dev` and `pnpm dev:host` stay on plain HTTP. HTTPS is opt-in so regular local development does not depend on local TLS certificates.

### Start on your local network

```bash
pnpm dev:host
```

### Build for production

```bash
pnpm build
```

### Preview the production build locally

```bash
pnpm preview
```

## Available Scripts

- `pnpm dev` runs the Vite dev server
- `pnpm dev:host` runs Vite with host exposure enabled
- `pnpm dev:https` runs the Vite dev server over HTTPS
- `pnpm dev:https:host` runs the HTTPS dev server with host exposure enabled
- `pnpm build` runs type-checking and creates a production build
- `pnpm preview` serves the production build locally
- `pnpm typecheck` runs TypeScript checks
- `pnpm lint` runs ESLint
- `pnpm lint:fix` runs ESLint with autofix
- `pnpm test` runs Vitest
- `pnpm test:watch` runs Vitest in watch mode
- `pnpm format` runs Prettier
- `pnpm ci` runs lint, typecheck, tests, and build

## Usage

1. Open Worven.
2. Go to Settings.
3. Choose a provider and model.
4. Paste your API key.
5. Select your native language, target language, and preferred tone.
6. Enter a word, sentence, or paragraph.
7. Press Enter or use the translate button.

## PWA Support

Worven ships as an installable PWA with an offline app shell. After the first successful load, the UI, settings panel, and locally stored history can reopen offline. Translation requests are still network-dependent because Worven forwards them to live LLM providers through `/api/translate`.

### Browser install notes

| Browser / platform | Install behavior |
| --- | --- |
| Chrome / Edge desktop | Native browser install prompt supported |
| Chrome / Edge Android | Native prompt usually supported once installable |
| Firefox / Opera / Samsung Internet on Android | Install from the browser menu |
| Safari on macOS 14+ | Use Share → Add to Dock |
| Safari on iPhone / iPad | Use Share → Add to Home Screen |
| Other iOS browsers | Open in Safari if Add to Home Screen is missing |
| Firefox desktop | PWA install not supported |
| Private / incognito windows | Install may be unavailable |

Open Settings and use the `Install` action to either trigger the native prompt or show the correct browser-specific guidance for your current environment.

## Project Status

Worven is open source, free to use, and built by Kyle Brooks.
