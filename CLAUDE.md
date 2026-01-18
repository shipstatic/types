# CLAUDE.md

Claude Code instructions for the **Types** package.

## Package Identity

**@shipstatic/types** is the single source of truth for all shared TypeScript types, constants, and utilities across the Shipstatic platform.

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
| Response Patterns | SuccessResponse, PingResponse |
| Constants | API_KEY_PREFIX, DEPLOY_TOKEN_PREFIX, AuthMethod |
| Validation Utilities | validateApiKey, validateDeployToken, validateApiUrl |
| SPA Check Types | SPACheckRequest, SPACheckResponse |
| Static File | StaticFile interface |
| Platform Config | DEFAULT_API, ResolvedConfig |
| Resource Contracts | DeploymentResource, DomainResource, etc. |
| Billing Types | BillingStatus, CheckoutSession, BillingResource |
| Activity Types | ActivityEvent, Activity, ActivityListResponse |
| File Upload Types | FileValidationStatus, ValidationError, ValidatableFile |
| URL Utilities | generateDeploymentUrl, generateDomainUrl |

## Quick Reference

```bash
pnpm build                    # Build package
pnpm test --run               # No tests (compile-time validation)
```

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

Interfaces that SDK implementations must follow:

```typescript
interface DeploymentResource {
  create: (input: DeployInput, options?: any) => Promise<Deployment>;
  list: () => Promise<DeploymentListResponse>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => Promise<Deployment>;
}
```

These contracts ensure SDK behavior matches API capabilities.

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
  expires?: number;             // Can be updated
}
```

## Consumers

| Package | Uses |
|---------|------|
| `@shipstatic/ship` | All types, ShipError, validation utilities |
| `@shipstatic/drop` | FileValidationStatus, ValidationError, ValidatableFile |
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

## No Tests

Types are validated at compile time. If it builds, it's correct. Consumers test against these types in their own test suites.

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
