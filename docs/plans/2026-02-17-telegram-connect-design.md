# Telegram Connect (Product UI) — Design

Date: 2026-02-17

## Summary
Add a minimal, reliable Telegram connection flow to the Product UI. The user enters a bot token and their Telegram user id; the UI patches config and binds the Telegram channel to the default agent (main session) without exposing agent terminology. Hide legacy Channels UI from navigation, and ensure the local startup script resets config/history for clean runs.

## Goals
- One-click Telegram setup from the Product UI.
- Persist to config via `config.patch`.
- Keep UX minimal and understandable for non-technical users.
- Hide legacy Channels UI from menus/links (do not delete).
- On local startup, always start from a clean profile (no stale config/history).

## Non-goals
- Full channel management UI (handled by legacy Channels).
- Multi-account Telegram setup or webhook debugging.
- Wizard/stepper flows beyond a simple form.
- Removing legacy Channels code or routes.

## User Experience
- Inputs: `Bot token`, `User id` (required).
- Help text for `User id`: why it’s required (security) and how to obtain it (e.g. @userinfobot).
- Button: “Подключить Telegram”.
- Success message: “Telegram подключен. Gateway перезапускается.”
- Errors displayed inline in the panel.
- Legacy Channels UI is hidden from menus/links.

## Data Flow
1. User fills inputs → clicks “Подключить Telegram”.
2. UI ensures `baseHash`:
   - If `configSnapshot.hash` absent, call `config.get` to retrieve hash.
3. UI sends `config.patch` with Telegram channel config and binding.
4. UI shows success/error message.
5. Gateway writes config and restarts.

## Config Patch Shape
```
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<token>",
      "dmPolicy": "allowlist",
      "allowFrom": ["<userId>"]
    }
  },
  "bindings": [
    {
      "agentId": "<defaultAgentId>",
      "match": { "channel": "telegram", "accountId": "default" }
    }
  ]
}
```

## Binding Decision
Bind to the default agent (main session) so the user never deals with agent concepts. Resolve `defaultAgentId` as `agentsList.defaultId ?? "main"`.

## Legacy UI Hiding
- Remove `channels` from legacy tab groups and dev links.
- Remove the Product UI link to legacy Channels.
- Keep routes and code intact for future use.

## Local Startup Reset
- Update `yagent-onboard-ui.command` to remove `~/.openclaw-<profile>` in addition to existing state/workspace cleanup.

## Validation & Errors
- Token missing → error “Нужен Telegram bot token.”
- User id missing → error “Нужен ваш Telegram user id (цифры).”
- Connection absent → show generic connection error.
- `config.patch` failure → show returned error.

## Testing (Manual)
1. Empty token → error shown.
2. Empty user id → error + help text visible.
3. Successful patch → success message, config updated.
4. Repeat setup → config updates with new values.
5. Run local startup script twice → config/history do not persist between runs.
6. Legacy Channels UI not visible in navigation.

## Open Questions
None.
