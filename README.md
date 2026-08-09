# Worven

Worven is a React + Vite translation app for bilingual and multilingual day-to-day work. It combines quick word lookup and longer-form passage translation in one interface, then adds learner-focused details for single-word lookups such as pronunciation, related words, antonyms, example usage, noun cases, and verb conjugation tables.

The app runs as a client-side web UI with one shared translation endpoint, `/api/translate`, used in local development, Vite preview, and Vercel deployments.

## What The App Does

### Translation modes

Worven auto-classifies the input:

- `word` mode for a single word or very short phrase
- `sentence` mode for longer text, punctuation-heavy input, or multiline input

### Word mode

Word lookups return:

- a primary translation
- 3 related words with short glosses
- 0 to 3 antonyms when applicable
- pronunciation guidance
- a short etymology note
- 3 short source/target usage examples
- noun-case tables when useful for the language
- a basic present-tense verb conjugation table when the item is a verb

If the word is a verb and the initial lookup only returns basic coverage, the UI can request a full conjugation expansion. Full expansions are grouped into `past`, `present`, and `future`, and each tense bucket can contain multiple tables.

### Sentence mode

Sentence and passage translations return:

- the main translation
- optional alternative renderings on demand

Alternative renderings are requested separately and appended to the current result/history entry instead of replacing the original translation.

### Direction modes

Worven supports two translation directions:

- `source_to_target`: translate from the typed source text into the selected target language
- `target_to_native`: treat the selected target language as the language being learned and translate back into the user’s native language

The direction switch affects the prompts sent to providers so pronunciation, related words, conjugations, and noun cases stay anchored to the foreign-language term being learned.

## Settings And UX

The current UI includes:

- provider selection
- model selection per provider
- API key input for client-key providers
- native language selection
- target language selection
- translation context selection
- theme selection: `system`, `light`, `dark`
- install/share actions in Settings
- translation history panel with restore/delete/clear actions
- copy buttons for primary translations and sentence alternatives
- keyboard shortcuts:
  - `Enter` submits from the input textarea
  - `Shift+Enter` inserts a newline
  - `Escape` clears the current input/output

Default settings for a fresh install:

- provider: `groq`
- model: `llama-3.3-70b-versatile`
- native language: `English`
- target language: `German`
- translation context: `General`
- theme: `system`

## Supported Languages

The current language list is:

- English
- Russian
- German
- French
- Spanish
- Italian
- Portuguese
- Polish
- Turkish
- Arabic
- Chinese (Simplified)
- Japanese
- Korean
- Ukrainian
- Dutch

## Translation Contexts

The translation-style presets are:

- General
- Formal
- Legal
- Medical
- Technical
- Casual
- Literary

These context values are injected into the prompt sent to the selected model.

## Providers And Models

Worven currently supports 4 providers:

- Groq
- OpenAI
- Anthropic
- Gemini

Current allowed models by provider:

- Groq: `llama-3.3-70b-versatile`, `openai/gpt-oss-20b`, `qwen/qwen3-32b`
- OpenAI: `gpt-5.4-mini`, `gpt-5.4-nano`
- Anthropic: `claude-sonnet-4-6`, `claude-haiku-4-5`
- Gemini: `gemini-2.5-flash`, `gemini-2.5-pro`

Provider behavior:

- Groq uses a server-side `GROQ_API_KEY`
- OpenAI, Anthropic, and Gemini use user-supplied keys from Settings
- the server validates both provider IDs and models before making upstream calls

## Privacy And Local Storage

Worven is local-first:

- there is no account system
- there is no remote user database
- settings are stored in browser storage
- translation history is stored in `localStorage`
- history is capped at 40 items
- client-provider API keys are encrypted with Web Crypto when the browser supports IndexedDB + `crypto.subtle`
- the Groq key is never persisted in the browser

Implementation details:

- encrypted keys use AES-GCM
- the encryption key is stored in IndexedDB
- if secure storage fails, Worven falls back to saving blank client keys rather than storing the Groq key
- history restore also restores the saved provider, model, direction mode, languages, and translation context

## API And Runtime Behavior

All translation requests go through `POST /api/translate`.

That endpoint:

- runs through Vite middleware in development and preview
- runs through [`api/translate.ts`](./api/translate.ts) on Vercel
- forwards requests to the selected provider
- builds structured prompts and JSON schemas server-side
- normalizes provider responses into one consistent response shape
- rejects unsupported providers/models before any upstream call

Current request handling details:

- `OPTIONS` is supported
- non-`POST` methods return `405`
- browser requests are restricted to the app's own origin
- request bodies are limited to 64 KiB and upstream calls time out after 30 seconds
- Groq requests are limited to 5,000 characters of source text
- Groq requests are rate-limited to 20 requests per 5 minutes per IP
- local development uses a bounded in-memory limiter; Vercel uses its distributed Firewall

## PWA Support

Worven ships as an installable PWA using `vite-plugin-pwa` and Workbox.

