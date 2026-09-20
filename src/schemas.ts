/**
 * The wire schemas: what the API's responses look like, as data a consumer
 * can hand to a validator or publish as a tool's `outputSchema`.
 *
 * `index.ts` owns the TYPES. Each interface there carries the platform's
 * reasoning in JSDoc, field by field, and the `readonly`/mutable split a
 * type can express and a schema cannot. This module RESTATES those shapes
 * as zod schemas, and the restatement is fenced rather than trusted:
 * `tests/schemas.test.ts` holds every schema to its interface at compile
 * time (the same keys, and the interface assignable to what the schema
 * parses), so a field added to one and not the other fails `pnpm typecheck`
 * of this package, which every release runs. Two declarations in one
 * package, one commit apart, one fence between them.
 *
 * Why the schemas are not the owner: `z.infer` cannot carry per-field JSDoc
 * into an editor, and it makes every field mutable or every field readonly,
 * where the entities deliberately mix the two. The interface is the better
 * declaration for a developer; the schema is the better one for a wire.
 *
 * **What a schema promises is what the wire promises ACROSS versions**, and
 * that decides where it is looser than the type. The platform grows its own
 * vocabularies: `via` gained three members in one month, `status` gained
 * `deleting`, `plan` gained `team`. A consumer validating a response holds
 * the schema it shipped with, so an enum there would turn the platform's
 * next word into a validation failure on every older client. Those fields
 * are therefore strings whose DESCRIPTION names today's members (derived
 * from the constant, never typed out), while vocabularies that are not ours
 * to grow (a DNS record type, Stripe's billing interval) are enums. The
 * fence admits this on purpose: the interface must be assignable to the
 * schema's output, not equal to it.
 *
 * Every field is described, and that is fenced too: these descriptions are
 * what an agent reads when a tool publishes the schema, and an undescribed
 * field is a field an agent cannot use. The sentences are the interfaces'
 * own, shortened to what a reader of a result needs.
 *
 * A subpath export (`@shipstatic/types/schemas`), so a consumer that never
 * imports it carries no zod: the browser bundles read `index.ts` alone.
 */

import { z } from 'zod';
import {
  AccountPlan,
  DeploymentStatus,
  DeploymentVia,
  DomainStatus,
  DomainVerification,
  PUBLIC_DEPLOYMENT_TTL_SECONDS,
} from './index.js';

/** A vocabulary the platform grows, described by today's members and open to tomorrow's. */
const grown = (members: Record<string, string>, what: string) =>
  z.string().describe(`${what} One of: ${Object.values(members).join(', ')}.`);

const unixSeconds = (what: string) => z.int().describe(`Unix timestamp (seconds) ${what}.`);

// =============================================================================
// LISTS
// =============================================================================

/** The half of every list response that is identical on every list. */
export const ListResponseSchema = z.object({
  cursor: z
    .string()
    .nullable()
    .describe('Opaque cursor for the next page; null on the last page. The whole has-more signal.'),
});

// =============================================================================
// DEPLOYMENTS
// =============================================================================

export const DeploymentSchema = z.object({
  deployment: z.string().describe('Deployment hostname, e.g. "happy-cat-abc1234.shipstatic.com".'),
  url: z.url().describe('Full URL to the live deployment.'),
  files: z.int().nonnegative().describe('Number of files in the deployment.'),
  size: z.int().nonnegative().describe('Total deployment size in bytes.'),
  status: grown(DeploymentStatus, 'Deployment lifecycle state; "success" means the site is live.'),
  config: z.boolean().describe('True if the deployment includes a ship.json routing config.'),
  password: z.boolean().describe('True if the deployment is password-protected.'),
  labels: z.array(z.string()).describe('Labels attached to the deployment; empty when none.'),
  via: z
    .string()
    .nullable()
    .describe(
      `How the deployment was created, as shown in deployment history (today one of: ${Object.values(DeploymentVia).join(', ')}). Null on deployments older than the tag.`,
    ),
  created: unixSeconds('when the deployment was created'),
  expires: z
    .int()
    .nullable()
    .describe(
      `Unix timestamp (seconds) when the deployment expires; null when permanent. Anonymous deployments expire ${PUBLIC_DEPLOYMENT_TTL_SECONDS / 86_400} days after creation unless claimed; an authenticated deployment carries one only when it requested a ttl.`,
    ),
  screenshot: z
    .url()
    .describe(
      'Full URL to the deployment screenshot. Rendered on the first request for it, so the URL is returned immediately and the first request takes a few seconds; every request after that is served immediately.',
    ),
});

