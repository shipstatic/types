/**
 * @file Suite-time fence: the platform's plan words are total and current.
 *
 * Plans are renamed rarely and across five repositories at once, so a retired
 * spelling reintroduced by a merge is invisible until an account lands on a
 * plan no `CHECK` constraint accepts. The retired names are listed literally
 * because a renamed identifier is absent from the constitution by construction
 * — nothing can derive them (root `CLAUDE.md`, "The prose fence").
 *
 * Watched to fail before being trusted: a fence you have not watched fail is
 * not a fence.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AccountPlan } from '../src/index';

const SOURCE = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');

/** Plan names this platform has retired. They can only ever be regressions. */
const RETIRED_PLANS = ['standard', 'enterprise'];

describe('the plan vocabulary', () => {
  it('is exactly the four TIERS — no lifecycle state wears the plan field', () => {
    expect(Object.values(AccountPlan).sort()).toEqual(['free', 'pro', 'scale', 'sponsored']);
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
