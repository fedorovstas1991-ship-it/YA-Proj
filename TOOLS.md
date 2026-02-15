# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## Mac Node (fedorov-mac-local)

- **Подключение:** launchd-сервис `ai.openclaw.node.plist` + SSH-туннель `ai.openclaw.tunnel.plist`
- **Проверить статус:** `openclaw nodes status` или `nodes action=status`
- **Если отвалилась** (на маке):
  ```
  launchctl kickstart -k gui/$UID/ai.openclaw.node
  launchctl kickstart -k gui/$UID/ai.openclaw.tunnel
  ```
- **Читать файлы через CLI:**
  ```
  openclaw nodes run --node fedorov-mac-local --security full --ask off -- ls -la /Users/fedorovstas/Documents
  openclaw nodes run --node fedorov-mac-local --security full --ask off -- cat "/path/to/file"
  ```
- **Логи:** `node.log`, `node.err.log`, `tunnel.log`, `tunnel.err.log`
- **Exec на ноду:** сменить `tools.exec.host` → `node` (сейчас `gateway`)

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
