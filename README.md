# YandexAgetn

Личный проект на базе snapshot-кода OpenClaw: multi-channel AI gateway + UI-слой.

Пока это ранняя стадия: часть внутренних имен и CLI в кодовой базе по-прежнему называются `openclaw`. Это временно и не означает связь с апстримом.

UI-прототип и быстрый запуск онбординга: `README.YAGENT.md`.

## Быстрый старт (локально)

Требования:

- Node.js `>= 22`
- `pnpm` (см. `packageManager` в `package.json`)

```bash
pnpm install
pnpm ui:dev
pnpm dev
```

## macOS: UI Onboarding (one-click)

```bash
./yagent-onboard-ui.command
```

## Происхождение и лицензия

Исходная кодовая база была импортирована из OpenClaw (MIT). Детали и атрибуция: `ATTRIBUTION.md`.

