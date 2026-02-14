# YandexAgetn UI (prototype)

Здесь живет прототип UI-слоя (в проекте он исторически называется `yagent`) поверх gateway.

## Current Status (2026-02-14)

Implemented:

- Product UI on `/` (default): iPhone-style layout with a left icon rail and a minimal sidebar.
- Projects = Agents (persisted) and Chats = Sessions (subagent sessions).
- No command-driven UX for core flows. Core chat actions are buttons.
- Assistant writes first:
  - New chat triggers `chat.greet`.
  - Reset triggers `chat.greet`.
  - First open of an empty chat triggers `chat.greet`.
- Attachments:
  - UI supports images + arbitrary files (picker, drag&drop, paste).
  - Gateway parses images for vision and extracts text from supported docs (pdf/text/json/etc).
  - Other files are saved in the media store and referenced in the message.
- Dev drawer:
  - Legacy tabs are only accessible from the "Для разработчиков" drawer.
  - Includes "Обновить конфиг" and "Сбросить все" actions.

Known gaps / TODO:

- Telegram setup flow is present in product UI but needs end-to-end testing (config patch triggers restart).
- More UI polish for mobile and edge cases.

## One-Click Start (UI Onboarding)

On macOS (from repo root):

```bash
./yagent-onboard-ui.command
```

What it does:

- Uses profile `yagent` (by default) and stores state under `~/.openclaw-yagent/`.
- Generates a token (or uses `OPENCLAW_GATEWAY_TOKEN` if provided).
- Starts the gateway on `127.0.0.1:18789` (configurable via env).
- Opens the UI in onboarding mode with token + gatewayUrl prefilled.

Useful env vars:

- `OPENCLAW_PROFILE` (default: `yagent`)
- `OPENCLAW_GATEWAY_PORT` (default: `18789`)
- `OPENCLAW_GATEWAY_BIND` (default: `loopback`)
- `OPENCLAW_GATEWAY_TOKEN` (optional; otherwise auto-generated)

Artifacts:

- Token: `~/.openclaw-yagent/gateway.token`
- PID: `~/.openclaw-yagent/gateway.pid`
- Logs: `${TMPDIR:-/tmp}/yagent/gateway.log`

Stop:

```bash
kill $(cat ~/.openclaw-yagent/gateway.pid)
```

## Product UI (manual onboarding)

On macOS (from repo root):

```bash
./yagent-product-ui.command
```

What it does:

- Uses profile `yagent-product` (by default) and stores state under `~/.openclaw-yagent-product/`.
- Generates a token (or uses `OPENCLAW_GATEWAY_TOKEN` if provided).
- Starts the gateway on `127.0.0.1:18789` (configurable via env).
- Opens product UI on `/` with `onboarding=1`, so you can enter the Eliza API key, create a project, and chat.

Useful env vars:

- `OPENCLAW_PROFILE` (default: `yagent-product`)
- `OPENCLAW_GATEWAY_PORT` (default: `18789`)
- `OPENCLAW_GATEWAY_BIND` (default: `loopback`)
- `OPENCLAW_GATEWAY_TOKEN` (optional; otherwise auto-generated)
- `OPENCLAW_RESET` (default: `1` to reset state; set to `0` to keep state)

Artifacts:

- Token: `~/.openclaw-yagent-product/gateway.token`
- PID: `~/.openclaw-yagent-product/gateway.pid`
- Logs: `${TMPDIR:-/tmp}/yagent/gateway-yagent-product.log`

Stop:

```bash
kill $(cat ~/.openclaw-yagent-product/gateway.pid)
```

## Docker Setup (Optional)

```bash
./yagent-docker-setup.sh
```

Host-mounted state:

- Config: `~/.openclaw-yagent-docker/`
- Workspace: `~/.openclaw-yagent-docker/workspace/`
