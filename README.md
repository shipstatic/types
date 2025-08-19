# @shipstatic/types

Shared TypeScript types, constants, and utilities for the Shipstatic platform. This package is the single source of truth for all shared data structures used across the API, SDK, and CLI.

## Overview

This package contains all shared types used between:
- **Shipstatic API** (`/cloudflare/api`) - Backend API on Cloudflare Workers
- **Shipstatic SDK** (`/ship`) - Universal SDK for Node.js and Browser
- **Shipstatic CLI** - Command-line interface

## Core Entities

### Deployment

```typescript
interface Deployment {
  deployment: string;           // Deployment ID (e.g., "happy-cat-abc1234")
  files: number;               // Number of files in deployment
  size: number;                // Total size in bytes
  status: 'pending' | 'success' | 'failed' | 'deleting';
  config?: boolean;            // Whether deployment has ship.json
  url: string;                 // Deployment URL
  created: number;             // Unix timestamp (seconds)
  expires?: number;            // Unix timestamp (seconds)
  verified?: number;           // Unix timestamp (seconds) when verified
}
```

### Alias

```typescript
interface Alias {
  alias: string;               // Alias name (subdomain or custom domain)
  deployment: string;          // Target deployment ID
  status: 'pending' | 'success' | 'failed';
  url: string;                 // Alias URL
  created: number;             // Unix timestamp (seconds)
  confirmed?: number;          // Unix timestamp (seconds) when confirmed
  isCreate?: boolean;          // Present in set operations only
}
```

### Account

```typescript
interface Account {
  email: string;               // User email address
  name: string;                // User display name
  picture?: string;            // Profile picture URL
  plan: 'free' | 'active' | 'suspended';  // Account plan status
  created: number;             // Unix timestamp (seconds)
  subscribed?: number;         // Unix timestamp (seconds) when plan started
  suspended?: number;          // Unix timestamp (seconds) when suspended
}
```

### Static File

```typescript
interface StaticFile {
  content: File | Buffer | Blob;  // File content
  path: string;                   // Server path (e.g., "assets/style.css")
  filePath?: string;              // Original filesystem path (Node.js)
  md5?: string;                   // MD5 hash of content
  size: number;                   // File size in bytes
}
```

## API Response Types

### Success Responses

```typescript
interface DeploymentListResponse {
  deployments: Deployment[];
  cursor?: string;             // Pagination cursor
  total?: number;              // Total count if available
}

interface AliasListResponse {
  aliases: Alias[];
  cursor?: string;
  total?: number;
}

interface SuccessResponse<T = any> {
  success: true;
  data: T;
}
```

### Configuration

```typescript
interface ConfigResponse {
  maxFileSize: number;         // Maximum file size in bytes
  maxFilesCount: number;       // Maximum files per deployment
  maxTotalSize: number;        // Maximum total deployment size
}

interface PlatformConfig {
  apiUrl?: string;
  deployToken?: string;
  apiKey?: string;
}
```

### SPA Detection

```typescript
interface SPACheckRequest {
  files: string[];             // Array of file paths
  index: string;               // Index file path
}

interface SPACheckResponse {
  isSPA: boolean;              // Whether it's detected as SPA
  debug: {
    tier: 'exclusions' | 'inclusions' | 'scoring' | 'ai' | 'fallback';
    reason: string;
  };
}
```

## Resource Interface Contracts

These interfaces define the contracts that all SDK implementations must follow:

```typescript
interface DeploymentResource {
  create: (input: DeployInput, options?: any) => Promise<Deployment>;
  list: () => Promise<DeploymentListResponse>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => Promise<Deployment>;
}

interface AliasResource {
  set: (aliasName: string, deployment: string) => Promise<Alias>;
  get: (aliasName: string) => Promise<Alias>;
  list: () => Promise<AliasListResponse>;
  remove: (aliasName: string) => Promise<void>;
  check: (aliasName: string) => Promise<{ message: string }>;
}

interface AccountResource {
  get: () => Promise<Account>;
}

interface KeysResource {
  create: () => Promise<{ apiKey: string }>;
}
```

## Error System

### Unified Error Handling

```typescript
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

interface ErrorResponse {
  error: ErrorType;
  message: string;
  status?: number;
  details?: any;
}

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
  static business(message: string, status?: number): ShipError;
  static network(message: string, cause?: Error): ShipError;
  static api(message?: string, status?: number): ShipError;
  
  // Helper methods
  isClientError(): boolean;
  isNetworkError(): boolean;
  isAuthError(): boolean;
  toResponse(): ErrorResponse;
}
```

