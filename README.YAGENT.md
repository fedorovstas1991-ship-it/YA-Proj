# YAgent (prototype)

This repo is a fork of OpenClaw with an in-progress, simplified product UI.

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

On macOS:

```bash
cd app/openclaw
./yagent-onboard-ui.command
```

What it does:

- Uses profile `yagent` (stored in `~/.openclaw-yagent/`), so it doesn't touch your default OpenClaw state.
- Generates a token (or uses `OPENCLAW_GATEWAY_TOKEN` if provided).
- Starts the gateway on `127.0.0.1:18789`.
- Opens the Control UI in onboarding mode with token + gatewayUrl prefilled.

Artifacts:

- Token: `~/.openclaw-yagent/gateway.token`
- PID: `~/.openclaw-yagent/gateway.pid`
- Logs: `${TMPDIR:-/tmp}/yagent/gateway.log`

Stop:

```bash
kill $(cat ~/.openclaw-yagent/gateway.pid)
```

## Notes

- This is a prototype product UI layer on top of the OpenClaw gateway.
- The upstream OpenClaw README remains at `README.md`.