export const DeploymentCreateResponseSchema = DeploymentSchema.extend({
  claim: z
    .url()
    .optional()
    .describe(
      'One-time URL that claims this anonymous deployment to a free account, making it permanent. Only present on anonymous deploys; absent when the deploy was made with a connected account.',
    ),
});

export const DeploymentListResponseSchema = ListResponseSchema.extend({
  deployments: z.array(DeploymentSchema).describe('The deployments on this page.'),
});

export const DeploymentDeleteResponseSchema = z.object({
  deployment: z.string().describe('The deployment hostname that was marked for removal.'),
  status: grown(DeploymentStatus, 'The state the deployment is in while background cleanup runs.'),
});

// =============================================================================
// DOMAINS
// =============================================================================

export const DomainSchema = z.object({
  domain: z.string().describe('The domain name, e.g. "www.example.com".'),
  url: z.url().describe('Full URL to the domain.'),
  status: grown(
    DomainStatus,
    'What this domain needs from its owner, derived: "live" serves the linked deployment and needs nothing; "unlinked" is verified with nothing published there, so link a deployment; "unverified" needs its DNS records configured; "paused" means the plan no longer has room for it. Read this word rather than recomputing it.',
  ),
  deployment: z
    .string()
    .nullable()
    .describe(
      'The deployment hostname this domain points to; null when reserved but not yet linked.',
    ),
  linked: z
    .int()
    .nullable()
    .describe('Unix timestamp (seconds) when a deployment was last linked; null if never linked.'),
  links: z
    .int()
    .nonnegative()
    .describe('How many times a deployment has been linked to this domain.'),
  verification: grown(
    DomainVerification,
    'How far DNS verification has got: "pending" is no required record pointing here, "partial" is some of them, "verified" is all. The diagnostic under "unverified"; platform domains are born verified.',
  ),
  verified: z
    .int()
    .nullable()
    .describe(
      'When DNS last became verified; null if it never has, and never cleared, so a domain whose records moved away keeps it. Read `verification` for whether DNS is right now.',
    ),
  verifications: z
    .int()
    .nonnegative()
    .describe('How many DNS verification attempts this domain has had.'),
  paused: z
    .int()
    .nullable()
    .describe(
      'Unix timestamp (seconds) when plan enforcement paused serving; null while the plan has room for it.',
    ),
  labels: z.array(z.string()).describe('Labels attached to the domain; empty when none.'),
  created: unixSeconds('when the domain was created'),
});

/** `Domain` plus the SDK's own create-versus-update flag; the wire body is a plain `Domain`. */
export const DomainSetResultSchema = DomainSchema.extend({
  isCreate: z
    .boolean()
    .describe('True when this call created the domain; false when it updated an existing one.'),
});

export const DomainListResponseSchema = ListResponseSchema.extend({
  domains: z.array(DomainSchema).describe('The domains on this page.'),
});

export const DomainDeleteResponseSchema = z.object({
  domain: z.string().describe('The domain name that was removed, normalized.'),
});

export const DomainVerifyResponseSchema = z.object({
  domain: z
    .string()
    .describe(
      "The domain whose DNS verification was queued, normalized. The check runs asynchronously; the domain's `verification` and `status` update once DNS propagates, so read the domain again rather than trusting this acknowledgement for a verdict.",
    ),
});

export const DnsRecordSchema = z.object({
  type: z
    .enum(['A', 'CNAME'])
    .describe('Record type: A for the apex redirect, CNAME for the hosted subdomain.'),
  name: z.string().describe('The DNS name to configure.'),
  value: z.string().describe('The value to set: an IP for A, a hostname for CNAME.'),
});

export const DomainRecordsResponseSchema = z.object({
  domain: z.string().describe('The domain the records are for.'),
  apex: z.string().describe('The apex (registered) domain where DNS records are managed.'),
  records: z
    .array(DnsRecordSchema)
    .describe('The records to configure at the DNS provider, in the order to add them.'),
});

