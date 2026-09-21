/**
 * @file The wire schemas (`src/schemas.ts`) held to the interfaces
 * (`src/index.ts`) they restate.
 *
 * Two fences. The compile-time one is the load-bearing half: for every
 * schema, the parsed output has exactly the interface's keys, and the
 * interface is assignable to that output. Assignable, not equal, by design:
 * a vocabulary the platform grows (`status`, `plan`, `via`) is a string in
 * the schema so an older client never fails on the platform's next word,
 * while the interface keeps its union. A field added to an interface and
 * not to its schema (or the reverse) fails `pnpm typecheck` of this package,
 * which every release runs.
 *
 * The runtime half proves the schemas accept a fixture of each shape and
 * that every field carries a description, because these descriptions are
 * what an agent reads when a tool publishes the schema.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type {
  Account,
  Caps,
  Deployment,
  DeploymentCreateResponse,
  DeploymentDeleteResponse,
  DeploymentListResponse,
  DnsLookup,
  DnsProvider,
  DnsRecord,
  Domain,
  DomainDeleteResponse,
  DomainDnsResponse,
  DomainListResponse,
  DomainRecordsResponse,
  DomainSetResult,
  DomainShareResponse,
  DomainValidateResponse,
  DomainVerifyResponse,
  ListResponse,
  ScheduledChange,
} from '../src/index.js';
import * as S from '../src/schemas.js';

// =============================================================================
// COMPILE-TIME: keys equal both ways, interface assignable to the parsed shape
// =============================================================================

type Held<I, Schema extends z.ZodType> =
  Exclude<keyof I, keyof z.output<Schema>> extends never
    ? Exclude<keyof z.output<Schema>, keyof I> extends never
      ? I extends z.output<Schema>
        ? true
        : never
      : never
    : never;

// Each line is an assertion: it fails to compile when the pair drifts.
const _list: Held<ListResponse, typeof S.ListResponseSchema> = true;
const _deployment: Held<Deployment, typeof S.DeploymentSchema> = true;
const _deploymentCreate: Held<DeploymentCreateResponse, typeof S.DeploymentCreateResponseSchema> =
  true;
const _deploymentList: Held<DeploymentListResponse, typeof S.DeploymentListResponseSchema> = true;
const _deploymentDelete: Held<DeploymentDeleteResponse, typeof S.DeploymentDeleteResponseSchema> =
  true;
const _domain: Held<Domain, typeof S.DomainSchema> = true;
const _domainSet: Held<DomainSetResult, typeof S.DomainSetResultSchema> = true;
const _domainList: Held<DomainListResponse, typeof S.DomainListResponseSchema> = true;
const _domainDelete: Held<DomainDeleteResponse, typeof S.DomainDeleteResponseSchema> = true;
const _domainVerify: Held<DomainVerifyResponse, typeof S.DomainVerifyResponseSchema> = true;
const _dnsRecord: Held<DnsRecord, typeof S.DnsRecordSchema> = true;
const _domainRecords: Held<DomainRecordsResponse, typeof S.DomainRecordsResponseSchema> = true;
const _dnsProvider: Held<DnsProvider, typeof S.DnsProviderSchema> = true;
const _dnsLookup: Held<DnsLookup, typeof S.DnsLookupSchema> = true;
const _domainDns: Held<DomainDnsResponse, typeof S.DomainDnsResponseSchema> = true;
const _domainShare: Held<DomainShareResponse, typeof S.DomainShareResponseSchema> = true;
const _domainValidate: Held<DomainValidateResponse, typeof S.DomainValidateResponseSchema> = true;
const _caps: Held<Caps, typeof S.CapsSchema> = true;
const _scheduled: Held<ScheduledChange, typeof S.ScheduledChangeSchema> = true;
const _account: Held<Account, typeof S.AccountSchema> = true;

// The fence can fail: a shape missing a key, or with an extra one, is `never`.
// @ts-expect-error `Deployment` is not held by the list envelope alone.
const _drift: Held<Deployment, typeof S.ListResponseSchema> = true;

// =============================================================================
// RUNTIME: fixtures parse, and every field is described
// =============================================================================

const deployment: Deployment = {
  deployment: 'happy-cat-abc1234.shipstatic.com',
  url: 'https://happy-cat-abc1234.shipstatic.com',
  files: 3,
  size: 1024,
  status: 'success',
  config: false,
  password: false,
  labels: ['production'],
  via: 'cli',
  created: 1_700_000_000,
  expires: null,
  screenshot: 'https://screenshots.shipstatic.com/happy-cat-abc1234/a3f2c1b4',
};

const domain: Domain = {
  domain: 'www.example.com',
  url: 'https://www.example.com',
  status: 'live',
  deployment: deployment.deployment,
  linked: 1_700_000_100,
  links: 1,
  verification: 'verified',
  verified: 1_700_000_050,
  verifications: 2,
  paused: null,
  labels: [],
  created: 1_700_000_000,
};

const caps: Caps = { deployments: 2, platformDomains: 0, customDomains: 1 };

const account: Account = {
  email: 'who@example.com',
  name: 'Who',
  picture: null,
  plan: 'pro',
  suspended: false,
  usage: caps,
  caps: { deployments: 100, platformDomains: 10, customDomains: 3 },
  created: 1_700_000_000,
  activated: 1_700_000_050,
  hint: 'ab12',
  used: null,
  pastDue: false,
  billed: true,
  upgrade: 'team',
  interval: 'month',
  scheduled: null,
  cancelAt: null,
};

const FIXTURES: Array<[string, z.ZodType, unknown]> = [
  ['Deployment', S.DeploymentSchema, deployment],
  [
    'DeploymentCreateResponse',
    S.DeploymentCreateResponseSchema,
    { ...deployment, claim: 'https://my.shipstatic.com/claim/abc' },
  ],
  [
    'DeploymentListResponse',
    S.DeploymentListResponseSchema,
    { deployments: [deployment], cursor: null },
  ],
  [
    'DeploymentDeleteResponse',
    S.DeploymentDeleteResponseSchema,
    { deployment: deployment.deployment, status: 'deleting' },
  ],
  ['Domain', S.DomainSchema, domain],
  ['DomainSetResult', S.DomainSetResultSchema, { ...domain, isCreate: true }],
  ['DomainListResponse', S.DomainListResponseSchema, { domains: [domain], cursor: 'next' }],
  ['DomainDeleteResponse', S.DomainDeleteResponseSchema, { domain: domain.domain }],
  ['DomainVerifyResponse', S.DomainVerifyResponseSchema, { domain: domain.domain }],
  [
    'DomainRecordsResponse',
    S.DomainRecordsResponseSchema,
    {
      domain: domain.domain,
      apex: 'example.com',
      records: [
        { type: 'A', name: '@', value: '203.0.113.7' },
        { type: 'CNAME', name: 'www', value: 'cname.shipstatic.com' },
      ],
    },
  ],
  [
    'DomainDnsResponse (recorded)',
    S.DomainDnsResponseSchema,
    {
      domain: domain.domain,
      dns: { provider: { name: 'Cloudflare', url: 'https://dash.cloudflare.com' } },
    },
  ],
  [
    'DomainDnsResponse (nothing recorded)',
    S.DomainDnsResponseSchema,
    { domain: domain.domain, dns: null },
  ],
  [
    'DomainShareResponse',
    S.DomainShareResponseSchema,
    { domain: domain.domain, url: 'https://connect.shipstatic.com/x' },
  ],
  [
    'DomainValidateResponse',
    S.DomainValidateResponseSchema,
    { valid: true, normalized: 'www.example.com', available: true, reason: null },
  ],
  ['Account', S.AccountSchema, account],
];

describe('every schema accepts its own shape', () => {
  it.each(FIXTURES)('%s', (_name, schema, fixture) => {
    const parsed = schema.safeParse(fixture);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('grown vocabularies accept a member this build does not know', () => {
    // The reason `status`, `plan` and `via` are strings: an older client
    // holding this schema must not fail on the platform's next word.
    expect(
      S.DeploymentSchema.safeParse({ ...deployment, status: 'archived', via: 'new' }).success,
    ).toBe(true);
    expect(S.AccountSchema.safeParse({ ...account, plan: 'enterprise' }).success).toBe(true);
  });

  it('seats and role are additive: absent on an old response, accepted on a new one', () => {
    // The fixture above carries neither, which is every response before 3.1.
    const withSeats: Account = {
      ...account,
      role: 'member',
      usage: { ...caps, seats: 3 },
      caps: { ...account.caps, seats: 5 },
    };
    expect(S.AccountSchema.safeParse(withSeats).success).toBe(true);
    // The role vocabulary is Better Auth's and closed: only the two the
    // platform makes reachable.
    expect(S.AccountSchema.safeParse({ ...account, role: 'admin' }).success).toBe(false);
    expect(S.CapsSchema.safeParse({ ...caps, seats: -1 }).success).toBe(false);
  });

  it('a closed vocabulary that is not ours stays closed', () => {
    expect(S.DnsRecordSchema.safeParse({ type: 'TXT', name: '@', value: 'x' }).success).toBe(false);
  });
});

describe('every field is described', () => {
  // Walked through the JSON Schema the schemas publish, because that is the
  // form a tool's `outputSchema` reaches an agent in.
  function undescribed(schema: z.ZodType, name: string): string[] {
    const json = z.toJSONSchema(schema) as {
      properties?: Record<string, { description?: string }>;
    };
    return Object.entries(json.properties ?? {})
      .filter(([, prop]) => !prop.description?.trim())
      .map(([key]) => `${name}.${key}`);
  }

  it.each(FIXTURES.filter(([n]) => !n.includes('(')))('%s', (name, schema) => {
    expect(undescribed(schema, name)).toEqual([]);
  });

  it('names the grown vocabulary members in the description, derived from the constant', () => {
    const json = z.toJSONSchema(S.DeploymentSchema) as {
      properties: Record<string, { description: string }>;
    };
    expect(json.properties.status.description).toContain('pending, success, failed, deleting');
    expect(json.properties.via.description).toContain('cli');
  });
});
