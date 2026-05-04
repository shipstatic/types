# @shipstatic/types

Shared TypeScript types for the ShipStatic platform.

Single source of truth for types used across API, SDK, CLI, and web applications.

## Installation

```bash
# Included with Ship SDK
npm install @shipstatic/ship

# Direct installation
npm install @shipstatic/types
```

## What's Included

### Core Entities

```typescript
import type {
  Deployment, DeploymentListResponse,
  Domain, DomainSetResult, DomainListResponse, DnsRecord, DomainDnsResponse, DomainRecordsResponse, DomainValidateResponse,
  Token, TokenListItem, TokenListResponse, TokenCreateResponse,
  Account, AccountUsage, AccountOverrides,
  StaticFile
} from '@shipstatic/types';
```

### Error System

```typescript
import { ShipError, ErrorType, isShipError } from '@shipstatic/types';

throw ShipError.validation('File too large');
throw ShipError.notFound('Deployment', id);
throw ShipError.authentication();
throw ShipError.business('Plan limit reached');

if (isShipError(error)) {
  console.log(error.status, error.type, error.message);
}

if (error.isClientError()) { /* Business | Config | File | Validation */ }
if (error.isAuthError()) { /* handle auth */ }
```

**HTTP client integration.** Both producer and consumer sides of the wire have first-class helpers, so every HTTP client across the platform reconstructs the same `ShipError` shape:

```typescript
// Producer side (API workers): serialize a ShipError to JSON
return c.json(error.toResponse(), error.status ?? 500);

// Consumer side — two symmetric helpers cover both HTTP error modes:

// 1. Server returned a non-OK response
if (!response.ok) {
  throw await ShipError.fromHttpResponse(response, 'Get account');
}

// 2. fetch itself threw (offline, abort, CORS, ...)
try { response = await fetch(url); }
catch (cause) { throw ShipError.fromFetchError(cause, 'Get account'); }
```

`fromHttpResponse` trusts the body's `error` field when it's a known server-producible `ErrorType` — so a server's `ShipError.validation(...)` round-trips back to `ErrorType.Validation` on the client. For non-API responses (CDN errors, intermediaries) or malformed bodies it falls back to status-derived (401 → `Authentication`, 429 → `RateLimit`, else → `Api`). Body's `message` and `details` are preserved best-effort.

`fromFetchError` routes by the thrown cause: an existing `ShipError` is returned unchanged, `AbortError` becomes `Cancelled`, a fetch `TypeError` becomes `Network`, anything else becomes `Api` (with no HTTP status — the request never reached the server).

Both helpers accept an optional operation-name string for contextual messages (`"Get account was cancelled"`, `"Get account failed: ..."`).

### Status Constants

```typescript
import {
  DeploymentStatus,   // pending | success | failed | deleting
  DomainStatus,       // pending | partial | success | paused
  AccountPlan,        // free | standard | sponsored | enterprise | suspended | terminating | terminated
  FileValidationStatus, // pending | processing_error | excluded | validation_failed | ready
  AuthMethod,         // jwt | apiKey | token | webhook | system
} from '@shipstatic/types';
```

### API Response Types

```typescript
import type {
  PlatformLimits,        // plan-based caps from /limits (file size, file count, total size)
  BillingStatus,
  CheckoutSession,
  ActivityListResponse,
  PingResponse,
} from '@shipstatic/types';
```

### Resource Contracts

SDK interface definitions:

```typescript
import type {
  DeploymentResource,
  DomainResource,
  AccountResource,
  TokenResource,
} from '@shipstatic/types';
```

### Validation Utilities

```typescript
import {
  validateApiKey,
  validateDeployToken,
  validateApiUrl,
  isDeployment,
  isBlockedExtension,
  BLOCKED_EXTENSIONS,
} from '@shipstatic/types';
```

### File Upload Types

```typescript
import type {
  ValidatableFile,
  FileValidationResult,
  ValidationIssue,
  UploadedFile,
  ProgressInfo,
} from '@shipstatic/types';
```

### Domain Utilities

```typescript
import {
  isPlatformDomain,
  isCustomDomain,
  extractSubdomain,
  generateDeploymentUrl,
  generateDomainUrl,
} from '@shipstatic/types';
```

### Label Utilities

```typescript
import {
  LABEL_CONSTRAINTS,
  LABEL_PATTERN,
  serializeLabels,
  deserializeLabels,
} from '@shipstatic/types';
```

### Constants

```typescript
import {
  DEFAULT_API,
  API_KEY,         // { PREFIX, HEX_LENGTH, TOTAL_LENGTH, HINT_LENGTH }
  DEPLOY_TOKEN,    // { PREFIX, HEX_LENGTH, TOTAL_LENGTH }
  DEPLOYMENT_CONFIG_FILENAME,
} from '@shipstatic/types';
```

## Usage

```typescript
import { ShipError, isShipError, type Deployment, DeploymentStatus } from '@shipstatic/types';

function processDeployment(deployment: Deployment) {
  if (deployment.status === DeploymentStatus.FAILED) {
    throw ShipError.business('Deployment failed');
  }
}
```

## License

MIT
