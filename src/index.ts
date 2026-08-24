/**
 * @file Shared TypeScript types, constants, and utilities for the ShipStatic platform.
 * This package is the single source of truth for all shared data structures.
 */

// =============================================================================
// DEPLOYMENT TYPES
// =============================================================================

/**
 * Deployment status constants
 */
export const DeploymentStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  DELETING: 'deleting',
} as const;

export type DeploymentStatusType = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

/**
 * Where a deployment came from — the origin-tracking vocabulary.
 *
 * A closed set with many authors. It lived in the API's config until
 * 2026-08-06, where being server-side made it unenforceable in the one
 * direction that matters — every client wrote a bare string, and a value
 * outside the set was **silently dropped** by the server, so a typo did not
 * fail anywhere. It stopped recording where deploys came from and said nothing.
 *
 * **The origin law: origin is declared by whatever we control — our code where
 * we ship code, our URL where we ship only a URL.** One rule decides every
 * member here and every future one:
 *
 * - **Where the platform ships CODE, the code declares it.** `web`, `sdk`,
 *   `cli`, `git`, `n8n` and `vsc` are surfaces this platform authors, so each
 *   names itself in its own source and nothing external is needed to tell them
 *   apart.
 * - **Where the platform ships only a URL, the URL declares it.** A
 *   marketplace listing runs somebody else's client against a bare endpoint —
 *   every one of them the same server speaking the same protocol, and
 *   indistinguishable in a request. The only thing such a listing's traffic
 *   has in common is the URL its users were handed, so the hosted MCP serves
 *   one DOOR per listing and the door's path IS the value: `gpt`, `cld`,
 *   `crs`.
 *
 * **A member names the most specific surface the platform can honestly
 * claim**, which is what makes the two FALLBACKS fallbacks rather than peers
 * of the named surfaces. `mcp` is any MCP host that was never handed a door of
 * its own; `api` is a call that reached the REST API naming nothing at all.
 * Guessing past either would be inventing attribution rather than recording
 * it, which is the one thing this vocabulary exists to prevent.
 *
 * Every member is three lowercase characters — the property that lets a
 * channel door's path and its attribution be spelled the same. The suite pins
 * both the width and the channel members by name.
 */
export const DeploymentVia = {
  /** The web dashboard. */
  WEB: 'web',
  /** A program embedding the SDK directly. */
  SDK: 'sdk',
  /** The `ship` CLI. */
  CLI: 'cli',
  /** Any MCP host with no door of its own — the stdio server included. The family fallback. */
  MCP: 'mcp',
  /** The GitHub Action. */
  GIT: 'git',
  /** The n8n community node. */
  N8N: 'n8n',
  /** Channel: the ChatGPT App listing → `mcp.<domain>/gpt`. */
  GPT: 'gpt',
  /** The VS Code extension. */
  VSC: 'vsc',
  /** Channel: the Claude connectors directory listing → `mcp.<domain>/cld`. */
  CLD: 'cld',
  /** Channel: the Cursor marketplace listing → `mcp.<domain>/crs`. */
  CRS: 'crs',
  /**
   * A deploy that reached the REST API naming no origin at all — the
   * platform-wide fallback, one altitude below `mcp`'s family fallback.
   *
   * **The API stamps it, since 2026-08-15.** A deploy that names no origin —
   * or names one this vocabulary does not know — is stored as `api`, so a
   * stored `null` now means only that the row predates attribution.
   *
   * It was declared one wave ahead of that decision, deliberately: vocabulary
   * must exist before a consumer can adopt it, and adding a member costs a
   * full constellation convoy, so the word shipped first and the server
   * adopted it with no convoy standing between the decision and the deploy.
   */
  API: 'api',
} as const;

export type DeploymentViaType = (typeof DeploymentVia)[keyof typeof DeploymentVia];

/**
 * Core deployment object - used in both API responses and SDK
 */
export interface Deployment {
  /** The deployment hostname (e.g., 'happy-cat-abc1234.shipstatic.com') */
  readonly deployment: string;
  /** Full URL to the deployment (e.g., 'https://happy-cat-abc1234.shipstatic.com') */
  readonly url: string;
  /** Number of files in this deployment */
  readonly files: number;
  /** Total size of all files in bytes */
  readonly size: number;
  /** Current deployment status */
  status: DeploymentStatusType; // Mutable - can be updated
  /** Whether deployment has a ship.json config */
  readonly config: boolean;
  /** Whether deployment has a password set */
  readonly password: boolean;
  /** Labels for categorization and filtering (lowercase, alphanumeric with separators). Always present, empty array when none. */
  labels: string[];
  /**
   * The client/tool that created this deployment. Every deployment created
   * today names one — {@link DeploymentVia.API} when the caller named nothing
   * the vocabulary knows — so `null` is historical: the row predates
   * attribution.
   *
   * Deliberately wider than {@link DeploymentViaType}: this is stored data,
   * and rows predate the vocabulary being closed. Narrowing the ENTITY would
   * be a claim about every row already in the database; narrowing the
   * REQUEST option ({@link DeploymentUploadOptions.via}) is a claim about
   * what a client may send, which is ours to make.
   */
  readonly via: string | null;
  /** Unix timestamp (seconds) when deployment was created */
  readonly created: number;
  /** Unix timestamp (seconds) when deployment expires, null if never */
  expires: number | null; // Mutable - can be updated
  /** Full URL to the deployment screenshot (e.g., 'https://screenshots.shipstatic.com/happy-cat-abc1234/a3f2c1b4d5e6f789') */
  readonly screenshot: string;
}

/**
 * Response from deployment creation. Extends Deployment with one-time fields
 * only present on creation (not on subsequent GET requests).
 */
export interface DeploymentCreateResponse extends Deployment {
  /** Claim URL for public deployments. Present when deployed without credentials. */
  readonly claim?: string;
}

/**
 * The half of a list response that is identical on every list.
 *
 * `GET /<collection>` answers exactly two fields — the collection under its
 * own plural noun, and this cursor — so the cursor is declared once here and
 * each response below adds only its noun. `cursor: null` means last page and
 * is the ENTIRE has-more signal, which is why there is no `has_more`.
 *
 * There is deliberately no `total`. A count is an aggregate over a
 * collection, not a property of a page; producing one would cost a COUNT
 * beside every page read, which is precisely what keyset pagination exists
 * to avoid. Counts live on the resource that summarises the collection —
 * `GET /account`'s `usage` for one caller, `GET /admin/stats` platform-wide.
 */
export interface ListResponse {
  /** Opaque cursor from this page; `null` on the last page. */
  cursor: string | null;
}

/**
 * Pagination options for every list endpoint. The response's `cursor` feeds
 * the next request; a `null` cursor means the last page. Omitting both
 * returns the server's default first page.
 *
 * A list answers `{ <collection>, cursor }` and nothing else — `cursor`
 * carries the entire has-more signal, so no redundant boolean, and no
 * `total`. **A count is an aggregate over a collection, not a property of a
 * page:** including one makes every read pay for a full scan it did not ask
 * for, which is precisely the cost keyset pagination exists to avoid.
 *
 * Counts therefore live on the summary resource that owns them —
 * `GET /account` (`usage`) for a caller's own totals, `GET /admin/stats` for
 * platform-wide ones. Ask for a count when you want a count; ask for a page
 * when you want a page.
 */
export interface ListOptions {
  /** Maximum number of items to return in one page. */
  limit?: number;
  /** Opaque cursor from the previous page's response. */
  cursor?: string;
}

/**
 * Response for listing deployments
 */
export interface DeploymentListResponse extends ListResponse {
  /** Array of deployments */
  deployments: Deployment[];
}

/**
 * Acknowledgement of `DELETE /deployments/:deployment` — and the shape every
 * mutation with no entity left to return follows.
 *
 * **The law:** a mutation answers with the resource it affected. If the
 * resource still exists, that means the entity itself (`Deployment`,
 * `Domain`, …). Otherwise it means this: the resource noun carrying the
 * item's canonical key, plus the resource's own state field — and ONLY when
 * the resource survived in a transitional state, as an async deletion's does.
 * Where the resource is simply gone, the key alone is the whole answer
 * ({@link DomainDeleteResponse}, {@link TokenDeleteResponse}).
 *
 * Put positively: **an acknowledgement is a projection of the resource** —
 * its key, plus its own state field where the state changed. That is the
 * test to apply, and it is sharper than "no constant", which this shape
 * would fail on its own terms: `status` here is the literal `'deleting'` on
 * every success, exactly as fixed as a `changed: true` would be.
 *
 * The difference is not how predictable the value is, it is what the field
 * IS. `status` is the deployment's own field — the same one `GET
 * /deployments/:deployment` returns — so this response is `Deployment`
 * narrowed to two members, and a client renders it with the code it already
 * has. `changed: true`, `queued: true` and `success: true` are not fields of
 * any entity; they exist only to assert that the call worked, which the
 * status code already said. Sync versus accepted is likewise the status
 * code's job — 200 versus 202 — not a boolean's.
 *
 * No prose either (`message`): an acknowledgement is data, and each surface
 * composes its own copy.
 */
export interface DeploymentDeleteResponse {
  /** The deployment hostname that was marked for removal */
  readonly deployment: string;
  /** The state the deployment is in while background cleanup runs */
  readonly status: DeploymentStatusType;
}

// =============================================================================
// DOMAIN TYPES
// =============================================================================

/**
 * Domain status constants
 *
 * - PENDING: DNS not configured
 * - PARTIAL: DNS partially configured
 * - SUCCESS: DNS fully verified
 * - PAUSED: Domain paused due to plan enforcement (billing)
 */
export const DomainStatus = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  SUCCESS: 'success',
  PAUSED: 'paused',
} as const;

export type DomainStatusType = (typeof DomainStatus)[keyof typeof DomainStatus];

/**
 * Core domain object - used in both API responses and SDK
 */
export interface Domain {
  /** The domain name */
  readonly domain: string;
  /** Full URL to the domain (e.g., 'https://www.example.com') */
  readonly url: string;
  /** The deployment hostname this domain points to (null = domain added but not yet linked) */
  deployment: string | null; // Mutable - can be updated to point to different deployment
  /** Current domain status */
  status: DomainStatusType; // Mutable - can be updated
  /** Labels for categorization and filtering (lowercase, alphanumeric with separators). Always present, empty array when none. */
  labels: string[];
  /** Unix timestamp (seconds) when domain was created */
  readonly created: number;
  /** Unix timestamp (seconds) when deployment was last linked, null if never linked */
  linked: number | null;
  /** Total deployment links */
  links: number;
}

/**
 * Return shape of `domains.set()` — `Domain` plus an SDK-derived flag indicating
 * whether the underlying `PUT /domains/:name` created the record (HTTP 201) or
 * updated an existing one (HTTP 200).
 *
 * `isCreate` is not part of the wire format — the API returns a plain `Domain`
 * body. The SDK derives the flag from the HTTP status code so callers (notably
 * the CLI) can format different output for the create vs repoint paths without
 * a second round-trip.
 */
export interface DomainSetResult extends Domain {
  /** `true` when this call created a new domain; `false` when it updated an existing one. */
  isCreate: boolean;
}

/**
 * Response for listing domains
 */
export interface DomainListResponse extends ListResponse {
  /** Array of domains */
  domains: Domain[];
}

/**
 * Acknowledgement of `DELETE /domains/:domain`. The row is gone, so there is
 * no state to state — the canonical domain name is the whole answer. See
 * {@link DeploymentDeleteResponse} for the law.
 */
export interface DomainDeleteResponse {
  /** The domain name that was removed, normalized */
  readonly domain: string;
}

/**
 * Acknowledgement of `POST /domains/:domain/verify` (202). The DNS check is
 * queued, not performed — the accepted status code says so, and the domain's
 * own status is unchanged until the check runs, which is why none is stated
 * here. See {@link DeploymentDeleteResponse} for the law.
 */
export interface DomainVerifyResponse {
  /** The domain whose DNS verification was queued, normalized */
  readonly domain: string;
}

/**
 * DNS record types supported for domain configuration
 */
export type DnsRecordType = 'A' | 'CNAME';

/**
 * DNS record required for domain configuration
 */
export interface DnsRecord {
  /** Record type (A for apex, CNAME for subdomains) */
  type: DnsRecordType;
  /** The DNS name to configure */
  name: string;
  /** The value to set (IP for A, hostname for CNAME) */
  value: string;
}

/**
 * DNS provider information for a domain
 */
export interface DnsProvider {
  /** Provider name (e.g., "Cloudflare", "GoDaddy"), null if unknown */
  name: string | null;
}

/**
 * Response for domain DNS provider lookup
 */
/**
 * What a DNS lookup found for a domain. An envelope rather than a bare
 * {@link DnsProvider} because a lookup can succeed and learn more than the
 * provider later; the shape is named so a consumer can hold one.
 */
export interface DnsLookup {
  /** The provider serving this domain's DNS, absent when unidentified */
  provider?: DnsProvider;
}

/**
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface DomainDnsResponse {
  /** The domain name */
  domain: string;
  /** DNS provider information, null if not yet looked up */
  dns: DnsLookup | null;
}

/**
 * Response for `GET /domains/:domain/share` — the domain plus the salted
 * hash that lets someone else complete its DNS setup without an account.
 *
 * `/admin/domains/:domain/share` answers the same shape, which is the admin
 * law working: the operator surface is the public grammar with a prefix.
 *
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface DomainShareResponse {
  /** The domain the setup link is for */
  readonly domain: string;
  /** The salted setup hash that authorizes the share */
  readonly hash: string;
}

/**
 * Response for domain DNS records
 *
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface DomainRecordsResponse {
  /** The domain name */
  domain: string;
  /** The apex (registered) domain where DNS records are managed */
  apex: string;
  /** Required DNS records for configuration */
  records: DnsRecord[];
}

/**
 * The envelope an `Idempotency-Key` must fit, and how long a replay lasts.
 *
 * Format lives here rather than on the server alone by the format-vs-policy
 * rule: a client can decide offline whether a key is well-formed, and the
 * API would reject the same value the same way.
 */
export const IDEMPOTENCY_KEY_CONSTRAINTS = {
  /**
   * HTTP header name. Here for the same reason {@link CALLER.HEADER} is: a
   * wire header has two ends, and the package that owns the value's format
   * is the only place both ends can read its name from.
   */
  HEADER: 'Idempotency-Key',
  MAX_LENGTH: 256,
  /** How long a stored 201 stays replayable. */
  WINDOW_SECONDS: 24 * 60 * 60,
} as const;

