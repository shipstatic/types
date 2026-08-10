import { describe, expect, it } from 'vitest';
import { assertShipJsonSyntax, ErrorType, isShipError, ShipError } from '../src/index';

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

  it('maintenance → type=Maintenance, status fixed at 503, preserves details', () => {
    // The only factory with a FIXED status rather than a defaulted one: a
    // maintenance refusal is 503 or it is not this error.
    const err = ShipError.maintenance('Back at 14:30 UTC.', { window: 'db-migration' });
    expect(err.type).toBe(ErrorType.Maintenance);
    expect(err.message).toBe('Back at 14:30 UTC.');
    expect(err.status).toBe(503);
    expect(err.details).toEqual({ window: 'db-migration' });
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

describe('semantic categories', () => {
  /**
   * The classification law consumers depend on: an error is auth, network,
   * client, or a server fault — and only the last renders as a generic
   * "something broke on our side". Anything client-attributable must be
   * recognised as such, or the platform takes the blame for a caller's
   * mistake and buries the server's own message.
   */
  it('classifies every client-attributable factory, by type or by status', () => {
    const clientAttributable = [
      ShipError.validation('v'),
      ShipError.notFound('Resource'),
      ShipError.forbidden('f'),
      ShipError.rateLimit(),
      ShipError.authentication(),
      ShipError.business('b'),
      ShipError.config('c'),
      ShipError.file('f'),
    ];

    for (const err of clientAttributable) {
      expect(
        err.isAuthError() || err.isClientError(),
        `${err.type} would render as a server fault`,
      ).toBe(true);
    }
  });

  it('recognises a 4xx even when the type is the status-derived fallback', () => {
    // `fromHttpResponse` trusts `body.error` only when it names a
    // server-producible type. A non-OK response without one — a CDN 404, an
    // intermediary, a misrouted request — arrives as `Api` at a 4xx status,
    // a server-fault TYPE carrying a client STATUS.
    expect(new ShipError(ErrorType.Api, 'Domain not found', 404).isClientError()).toBe(true);
    expect(new ShipError(ErrorType.Api, 'Already exists', 409).isClientError()).toBe(true);
  });

  it('keeps notFound and rateLimit client-attributable by type', () => {
    expect(ShipError.notFound('Deployment', 'abc').isClientError()).toBe(true);
    expect(ShipError.rateLimit().isClientError()).toBe(true);
  });

  it('classifies statusless local faults by type, since there is no status to read', () => {
    // Raised by the SDK before any response exists — the second arm cannot
    // help, so the type set must carry them.
    expect(ShipError.config('bad ship.json').status).toBeUndefined();
    expect(ShipError.config('bad ship.json').isClientError()).toBe(true);
    expect(ShipError.file('unreadable').isClientError()).toBe(true);
  });

  it('leaves genuine server faults uncategorised, so they render generically', () => {
    for (const err of [ShipError.api('boom'), ShipError.api('down', 503)]) {
      expect(err.isClientError()).toBe(false);
      expect(err.isAuthError()).toBe(false);
      expect(err.isNetworkError()).toBe(false);
    }
  });

  it("leaves maintenance uncategorised — it is a state, not anyone's fault", () => {
    // Not client (the caller did nothing wrong), not auth, not network. It
    // renders through the generic arm on purpose, where every surface shows
    // the operator's own sentence verbatim.
    const err = ShipError.maintenance('Back shortly.');
    expect(err.isClientError()).toBe(false);
    expect(err.isAuthError()).toBe(false);
    expect(err.isNetworkError()).toBe(false);
  });

  it('treats network as its own category, not a client fault', () => {
    const net = ShipError.network('offline');
    expect(net.isNetworkError()).toBe(true);
    expect(net.isClientError()).toBe(false);
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
      const err = ShipError.authentication('Authentication failed', {
        internal: 'jwt_missing_subject',
      });
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
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'nope' }, 401));
      expect(err.type).toBe(ErrorType.Authentication);
      expect(err.status).toBe(401);
    });

    it('maps 403 → ErrorType.Forbidden', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'no' }, 403));
      expect(err.type).toBe(ErrorType.Forbidden);
      expect(err.status).toBe(403);
    });

    it('maps 429 → ErrorType.RateLimit', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'slow down' }, 429));
      expect(err.type).toBe(ErrorType.RateLimit);
      expect(err.status).toBe(429);
    });

    it('maps 400 → ErrorType.Api (everything non-special)', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'bad input' }, 400));
      expect(err.type).toBe(ErrorType.Api);
      expect(err.status).toBe(400);
    });

    it('maps 404 → ErrorType.Api', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 404));
      expect(err.type).toBe(ErrorType.Api);
      expect(err.status).toBe(404);
    });

    it('maps 500 → ErrorType.Api', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'server boom' }, 500));
      expect(err.type).toBe(ErrorType.Api);
      expect(err.status).toBe(500);
    });

    it('returns a real ShipError instance (passes isShipError guard)', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 500));
      expect(err).toBeInstanceOf(ShipError);
      expect(isShipError(err)).toBe(true);
    });
  });

  describe('Retry-After header lifting', () => {
    const withRetryAfter = (body: unknown, status: number, retryAfter: string): Response =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', 'retry-after': retryAfter },
      });

    it('lifts a seconds-form Retry-After into details', async () => {
      const err = await ShipError.fromHttpResponse(
        withRetryAfter(
          { error: 'rate_limit_exceeded', message: 'slow down', status: 429 },
          429,
          '60',
        ),
      );
      expect(err.type).toBe(ErrorType.RateLimit);
      expect((err.details as { retryAfter?: number }).retryAfter).toBe(60);
    });

    it('lifts Retry-After on a maintenance 503, so a client backs off from the typed error alone', async () => {
      const err = await ShipError.fromHttpResponse(
        withRetryAfter(
          { error: ErrorType.Maintenance, message: 'Back shortly.', status: 503 },
          503,
          '60',
        ),
      );
      expect(err.type).toBe(ErrorType.Maintenance);
      expect((err.details as { retryAfter?: number }).retryAfter).toBe(60);
    });

    it('parses an HTTP-date Retry-After into seconds', async () => {
      const inThirty = new Date(Date.now() + 30_000).toUTCString();
      const err = await ShipError.fromHttpResponse(withRetryAfter({}, 503, inThirty));
      const retryAfter = (err.details as { retryAfter?: number }).retryAfter;
      expect(retryAfter).toBeGreaterThanOrEqual(28);
      expect(retryAfter).toBeLessThanOrEqual(31);
    });

    it('preserves body details and merges beside them', async () => {
      const err = await ShipError.fromHttpResponse(
        withRetryAfter(
          { message: 'slow down', details: { resetAt: '2026-01-01T00:00:00Z' } },
          429,
          '60',
        ),
      );
      expect(err.details).toEqual({ resetAt: '2026-01-01T00:00:00Z', retryAfter: 60 });
    });

    it('never overwrites a body-carried retryAfter', async () => {
      const err = await ShipError.fromHttpResponse(
        withRetryAfter({ message: 'slow down', details: { retryAfter: 5 } }, 429, '60'),
      );
      expect((err.details as { retryAfter?: number }).retryAfter).toBe(5);
    });

    it('leaves details untouched when the header is absent', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'slow down' }, 429));
      expect(err.details).toBeUndefined();
    });

    it('ignores an unparseable header value', async () => {
      const err = await ShipError.fromHttpResponse(withRetryAfter({}, 429, 'soonish'));
      expect(err.details).toBeUndefined();
    });
  });

  describe('body.error wire round-trip (trusts known ErrorType strings)', () => {
    it('preserves Validation type when body.error is "validation_failed" (status 400)', async () => {
      // Server-thrown ShipError.validation(...) round-trips back as Validation,
      // not as the generic Api type that pure status-derivation would produce.
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ error: ErrorType.Validation, message: 'Email required', status: 400 }, 400),
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

    it('preserves Maintenance type when body.error is "maintenance" (status 503)', async () => {
      // The type IS the point. Without it a closed platform arrives as `Api`
      // — literally "internal_server_error" — and every consumer says
      // "something broke" about a state the operator chose deliberately.
      const err = await ShipError.fromHttpResponse(
        jsonResponse(
          { error: ErrorType.Maintenance, message: 'Back at 14:30 UTC.', status: 503 },
          503,
        ),
      );
      expect(err.type).toBe(ErrorType.Maintenance);
      expect(err.status).toBe(503);
      expect(err.isClientError()).toBe(false);
    });

    it('falls back to status-derived type when body.error is unknown', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ error: 'totally_made_up_type', message: 'nope' }, 401),
      );
      expect(err.type).toBe(ErrorType.Authentication);
    });

    it('falls back to status-derived type when body.error is missing', async () => {
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'nope' }, 429));
      expect(err.type).toBe(ErrorType.RateLimit);
    });

    it('trusts body.error even when it disagrees with status (wire is authoritative)', async () => {
      // A 500 carrying a Business error body — server's intent wins. This
      // edge case shouldn't happen in practice (API serializes status from
      // ShipError.status), but if it does, the wire is the source of truth.
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ error: ErrorType.Business, message: 'Plan limit', status: 500 }, 500),
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
        jsonResponse({ error: ErrorType.Network, message: 'misbehaving server', status: 500 }, 500),
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
        jsonResponse({ error: ErrorType.File, message: 'misbehaving server', status: 500 }, 500),
      );
      expect(err.type).toBe(ErrorType.Api);
    });

    it('does NOT trust body.error when it claims a client-only type (Config)', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ error: ErrorType.Config, message: 'misbehaving server', status: 400 }, 400),
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
        jsonResponse({ message: 'human readable', error: 'machine_readable' }, 400),
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
      const err = await ShipError.fromHttpResponse(jsonResponse({}, 500), 'Get account');
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

    // A non-JSON body is a foreign responder's — never this platform's, which
    // always emits ErrorResponse JSON. These four pin the line between "a
    // message worth quoting" and "a document that must not become one": a
    // misconfigured apiUrl once put 2,059 characters of a proxy's HTML error
    // page into `message`, and every surface printed all of it.
    it('does NOT adopt an HTML error page as the message', async () => {
      const page = `<!DOCTYPE html><html><head><title>404</title></head><body>${'x'.repeat(2000)}</body></html>`;
      const res = new Response(page, {
        status: 404,
        headers: { 'content-type': 'text/html' },
      });
      const err = await ShipError.fromHttpResponse(res, 'Get deployment');
      expect(err.message).toBe('Get deployment failed with status 404');
    });

    it('does NOT adopt markup even when the content-type claims text/plain', async () => {
      // The predicate reads the body, not the header — an intermediary that
      // mislabels its own HTML must not slip through.
      const res = new Response('<html><body>nope</body></html>', {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      });
      const err = await ShipError.fromHttpResponse(res, 'Ping');
      expect(err.message).toBe('Ping failed with status 502');
    });

    it('does NOT adopt an over-long plain-text body as the message', async () => {
      const res = new Response('x'.repeat(201), {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
      const err = await ShipError.fromHttpResponse(res, 'Ping');
      expect(err.message).toBe('Ping failed with status 500');
    });

    it("keeps a CDN's short plain-text message — the case worth quoting", async () => {
      const res = new Response('  error code: 1015  ', {
        status: 429,
        headers: { 'content-type': 'text/plain' },
      });
      const err = await ShipError.fromHttpResponse(res);
      expect(err.message).toBe('error code: 1015');
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
      const err = await ShipError.fromHttpResponse(jsonResponse({ message: 'nope' }, 400));
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

  /**
   * Runtime failure shapes — CAPTURED, not guessed.
   *
   * `ship` ships as a Bun-compiled binary as well as an npm package, so one
   * program runs on two engines and a failure must carry the same `ErrorType`
   * on both. Clients branch on that type and never on message strings, so a
   * refused connection typed `internal_server_error` under Bun means an agent
   * that retries on `network_error` silently does not.
   *
   * Every fixture below is a transcript. To re-capture after a Bun upgrade,
   * write this to a file and run it under `bun` and under `node`:
   *
   * ```js
   * for (const [label, url] of [
   *   ['refused', 'http://127.0.0.1:45999/'],
   *   ['dns', 'http://no-such-host.invalid/'],
   *   ['tls', 'https://127.0.0.1:45999/'],
   * ]) {
   *   try { await fetch(url); } catch (e) {
   *     console.log(label, e.constructor.name, e.name, e.code, JSON.stringify(e.message));
   *   }
   * }
   * ```
   *
   * A `reset` row needs a server that destroys the socket on connect; it was
   * captured the same way and yields Bun `code: 'ECONNRESET'`.
   */
  describe('runtime failure shapes', () => {
    /** Bun rejects with a plain `Error` carrying a system code — not the spec's TypeError. */
    const bun = (code: string, message: string): Error =>
      Object.assign(new Error(message), { code });

    /** undici rejects with the spec's TypeError and hangs the detail off `cause`. */
    const undici = (code: string, causeMessage: string): TypeError =>
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error(causeMessage), { code }),
      });

    const UNABLE = 'Unable to connect. Is the computer able to access the url?';

    it.each([
      ['bun 1.3.14 · refused', bun('ConnectionRefused', UNABLE)],
      // Bun collapses DNS failure into the same shape as a refused connection.
      ['bun 1.3.14 · dns', bun('ConnectionRefused', UNABLE)],
      ['bun 1.3.14 · reset', bun('ECONNRESET', 'The socket connection was closed unexpectedly.')],
      // The row that rules out an allowlist: covering it by code would mean
      // enumerating BoringSSL's certificate table.
      [
        'bun 1.3.14 · tls',
        bun('UNKNOWN_CERTIFICATE_VERIFICATION_ERROR', 'unknown certificate verification error'),
      ],
      ['node 22 · refused', undici('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:45999')],
      ['node 22 · dns', undici('ENOTFOUND', 'getaddrinfo ENOTFOUND no-such-host.invalid')],
      ['node 22 · reset', undici('ECONNRESET', 'read ECONNRESET')],
    ])('%s → ErrorType.Network', (_label, thrown) => {
      const err = ShipError.fromFetchError(thrown, 'Ping');
      expect(err.type).toBe(ErrorType.Network);
      expect(err.isNetworkError()).toBe(true);
      expect(err.status).toBeUndefined();
      // The runtime's own sentence is relayed; only the TYPE is normalized.
      expect(err.message).toBe(`Ping failed: ${thrown.message}`);
      expect((err.details as { cause?: Error })?.cause).toBe(thrown);
    });

    // Both runtimes agree here, and the agreement is what these pin: a
    // DOMException's `code` is a NUMBER, so the transport test must not claim
    // it. `ship`'s own timeout is an AbortController, so it lands on the first
    // row; `AbortSignal.timeout()` from a caller's `signal` lands on the second.
    it.each([
      ['abort', 'AbortError', 20, 'The operation was aborted.'],
      ['timeout', 'TimeoutError', 23, 'The operation timed out.'],
    ])('%s stays out of the Network arm (DOMException code is numeric)', (_l, name, code, msg) => {
      const err = ShipError.fromFetchError(Object.assign(new Error(msg), { name, code }), 'Ping');
      expect(err.type).not.toBe(ErrorType.Network);
    });

    it('a coded Error is transport evidence; an uncoded one is not', () => {
      expect(ShipError.fromFetchError(bun('ConnectionRefused', 'x')).type).toBe(ErrorType.Network);
      expect(ShipError.fromFetchError(new Error('x')).type).toBe(ErrorType.Api);
    });

    it("fetch's own argument errors are not transport failures", () => {
      // A malformed `apiUrl`, not an unreachable one — no exchange was
      // attempted, and nothing about the network is wrong.
      const err = ShipError.fromFetchError(new TypeError('Failed to parse URL from ship'), 'Ping');
      expect(err.type).toBe(ErrorType.Api);
    });
  });
});

