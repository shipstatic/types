/**
 * @file Shared types for Shipstatic platform
 * Simple, clean types that both API and SDK agree on
 */

// =============================================================================
// DEPLOYMENT TYPES
// =============================================================================

/**
 * Core deployment object - used in both API responses and SDK
 */
export interface Deployment {
  /** The deployment ID */
  deployment: string;
  /** Number of files in this deployment */
  files: number;
  /** Total size of all files in bytes */
  size: number;
  /** Current deployment status */
  status: 'pending' | 'success' | 'failed';
  /** Whether deployment has configuration */
  config?: boolean;
  /** The deployment URL */
  url: string;
  /** Unix timestamp (seconds) when deployment was created */
  created: number;
  /** Unix timestamp (seconds) when deployment expires */
  expires?: number;
}


/**
 * Response for listing deployments
 */
export interface DeploymentListResponse {
  /** Array of deployments */
  deployments: Deployment[];
  /** Optional cursor for pagination */
  cursor?: string;
  /** Total number of deployments if available */
  total?: number;
}

// =============================================================================
// ALIAS TYPES
// =============================================================================

/**
 * Core alias object - used in both API responses and SDK
 */
export interface Alias {
  /** The alias name */
  alias: string;
  /** The deployment name this alias points to */
  deployment: string;
  /** Current alias status */
  status: 'pending' | 'success' | 'failed';
  /** The alias URL - internal (subdomain) or external (custom domain) */
  url: string;
  /** Unix timestamp (seconds) when alias was created */
  created: number;
  /** Unix timestamp (seconds) when alias was confirmed */
  confirmed?: number;
  /** Whether this was a create operation (true) or update operation (false). Optional - only present in set operations */
  isCreate?: boolean;
}

/**
 * Response for listing aliases
 */
export interface AliasListResponse {
  /** Array of aliases */
  aliases: Alias[];
  /** Optional cursor for pagination */
  cursor?: string;
  /** Total number of aliases if available */
  total?: number;
}

/**
 * Response for deployment removal
 */
export interface DeploymentRemoveResponse {
  /** Operation success status */
  success: boolean;
  /** The deployment ID */
  deployment: string;
  /** Human-readable message */
  message?: string;
}

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

/**
 * Core account object - used in both API responses and SDK
 */
export interface Account {
  /** User email address */
  email: string;
  /** User display name */
  name: string;
  /** User profile picture URL */
  picture?: string;
  /** Account plan status */
  plan: 'free' | 'active' | 'suspended';
  /** Unix timestamp (seconds) when account was created */
  created: number;
  /** Unix timestamp (seconds) when plan started */
  subscribed?: number;
  /** Unix timestamp (seconds) when account was suspended */
  suspended?: number;
}

// =============================================================================
// ERROR SYSTEM
// =============================================================================

/**
 * All possible error types in the Shipstatic platform
 * Names are developer-friendly while wire format stays consistent
 */
export enum ErrorType {
  /** Validation failed (400) */
  Validation = "validation_failed",
  /** Resource not found (404) */
  NotFound = "not_found", 
  /** Rate limit exceeded (429) */
  RateLimit = "rate_limit_exceeded",
  /** Authentication required (401) */
  Authentication = "authentication_failed",
  /** Business logic error (400) */
  Business = "business_logic_error",
  /** API server error (500) - renamed from Internal for clarity */
  Api = "internal_server_error",
  /** Network/connection error */
  Network = "network_error",
  /** Operation was cancelled */
  Cancelled = "operation_cancelled",
  /** File operation error */
  File = "file_error",
  /** Configuration error */
  Config = "config_error"
}

/** @deprecated Use ErrorType instead. Kept for backward compatibility. */
export const ShipErrorType = ErrorType;

/**
 * Categorizes error types for better type checking
 */
const ERROR_CATEGORIES = {
  client: new Set([ErrorType.Business, ErrorType.Config, ErrorType.File, ErrorType.Validation]),
  network: new Set([ErrorType.Network]),
  auth: new Set([ErrorType.Authentication]),
} as const;

/**
 * Standard error response format used everywhere
 */
export interface ErrorResponse {
  /** Error type identifier */
  error: ErrorType;
  /** Human-readable error message */
  message: string;
  /** HTTP status code (API contexts) */
  status?: number;
  /** Optional additional error details */
  details?: any;
}

/**
 * Simple unified error class for both API and SDK
 */