/**
 * Normalize a `via` value from any transport — trimmed, lowercased, and a
 * member of {@link DeploymentVia}, or `undefined`.
 *
 * A format rule by this package's own test: a client can decide offline
 * whether a value is well-formed, and the API reaches the same verdict on the
 * same input. It lived server-side until 2026-08-06, which meant clients could
 * only learn their label was unusable by noticing analytics had gone quiet.
 *
 * **Not knowing your `via` is not an error** — an unrecognized value yields
 * `undefined` rather than throwing, because origin tracking is telemetry and a
 * deploy must never fail over it. A caller that has an honest default should
 * prefer it (`normalizeVia(process.env.SHIP_VIA) ?? DeploymentVia.CLI`): the
 * deploy really did come from the CLI, so recording that beats recording
 * nothing.
 */
export function normalizeVia(value: unknown): DeploymentViaType | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const via = value.trim().toLowerCase();
  return (Object.values(DeploymentVia) as string[]).includes(via)
    ? (via as DeploymentViaType)
    : undefined;
}

/**
 * Validate an idempotency key, returning the trimmed value or `undefined`
 * when none was supplied. Throws {@link ShipError.validation} when the value
 * cannot be sent — the same verdict the API would reach, reached earlier.
 */
export function validateIdempotencyKey(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw ShipError.validation('Idempotency key must be a string.');
  }
  const key = value.trim();
  if (!key) {
    throw ShipError.validation('Idempotency key must not be empty.');
  }
  if (key.length > IDEMPOTENCY_KEY_CONSTRAINTS.MAX_LENGTH) {
    throw ShipError.validation(
      `Idempotency key must be at most ${IDEMPOTENCY_KEY_CONSTRAINTS.MAX_LENGTH} characters.`,
    );
  }
  return key;
}

/**
 * Response for `GET /labels` — every label in use across the caller's
 * deployments, domains and tokens, grouped and ordered by last use.
 *
 * The one plural noun outside the list contract, deliberately: labels have
 * no identity, no row and no `created`, so there is nothing for a keyset
 * cursor to resume after, and its consumer is an autocomplete that wants the
 * whole set. Bounded by `PAGINATION.GLOBAL_LIMIT` rather than paginated.
 *
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface LabelsResponse {
  readonly labels: string[];
}

/**
 * Response for `POST /setup` — the DNS instructions for one domain, written
 * for a human to follow at their registrar.
 *
 * `custom` is the provider-specific walkthrough when the provider is known;
 * `generic` always answers, so a caller never has nothing to show.
 *
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface SetupInstructionsResponse {
  /** The domain the instructions are for — a report names its subject */
  readonly domain: string;
  /** One-line summary of what to do */
  readonly tldr: string;
  /** Provider-specific instructions, null when the provider is unknown */
  readonly custom: string | null;
  /** Provider-agnostic instructions — always present */
  readonly generic: string;
  /** The identified DNS provider, null when unknown */
  readonly provider: string | null;
}

/**
 * `POST /domains/validate` — a report answering "is this name usable, and if
 * not, why".
 *
 * An unusable name is a legitimate ANSWER, not a failure, so this is a 200 and
 * the verdict rides the body. `reason` was named `error` until 2026-07-29,
 * which collided with {@link ErrorResponse}'s reserved key — there `error` is
 * an `ErrorType` a client branches on, here it is prose a client displays, and
 * one key cannot mean both. See {@link DeploymentDeleteResponse} for the law.
 */
export interface DomainValidateResponse {
  /** Whether the domain is valid */
  valid: boolean;
  /** Normalized domain name, null when invalid */
  normalized: string | null;
  /** Whether the domain is available, null when invalid */
  available: boolean | null;
  /** Why the name is unusable, null when valid — displayed verbatim. */
  reason: string | null;
}

// =============================================================================
// TOKEN TYPES
// =============================================================================

/**
 * Core deploy token object - used in both API responses and SDK.
 *
 * The secret is never here: it is shown once at creation
 * ({@link TokenCreateResponse.secret}) and never again, so an entity read
 * carries only the management identifier and lifecycle metadata.
 */
export interface Token {
  /** 7-char management identifier (e.g., "a1b2c3d") */
  readonly token: string;
  /** Labels for categorization and filtering. Always present, empty array when none. */
  labels: string[];
  /** Unix timestamp (seconds) when token was created */
  readonly created: number;
  /** Unix timestamp (seconds) when token expires, null for never */
  readonly expires: number | null;
  /** Unix timestamp (seconds) of the last request authenticated with this token, null if never used */
  readonly used: number | null;
}

/**
 * Response for listing tokens
 */
export interface TokenListResponse extends ListResponse {
  /** Array of tokens (the secret is never among them) */
  tokens: Token[];
}

/**
 * Response from token creation. Extends Token with the one field that
 * exists only on creation — the same shape as
 * {@link DeploymentCreateResponse}, because a 201 returns the resource it
 * created plus whatever is knowable only once.
 */
export interface TokenCreateResponse extends Token {
  /** The raw credential value (shown once at creation, then never again) */
  readonly secret: string;
}

/**
 * Acknowledgement of `DELETE /tokens/:token`. The credential is revoked and
 * its row is gone, so the management identifier is the whole answer. See
 * {@link DeploymentDeleteResponse} for the law.
 */
export interface TokenDeleteResponse {
  /** The 7-char management identifier that was revoked */
  readonly token: string;
}

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

/**
 * Every plan an account can hold — the platform's whole plan vocabulary, in
 * one place, and nothing about what a plan is WORTH.
 *
 * A plan is a TIER and nothing else. Whether an account may act is a separate
 * fact (`Account.suspended`; deletion ends the session outright), so an
 * account keeps its tier through suspension and into deletion.
 *
 * - **Free** — `free`.
 * - **Billed** — `pro`, `team`. The plans a customer buys; the only plans
 *   Stripe knows about, and the only ones the platform never sets by hand —
 *   each is derived from the Stripe Subscription, which names its plan on the
 *   Price it is on. They form a ladder: a dearer tier is a superset of the one
 *   below it, and the API says which is next in {@link Account.upgrade}.
 * - **Granted** — `scale`, `sponsored`. Paid plans the operator confers by
 *   hand; no Stripe subscription, no Checkout, no Stripe object at all. These
 *   and `free` are the only plans an operator can set; a billed plan is only
 *   ever Stripe's to confer.
 *
 * The numbers each plan confers — caps, sizes — are POLICY and are delivered
 * by the API (`GET /plans`, `GET /account`, `GET /limits`), never published
 * here: a price or a cap in a published package is pinned to whatever version
 * a client installed (`CLAUDE.md`, "Validation: format vs policy").
 */
export const AccountPlan = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
  SCALE: 'scale',
  SPONSORED: 'sponsored',
} as const;

export type AccountPlanType = (typeof AccountPlan)[keyof typeof AccountPlan];

/**
 * The three things an account ACCUMULATES, and therefore the three things a
 * plan caps. One word for the count and for the ceiling: `Account.usage` and
 * `Account.caps` are the same shape, so a surface renders "2 of 3" by
 * dividing one by the other and can never divide by a different denominator
 * than the 403 uses.
 *
 * All three are counts plans SELL, and every plan publishes a number for each.
 * A platform subdomain (`my-app.shipstatic.com`) is among them: the namespace
 * is the platform's, so every plan bounds how many names one account may take
 * from it — which is not the address every deployment gets by construction
 * (`happy-cat-abc1234.shipstatic.com`), one per deployment and bounded by
 * `deployments` already.
 *
 * Every cap carries a number on every plan — never `null`, never
 * "unlimited" — so no consumer needs an "is it bounded?" branch. A cap of `0`
 * means the plan does not have the feature at all; a cap of `N` bounds
 * creation, and what an account already holds above a cap stays until a plan
 * TRANSITION fits it (excess paused, newest first — a domain is the only kind
 * that pauses).
 *
 * A count is an aggregate over a collection, so it lives on the summary
 * resource that owns the collection: `GET /account` for one caller, `GET
 * /admin/stats` platform-wide. Lists answer pages and carry no `total` (see
 * {@link ListOptions}).
 */
export interface Caps {
  /**
   * Deployments — every row whatever its status, because that is what the cap
   * counts. (`GET /deployments` lists successful ones only; that is a
   * different question asked of a different resource.)
   */
  readonly deployments: number;
  /**
   * Names the customer chose under the platform's own suffix
   * (`my-app.shipstatic.com`) — every row, paused ones included, by the same
   * rule as custom domains.
   */
  readonly platformDomains: number;
  /**
   * Hostnames the customer owns — every row, paused ones included. A paused
   * domain still occupies its slot, so deleting one is what frees capacity.
   * A downgraded account therefore reads honestly as "3 of 0".
   */
  readonly customDomains: number;
}

/**
 * Core account object - used in both API responses and SDK
 * All fields are readonly to prevent accidental mutations
 */
export interface Account {
  /** User email address */
  readonly email: string;
  /** User display name, null if not set */
  readonly name: string | null;
  /** User profile picture URL, null if not set */
  readonly picture: string | null;
  /** The account's tier. */
  readonly plan: AccountPlanType;
  /**
   * True while the operator has suspended the account: reads and deletes
   * still work, every write is refused. The plan is unchanged underneath.
   */
  readonly suspended: boolean;
  /** What the account currently holds — see {@link Caps}. */
  readonly usage: Caps;
  /**
   * What the account is allowed to hold — the same three keys as
   * {@link usage}, so the pair divides. These are the account's EFFECTIVE
   * caps: its plan's numbers, plus whatever the operator granted it
   * individually.
   */
  readonly caps: Caps;
  /** Unix timestamp (seconds) when account was created */
  readonly created: number;
  /** Unix timestamp (seconds) when account was activated (first deployment), null if not yet activated */
  readonly activated: number | null;
  /** Last 4 characters of the API key for identification, null when no key generated */
  readonly hint: string | null;
  /**
   * Unix timestamp (seconds) of the API key's last use, null when never
   * used or no key generated. Optional on the type by the additive-evolution
   * law: published SDK versions may predate the field, so consumers read it
   * when present rather than forcing a lockstep SDK release.
   */
  readonly used?: number | null;
  /**
   * True while the Stripe Subscription's status is `past_due` and Stripe is
   * still retrying the card. The plan is unchanged — the account keeps
   * everything it has — so this is a banner, not a gate.
   *
   * A BOOLEAN rather than the status string: one fact for the console to act
   * on. It carries STRIPE'S OWN WORD (`past_due` → `pastDue`) rather than a
   * synonym, so no reader has to hold a translation; the full status string is
   * mirrored on the account row for the operator surface.
   */
  readonly pastDue: boolean;
  /**
   * Does Stripe bill this plan — is there a Subscription behind it? True for
   * every billed tier, including one no longer on the menu (a grandfathered
   * row keeps its subscribers), so a console cannot derive it from `/plans`.
   * It is what sends the account to the Customer Portal rather than to
   * Checkout, and what a granted plan (`scale`, `sponsored`) never is.
   */
  readonly billed: boolean;
  /**
   * The next plan up the ladder this account could move to, or `null` when
   * there is none: the top billed tier, every granted plan, and any plan not
   * on the menu answer `null`. One server-side fact so that no surface
   * derives "can this account upgrade, and to what" from the menu — a
   * grandfathered row has no menu price to compare, and a granted account
   * must never be sent to Checkout.
   */
  readonly upgrade: AccountPlanType | null;
  /**
   * The live Subscription's billing interval — Stripe's
   * `Price.recurring.interval`, mirrored — or `null` when no Subscription
   * bills the account (free and granted plans). It is what lets the console
   * offer the current plan's OTHER interval as a switch.
   */
  readonly interval: BillingInterval | null;
  /**
   * The pending plan change, or `null`. *Up is now, down is at period end*:
   * a downgrade is a Stripe Subscription Schedule that applies at `at`, and
   * until then the account keeps everything it paid for. Reversible —
   * `DELETE /billing/change` releases it.
   */
  readonly scheduled: ScheduledChange | null;
  /**
   * When the Subscription is set to END — Stripe's `cancel_at`, mirrored
   * (Unix seconds) — or `null` while it renews. Set by a cancellation in the
   * Customer Portal; the Portal is also where it is resumed. The console
   * needs it to ACT: no "cancel" offered to an account already cancelling,
   * and no plan change offered until it is resumed (the API refuses one).
   * Mirrored on the rule that survives: what the console must act on is
   * mirrored, what it would merely display is not.
   */
  readonly cancelAt: number | null;
}

/**
 * Account as returned by `GET /account` — the entity plus how the request
 * was authorized, so `whoami` can answer "what credential am I holding?".
 * Request-scoped fields live on the response type, never on the entity
 * (the `DeploymentCreateResponse` pattern).
 */
export interface AccountGetResponse extends Account {
  /** How the request that produced this response was authorized. */
  readonly authMethod: AuthMethodType;
  /** Present (and true) only when the caller is an operator acting as themselves. */
  readonly isAdmin?: true;
  /** Present only during read-only admin impersonation: the operator's account id. */
  readonly impersonatedBy?: string;
}

/**
 * Acknowledgement of `DELETE /account` (202). Termination is asynchronous —
 * a cleanup consumer finishes the job — so the account survives long enough
 * to state the plan it is transitioning through. `plan` is the account's
 * state field, the way `status` is a deployment's. See
 * {@link DeploymentDeleteResponse} for the law.
 */
export interface AccountDeleteResponse {
  /** The account whose deletion was accepted */
  readonly account: string;
  /** Unix timestamp (seconds) the deletion was requested; cleanup completes it */
  readonly deleted: number;
}

/**
 * Response from `PUT /account/key` — the account's single API key, minted in
 * place of whatever was there before.
 *
 * There is no entity to return: only the key's last-4 `hint` is durable
 * (`Account.hint`), and the plaintext exists exactly once, in this response.
 * The raw credential is `secret` on every surface that mints one — the same
 * field `TokenCreateResponse` carries — because one concept gets one name.
 *
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface AccountKeyResponse {
  /** The raw API key (shown once at mint, then never again) */
  readonly secret: string;
}

// =============================================================================
// WIRE SURFACE
// =============================================================================

