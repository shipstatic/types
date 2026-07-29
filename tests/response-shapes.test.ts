/**
 * @file Suite-time fence: the response-shape law.
 *
 * **A response carries only what the status code and headers cannot say.** Four
 * shapes exist and nothing else — an entity, a collection, an acknowledgement,
 * and a report (`CLAUDE.md`, "The response shapes"). What they share is not a
 * type but a rule about content, which is precisely why this is a fence and not
 * an interface: no type system can express "this field restates the status
 * code", and a shared `Response` base would have admitted every field banned
 * below.
 *
 * Two families are banned:
 *
 *   1. **Status-code restatements.** `success` / `ok` / `changed` / `queued` /
 *      `done` are fields of no entity; they assert that the call worked, which
 *      the status code already said. Sync-versus-accepted is likewise the
 *      status code's job — 200 versus 202 — never a boolean's.
 *
 *   2. **Reserved wire keys.** `error` and `message` belong to `ErrorResponse`
 *      and mean something exact there: `error` is an `ErrorType` a client
 *      branches on, `message` is server-authored prose. A success body that
 *      reuses either makes one key mean two things across one channel.
 *
 * `status` is deliberately NOT banned: it is a genuine field of `Deployment`
 * and `Domain`, and `ErrorResponse`'s HTTP status never shares a body with an
 * entity's lifecycle state.
 *
 * Why this file exists: the law was written on `DeploymentDeleteResponse` and
 * held for acknowledgements, while the largest population — reports — had no
 * law at all. `GET /ping` therefore answered `{ success: true, timestamp }`
 * with `success` a literal constant in the route, and an admin endpoint shipped
 * `success` + `message` + a `note` field carrying API documentation in every
 * response body. Both passed review for months because prose does not hold.
 * This does.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');

/** Asserts the call worked — the status code's job, in every shape. */
const BANNED_ALWAYS = ['success', 'ok', 'changed', 'queued', 'done'];

/** `ErrorResponse` owns these, and owns what they mean. */
const BANNED_OUTSIDE_ERRORS = ['error', 'message'];

/** The one shape allowed to declare the reserved keys. */
const ERROR_SHAPES = new Set(['ErrorResponse']);

/**
 * Shapes the API never emits. The law governs the WIRE — what a client parses
 * out of a response — so a value the client itself constructs is outside it.
 * Exempting one is a decision, which is why each carries its reason: a new
 * local shape with a banned field should fail here first and be added
 * deliberately, never by widening the rule.
 */
const CLIENT_LOCAL_SHAPES = new Map([
  [
    'ValidationIssue',
    'produced by the SDK while filtering files locally; its `message` is copy ' +
      'the client wrote for itself, not prose relayed from a response',
  ],
]);

/**
 * Every exported interface, as `{ name, fields }`. Deliberately a source walk
 * rather than a type-level trick: the rule is about the DECLARATION a reader
 * sees, and a reader reads this file.
 */
function declaredInterfaces(): Array<{ name: string; fields: string[] }> {
  const out: Array<{ name: string; fields: string[] }> = [];
  const re = /export interface (\w+)[^{]*\{([\s\S]*?)\n\}/g;
  for (const [, name, body] of SOURCE.matchAll(re)) {
    const fields = [...body.matchAll(/^\s*(?:readonly\s+)?(\w+)\??\s*:/gm)].map((m) => m[1]);
    out.push({ name, fields });
  }
  return out;
}

const INTERFACES = declaredInterfaces();

describe('the response-shape law', () => {
  it('collects the declarations (guards a broken walk from silently passing)', () => {
    expect(INTERFACES.length).toBeGreaterThan(30);
    // An anchor from each shape family, so a regex change that stops matching
    // one of them fails here rather than passing vacuously.
    const names = INTERFACES.map((i) => i.name);
    expect(names).toContain('Deployment'); // entity
    expect(names).toContain('DeploymentListResponse'); // collection
    expect(names).toContain('DeploymentDeleteResponse'); // acknowledgement
    expect(names).toContain('PlatformLimits'); // report
    expect(names).toContain('ErrorResponse'); // the one exemption
  });

  it('no shape asserts that the call worked', () => {
    const offenders = INTERFACES.flatMap(({ name, fields }) =>
      fields.filter((f) => BANNED_ALWAYS.includes(f)).map((f) => `${name}.${f}`),
    );

    expect(
      offenders,
      'A field that asserts the call worked restates the status code, and the ' +
        'two can then disagree. Delete it: 200 means it worked, 202 means it ' +
        'was accepted. If the field is the ANSWER to a question rather than an ' +
        'assertion about the call (`valid`, `isSPA`, `available`), name it for ' +
        `the answer. Banned: ${BANNED_ALWAYS.join(', ')}.`,
    ).toEqual([]);
  });

  it('no shape but ErrorResponse reuses a reserved wire key', () => {
    const offenders = INTERFACES.filter(
      ({ name }) => !ERROR_SHAPES.has(name) && !CLIENT_LOCAL_SHAPES.has(name),
    ).flatMap(({ name, fields }) =>
      fields.filter((f) => BANNED_OUTSIDE_ERRORS.includes(f)).map((f) => `${name}.${f}`),
    );

    expect(
      offenders,
      '`error` and `message` belong to ErrorResponse: `error` is an ErrorType a ' +
        'client branches on, `message` is server-authored prose. A success body ' +
        'reusing either makes one key mean two things. Name the field for what ' +
        'it holds — a validation verdict is a `reason`, not an `error`.',
    ).toEqual([]);
  });

  it('ErrorResponse still declares the reserved keys it owns', () => {
    // The complement: the exemption must be earned, not merely granted. If
    // ErrorResponse stops carrying these, the ban above protects nothing.
    const errorShape = INTERFACES.find((i) => i.name === 'ErrorResponse');
    expect(errorShape?.fields).toEqual(expect.arrayContaining(['error', 'message', 'status']));
  });
});
