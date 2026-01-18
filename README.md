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
import type { Deployment, Domain, Account, Token, StaticFile } from '@shipstatic/types';
```

### Error System

```typescript
import { ShipError, ErrorType } from '@shipstatic/types';

throw ShipError.validation('File too large');
throw ShipError.notFound('Deployment', id);

if (error.isClientError()) { /* handle */ }
```

### API Response Types

```typescript
import type {
  DeploymentListResponse,
  DomainListResponse,
  ConfigResponse,
  BillingStatus
} from '@shipstatic/types';
```

### Resource Contracts

SDK interface definitions:

```typescript
import type { DeploymentResource, DomainResource, AccountResource } from '@shipstatic/types';
```

### Validation Utilities

```typescript
import { validateApiKey, validateDeployToken, validateSubdomain } from '@shipstatic/types';
```

### Constants

```typescript
import {
  DEFAULT_API,
  API_KEY_PREFIX,
  DeploymentStatus,
  DomainStatus,
  AccountPlan
} from '@shipstatic/types';
```

## Usage

```typescript
import { ShipError, type Deployment, DeploymentStatus } from '@shipstatic/types';

function processDeployment(deployment: Deployment) {
  if (deployment.status === DeploymentStatus.FAILED) {
    throw ShipError.business('Deployment failed');
  }
}
```

## License

MIT