/**
 * Every path the public API answers on, declared once.
 *
 * The URL surface was written out in four places — the API's mounts, the
 * SDK's client, the dashboard's client, and the post-deploy smoke — so a
 * rename meant finding all four. The first three now read this table.
 *
 * The smoke (`cloudflare/api/smoke.mjs`) deliberately still spells its own:
 * five of its nine paths are `/admin/*`, which this table excludes by
 * design, and splitting one list between a registry and literals reads worse
 * than keeping it uniform.
 *
 * **What this guarantees, exactly.** Collection paths are mounted from here,
 * so producer and consumer cannot diverge. Item paths are declared here and
 * consumed by clients, but the API spells them relative to their mount
 * (`/:deployment/config`), so the table does not *generate* them — it is
 * held to them by `api/tests/architecture/api-paths.test.ts`, which fails if
 * any entry names a path no route answers. Some entries have no client yet
 * (`DEPLOYMENT_CONFIG`, `DOMAIN_PROPAGATION` — endpoints the SDK
 * deliberately does not reach); the fence is what keeps those honest rather
 * than merely asserted.
 *
 * **The operator surface is deliberately absent.** `/admin/*` paths belong
 * to `web/my`, for the same reason its row types do: this package is
 * published, and the operator surface is not public (see `CLAUDE.md`, "Admin
 * types"). A path here is a promise to every npm consumer; `/admin` is a
 * promise to one dashboard.
 *
 * Item paths are functions rather than templates so the key is interpolated
 * in one place, encoded the same way by every caller.
 */
export const API_PATHS = {
  DEPLOYMENTS: '/deployments',
  DEPLOYMENT: (deployment: string) => `/deployments/${deployment}`,
  DEPLOYMENT_CONFIG: (deployment: string) => `/deployments/${deployment}/config`,
  DOMAINS: '/domains',
  DOMAIN: (domain: string) => `/domains/${domain}`,
  DOMAIN_VERIFY: (domain: string) => `/domains/${domain}/verify`,
  DOMAIN_DNS: (domain: string) => `/domains/${domain}/dns`,
  DOMAIN_RECORDS: (domain: string) => `/domains/${domain}/records`,
  DOMAIN_SHARE: (domain: string) => `/domains/${domain}/share`,
  DOMAIN_PROPAGATION: (domain: string) => `/domains/${domain}/propagation`,
  DOMAINS_VALIDATE: '/domains/validate',
  TOKENS: '/tokens',
  TOKEN: (token: string) => `/tokens/${token}`,
  ACCOUNT: '/account',
  ACCOUNT_KEY: '/account/key',
  ACCOUNT_CLAIM: '/account/claim',
  ACTIVITIES: '/activities',
  LABELS: '/labels',
  LIMITS: '/limits',
  PLANS: '/plans',
  PING: '/ping',
  SETUP: '/setup',
  SPA_CHECK: '/spa-check',
  UPLOAD: '/upload',
} as const;

/**
 * The deploy request's multipart field names — the other half of the wire
 * surface beside {@link API_PATHS}. `POST /deployments` (and the first-party
 * `/upload`) is multipart/form-data, and these are the names the API reads.
 *
 * Declared once because the body has three independent WRITERS — the SDK's
 * Node and browser body builders, and the n8n community node's hand-rolled
 * client (which cannot import this under n8n Cloud's zero-dependency rule,
 * and fences its restated copy instead) — and until this export every writer
 * restated the strings the API parses, with nothing comparing them.
 *
 * `FILES` carries one entry per file (the API reads it with `getAll`); every
 * other field is single. The `@internal` flags are serialized as the literal
 * string `'true'` and belong to first-party surfaces only.
 */
export const DEPLOY_FIELDS = {
  /** One entry per file — read with `getAll`. */
  FILES: 'files[]',
  /** JSON array of MD5 hex digests, index-aligned with `FILES`. */
  CHECKSUMS: 'checksums',
  /** JSON array of label strings. */
  LABELS: 'labels',
  /** The deploying surface's {@link DeploymentVia} member. */
  VIA: 'via',
  /** Plaintext password — the API hashes it server-side. */
  PASSWORD: 'password',
  /**
   * Requested lifetime in SECONDS — a duration, never an instant. The API
   * computes and stores the expiry, so the wire carries no client clock.
   * See {@link validateTtl}.
   */
  TTL: 'ttl',
  /** @internal Server-processing flag — first-party `/upload` only. */
  BUILD: 'build',
  /** @internal Server-processing flag — first-party `/upload` only. */
  PRERENDER: 'prerender',
  /** @internal Server-processing flag — first-party `/upload` only. */
  SPA: 'spa',
  /** @internal reCAPTCHA proof — `web/www`'s public uploader only. */
  CAPTCHA: 'captcha',
} as const;

// =============================================================================
// ERROR SYSTEM
// =============================================================================

/**
 * All possible error types in the ShipStatic platform.
 *
 * Developer-friendly key names map to stable wire-format string values.
 * Both the value and the type are exported under the same name so callers
 * can use `ErrorType.Validation` (value comparison) and `: ErrorType` (type
 * annotation) without ceremony — matching the pattern other status objects
 * (`DeploymentStatus`, `DomainStatus`, `AccountPlan`, `AuthMethod`) follow.
 */
export const ErrorType = {
  /**
   * Validation failed. Input shape is wrong.
   *
   * Carries 400 when an API judged it — including a client-side pre-check of a
   * rule the server enforces too, which keeps the error identical wherever it
   * was caught. **Statusless** when a client rejects something no API judges,
   * such as a CLI's own command grammar: `status` is documented "(API
   * contexts)" on `ErrorResponse`, so there is none to report.
   */
  Validation: 'validation_failed',
  /** Resource not found (404). */
  NotFound: 'not_found',
  /** Authenticated but not allowed (403). User lacks permission for this action. */
  Forbidden: 'forbidden',
  /** Rate limit exceeded (429). */
  RateLimit: 'rate_limit_exceeded',
  /** Authentication required or failed (401). Missing/invalid credentials. */
  Authentication: 'authentication_failed',
  /** Business rule violation. Catch-all for 4xx state-rule errors that aren't more specific. */
  Business: 'business_logic_error',
  /** API server error (500). Generic server-side fault. */
  Api: 'internal_server_error',
  /**
   * The platform is closed for maintenance (503). A deliberate operator
   * state, not a fault — nothing errored; the API is refusing work on
   * purpose, and deployed sites keep serving throughout.
   *
   * Distinct from `Api` at 503, which the platform already uses for a
   * dependency that failed (moderation unavailable). A consumer has to tell
   * "we closed the door" from "something broke": the two get opposite words
   * and opposite retry behaviour.
   */
  Maintenance: 'maintenance',
  /** Network/connection error. Client-side only — set by HTTP clients on fetch failure; never produced server-side. */
  Network: 'network_error',
  /**
   * A deadline expired before the exchange completed. Client-side only — set
   * by HTTP clients when a timeout signal fires; never produced server-side.
   *
   * A member of the NETWORK category rather than a sibling of it:
   * `isNetworkError()` answers "nothing was exchanged", which is true of a
   * deadline exactly as it is of a refused connection, so every consumer that
   * retries, declines to report, or declines to relay a wire message on that
   * category is already right about a timeout. The distinct TYPE exists for
   * the one decision the category cannot make — what to SAY. "Check your
   * internet connection" is the wrong sentence for a five-minute deploy
   * ceiling, and a surface can only tell the two apart by type.
   *
   * The same relationship every comparable SDK ships:
   * `APIConnectionTimeoutError extends APIConnectionError`.
   */
  Timeout: 'timeout_error',
  /** Operation was cancelled. Client-side only — set on `AbortSignal` abort; never produced server-side. */
  Cancelled: 'operation_cancelled',
  /** File operation error. Client-side only — set by SDK during local file processing; never produced server-side. */
  File: 'file_error',
  /** Configuration error. Client-side only — set by SDK during config parsing/validation; never produced server-side. */
  Config: 'config_error',
} as const;

export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType];

/**
 * Error types that originate exclusively on the client (HTTP clients, SDK
 * file processing, local config parsing). These never appear on the wire
 * from the server, so `fromHttpResponse` will not trust them even if a
 * misbehaving server claims one in `body.error`.
 */
const CLIENT_ONLY_ERROR_TYPES = new Set<string>([
  ErrorType.Network,
  ErrorType.Timeout,
  ErrorType.Cancelled,
  ErrorType.File,
  ErrorType.Config,
]);

/**
 * Categorizes error types for the `isClientError` / `isNetworkError` /
 * `isAuthError` helpers. Each `Set` is typed against the wider `ErrorType`
 * union so `.has(error.type)` accepts any value from the union.
 */
const ERROR_CATEGORIES = {
  /**
   * Client-attributable types. Exhaustive over the 4xx-carrying types, and
   * over the statusless ones too — those are raised locally and have no
   * status for `isClientError`'s second arm to read, so omitting one makes it
   * read as a server fault. The rule is the membership test: every type in
   * `CLIENT_ONLY_ERROR_TYPES` except the two `isNetworkError` owns belongs
   * here.
   *
   * `Cancelled` was missing until 2026-07-29, which is exactly that failure:
   * a caller who aborted their own deploy was told "server error: please try
   * again" — the CLI's fallback for everything this set does not claim.
   *
   * `Timeout` is deliberately NOT here, and it is the sharper case, because
   * it is the one client-only type that is not the client's fault: the
   * caller set a ceiling, but what exhausted it was the network or the
   * server. Reading it as client-attributable would say the caller erred,
   * and it would silently disarm every consumer whose retry predicate
   * declines `isClientError()` — a deadline is precisely the failure worth
   * a second attempt.
   */
  client: new Set<ErrorType>([
    ErrorType.Business,
    ErrorType.Cancelled,
    ErrorType.Config,
    ErrorType.File,
    ErrorType.Forbidden,
    ErrorType.NotFound,
    ErrorType.RateLimit,
    ErrorType.Validation,
  ]),
  /**
   * The exchange never happened. Two types, one category: a refused
   * connection and an expired deadline differ in what a surface should SAY
   * and in nothing else a consumer decides on — both are retryable, neither
   * carries a wire message to relay, neither is worth reporting as an
   * incident. See `ErrorType.Timeout` for why the type is distinct anyway.
   */
  network: new Set<ErrorType>([ErrorType.Network, ErrorType.Timeout]),
  auth: new Set<ErrorType>([ErrorType.Authentication]),
} as const;

/**
 * Error types the server can legitimately produce on the wire. Used by
 * `ShipError.fromHttpResponse` to validate the body's `error` field before
 * trusting it as `ShipError.type`. Derived by exclusion from
 * `CLIENT_ONLY_ERROR_TYPES` so adding a new server-producible type to
 * `ErrorType` is automatically picked up.
 */
const SERVER_PRODUCIBLE_ERROR_TYPES = new Set<string>(
  Object.values(ErrorType).filter((t) => !CLIENT_ONLY_ERROR_TYPES.has(t)),
);

/**
 * Ceiling on a message adopted from a **non-JSON** error body — a foreign
 * responder's, never this platform's. Generous for the plain-text one-liners
 * intermediaries actually send (`error code: 1015`), far below a document.
 * Our own messages are never measured against it: a JSON body is the API's
 * contract, and truncating a long validation message would be the bug.
 */
const MAX_FOREIGN_MESSAGE_LENGTH = 200;

/**
 * Did the runtime say the exchange never completed?
 *
 * Clients branch on the TYPE, never on message strings, so a misclassified
 * transport failure is a lie every consumer inherits — and the one that costs
 * most: `Api` claims a server answered when nothing was exchanged, and a
 * retrying caller will not retry it.
 *
 * **Every row below is a transcript, not a belief.** Captured 2026-08-12
 * against real runtimes — Node and Bun by direct run, the three engines by a
 * one-off playwright probe, workerd through miniflare. The capture scripts are
 * in `tests/errors.test.ts`, "runtime failure shapes".
 *
 * | runtime          | connection refused / DNS failure                     | malformed URL                                    |
 * |------------------|------------------------------------------------------|--------------------------------------------------|
 * | Node 22 / undici | `TypeError: fetch failed`                             | `TypeError: Failed to parse URL from …`          |
 * | Bun 1.3.14       | `Error` `code:'ConnectionRefused'`                    | `TypeError` `code:'ERR_INVALID_URL'`             |
 * | Chromium 151     | `TypeError: Failed to fetch`                          | `TypeError: …Failed to parse URL from …`         |
 * | Firefox 153      | `TypeError: NetworkError when attempting to fetch …`  | `TypeError: … is not a valid URL.`               |
 * | WebKit 26.5      | `TypeError: Load failed`                              | `TypeError: URL is not valid or contains user …` |
 * | workerd          | `Error: Network connection lost.` (DNS: `internal error; reference = …`) | `TypeError: Invalid URL: …`   |
 *
 * Reading that table gives the rule, and it is the INVERSE of the obvious one.
 * The transport class is unbounded — every OS, TLS and DNS failure any engine
 * will ever name — while the class fetch raises for its own ARGUMENTS is
 * small, and every runtime names the URL when it complains about one. So the
 * bounded side is the one worth testing, and the residual risk points the safe
 * way: an unrecognised sentence lands on `Network`, which says only that
 * nothing was exchanged.
 *
 * That inversion is what fixes **WebKit**, whose `Load failed` carries no code
 * and no "fetch", and which every browser-SDK and `@shipstatic/drop` user on
 * Safari was hitting as `Api`. It also makes the six runtimes AGREE about a
 * malformed URL, which they did not before: the previous rule tested the
 * message for "fetch", and Chromium's and Firefox's URL complaints both
 * contain it, so the same mistake was `Network` on three engines and `Api` on
 * three.
 *
 * **workerd is the recorded gap.** It rejects with a plain `Error`, no code
 * and no shared sentence — and its two failure modes produce two unrelated
 * ones — so nothing here can classify it and it lands on `Api`. Left alone
 * rather than patched with a dialect string: the one consumer running ship in
 * that runtime (`cloudflare/mcp`) reaches the API through a service BINDING,
 * which is in-process and does not produce transport rejections at all.
 *
 * **The `TokenProvider` case stopped being a trade when clients gained
 * retries.** A caller's provider that throws a coded error is typed `Network`
 * here, which was recorded as "both are wrong for it; `Network` is the cheaper
 * wrong" — written when the classification decided only what a surface would
 * SAY. It now also decides whether the call is retried, and that turns the
 * cheaper wrong into the right answer: a `TokenProvider` is where minting and
 * refresh live, so the common one is an OAuth refresh over the network, and a
 * transient failure there is precisely what another attempt repairs.
 *
 * The residual cost is a deterministic provider fault — a genuinely missing
 * keychain entry — invoking the provider three times over a few hundred
 * milliseconds before failing with the same error. No request leaves the
 * process on any of them. That is the cheap direction of a bet whose other
 * side is a refused deploy, and suppressing it would need a way to mark
 * credential faults non-retryable: machinery with one holder, refused by the
 * estate's stopping rule. Provider failures that carry no code are `Api` and
 * are not retried at all, and a provider yielding nothing is `Authentication`
 * by the fail-closed invariant, which is likewise terminal.
 */
