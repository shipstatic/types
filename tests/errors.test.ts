import { describe, it, expect } from 'vitest';
import { ErrorType, ShipError, isShipError } from '../src/index';

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

describe('ShipError.fromHttpResponse', () => {
  describe('error type derivation by status', () => {
    it('maps 401 → ErrorType.Authentication', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({ message: 'nope' }, 401),
      );
      expect(err.type).toBe(ErrorType.Authentication);
      expect(err.status).toBe(401);
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
      expect(err.isValidationError()).toBe(true);
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

    it('falls back to fallbackMessage when body has neither', async () => {
      const err = await ShipError.fromHttpResponse(
        jsonResponse({}, 500),
        'Get account failed',
      );
      expect(err.message).toBe('Get account failed');
    });

    it('falls back to status-derived message when body and fallback are absent', async () => {
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

    it('falls back to status-derived message when body is empty (no content-type)', async () => {
      const res = new Response(null, { status: 500 });
      const err = await ShipError.fromHttpResponse(res);
      expect(err.message).toBe('Request failed with status 500');
    });

    it('tolerates malformed JSON body and falls through to fallback', async () => {
      const res = new Response('{ not valid json', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
      const err = await ShipError.fromHttpResponse(res, 'Ping failed');
      expect(err.message).toBe('Ping failed');
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