export const DnsProviderSchema = z.object({
  name: z.string().nullable().describe('Provider name, e.g. "Cloudflare"; null if unknown.'),
  url: z
    .url()
    .nullable()
    .optional()
    .describe(
      "The provider's DNS dashboard, where the records get added; null or absent when unknown.",
    ),
});

export const DnsLookupSchema = z.object({
  provider: DnsProviderSchema.optional().describe(
    "The provider serving this domain's DNS; absent when unidentified.",
  ),
});

export const DomainDnsResponseSchema = z.object({
  domain: z.string().describe('The domain name.'),
  dns: DnsLookupSchema.nullable().describe(
    "What the platform recorded about the domain's DNS provider when the domain was created; null if nothing was recorded.",
  ),
});

export const DomainShareResponseSchema = z.object({
  domain: z.string().describe('The domain the setup link is for.'),
  url: z
    .url()
    .describe(
      'The shareable DNS setup URL; whoever opens it sees the records to configure, with no API key.',
    ),
});

export const DomainValidateResponseSchema = z.object({
  valid: z.boolean().describe("Whether the domain's shape is usable."),
  normalized: z.string().nullable().describe('The normalized domain name; null when invalid.'),
  available: z
    .boolean()
    .nullable()
    .describe(
      'Whether nobody has registered the name yet; null when invalid. Creating it would be new; re-pointing your own domain is a write, not a create.',
    ),
  reason: z
    .string()
    .nullable()
    .describe('Why the name is unusable, for display; null when it is usable.'),
});

// =============================================================================
// ACCOUNT
// =============================================================================

export const CapsSchema = z.object({
  deployments: z.int().nonnegative().describe('Deployments, every row whatever its status.'),
  platformDomains: z
    .int()
    .nonnegative()
    .describe('Names chosen under the platform\'s own suffix, e.g. "my-app.shipstatic.com".'),
  customDomains: z
    .int()
    .nonnegative()
    .describe('Hostnames the customer owns, paused ones included.'),
});

export const ScheduledChangeSchema = z.object({
  plan: grown(AccountPlan, 'The plan the account moves to.'),
  interval: z.enum(['month', 'year']).describe('The billing interval the change applies with.'),
  at: unixSeconds('when the change applies'),
});

export const AccountSchema = z.object({
  email: z.string().describe('The account email address.'),
  name: z.string().nullable().describe('Display name; null if not set.'),
  picture: z.url().nullable().describe('Profile picture URL; null if not set.'),
  plan: grown(AccountPlan, 'The tier the account stands at.'),
  suspended: z
    .boolean()
    .describe(
      'True while the operator has suspended the account: reads work, every write is refused.',
    ),
  usage: CapsSchema.describe('What the account currently holds.'),
  caps: CapsSchema.describe(
    'What the account is allowed to hold: the same three keys as usage, so the pair divides.',
  ),
  created: unixSeconds('when the account was created'),
  activated: z
    .int()
    .nullable()
    .describe('Unix timestamp (seconds) of the first deployment; null if not yet activated.'),
  hint: z
    .string()
    .nullable()
    .describe('Last 4 characters of the API key; null when no key exists.'),
  used: z
    .int()
    .nullable()
    .optional()
    .describe(
      "Unix timestamp (seconds) of the API key's last use; null or absent when never used.",
    ),
  pastDue: z
    .boolean()
    .describe(
      'True while the subscription is past due and the card is being retried; the plan is unchanged.',
    ),
  billed: z.boolean().describe('Whether a subscription bills this plan.'),
  upgrade: z
    .string()
    .nullable()
    .describe(
      `The next plan up the ladder, or null when there is none. One of: ${Object.values(AccountPlan).join(', ')}.`,
    ),
  interval: z
    .enum(['month', 'year'])
    .nullable()
    .describe("The live subscription's billing interval; null when nothing bills the account."),
  scheduled: ScheduledChangeSchema.nullable().describe('The pending plan change; null when none.'),
  cancelAt: z
    .int()
    .nullable()
    .describe('Unix timestamp (seconds) when the subscription ends; null while it renews.'),
});
