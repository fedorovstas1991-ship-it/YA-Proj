# Keychain Secrets Design (YAgent)

## Goal
Убрать plaintext токены/ключи из конфигов и локальных JSON-хранилищ, перевести систему на `OS Keychain` с `fail-closed` поведением и запретом чтения секретов агентом.

## Scope
- Полный перевод секретов из:
  - `openclaw.json` (provider `apiKey`, channel `botToken`, другие sensitive поля)
  - `auth-profiles.json` (`api_key.key`, `token.token`)
- UI/онбординг/каналы сохраняют секреты только в Keychain.
- В конфиге и сторе хранятся только ссылки: `secret://ya/<provider>/<scope>`.

## Non-goals
- Облачное хранилище секретов.
- Фоллбек на plaintext/env при недоступном Keychain.

## Security model
- Секрет никогда не записывается в конфиг после миграции.
- Агент не получает API чтения секретов.
- Разрешено только точечное чтение секрета в коде интеграции/провайдера перед сетевым вызовом.
- При недоступном Keychain: ошибка и остановка конкретной интеграции (`fail-closed`).

## SecretRef format
- Канонический формат: `secret://ya/<provider>/<scope>`
- Примеры:
  - `secret://ya/openrouter/main`
  - `secret://ya/telegram/main`
  - `secret://ya/mcp/mail/main`

## Architecture
1. `SecretStore` abstraction
- Новый модуль инфраструктуры:
  - `set(ref, value)`
  - `get(ref)`
  - `delete(ref)`
  - `has(ref)`
- Реализация macOS через `security` CLI.

2. SecretRef resolver
- Единый helper:
  - `isSecretRef(value)`
  - `resolveSecretRefOrPlain(value, opts)`
- Любое место, где сейчас читается `apiKey/token/botToken`, сначала проходит через resolver.

3. Fail-closed enforcement
- Если значение выглядит как `secret://...` и Keychain не отдал секрет -> бросаем ошибку.
- Никакого fallback на env/plaintext в этом режиме.

4. Startup migration
- На старте gateway:
  - сканируем config + auth-profile store,
  - переносим plaintext в Keychain,
  - заменяем значения на `secret://...`,
  - сохраняем очищенные файлы.
- Миграция идемпотентна.

5. Logging/redaction
- Логи не содержат секретных значений.
- В логах и UI только ref + маска (`***abcd`) при необходимости.

## Data flow (target)
1. Пользователь вводит ключ в UI.
2. Backend пишет секрет в Keychain под `secret://...`.
3. В `config/auth-profiles` пишется только `secret://...`.
4. При runtime provider/channel вызывает resolver.
5. Resolver читает Keychain и возвращает секрет только в память текущего процесса/вызова.

## Audit evidence
- grep по runtime файлам не находит ключи после миграции.
- Конфиг содержит только `secret://...`.
- При блокировке Keychain интеграция не стартует и явно пишет fail-closed ошибку.
- Набор unit/integration тестов доказывает миграцию + отсутствие plaintext записи.
