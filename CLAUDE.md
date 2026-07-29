# CLAUDE.md

Claude Code instructions for the **Types** package.

## Package Identity

**@shipstatic/types** is the single source of truth for all shared TypeScript types, constants, and utilities across the ShipStatic platform. If a type is used by more than one package, it belongs here — with one carved-out exception, "Admin types" under "Adding New Types". Read it before adding anything named `Admin*`.

**Maturity:** Stable; semver applies — breaking changes require a major version bump.

**Branches:** `main` (production) + `development` (integration). The publish workflow runs on both — the guarded publish step publishes only when `package.json` holds a version not yet on the registry, with the dist-tag derived from the version (`-` suffix → `beta`, else `latest`). See root `CLAUDE.md` "Branch & CI Model".

## Architecture

Single file: `src/index.ts`, organized into named sections in this order:

| Section | Purpose |
|---------|---------|
| Core Entities | Deployment, Domain (+ `DomainSetResult`), Token, Account (+ `AccountGetResponse` — request-scoped `authMethod` lives on the response, not the entity; `AccountUsage`, `AccountOverrides`) — status consts, interfaces, list responses (+ `ListResponse`, `ListOptions`), request shapes (`DeploymentSetOptions`, `DomainSetOptions`, `TokenCreateOptions`), DNS/domain response shapes (`DnsRecord`, `DnsProvider`, `DnsLookup`, `DomainDnsResponse`, `DomainRecordsResponse`, `DomainShareResponse`, `DomainValidateResponse`), the aggregate responses (`LabelsResponse`, `SetupInstructionsResponse`), and the mutation acknowledgements (`DeploymentDeleteResponse` — where the law is written — `DomainDeleteResponse`, `DomainVerifyResponse`, `TokenDeleteResponse`, `AccountDeleteResponse`, `AccountKeyResponse`) |
| URL Surface | `API_PATHS` — every public path declared once, mounted by the API and requested by the SDK and dashboard. `/admin/*` is deliberately absent; see "Admin types" |
| Error System | `ErrorType` (`as const` + type), `ShipError` class, `isShipError` guard |
| Platform Limits | `PlatformLimits` (plan-based caps from the `/limits` endpoint — file size, file count, total size) |
| Extension Blocklist | `BLOCKED_EXTENSIONS`, `isBlockedExtension()` |
| Filename Character Validation | `UNSAFE_FILENAME_CHARS`, `hasUnsafeChars()` |
| Unbuilt Project Markers | `UNBUILT_PROJECT_MARKERS`, `hasUnbuiltMarker()` |
| Common Responses | `PingResponse` (`timestamp` in unix seconds) |
| Credential Shapes | The one address for credential vocabulary: `AUTH_BASE_PATH` (the identity mount — API server and web auth client read the same path), `AuthMethod`, `API_KEY` / `DEPLOY_TOKEN` / `CALLER` (namespaced shape constants), `TokenKind` (structurally derived from `AuthMethod`) + `classifyToken` (the single token dispatch, both sides of the wire), `OAuthScope` |
| Deployment Config Constants | `DEPLOYMENT_CONFIG_FILENAME`, `SPA_DEFAULT_CONFIG` |
| Validation Utilities | `validateIdempotencyKey` (+ `IDEMPOTENCY_KEY_CONSTRAINTS`), `validateToken` (classify, then apply the population's format rules via one shared prefixed-credential helper), `validateApiKey`, `validateDeployToken`, `validateCaller`, `validateApiUrl`, `isDeployment` |
| SPA Check Types | `SPACheckRequest`, `SPACheckResponse` |
| Static File | `StaticFile` (cross-environment file representation) |
| URL Constant | `DEFAULT_API` |
| Resource Contracts | `DeployInput`, `DeploymentUploadOptions`, `*Resource` interfaces |
| Billing Types | `BillingStatus`, `CheckoutSession` |
| Activity Types | `ActivityEvent`, `UserVisibleActivityEvent`, `Activity`, `ActivityMeta`, `ActivityListResponse` — wire contracts for `GET /activities`, produced by the API and consumed by `web/my`. There is deliberately **no** `ActivityResource`: the SDK does not reach that endpoint (recorded in `npm/ship/CLAUDE.md`), and a resource interface nothing implements would be dead surface. A shared type needs two consumers, not three. |
| File Upload Types | `FileValidationStatus`, `ValidationIssue`, `ValidatableFile`, `FileValidationResult`, `UploadedFile` |
| Domain Utilities | `isPlatformDomain`, `isCustomDomain`, `extractSubdomain`, `generate*Url` |
| Label Utilities | `LABEL_CONSTRAINTS`, `LABEL_PATTERN`, `serializeLabels`, `deserializeLabels` |
| Password Utilities | `PASSWORD_CONSTRAINTS`, `validatePassword` |

## Quick Reference

```bash
pnpm build      # TypeScript compilation validates all types
pnpm test --run # Runtime tests: validation constants, blocked extensions, label patterns
pnpm typecheck  # tsc -p tsconfig.check.json — src AND tests

```

## Key Patterns

### ShipError

```typescript
// Factory methods — every one accepts an optional `details?: unknown` as the
// last param. Single exception: `notFound` composes its message from
// `(resource, id?)` and doesn't take details. The two multi-status fallbacks
// (`business`, `api`) accept an optional status before details.
ShipError.validation(message, details?)
ShipError.notFound(resource, id?)
ShipError.forbidden(message, details?)
ShipError.authentication(message?, details?)  // see "internal: telemetry" pattern below
ShipError.rateLimit(message?, details?)
ShipError.business(message, status?, details?)  // status defaults to 400
ShipError.network(message, details?)            // pass `{ cause }` for the underlying Error
ShipError.cancelled(message, details?)
ShipError.file(message, details?)               // pass `{ filePath }` for the path
ShipError.config(message, details?)
ShipError.api(message, status?, details?)       // status defaults to 500

// The four CLIENT-ONLY factories above (`network`, `cancelled`, `file`,
// `config`) are exactly the statusless ones, and that pairing is load-bearing:
// `ErrorResponse.status` is documented "(API contexts)", so it answers "what
// would the wire say?" — not "is this a 4xx-ish sort of problem?". A local
// pre-check that MIRRORS a server rule (blocked extension, label shape, token
// format) rightly keeps the server's type and 400, because dual validation
// exists precisely so the error reads the same wherever it was caught. A fault
// with no server rule to mirror (wrong runtime, unreadable file, a CLI's own
// command grammar) has no status to report, and reaches for one of these four.
// See `npm/ship/CLAUDE.md`, "What a status means", for the worked split.

// Type checks — semantic categories cover the UX-relevant decisions.
// For specific-type checks, use `error.type === ErrorType.X` or `isType(t)`.
error.isClientError()      // client-attributable: a client-fault TYPE, or any 4xx STATUS
error.isNetworkError()
error.isAuthError()
error.isType(errorType)

// Wire format (producer side — API workers serialize errors with toResponse())
error.toResponse() // → ErrorResponse JSON

// HTTP error story (consumer side) — two symmetric helpers, one per failure mode.
// Both take `operationName` for context-aware fallback messages.
await ShipError.fromHttpResponse(response, operationName?)  // server returned non-OK
ShipError.fromFetchError(cause, operationName?)              // fetch itself threw

// Structural guard (handles module duplication in bundles)
isShipError(error)
```

### `internal:` telemetry pattern (Authentication errors)

Server-side auth code attaches an `internal` tag to `details` to record *which* auth check failed without leaking that information to clients:

```typescript
// In API auth code — granular reason for logs/tests, opaque to clients.
throw ShipError.authentication('Authentication failed', { internal: 'jwt_missing_subject' });
```

`toResponse()` strips the entire `details` object when `details.internal` is truthy on an Authentication error. So the wire response is the clean `{ error: 'authentication_failed', message: 'Authentication failed', status: 401 }` — no leakage of which strategy or which check failed — while the server keeps the granular `internal` tag in process for telemetry, log lines, and assertions in tests.

**Use this pattern in API auth code; do not put client-visible info under `internal`.** Other `details` keys round-trip normally (the strip is targeted at this convention only).

`details` is typed `unknown` everywhere — narrow at the read site:

```typescript
const internal = (error.details as { internal?: string } | undefined)?.internal;
```

### Error Flow

**The message authoring law.** The wire `message` is displayed verbatim on every surface — web console alerts, CLI stderr, SDK consumers. Producers therefore author messages for end users at the throw site (plain sentences; machine data like timestamps, bucket names, or ids goes in `details`, never in prose). Surfaces may add context-actionable guidance in their own vocabulary (the CLI mentions its flags) or presentation chrome (toast titles), and may compose copy where no wire exists (network failures, timeouts) — but they never re-word a wire message. Clients branch on `error` type / `status`, never on message strings, which is what keeps message improvements free.


Errors flow through the platform along a single, symmetric path. Every HTTP client (SDK, web console, future) uses the same two helpers; the API worker does the inverse. There is no other way to construct or hydrate a `ShipError` in HTTP context.

```
┌─ Producer (cloudflare/api worker) ────────────────────────────────────┐
│  throw ShipError.validation('Email required')                          │
│       │                                                                │
│       ▼                                                                │
│  app.onError(err) — global handler in api/src/index.ts                 │
│       │                                                                │
│       ▼                                                                │
│  c.json(err.toResponse(), err.status ?? 500)                           │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼  WIRE (JSON)
                  { error: 'validation_failed',
                    message: 'Email required',
                    status: 400,
                    details?: unknown }
                                  │
                                  ▼
┌─ Consumer (npm/ship SDK or web/my) ───────────────────────────────────┐
│                                                                        │
│  Path 1 — server returned a non-OK response:                           │
│    if (!response.ok)                                                   │
│      throw await ShipError.fromHttpResponse(response, operationName)   │
│      // trusts body.error if it's a server-producible ErrorType,       │
│      // else status-derived (401→Authentication, 403→Forbidden,        │
│      // 429→RateLimit, else→Api). body.message and body.details        │
│      // preserved.                                                     │
│                                                                        │
│  Path 2 — fetch itself failed (offline, abort, CORS):                  │
│    catch (cause) {                                                     │
│      throw ShipError.fromFetchError(cause, operationName)              │
│      // ShipError pass-through · AbortError→Cancelled                  │
│      // TypeError fetch→Network · other Error→Api · unknown→Api        │
│    }                                                                   │
│                                                                        │
│  Either way, consumer code sees a typed ShipError:                     │
│    if (error.type === ErrorType.Validation) { ... } // works for received │
│    if (error.status === 429)         { ... }                            │
│    if (error.isAuthError())          { ... }                            │
│    if (error.isNetworkError())       { ... }                            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Conventions enforced by this design:**

- **Wire-format type round-trips.** Server's `ShipError.validation(...)` reaches the client as `ErrorType.Validation`. Type guards (`isClientError()`, etc.) and direct comparisons (`error.type === ErrorType.Validation`) both work for received errors.
- **Status drives type for non-API responses** (CDN errors, intermediaries with no body) — 401→Authentication, 403→Forbidden, 429→RateLimit, else→Api.
- **Type and status are independent axes, and `isClientError()` reads both.** The line above is exactly why: a non-OK response whose body names no server-producible type is status-derived, so a CDN 404 or a misrouted request arrives as `Api` — a server-fault *type* carrying a client *status*. A type-only guard would report it as a platform failure and bury the server's message, so consumers would each have to re-add a status-range check beside every call. The guard owns that instead: client-fault type **or** 4xx status. The type set still carries the statusless local faults (`Config`, `File`), where there is no status to read.
- **Client-only types stay client-only.** `Network`, `Cancelled`, `File`, and `Config` originate on the client (fetch failure, AbortSignal, SDK file processing, SDK config parsing). Even if a misbehaving server claimed one of these in `body.error`, `fromHttpResponse` ignores it — they're filtered out of the wire-trust set via `CLIENT_ONLY_ERROR_TYPES`.
- **No HTTP error logic outside these two helpers.** SDK and web console are pure transport — `executeRequest` / `lib/api.ts` call the helpers directly; there are no private wrappers, no duplicated parsing, no drift surface.
- **A non-JSON body is a foreign responder's, and is trusted only as far as it reads like a message.** Every API error is `ErrorResponse` JSON, so a non-JSON body came from an intermediary — and the two kinds it produces need opposite treatment. A CDN's `error code: 1015` is the most useful thing there is to say; a proxy's HTML error page is a *document*. Adopting one verbatim made a misconfigured `apiUrl` print 2,059 characters of markup as the error message on every surface. `fromHttpResponse` therefore takes a non-JSON body as `message` only when it does not open as markup and is at most `MAX_FOREIGN_MESSAGE_LENGTH` (200) characters; otherwise the `operationName`-derived fallback wins. **JSON bodies are never measured against it** — those are the API's own contract, and truncating a long validation message would be the bug.

### Resource Contracts

Interfaces define the **minimal contract** — SDK implementations may add runtime options (timeout, signal, callbacks). Always match the full interface:

```
DeploymentResource : upload, list, get, set, remove
DomainResource     : set, list, get, remove, verify, validate, dns, records, share
TokenResource      : create, list, remove
AccountResource    : get
```

`upload`'s wide input is `DeployInput` (`File[] | string | string[]`). Each platform's SDK narrows its `Ship.deploy()` shortcut to the relevant subset (`File[]` in Browser, `string | string[]` in Node) and runtime-validates the resource-layer call. There is no `BillingResource` or `KeysResource` in the shared contract — the `web/my` app talks to billing endpoints directly via its API client.

### Status Constants Pattern

`as const` object + derived union type. Two naming variants depending on whether the entity name already ends in something like "Type":

```typescript
// Standard: value object + `*Type` union (most status objects)
export const FooStatus = { PENDING: 'pending', ACTIVE: 'active' } as const;
export type FooStatusType = typeof FooStatus[keyof typeof FooStatus];

// Shared name: when the entity name already ends in "Type", reuse the same
// identifier for both value and union (TypeScript allows it)
export const ErrorType = { Validation: 'validation_failed', ... } as const;
export type ErrorType = typeof ErrorType[keyof typeof ErrorType];
```

Used by:
- Standard variant: `DeploymentStatus`, `DomainStatus`, `AccountPlan`, `FileValidationStatus`, `AuthMethod`, `TokenKind`
- Shared-name variant: `ErrorType` (would be `ErrorTypeType` under the standard variant — clearly worse)

### Readonly vs Mutable

Use `readonly` for stable fields (`id`, `created`, `url`). Leave mutable fields that the API can update (`status`, `expires`, `labels`, `deployment`).

## Consumers

| Package | Uses |
|---------|------|
| `@shipstatic/ship` | All types, ShipError, validation utilities |
| `@shipstatic/drop` | `FileValidationStatus`, `ValidatableFile`, `hasUnbuiltMarker`, `isShipError` |
| `cloudflare/api` | All entity types, ShipError, constants |
| `cloudflare/consumer` | `AccountPlanType`, `DeploymentStatus` directly (ShipError arrives via `cloudflare/shared`) |
| `web/my` | Entity types, response types |

## The typecheck covers `tests/` too

`pnpm typecheck` runs `tsc -p tsconfig.check.json` over **`src` and
`tests`** — `tsconfig.json` stays build-shaped (`rootDir: src`, declaration
output) and is what `pnpm build` reads. This matches `npm/ship`,
`cloudflare`, and `web/my`, each of which records the same reason: vitest
transpiles through esbuild **without** typechecking, so a test tree outside
the program is entirely unchecked.

The gap was sharper here than elsewhere, and it is why the config exists.
`tests/` carries **compile-time** assertions about the resource contracts —
the list-contract fence in `validation-constants.test.ts`, which asserts
that every paginated collection's `list` takes `ListOptions`, that every
list response carries a `cursor`, and that none carries a `total`. Those
assert by failing to compile.
Outside the program they asserted *nothing*, and were verified silently
passing while `TokenResource.list` was live with the drift they target.

**A fence written as a type assertion is only a fence if the typecheck sees
it.** After adding one, prove it fires — introduce the drift, watch the
typecheck fail, restore.

## Adding New Types

1. Find the right section in `src/index.ts` (keep section order above)
2. Add JSDoc to every exported symbol
3. Follow existing entity pattern: status const → entity interface → list response → resource contract
4. Run `pnpm build` to validate

### The composition laws

Four rules, each of which was broken once and is now structural:

- **A unit type is a single noun** — `Deployment`, `Domain`, `Account`,
  `Activity`, `Token`. Never name an entity for the surface that returns it.
  `Token` was `TokenListItem` until 2026-07-28, and that name is exactly why
  `TokenCreateResponse` restated its fields rather than extending it: there
  was no entity to extend, only a list's item.
- **A response composes its entity, never restates it.**
  `DeploymentCreateResponse extends Deployment`, `TokenCreateResponse extends
  Token`, `DomainSetResult extends Domain`, `AccountGetResponse extends
  Account`. Request-scoped and one-time fields (`claim`, `secret`,
  `isCreate`, `authMethod`) live on the response; the entity stays the
  entity.
- **A list response is `ListResponse` plus its plural noun.** The cursor is
  declared once, on `ListResponse`, so a fifth list cannot get the envelope
  subtly wrong — and the "no `total`" doctrine is stated in one place instead
  of four.
- **An acknowledgement is a projection of the resource.** Where a mutation
  leaves no entity to return, it answers with the resource noun carrying the
  item's canonical key, plus the resource's own state field where the state
  changed (`DeploymentDeleteResponse.status`, `AccountDeleteResponse.plan`);
  a hard delete is the key alone (`DomainDeleteResponse`,
  `TokenDeleteResponse`). No `message` — an acknowledgement is data, and
  every surface composes its own copy.

  This was first written as *"no constant"*, which the shape itself fails:
  `status` is the literal `'deleting'` on every success, as fixed as a
  `changed: true` would be. **The test is not how predictable the value is,
  it is what the field IS.** `status` is a field of `Deployment`, so the
  response is that entity narrowed and a client renders it with code it
  already has; `changed`/`queued`/`success` are fields of no entity and exist
  only to assert the call worked, which the status code already said. Sync
  versus accepted is the status code's job (200 / 202), never a boolean's.
  The law is written out once, on `DeploymentDeleteResponse`; the other five
  link to it.
- **A published contract names every shape it exposes.** No anonymous object
  types in an exported signature — not as a return (`share` once answered
  `Promise<{domain, hash}>`, so the CLI declared its own
  `DomainShareResponse` and the API typed neither), not as options
  (`DeploymentSetOptions`, `DomainSetOptions`, `TokenCreateOptions`), and not
  nested inside a response (`DnsLookup`, `SPACheckDebug`). An inline shape
  cannot be imported, so every consumer that needs to hold one redeclares it
  — which is the drift this package exists to prevent, committed inside the
  package itself.

**New fields on existing response entities are optional** (`readonly x?: T`),
by the additive-evolution law: published SDK versions return the entity
without the field, and a required field would make every additive API change
a lockstep SDK release. `Account.used` is the precedent. A field may become
required at the entity's next natural break (major bump) once every
published consumer carries it.

**New error types:** Add to `ErrorType` enum + a static factory on `ShipError`.

### Admin types

**The operator surface does not ship here.** `AdminAccount`,
`AdminDeployment`, `AdminDomain`, `AdminToken`, `AdminActivity`,
`AdminStats` and the `/admin/*` page shapes live in
`web/my/src/features/admin/types.ts` and nowhere else. Do not move them,
mirror them, or add a sibling for a new operator endpoint.

The two-consumer rule above is what makes this need saying: those types
genuinely have two consumers (`cloudflare/api` produces, `web/my` consumes),
so the general rule argues *for* promoting them. It is overridden here. This
package is published to npm, so its contents are the platform's public
vocabulary — shipping the operator schema would enumerate every internal
column, filter, and lifecycle field we hold on an account to anyone who runs
`npm install`. Reach is the cost, not correctness.

**The price is paid in `web/my`, deliberately — and this is the one place it
is written down.** With no shared type, nothing compile-checks the operator
wire against its client. By 2026-07-28 the two had drifted by sixteen fields:
`web/my` declared nine the API never sent — five of which
(`status`, `units`, `synced`, `grace`, `overrides`) it also *rendered*, so
those columns had shown an empty cell on every row since the table was
written — and omitted seven the API did send. Among the phantoms was the
billing reference, read as `sub` where the API has always sent `billing`,
which left the operator's delete-billing action permanently unreachable
because its visibility was gated on that field.

Two things hold the seam instead of a compiler:
`cloudflare/api/tests/integration/list-contract.test.ts` spells out all five
operator row shapes and fails when a projection changes, and the header of
`web/my`'s `features/admin/types.ts` states the obligation. A new operator
column touches both files in one commit or it is drift.

If the operator surface ever needs a third consumer, that is the moment to
reopen this — a private `@shipstatic/admin-types` package, not this one.

### Validation: format vs policy

Validators in this package enforce **wire-format rules** — the rules that define what a value *is*, not what's *allowed*. Format rules belong here because every consumer (SDK, API, web app, integrations) needs to agree on them or the wire breaks.

Examples that belong here:

- `validateApiKey` — `ship-` prefix + 64 hex chars; the format defines the type.
- `validateDeployToken` — same shape, different prefix.
- `validatePassword` — length 6–128 is the wire-format envelope an API endpoint accepts.

Examples that do **not** belong here (keep in the API):

- Password strength rules (no breach lists, complexity heuristics) — security policy, evolves on the server.
- Plan-based caps (file size, file count) — already correctly delivered via `/limits`, not hard-coded.
- Domain availability, account state, billing rules — server-only state.

Rule of thumb: if a client could compute the answer offline from the input alone *and* the API would always reject the same input the same way, it's format → ship the validator here. Otherwise it's policy → keep it server-side.

## Design Principles

1. **Single source of truth** — no type duplication anywhere
2. **Wire format compatibility** — types match API JSON exactly
3. **Readonly by default** — mutable only when necessary
4. **Const objects over enums** — `as const` for compile-time safety
5. **JSDoc everything** — types are self-documenting

---

*Types is the foundation. Changes here ripple across the entire platform.*
