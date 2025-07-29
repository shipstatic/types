# Shipstatic Types

Shared TypeScript types and constants for the Shipstatic platform. This package provides a single source of truth for types, errors, and configuration across the Shipstatic ecosystem.

## Overview

This package contains all shared types used between:
- **Shipstatic API** (`/cloudflare/api`) - Backend API on Cloudflare Workers
- **Shipstatic SDK** (`/ship`) - Universal SDK for Node.js and Browser
- **Shipstatic CLI** - Command-line interface

## Core Types

### Deployment Types

```typescript
// Core deployment object
interface Deployment {
  deployment: string;         // Deployment ID
  files: number;             // Number of files
  size: number;              // Total size in bytes
  status: 'pending' | 'success' | 'failed';
  created: number;           // Unix timestamp
  expires?: number;          // Unix timestamp
  verified?: number;         // Unix timestamp
}

// Successful deployment response
interface DeploySuccessResponse {
  success: true;
  deployment: string;
  expires: number;
  files: number;
  size: number;
}

// Deployment list response
interface DeploymentListResponse {
  deployments: Deployment[];
  cursor?: string;
  total?: number;
}
```

### Alias Types

```typescript
// Core alias object
interface Alias {
  alias: string;             // Alias name
  deployment: string;        // Target deployment ID
  status: 'pending' | 'success' | 'failed';
  created: number;           // Unix timestamp
  confirmed?: number;        // Unix timestamp
}

// Alias list response
interface AliasListResponse {
  aliases: Alias[];
  cursor?: string;
  total?: number;
}
```

### Account Types

```typescript
// Core account object
interface Account {
  email: string;
  name: string;
  picture?: string;
  subscription: 'free' | 'active' | 'suspended';
  created: number;           // Unix timestamp
  subscribed?: number;       // Unix timestamp
  suspended?: number;        // Unix timestamp
}
```

### Platform Configuration

```typescript
// Dynamic platform configuration from API
interface ConfigResponse {
  maxFileSize: number;       // Maximum file size in bytes
  maxFilesCount: number;     // Maximum files per deployment
  maxTotalSize: number;      // Maximum total deployment size
}
```

## Error System

### Unified Error Handling

```typescript
// All possible error types
enum ErrorType {
  Validation = "validation_failed",
  NotFound = "not_found",
  RateLimit = "rate_limit_exceeded",
  Authentication = "authentication_failed",
  Business = "business_logic_error",
  Api = "internal_server_error",
  Network = "network_error",
  Cancelled = "operation_cancelled",
  File = "file_error",
  Config = "config_error"
}

// Standard error response format
interface ErrorResponse {
  error: ErrorType;
  message: string;
  status?: number;
  details?: any;
}

// Unified error class for both API and SDK
class ShipError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly status?: number,
    public readonly details?: any
  );

  // Factory methods
  static validation(message: string, details?: any): ShipError;
  static notFound(resource: string, id?: string): ShipError;
  static authentication(message?: string): ShipError;
  static client(message: string, details?: any): ShipError;
  
  // Helper methods
  isClientError(): boolean;
  isNetworkError(): boolean;
  isAuthError(): boolean;
}
```

## Platform Configuration

### Shared Constants

```typescript
// Server-side platform configuration
export const serverConfig = {
  /** Maximum individual file size in bytes (10MB) */
  maxFileSize: 10 * 1024 * 1024,
  /** Maximum number of files per deployment */
  maxFilesCount: 1000,
  /** Maximum total deployment size in bytes (100MB) */
  maxTotalSize: 100 * 1024 * 1024,
  /** Deployment expiry in hours */
  deploymentExpiryHours: 168, // 7 days
  /** Pagination limits */
  defaultLimit: 50,
  maxLimit: 100,
} as const;

// Client-side configuration - conservative defaults for SDK/CLI
export const clientConfig = {
  /** Conservative file size limit for client validation (5MB) */
  maxFileSize: 5 * 1024 * 1024,
  /** Conservative file count limit for client validation */
  maxFilesCount: 100,
  /** Conservative total size limit for client validation (25MB) */
  maxTotalSize: 25 * 1024 * 1024,
} as const;
```

### Dynamic Configuration

The platform provides dynamic configuration through the API's `/config` endpoint:

```json
{
  "maxFileSize": 10485760,     // 10MB
  "maxFilesCount": 1000,       // Files per deployment  
  "maxTotalSize": 104857600    // 100MB total
}
```

**Benefits:**
- **Single source of truth** - Configuration defined once in `serverConfig`
- **Dynamic updates** - API can adjust limits without code changes
- **SDK synchronization** - SDK automatically fetches current limits
- **Type safety** - Shared `ConfigResponse` interface ensures consistency

## Usage

### In Ship API

```typescript
import { serverConfig, ShipError, type ConfigResponse } from '@shipstatic/types';

// Use shared configuration constants
const config: ConfigResponse = {
  maxFileSize: serverConfig.maxFileSize,
  maxFilesCount: serverConfig.maxFilesCount,
  maxTotalSize: serverConfig.maxTotalSize,
};

// Use unified error handling
throw ShipError.validation('File too large', { maxSize: serverConfig.maxFileSize });
```

### In Ship SDK

```typescript
import { ShipError, type ConfigResponse, type DeploySuccessResponse } from '@shipstatic/types';

// Receive platform configuration
const config: ConfigResponse = await api.getConfig();

// Handle errors consistently
try {
  const result: DeploySuccessResponse = await deploy(files);
} catch (error) {
  if (error instanceof ShipError) {
    // Handle Ship-specific errors
  }
}
```

## Installation

This package is automatically installed as a dependency of the Ship SDK and API:

```bash
# Direct installation (if needed)
npm install @shipstatic/types
```

## Architecture

### Design Principles

- **Single source of truth** - All types defined once, used everywhere
- **Type safety** - Strict TypeScript with no `any` types
- **Wire format compatibility** - Types match API request/response formats
- **Error consistency** - Unified error handling across all components
- **Configuration sharing** - Shared constants prevent drift

### Package Structure

```
/types/src/
└── index.ts              # All types and exports in single file
```

### Type Organization

All types are organized in a single `index.ts` file by category:

- **Core entities** - Deployment, Alias, Account objects
- **API responses** - Success/error response wrappers  
- **Configuration** - `serverConfig` and `clientConfig` with platform limits
- **Error system** - Unified `ShipError` class with factory methods
- **Common patterns** - Shared response formats and interfaces

## Philosophy

This package follows the **"Impossible Simplicity"** principle:

- **Do more with less** - Maximum type safety with minimal complexity
- **Single source of truth** - Types defined once, used everywhere
- **Wire format compatibility** - Types match actual API contracts
- **Developer experience** - Clear, predictable type interfaces
- **Maintainability** - Easy to update types across entire platform

**Result:** Type-safe development across the entire Ship platform with zero type drift between components.

---

**Ship Types** - Shared types for the Ship platform 🚢