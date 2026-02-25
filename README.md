# @shipstatic/types

Shared TypeScript types for the Shipstatic platform.

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
  Domain, DomainListResponse, DnsRecord, DomainDnsResponse, DomainRecordsResponse, DomainValidateResponse,
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
  ConfigResponse,
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
  BillingResource,
  KeysResource,
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
  API_KEY_PREFIX,
  DEPLOY_TOKEN_PREFIX,
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
