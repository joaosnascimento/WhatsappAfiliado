# Production Audit

## Scope
Audit of the existing production codebase, with priority on P0/P1 reliability, state consistency, publication idempotency and the known Evolution group-listing failure.

## Findings and root causes

### P0 — Evolution group discovery
- **Problem:** group discovery could fail with Evolution's `getParticipants needs to be informed in the query`.
- **Root cause:** the project needed one canonical request builder so every caller uses the required query parameter. The service now constructs exactly one canonical URL with `getParticipants=true` and has timeout/error classification.
- **Fix:** centralized URL construction in `WhatsAppGroupService`; no fallback request without the parameter.
- **Regression:** `src/test/production-regressions.test.ts`.

### P0 — publication state race
- **Problem:** a worker could process a publication after another process had already completed/cancelled it.
- **Root cause:** worker changed state without an atomic claim.
- **Fix:** PostgreSQL atomic claim `QUEUED/SCHEDULED/RETRYING -> PROCESSING`; terminal states are no-ops.

### P1 — retry semantics
- **Problem:** every provider failure was immediately persisted as FAILED while BullMQ still retried the job.
- **Root cause:** database lifecycle and BullMQ lifecycle were inconsistent.
- **Fix:** `RETRYING` for retryable intermediate failures, `FAILED` only for permanent/final failures, with attempt counters, max attempts, next retry timestamp and error classification.

### P1 — deleted offer could leave a sendable job
- **Problem:** deleting an offer deleted publication rows while an already queued BullMQ job could still execute.
- **Root cause:** destructive deletion removed the source-of-truth record before the queue job was guaranteed to disappear.
- **Fix:** publications are now marked `CANCELLED` and retained for audit; worker treats cancelled/missing terminal records as no-ops.

### P2 — scheduler timezone
- **Problem:** automation windows used the Node server timezone.
- **Root cause:** `Date#getHours()` was used directly.
- **Fix:** workspace timezone is persisted, defaults to `America/Maceio`, and scheduler evaluates windows/slots/date keys using that timezone.

## Database migration
- `migrations/013_production_hardening.sql`
- Adds workspace timezone and publication retry/cancellation metadata without destructive changes.

## Validation
- GitHub Actions CI latest validation is green after the hardening changes.
- Typecheck, regression tests and production build all passed in CI.
- Regression suite verifies the canonical Evolution group request and workspace timezone windows.
- External Evolution, Mercado Livre and WhatsApp end-to-end validation requires the configured production credentials/services; source-level regressions cannot prove live provider behavior.

### Security hardening added
- Publication creation now verifies offer and destination workspace ownership in persistent mode.
- Offer delete, ML affiliate-link association and AI generation reject cross-workspace cached objects.
- Integration state transition rules are centralized in `IntegrationStateMachine.ts` with regression coverage.

## Known limitations
- Live Evolution instance behavior still requires an actual configured Evolution API.
- Live Mercado Livre Playwright login/session behavior requires a real account and browser environment.
- A full multi-process worker crash/recovery test requires PostgreSQL + Redis running with the production environment.

## Next audit targets
- Central integration health model for WhatsApp/Evolution, worker, Redis and marketplaces.
- Cross-process locks for connection/reconnection.
- Full E2E suite against disposable PostgreSQL/Redis and a provider test instance.


## Continuidade da auditoria — ciclo de integração/lifecycle

- WhatsApp: o estado runtime agora é persistido por workspace e reconciliado com a Evolution API.
- Logout do WhatsApp confirma o estado real antes de responder sucesso.
- QR Code, criação, conexão e reconexão atualizam o lifecycle persistido.
- A máquina de estados de WhatsApp está integrada ao ponto de persistência e possui regressões automatizadas.
- Mercado Livre: início da conexão agora registra `CONNECTING`; a sessão persistida continua sendo usada para reconstruir o runtime quando o Chromium está fechado.
- Health: o diagnóstico de integrações agora verifica conectividade real da Evolution e sinaliza integrações não configuradas como `degraded`.
- Isolamento: a falha de atualização de retry foi corrigida para restringir o UPDATE ao workspace autenticado.
- Frontend: Setup de WhatsApp passou a consumir `runtimeState`, em vez de depender exclusivamente dos estados crus da Evolution.
- CI: os ciclos concluídos desta etapa passaram por typecheck, regressão e build; novas alterações permanecem bloqueadas até o CI correspondente concluir com sucesso.


## 2026-09-20 — user-function audit: destinations
- Completed destination lifecycle: list active destinations, edit configuration, pause/resume automation, and delete from the user's active workspace view.
- Destination deletion is a soft delete (`deleted_at`) so historical publications remain auditable; pending/retrying publications for the removed destination are cancelled.
- Destination ownership is checked against the authenticated workspace on every lifecycle mutation.
- Publication destination selection is now explicit in the Offers UI instead of silently using the first destination.
- Dashboard WhatsApp status now consumes persisted runtime lifecycle states.
- Remaining external validation: run real Evolution API, Mercado Livre browser/session, Redis worker and PostgreSQL E2E against configured services; CI validates source-level regressions but cannot prove those external services.