## Platform Constants

```typescript
// API configuration
const DEFAULT_API = 'https://api.shipstatic.com';

// Server configuration limits
const serverConfig = {
  maxFileSize: 10 * 1024 * 1024,        // 10MB
  maxFilesCount: 1000,                  // Files per deployment
  maxTotalSize: 100 * 1024 * 1024,      // 100MB total
  deploymentExpiryHours: 168,           // 7 days
  defaultLimit: 50,                     // Pagination default
  maxLimit: 100,                        // Pagination maximum
} as const;

// API key format validation
const API_KEY_PREFIX = 'ship-';
const API_KEY_HEX_LENGTH = 64;
const API_KEY_TOTAL_LENGTH = 69; // 'ship-' + 64 hex chars
```

## Upload Types

```typescript
enum UploadStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  DELETING = 'deleting'
}

interface UploadedFile {
  key: string;                 // Storage key
  etag: string;                // ETag from storage
  size: number;                // File size in bytes
  validated?: boolean;         // Whether file was validated
}

interface RateLimitData {
  count: number;               // Current request count
  timestamp: number;           // Window start timestamp
}
```

## Validation Utilities

```typescript
// Validate API key format
function validateApiKey(apiKey: string): void;

// Validate deploy token format  
function validateDeployToken(deployToken: string): void;

// Validate API URL format
function validateApiUrl(apiUrl: string): void;

// Validate deployment subdomain format
function validateSubdomain(input: string): boolean;
```

## URL Generation

```typescript
// Generate deployment URL
function generateDeploymentUrl(deployment: string, sitesDomain?: string): string;

// Generate alias URL (handles both subdomains and custom domains)
function generateAliasUrl(alias: string, sitesDomain?: string): string;
```

## Usage Examples

### In the API

```typescript
import { 
  serverConfig, 
  ShipError, 
  type ConfigResponse,
  type Deployment 
} from '@shipstatic/types';

// Use shared configuration
const config: ConfigResponse = {
  maxFileSize: serverConfig.maxFileSize,
  maxFilesCount: serverConfig.maxFilesCount,
  maxTotalSize: serverConfig.maxTotalSize,
};

// Use unified error handling
throw ShipError.validation('File too large', { 
  maxSize: serverConfig.maxFileSize 
});
```

### In the SDK

```typescript
import { 
  ShipError, 
  type ConfigResponse, 
  type DeploymentListResponse,
  generateDeploymentUrl
} from '@shipstatic/types';

// Handle API responses
const deployments: DeploymentListResponse = await api.listDeployments();

// Generate URLs consistently
const url = generateDeploymentUrl('happy-cat-abc1234');

// Handle errors consistently
try {
  const result = await deploy(files);
} catch (error) {
  if (error instanceof ShipError && error.isClientError()) {
    // Handle client errors
  }
}
```

## Installation

This package is automatically installed as a dependency:

```bash
# Included with Ship SDK
npm install @shipstatic/ship

# Direct installation (if needed)
npm install @shipstatic/types
```

## Architecture

### Design Principles

- **Single source of truth** - All types defined once, used everywhere
- **Type safety** - Strict TypeScript with comprehensive validation
- **Wire format compatibility** - Types match actual API contracts
- **Error consistency** - Unified error handling across all components
- **Platform contracts** - Resource interfaces define SDK behavior

### Type Organization

All types are organized in a single `src/index.ts` file by category:

1. **Core entities** - Deployment, Alias, Account objects
2. **API responses** - Response wrappers and pagination
3. **Resource contracts** - SDK interface definitions
4. **Error system** - Unified ShipError class and error types
5. **Platform configuration** - Shared constants and validation
6. **Upload types** - File handling and status enums
7. **Utility functions** - URL generation and validation

## Philosophy

This package follows the **"Impossible Simplicity"** principle:

- **Clear contracts** - Types define platform behavior
- **Zero duplication** - Single source prevents drift
- **Developer experience** - Predictable, well-documented interfaces
- **Maintainability** - Easy to update types across entire platform

The result is type-safe development across the entire Shipstatic platform with guaranteed consistency between API, SDK, and CLI components.

---

**@shipstatic/types** - The foundation of type safety for Shipstatic 🚢