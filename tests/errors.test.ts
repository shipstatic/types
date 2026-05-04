import { describe, it, expect } from 'vitest';
import { ErrorType, ShipError, isShipError } from '../src/index';

describe('ShipError construction', () => {
  it('direct constructor sets type, message, status, details and is an Error/ShipError', () => {
    const err = new ShipError(ErrorType.Business, 'Test message', 400, { hint: 'x' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ShipError);
    expect(err.name).toBe('ShipError');
    expect(err.message).toBe('Test message');
    expect(err.type).toBe(ErrorType.Business);
    expect(err.status).toBe(400);
    expect(err.details).toEqual({ hint: 'x' });
  });
});

// Factory tests follow ErrorType enum order. One `it` per factory, asserting
// type, message, status, and (where applicable) details. The principled
// shape variations are documented in JSDoc on each factory.
describe('ShipError factories', () => {
  it('validation → type=Validation, status=400, preserves details', () => {
    const err = ShipError.validation('Validation failed', { field: 'test' });
    expect(err.type).toBe(ErrorType.Validation);
    expect(err.message).toBe('Validation failed');
    expect(err.status).toBe(400);
    expect(err.details).toEqual({ field: 'test' });
  });

  it('notFound → type=NotFound, status=404, message composed from (resource, id?)', () => {
    expect(ShipError.notFound('Domain').message).toBe('Domain not found');
    const err = ShipError.notFound('Domain', 'foo.com');
    expect(err.type).toBe(ErrorType.NotFound);
    expect(err.message).toBe('Domain foo.com not found');
    expect(err.status).toBe(404);
  });

  it('forbidden → type=Forbidden, status=403, preserves details', () => {
    const err = ShipError.forbidden('Account terminated', { reason: 'plan_expired' });
    expect(err.type).toBe(ErrorType.Forbidden);
    expect(err.message).toBe('Account terminated');
    expect(err.status).toBe(403);
    expect(err.isClientError()).toBe(true);
    expect((err.details as { reason?: string } | undefined)?.reason).toBe('plan_expired');
  });

  it('rateLimit → type=RateLimit, status=429, default message', () => {
    expect(ShipError.rateLimit().message).toBe('Too many requests');
    const err = ShipError.rateLimit('Slow down', { retryAfter: 60 });
    expect(err.type).toBe(ErrorType.RateLimit);
    expect(err.message).toBe('Slow down');
    expect(err.status).toBe(429);
    expect((err.details as { retryAfter?: number } | undefined)?.retryAfter).toBe(60);
  });

  it('authentication → type=Authentication, status=401, default message', () => {
    expect(ShipError.authentication().message).toBe('Authentication required');
    const err = ShipError.authentication('Token expired', { hint: 'reauth' });
    expect(err.type).toBe(ErrorType.Authentication);
    expect(err.message).toBe('Token expired');
    expect(err.status).toBe(401);
    expect(err.isAuthError()).toBe(true);
  });

  it('business → type=Business, status defaults to 400, custom status accepted', () => {
    expect(ShipError.business('default').status).toBe(400);
    const err = ShipError.business('Business rule violated', 422);
    expect(err.type).toBe(ErrorType.Business);
    expect(err.message).toBe('Business rule violated');
    expect(err.status).toBe(422);
  });

  it('api → type=Api, status defaults to 500, custom status accepted', () => {
    expect(ShipError.api('default').status).toBe(500);
    const err = ShipError.api('API issue', 503);
    expect(err.type).toBe(ErrorType.Api);
    expect(err.message).toBe('API issue');
    expect(err.status).toBe(503);
  });

  it('network → type=Network, no status, cause stored in details', () => {
    const cause = new Error('Network down');
    const err = ShipError.network('Connection failed', { cause });
    expect(err.type).toBe(ErrorType.Network);
    expect(err.message).toBe('Connection failed');
    expect(err.status).toBeUndefined();
    expect(err.isNetworkError()).toBe(true);
    expect((err.details as { cause?: Error } | undefined)?.cause).toBe(cause);
  });

  it('cancelled → type=Cancelled with no status', () => {
    const err = ShipError.cancelled('Operation was cancelled');
    expect(err.type).toBe(ErrorType.Cancelled);
    expect(err.message).toBe('Operation was cancelled');
    expect(err.status).toBeUndefined();
  });

  it('file → type=File, no status, filePath stored in details', () => {
    const err = ShipError.file('File not found', { filePath: '/path/to/file' });
    expect(err.type).toBe(ErrorType.File);
    expect(err.message).toBe('File not found');
    expect(err.status).toBeUndefined();
    expect((err.details as { filePath?: string } | undefined)?.filePath).toBe('/path/to/file');
  });

  it('config → type=Config with no status', () => {
    const err = ShipError.config('Config is bad');
    expect(err.type).toBe(ErrorType.Config);
    expect(err.message).toBe('Config is bad');
    expect(err.status).toBeUndefined();
  });
});

/**
 * Build a `Response` carrying a JSON body and a given HTTP status.
 * Helper keeps individual tests focused on the assertion, not the plumbing.
 */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ShipError.toResponse()', () => {
  describe('wire format serialization', () => {
    it('serializes type, message, status, details to ErrorResponse shape', () => {
      const original = ShipError.validation('Invalid input', { field: 'email' });
      const response = original.toResponse();
      expect(response.error).toBe(ErrorType.Validation);
      expect(response.message).toBe('Invalid input');
      expect(response.status).toBe(400);
      expect(response.details).toEqual({ field: 'email' });
    });
  });

  // The `internal:` telemetry pattern (see JSDoc on ShipError.authentication
  // and the dedicated subsection in CLAUDE.md): server-side auth code attaches
  // a granular tag like `{ internal: 'jwt_missing_subject' }` to record which
  // strategy/check failed. toResponse() strips the entire details object on
  // Authentication errors when this key is present, so the wire response is
  // a clean "Authentication failed" with no leakage.
  describe('internal: telemetry stripping (Authentication only)', () => {
    it('strips details from Authentication errors when details.internal is set', () => {
      const err = ShipError.authentication('Authentication failed', { internal: 'jwt_missing_subject' });
      const wire = err.toResponse();
      expect(wire.details).toBeUndefined();
      expect(wire.message).toBe('Authentication failed');
      expect(wire.error).toBe(ErrorType.Authentication);
    });

    it('preserves details on Authentication errors when details.internal is absent', () => {
      const err = ShipError.authentication('Token expired', { hint: 'reauth' });
      expect(err.toResponse().details).toEqual({ hint: 'reauth' });
    });

    it('does NOT strip details on non-Authentication errors even when details.internal is set', () => {
      const err = ShipError.validation('bad input', { internal: 'should_not_strip' });
      expect(err.toResponse().details).toEqual({ internal: 'should_not_strip' });
    });

    it('handles Authentication errors with no details at all', () => {
      const err = ShipError.authentication('Authentication required');
      expect(err.toResponse().details).toBeUndefined();
    });
  });
});