describe('assertShipJsonSyntax', () => {
  // Syntax only. Schema evolves on the server, so anything a client judges
  // beyond these two properties could reject a config a newer platform accepts.
  it('accepts any well-formed JSON object, including keys it does not know', () => {
    expect(() => assertShipJsonSyntax('{}')).not.toThrow();
    expect(() => assertShipJsonSyntax('{"cleanUrls":true}')).not.toThrow();
    // A future schema field must not be rejected by an older client.
    expect(() => assertShipJsonSyntax('{"somethingInventedLater":{"a":1}}')).not.toThrow();
  });

  it('rejects the hand-edit mistakes that otherwise cost an upload round-trip', () => {
    const broken = [
      '{"redirects":[],}', // trailing comma
      '{ // a comment\n"cleanUrls":true}', // JSONC habit
      "{'cleanUrls':true}", // single quotes
      '{cleanUrls:true}', // unquoted key
      '{“cleanUrls”:true}', // smart quotes pasted from docs
      '', // empty file
    ];
    for (const text of broken) {
      expect(() => assertShipJsonSyntax(text), text).toThrow(ShipError);
    }
  });

  it('strips a UTF-8 BOM rather than rejecting it, matching the server', () => {
    // Windows editors and PowerShell redirects write one; the server accepts
    // it, so rejecting here would be a false negative.
    expect(() => assertShipJsonSyntax('﻿{"cleanUrls":true}')).not.toThrow();
  });

  it('rejects valid JSON that is not an object', () => {
    for (const text of ['[]', '"a string"', '42', 'null', 'true']) {
      expect(() => assertShipJsonSyntax(text), text).toThrow(ShipError);
    }
  });

  it('reports Config — the same type the server uses, so the contract matches', () => {
    try {
      assertShipJsonSyntax('{oops}');
      throw new Error('expected a throw');
    } catch (err) {
      expect(isShipError(err)).toBe(true);
      expect((err as ShipError).type).toBe(ErrorType.Config);
    }
  });
});
