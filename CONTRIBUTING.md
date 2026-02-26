# Contributing

## Workflow

1. Создайте ветку от `main`: `feature/<short-name>` или `fix/<short-name>`.
2. Внесите изменения маленькими атомарными коммитами.
3. Прогоните локальные проверки:
   - `pnpm build`
   - `pnpm test`
4. Откройте Pull Request в `main`.
5. После review и зелёного CI — merge через GitHub UI.

## Правила

- Прямые push в `main` запрещены.
- Force-push в `main` запрещён.
- Все изменения — только через PR.
- Для новых задач используйте GitHub Issues с шаблонами.

## Backlog

- Feedback: `docs/backlog/feedback.md`
- Bugs: `docs/backlog/bugs.md`
- Fixes: `docs/backlog/fixes.md`