describe('ShipError.fromHttpResponse', () => {
  describe('error type derivation by status', () => {
    it('maps 401 → ErrorType.Authentication', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'nope' }, 401),
      );
      expect(err.type).toBe(ErrorType.Authentication);
      expect(err.status).toBe(401);
    });

    it('maps 403 → ErrorType.Forbidden', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'no' }, 403),
      );
      expect(err.type).toBe(ErrorType.Forbidden);
      expect(err.status).toBe(403);
    });

    it('maps 429 → ErrorType.RateLimit', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'slow down' }, 429),
      );
      expect(err.type).toBe(ErrorType.RateLimit);
      expect(err.status).toBe(429);
    });

    it('maps 400 → ErrorType.Api (everything non-special)', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'bad input' }, 400),
      );
      expect(err.type).toBe(ErrorType.Api);
      expect(err.status).toBe(400);
    });

    it('maps 404 → ErrorType.Api', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 404));
      expect(err.type).toBe(ErrorType.Api);
      expect(err.status).toBe(404);
    });

    it('maps 500 → ErrorType.Api', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'server boom' }, 500),
      );
      expect(err.type).toBe(ErrorType.Api);
      expect(err.status).toBe(500);
    });

    it('returns a real ShipError instance (passes isShipError guard)', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 500));
      expect(err).toBeInstanceOf(ShipError);
      expect(isShipError(err)).toBe(true);
    });
  });

  describe('body.error wire round-trip (trusts known ErrorType strings)', () => {
    it('preserves Validation type when body.error is "validation_failed" (status 400)', async () => {
      // Server-thrown ShipError.validation(...) round-trips back as Validation,
      // not as the generic Api type that pure status-derivation would produce.
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Validation, message: 'Email required', status: 400 },
          400,
        ),
      );
      expect(err.type).toBe(ErrorType.Validation);
      expect(err.isClientError()).toBe(true);
    });

    it('preserves NotFound type when body.error is "not_found" (status 404)', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.NotFound, message: 'Domain foo.com not found', status: 404 },
          404,
        ),
      );
      expect(err.type).toBe(ErrorType.NotFound);
    });

    it('falls back to status-derived type when body.error is unknown', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ error: 'totally_made_up_type', message: 'nope' }, 401),
      );
      expect(err.type).toBe(ErrorType.Authentication);
    });

    it('falls back to status-derived type when body.error is missing', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'nope' }, 429),
      );
      expect(err.type).toBe(ErrorType.RateLimit);
    });

    it('trusts body.error even when it disagrees with status (wire is authoritative)', async () => {
      // A 500 carrying a Business error body — server's intent wins. This
      // edge case shouldn't happen in practice (API serializes status from
      // ShipError.status), but if it does, the wire is the source of truth.
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Business, message: 'Plan limit', status: 500 },
          500,
        ),
      );
      expect(err.type).toBe(ErrorType.Business);
      expect(err.status).toBe(500);
    });

    it('does NOT trust body.error when it claims a client-only type (Network)', async () => {
      // Network errors originate on the client (fetch failure). A server
      // sending `error: "network_error"` is misbehaving — we ignore body.error
      // and fall back to status-derived to avoid mistyping a server problem
      // as an offline situation in the UI.
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Network, message: 'misbehaving server', status: 500 },
          500,
        ),
      );
      expect(err.type).toBe(ErrorType.Api);
      expect(err.isNetworkError()).toBe(false);
    });

    it('does NOT trust body.error when it claims a client-only type (Cancelled)', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Cancelled, message: 'misbehaving server', status: 401 },
          401,
        ),
      );
      // Falls back to status-derived: 401 → Authentication
      expect(err.type).toBe(ErrorType.Authentication);
    });

    it('does NOT trust body.error when it claims a client-only type (File)', async () => {
      // File errors originate on the SDK during local file processing — never
      // produced server-side. A misbehaving body claim is ignored.
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.File, message: 'misbehaving server', status: 500 },
          500,
        ),
      );
      expect(err.type).toBe(ErrorType.Api);
    });

    it('does NOT trust body.error when it claims a client-only type (Config)', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Config, message: 'misbehaving server', status: 400 },
          400,
        ),
      );
      expect(err.type).toBe(ErrorType.Api);
    });

    it('preserves Forbidden type when body.error is "forbidden" (status 403)', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Forbidden, message: 'Account terminated', status: 403 },
          403,
        ),
      );
      expect(err.type).toBe(ErrorType.Forbidden);
      expect(err.status).toBe(403);
      expect(err.isClientError()).toBe(true);
    });

    it('maps status 403 to Forbidden when body has no error type', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 403));
      expect(err.type).toBe(ErrorType.Forbidden);
      expect(err.status).toBe(403);
    });
  });

  describe('message resolution', () => {
    it('prefers body.message over body.error', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { message: 'human readable', error: 'machine_readable' },
          400,
        ),
      );
      expect(err.message).toBe('human readable');
    });

    it('falls back to body.error when message is missing', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ error: 'machine_readable' }, 400),
      );
      expect(err.message).toBe('machine_readable');
    });

    it('composes operationName-derived fallback when body has nothing', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({}, 500),
        'Get account',
      );
      expect(err.message).toBe('Get account failed with status 500');
    });

    it('defaults operationName to "Request" when omitted', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 503));
      expect(err.message).toBe('Request failed with status 503');
    });

    it('uses non-JSON response text as message', async () => {
      const res = new Response('Internal Server Error', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
      const err = await ShipError.fromHttpResponse(res);
      expect(err.message).toBe('Internal Server Error');
    });

    it('composes operationName-derived fallback when body is empty (no content-type)', async () => {
      const res = new Response(null, { status: 500 });
      const err = await ShipError.fromHttpResponse(res, 'Ping');
      expect(err.message).toBe('Ping failed with status 500');
    });

    it('tolerates malformed JSON body and composes operationName-derived fallback', async () => {
      const res = new Response('{ not valid json', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
      const err = await ShipError.fromHttpResponse(res, 'Ping');
      expect(err.message).toBe('Ping failed with status 500');
    });

    it('ignores non-string message field', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 123, error: 'fallback' }, 400),
      );
      expect(err.message).toBe('fallback');
    });
  });

  describe('details preservation', () => {
    it('preserves body.details when present', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          {
            message: 'Validation failed',
            error: 'validation_failed',
            details: { field: 'email', reason: 'invalid' },
          },
          400,
        ),
      );
      expect(err.details).toEqual({ field: 'email', reason: 'invalid' });
    });

    it('leaves details undefined when body has none', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'nope' }, 400),
      );
      expect(err.details).toBeUndefined();
    });
  });

  describe('content-type handling', () => {
    it('treats application/json with charset suffix as JSON', async () => {
      const res = new Response(JSON.stringify({ message: 'bad' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const err = await ShipError.fromHttpResponse(res);
      expect(err.message).toBe('bad');
    });

    it('treats missing content-type as non-JSON (uses text body)', async () => {
      const res = new Response('plain message', { status: 500 });
      const err = await ShipError.fromHttpResponse(res);
      expect(err.message).toBe('plain message');
    });
  });
});

describe('ShipError.fromFetchError', () => {
  it('passes through an existing ShipError unchanged (preserves caller intent)', () => {
    const original = ShipError.validation('Email required');
    const result = ShipError.fromFetchError(original, 'Get account');
    expect(result).toBe(original);
  });

  it('maps AbortError to ShipError.cancelled with operation prefix', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    const err = ShipError.fromFetchError(abort, 'Get account');
    expect(err.type).toBe(ErrorType.Cancelled);
    expect(err.message).toBe('Get account was cancelled');
  });

  it('maps fetch TypeError to ShipError.network with operation prefix and cause', () => {
    const networkErr = new TypeError('fetch failed');
    const err = ShipError.fromFetchError(networkErr, 'Ping');
    expect(err.type).toBe(ErrorType.Network);
    expect(err.message).toBe('Ping failed: fetch failed');
    expect(err.isNetworkError()).toBe(true);
    expect((err.details as { cause?: Error })?.cause).toBe(networkErr);
  });

  it('maps any other Error to ErrorType.Api with operation prefix (no HTTP status)', () => {
    const generic = new Error('Something exploded');
    const err = ShipError.fromFetchError(generic, 'List domains');
    expect(err.type).toBe(ErrorType.Api);
    expect(err.message).toBe('List domains failed: Something exploded');
    // No HTTP status — fetch never reached the server
    expect(err.status).toBeUndefined();
  });

  it('maps a non-Error throw (string, undefined) to ErrorType.Api with "Unknown error"', () => {
    const err = ShipError.fromFetchError('weird thing', 'Verify domain');
    expect(err.type).toBe(ErrorType.Api);
    expect(err.message).toBe('Verify domain failed: Unknown error');
    expect(err.status).toBeUndefined();
  });

  it('defaults operationName to "Request" when omitted', () => {
    const generic = new Error('boom');
    const err = ShipError.fromFetchError(generic);
    expect(err.message).toBe('Request failed: boom');
  });
});

