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
| Core Entities | Deployment (+ `DeploymentVia` — the origin vocabulary, closed here so the clients that name themselves are compiler-checked; `Deployment.via` stays `string \| null` because stored rows predate it), Domain (+ `DomainSetResult`), Token, Account (+ `AccountGetResponse` — request-scoped `authMethod` lives on the response, not the entity; `Caps` — one shape for both `usage` and `caps`, so the pair divides) — status consts, interfaces, list responses (+ `ListResponse`, `ListOptions`), request shapes (`DeploymentSetOptions`, `DomainSetOptions`, `TokenCreateOptions`), DNS/domain response shapes (`DnsRecord`, `DnsProvider`, `DnsLookup`, `DomainDnsResponse`, `DomainRecordsResponse`, `DomainShareResponse`, `DomainValidateResponse`), the aggregate responses (`LabelsResponse`, `SetupInstructionsResponse`), and the mutation acknowledgements (`DeploymentDeleteResponse` — where the law is written — `DomainDeleteResponse`, `DomainVerifyResponse`, `TokenDeleteResponse`, `AccountDeleteResponse`, `AccountKeyResponse`) |
| Wire Surface | `API_PATHS` — every public path declared once, mounted by the API and requested by the SDK and dashboard (`/admin/*` deliberately absent; see "Admin types") — and `DEPLOY_FIELDS`, the deploy multipart body's field names: the paths and the fields are the two halves of one wire surface, which is why they share a section |
| Error System | `ErrorType` (`as const` + type), `ShipError` class, `isShipError` guard |
| Platform Limits | `PlatformLimits` — what the platform will refuse, from the `/limits` endpoint: the three plan-based caps (file size, count, total size) plus `blockedExtensions`, the API-owned hosting blocklist. The blocklist field is OPTIONAL and its absence means "no client-side check", never "an empty policy" — see "Validation: format vs policy" |
| Extension Matching | `isBlockedExtension(filename, blocked)` — the matching RULE only, and the one exported symbol; the extraction helper behind it stays private until a caller exists (adding an export is free, removing one is a major). The LIST belongs to `cloudflare/api` and arrives as data; see "Validation: format vs policy" for why the two split |
| Picker Accept Hint | `WEB_FILE_ACCEPT` — the `accept` value for a browser file picker. A **hint, never a rule**: `accept` can express only an allowlist while the platform's rule is a blocklist, so this list is necessarily narrower than what the platform hosts and must never decide whether a file may be deployed. The invariant that matters — the picker never offers what the platform will refuse — is fenced in `cloudflare/api/tests/lib/blocklist.test.ts`, which holds this published string against the list it owns. |
| Filename Character Validation | `UNSAFE_FILENAME_CHARS`, `hasUnsafeChars()` |
| Unbuilt Project Markers | `UNBUILT_PROJECT_MARKERS`, `hasUnbuiltMarker()` |
| Common Responses | `PingResponse` (`timestamp` in unix seconds) |
| Credential Shapes | The one address for credential vocabulary: `AUTH_BASE_PATH` (the identity mount — API server and web auth client read the same path), `AuthMethod`, `API_KEY` / `DEPLOY_TOKEN` / `OAUTH_TOKEN` / `CALLER` (namespaced shape constants), and **both halves of the one Bearer slot** — `readBearerValue` READS it (RFC 7235 §2.1 scheme fold; absence stays the caller's own question) and `TokenKind` + `classifyToken` DISPATCH on what came out, both sides of the wire — plus `OAuthScope` |
| Deployment Config Constants | `DEPLOYMENT_CONFIG_FILENAME`, `SPA_DEFAULT_CONFIG`, `SPA_CHECK_CONSTRAINTS` (the `/spa-check` pre-flight's envelope — the index-file selection rule + the skip cap; NOT a validation boundary, the server answers an oversized index `isSPA: false`) |
| Validation Utilities | `validateIdempotencyKey` (+ `IDEMPOTENCY_KEY_CONSTRAINTS`, which owns the header NAME as well as the format — see `CALLER.HEADER` for the same reasoning), `normalizeVia` (moved from the API 2026-08-06: a client reaches the same verdict offline, which is this file's own test for a format rule), `readBearerValue` (the Authorization header's scheme fold — see "The credential shape law"), `validateToken` (classify, then apply the population's format rules via one shared prefixed-credential helper), `validateApiKey`, `validateDeployToken`, `validateOAuthToken`, `validateCaller`, `validateApiUrl`, `isDeployment`, `validateTtl` (+ `TTL_CONSTRAINTS` — see "One lifetime grammar") |
| SPA Check Types | `SPACheckRequest`, `SPACheckResponse` |
| Static File | `StaticFile` (cross-environment file representation) |
| Platform Constants | `DEFAULT_API`, `PUBLIC_DEPLOYMENT_TTL_SECONDS` (the anonymous-deploy lifetime — the API stamps `expires` and the claim window from it, and both MCP transports derive the duration they quote to agents; it was four restatements until 2026-08-06), `SHIP_ENV` (the Node SDK's ambient pair `SHIP_TOKEN`/`SHIP_API_URL` — the COMPLETE scrub list for embedding hosts; CLI-only vars deliberately excluded), `SHIP_VIA_ENV` (the subprocess-wrapper origin-relabel slot, read by the CLI and the stdio MCP bin; deliberately outside `SHIP_ENV` because the SDK never reads it), `MY_API_KEY_URL` (the console deep link every authentication-teaching surface quotes — five files, three repos, until 2.5.0-beta.21) |
| Resource Contracts | `DeployInput`, `DeploymentUploadOptions`, `*Resource` interfaces |
| Billing Types | `BillingInterval`, `Plan`, `PlansResponse`, `CheckoutSession`, `BillingPortalSession` — the vocabulary only, spelled as Stripe spells it. No price and no cap is published: they are policy, delivered by `GET /plans` (see "Validation: format vs policy"). The platform runs on Stripe and its vocabulary says so (`StripeSession`); the plan vocabulary is fenced by `tests/billing-vocabulary.test.ts` |
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
ShipError.timeout(message, details?)            // a deadline expired — `isNetworkError()` is true
ShipError.cancelled(message, details?)
ShipError.file(message, details?)               // pass `{ filePath }` for the path
ShipError.config(message, details?)
ShipError.api(message, status?, details?)       // status defaults to 500
ShipError.maintenance(message, details?)        // status FIXED at 503; message required

// The five CLIENT-ONLY factories above (`network`, `timeout`, `cancelled`,
// `file`, `config`) are exactly the statusless ones, and that pairing is load-bearing:
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

**The message authoring law.** The wire `message` is authored for the person
who will read it, at the throw site, and every surface relays it — web console
alerts, CLI stderr, SDK consumers. Producers write plain sentences; machine
data (timestamps, bucket names, ids) goes in `details`, which rides
`toResponse()` into the machine channels and is deliberately not rendered in
human ones. Clients branch on `error` type / `status`, never on message
strings, which is what keeps message improvements free.

**A surface composes its own copy in exactly two cases, and both are the
absence of a wire message rather than a disagreement with one:**

- **Nothing was received.** Network failure, timeout, cancellation — no
  response exists, so there is nothing to relay and the surface owns the words.
- **Authentication.** The API makes these messages uninformative *on purpose*:
  `toResponse()` strips `details.internal`, so every cause — missing subject,
  expired session, unknown key — arrives as the same flat "Authentication
  failed", because naming the failed check tells an attacker which one to fix.
  There is therefore nothing to relay by construction, and the remedy is
  client-specific besides: the CLI names its flags, the dashboard says the
  session expired. The `internal:` telemetry pattern below and this exception
  are two halves of one decision.

**Everything else is relayed, including 5xx.** A server fault has nothing to
withhold: the API's global handler emits either a deliberately authored
sentence (a 503 naming what is unavailable) or a flat generic, and sends the
raw failure to its operator channel rather than to the client. A surface may **add** its own
chrome around a relayed message — a toast title, a status-page pointer — but
never replaces it. The CLI discarded every 5xx message until 2026-07-29, which
is what this clause exists to prevent: the platform authored a sentence for the
user and one surface threw it away.


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
│      // TimeoutError→Timeout · transport→Network (see below)           │
│      // other Error→Api · unknown→Api                                  │
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
- **Client-only types stay client-only.** `Network`, `Timeout`, `Cancelled`, `File`, and `Config` originate on the client (fetch failure, an expired deadline, AbortSignal, SDK file processing, SDK config parsing). Even if a misbehaving server claimed one of these in `body.error`, `fromHttpResponse` ignores it — they're filtered out of the wire-trust set via `CLIENT_ONLY_ERROR_TYPES`.
- **No HTTP error logic outside these two helpers.** SDK and web console are pure transport — `executeRequest` / `lib/api.ts` call the helpers directly; there are no private wrappers, no duplicated parsing, no drift surface.
- **A non-JSON body is a foreign responder's, and is trusted only as far as it reads like a message.** Every API error is `ErrorResponse` JSON, so a non-JSON body came from an intermediary — and the two kinds it produces need opposite treatment. A CDN's `error code: 1015` is the most useful thing there is to say; a proxy's HTML error page is a *document*. Adopting one verbatim made a misconfigured `apiUrl` print 2,059 characters of markup as the error message on every surface. `fromHttpResponse` therefore takes a non-JSON body as `message` only when it does not open as markup and is at most `MAX_FOREIGN_MESSAGE_LENGTH` (200) characters; otherwise the `operationName`-derived fallback wins. **JSON bodies are never measured against it** — those are the API's own contract, and truncating a long validation message would be the bug.

### Transport truth: the shape table, and which side of it is bounded

`fromFetchError` answers one question — *did the exchange happen?* — and gets
it wrong in the expensive direction if it guesses. `Api` claims a server
answered; a caller who retries on `Network` will not retry it. Six runtimes
were captured on 2026-08-12 (Node and Bun by direct run, the three engines by a
one-off playwright probe, workerd through miniflare) and the table lives in the
`isTransportFailure` JSDoc with its capture scripts in `tests/errors.test.ts`.

**The rule reads that table backwards, and that is the design.** The transport
class is unbounded — every OS, TLS and DNS failure any engine will ever name —
while the class fetch raises about its own ARGUMENTS is small, and every
runtime names the URL when it complains about one. So the bounded side is what
gets tested, and the residual risk points the safe way: an unrecognised
sentence lands on `Network`, which claims only that nothing was exchanged.

Two defects it closed, both live:

- **WebKit's `Load failed`** carries no code and no "fetch", so the previous
  message test read it as `Api` — every browser-SDK and `@shipstatic/drop`
  user on Safari was told a server had answered.
- **A malformed URL disagreed across engines.** The old test looked for
  "fetch" in the message, and Chromium's and Firefox's URL complaints both
  contain it, so one mistake was `Network` on three engines and `Api` on
  three. All six now agree on `Api`.

**workerd is a recorded gap, not an oversight.** It rejects with a plain
`Error`, no code, and two unrelated sentences for its two failure modes, so
nothing can classify it honestly and it lands on `Api`. Not patched with a
dialect string, because the one consumer running ship there
(`cloudflare/mcp`) reaches the API through a service BINDING — in-process, and
therefore not a source of transport rejections at all.

**Abort and timeout are read from `name` before the `instanceof Error` gate.**
A `DOMException` satisfies that gate in all six runtimes measured, so the arm
is unfalsifiable from outside; the suite plants a non-`Error` shape to hold it,
which is the fence taxonomy's recorded answer for exactly this case. The
classifications:

- `AbortError` → `Cancelled`. Someone stopped it on purpose.
- `TimeoutError` → **`Timeout`**, message `"<op> timed out"`, and
  `isNetworkError()` is **true**. Not `Api` (no server answered) and not
  `Cancelled` (nobody cancelled); what is true is that nothing was exchanged,
  which is what the network CATEGORY states — and it is what puts a timeout in
  the same retryable class as a refused connection.

  **The type is distinct and the category is shared, which is the whole
  design.** It was plain `Network` until 2026-08-12, and one category could
  not carry both verdicts a surface needs. Every consumer that *decides*
  something on the category was already right — retry it, do not report it as
  an incident, expect no wire message to relay — while every consumer that
  *renders* it said "check your internet connection" about a five-minute
  deploy ceiling. So the members of that category diverge on exactly one
  question, what to SAY, and only a distinct type can answer it. The same
  relationship every comparable SDK ships:
  `APIConnectionTimeoutError extends APIConnectionError`.

  `Timeout` is therefore the one client-only type outside `isClientError()`:
  the caller set the ceiling, but what exhausted it was the network or the
  server, so calling it client-attributable would both misname the fault and
  disarm every retry predicate that declines a client error.
- **WebKit reports a fired `AbortSignal.timeout()` as `AbortError`**, so on
  Safari a deadline is indistinguishable from a cancellation and lands on
  `Cancelled`. Recorded rather than worked around: the caller's signal is what
  stopped it, so `Cancelled` is honest there.

### Resource Contracts

Interfaces define the **minimal contract** — SDK implementations may add runtime options (timeout, signal, callbacks). Always match the full interface:

```
DeploymentResource : upload, list, get, set, delete
DomainResource     : set, list, get, delete, verify, validate, dns, records, share
TokenResource      : create, list, delete
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

## `pnpm check:package` and the one rule it ignores

`publint && attw --pack . --ignore-rules cjs-resolves-to-esm` — the npm
field's own quality gate, the same one `npm/ship`, `npm/drop`, the two
wrappers and `@shipstatic/mcp` run. Added 2026-09-01 by the coherence
program, which found this package and the mcp publishing without the check
four siblings had.

**The ignored rule is a decided property, not a suppression.** This package is
ESM-only (`"type": "module"`, one `exports` condition), so a CJS consumer
resolving it gets `attw`'s CJSResolvesToESM warning by construction. Two
things make that safe rather than latent: no published CJS artifact requires
it at runtime (every first-party consumer takes it as a devDependency and
BUNDLES it, which is why a compiled-in constant here would ship stale — see
the `getLimits` note in `npm/ship/CLAUDE.md`), and the platform's
`engines.node >=20.19.0` floor is exactly the version where `require(esm)`
was backported, measured AT the floor rather than assumed.

If a consumer ever requires this package from real CJS, the ignore is the
thing to revisit first.

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
- **A report answers a question and carries only the answer.** The fourth
  shape, and the largest: `PlatformLimits`, `LabelsResponse`,
  `SetupInstructionsResponse`, `DomainRecordsResponse`, `DomainDnsResponse`,
  `DomainShareResponse`, `DomainValidateResponse`, `SPACheckResponse`,
  `PingResponse`, `AccountKeyResponse`. A report names no resource it did not
  compute and restates nothing the status code already said — `GET /ping`
  answers with the server clock, because a 200 IS the liveness answer.

  **Booleans are allowed only when they ARE the answer.** `valid`, `isSPA`,
  `available` answer the question that was asked; `success`, `changed`,
  `queued` assert that the call happened, which the status code owns. The two
  read alike and are opposites.

  This law is why the middle ground has no shared type, and the question is
  worth answering once: an error body is metadata about a non-event, so
  failure has exactly one shape and `ErrorResponse` can be one type. A report
  body IS the product — three byte counts, a DNS record list, a clock — so it
  has no shape to share. Unify errors by a TYPE because they have one shape;
  unify reports by a LAW because they have one purpose. A shared base would
  have admitted every field the fence below bans, which is the tell that it
  was the wrong instrument.

  **The law is mechanical, not prose** — `tests/response-shapes.test.ts` walks
  this file and fails on a banned field. It exists because the three laws
  above were policed and this one was not, which is exactly how `PingResponse`
  grew a `success` that was a literal constant in the route, and how an admin
  endpoint came to ship a `note` field carrying API documentation in every
  response body.

- **One response is outside the four shapes, and it is recorded rather than
  reshaped.** `GET /deployments/:deployment/config` answers the caller's own
  `ship.json` — re-parsed through the public schema from the byte-exact R2
  escrow, which is THE record — or `null` when the deployment carries no
  config. It is not a projection of a platform entity, so no shape above fits,
  and it has no type here because the document's schema is ship.json's, which
  the API owns and evolves.

  **Wrapping it would be the worse answer.** An envelope would make a caller
  unwrap a platform shape to reach a document the platform did not author,
  against the whole point of the escrow. `null` rather than a 404 for the same
  reason it is cheap: `Deployment.config` is a boolean on the entity, so
  "is there one" is already answered before anyone asks for it — this endpoint
  answers with the document or its absence. Its two mid-transition cases
  (escrow not yet written, cleanup already swept) answer like a no-config
  deployment deliberately, while a missing record on a LIVE deployment is
  storage drift and raises a 500 loudly.

  Written down because the alternative is a future reader finding the platform's
  only unnamed response body and correctly concluding it is drift.

- **A published contract names every shape it exposes.** No anonymous object
  types in an exported signature — not as a return (`share` once answered
  `Promise<{domain, hash}>`, so the CLI declared its own
  `DomainShareResponse` and the API typed neither), not as options
  (`DeploymentSetOptions`, `DomainSetOptions`, `TokenCreateOptions`), and not
  nested inside a response (`DnsLookup`, `SPACheckDebug`). An inline shape
  cannot be imported, so every consumer that needs to hold one redeclares it
  — which is the drift this package exists to prevent, committed inside the
  package itself.

- **One operation, one verb — and destruction is `delete`.** The verb is the
  same word in the method, the command, the response type, the activity event,
  and the sentence a user reads. `delete` is the platform's, chosen because two
  layers cannot say anything else: HTTP names the method `DELETE`, and the
  activity events persisted in D1 are `deployment.delete` / `domain.delete` /
  `token.delete` / `account.delete`, which the dashboard renders as "Deployment
  Deleted". It is also the accurate word — JavaScript's own collections use
  `Map.prototype.delete` to destroy, while `Element.remove()` merely detaches a
  node that goes on existing. ShipStatic destroys.

  This was `remove` on the client tier until 2026-07-29, and the split was
  user-visible rather than cosmetic: one action produced "token removed" in the
  CLI and "Token Deleted" in the dashboard minutes apart. The published contract
  contradicted itself on a single line — `remove: (id) => Promise<DeploymentDeleteResponse>`
  — which is the tell to watch for. **A method whose name disagrees with its own
  return type is the drift announcing itself.**

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

**`AccountOverrides` left for the same reason, in 2026-08 (the billing
rewrite).** It had sat here since before the rule was written, and it was
never anything but operator surface: an operator's per-account grant of extra
capacity, produced and consumed by `cloudflare/api` alone — no SDK reads it,
and `web/my` declares the admin row shapes itself. Published, it enumerated
the platform's cap keys to anyone running `npm install`, and it made the cap
rename a three-repository lock-step for a type with one holder. It lives in
`cloudflare/shared/plans.ts` now, beside the table it overrides.

**Its siblings never entered.** The per-plan `Limits` (request sizes) and
`Grants` (may this plan act at all — is it billed, is it paid) have exactly
one holder each, which is the stopping rule's first clause failing: a fact
with one holder needs no owner. `Caps` DID earn its place, on the same test —
`Account.usage` and `Account.caps` are the wire, so the SDK and the console
both hold it, and a fourth counted kind added on one side and not the other
would be silent.

### The credential shape law

Every secret the platform mints obeys three clauses, stated at `CREDENTIAL
SHAPES` in `src/index.ts` and held mechanically by
`tests/validation-constants.test.ts` over this package's populations and by the
API's own suite over `AUTH.CLAIM` (all three drilled — the drift introduced,
the named check watched to fail, reverted).

1. **One entropy standard.** Every minted random secret is `HEX_LENGTH` hex
   characters, so "how long is a credential" has one answer instead of one per
   population. The generators read the constant rather than choosing a number
   (`cloudflare/api/src/lib/crypto.ts` takes its byte count as a parameter), so
   a minted value and an accepted value cannot be different lengths.

2. **Every BEARER population is named by its prefix.** A credential says what
   it is before anything parses it. That is what lets `classifyToken` dispatch
   three populations sharing one `Authorization: Bearer` slot — `ship-`
   (`API_KEY`), `deploy-` (`DEPLOY_TOKEN`) and `oauth-` (`OAUTH_TOKEN`) — and
   what lets a value found in a log, a support ticket or a pasted URL be
   recognised and revoked on sight.

   **The clause is scoped to the Bearer slot, and the two exclusions are
   decisions rather than gaps.** The deployment claim code is BARE: it never
   enters the Bearer slot at all — minted into one URL, consumed by one
   endpoint's one field, so its context names it and a prefix would restate
   its route. (It carried `claim-` for one day in 2026-08 and the operator
   reverted it the same day; this file said otherwise until 2026-08-14, which
   is what a doctrine sentence with no fence under it does.) And the OAuth
   REFRESH token, authorization code and client secret are likewise unprefixed
   — a refresh token is posted as a form field to an endpoint that knows what
   it is receiving, so no dispatcher ever classifies one.

   **The OAuth access token was this clause's one standing exception until
   2026-08-14**, and the reason is worth keeping because it is the shape of
   every such exception: the authorization server it was born on exposed no
   mint hook, so the platform could not name its own credential. Its successor
   does (`generateOpaqueAccessToken`), and the exception closed as a
   consequence of migrating rather than by hand-patching somebody's default.

   **Reading the slot has one owner too, as of 2026-08-14.** `readBearerValue`
   is the RFC 7235 §2.1 scheme fold — case-insensitive on the SCHEME, never on
   the credential's own bytes — and it lives here beside `classifyToken`
   because they are two halves of one wire boundary. It had two hand-rolled
   holders (the api middleware's `readCredential`, the mcp worker's
   `readBearer`), and the platform has paid for getting the rule wrong twice:
   a spec-conformant `bearer ship-…` client was refused for as long as the
   API's test was case-sensitive, and `@better-auth/oauth-provider` carries
   the same defect in four places today — which is exactly why the platform
   folds the scheme itself and hands that provider a bare token. **The
   recorded refusal to own a `Bearer` CONSTANT still stands and is a different
   thing**: that is RFC vocabulary, the same reason this package owns no
   `"POST"`. A parser is not a spelling. Operator decision, taken over a
   `cloudflare/shared/` placement that would have avoided a publish convoy —
   the convoy is the cost of one owner, not a reason to accept two.

3. **No prefix is a prefix of another.** This is why the populations are named
   on different axes — `ship-` for the product, `deploy-` for the capability,
   `oauth-` for the protocol that mints it — rather than sharing a stem.
   `ship-` / `ship-deploy-` looks more symmetrical and is a trap: every deploy
   token also matches the API-key branch, so correctness would rest on the
   order of two `if`s. Introducing that pair turns **seven** tests red, which
   is the shape of the bug it prevents.

   **The three clauses are held over a TABLE, not per member** — the
   populations list in `tests/validation-constants.test.ts` drives every one
   of them, plus two completeness rows added with the OAuth population: that
   no listed population falls through to `OPAQUE`, and that every listed
   population is validated STRICTLY rather than as a non-empty string. Without
   those two, a constant added without a `classifyToken` branch or a
   `validateToken` arm passes every table-driven test by being iterated over
   while doing nothing.

   **And a prefix is retroactive over every string that already starts with
   it.** Adding `oauth-` reclassified two test fixtures that used
   `oauth-…`-shaped literals as examples of OPAQUE tokens — one here, one in
   `npm/ship` — turning them into malformed members of a real population. Both
   went red immediately, which is the fence working; the general point is that
   introducing a prefix is a change to the meaning of existing values, so
   sweep for the spelling before shipping one.

**Not covered, deliberately:** the unsubscribe token is an HMAC-SHA256 output,
not a minted secret — its width is the algorithm's, and it is verified through
`crypto.subtle.verify`, which is constant-time by construction. Truncating it
is safe in principle (RFC 2104 §5) and was declined: it would move a
correctness guarantee from the primitive into a hand-rolled comparison, in
exchange for shortening a value no human ever handles.

### Validation: format vs policy

Validators in this package enforce **wire-format rules** — the rules that define what a value *is*, not what's *allowed*. Format rules belong here because every consumer (SDK, API, web app, integrations) needs to agree on them or the wire breaks.

Examples that belong here:

- `validateApiKey` — `ship-` prefix + `API_KEY.HEX_LENGTH` hex chars; the format defines the type. The width lives in the shape constant, never in prose or a test literal — a hand-written number here is a second owner for it.
- `validateDeployToken`, `validateOAuthToken` — same shape, different prefix.
- `validatePassword` — length 6–128 is the wire-format envelope an API endpoint accepts.

Examples that do **not** belong here (keep in the API):

- Password strength rules (no breach lists, complexity heuristics) — security policy, evolves on the server.
- Plan-based caps (file size, file count) — already correctly delivered via `/limits`, not hard-coded.
- The extension blocklist — hosting policy; see the worked split below.
- Domain availability, account state, billing rules — server-only state.

Rule of thumb: if a client could compute the answer offline from the input alone *and* the API would always reject the same input the same way, it's format → ship the validator here. Otherwise it's policy → keep it server-side.

#### One lifetime grammar: `validateTtl`

`ttl` was the platform's word for "how long does this live" before this rule
existed — `tokens.create({ ttl })` has meant seconds-until-expiry, omit for
permanent, since tokens shipped. When the deploy learned to answer the same
question, the rule was hoisted here rather than written a second time.

**It qualifies under the stopping rule on both clauses.** Two independent
holders: the tokens route's inline
`z.number().int().positive().max(31536000)` and the deploy schema that now
needs the same envelope. And the drift is silent in the direction that
matters — two ceilings that disagree by a day are invisible until someone
requests a duration one accepts and the other refuses, on a surface where
nothing prints either number.

It also gave `tokens create` the client-side half of dual validation it never
had: the rule lived only on the server, so the SDK sent whatever it was given
and a bad duration cost a round trip.

**What is deliberately NOT here is a per-plan ceiling.** The authenticated
entitlement is ∞, so the format rule's one-year bound is the only limit that
exists. Delivering a tiered cap through `/limits` speculatively would be an
owner for a product decision nobody has made — the zeroth option applies:
a policy that does not exist needs no owner.

Two edges are decisions rather than arithmetic. **The floor is 1, not 0** —
a deployment expiring the instant it is created was never live, and `0` is
what an unset shell variable coerces to, so accepting it would turn a CI
misconfiguration into a vanished deploy. **A fraction is refused, not
rounded** — choosing `1` or `2` for someone who wrote `1.5` is a decision the
platform has no standing to make.

#### The worked split: the blocklist left, the matcher stayed

`BLOCKED_EXTENSIONS` lived here until 2026-08-12, and it is the sharpest case
this package has of one "fact" that was really two — so the reasoning is
recorded rather than the outcome.

**The list failed the test.** `virus.exe` is a perfectly well-formed filename;
nothing about it breaks the upload→serve round-trip, and the platform would
serve it happily as `application/octet-stream` with `nosniff`. What refuses it
is a decision not to be a malware CDN — policy, enforced at one security
boundary, and policy that must be changeable the day someone uploads a `.msix`.
Shipped as a published constant it was the opposite: a semver-governed export
whose tightening required a types release, a ship release, a convoy of pin
bumps, and users upgrading — while every client enforced whatever version it
had pinned.

**The stopping rule refuses it too, and by the cheaper clause.** Promotion needs
drift that is silent or slow to surface. A stale client's drift is loud: the
file uploads and the API refuses it by name, on the first try.

**The matcher passed, on the direction of drift.** With the list delivered as
data, two implementations would read the extension off a name — the API's and
each client's. That drift is silent in exactly the direction that hurts: a
client stricter than the server (matching every dot-segment, say, or reading
`dir.v1/README` as a `v1/README` file) refuses a legal file *without the server
ever being asked*, so no error names it and nothing on the platform can see it.
Two holders, silent drift, one owner — the law's own test, satisfied.

**So the answer was not "move it" or "keep it" but a cut**:
`isBlockedExtension(filename, blocked)` here, the list in
`cloudflare/api/src/lib/blocklist.ts`, and `PlatformLimits.blockedExtensions`
as the derivation channel that already existed for plan caps. The constellation
law permits exactly this — *"it flows DOWN as an import or a derivation — never
as a restatement"* — and `/limits` is the derivation.

**One export, not two.** The extraction helper behind the predicate stays
private, and the reason generalizes: "would exporting this be dangerous?" is
the wrong test and it is the one that talks a published package into surface it
has not earned. The right test is the estate's own — has it earned a place? —
decided by an asymmetry, since adding an export later is free under the
additive law while removing one is a major. With zero callers, the reversible
choice is to keep it in. (That is a different reason from
`WEB_FILE_EXTENSIONS`, which is private because publishing it would invite a
wrong question. Both private; only one a hazard.)

**The matcher's fences were bought, not written.** The segment rule's first
two fences asserted nothing, consecutively (2026-08-12): a black-box test
reached the identical verdict through a deliberately broken reader — the
garbage a naive `lastIndexOf` extracts contains a slash and matches no real
entry — and the white-box rewrite still passed, because its planted entry was
spelled uppercase against a lowercasing reader. Both now fail against the
broken implementation, and the general form joined the fence taxonomy (root
`CLAUDE.md`, the constellation law): a property unfalsifiable from outside
gets a white-box fence that plants the impossible input itself, or it gets no
fence at all.

**The generalizable question is which half of a rule is which.** A rule that
says *what a value IS* and a table of *which values are allowed* look like one
fact and are not. When they split, the shape is almost always: predicate here,
table on the server, delivered.

## Design Principles

1. **Single source of truth** — no type duplication anywhere
2. **Wire format compatibility** — types match API JSON exactly
3. **Readonly by default** — mutable only when necessary
4. **Const objects over enums** — `as const` for compile-time safety
5. **JSDoc everything** — types are self-documenting

---

*Types is the foundation. Changes here ripple across the entire platform.*
