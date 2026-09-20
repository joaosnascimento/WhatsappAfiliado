# Architecture

## Runtime
- **Frontend:** React 19 + Vite + TypeScript.
- **HTTP/API:** Express in `server.ts`.
- **Persistence:** PostgreSQL through the infrastructure/database layer and explicit SQL migrations.
- **Queue/cache:** Redis + BullMQ.
- **Worker:** `src/workers/publicationWorker.ts`.
- **State compatibility:** `Store.ts` exposes a workspace-scoped in-memory facade backed by PostgreSQL in persistent mode.

## Workspace isolation
Authenticated API domains are mounted behind `requireAuth` and workspace context. Persistent queries must include the authenticated workspace identifier.

## WhatsApp
- `WhatsAppProvider` is the single outbound sender.
- Evolution group discovery is centralized in `WhatsAppGroupService`.
- Evolution lifecycle routes live under `/api/whatsapp/*`.
- Provider configuration is encrypted in `workspace_settings`.

## Mercado Livre
- `MercadoLivreOfficialSessionProvider` owns Playwright runtime/session handling.
- Session storage is persisted as encrypted storage state.
- Browser activity is runtime state; persisted session validity is checked separately.

## Publication pipeline
`offer -> publication -> PostgreSQL state -> BullMQ -> publicationWorker -> WhatsAppProvider -> SENT/RETRYING/FAILED`.

PostgreSQL is the lifecycle source of truth; Redis/BullMQ is transport and scheduling infrastructure.

## Scheduler
`AutomationScheduler` reads workspace configuration and offer state from PostgreSQL-backed workspace state. Time windows are evaluated in the workspace timezone.

## AI
AI message generation is downstream of verified product facts. Deterministic fallback is used when generation is unavailable.

## Security
Authentication, rate limiting, outbound URL validation, encrypted credentials and workspace context are implemented in the existing security/infrastructure layers.


## Lifecycle de integrações

WhatsApp possui estado runtime persistido por workspace, reconciliado com a Evolution API e consumido pelo frontend através de runtimeState. A persistência aplica as transições válidas da máquina de estados, incluindo transições observadas externamente (por exemplo, QR_REQUIRED → CONNECTED).

Mercado Livre mantém storageState persistido independentemente do processo Chromium. Fechar o navegador não apaga a sessão. O runtime headless é reconstruído quando necessário para validar ou usar a sessão persistida; conexão interativa registra CONNECTING antes do login.

## Health operacional

/api/health/integrations distingue integração não configurada de integração operacional e realiza verificação de conectividade da Evolution API com timeout curto. Banco e Redis são verificados diretamente; estados de conta do Mercado Livre são considerados no diagnóstico.


## Operational controls
- Workspace automation is controlled by the persisted `workspaces.automation_enabled` flag; the scheduler refuses to create new automatic publications while disabled.
- Evolution lifecycle events can be received through the secured workspace webhook endpoint. `CONNECTION_UPDATE` and `QRCODE_UPDATED` reconcile the persisted WhatsApp runtime state without requiring a dashboard refresh. Evolution documents these events as connection/QR lifecycle events. citeturn0search0
- Publication cancellation does not claim to cancel an in-flight external send: `PROCESSING` records return a conflict and are allowed to finish, avoiding a false `CANCELLED` state.
- Coupons have a workspace-scoped lifecycle: list, activation/deactivation and soft deletion.