function isTransportFailure(cause: Error): boolean {
  const code = (cause as { code?: unknown }).code;

  // Bun is the one runtime that puts a CODE on an argument error, so it is
  // excluded before the code arm can claim it.
  if (code === 'ERR_INVALID_URL') return false;

  // A string `code` is a runtime naming a transport-level failure. An
  // allowlist of codes was written first and rejected — the TLS row alone
  // would mean enumerating BoringSSL's certificate table, and a code nobody
  // guessed is precisely the bug this closes. A `DOMException`'s code is a
  // NUMBER, so aborts and timeouts never reach here.
  if (typeof code === 'string') return true;

  // WHATWG has fetch reject with a TypeError for BOTH halves — network error
  // and argument error — so among TypeErrors the URL is the discriminator.
  if (cause instanceof TypeError) return !/\burl\b/i.test(cause.message);

  // Anything else — an ordinary JS fault, or workerd — is not evidence.
  return false;
}

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
  /** Optional additional error details. Untyped by design — narrow at the read site. */
  details?: unknown;
}

/**
 * Simple unified error class for both API and SDK
 */
export class ShipError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ShipError';
  }

  /** Convert to wire format */
  toResponse(): ErrorResponse {
    // Strip authentication details when they carry an `internal` telemetry
    // tag (see `ShipError.authentication` JSDoc) — these are server-side
    // diagnostics like 'session_invalid' that must not leak to clients.
    const authDetails = this.details as { internal?: unknown } | undefined;
    const details =
      this.type === ErrorType.Authentication && authDetails?.internal ? undefined : this.details;

    return {
      error: this.type,
      message: this.message,
      status: this.status,
      details,
    };
  }

  /**
   * Construct a `ShipError` from an HTTP error response.
   *
   * Best-effort body parse for `{ message, error?, details? }`. Message
   * resolution: `body.message` → `body.error` → `"<operationName> failed with
   * status <N>"`.
   *
   * Type resolution: trusts `body.error` when it's a known server-producible
   * `ErrorType` (preserves the wire's intent — server's
   * `ShipError.validation(...)` round-trips back to `ErrorType.Validation`
   * on the client). Falls back to status-derived (401 → Authentication,
   * 403 → Forbidden, 429 → RateLimit, else → Api) for non-API responses
   * (CDN errors, intermediaries) or malformed bodies. Client-only types
   * (`Network`, `Timeout`, `Cancelled`, `File`, `Config`) are filtered out of the
   * trusted set — a misbehaving server claiming one of those is ignored.
   *
   * `operationName` (e.g. `"Get account"`) is used to compose the fallback
   * message. Defaults to `"Request"`. Same convention as `fromFetchError`.
   *
   * Async because it reads the response body. Returns rather than throws so
   * callers can compose; most will `throw await ShipError.fromHttpResponse(...)`.
   */
  static async fromHttpResponse(response: Response, operationName?: string): Promise<ShipError> {
    let message: string | undefined;
    let details: unknown;
    let bodyType: ErrorType | undefined;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const json: unknown = await response.json();
        if (json && typeof json === 'object') {
          const obj = json as Record<string, unknown>;
          if (typeof obj.message === 'string') message = obj.message;
          else if (typeof obj.error === 'string') message = obj.error;
          details = obj.details;
          if (typeof obj.error === 'string' && SERVER_PRODUCIBLE_ERROR_TYPES.has(obj.error)) {
            bodyType = obj.error as ErrorType;
          }
        }
      } else {
        // A non-JSON body did not come from this platform — every API error
        // is `ErrorResponse` JSON — so it is an intermediary's output, and
        // the two kinds it produces need opposite treatment. A CDN's plain
        // `error code: 1015` is the most useful thing there is to say. A
        // proxy's HTML error page is a *document*, not a message: adopting it
        // verbatim made a misconfigured `apiUrl` print 2,059 characters of
        // markup as the error. Trust it only when it reads as a message.
        const text = (await response.text()).trim();
        if (text && !text.startsWith('<') && text.length <= MAX_FOREIGN_MESSAGE_LENGTH) {
          message = text;
        }
      }
    } catch {
      // Body unreadable; fall through to operationName-derived message.
    }

    // Rate-limit (and 503) timing rides the `Retry-After` HEADER, which a
    // body-only reader would drop. Lift it into `details` as seconds so
    // consumers can back off from the typed error alone, without keeping the
    // raw Response around. Body-carried fields are preserved and win.
    const retryAfterHeader = response.headers.get('retry-after');
    if (retryAfterHeader !== null) {
      const value = retryAfterHeader.trim();
      const seconds = /^\d+$/.test(value)
        ? Number(value)
        : Math.ceil((Date.parse(value) - Date.now()) / 1000);
      if (Number.isFinite(seconds) && seconds >= 0) {
        const existing =
          details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
        if (existing.retryAfter === undefined) {
          details = { ...existing, retryAfter: seconds };
        }
      }
    }

    message = message || `${operationName || 'Request'} failed with status ${response.status}`;

    const type =
      bodyType ??
      (response.status === 401
        ? ErrorType.Authentication
        : response.status === 403
          ? ErrorType.Forbidden
          : response.status === 429
            ? ErrorType.RateLimit
            : ErrorType.Api);

    return new ShipError(type, message, response.status, details);
  }

  /**
   * Construct a `ShipError` from an error caught around a `fetch()` call.
   *
   * The mirror of `fromHttpResponse` for the *other* side of the HTTP error
   * story — the network layer failing (offline, CORS, abort) rather than the
   * server returning a non-OK response.
   *
   * Routing:
   * - Already a `ShipError` → returned as-is (caller's intent preserved)
   * - `AbortError` → `ShipError.cancelled(...)` — someone stopped it on purpose
   * - `TimeoutError` → `ShipError.timeout(...)` — a deadline expired; the
   *   message names the timeout, and the type is in the network CATEGORY
   *   because nothing was exchanged
   * - A transport failure → `ShipError.network(...)` — see `isTransportFailure`
   *   for what each runtime offers as evidence
   * - Any other `Error` → `ShipError(Api, ...)` (no HTTP status — fetch never reached the server)
   * - Anything else (string, undefined, etc.) → `ShipError(Api, ...)`
   *
   * **Abort and timeout are read from `name` BEFORE any `instanceof Error`
   * gate.** A `DOMException` satisfies that gate in every runtime measured
   * (Node, Bun, Chromium, Firefox, WebKit, workerd — all six), but the
   * inheritance is a comparatively recent spec change and this classification
   * has no reason to depend on it: `name` is where the meaning lives, and
   * reading it first costs nothing. The suite plants a non-`Error`
   * `DOMException` shape to hold the arm, since no runtime on the table
   * produces one.
   *
   * A caller's own `AbortSignal.timeout()` is the reachable source of
   * `TimeoutError` — and the two are NOT interchangeable per runtime: WebKit
   * reports a fired `AbortSignal.timeout()` as `AbortError`, so on Safari a
   * deadline is indistinguishable from a cancellation and lands on
   * `Cancelled`. Recorded rather than worked around; `Cancelled` is honest
   * there, since the caller's signal is what stopped it.
   *
   * The optional `operationName` is composed into the message for context:
   * `"Get account was cancelled"`, `"Get account failed: ..."`. Defaults to
   * `"Request"` when omitted.
   */
  static fromFetchError(cause: unknown, operationName?: string): ShipError {
    if (isShipError(cause)) return cause;

    const op = operationName || 'Request';

    // Read by NAME, ahead of the Error gate — see the note above.
    const name = (cause as { name?: unknown } | null | undefined)?.name;
    if (name === 'AbortError') {
      return ShipError.cancelled(`${op} was cancelled`);
    }
    if (name === 'TimeoutError') {
      // A deadline: not a fault, not a cancellation, and — since it has its
      // own type — no longer merely "network". Nothing was exchanged, which
      // is what keeps it in the network CATEGORY and therefore retryable; the
      // type is what lets a surface say "timed out" instead of sending
      // someone to check their Wi-Fi. The runtime's own sentence is dropped
      // rather than relayed: "The operation was aborted due to timeout" is
      // the mechanism, not the news.
      return ShipError.timeout(`${op} timed out`, { cause });
    }

    if (cause instanceof Error) {
      if (isTransportFailure(cause)) {
        return ShipError.network(`${op} failed: ${cause.message}`, { cause });
      }
      return new ShipError(ErrorType.Api, `${op} failed: ${cause.message}`);
    }

    return new ShipError(ErrorType.Api, `${op} failed: Unknown error`);
  }

  // Factory methods. Uniform shape `(message, details?)` with two principled
  // exceptions: `notFound` composes its message from (resource, id?), and
  // `business` / `api` accept an optional status because they're the
  // multi-status fallbacks.

  static validation(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Validation, message, 400, details);
  }

  static notFound(resource: string, id?: string): ShipError {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`;
    return new ShipError(ErrorType.NotFound, message, 404);
  }

  static forbidden(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Forbidden, message, 403, details);
  }

  static rateLimit(message: string = 'Too many requests', details?: unknown): ShipError {
    return new ShipError(ErrorType.RateLimit, message, 429, details);
  }

  /**
   * Construct an Authentication (401) error.
   *
   * **Telemetry pattern — `details: { internal: '<tag>' }`.** When the
   * server creates an auth error with an `internal` key in `details`
   * (e.g. `{ internal: 'session_invalid' }`), `toResponse()` strips the
   * entire `details` object before serialization. This keeps the wire
   * response a clean "Authentication failed" while preserving granular
   * server-side telemetry (which strategy/check failed) for logs and tests.
   *
   * Use this pattern in API auth code; do not put client-visible info under
   * `internal`. Other `details` keys round-trip normally.
   */
  static authentication(message: string = 'Authentication required', details?: unknown): ShipError {
    return new ShipError(ErrorType.Authentication, message, 401, details);
  }

  static business(message: string, status: number = 400, details?: unknown): ShipError {
    return new ShipError(ErrorType.Business, message, status, details);
  }

  static network(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Network, message, undefined, details);
  }

  /**
   * A deadline expired before the exchange completed.
   *
   * Statusless like its four client-only siblings: no exchange completed, so
   * there is no HTTP status to report. `isNetworkError()` is true — see
   * `ErrorType.Timeout` for why the category is shared and the type is not.
   */
  static timeout(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Timeout, message, undefined, details);
  }

  static cancelled(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Cancelled, message, undefined, details);
  }

  static file(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.File, message, undefined, details);
  }

  static config(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Config, message, undefined, details);
  }

  static api(message: string, status: number = 500, details?: unknown): ShipError {
    return new ShipError(ErrorType.Api, message, status, details);
  }

  /**
   * The platform is closed for maintenance (503).
   *
   * `message` is REQUIRED and has no default here. The API is the only
   * producer of that sentence, and a default in this file would be a second
   * owner of one fact — see CLAUDE.md, "The Constellation Law" (stopping
   * rule). It is also the one factory whose status is fixed rather than
   * defaulted: a maintenance refusal is 503 or it is not this error.
   */
  static maintenance(message: string, details?: unknown): ShipError {
    return new ShipError(ErrorType.Maintenance, message, 503, details);
  }

  // Semantic-category guards. For specific-type checks, use
  // `error.type === ErrorType.X` directly or the generic `isType(t)`.

  /**
   * The caller is at fault — by HTTP's own definition of a 4xx, or by a type
   * that is client-attributable without ever having a status (`Config`,
   * `File`, raised locally by the SDK).
   *
   * Both arms are load-bearing, because type and status are independent
   * axes. `fromHttpResponse` trusts `body.error` only when it names a
   * server-producible type; a non-OK response without one is status-derived,
   * so a CDN 404 or any intermediary error arrives as `Api` — a server-fault
   * *type* carrying a client *status*. Judging by type alone would report it
   * as a platform failure and bury the server's own message.
   */
  isClientError(): boolean {
    if (ERROR_CATEGORIES.client.has(this.type)) return true;
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }

  isNetworkError(): boolean {
    return ERROR_CATEGORIES.network.has(this.type);
  }

  isAuthError(): boolean {
    return ERROR_CATEGORIES.auth.has(this.type);
  }

  isType(errorType: ErrorType): boolean {
    return this.type === errorType;
  }
}

/**
 * Type guard to check if an unknown value is a ShipError.
 *
 * Uses structural checking instead of instanceof to handle module duplication
 * in bundled applications where multiple copies of the ShipError class may exist.
 *
 * @example
 * if (isShipError(error)) {
 *   console.log(error.status, error.message);
 * }
 */
export function isShipError(error: unknown): error is ShipError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ShipError' &&
    'status' in error
  );
}

// =============================================================================
// PLATFORM LIMITS
// =============================================================================

/**
 * What the platform will refuse, returned by the `/limits` endpoint.
 *
 * The SDK fetches this once on first API call to drive client-side validation
 * that mirrors what the API would enforce server-side. The caps vary by
 * account plan; the blocklist does not.
 *
 * These are the *platform's* posted rules for the current account — server
 * truth delivered at runtime, never hard-coded on the client. That is the
 * whole point of the shape: a rule the server owns and may change reaches the
 * client as data, so a pinned client cannot enforce a policy the platform has
 * moved on from (`npm/types/CLAUDE.md`, "Validation: format vs policy").
 *
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface PlatformLimits {
  /** Maximum size in bytes for a single file. */
  maxFileSize: number;
  /** Maximum number of files in a single deployment. */
  maxFilesCount: number;
  /** Maximum total size in bytes across all files in a deployment. */
  maxTotalSize: number;
  /**
   * Lowercase extensions, without the dot, that the platform refuses to host
   * (`exe`, `dmg`, …). Owned and evolved by the API — see
   * `cloudflare/api/src/lib/blocklist.ts`.
   *
   * **Optional, and the absence is load-bearing.** An API deployed before this
   * field existed sends nothing, so a client MUST read absence as "no
   * client-side check" rather than as an empty policy. The hint fails open,
   * the boundary fails closed: the server refuses the file either way, and a
   * client that guessed would only ever be wrong in the direction that refuses
   * a file the platform accepts.
   *
   * The optionality follows the additive-evolution law and retires with its
   * reason: once every environment serves the field, it hardens to required at
   * the entity's next natural break, and the clients' fail-open spellings
   * retire with it (tracked in root `backlog.md`).
   */
  readonly blockedExtensions?: readonly string[];
}

// =============================================================================
// EXTENSION MATCHING
// =============================================================================

/**
 * The rule for reading a file's extension: lowercase, after the last dot of
 * the last path segment. `null` when there is no extension to read.
 *
 * A leading dot names the file rather than its type, so `.gitignore` and
 * `.htaccess` have no extension — but `.env.exe` has `exe`.
 *
 * Segment-aware on purpose: the callers pass deploy PATHS, not basenames, and
 * a naive `lastIndexOf('.')` over `dir.v1/README` reads the extension
 * `v1/README` — safe only by accident, since no entry in a real blocklist
 * contains a slash, which is the kind of correctness nobody should have to
 * re-derive.
 *
 * **Private, and the reason is the asymmetry rather than any hazard.** Nothing
 * outside this file reads it: `isBlockedExtension` is the only question anyone
 * asks, and the API's refusal names the FILE, not its extension. Exporting a
 * pure function is harmless, which is exactly the argument that talks a
 * published package into surface it has not earned — and the costs do not
 * match, since adding an export later is free under the additive law while
 * removing one is a major. So it stays private until a caller exists. Its
 * behaviour is fenced through `isBlockedExtension`, which is where it is
 * observable.
 *
 * (`WEB_FILE_EXTENSIONS` above is private for a different reason — publishing
 * it would invite a wrong question. Both are private; only one is a hazard.)
 *
 * @example
 * fileExtension('virus.exe')          // 'exe'
 * fileExtension('assets/style.CSS')   // 'css'
 * fileExtension('dir.v1/README')      // null
 * fileExtension('.gitignore')         // null
 * fileExtension('file.')              // null
 */
function fileExtension(filename: string): string | null {
  const basename = filename.replace(/\\/g, '/').split('/').pop() ?? '';
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === basename.length - 1) return null;
  return basename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Whether a file is one the platform refuses to host.
 *
 * **The list is not this package's, and that separation is the point.** What
 * counts as a blocked extension is hosting POLICY — it evolves, it is enforced
 * at one security boundary, and `virus.exe` is a perfectly well-formed
 * filename that breaks nothing about the upload→serve round-trip. So the API
 * owns the list (`cloudflare/api/src/lib/blocklist.ts`) and delivers it as
 * `PlatformLimits.blockedExtensions`; a client passes what it was given.
 *
 * What lives here is the MATCHING RULE, and it earns its place by the
 * constellation law's own test. The list's drift is loud in both directions —
 * a stale client uploads a file the API refuses by name, on the first try.
 * A second *matcher* drifts SILENTLY in the one direction that matters: a
 * client stricter than the server refuses a legal file without the server ever
 * being asked, and no error names it. Two holders, silent drift, one owner.
 *
 * The `blocked` collection is required rather than defaulted: this predicate
 * guards a security boundary in the API, and a defaulted-empty argument there
 * would block nothing while reading as though it did. Callers holding a
 * possibly-absent wire field spell the fail-open themselves.
 *
 * @example
 * isBlockedExtension('virus.exe', ['exe'])   // true
 * isBlockedExtension('virus.EXE', ['exe'])   // true — case-insensitive
 * isBlockedExtension('style.css', ['exe'])   // false
 * isBlockedExtension('README', ['exe'])      // false — no extension
 */
export function isBlockedExtension(
  filename: string,
  blocked: ReadonlySet<string> | readonly string[],
): boolean {
  const ext = fileExtension(filename);
  if (ext === null) return false;
  return Array.isArray(blocked) ? blocked.includes(ext) : (blocked as ReadonlySet<string>).has(ext);
}

// =============================================================================
// PICKER ACCEPT HINT
// =============================================================================

/**
 * The extensions a browser file picker offers by default, grouped by role.
 *
 * Private on purpose: the only published form is `WEB_FILE_ACCEPT`, the
 * attribute value itself. A published set would invite a call site to ask it
 * whether a file is allowed — which is the one thing this list must never
 * answer. See `WEB_FILE_ACCEPT`.
 *
 * Extensionless files (`LICENSE`, most `.well-known` entries) are inexpressible
 * in `accept`, and reach a deployment by folder pick, ZIP, or drag-and-drop.
 */
const WEB_FILE_EXTENSIONS = [
  // Markup & documents
  'html',
  'htm',
  'xhtml',
  'xml',
  'txt',
  'md',
  'markdown',
  'pdf',
  'csv',
  // Data & config
  'json',
  'jsonc',
  'webmanifest',
  'map',
  'toml',
  'yaml',
  'yml',
  'rss',
  'atom',
  // Styles
  'css',
  'scss',
  'sass',
  'less',
  // Scripts & modules
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'wasm',
  'vue',
  'svelte',
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'ico',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'heif',
  // Fonts
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  // Audio
  'mp3',
  'wav',
  'ogg',
  'oga',
  'opus',
  'm4a',
  'aac',
  'flac',
  'weba',
  // Video
  'mp4',
  'webm',
  'ogv',
  'mov',
  'm4v',
  'avi',
  // 3D models
  'glb',
  'gltf',
  'usdz',
  // Text tracks
  'vtt',
  'srt',
  // Archive — a whole site in one file
  'zip',
] as const;

/**
 * The `accept` attribute value for a browser file picker offering web files.
 *
 * **This is a hint, never a rule.** The API's blocklist is the platform's gate
 * and the only thing that decides what may be hosted; this constant decides
 * what a *file dialog* shows first. The two are not two halves of one policy,
 * and this one must never be consulted to accept or reject a file.
 *
 * The distinction is structural, not stylistic. `accept` can express only an
 * allowlist, while the platform's rule is a blocklist — so this list is
 * necessarily *narrower* than what the platform hosts, and reading it as
 * authority would reject files the platform serves happily. It is also not
 * enforcement in the browser's own terms: every file dialog offers an
 * all-files escape, and **drag-and-drop ignores `accept` entirely**. The
 * dropzone and the picker must reach the same verdict on the same files, and
 * they do — because the verdict is `validateFiles`, downstream of both.
 *
 * The invariant that matters — the picker must never offer a file the platform
 * will refuse — is fenced where the authority lives, in the API's own suite
 * (`cloudflare/api/tests/lib/blocklist.test.ts`), which reads this published
 * string and holds it against the list it owns. It sat here until the
 * blocklist became the API's, and moving it was the price of that: a fence
 * belongs with whichever side can change and break it.
 */
export const WEB_FILE_ACCEPT: string = WEB_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

// =============================================================================
// FILENAME CHARACTER VALIDATION
// =============================================================================

/**
 * Characters that are unsafe in filenames for static hosting.
 *
 * Blocks only characters that genuinely break the upload→serve round-trip:
 * - # ? %        URL round-trip breakers (fragment, query, encoding ambiguity)
 * - \            Path separator confusion (upload splits on backslash)
 * - < > "        XSS vectors with zero legitimate use in filenames
 * - \x00-\x1f \x7f  Control characters (header injection, display corruption)
 *
 * Everything else is allowed — browser percent-encodes, Worker decodes, R2 matches.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: blocking control characters is this regex's purpose
export const UNSAFE_FILENAME_CHARS = /[\x00-\x1f\x7f#?%\\<>"]/;

/**
 * Check if a filename contains unsafe characters.
 *
 * @example
 * hasUnsafeChars('saved_resource(1).html')  // false — parentheses are safe
 * hasUnsafeChars('page[slug].js')           // false — brackets are safe
 * hasUnsafeChars('file#anchor.html')        // true  — # breaks URL resolution
 * hasUnsafeChars('file<tag>.html')          // true  — < is an XSS vector
 */
export function hasUnsafeChars(filename: string): boolean {
  return UNSAFE_FILENAME_CHARS.test(filename);
}

// =============================================================================
// UNBUILT PROJECT MARKERS
// =============================================================================

/**
 * Path segment names that indicate an unbuilt project was uploaded instead of build output.
 * Used for early detection in CLI, browser, and server validation.
 */
export const UNBUILT_PROJECT_MARKERS: ReadonlySet<string> = new Set([
  'node_modules',
  'package.json',
]);

/**
 * Check if a file path contains an unbuilt project marker.
 *
 * @example
 * hasUnbuiltMarker('node_modules/react/index.js')  // true
 * hasUnbuiltMarker('package.json')                  // true
 * hasUnbuiltMarker('dist/index.html')               // false
 */
export function hasUnbuiltMarker(filePath: string): boolean {
  const segments = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments.some((s) => UNBUILT_PROJECT_MARKERS.has(s));
}

// =============================================================================
// COMMON RESPONSE PATTERNS
// =============================================================================

/**
 * `GET /ping` — a report of the server clock.
 *
 * Liveness is the STATUS CODE's answer, not a field's: a 200 means reachable,
 * and any other outcome throws before a body is read. So the body carries the
 * one thing a status code cannot — the server's own clock, which is what lets a
 * client detect skew against a token expiry. It read `{ success: true,
 * timestamp? }` until 2026-07-29, where `success` was a literal constant in the
 * route (zero bits, and the platform's own named anti-pattern) while the field
 * that IS the payload was optional. See {@link DeploymentDeleteResponse} for
 * the law, and `tests/response-shapes.test.ts` for the fence that holds it.
 */
export interface PingResponse {
  /** Server time in unix seconds — the one wire unit for timestamps. */
  readonly timestamp: number;
}

// =============================================================================
// CREDENTIAL SHAPES
// =============================================================================
// The one address for credential vocabulary: where human identity lives
// (AUTH_BASE_PATH), how a request is authorized (AuthMethod), the shapes
// that distinguish populations on the wire (API_KEY, DEPLOY_TOKEN,
// OAUTH_TOKEN, CALLER), the two halves of the one Bearer slot
// (readBearerValue reads it, classifyToken/TokenKind dispatch on what came
// out), and the delegated-access scopes (OAuthScope).
//
// THE SHAPE LAW, in three clauses, over the `Authorization: Bearer` slot's
// three populations below. The deployment claim code is the API's own
// (`AUTH.CLAIM`, server-side: the API mints it and the API validates it, so
// it has one holder and stays there) and shares only clause 1 — it is the
// platform's one deliberately BARE secret, because it never enters the
// Bearer slot: minted into one URL, consumed by one endpoint's one field,
// its context names it and a prefix would restate its route.
// `tests/validation-constants.test.ts` holds the clauses over this file's
// populations; the API's suite holds its own.
//
//  1. ONE ENTROPY STANDARD. Every minted secret is `HEX_LENGTH` hex characters
//     — one width for the whole platform, so "how long is a credential" has a
//     single answer rather than one per population. Generators read the width
//     from the population's own constant, so a minted value and an accepted
//     value cannot differ.
//
//  2. EVERY BEARER POPULATION IS NAMED BY ITS PREFIX. A credential says what
//     it is before anything parses it — which is what lets `classifyToken`
//     below dispatch three populations sharing one `Authorization: Bearer`
//     slot, and what lets a value found in a log, a support ticket or a
//     pasted URL be recognised and revoked on sight. The OAuth access token
//     was this clause's one standing exception until 2026-08-14 — the
//     authorization server it was born on had no mint hook to give it a
//     prefix, and its successor does.
//
//  3. NO PREFIX IS A PREFIX OF ANOTHER. This is what makes the dispatch
//     order-independent, and it is the reason the populations are named on
//     different axes (`ship-` for the product, `deploy-` for the capability)
//     rather than sharing a stem. A `ship-` / `ship-deploy-` pair
//     reads tidier and is a trap: every deploy token would also match the
//     API-key branch, leaving correctness resting on the order of two `if`s.

/**
 * Where human identity is mounted on the API host. The API mounts Better
 * Auth at this path (sign-in, sign-out, session reads, admin impersonation)
 * and the web console's auth client posts to it — shared here so the two
 * halves of the auth pair agree by construction, the same way both sides
 * already share the credential prefixes below.
 */
export const AUTH_BASE_PATH = '/auth';

/**
 * The query marker a completed sign-in LANDS with.
 *
 * The API's magic-link verify leg stamps `?signing-in=1` onto its success
 * redirect, and the console boots into its wait screen on seeing it — two
 * repos, one spelling, which is why it lives here. Success is marked and the
 * error leg deliberately is NOT: the console gives the marker precedence, so
 * a marked error would render a wait that resolves to bare doors with the
 * error's sentence lost. If the spellings ever diverged the failure would be
 * invisible to every suite — email landings would flash the doors for one
 * round trip instead of waiting — which is exactly the silent-drift class
 * this constitution exists to delete.
 */
export const SIGN_IN_RETURN_PARAM = 'signing-in';

/**
 * How a request (or recorded activity) was authorized.
 *
 * Client populations: `SESSION` (first-party cookie), `API_KEY` (`ship-`
 * key), `TOKEN` (`deploy-` deploy token), `AGENT` (anonymous public deploy —
 * no credential; the platform grants the public-account identity per
 * request), `OAUTH` (delegated access token). The one server population:
 * `SYSTEM` (scheduled/background jobs). Webhook receipt is deliberately not
 * a population: a signed delivery is verified, never authorized — it acts
 * as no one and audits as no one.
 */
export const AuthMethod = {
  SESSION: 'session',
  API_KEY: 'apiKey',
  TOKEN: 'token',
  AGENT: 'agent',
  OAUTH: 'oauth',
  SYSTEM: 'system',
} as const;

export type AuthMethodType = (typeof AuthMethod)[keyof typeof AuthMethod];

/**
 * Shape constants for API keys (`ship-{32 hex chars}`).
 * Single source of truth used by validation utilities and auth middleware.
 */
export const API_KEY = {
  /** Prefix that identifies an API key. */
  PREFIX: 'ship-',
  /** Number of hex characters following the prefix. */
  HEX_LENGTH: 32,
  /** Total length of an API key including prefix (`PREFIX.length + HEX_LENGTH = 37`). */
  TOTAL_LENGTH: 37,
  /** Number of trailing characters used to display a redacted hint (e.g. last 4). */
  HINT_LENGTH: 4,
} as const;

/**
 * Shape constants for deploy tokens (`deploy-{32 hex chars}`).
 * Single source of truth used by validation utilities and auth middleware.
 *
 * Deliberately the same width as `API_KEY`: both are minted by one generator
 * and classified by prefix alone, so a length that differed between them
 * would be a second thing to know about a credential whose prefix already
 * says what it is.
 */
export const DEPLOY_TOKEN = {
  /** Prefix that identifies a deploy token. */
  PREFIX: 'deploy-',
  /** Number of hex characters following the prefix. */
  HEX_LENGTH: 32,
  /** Total length of a deploy token including prefix (`PREFIX.length + HEX_LENGTH = 39`). */
  TOTAL_LENGTH: 39,
} as const;

/**
 * Shape constants for OAuth access tokens (`oauth-{32 hex chars}`) — the
 * delegated population, minted by the platform's own authorization server
 * for a connected app acting on a user's behalf.
 *
 * Same width as the other two, and for the same reason: one entropy standard
 * across the platform, so "how long is a credential" has one answer.
 *
 * **This population is the access token alone.** Refresh tokens, authorization
 * codes and client secrets are deliberately NOT here and are deliberately not
 * prefixed by this constant: none of them ever enters the `Authorization:
 * Bearer` slot — a refresh token is posted as a form field to the token
 * endpoint, which knows what it is receiving — so `classifyToken` never sees
 * one and a prefix would name a population no dispatcher dispatches. The same
 * reasoning that keeps the deployment claim code bare.
 *
 * **The prefix must be applied at the MINT, never as a display wrapper.** The
 * authorization server hashes what it stores and the API hashes what it is
 * presented, so the prefix has to be inside the hashed string on both sides.
 * `@better-auth/oauth-provider` offers a `prefix.opaqueAccessToken` option
 * that prepends AFTER hashing and strips on its own read paths; using it would
 * store a hash of the UNPREFIXED token and silently break the platform's read
 * arm. The API therefore mints through `generateOpaqueAccessToken` — recorded
 * beside the config in `cloudflare/api/src/lib/auth/instance.ts`.
 */
export const OAUTH_TOKEN = {
  /** Prefix that identifies an OAuth access token. */
  PREFIX: 'oauth-',
  /** Number of hex characters following the prefix. */
  HEX_LENGTH: 32,
  /** Total length including prefix (`PREFIX.length + HEX_LENGTH = 38`). */
  TOTAL_LENGTH: 38,
} as const;

/**
 * Shape constants for caller identifiers (the `X-Caller` instance-identity
 * header — rate-limit bucketing for multi-tenant orchestrators). The API
 * normalizes case and silently ignores malformed values (the header is
 * unauthenticated); clients validate at the boundary via `validateCaller`,
 * so a value the server would drop fails fast instead.
 */
export const CALLER = {
  /** HTTP header name. */
  HEADER: 'X-Caller',
  /** Maximum identifier length. */
  MAX_LENGTH: 128,
  /** Allowed characters: alphanumeric, dot, underscore, hyphen. */
  PATTERN: /^[a-zA-Z0-9._-]+$/,
} as const;

/**
 * Token populations distinguishable by shape. The platform carries every
 * client token in one wire slot (`Authorization: Bearer <value>`) and
 * classifies by value, never by a side channel — this is the classifier.
 *
 * `API_KEY`, `DEPLOY_TOKEN` and `OAUTH` *are* `AuthMethod.API_KEY`,
 * `AuthMethod.TOKEN` and `AuthMethod.OAUTH` — the equality is structural, so
 * a classification flows straight into an auth method and the trio can never
 * drift.
 *
 * `OPAQUE` is any other value, and since 2026-08-14 it names NO population:
 * every credential this platform mints for the Bearer slot carries a prefix,
 * so an opaque bearer is a bearer we did not mint. It stays a member rather
 * than becoming a `null` return because a dispatcher with a total codomain
 * reads better than one with an absence in it — and because it is where a
 * future population would land before anyone gave it a shape, which is
 * exactly what the OAuth token itself did until its prefix existed.
 */
export const TokenKind = {
  API_KEY: AuthMethod.API_KEY,
  DEPLOY_TOKEN: AuthMethod.TOKEN,
  OAUTH: AuthMethod.OAUTH,
  OPAQUE: 'opaque',
} as const;

export type TokenKindType = (typeof TokenKind)[keyof typeof TokenKind];

/**
 * Classify a client token by shape. The single dispatch used by both sides
 * of the wire: API auth middleware (which population is this credential?)
 * and SDK validation (which format rules apply before sending?). Sharing it
 * is what guarantees client and server can never disagree on dispatch.
 */
export function classifyToken(token: string): TokenKindType {
  if (token.startsWith(API_KEY.PREFIX)) return TokenKind.API_KEY;
  if (token.startsWith(DEPLOY_TOKEN.PREFIX)) return TokenKind.DEPLOY_TOKEN;
  if (token.startsWith(OAUTH_TOKEN.PREFIX)) return TokenKind.OAUTH;
  return TokenKind.OPAQUE;
}

/** The auth-scheme, lowercased — the form the comparison is made in. */
const BEARER_SCHEME = 'bearer ';

/**
 * Read the credential out of an `Authorization` header value — the step
 * BEFORE `classifyToken`, and the other half of the one wire slot this
 * section owns.
 *
 * Returns the credential's own bytes, or `null` when the header carries a
 * foreign scheme or nothing after the scheme.
 *
 * **The scheme is folded; the credential is not.** RFC 7235 §2.1 makes the
 * auth-scheme case-insensitive, so `bearer`, `Bearer` and `BEARER` are the
 * same header. The value after it is opaque and is compared literally
 * everywhere it is used — `ship-`/`deploy-`/`oauth-` are lowercase hex, and
 * folding them would make a credential match values it is not.
 *
 * **This platform has paid for the rule twice, which is why it has an owner
 * rather than a convention.** A spec-conformant `bearer ship-…` client was
 * refused for as long as the API's scheme test was spelled case-sensitively;
 * and `@better-auth/oauth-provider` carries the same defect in four places
 * today (`startsWith("Bearer ")`), which is precisely why the platform folds
 * the scheme itself and hands the provider a bare token.
 *
 * **ABSENCE is deliberately not this function's business.** A missing header
 * and an unreadable one are different facts, and the callers that care split
 * on them: the API worker's middleware distinguishes `absent` (the only
 * anonymous path) from `unreadable` (a presented credential that is refused),
 * and collapsing the two here would take that distinction away from the layer
 * that needs it. Callers check for the header themselves and pass its value.
 *
 * **Why this lives in the constitution rather than in a worker's `shared/`.**
 * It is the same wire boundary `classifyToken` already owns — one reads the
 * slot, the other dispatches on what came out — and a rule with two holders
 * whose drift is silent earns exactly one owner regardless of what the
 * convoy costs. The estate's recorded refusal to own a `Bearer` CONSTANT
 * stands and is a different thing: that is RFC vocabulary, the same reason
 * this package owns no `"POST"`. A parser is not a spelling.
 */
export function readBearerValue(header: string): string | null {
  if (header.slice(0, BEARER_SCHEME.length).toLowerCase() !== BEARER_SCHEME) return null;
  return header.slice(BEARER_SCHEME.length) || null;
}

/**
 * OAuth scope vocabulary for delegated third-party access tokens.
 * Single source of truth used by the authorization server (advertised in
 * `scopes_supported`), the API's scope-enforcement middleware, and consent UI
 * copy. The standard `offline_access` scope (refresh tokens) is not platform
 * vocabulary and is deliberately absent — the middleware never checks it.
 *
 * Deliberately absent by design: any `tokens:*` scope, `account:write`, or
 * admin scope — a delegated app must never mint credentials, delete the
 * account, or act as admin.
 */
export const OAuthScope = {
  ACCOUNT_READ: 'account:read',
  DEPLOYMENTS_READ: 'deployments:read',
  DEPLOYMENTS_WRITE: 'deployments:write',
  DOMAINS_READ: 'domains:read',
  DOMAINS_WRITE: 'domains:write',
} as const;

export type OAuthScopeType = (typeof OAuthScope)[keyof typeof OAuthScope];

// =============================================================================
// DEPLOYMENT CONFIGURATION CONSTANTS
// =============================================================================

export const DEPLOYMENT_CONFIG_FILENAME = 'ship.json';

/** Default ship.json config for SPA routing. Single source of truth — used by both API and SDK. */
export const SPA_DEFAULT_CONFIG = {
  rewrites: [{ source: '/(.*)', destination: '/index.html' }],
} as const;

/**
 * The `/spa-check` pre-flight's client-side envelope: which file is the
 * check's subject, and how large it may be before a client skips the call.
 *
 * One fact with three holders until this export — the API's config declared
 * the cap, the SDK's `checkSPA` hardcoded `100 * 1024`, and prose restated
 * "100KB". `INDEX_FILE` is the selection rule (the file whose content rides
 * `SPACheckRequest.index`), restated by every client that builds the request.
 *
 * Neither member is a validation boundary: a client over the cap simply
 * skips the pre-flight, because the server answers an oversized index
 * `isSPA: false` anyway. A consumer that cannot import this (n8n) needs no
 * size copy at all — outcome parity is the server's, not the client's.
 */
export const SPA_CHECK_CONSTRAINTS = {
  /** The file whose content is the check's subject. */
  INDEX_FILE: 'index.html',
  /** Skip the pre-flight above this size — the server would answer false. */
  MAX_INDEX_BYTES: 100 * 1024,
} as const;

/**
 * Assert that a ship.json file is *syntactically* loadable. Syntax only —
 * never schema.
 *
 * ship.json is validated and compiled on the server, deliberately: the schema
 * and the compiler evolve, and a client that judged them would reject configs
 * a newer platform accepts. That reasoning bounds what a client may check to
 * the properties which are true of *every* past and future schema:
 *
 *   1. it parses as JSON — JSON syntax is frozen (RFC 8259), so text that
 *      does not parse can never be a valid config;
 *   2. its top level is an object — ship.json is `{ ... }` in every version.
 *
 * Both are monotonic: neither can ever reject something the server would
 * accept. Everything beyond them (field names, types, rule semantics, which
 * keys are permitted) stays server-side, where it can change.
 *
 * The payoff is the common case. Hand-edited JSON fails on a trailing comma,
 * a `//` comment, single quotes, unquoted keys, or smart quotes pasted from
 * documentation — mistakes that otherwise cost a full upload round-trip to
 * discover. A UTF-8 BOM (Windows editors, PowerShell redirects) is stripped
 * before parsing rather than rejected, because the server accepts it too;
 * diverging there would reintroduce exactly the false rejection this
 * function exists to avoid.
 *
 * @throws {ShipError} `ErrorType.Config` — the same type the server's own
 * config rejection carries, so the error contract is identical wherever the
 * failure is detected.
 */
export function assertShipJsonSyntax(text: string): void {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutBom);
  } catch (error) {
    throw ShipError.config(`invalid JSON format in config: ${(error as Error).message}`, {
      filePath: DEPLOYMENT_CONFIG_FILENAME,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw ShipError.config(`${DEPLOYMENT_CONFIG_FILENAME} must contain a JSON object`, {
      filePath: DEPLOYMENT_CONFIG_FILENAME,
    });
  }
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Shared rule for prefixed credentials: `{PREFIX}{HEX_LENGTH hex chars}`.
 * The regex derives from the shape constants, so the validators can never
 * drift from the shapes `classifyToken` dispatches on.
 */
function validatePrefixedCredential(
  value: string,
  shape: { PREFIX: string; HEX_LENGTH: number; TOTAL_LENGTH: number },
  label: string,
): void {
  if (!value.startsWith(shape.PREFIX)) {
    throw ShipError.validation(`${label} must start with "${shape.PREFIX}"`);
  }

  if (value.length !== shape.TOTAL_LENGTH) {
    throw ShipError.validation(
      `${label} must be ${shape.TOTAL_LENGTH} characters total (${shape.PREFIX} + ${shape.HEX_LENGTH} hex chars)`,
    );
  }

  const hexPart = value.slice(shape.PREFIX.length);
  if (!new RegExp(`^[a-f0-9]{${shape.HEX_LENGTH}}$`, 'i').test(hexPart)) {
    throw ShipError.validation(
      `${label} must contain ${shape.HEX_LENGTH} hexadecimal characters after "${shape.PREFIX}" prefix`,
    );
  }
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): void {
  validatePrefixedCredential(apiKey, API_KEY, 'API key');
}

/**
 * Validate deploy token format
 */
export function validateDeployToken(deployToken: string): void {
  validatePrefixedCredential(deployToken, DEPLOY_TOKEN, 'Deploy token');
}

/**
 * Validate OAuth access token format
 */
export function validateOAuthToken(oauthToken: string): void {
  validatePrefixedCredential(oauthToken, OAUTH_TOKEN, 'OAuth access token');
}

/**
 * Validate a client token of any population. Classifies by shape and applies
 * the matching format rules: all three prefixed populations are validated
 * strictly; an OPAQUE token only needs to be non-empty.
 *
 * **The OPAQUE arm stays permissive on purpose**, even though the platform no
 * longer mints an unprefixed credential. It is the fallback for a population
 * that does not exist yet, and a client refusing a shape the server would
 * accept is the one failure mode this boundary must never have — the server
 * decides, and it refuses an unrecognised bearer anyway. Unprefixed OAuth
 * tokens from before 2026-08-14 land here and are refused server-side, which
 * is correct: they were revoked by the change, not grandfathered.
 */
export function validateToken(token: string): void {
  switch (classifyToken(token)) {
    case TokenKind.API_KEY:
      validateApiKey(token);
      return;
    case TokenKind.DEPLOY_TOKEN:
      validateDeployToken(token);
      return;
    case TokenKind.OAUTH:
      validateOAuthToken(token);
      return;
    case TokenKind.OPAQUE:
      if (!token) throw ShipError.validation('Token must be a non-empty string');
  }
}

/**
 * Validate a caller identifier against the `CALLER` shape. The server
 * silently ignores malformed values (the header is unauthenticated); clients
 * call this at configuration time so the drop never silently happens.
 */
export function validateCaller(caller: string): void {
  if (!caller || caller.length > CALLER.MAX_LENGTH || !CALLER.PATTERN.test(caller)) {
    throw ShipError.validation(
      `Caller must be 1-${CALLER.MAX_LENGTH} characters: letters, digits, dots, underscores, or hyphens`,
    );
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
    if (isShipError(error)) {
      throw error;
    }
    throw ShipError.validation('API URL must be a valid URL');
  }
}

/**
 * Check if a string matches the deployment identifier pattern (word-word-alphanumeric7).
 * Example: "happy-cat-abc1234.shipstatic.com"
 */
export function isDeployment(input: string): boolean {
  return /^[a-z]+-[a-z]+-[a-z0-9]{7}(\.[a-z0-9.-]+)?$/i.test(input);
}

/**
 * The envelope a requested lifetime must fit — one word, one grammar, wherever
 * the platform lets a caller choose how long something lives.
 *
 * Two resources wear it: `TokenCreateOptions.ttl` and
 * `DeploymentUploadOptions.ttl`. It lives here rather than on the server by
 * the format-vs-policy rule — a client can decide offline whether a duration
 * is well-formed, and the API rejects the same value the same way. What is
 * NOT here is any per-plan ceiling: no such policy exists, and one delivered
 * speculatively through `/limits` would be an owner for a decision nobody has
 * made.
 */
export const TTL_CONSTRAINTS = {
  /**
   * Shortest requestable lifetime, in seconds. One rather than zero: a
   * deployment that expires the instant it is created is not a shorter lease,
   * it is a deploy that was never live, and `0` is how an unset variable
   * arrives.
   */
  MIN_SECONDS: 1,
  /** Longest requestable lifetime, in seconds — one year. */
  MAX_SECONDS: 365 * 24 * 60 * 60,
} as const;

/**
 * Validate a requested lifetime in SECONDS and return it, or `undefined` when
 * none was asked for.
 *
 * **A duration, never an instant.** The caller says how long; the server owns
 * what time it is and stamps the expiry — so a client's clock, however wrong,
 * cannot shorten or extend a lease. That is the tokens precedent, and it is
 * why this rule measures a count of seconds rather than checking a timestamp
 * against `now`.
 *
 * Fractions are refused rather than rounded: a caller who wrote `1.5` meant
 * something the wire cannot carry, and silently choosing `1` or `2` for them
 * is a decision the platform has no standing to make.
 *
 * Single source of truth shared by the API (the tokens route and the deploy
 * schema), the SDK's request boundary, and the CLI's parser.
 */
export function validateTtl(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw ShipError.validation('TTL must be a number of seconds');
  }
  if (!Number.isInteger(value)) {
    throw ShipError.validation('TTL must be a whole number of seconds');
  }
  if (value < TTL_CONSTRAINTS.MIN_SECONDS || value > TTL_CONSTRAINTS.MAX_SECONDS) {
    throw ShipError.validation(
      `TTL must be between ${TTL_CONSTRAINTS.MIN_SECONDS} and ${TTL_CONSTRAINTS.MAX_SECONDS} seconds`,
    );
  }
  return value;
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
/**
 * Which of the classifier's tiers reached the verdict, and why. Named rather
 * than inline so the API's own `checkSPA` can return `SPACheckResponse`
 * instead of restating its shape.
 */
export interface SPACheckDebug {
  /** Which tier made the detection */
  tier: 'exclusions' | 'inclusions' | 'scoring' | 'ai' | 'fallback';
  /** The reason for the detection result */
  reason: string;
}

/**
 * A report: it answers a question and carries only the answer (`CLAUDE.md`,
 * "A report answers a question").
 */
export interface SPACheckResponse {
  /** Whether the project is detected as a Single Page Application */
  isSPA: boolean;
  /** Debugging information about detection */
  debug: SPACheckDebug;
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
// PLATFORM CONSTANTS
// =============================================================================

/** Default API URL if not otherwise configured. */
export const DEFAULT_API = 'https://api.shipstatic.com';

/**
 * The Node SDK's ambient configuration pair — the ONLY environment variables
 * the SDK reads, and therefore the COMPLETE list an embedding host must
 * scrub (per `npm/ship`'s strict-isolation contract, scrubbing is the host's
 * job, not the SDK's). A host that derives its scrub from this object's
 * values — as the VS Code extension's child-process env block does — picks
 * up a grown contract at the next pin bump instead of by remembered prose.
 *
 * Browser builds read no environment at all, and the CLI-only variables
 * (`SHIP_PASSWORD`, `SHIP_VIA`) are deliberately NOT here: they are the
 * CLI's operational levers, not the SDK's ambient contract — see
 * `npm/ship/CLAUDE.md`, "CLI-only env vars".
 */
export const SHIP_ENV = {
  /** The one credential slot — any platform token. */
  TOKEN: 'SHIP_TOKEN',
  /** The API endpoint override. */
  API_URL: 'SHIP_API_URL',
} as const;

/**
 * Where a human creates an API key — the console deep link quoted by every
 * surface that teaches authentication (the CLI's config wizard, the VS Code
 * and n8n listings, the n8n rate-limit hint and credential copy). Written
 * out in five files across three repos until this export.
 *
 * Production-branded by design: published artifacts name the product, never
 * an environment (root `CLAUDE.md`, "Environment-Aware URLs").
 */
export const MY_API_KEY_URL = 'https://my.shipstatic.com/api-key';

/**
 * How long an anonymous deployment lives before it expires.
 *
 * The lifetime of the public tier, and one fact with several readers. The API
 * stamps a deployment's `expires` from it and gives a claim code exactly the
 * same window — a live site with a dead claim link is a coherence bug, so the
 * two are one constant rather than two that agree. Both MCP transports quote
 * the duration in prose an agent reads, and derive it from here rather than
 * writing it out, which they did in eight places until this export existed.
 *
 * Seconds, spelled in the name: this platform has both second- and
 * millisecond-valued durations, and the pair is only safe when each says which
 * it is.
 */
export const PUBLIC_DEPLOYMENT_TTL_SECONDS = 3 * 24 * 60 * 60;

// =============================================================================
// RESOURCE INTERFACE CONTRACTS
// =============================================================================

/**
 * Universal deploy input — the union of every shape the SDK accepts.
 *
 * - **Browser**: `File[]` (typically from `<input type="file">` or drag-and-drop)
 * - **Node**: `string | string[]` (file or directory path(s) on disk; directories are walked)
 *
 * Each platform's SDK narrows its `deploy()` signature to the relevant shape
 * and rejects anything else at runtime. Use the structural types directly
 * (`File[]`, `string | string[]`) when writing platform-specific code.
 */
export type DeployInput = File[] | string | string[];

/**
 * Options for deployment creation at the API contract level.
 * SDK implementations may extend with additional options (timeout, signal, callbacks, etc.).
 */
export interface DeploymentUploadOptions {
  /** Optional labels for categorization and filtering */
  labels?: string[];
  /**
   * Which client is making this deploy. Closed, because the server silently
   * ignores anything outside the set — so an unchecked string turned a typo
   * into missing analytics rather than an error. See {@link DeploymentVia}.
   */
  via?: DeploymentViaType;
  /**
   * Seconds until this deployment expires; omit for one that never does.
   *
   * The platform reclaims it when the time is up — an ephemeral deployment,
   * chosen by the deployer rather than by the identity. The same word and the
   * same grammar as {@link TokenCreateOptions.ttl}, bounded by
   * {@link TTL_CONSTRAINTS}.
   *
   * **Requires a credential.** An anonymous deploy has no deployer, and the
   * platform owns anonymous lifetime as policy
   * ({@link PUBLIC_DEPLOYMENT_TTL_SECONDS}) — so a ttl on one is refused
   * rather than honoured or ignored.
   *
   * **A deployment carrying one cannot be linked to a domain.** A domain is a
   * commitment and a deadline is its opposite; the API refuses the link, which
   * is what keeps the reaper from tearing a live domain's target away.
   *
   * Immutable, like every other field of a deployment: to keep something
   * longer, redeploy.
   */
  ttl?: number;
  /**
   * Optional password that protects this deployment.
   *
   * Length: {@link PASSWORD_CONSTRAINTS.MIN_LENGTH} to
   * {@link PASSWORD_CONSTRAINTS.MAX_LENGTH} characters. Leading and trailing
   * whitespace is trimmed before validation; internal whitespace is
   * significant. Visitors are prompted to enter the password before they can
   * view the deployment — including on any custom domains pointing at it.
   * To remove protection, redeploy without a password.
   */
  password?: string;
  /** @internal Trigger server-side build. Only available via /upload endpoint. */
  build?: boolean;
  /** @internal Trigger server-side prerender. Only available via /upload endpoint. */
  prerender?: boolean;
  /** @internal Trigger server-side SPA detection. Only available via /upload endpoint. */
  spa?: boolean;
  /** @internal reCAPTCHA proof for the anonymous human deploy channel. Only available via /upload endpoint. */
  captcha?: string;
  /**
   * Makes this deploy replayable instead of repeatable.
   *
   * A deploy is not naturally idempotent: a client-side timeout on a slow
   * one leaves the caller unable to tell "it never landed" from "it landed
   * and the response was lost", and retrying produces a second deployment.
   * Send the same key on the retry and the platform replays the original
   * 201 verbatim rather than creating anything
   * ({@link IDEMPOTENCY_KEY_CONSTRAINTS.WINDOW_SECONDS}).
   *
   * **Agents are the audience.** A human notices a duplicate; an automated
   * retry does not. Pick a key that identifies the ATTEMPT — a run id, a
   * commit sha, a uuid minted before the first try — never one minted fresh
   * on each retry, which would defeat the point.
   *
   * The replay is per-caller, and it stores successes only: a failed deploy
   * retries fresh under the same key.
   */
  idempotencyKey?: string;
}

/**
 * What a caller may change on an existing deployment.
 *
 * Labels and nothing else: a deployment's content is immutable by design, so
 * this is the whole mutable surface rather than a subset someone chose.
 */
export interface DeploymentSetOptions {
  labels: string[];
}

/**
 * What `domains.set()` may create or change. Every field is optional because
 * the call is a natural-key upsert: omitting `deployment` reserves the
 * domain, naming one links or re-points it, and labels travel either way.
 *
 * `deployment` is deliberately not nullable — unlinking is refused (400).
 * See `npm/ship/CLAUDE.md`, "Domain Write Semantics".
 */
export interface DomainSetOptions {
  deployment?: string;
  labels?: string[];
}

/** What a caller may set when minting a deploy token. */
export interface TokenCreateOptions {
  /** Seconds until expiry; omit for a token that never expires. */
  ttl?: number;
  labels?: string[];
}

/**
 * Deployment resource interface - the contract all implementations must follow.
 *
 * The interface defines the minimal wire contract; SDK implementations may
 * extend the upload options with runtime concerns (timeout, signal, progress
 * callbacks) by parameterizing: `DeploymentResource<MyUploadOptions>`. The
 * default keeps plain `DeploymentResource` valid for wire-only consumers.
 */
export interface DeploymentResource<
  UploadOptions extends DeploymentUploadOptions = DeploymentUploadOptions,
> {
  upload: (input: DeployInput, options?: UploadOptions) => Promise<DeploymentCreateResponse>;
  list: (options?: ListOptions) => Promise<DeploymentListResponse>;
  get: (id: string) => Promise<Deployment>;
  set: (id: string, options: DeploymentSetOptions) => Promise<Deployment>;
  delete: (id: string) => Promise<DeploymentDeleteResponse>;
}

/**
 * Domain resource interface - the contract all implementations must follow
 */
export interface DomainResource {
  set: (name: string, options?: DomainSetOptions) => Promise<DomainSetResult>;
  list: (options?: ListOptions) => Promise<DomainListResponse>;
  get: (name: string) => Promise<Domain>;
  delete: (name: string) => Promise<DomainDeleteResponse>;
  verify: (name: string) => Promise<DomainVerifyResponse>;
  validate: (name: string) => Promise<DomainValidateResponse>;
  dns: (name: string) => Promise<DomainDnsResponse>;
  records: (name: string) => Promise<DomainRecordsResponse>;
  share: (name: string) => Promise<DomainShareResponse>;
}

/**
 * Account resource interface - the contract all implementations must follow
 */
export interface AccountResource {
  get: () => Promise<AccountGetResponse>;
}

/**
 * Token resource interface - the contract all implementations must follow
 */
export interface TokenResource {
  create: (options?: TokenCreateOptions) => Promise<TokenCreateResponse>;
  list: (options?: ListOptions) => Promise<TokenListResponse>;
  get: (token: string) => Promise<Token>;
  delete: (token: string) => Promise<TokenDeleteResponse>;
}

// =============================================================================
// BILLING TYPES
// =============================================================================

/**
 * How often a subscription renews. Every billed plan is sold at both
 * intervals, so a buyer chooses a plan and an interval, and nothing else.
 *
 * It never branches business logic — monthly and yearly confer identical
 * caps. It exists to be displayed and to pick a Price at checkout.
 */
export type BillingInterval = 'month' | 'year';

/**
 * One row of the plan menu, answered by `GET /plans`.
 *
 * **Vocabulary here, values from the server.** The shape is a wire contract
 * every surface agrees on; the numbers in it are policy the API owns and may
 * change on a deploy (`CLAUDE.md`, "Validation: format vs policy"). That is
 * why the public site and the console both READ this endpoint instead of
 * carrying their own copy of the price list — a hand-copied plan table was
 * the platform's longest-lived restatement.
 */
export interface Plan {
  /** Which plan this row describes. */
  readonly plan: AccountPlanType;
  /** Display name, as the marketing site and the console should print it. */
  readonly name: string;
  /**
   * What it costs, per interval — integer CENTS in USD, as the API's plan
   * table states them and as Stripe's Prices are provisioned from it. The wire
   * never carries a formatted price: formatting is the reader's job.
   *
   * **A free plan costs `{ month: 0, year: 0 }`, not a sentinel.** Free IS
   * zero, so it is a number like any other and every reader formats it with
   * the same call; a `'free'` member bought one thing — a branch in each
   * consumer that mapped it straight back to `$0`.
   *
   * `'contact'` stays, and the asymmetry is the point: "not sold at a list
   * price" is genuinely a different KIND of answer, not a different number, so
   * it is a different shape. Two shapes, and each earns its own.
   */
  readonly price: 'contact' | { readonly month: number; readonly year: number };
  /**
   * The caps this plan publishes, or `null` where the menu deliberately says
   * nothing (a plan sold by conversation publishes no numbers).
   */
  readonly caps: Caps | null;
  /**
   * Why this row cannot be ordered right now — the closed door's own sentence,
   * verbatim — or absent when the way is open. A menu lists what can be
   * ordered, and a row that is sold but not yet orderable (its door is closed:
   * checkout unbuilt, a feature unfinished) SAYS SO on the menu instead of
   * only at the order.
   *
   * Clients branch on PRESENCE and render the sentence unchanged — they know
   * *that* the row is closed, never *which* door or *when it lifts*; the
   * vocabulary of doors stays server-side. The same rule the refusal follows:
   * `POST /billing/change` onto a closed row answers 400 with
   * `details.closed`, and its `message` is this sentence.
   */
  readonly closed?: string;
}

/**
 * Response for `GET /plans` — the whole public menu, in display order.
 *
 * Public, unauthenticated and cacheable: it describes the product, not the
 * caller. Plans the operator only ever grants by hand are absent — a menu
 * lists what can be ordered.
 *
 * An aggregate rather than a list: the registry is the bound, so there is no
 * cursor (the {@link LabelsResponse} shape).
 */
export interface PlansResponse {
  readonly plans: readonly Plan[];
}

/**
 * The body of `POST /billing/change` — the one door for "get me onto this
 * plan". Both fields required: with more than one billed plan there is no
 * honest default, and the console always knows which card was clicked.
 *
 * The SERVER decides what the change means — the rule is *up is now, down is
 * at period end* — so the client holds no copy of the ladder: a free account
 * is sent to Stripe Checkout, a billed account moving up is sent to the
 * Portal's confirmation page (money moves now, so Stripe's page takes the
 * consent), and a billed account moving down gets a Stripe Subscription
 * Schedule that applies the change at period end. The answer says which
 * happened ({@link PlanChangeResponse}).
 */
export interface PlanChangeRequest {
  readonly plan: AccountPlanType;
  readonly interval: BillingInterval;
}

/**
 * The pending plan change — a Stripe Subscription Schedule the platform
 * minted, mirrored onto the account. `at` is when it applies (the current
 * period's end, Unix seconds). Reversible until then: `DELETE
 * /billing/change` releases it.
 */
export interface ScheduledChange {
  readonly plan: AccountPlanType;
  readonly interval: BillingInterval;
  readonly at: number;
}

/**
 * The answer of `POST /billing/change` — exactly one field is set, and the
 * UNION is what holds that: an answer carrying both, or neither, does not
 * compile, so "which door was taken" is structural rather than prose.
 *
 * `url` means GO: a Stripe page (Checkout, or the Portal's confirmation page)
 * finishes the change and the browser must be redirected to it. `scheduled`
 * means DONE: the downgrade is booked for period end, nothing to visit, and
 * the account's `scheduled` field now carries it.
 */
export type PlanChangeResponse =
  /** GO: a Stripe page finishes the change. Absolute URL, single use, short-lived. */
  | { readonly url: string; readonly scheduled?: never }
  /** DONE: the downgrade is booked for period end; nothing to visit. */
  | { readonly url?: never; readonly scheduled: ScheduledChange };

/**
 * The answer of `POST /billing/portal` — Stripe's `BillingPortal.Session`,
 * projected to the one field a client needs. The Portal home: cards,
 * invoices, cancellation. Plan changes have their own door
 * ({@link PlanChangeRequest}).
 */
export interface BillingPortalSession {
  /** Absolute URL to redirect the browser to. Single use, short-lived. */
  readonly url: string;
}

/**
 * The answer of `POST /billing/sync` — the account's plan after the platform
 * re-read Stripe. The success page calls it once on arrival from Checkout,
 * instead of polling for the webhook: a card payment is settled by the time
 * Stripe redirects, so one read makes the plan current before anything
 * renders.
 */
export interface BillingSyncResponse {
  readonly plan: AccountPlanType;
}

// =============================================================================
// ACTIVITY TYPES
// =============================================================================

/**
 * All activity event types logged in the system.
 * Uses dot notation consistently: {resource}.{action}
 *
 * Retention: activity rows are permanent — the account's own history and
 * the platform's audit ledgers are one table, kept for the life of the
 * account (deletion removes them). Only the personal payload is
 * time-bounded: past 90 days each row sheds its IP.
 */
export type ActivityEvent =
  // Account events
  | 'account.create'
  | 'account.delete'
  | 'account.key.generate'
  | 'account.plan.transition'
  // Deployment events
  | 'deployment.create'
  | 'deployment.update'
  | 'deployment.delete'
  | 'deployment.claim'
  | 'deployment.flagged' // Internal: HTML content matched a detection rule (not user-visible)
  | 'deployment.open' // Internal: an operator opened hosted content for moderation (not user-visible)
  // Domain events
  | 'domain.create'
  | 'domain.update'
  | 'domain.delete'
  | 'domain.verify'
  // Token events
  | 'token.create'
  | 'token.consume'
  | 'token.delete'
  // Admin events (not user-visible)
  | 'admin.account.plan.update'
  | 'admin.account.suspended.update'
  | 'admin.account.ref.update'
  | 'admin.account.labels.update'
  | 'admin.deployment.delete'
  | 'admin.domain.delete'
  | 'admin.impersonate';

// A subscription's own history is not logged here. What a plan change MEANS
// is recorded once, as `account.plan.transition`; everything behind it
// (invoices, refunds, disputes, retries) belongs to Stripe, which owns the
// record and shows it to the customer in the Customer Portal.

/**
 * Activity events visible to users in the dashboard
 */
export type UserVisibleActivityEvent =
  | 'account.create'
  | 'account.delete'
  | 'account.key.generate'
  | 'account.plan.transition'
  | 'deployment.create'
  | 'deployment.update'
  | 'deployment.delete'
  | 'deployment.claim'
  | 'domain.create'
  | 'domain.update'
  | 'domain.delete'
  | 'domain.verify'
  | 'token.create'
  | 'token.consume'
  | 'token.delete';

/**
 * Activity record returned from the API
 */
export interface Activity {
  /** The event type */
  event: ActivityEvent;
  /** Unix timestamp (seconds) when the activity occurred */
  created: number;
  /** Associated deployment ID (if applicable) */
  deployment?: string;
  /** Associated domain name (if applicable) */
  domain?: string;
  /** JSON-encoded metadata (parse with JSON.parse) */
  meta?: string;
}

/**
 * Parsed activity metadata.
 * Different events populate different fields.
 *
 * Naming convention: meta booleans are event-scoped predicates and carry
 * their prefix (`isUpdate`, `wasVerified`, `hasConfig`, `hasPassword`),
 * while entity booleans are bare nouns (`Deployment.config`,
 * `Deployment.password`). Two vocabularies, each internally consistent —
 * deliberate, not drift.
 */
export interface ActivityMeta {
  // Deployment events
  /** Number of files in deployment */
  files?: number;
  /** Total size in bytes */
  size?: number;
  /** Whether deployment has a ship.json config */
  hasConfig?: boolean;
  /** Whether deployment has a password set */
  hasPassword?: boolean;
  /**
   * The client/tool that created the deployment.
   *
   * Narrower than {@link Deployment.via}, deliberately: the entity is
   * `string | null` because stored rows predate the vocabulary, while an
   * activity is only ever written by code that names one. It is here rather
   * than read off the deployment because the deployment row is deleted at
   * expiry or on request and the activity is not — this is where a deploy's
   * origin stays answerable afterwards.
   */
  via?: DeploymentViaType;

  // Domain events
  /** Whether this was an update (vs create) */
  isUpdate?: boolean;
  /** Whether domain was already verified */
  wasVerified?: boolean;
  /** Previous deployment ID before relinking */
  previousDeployment?: string;
  /** Labels that were set/updated */
  labels?: string[];

  // Account events
  /** OAuth provider name */
  provider?: string;
  /** Account email */
  email?: string;
  /** Account display name */
  name?: string;

  // Plan transition events
  /** Previous plan */
  from?: string;
  /** New plan */
  to?: string;

  /** Allow additional fields for future use */
  [key: string]: unknown;
}

/**
 * Response from GET /activities endpoint
 */
export interface ActivityListResponse extends ListResponse {
  /** Array of activities */
  activities: Activity[];
}

// =============================================================================
// FILE UPLOAD TYPES
// =============================================================================

/**
 * File status constants for validation state tracking
 */
export const FileValidationStatus = {
  /** File is pending validation */
  PENDING: 'pending',
  /** File failed during processing (before validation) */
  PROCESSING_ERROR: 'processing_error',
  /** File was excluded by validation warning (not an error) */
  EXCLUDED: 'excluded',
  /** File failed validation (blocks deployment) */
  VALIDATION_FAILED: 'validation_failed',
  /** File passed validation and is ready for deployment */
  READY: 'ready',
} as const;

export type FileValidationStatusType =
  (typeof FileValidationStatus)[keyof typeof FileValidationStatus];

/**
 * A validation issue with a display-ready message
 *
 * Issues are either errors (in errors[] array) or warnings (in warnings[] array).
 * The array position determines severity - no need to duplicate it in the object.
 */
export interface ValidationIssue {
  /** File path that triggered this issue */
  file: string;

  /** Display-ready message explaining the issue */
  message: string;
}

/**
 * Minimal file interface required for validation
 */
export interface ValidatableFile {
  name: string;
  size: number;
  status?: FileValidationStatusType;
  statusMessage?: string;
}

/**
 * File validation result with severity-based issue reporting
 *
 * Validation checks files against constraints and categorizes issues by severity:
 * - **Errors**: Block deployment (file too large, invalid type, etc.)
 * - **Warnings**: Exclude files but allow deployment (empty files, etc.)
 *
 * @example
 * ```typescript
 * const result = validateFiles(files, config);
 *
 * if (!result.canDeploy) {
 *   // Has errors - must fix before deploying
 *   console.error('Deployment blocked:', result.errors);
 * } else if (result.warnings.length > 0) {
 *   // Has warnings - deployment proceeds, some files excluded
 *   console.warn('Files excluded:', result.warnings);
 *   deploy(result.validFiles);
 * } else {
 *   // All files valid
 *   deploy(result.validFiles);
 * }
 * ```
 */
export interface FileValidationResult<T extends ValidatableFile> {
  /** All files with updated status */
  files: T[];

  /** Files ready for deployment (status: 'ready') */
  validFiles: T[];

  /** Blocking errors that prevent deployment */
  errors: ValidationIssue[];

  /** Non-blocking warnings (files excluded but deployment allowed) */
  warnings: ValidationIssue[];

  /** Whether deployment can proceed (true if errors.length === 0) */
  canDeploy: boolean;
}

/**
 * Represents a file that has been uploaded and stored
 */
export interface UploadedFile {
  key: string;
  etag: string;
  size: number;
  validated?: boolean;
}

// =============================================================================
// DOMAIN UTILITIES
// =============================================================================

/**
 * Check if a domain is a platform domain (subdomain of our platform).
 * Platform domains are free and don't require DNS verification.
 *
 * @example isPlatformDomain("www.shipstatic.com", "shipstatic.com") → true
 * @example isPlatformDomain("example.com", "shipstatic.com") → false
 */
export function isPlatformDomain(domain: string, platformDomain: string): boolean {
  return domain.endsWith(`.${platformDomain}`);
}

/**
 * Check if a domain is a custom domain (not a platform subdomain).
 * Custom domains are billable and require DNS verification.
 *
 * @example isCustomDomain("example.com", "shipstatic.com") → true
 * @example isCustomDomain("www.shipstatic.com", "shipstatic.com") → false
 */
export function isCustomDomain(domain: string, platformDomain: string): boolean {
  return !isPlatformDomain(domain, platformDomain);
}

/**
 * Extract subdomain from a platform domain.
 * Returns null if not a platform domain.
 *
 * @example extractSubdomain("www.shipstatic.com", "shipstatic.com") → "www"
 * @example extractSubdomain("example.com", "shipstatic.com") → null
 */
export function extractSubdomain(domain: string, platformDomain: string): string | null {
  if (!isPlatformDomain(domain, platformDomain)) {
    return null;
  }
  return domain.slice(0, -(platformDomain.length + 1)); // +1 for the dot
}

/**
 * Generate HTTPS URL for a deployment hostname.
 */
export function generateDeploymentUrl(deployment: string): string {
  return `https://${deployment}`;
}

/**
 * Generate HTTPS URL for a domain.
 */
export function generateDomainUrl(domain: string): string {
  return `https://${domain}`;
}

// =============================================================================
// LABEL UTILITIES
// =============================================================================

/**
 * Label validation constraints shared across UI and API.
 * These rules define the single source of truth for label validation.
 */
export const LABEL_CONSTRAINTS = {
  /** Minimum label length in characters */
  MIN_LENGTH: 3,
  /** Maximum label length in characters (concise labels, matches Stack Overflow's original limit) */
  MAX_LENGTH: 25,
  /** Maximum number of labels allowed per resource */
  MAX_COUNT: 10,
  /** Allowed separator characters between label segments */
  SEPARATORS: '._-',
} as const;

/**
 * Label validation pattern.
 * Must start and end with alphanumeric (a-z, 0-9).
 * Can contain separators (. _ -) between segments, but not consecutive.
 *
 * Valid examples: 'production', 'v1.2.3', 'api_v2', 'us-east-1'
 * Invalid examples: 'ab' (too short), '-prod' (starts with separator), 'foo--bar' (consecutive separators)
 */
export const LABEL_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/**
 * Serialize labels array to JSON string for database storage.
 * Returns null for empty or undefined arrays.
 *
 * @example serializeLabels(['web', 'production']) → '["web","production"]'
 * @example serializeLabels([]) → null
 * @example serializeLabels(undefined) → null
 */
export function serializeLabels(labels: string[] | undefined): string | null {
  if (!labels || labels.length === 0) return null;
  return JSON.stringify(labels);
}

/**
 * Deserialize labels from JSON string to array.
 * Always returns an array — empty array for null/empty/invalid input.
 *
 * @example deserializeLabels('["web","production"]') → ['web', 'production']
 * @example deserializeLabels(null) → []
 * @example deserializeLabels('') → []
 */
export function deserializeLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    const parsed = JSON.parse(labelsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// =============================================================================
// PASSWORD UTILITIES
// =============================================================================

/**
 * Length constraints for the optional deployment password
 * (`DeploymentUploadOptions.password`). Single source of truth shared across
 * platform consumers.
 */
export const PASSWORD_CONSTRAINTS = {
  /** Minimum password length in characters */
  MIN_LENGTH: 6,
  /** Maximum password length in characters */
  MAX_LENGTH: 128,
} as const;

/**
 * Validate an optional deployment password and return it normalized.
 *
 * Absent (`undefined` / `null`) → returns `undefined`. Present → trim
 * leading/trailing whitespace, then validate against `PASSWORD_CONSTRAINTS`
 * length bounds (internal whitespace is significant and counts toward
 * length). Throws `ShipError.validation` on breach; returns the trimmed
 * value.
 *
 * The trim is canonical: at upload, the API hashes the trimmed value; at
 * unlock, the router trims submissions before hashing. Submission and storage
 * agree byte-for-byte. Length validation runs on the trimmed value because
 * that's the user's actual intent — and it disarms a class of invisible
 * foot-guns (trailing newlines from copy/paste, mobile auto-spacing,
 * password-manager artifacts).
 *
 * Single source of truth shared by SDK (client-side validation, return
 * ignored) and API (server-side enforcement, return threaded into config).
 * Length is part of the wire-format contract; strength rules, if added later,
 * stay server-side. See `CLAUDE.md` "Validation: format vs policy".
 */
export function validatePassword(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw ShipError.validation('Password must be a string');
  }
  const trimmed = value.trim();
  if (
    trimmed.length < PASSWORD_CONSTRAINTS.MIN_LENGTH ||
    trimmed.length > PASSWORD_CONSTRAINTS.MAX_LENGTH
  ) {
    throw ShipError.validation(
      `Password must be between ${PASSWORD_CONSTRAINTS.MIN_LENGTH} and ${PASSWORD_CONSTRAINTS.MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}
