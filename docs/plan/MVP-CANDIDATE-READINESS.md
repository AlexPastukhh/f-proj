# D-080 — проверка состава установочного MVP-кандидата (source-only)

Дата: 2026-10-11. Статус: **аудит состава до VSIX — выполнен локально;
установочная ручная приёмка — НЕ начата**.

Этот этап не создаёт VSIX, не изменяет установленный D-065,
не повышает версию `0.1.0`, не создаёт тег и не публикует релиз.
Команды `vsce package`, `package:vsix`, `vscode:prepublish`
для упаковки и `code --install-extension` намеренно не вызываются.

## Повторяемая проверка исходников будущего пакета

1. Убедиться, что Windows checkout чист и соответствует конкретному
   SHA GitHub `main`; исходная база P4 уже прошла независимый Windows CI.
2. Выполнить `npm ci`, `npm run build`, собрать .NET worker штатным
   `npm run build:dotnet-worker` и проверить
   `npm run verify:packaged-worker`. В CI это отдельные source-компоненты,
   **не VSIX package**.
3. Выполнить `node scripts/verify-candidate-source-readiness.mjs`.
   Скрипт вызывает только `vsce ls` **с production-зависимостями**,
   не `--no-dependencies`; проверяет реальный будущий список файлов.
4. Перед разрешением установки требуется независимый GitHub Windows
   source-proof SUCCESS для того же SHA, включая D-080 inventory.

### Что проверяет список

- Основной `dist/extension.js` и compiled P4 runners/session gate,
  Vitest materializer, полный .NET runtime worker и production
  `node_modules/typescript` существуют **в будущем составе пакета**.
- `package.json` + `package-lock.json` фиксируют TypeScript 5.8.3,
  prototype `0.1.0` и `vscode:prepublish` с build/worker verification.
- В составе нет `src/`, `test/`, `fixtures/`, `scripts/`,
  `docs/`, GitHub workflow, `REPOSITORY.md`, debug `*.pdb`,
  временных артефактов или потенциально приватных файлов.
- Неизвестные пути, дубликаты и отсутствие любого обязательного
  файла приводят к **FAIL**, а не к молчаливому продолжению.

При локальном аудите до настройки исключений полный `vsce ls`
показал **386** файлов, включая лишние workflow, REPOSITORY.md
и PDB. После изменения `.vscodeignore` — **383 файла**:
215 .NET runtime, 130 TypeScript, остальное compiled extension +
manifest/readme/Vitest worker. Это **список будущего состава**, а не
фактически созданный `.vsix`. Список не гарантирует успешность
самой упаковки, запуск установленного расширения или доверие runtime.

## Условия для будущего VSIX / ordinary installed acceptance

**Требуется отдельное явное разрешение пользователя** на:
(а) создание SHA-pinned VSIX; (б) установку/замену D-065.
Релиз/тег — отдельное решение, даже если ручная проверка пройдёт.

После разрешения новый кандидат должен быть создан из одного
заведомо проверенного SHA, иметь SHA-256 для файла VSIX и пройти
проверку **реального архива** на те же runtime-файлы.
Нельзя считать `vsce ls` эквивалентом проверки ZIP/VSIX.

В установленном обычном VS Code единый короткий D-066+P4 gate:
`Developer: Reload Window`, один trusted fixture workspace,
ручной `Refresh` → `Fresh`, открыть автономный HTML из
команды `Open HTML Projection`, проверить один Situation anchor
и один VS Code source link, затем запустить один точный Frontend,
один Backend Fact и `Run Both Situation` для
`refresh_token_expired`; каждый результат должен быть Passed.
Параметризованные `LoginCase` Theory, которые нельзя разделить,
не должны запускаться как группа. Cancel проверяется
в независимых Windows реальных тестах; отдельной длинной
ручной сессии не требуется.

Любая ошибка пакета/инсталляции/ручного UI gate блокирует MVP
release decision. Нельзя считать Extension Host smoke равным
приёмке в обычном установленном VS Code.

Python/pytest и Java/JUnit: P5 contract уже документирован,
адаптеры **не реализованы**. User's localhost app DEFERRED;
не возвращаться к performance-cache research.
