# CLAUDE.md

Claude Code instructions for the **Types** package.

## Package Identity

**@shipstatic/types** is the single source of truth for all shared TypeScript types, constants, and utilities across the Shipstatic platform.

**Maturity:** Release candidate. Interfaces are stabilizing; changes should be deliberate and well-considered.

```
Types package ← imported by ← API, SDK, CLI, Drop, Web apps
```

**Rule:** If a type is used by more than one package, it belongs here.

## Architecture

Single file: `src/index.ts` organized into sections:

```typescript
// =============================================================================
// I. CORE ENTITIES
// =============================================================================
// Deployment, Domain, Token, Account

// =============================================================================
// ERROR SYSTEM
// =============================================================================
// ShipError class, ErrorType enum

// =============================================================================
// CONFIG TYPES
// =============================================================================
// ConfigResponse, PlatformConfig, ResolvedConfig

// ... etc
```

### Section Order

| Section | Contents |
|---------|----------|
| Core Entities | Deployment, Domain, Token, Account + list responses |
| Error System | ErrorType enum, ShipError class, ErrorResponse |
| Config Types | ConfigResponse, PlatformConfig |
| Common Response Patterns | PingResponse |
| Validation Utilities | validateApiKey, validateDeployToken, validateApiUrl |
| SPA Check Types | SPACheckRequest, SPACheckResponse |
| Static File | StaticFile interface |
| Platform Config | DEFAULT_API, ResolvedConfig |
| Progress Tracking | ProgressCallback, DeploymentProgress |
| Platform Constants | API_KEY_PREFIX, DEPLOY_TOKEN_PREFIX, AuthMethod |
| Resource Contracts | DeploymentResource, DomainResource, etc. |
| Billing Types | BillingStatus, CheckoutSession, BillingResource |
| Activity Types | ActivityEvent, Activity, ActivityListResponse |
| File Upload Types | FileValidationStatus, ValidatableFile, ValidationIssue |
| Domain Utilities | isPlatformDomain, isCustomDomain, extractSubdomain, generateDomainUrl |
| Label Utilities | serializeLabels, deserializeLabels |

## Quick Reference

```bash
pnpm build                    # Build package (TypeScript compilation validates types)
pnpm test --run               # Run validation constant tests
```

**Runtime behavior tests:** `tests/validation-constants.test.ts` verifies validation constants and utilities (MIME types, file statuses, label patterns). TypeScript types are validated at compile time.

## Key Patterns

### ShipError

Unified error class used by API, SDK, and CLI:

```typescript
// Factory methods
ShipError.validation(message, details)
ShipError.notFound(resource, id)
ShipError.authentication(message)
ShipError.business(message, status)
ShipError.network(message, cause)
ShipError.api(message, status)

// Type checking
error.isClientError()
error.isNetworkError()
error.isAuthError()

// Wire format conversion
error.toResponse()
ShipError.fromResponse(response)
```

### Resource Contracts

Interfaces that SDK implementations must follow. These define the **minimal contract** - SDKs may accept additional options for implementation-specific concerns (timeout, signals, etc.):

```typescript
interface DeploymentResource {
  create: (input: DeployInput, options?: DeploymentCreateOptions) => Promise<Deployment>;
  list: () => Promise<DeploymentListResponse>;
  get: (id: string) => Promise<Deployment>;
  set: (id: string, options: { labels: string[] }) => Promise<Deployment>;
  remove: (id: string) => Promise<void>;
}

interface DomainResource {
  set: (name: string, options?: { deployment?: string; labels?: string[] }) => Promise<Domain>;
  list: () => Promise<DomainListResponse>;
  get: (name: string) => Promise<Domain>;
  remove: (name: string) => Promise<void>;
  verify: (name: string) => Promise<{ message: string }>;
  // ... dns, records, share
}

interface TokenResource {
  create: (options?: { ttl?: number; labels?: string[] }) => Promise<TokenCreateResponse>;
  list: () => Promise<TokenListResponse>;
  remove: (token: string) => Promise<void>;
}
```

**Design principle:** Contracts define API-level options (labels, subdomain). SDK implementations extend with runtime options (timeout, signal, callbacks).

### Status Constants

Use const objects with `as const` for type-safe status values:

```typescript
export const DeploymentStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  DELETING: 'deleting'
} as const;

export type DeploymentStatusType = typeof DeploymentStatus[keyof typeof DeploymentStatus];
```

### Readonly vs Mutable Fields

Interfaces use `readonly` for immutable fields:

```typescript
interface Deployment {
  readonly deployment: string;  // Never changes
  readonly created: number;     // Never changes
  status: DeploymentStatusType; // Can be updated
  expires: number | null;       // Can be updated
}
```

## Consumers

| Package | Uses |
|---------|------|
| `@shipstatic/ship` | All types, ShipError, validation utilities |
| `@shipstatic/drop` | FileValidationStatus, ValidatableFile |
| `cloudflare/api` | All entity types, ShipError, constants |
| `cloudflare/consumer` | ShipError, entity types |
| `web/my` | Entity types, response types |

## Adding New Types

1. **Find the right section** in `src/index.ts`
2. **Add type with JSDoc** - All public types need documentation
3. **Use patterns** - Match existing patterns (readonly, status constants, etc.)
4. **Export explicitly** - All types are exported from the single file
5. **Build** - `pnpm build` validates TypeScript

### When Adding Entity Types

```typescript
// 1. Status constants (if applicable)
export const NewEntityStatus = {
  PENDING: 'pending',
  ACTIVE: 'active'
} as const;

export type NewEntityStatusType = typeof NewEntityStatus[keyof typeof NewEntityStatus];

// 2. Core entity interface
export interface NewEntity {
  readonly id: string;
  readonly created: number;
  status: NewEntityStatusType;
}

// 3. List response
export interface NewEntityListResponse {
  entities: NewEntity[];
  cursor?: string;
  total?: number;
}

// 4. Resource contract (if SDK-accessible)
export interface NewEntityResource {
  create: (...) => Promise<NewEntity>;
  list: () => Promise<NewEntityListResponse>;
  // ...
}
```

### When Adding Error Types

Add to ErrorType enum and create factory method on ShipError:

```typescript
// In ErrorType enum
NewError = "new_error",

// In ShipError class
static newError(message: string): ShipError {
  return new ShipError(ErrorType.NewError, message, 400);
}
```

## Design Principles

1. **Single source of truth** - No type duplication anywhere
2. **Wire format compatibility** - Types match API JSON exactly
3. **Readonly by default** - Mutable only when necessary
4. **Exhaustive enums** - Use const objects for compile-time safety
5. **JSDoc everything** - Types are self-documenting

## Related Documentation

| Document | Content |
|----------|---------|
| `../ship/CLAUDE.md` | SDK that implements resource contracts |
| `../drop/CLAUDE.md` | Uses file validation types |
| `../../cloudflare/api/CLAUDE.md` | API that produces these types |

---

*Types is the foundation. Changes here ripple across the entire platform.*