Current behavior:

- the app shell can reopen offline after the first successful load
- static assets are cached for offline reuse
- `/api/*` is excluded from navigation fallback
- live translation still requires network access because provider requests are not cached
- the service worker is registered immediately
- Worven periodically checks for service-worker updates

Install behavior in the app:

- Chromium browsers use the deferred native install prompt when available
- iPhone/iPad show Safari “Add to Home Screen” guidance
- Safari on macOS shows “Add to Dock” guidance
- Firefox/Opera/Samsung Internet on Android fall back to manual install guidance
- Firefox desktop is treated as unsupported for PWA install

For real device install testing, local HTTPS is supported through `mkcert`.

## Tech Stack

- React 18
- TypeScript
- Vite 7
- Tailwind CSS
- Lucide React
- Workbox / `vite-plugin-pwa`
- Vitest + Testing Library
- ESLint
- pnpm

## Getting Started

### Requirements

- Node.js 18+
- pnpm 9+

### Install dependencies

```bash
pnpm install
```

### Configure environment variables

Create a local env file:

```bash
cp .env.example .env.local
```

Set:

```bash
GROQ_API_KEY=your-groq-key
```

`GROQ_API_KEY` must stay server-side. Do not prefix it with `VITE_`.

For production on Vercel, create and publish a Firewall rule whose condition is
`@vercel/firewall`, whose rate-limit ID is `worven-groq-translate`, and whose limit is 20
requests per 5 minutes. Production Groq requests fail closed if that rule is missing or the
Firewall check is unavailable.

If the project is linked to Vercel, you can also pull development env vars with:

```bash
vercel env pull .env.local
```

### Run the app

```bash
pnpm dev
```

### Run on your local network

```bash
pnpm dev:host
```

### Run local HTTPS

1. Install mkcert on macOS: `brew install mkcert nss`
2. Run `mkcert -install`
3. Generate local certs:

```bash
pnpm run gen:certs
```

4. Start the HTTPS dev server:

```bash
pnpm run dev:https
```

For LAN/device testing over HTTPS:

```bash
pnpm run dev:https:host
```

If `WORVEN_DEV_HTTPS=true` is set but the cert files are missing, the Vite config throws and tells you to run `pnpm run gen:certs`.

## Build, Preview, And Quality Checks

Build the app:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

Run checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm ci
```

## Available Scripts

- `pnpm dev`: start the Vite dev server
- `pnpm dev:host`: start Vite with host exposure enabled
- `pnpm dev:https`: start Vite over HTTPS
- `pnpm dev:https:host`: start HTTPS Vite with host exposure enabled
- `pnpm gen:certs`: generate local TLS certs with `mkcert`
- `pnpm build`: run type checks and build for production
- `pnpm preview`: preview the production build locally
- `pnpm typecheck`: run app, node, and API TypeScript checks
- `pnpm lint`: run ESLint
- `pnpm lint:fix`: run ESLint with autofix
- `pnpm test`: run Vitest once
- `pnpm test:watch`: run Vitest in watch mode
- `pnpm format`: run Prettier
- `pnpm ci`: run lint, typecheck, tests, and production build

## Project Structure

- [`src/App.tsx`](./src/App.tsx): UI composition and view-only interaction state
- [`src/components`](./src/components): UI panels and modal components
- [`src/hooks/useTranslationController.ts`](./src/hooks/useTranslationController.ts): cancellable translation workflow and operation state
- [`src/hooks/useAppSettings.ts`](./src/hooks/useAppSettings.ts): settings hydration, persistence, and theme synchronization
- [`src/hooks/useTranslationHistory.ts`](./src/hooks/useTranslationHistory.ts): history state and persistence coordination
- [`src/lib/prompts.ts`](./src/lib/prompts.ts): prompt and JSON-schema generation
- [`src/lib/provider-config.ts`](./src/lib/provider-config.ts): provider/model allowlists
- [`src/lib/settings.ts`](./src/lib/settings.ts): settings defaults, migration, persistence, theme resolution
- [`src/lib/history.ts`](./src/lib/history.ts): history persistence and legacy-data normalization
- [`src/lib/secure-storage.ts`](./src/lib/secure-storage.ts): encrypted browser storage for client API keys
- [`src/server/translate-api.ts`](./src/server/translate-api.ts): shared HTTP handler used by dev, preview, and Vercel
- [`src/server/providers`](./src/server/providers): isolated upstream-provider adapters and error mapping
- [`src/server/normalize-result.ts`](./src/server/normalize-result.ts): provider-response normalization
- [`api/translate.ts`](./api/translate.ts): Vercel entry point

## Current Limitations

- translation still depends on live upstream provider APIs
- history cannot currently be disabled from the UI
- only the models listed above are accepted
- the target/native language list is fixed in code
- there is no authentication or sync across browsers/devices

## Status

This repo is currently configured as a private package (`"private": true` in `package.json`).
