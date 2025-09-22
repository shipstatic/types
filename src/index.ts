/**
 * @file Shared TypeScript types, constants, and utilities for the Shipstatic platform.
 * This package is the single source of truth for all shared data structures.
 */

// =============================================================================
// I. CORE ENTITIES
// =============================================================================

/**
 * Deployment status constants
 */
export const DeploymentStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  DELETING: 'deleting'
} as const;

export type DeploymentStatusType = typeof DeploymentStatus[keyof typeof DeploymentStatus];

/**
 * Core deployment object - used in both API responses and SDK
 */
export interface Deployment {
  /** The deployment ID */
  readonly deployment: string;
  /** Number of files in this deployment */
  readonly files: number;
  /** Total size of all files in bytes */
  readonly size: number;
  /** Current deployment status */
  status: DeploymentStatusType; // Mutable - can be updated
  /** Whether deployment has configuration */
  readonly config?: boolean;
  /** The deployment URL */
  readonly url: string;
  /** Unix timestamp (seconds) when deployment was created */
  readonly created: number;
  /** Unix timestamp (seconds) when deployment expires */
  expires?: number; // Mutable - can be updated
  /** Unix timestamp (seconds) when deployment was verified and ready */
  verified?: number; // Mutable - can be updated  
  /** Short-lived JWT token for claiming this deployment (only present for public deployments) */
  claimToken?: string; // Mutable - can be updated
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
 * Alias status constants
 */
export const AliasStatus = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  CONFIRMED: 'confirmed',
  FAILED: 'failed'
} as const;

export type AliasStatusType = typeof AliasStatus[keyof typeof AliasStatus];

/**
 * Core alias object - used in both API responses and SDK
 */
export interface Alias {
  /** The alias name */
  readonly alias: string;
  /** The deployment name this alias points to */
  deployment: string; // Mutable - can be updated to point to different deployment
  /** Current alias status */
  status: AliasStatusType; // Mutable - can be updated
  /** The alias URL - internal (subdomain) or external (custom domain) */
  readonly url: string;
  /** Unix timestamp (seconds) when alias was created */
  readonly created: number;
  /** Whether this was a create (201) or update (200) operation */
  readonly isCreate?: boolean;
  /** Unix timestamp (seconds) when alias was confirmed */
  confirmed?: number; // Mutable - can be updated
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
 * Account plan constants
 */
export const AccountPlan = {
  FREE: 'free',
  PAID: 'paid',
  PARTNER: 'partner',
  SUSPENDED: 'suspended',
  TERMINATING: 'terminating',
  TERMINATED: 'terminated'
} as const;

export type AccountPlanType = typeof AccountPlan[keyof typeof AccountPlan];

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
  plan: AccountPlanType;
  /** Unix timestamp (seconds) when account was created */
  created: number;
  /** Unix timestamp (seconds) when account was activated (first deployment) */
  activated?: number;
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
    // For security, exclude internal details from authentication errors in API responses
    const details = this.type === ErrorType.Authentication && this.details?.internal 
      ? undefined 
      : this.details;
      
