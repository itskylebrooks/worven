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
- Tailwind CSS
- Lucide React
- ESLint
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
- `pnpm build` runs type-checking and creates a production build
- `pnpm preview` serves the production build locally
- `pnpm typecheck` runs TypeScript checks
- `pnpm lint` runs ESLint
- `pnpm lint:fix` runs ESLint with autofix
- `pnpm format` runs Prettier
- `pnpm ci` runs lint, typecheck, and build

## Usage

1. Open Worven.
2. Go to Settings.
3. Choose a provider and model.
4. Paste your API key.
5. Select your native language, target language, and preferred tone.
6. Enter a word, sentence, or paragraph.
7. Press Enter or use the translate button.

## Project Status

Worven is open source, free to use, and built by Kyle Brooks.
