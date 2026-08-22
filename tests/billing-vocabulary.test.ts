/**
 * @file Suite-time fence: the platform's plan words, and the words that are
 * not the platform's to speak.
 *
 * Two properties, both of which prose has already failed to hold once.
 *
 * **The plan vocabulary is total and current.** Plans are renamed rarely and
 * across five repositories at once, so a retired spelling reintroduced by a
 * merge is invisible until an account lands on a plan no `CHECK` constraint
 * accepts. The retired names are listed literally because a renamed
 * identifier is absent from the constitution by construction — nothing can
 * derive them (root `CLAUDE.md`, "The prose fence").
 *
 * **No payment provider is named in the wire vocabulary.** This package is
 * the platform's public constitution; a provider is an implementation the
 * platform is free to change, and every previous integration leaked its
 * vocabulary into surfaces users read — a raw subscription status rendered as
 * a banner, thirteen provider events in the activity log, a portal URL in an
 * entity. The wire carries platform words (`plan`, `interval`, `periodEnd`,
 * `cancelAtPeriodEnd`, `overdue`) and the provider stays behind the API.
 *
 * Both checks were watched to fail before being trusted: a fence you have not
 * watched fail is not a fence.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AccountPlan } from '../src/index';

const SOURCE = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');

/** Plan names this platform has retired. They can only ever be regressions. */
const RETIRED_PLANS = ['standard', 'enterprise'];

/** Payment providers, past and present. None of them is a platform word. */
const PROVIDER_NAMES = ['creem', 'stripe', 'paddle', 'lemonsqueezy', 'chargebee'];

/**
 * Subscription statuses as payment providers spell them. The platform's own
 * answer to "is something wrong with this payment?" is the boolean
 * `Account.overdue`; these strings never cross the wire.
 */
const PROVIDER_STATUSES = ['past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid'];

describe('the plan vocabulary', () => {
  it('is exactly the seven plans the platform holds', () => {
    expect(Object.values(AccountPlan).sort()).toEqual([
      'free',
      'pro',
      'scale',
      'sponsored',
      'suspended',
      'terminated',
      'terminating',
    ]);
  });

  it('names no retired plan, anywhere in the constitution', () => {
    const offenders = RETIRED_PLANS.filter((plan) =>
      new RegExp(`['"\`]${plan}['"\`]`).test(SOURCE),
    );

    expect(
      offenders,
      'A retired plan name reintroduced here reaches every consumer as a legal ' +
        'value while the database refuses it. `standard` is `pro` and ' +
        '`enterprise` is `scale`.',
    ).toEqual([]);
  });
});

describe('the wire names no payment provider', () => {
  it('carries no provider name', () => {
    const offenders = PROVIDER_NAMES.filter((name) => new RegExp(name, 'i').test(SOURCE));

    expect(
      offenders,
      'The platform sells the plan; a provider collects for it. Naming one in ' +
        'the published vocabulary makes changing providers a breaking change ' +
        'for every npm consumer.',
    ).toEqual([]);
  });

  it('carries no provider status string', () => {
    const offenders = PROVIDER_STATUSES.filter((status) =>
      new RegExp(`['"\`]${status}['"\`]`).test(SOURCE),
    );

    expect(
      offenders,
      'A provider status on the wire is a provider enum rendered to users. ' +
        'The platform answers `overdue: boolean` and lets the plan speak for ' +
        'the rest.',
    ).toEqual([]);
  });
});