export class ShipError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly status?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ShipError';
  }

  /** Convert to wire format */
  toResponse(): ErrorResponse {
    return {
      error: this.type,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }

  /** Create from wire format */
  static fromResponse(response: ErrorResponse): ShipError {
    return new ShipError(response.error, response.message, response.status, response.details);
  }

  // Factory methods for common errors
  static validation(message: string, details?: any): ShipError {
    return new ShipError(ErrorType.Validation, message, 400, details);
  }

  static notFound(resource: string, id?: string): ShipError {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`;
    return new ShipError(ErrorType.NotFound, message, 404);
  }

  static rateLimit(message: string = "Too many requests"): ShipError {
    return new ShipError(ErrorType.RateLimit, message, 429);
  }

  static authentication(message: string = "Authentication required"): ShipError {
    return new ShipError(ErrorType.Authentication, message, 401);
  }


  static business(message: string, status: number = 400): ShipError {
    return new ShipError(ErrorType.Business, message, status);
  }

  static network(message: string, cause?: Error): ShipError {
    return new ShipError(ErrorType.Network, message, undefined, { cause });
  }

  static cancelled(message: string): ShipError {
    return new ShipError(ErrorType.Cancelled, message);
  }

  static file(message: string, filePath?: string): ShipError {
    return new ShipError(ErrorType.File, message, undefined, { filePath });
  }

  static config(message: string, details?: any): ShipError {
    return new ShipError(ErrorType.Config, message, undefined, details);
  }

  static api(message: string, status: number = 500, code?: string, data?: any): ShipError {
    return new ShipError(ErrorType.Api, message, status, { code, data });
  }

  static database(message: string, status: number = 500): ShipError {
    return new ShipError(ErrorType.Api, message, status);
  }

  static storage(message: string, status: number = 500): ShipError {
    return new ShipError(ErrorType.Api, message, status);
  }

  // Helper getters for accessing common detail properties
  get filePath(): string | undefined {
    return this.details?.filePath;
  }

  get code(): string | undefined {
    return this.details?.code;
  }

  // Helper methods for error type checking using categorization
  isClientError(): boolean {
    return ERROR_CATEGORIES.client.has(this.type);
  }

  isNetworkError(): boolean {
    return ERROR_CATEGORIES.network.has(this.type);
  }

  isAuthError(): boolean {
    return ERROR_CATEGORIES.auth.has(this.type);
  }

  isValidationError(): boolean {
    return this.type === ErrorType.Validation;
  }

  isFileError(): boolean {
    return this.type === ErrorType.File;
  }

  isConfigError(): boolean {
    return this.type === ErrorType.Config;
  }

  // Generic type checker
  isType(errorType: ErrorType): boolean {
    return this.type === errorType;
  }
}

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Server-side platform configuration - enforced limits on the platform
 */
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



// =============================================================================
// CONFIG TYPES
// =============================================================================

/**
 * Platform configuration response from API
 */
export interface ConfigResponse {
  /** Maximum individual file size in bytes */
  maxFileSize: number;
  /** Maximum number of files per deployment */
  maxFilesCount: number;
  /** Maximum total deployment size in bytes */
  maxTotalSize: number;
}

// =============================================================================
// COMMON RESPONSE PATTERNS  
// =============================================================================

/**
 * Generic success response wrapper
 */
export interface SuccessResponse<T = any> {
  /** Always true for success */
  success: true;
  /** Response data */
  data: T;
}

/**
 * Simple ping response for health checks
 */
export interface PingResponse {
  /** Always true if service is healthy */
  success: boolean;
  /** Optional timestamp */
  timestamp?: number;
}


// API Key Configuration
export const API_KEY_PREFIX = 'ship-';
export const API_KEY_HEX_LENGTH = 64;
export const API_KEY_TOTAL_LENGTH = API_KEY_PREFIX.length + API_KEY_HEX_LENGTH; // 69

// Deployment Configuration
export const DEPLOYMENT_CONFIG_FILENAME = 'ship.json';

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): void {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    throw ShipError.validation(`API key must start with "${API_KEY_PREFIX}"`);
  }
  
  if (apiKey.length !== API_KEY_TOTAL_LENGTH) {
    throw ShipError.validation(`API key must be ${API_KEY_TOTAL_LENGTH} characters total (${API_KEY_PREFIX} + ${API_KEY_HEX_LENGTH} hex chars)`);
  }
  
  const hexPart = apiKey.slice(API_KEY_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(hexPart)) {
    throw ShipError.validation(`API key must contain ${API_KEY_HEX_LENGTH} hexadecimal characters after "${API_KEY_PREFIX}" prefix`);
  }
}

/**
 * Validate API URL format
 */
export function validateApiUrl(apiUrl: string): void {
  try {
    const url = new URL(apiUrl);
    
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw ShipError.validation('API URL must use http:// or https:// protocol');
    }
    
    if (url.pathname !== '/' && url.pathname !== '') {
      throw ShipError.validation('API URL must not contain a path');
    }
    
    if (url.search || url.hash) {
      throw ShipError.validation('API URL must not contain query parameters or fragments');
    }
  } catch (error) {
    if (error instanceof ShipError) {
      throw error;
    }
    throw ShipError.validation('API URL must be a valid URL');
  }
}