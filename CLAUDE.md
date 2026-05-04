# CLAUDE.md

Claude Code instructions for the **Types** package.

## Package Identity

**@shipstatic/types** is the single source of truth for all shared TypeScript types, constants, and utilities across the ShipStatic platform. If a type is used by more than one package, it belongs here.

**Maturity:** Release candidate — changes should be deliberate.

## Architecture

Single file: `src/index.ts`, organized into named sections in this order:

| Section | Purpose |
|---------|---------|
| Core Entities | Deployment, Domain (+ `DomainSetResult`), Token, Account — status consts, interfaces, list responses |
| Error System | `ErrorType` (`as const` + type), `ShipError` class, `isShipError` guard |
| Platform Limits | `PlatformLimits` (plan-based caps from the `/config` endpoint — file size, file count, total size) |
| Extension Blocklist | `BLOCKED_EXTENSIONS`, `isBlockedExtension()` |
| Common Responses | `PingResponse` |
| Platform Constants | `API_KEY` / `DEPLOY_TOKEN` (namespaced shape constants), `AuthMethod`, `DEPLOYMENT_CONFIG_FILENAME` |
| Validation Utilities | `validateApiKey`, `validateDeployToken`, `validateApiUrl`, `isDeployment` |
| SPA Check Types | `SPACheckRequest`, `SPACheckResponse` |
| Static File | `StaticFile` (cross-environment file representation) |
| Resolved Client Config | `ResolvedConfig` (the *client's* credentials + API URL after defaulting; distinct from `PlatformLimits` above) |
| Progress Tracking | `ProgressInfo` |
| URL Constant | `DEFAULT_API` |
| Resource Contracts | `DeployInput`, `DeploymentUploadOptions`, `*Resource` interfaces |
| Billing Types | `BillingStatus`, `CheckoutSession` |
| Activity Types | `ActivityEvent`, `UserVisibleActivityEvent`, `Activity`, `ActivityMeta` |
| File Upload Types | `FileValidationStatus`, `ValidationIssue`, `ValidatableFile`, `FileValidationResult`, `UploadedFile` |
| Domain Utilities | `isPlatformDomain`, `isCustomDomain`, `extractSubdomain`, `generate*Url` |
| Label Utilities | `LABEL_CONSTRAINTS`, `LABEL_PATTERN`, `serializeLabels`, `deserializeLabels` |
| Password Utilities | `PASSWORD_CONSTRAINTS` |

## Quick Reference

```bash
pnpm build      # TypeScript compilation validates all types
pnpm test --run # Runtime tests: validation constants, blocked extensions, label patterns
```

## Key Patterns

### ShipError

```typescript
// Factory methods — uniform shape: (message, details?). Two exceptions:
// `notFound` composes its own message from (resource, id?), and `business`/`api`
// take an optional status because they're the multi-status fallbacks.
ShipError.validation(message, details?)
ShipError.notFound(resource, id?)
ShipError.authentication(message?, details?)
ShipError.rateLimit(message?)
ShipError.business(message, status?)       // status defaults to 400
ShipError.network(message, details?)       // pass `{ cause }` for the underlying Error
ShipError.cancelled(message)
ShipError.file(message, details?)          // pass `{ filePath }` for the path
ShipError.config(message, details?)
ShipError.api(message, status?)            // status defaults to 500

// Type checks — semantic categories cover the UX-relevant decisions.
// For specific-type checks, use `error.type === ErrorType.X` or `isType(t)`.
error.isClientError()      // Business | Config | File | Validation
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

### Error Flow

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
                    details?: any }
                                  │
                                  ▼
┌─ Consumer (npm/ship SDK or web/my) ───────────────────────────────────┐
│                                                                        │
│  Path 1 — server returned a non-OK response:                           │
│    if (!response.ok)                                                   │
│      throw await ShipError.fromHttpResponse(response, operationName)   │
│      // trusts body.error if it's a server-producible ErrorType,       │
│      // else status-derived (401→Authentication, 429→RateLimit,        │
│      // anything else→Api). body.message and body.details preserved.   │
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
- **Status drives type for non-API responses** (CDN errors, intermediaries with no body) — 401→Authentication, 429→RateLimit, else→Api.
- **Client-only types stay client-only.** `Network` and `Cancelled` originate on the client (fetch failure, AbortSignal). Even if a misbehaving server claimed `error: "network_error"` in the body, `fromHttpResponse` ignores it — those types are filtered out of the wire-trust set.
- **No HTTP error logic outside these two helpers.** SDK and web console are pure transport — `executeRequest` / `lib/api.ts` call the helpers directly; there are no private wrappers, no duplicated parsing, no drift surface.

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
- Standard variant: `DeploymentStatus`, `DomainStatus`, `AccountPlan`, `FileValidationStatus`, `AuthMethod`
- Shared-name variant: `ErrorType` (would be `ErrorTypeType` under the standard variant — clearly worse)

### Readonly vs Mutable

Use `readonly` for stable fields (`id`, `created`, `url`). Leave mutable fields that the API can update (`status`, `expires`, `labels`, `deployment`).

## Consumers

| Package | Uses |
|---------|------|
| `@shipstatic/ship` | All types, ShipError, validation utilities |
| `@shipstatic/drop` | `FileValidationStatus`, `ValidatableFile`, `hasUnbuiltMarker` |
| `cloudflare/api` | All entity types, ShipError, constants |
| `cloudflare/consumer` | ShipError, entity types |
| `web/my` | Entity types, response types |

## Adding New Types

1. Find the right section in `src/index.ts` (keep section order above)
2. Add JSDoc to every exported symbol
3. Follow existing entity pattern: status const → entity interface → list response → resource contract
4. Run `pnpm build` to validate

**New error types:** Add to `ErrorType` enum + a static factory on `ShipError`.

## Design Principles

1. **Single source of truth** — no type duplication anywhere
2. **Wire format compatibility** — types match API JSON exactly
3. **Readonly by default** — mutable only when necessary
4. **Const objects over enums** — `as const` for compile-time safety
5. **JSDoc everything** — types are self-documenting

---

*Types is the foundation. Changes here ripple across the entire platform.*
