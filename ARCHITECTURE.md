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