    return {
      error: this.type,
      message: this.message,
      status: this.status,
      details
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

  static authentication(message: string = "Authentication required", details?: any): ShipError {
    return new ShipError(ErrorType.Authentication, message, 401, details);
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

// Deploy Token Configuration
export const DEPLOY_TOKEN_PREFIX = 'token-';
export const DEPLOY_TOKEN_HEX_LENGTH = 64;
export const DEPLOY_TOKEN_TOTAL_LENGTH = DEPLOY_TOKEN_PREFIX.length + DEPLOY_TOKEN_HEX_LENGTH; // 70

// Authentication Method Constants
export const AuthMethod = {
  JWT: 'jwt',
  API_KEY: 'apiKey', 
  TOKEN: 'token'
} as const;

export type AuthMethodType = typeof AuthMethod[keyof typeof AuthMethod];

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
 * Validate deploy token format
 */
export function validateDeployToken(deployToken: string): void {
  if (!deployToken.startsWith(DEPLOY_TOKEN_PREFIX)) {
    throw ShipError.validation(`Deploy token must start with "${DEPLOY_TOKEN_PREFIX}"`);
  }
  
  if (deployToken.length !== DEPLOY_TOKEN_TOTAL_LENGTH) {
    throw ShipError.validation(`Deploy token must be ${DEPLOY_TOKEN_TOTAL_LENGTH} characters total (${DEPLOY_TOKEN_PREFIX} + ${DEPLOY_TOKEN_HEX_LENGTH} hex chars)`);
  }
  
  const hexPart = deployToken.slice(DEPLOY_TOKEN_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(hexPart)) {
    throw ShipError.validation(`Deploy token must contain ${DEPLOY_TOKEN_HEX_LENGTH} hexadecimal characters after "${DEPLOY_TOKEN_PREFIX}" prefix`);
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

/**
 * Validate subdomain format (deployment pattern)
 */
export function validateSubdomain(input: string): boolean {
  // Deployment subdomain format: word-word-7chars (e.g. "happy-cat-abc1234")
  return /^[a-z]+-[a-z]+-[a-z0-9]{7}$/i.test(input);
}

// =============================================================================
// SPA CHECK TYPES
// =============================================================================

/**
 * Request payload for SPA check endpoint
 */
export interface SPACheckRequest {
  /** Array of file paths */
  files: string[];
  /** HTML content of index.html file */
  index: string;
}

/**
 * Response from SPA check endpoint
 */
export interface SPACheckResponse {
  /** Whether the project is detected as a Single Page Application */
  isSPA: boolean;
  /** Debugging information about detection */
  debug: {
    /** Which tier made the detection: 'exclusions', 'inclusions', 'scoring', 'ai', or 'fallback' */
    tier: 'exclusions' | 'inclusions' | 'scoring' | 'ai' | 'fallback';
    /** The reason for the detection result */
    reason: string;
  };
}

// =============================================================================
// STATIC FILE REPRESENTATION
// =============================================================================

/**
 * Represents a file that has been processed and is ready for deploy.
 * Used across the platform (API, SDK, CLI) for file operations.
 */
export interface StaticFile {
  /**
   * The content of the file.
   * In Node.js, this is typically a `Buffer`.
   * In the browser, this is typically a `File` or `Blob` object.
   */
  content: File | Buffer | Blob;
  /**
   * The desired path for the file on the server, relative to the deployment root.
   * Should include the filename, e.g., `images/photo.jpg`.
   */
  path: string;
  /**
   * The original absolute file system path (primarily used in Node.js environments).
   * This helps in debugging or associating the server path back to its source.
   */
  filePath?: string;
  /**
   * The MD5 hash (checksum) of the file's content.
   * This is calculated by the SDK before deploy if not provided.
   */
  md5?: string;
  /** The size of the file in bytes. */
  size: number;
}

// =============================================================================
// PLATFORM CONFIGURATION
// =============================================================================

/**
 * Standard platform configuration format used by all clients
 */
export interface PlatformConfig {
  apiUrl?: string;
  deployToken?: string;
  apiKey?: string;
}

// =============================================================================
// PLATFORM CONSTANTS
// =============================================================================

/** Default API URL if not otherwise configured. */
export const DEFAULT_API = 'https://api.shipstatic.com';

// =============================================================================
// RESOURCE INTERFACE CONTRACTS
// =============================================================================

/**
 * Universal deploy input type for all environments.
 * - File[] | FileList: Browser environments (file upload)
 * - string: Node.js environments (file/directory path)
 */
export type DeployInput = File[] | FileList | string;

/**
 * Deployment resource interface - the contract all implementations must follow
 */
export interface DeploymentResource {
  create: (input: DeployInput, options?: any) => Promise<Deployment>;
  list: () => Promise<DeploymentListResponse>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => Promise<Deployment>;
}

/**
 * Alias resource interface - the contract all implementations must follow
 */
export interface AliasResource {
  set: (aliasName: string, deployment: string) => Promise<Alias>;
  get: (aliasName: string) => Promise<Alias>;
  list: () => Promise<AliasListResponse>;
  remove: (aliasName: string) => Promise<void>;
  check: (aliasName: string) => Promise<{ message: string }>;
}

/**
 * Account resource interface - the contract all implementations must follow
 */
export interface AccountResource {
  get: () => Promise<Account>;
}

/**
 * Keys resource interface - the contract all implementations must follow
 */
export interface KeysResource {
  create: () => Promise<{ apiKey: string }>;
}

// =============================================================================
// FILE UPLOAD TYPES
// =============================================================================

/**
 * Represents a file that has been uploaded and stored
 */
export interface UploadedFile {
  key: string;
  etag: string;
  size: number;
  validated?: boolean;
}

/**
 * Rate limiting data structure
 */
export interface RateLimitData {
  count: number;
  timestamp: number;
}

// =============================================================================
// URL GENERATION UTILITIES
// =============================================================================

/**
 * Generate deployment URL from deployment ID and sites domain
 */
export function generateDeploymentUrl(deployment: string, sitesDomain?: string): string {
  const domain = sitesDomain || 'statichost.com';
  return `https://${deployment}.${domain}`;
}

/**
 * Generate alias URL based on whether it's internal (subdomain) or external (custom domain)
 */
export function generateAliasUrl(alias: string, sitesDomain?: string): string {
  // If alias contains dots, it's an external domain
  if (alias.includes('.')) {
    return `https://${alias}`;
  }
  
  // Otherwise it's an internal subdomain
  const domain = sitesDomain || 'statichost.dev';
  return `https://${alias}.${domain}`;
}